# 03_PROJECT_STRUCTURE

## Repository Overview
```
EAMS/
├─ backend/                # Node.js/Express API
│  ├─ src/
│  │  ├─ config/          # Configuration (database, env)
│  │  ├─ controllers/     # Route handlers (auth, users, events, tickets, etc.)
│  │  ├─ middleware/      # Auth, validation, error handling
│  │  ├─ models/          # Mongoose schemas (User, Event, Ticket, ...)
│  │  ├─ routes/          # Express route definitions
│  │  ├─ services/        # Business logic (email, sms, payments, uploads)
│  │  ├─ utils/           # Helpers (socket.io, seed, clear)
│  │  └─ server.js        # Application entry point
│  ├─ .env, .env.example  # Environment variables
│  └─ package.json        # Backend dependencies
├─ docs/                   # Technical documentation (this folder)
├─ frontend/               # React SPA
│  ├─ src/
│  │  ├─ api/            # Wrapper around backend HTTP calls
│  │  ├─ components/     # Reusable UI components (layout, buyer, organiser, etc.)
│  │  ├─ pages/          # Route pages (buyer, organiser, staff, auditor, ...)
│  │  ├─ App.jsx         # Root component / routing
│  │  └─ index.js        # React entry point
│  ├─ public/             # Static assets
│  ├─ .env, .env.example  # Frontend env (e.g., REACT_APP_API_URL)
│  └─ package.json        # Frontend dependencies
├─ .gitignore
├─ README.md               # Project overview and docs index
└─ LAN_RUN.md (removed)
```

### Key Directories
- **backend/src/controllers** – Implements core business logic for each domain (users, events, tickets, payments, etc.).
- **backend/src/models** – Mongoose schemas defining the MongoDB collections.
- **backend/src/routes** – Express route files that map HTTP endpoints to controller functions.
- **frontend/src/pages** – Top‑level pages for each user role (buyer, organiser, staff, auditor, etc.).
- **frontend/src/components** – Shared UI components (layout, cards, modals, forms).
- **frontend/src/api** – Wrapper functions to call backend endpoints (e.g., `getBuyerOrders`).

---
*Generated from the actual folder structure of the project.*
