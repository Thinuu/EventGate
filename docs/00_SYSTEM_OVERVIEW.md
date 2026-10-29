# EAMS System Overview

**Project:** ENTRYNEX Event Access Management System  
**Version:** 1.0.0  
**Last Updated:** October 5, 2026

---

## What is EAMS?

EAMS (Event Access Management System) is a full-stack platform for managing events, ticketing, access control, payments, and staff operations. It enables event organizers to create events, sell tickets, validate attendee access using QR codes and RFID tags, and track real-time entry/exit activity.

---

## Technology Stack

### Frontend
- **Framework:** React 18
- **Styling:** Tailwind CSS
- **Routing:** React Router DOM
- **HTTP Client:** Axios
- **Real-time:** Socket.io-client
- **Charts:** Recharts
- **Icons:** Heroicons
- **QR Code:** html5-qrcode, qrcode

### Backend
- **Runtime:** Node.js
- **Framework:** Express
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT with bcrypt
- **Real-time:** Socket.io
- **Validation:** express-validator
- **Security:** Helmet, express-rate-limit

### Integrations
- **Payments:** Stripe, PayHere (Sri Lanka)
- **Email:** SendGrid, Nodemailer/SMTP
- **SMS/WhatsApp:** Twilio
- **File Storage:** Azure Blob Storage
- **RFID:** USB keyboard-wedge reader (EM4100/TK4100)

---

## System Architecture

```
┌─────────────────┐
│  React Frontend │
│  (Client App)   │
└────────┬────────┘
         │ REST API + Socket.io
         ↓
┌─────────────────┐
│  Express API    │
│  (Backend)      │
└────────┬────────┘
         │ Mongoose ODM
         ↓
┌─────────────────┐
│   MongoDB       │
│  (Database)     │
└─────────────────┘

External Integrations:
- Stripe/PayHere (Payments)
- SendGrid/Twilio (Notifications)
- Azure Blob (File Storage)
```

---

## User Roles & Permissions

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **MainAdmin** | System administrator | Full system access, user management, global configuration |
| **MainOrganiser** | Company/event owner | Create events, manage team, view all event data, RFID registry |
| **SubOrganiser** | Event-specific organiser | Manage assigned events, scan entries/zones, assign RFID, view payments |
| **Staff** | On-site operations | Scan tickets, manage zones, assign RFID, cash collection |
| **Auditor** | System auditor | Read-only access to all logs and reports |
| **Sponsor** | Event sponsor | View sponsorship details, upload assets |
| **Attendee** | Ticket buyer | Purchase tickets, manage personal tickets, receive notifications |

### Role Hierarchy
```
MainAdmin > MainOrganiser > SubOrganiser > Staff > Attendee
Auditor (parallel, read-only)
Sponsor (parallel, limited read)
```

---

## Core Workflows

### 1. Event Setup Flow

```
Admin/MainOrganiser creates event
    ↓
Configure event details (name, dates, venue)
    ↓
Create ticket categories (VIP, General, etc.)
    ↓
Define physical zones with access rules
    ↓
Set up sponsor packages (optional)
    ↓
Configure payment methods (card, bank transfer, cash)
    ↓
Enable RFID feature (optional)
    ↓
Add RFID inventory (if enabled)
    ↓
Assign team (SubOrganisers, Staff)
    ↓
Publish event
```

### 2. Ticket Purchase Flow

#### Online Payment (Stripe/PayHere)
```
Buyer browses events → Selects tickets → Creates order → 
Redirects to payment gateway → Webhook confirmation → 
Order marked PAID → Attendee assignment → Ticket delivery
```

#### Bank Transfer
```
Buyer creates order → Selects bank transfer → Receives instructions → 
Uploads payment receipt → Organiser reviews → 
Approval → Order confirmed → Ticket delivery
```

#### Cash at Entrance
```
Buyer creates order → Selects cash at entrance → 
Order RESERVED → Receives reservation email → 
Arrives at venue → Staff collects cash → 
Order confirmed → QR activated → Ticket delivery
```

