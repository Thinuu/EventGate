# 14_ERROR_HANDLING_LOGGING

## Overview
EAMS implements a **centralised error handling and logging** strategy to ensure traceability, simplify debugging, and provide operational insight.

### 1. Error Handling Middleware
File: `backend/src/middleware/errorHandler.js`
```js
module.exports = (err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ success: false, message: err.message || 'Server Error' });
};
```
- All route handlers `next(err)` on failure, passing errors to this middleware.
- Custom errors can set `err.statusCode` for proper HTTP response.

### 2. Request Logging
File: `backend/src/middleware/requestLogger.js`
```js
module.exports = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      userId: req.user ? req.user._id : null,
    };
    // Persist to RequestLog collection
    const RequestLog = require('../models/RequestLog');
    RequestLog.create(log).catch(console.error);
  });
  next();
};
```
- Captures request metadata and stores in `requestlogs` collection.

### 3. System & Audit Logs
- **SystemLog** (`backend/src/models/SystemLog.js`): Records generic system events (e.g., login, token refresh, device registration, zone scans).
- **AuditLog** (`backend/src/models/AuditLog.js`): Stores privileged admin actions (role changes, config updates).
- Both use a simple schema with `userId`, `action`, `details`, `timestamp`.

### 4. Logging Utilities
File: `backend/src/utils/logger.js`
Provides `logActivity({ req, userId, userEmail, userRole, action, details })` which creates a `SystemLog` entry. Used throughout the codebase (auth, payments, zone scans).

### 5. Global Exception Capture
`process.on('unhandledRejection')` and `process.on('uncaughtException')` are attached in `backend/src/server.js` to log unexpected errors and gracefully shut down.

### 6. Front‑end Error Reporting
React components use a **Error Boundary** (`frontend/src/components/ErrorBoundary.jsx`) that catches rendering errors and reports them via an API endpoint (`POST /api/logs/client`). The backend stores these in `SystemLog` with `type: 'client'`.

---
*All details sourced from the middleware, utility, and model files in the backend and the React error boundary component.*
