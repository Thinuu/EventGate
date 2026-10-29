// src/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const requestLogger = require("./middleware/requestLogger");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require('express-rate-limit');
const maintenanceMode = require("./middleware/maintenanceMode");
const { initializeCleanupScheduler } = require("./utils/s3Cleanup");
const { initializeBankTransferScheduler } = require("./utils/bankTransferScheduler");
const { normalizeRole } = require("./utils/rbac");

// Load environment variables
dotenv.config();

// Models
const User = require("./models/User"); // Create this model (name, email, password)

// Initialize Express app
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
app.get(['/health/live', '/api/health/live'], (req, res) => res.json({ status: 'alive' }));
app.get(['/health/ready', '/api/health/ready'], async (req, res) => {
  try { await initializeRuntime(); await mongoose.connection.db.admin().ping(); res.json({ status: 'ready' }); }
  catch { res.status(503).json({ status: 'unavailable', message: 'Deployment services are not configured or reachable' }); }
});

// Configure CORS for local network testing.
// In development allow any origin; in production restrict to CORS_ORIGINS env var or known hosts.
const defaultAllowed = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const allowedOrigins = (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : defaultAllowed).map(value => value.trim()).filter(Boolean);
for (const host of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) if (host) allowedOrigins.push(`https://${host}`);

if (process.env.NODE_ENV !== 'production') {
  app.use(
    cors({
      origin: true, // reflect request origin (allow all in dev/local network)
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
      credentials: true,
    })
  );
} else {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
      credentials: true,
    })
  );
}

app.use(helmet());
app.use(cookieParser());

// CSRF protection for cookie-based operations
// Uses double-submit cookie pattern: compare cookie value with a header
const csrfCookieName = 'csrf_token';
const csrfHeaderName = 'x-csrf-token';

app.use((req, res, next) => {
  // Skip CSRF for non-state-changing methods and API endpoints
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip for paths that use Bearer token auth (not cookie-based)
  const csrfExemptPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh-token'];
  if (csrfExemptPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  
  // For state-changing requests that may use cookies, validate origin
  // This provides CSRF protection when SameSite='Lax' is not sufficient
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    const allowedOrigin = allowedOrigins.find(o => (() => { try { return new URL(origin).origin === o; } catch { return false; } })());
    if (!allowedOrigin && process.env.NODE_ENV === 'production') {
      // In production, reject requests with unexpected origins
      // Allow requests without origin header (e.g., mobile apps using Bearer tokens)
      const hasBearerToken = req.headers.authorization?.startsWith('Bearer ');
      if (!hasBearerToken) {
        return res.status(403).json({ success: false, message: 'Invalid origin' });
      }
    }
  }
  
  next();
});

// Cold starts reuse a cached database promise. Failure closes API access with 503.
app.use(async (req, res, next) => {
  try { await initializeRuntime(); next(); }
  catch (error) { console.error('Runtime unavailable:', error.message); res.status(503).json({ success: false, message: 'Service temporarily unavailable. Contact the event organiser.' }); }
});

// Global rate limiter to protect non-auth endpoints from abuse/scraping
const globalLimiter = rateLimit({
  store: new (require('./middleware/mongoRateStore'))('global'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased from 300)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
const scanIngressLimiter = rateLimit({ store: new (require('./middleware/mongoRateStore'))('scan-ingress'), windowMs: 60000, max: 3000, standardHeaders: true, legacyHeaders: false });
app.use((req, res, next) => ['/api/entry/scan', '/api/zone/scan'].includes(req.path) ? scanIngressLimiter(req, res, next) : globalLimiter(req, res, next));

app.use((req, res, next) => {

  next();
});

require('./middleware/bodyParsers')(app);
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    // Clean up empty _id and id at the root level of payloads
    if (req.body._id === '' || req.body._id === 'null' || req.body._id === 'undefined') delete req.body._id;
    if (req.body.id === '' || req.body.id === 'null' || req.body.id === 'undefined') delete req.body.id;

    // Convert empty or serialized null/undefined values to null for common ObjectId fields
    const fieldsToNull = ['companyId', 'company', 'eventId', 'event', 'organiserId'];
    fieldsToNull.forEach((field) => {
      if (req.body[field] === '' || req.body[field] === 'null' || req.body[field] === 'undefined') {
        req.body[field] = null;
      }
    });

    // Clean up arrays of ObjectIds
    if (Array.isArray(req.body.organiserIds)) {
      req.body.organiserIds = req.body.organiserIds.filter(id => id && id !== '' && id !== 'null' && id !== 'undefined');
    }
    if (Array.isArray(req.body.mainOrganisers)) {
      req.body.mainOrganisers = req.body.mainOrganisers.filter(id => id && id !== '' && id !== 'null' && id !== 'undefined');
    }
  }
  next();
});
app.use(requestLogger);
app.use(maintenanceMode);
// File uploads go to Azure Blob Storage via azureUpload middleware
// Local uploads folder only served in development for backward compatibility
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}
app.use('/socket.io-client', express.static(path.join(__dirname, '../node_modules/socket.io/client-dist')));

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);

