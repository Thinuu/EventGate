# 07_AUTHENTICATION_AUTHORIZATION

## Overview
Authentication and authorization are handled centrally in the **backend** using JSON Web Tokens (JWT) and role‑based access control (RBAC). The flow is:
1. **Login** – `/api/auth/login` validates credentials, issues an **access token** (short‑lived) and a **refresh token** (stored in an HttpOnly cookie).
2. **Refresh** – `/api/auth/refresh-token` exchanges a valid refresh token for a new access token.
3. **Protected Routes** – All routes that require a logged‑in user import the `protect` middleware (`backend/src/middleware/auth.js`). This middleware:
   - Reads the `Authorization: Bearer <token>` header **or** the `refreshToken` cookie.
   - Verifies the token with `process.env.JWT_SECRET`.
   - Attaches `req.user` (containing the user id and role) to the request object.
4. **Authorization** – Controllers check `req.user.role` against allowed roles. The system defines the following roles (see `08_ROLES_PERMISSIONS.md`):
   - `MainAdmin`
   - `MainOrganiser`
   - `SubOrganiser`
   - `Staff`
   - `Volunteer`
   - `Auditor`
   - `Sponsor`
   - `Attendee`

### Multi‑Factor Authentication (MFA)
- Optional MFA can be enabled per user.
- Setup via `/api/auth/mfa/setup` (generates secret + QR code).
- Activation via `/api/auth/mfa/activate` (requires TOTP token, generates backup codes).
- Deactivation via `/api/auth/mfa/deactivate`.
- Login flow checks `user.mfaEnabled` and, if set, requires a `mfaToken`.

### Password Policies
- Enforced in `validateNewPassword` (see `auth.js`).
- Minimum length configurable via `SystemConfig.security.minPasswordLength` (default 8).
- Optional complexity requirement (`requirePasswordComplexity`).
- Password history check prevents reuse of the last 3 passwords.

### Session Management
- Access tokens are **stateless** JWTs (default TTL 24 h, configurable via `SystemConfig.security.jwtTtlHours`).
- Refresh tokens are stored in the DB (`user.refreshToken`) and invalidated on logout or password change.
- Logout (`/api/auth/logout`) clears the refresh cookie and removes token from the DB.

---
*All information is derived from `backend/src/routes/auth.js` and the associated middleware.*
