# 13_SECURITY_DOCUMENTATION

## Overview
The EAMS platform implements a multi‑layered security model covering **authentication**, **authorization**, **data protection**, and **operational safeguards**.

### 1. Authentication
| Component | Details |
|-----------|---------|
| **JWT Access Token** | Short‑lived (default 24 h, configurable via `SystemConfig.security.jwtTtlHours`). Signed with `process.env.JWT_SECRET`. Stored in the `Authorization: Bearer <token>` header. |
| **Refresh Token** | HttpOnly cookie `refreshToken` (7 d expiry). Persisted in `User.refreshToken`. Used to obtain a new access token via `/api/auth/refresh-token`. |
| **Password Policy** | Enforced in `backend/src/routes/auth.js` via `validateNewPassword`. Minimum length configurable (`SystemConfig.security.minPasswordLength`, default 8). Optional complexity regex (`requirePasswordComplexity`). Password history (last 3) prevents reuse. |
| **Multi‑Factor Authentication (MFA)** | Optional per‑user. Setup via `/api/auth/mfa/setup` (TOTP secret + QR). Activation via `/api/auth/mfa/activate` generates backup codes. Login flow checks `user.mfaEnabled` and requires `mfaToken`. |
| **Device Approval** | When `SystemConfig.security.deviceApprovalRequired` is true, each request with `X‑Device‑Id` header must correspond to an approved `UserDevice` entry. |
| **Rate Limiting** | Login endpoint protected by `express-rate-limit` (5 attempts per 15 min). Configurable via `loginLimiter`. |

### 2. Authorization (RBAC)
- **Roles** defined in `backend/src/models/Role.js` (e.g., `MainAdmin`, `MainOrganiser`, `SubOrganiser`, `Staff`, `Volunteer`, `Auditor`, `Sponsor`, `Attendee`).
- **Role Hierarchy** implemented in `backend/src/utils/rbac.js` – higher roles inherit lower privileges.
- **Middleware**:
  - `protect` – validates JWT, checks user status, device legitimacy.
  - `restrictTo(...roles)` – simple role check.
  - `requireEventAccess` – scoped access to a specific event, with fallback to assigned events.
  - `requirePermission(permission)` – fine‑grained JSON permissions stored on the `User` document.
- **Authorization Checks** are performed in route controllers (e.g., `router.post('/events', protect, restrictTo('MainAdmin', 'MainOrganiser'), ...)`).

### 3. Data Protection
- **Password Storage** – bcrypt hashing (`User.schema.pre('save')`).
- **Sensitive Fields** – `User.password`, `User.mfaSecret`, `User.refreshToken` are excluded from queries (`select('-password')`).
 - **Environment Secrets** – All secrets (`JWT_SECRET`, DB URI, API keys) must be provided via environment variables or a secure secrets store (e.g., Azure Key Vault, ASUZE Secrets Manager). Example values are provided in `.env.example` for local development only. The codebase was audited and any embedded secret fallbacks were removed; the application now fails fast if critical secrets are missing.

### 4. Auditing & Logging
- **SystemLog** model captures high‑level actions (login, token refresh, device registration, zone scans).
- **RequestLog** middleware logs every HTTP request (method, path, response time, user ID if authenticated).
- **AuditLog** records admin‑level changes (user role updates, config changes).

### 5. Secure Defaults
- **HTTPS** – Production deployments should terminate TLS at a reverse proxy (NGINX). The code does not enforce TLS but expects `process.env.NODE_ENV === 'production'` to set secure cookies.
- **Content Security** – No server‑side rendering; static assets served via React build. Front‑end sanitises user‑generated content before rendering.
- **CORS** – Configured in `backend/src/app.js` to allow only the defined `FRONTEND_URL`.

---
*All security details are derived from the authentication routes, middleware, models, and configuration schemas present in the codebase.*