### 3. Attendee Assignment & Confirmation
```
Ticket purchased → Buyer assigns attendee → 
Attendee receives invitation link → 
Submits identity details + photo → 
Photo verification (if enabled) → 
If rejected → Resubmit allowed
If approved → QR token generated → 
RFID tag allocated (if inventory exists) → 
Final ticket delivered (PDF + email)
```

### 4. Entry Access Flow (Main Gates)
```
Staff opens Entry Scanner → Scans QR code OR RFID tag →
Backend validates:
  - Ticket status (must be confirmed/sold)
  - Event scope
  - Check-in state
If CHECK_IN:
  - Attendee not already checked in → Allow → Mark checkedIn=true
  - Already checked in → Deny → Suggest switch to EXIT mode
If CHECK_OUT:
  - Attendee checked in → Allow → Mark checkedIn=false
  - Not checked in → Deny → Must check in first
Cross-credential support: QR check-in → RFID check-out (and vice versa)
RFID Assignment: After successful scan, if attendee has no RFID → 
Staff can assign one (if RFID enabled for event)
```

### 5. Zone Access Flow (Inner Areas)
```
Staff opens Zone Scanner → Scans QR/RFID →
Backend validates:
  - Must be checked in at main entry first
  - Ticket must allow access to this zone
  - Selected action (ENTRY/EXIT) matches current state
  - Not within 5-second duplicate window
If ENTRY and already inside → Deny (ALREADY_INSIDE)
If EXIT and already outside → Deny (ALREADY_OUTSIDE)
If valid → Grant access → Log ZoneLog → Real-time socket update
```

---

## Key Features

### Event Management
- Create/edit/publish events with rich configuration
- Multiple event types (cricket, concert, conference, custom)
- Ticket categories with pricing, capacity, and zone access
- Physical zones with capacity and access rules
- Sponsor packages with benefits
- Custom attendee data fields
- Short-link generation for event pages
- Event branding (theme, logo, banner)

### Ticketing System
- Multi-category ticket support
- Real-time inventory tracking
- Automatic RFID allocation (if enabled)
- Ticket status lifecycle (PENDING → ASSIGNED → CONFIRMED → SOLD)
- QR code generation per attendee
- PDF ticket generation
- Ticket transfer capability (optional feature)

### Payment Processing
- **Online**: Stripe (global), PayHere (Sri Lanka)
- **Bank Transfer**: Receipt upload and approval workflow
- **Cash at Entrance**: Reservation system with onsite confirmation
- Webhook verification for security
- Payment history tracking
- Refund processing
- Multi-currency support

### Access Control
- **Dual Credential System**: QR codes and RFID tags are interchangeable
- **Entry Scanner**: Main gate check-in/check-out with state management
- **Zone Scanner**: Inner area access with movement tracking
- **Credential Deduplication**: Prevents duplicate check-ins with different credentials
- **Cross-Credential Support**: QR check-in → RFID check-out allowed
- **Real-time Updates**: Socket.io broadcasts to all staff terminals
- **Audit Trail**: Complete EntryLog and ZoneLog records

### RFID Management
- Event-scoped RFID inventory by category
- Bulk Excel import or individual tag addition
- Automatic allocation during ticket assignment
- QR-first assignment workflow for staff
- View-only RFID Assignment Registry for organizers
- RFID feature toggle per event
- Support for USB keyboard-wedge readers (10-digit format)

### Photo Verification
- Attendee photo upload with validation
- Face detection and quality checks
- Review queue for authorized staff
- Rejection with reasons and resubmit workflow
- Integration with Azure Face API for advanced verification

### Notifications
- Multi-channel: Email (SendGrid), SMS (Twilio), WhatsApp (Twilio)
- Order confirmations
- Attendee invitations
- Photo rejection notices
- Ticket delivery
- Payment reminders
- Real-time dashboard notifications