// Align Socket.IO CORS policy with Express CORS settings
const socketCors = (process.env.NODE_ENV !== 'production')
  ? { origin: true, methods: ['GET', 'POST'], credentials: true }
  : { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true };

const io = new Server(server, {
  cors: socketCors,
  transports: ['websocket'],
  maxHttpBufferSize: 16 * 1024,
});
app.set('io', io);

io.use(async (socket, next) => { try { await initializeRuntime(); next(); } catch { next(new Error('Realtime service unavailable')); } });

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Helper function to authorize event access
  const authorizeEventAccess = async (user, eventId) => {
    if (!eventId) return false;
    
    const canonicalRole = normalizeRole(user.role);
    
    // MAIN_ADMIN can access any event
    if (canonicalRole === 'MainAdmin') {
      return true;
    }
    
    // MAIN_ORGANISER: verify user is in event.mainOrganisers OR event.createdBy
    const Event = require('./models/Event');
    const event = await Event.findById(eventId).select('createdBy mainOrganisers assignedOrganisers');
    if (!event) return false;
    
    if (canonicalRole === 'MainOrganiser') {
      const isCreator = event.createdBy?.toString() === user._id.toString();
      const isMainOrganiser = event.mainOrganisers?.some(id => id.toString() === user._id.toString());
      const isAssigned = event.assignedOrganisers?.some(id => id.toString() === user._id.toString());
      return isCreator || isMainOrganiser || isAssigned;
    }
    
    // SUB_ORGANISER, STAFF, VOLUNTEER: check assigned events
    if (user.assignedEvents && user.assignedEvents.some(e => e.toString() === eventId.toString())) {
      return true;
    }
    
    return false;
  };

  // Helper to extract user from JWT token
  const extractUserFromToken = async (token) => {
    if (!token) return null;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (decoded.tokenType !== 'access' || decoded.isTemp) return null;
      const blocked = await require('./models/TokenBlocklist').isTokenBlocked(token);
      if (blocked) return null;
      const User = require('./models/User');
      const user = await User.findById(decoded.id).select('-password');
      return user?.status === 'Active' ? user : null;
    } catch (err) {
      console.error('Socket auth error:', err.message);
      return null;
    }
  };

  // Dashboard room - requires authentication
  socket.on("join_dashboard", async ({ eventId } = {}) => {
    try {
      // Extract token from handshake
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      const user = await extractUserFromToken(token);
      
      if (!user) {
        socket.emit('auth_error', { message: 'Authentication required' });
        return;
      }

      // Verify event access
      const hasAccess = await authorizeEventAccess(user, eventId);
      if (!hasAccess) {
        socket.emit('auth_error', { message: 'Not authorized for this event dashboard' });
        return;
      }

      if (eventId) {
        socket.join(`dashboard:${eventId}`);
        console.log(`Socket ${socket.id} (User: ${user._id}) joined dashboard room: dashboard:${eventId}`);
      }
    } catch (error) {
      console.error('join_dashboard error:', error);
      socket.emit('auth_error', { message: 'Authorization failed' });
    }
  });

  // Event room - requires authentication
  socket.on("join_event", async ({ eventId } = {}) => {
    try {
      // Extract token from handshake
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      const user = await extractUserFromToken(token);
      
      if (!user) {
        socket.emit('auth_error', { message: 'Authentication required' });
        return;
      }

      // Verify event access
      const hasAccess = await authorizeEventAccess(user, eventId);
      if (!hasAccess) {
        socket.emit('auth_error', { message: 'Not authorized for this event' });
        return;
      }

      if (eventId) {
        socket.join(`event:${eventId}`);
        console.log(`Socket ${socket.id} (User: ${user._id}) joined event room: event:${eventId}`);
      }
    } catch (error) {
      console.error('join_event error:', error);
      socket.emit('auth_error', { message: 'Authorization failed' });
    }
  });

  socket.on("leave_event", ({ eventId } = {}) => {
    if (eventId) {
      socket.leave(`event:${eventId}`);
      console.log(`Socket ${socket.id} left event room: event:${eventId}`);
    }
  });

  socket.on("leave_dashboard", ({ eventId } = {}) => {
    if (eventId) {
      socket.leave(`dashboard:${eventId}`);
    }
  });

  // Listings room - public but could be restricted
  socket.on("join_listings", () => {
    socket.join('listings');
  });

  socket.on("leave_listings", () => {
    socket.leave('listings');
  });

  // Buyer room - requires authentication
  socket.on("join_buyer", async ({ userId } = {}) => {
    try {
      // Extract token from handshake to verify identity
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      const user = await extractUserFromToken(token);
      
      if (!user || (userId && user._id.toString() !== userId)) {
        socket.emit('auth_error', { message: 'Not authorized for this buyer room' });
        return;
      }

      if (userId) {
        socket.join(`buyer:${userId}`);
      }
    } catch (error) {
      console.error('join_buyer error:', error);
      socket.emit('auth_error', { message: 'Authorization failed' });
    }
  });

  socket.on("leave_buyer", ({ userId } = {}) => {
    if (userId) {
      socket.leave(`buyer:${userId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// --- SWAGGER DOCS ---
try {
  const swaggerUi = require('swagger-ui-express');
  const swaggerDocument = require('../swagger.json');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'EAMS API Docs'
  }));
} catch (e) {
  console.log('Swagger docs not available:', e.message);
}

// --- ROUTES ---
// Health check
app.get("/", (req, res) => {
  res.send("API Running...");
});

// AUTH ROUTES
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/events', require('./routes/events'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/confirm', require('./routes/confirm'));
app.use('/api/attendees', require('./routes/attendees'));
app.use('/api/rfid', require('./routes/rfid'));
app.use('/api/verification', require('./routes/verification'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/invite', require('./routes/invite'));
app.use('/api/sponsor', require('./routes/sponsor'));
app.use('/api/entry', require('./routes/entry'));
app.use('/api/zone', require('./routes/zone'));
app.use('/api/dashboard', require('./routes/dashboard')); 
app.use('/api/audit', require('./routes/audit'));
app.use('/api/super-admin', require('./routes/superAdmin'));
app.use('/api/user', require('./routes/userPortal'));
app.use('/api/short-links', require('./routes/shortLinks'));
app.use('/api/organiser', require('./routes/organiser'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/buyer/payment-history', require('./routes/buyerPaymentHistory'));
app.use('/api/buyer', require('./routes/buyerRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/sub', require('./routes/sub'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/bank-transfer', require('./routes/bankTransfer'));
app.use('/api/payment-management', require('./routes/paymentManagement'));
app.use('/api/entrance', require('./routes/entrance'));
app.use('/api/upload', require('./routes/upload'));;
app.use('/api/devices', require('./routes/devices'));
app.use('/api/readers', require('./routes/readers'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/internal/cron', require('./routes/cron'));

// Vercel imports an HTTP server; it must not listen, exit, or start timers on import.
let runtimePromise;
async function initializeRuntime() {
  if (!runtimePromise) runtimePromise = (async () => {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /your-|change-this/i.test(process.env.JWT_SECRET)) throw new Error('Configure a strong JWT_SECRET (32+ characters)');
    await require('./config/database')();
    const collection = mongoose.connection.collection('socket_events');
    await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });
    const { createAdapter } = require('@socket.io/mongo-adapter');
    io.adapter(createAdapter(collection, { addCreatedAtField: true }));
  })().catch(error => { runtimePromise = undefined; throw error; });
  return runtimePromise;
}
app.use(require('./middleware/errorHandler').notFound);
app.use(require('./middleware/errorHandler').errorHandler);
server.initializeRuntime = initializeRuntime;
server.app = app;
server.io = io;
module.exports = server;
if (require.main === module) {
  initializeRuntime().then(() => {
    const port = process.env.PORT || 5000;
    server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`API listening on ${port}`));
    // The same authenticated cron route is used locally and on Vercel.
  }).catch(error => { console.error('Startup failed:', error.message); process.exitCode = 1; });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    io.close(); server.close(async () => { await mongoose.disconnect(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