### Real-time Features
- Socket.io for live updates
- Live dashboard with operational statistics
- Real-time scan activity feed
- Multi-terminal synchronization
- Maintenance mode broadcast

### Reporting & Analytics
- Entry/exit statistics
- Zone access reports
- Payment reports
- Ticket sales analytics
- RFID assignment registry
- Audit logs
- Activity logs per staff member

### Security Features
- JWT authentication with refresh tokens
- MFA (Multi-Factor Authentication) support
- Password history tracking
- Account lockout after failed attempts
- Email verification
- Role-based permission enforcement
- Event scoping for operational users
- Rate limiting
- Helmet security headers
- CORS configuration

---

## Database Models (Key Entities)

### Core Models
- **User**: Authentication, roles, permissions, assignments
- **Event**: Event configuration, categories, zones, settings
- **Order**: Buyer orders with payment status
- **Ticket**: Ticket assignment and status
- **Attendee**: Attendee identity, QR token, RFID tag, verification status
- **RfidTag**: RFID inventory with status tracking
- **EntryLog**: Main gate access records
- **ZoneLog**: Zone access audit trail
- **Notification**: Persistent notification records
- **SystemConfig**: Global system settings

### Key Relationships
```
Order → Ticket → Attendee → {qrToken, rfidTag}
Event → Categories → Tickets
Event → Zones → Access Rules
User → Assigned Events → Scoped Permissions
```

---

## API Structure

### Main API Areas
- `/api/auth/*` - Authentication, MFA, password reset
- `/api/events/*` - Event management, public listings
- `/api/orders/*` - Order creation, management
- `/api/buyer/*` - Buyer-specific operations
- `/api/payment/*` - Payment sessions, webhooks
- `/api/bank-transfer/*` - Bank transfer workflow
- `/api/attendees/*` - Attendee management, bulk upload
- `/api/verification/*` - Photo verification
- `/api/rfid/*` - RFID inventory, assignment
- `/api/entry/*` - Entry scanning, access control
- `/api/zone/*` - Zone scanning, access logs
- `/api/notifications/*` - Notification retrieval
- `/api/admin/*` - Admin operations
- `/api/organiser/*` - Organiser operations
- `/api/sub/*` - Sub-organiser operations
- `/api/staff/*` - Staff operations
- `/api/auditor/*` - Auditor operations

---

## Frontend Structure

### Page Organization
- **Public**: Home, event listing, event details, checkout
- **Auth**: Login, signup, password reset, MFA setup
- **Buyer**: Dashboard, tickets, orders, payment history, profile
- **Attendee**: Dashboard, tickets, events, profile, notifications
- **Admin**: Dashboard, user management, RFID inventory, settings
- **Organiser**: Dashboard, event management, team, reports
- **SubOrganiser**: Dashboard, entry/zone scanners, verification, payments
- **Staff**: Scanners, zone access, manual search, activity logs
- **Auditor**: Dashboard, logs, reports
- **Sponsor**: Dashboard, sponsorship details

### Key Components
- Real-time scanners with QR/RFID support
- Dashboard with live statistics
- Activity feed with socket updates
- Multi-tab operational interfaces
- Permission-based UI rendering

---

## Project Structure

```
eams/
├── backend/
│   ├── src/
│   │   ├── config/           # Configuration files
│   │   ├── controllers/      # Request handlers
│   │   ├── jobs/             # Scheduled tasks
│   │   ├── middleware/       # Express middleware
│   │   ├── models/           # Mongoose schemas
│   │   ├── routes/           # API routes
│   │   ├── scripts/          # Utility scripts
│   │   ├── services/         # Business logic
│   │   └── utils/            # Helper functions
│   ├── uploads/              # Local file uploads
│   ├── .env                  # Environment variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/              # API client functions
│   │   ├── components/       # Reusable components
│   │   ├── config/           # Frontend configuration
│   │   ├── context/          # React contexts
│   │   ├── hooks/            # Custom React hooks
│   │   ├── layouts/          # Page layouts
│   │   ├── pages/            # Page components
│   │   └── utils/            # Helper functions
│   ├── public/               # Static assets
│   ├── .env                  # Environment variables
│   └── package.json
├── docs/                     # Documentation
├── .github/                  # GitHub workflows
└── README.md
```

---

## Unique Features

1. **Unified QR+RFID System**: Both credentials resolve to the same attendee record with cross-credential support
2. **Event-Scoped RFID**: RFID inventory organized by event and category, not global
3. **Check-In/Check-Out State Management**: Proper state validation with smart mode switching
4. **Zone Movement Tracking**: Strict ENTRY/EXIT validation with duplicate protection
5. **Multi-Payment Gateway Support**: Stripe, PayHere, bank transfer, and cash workflows
6. **Photo Verification Workflow**: Upload → Review → Approve/Reject → Resubmit cycle
7. **Real-time Multi-Terminal Sync**: All staff see the same live data via Socket.io
8. **Granular RBAC**: Fine-grained permissions at user and event level
9. **Maintenance Mode Bypass**: Operational roles can work during system maintenance
10. **Audit Trail**: Complete logging of all access attempts and system actions

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- npm
- MongoDB instance (local or remote)
- Environment variables configured

### Backend Setup
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
cp .env.example .env
npm install
npm start
```

---

## Documentation Index

- [01_PROJECT_OVERVIEW.md](01_PROJECT_OVERVIEW.md) - High-level project overview
- [02_SYSTEM_ARCHITECTURE.md](02_SYSTEM_ARCHITECTURE.md) - System architecture details
- [03_PROJECT_STRUCTURE.md](03_PROJECT_STRUCTURE.md) - Repository structure
- [04_DATABASE_DOCUMENTATION.md](04_DATABASE_DOCUMENTATION.md) - Database models
- [05_DATABASE_RELATIONSHIPS.md](05_DATABASE_RELATIONSHIPS.md) - Data relationships
- [06_API_DOCUMENTATION.md](06_API_DOCUMENTATION.md) - API endpoint reference
- [07_AUTHENTICATION_AUTHORIZATION.md](07_AUTHENTICATION_AUTHORIZATION.md) - Auth mechanisms
- [08_ROLES_PERMISSIONS.md](08_ROLES_PERMISSIONS.md) - User roles and permissions
- [09_BUSINESS_LOGIC.md](09_BUSINESS_LOGIC.md) - Core business logic flows
- [10_PAYMENT_TICKETING_FLOWS.md](10_PAYMENT_TICKETING_FLOWS.md) - Payment workflows
- [11_ZONE_ACCESS_CONTROL.md](11_ZONE_ACCESS_CONTROL.md) - Zone access system
- [12_NOTIFICATION_SYSTEM.md](12_NOTIFICATION_SYSTEM.md) - Notification system
- [13_SECURITY_DOCUMENTATION.md](13_SECURITY_DOCUMENTATION.md) - Security practices
- [14_ERROR_HANDLING_LOGGING.md](14_ERROR_HANDLING_LOGGING.md) - Error handling
- [15_ENVIRONMENT_CONFIGURATION.md](15_ENVIRONMENT_CONFIGURATION.md) - Environment setup
- [16_DEPLOYMENT_GUIDE.md](16_DEPLOYMENT_GUIDE.md) - Deployment instructions
- [17_OPERATIONS_GUIDE.md](17_OPERATIONS_GUIDE.md) - Operational procedures
- [18_TROUBLESHOOTING.md](18_TROUBLESHOOTING.md) - Common issues
- [19_CHANGELOG.md](19_CHANGELOG.md) - Project changelog
- [20_SECRET_ROTATION_AND_REMOVAL.md](20_SECRET_ROTATION_AND_REMOVAL.md) - Secret management

---

## Support

For support, visit: https://devin.ai/support
