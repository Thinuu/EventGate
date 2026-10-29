# 18_TROUBLESHOOTING

## Overview
This guide lists common issues encountered while developing, deploying, or operating the **ENTRYNEX / EAMS** platform and provides step‑by‑step remediation actions.

---
### 1. Application Won’t Start
| Symptom | Likely Cause | Check | Fix |
|---------|--------------|-------|-----|
| `npm run dev` exits with `Cannot find module 'dotenv'` | Missing dev dependencies | `npm install` in `backend/` and `frontend/` | Run `npm ci` again |
| `npm start` hangs on `Connecting to MongoDB...` | MongoDB not running or wrong URI | Verify `MONGODB_URI` in `.env` and that MongoDB service is up (`mongosh`) | Start MongoDB or update the URI |
| Port already in use | Another process using `5000`/`3000` | `netstat -ano | findstr :5000` | Kill the conflicting process or change the port |

---
### 2. Authentication Failures
| Issue | Reason | Debug Steps |
|-------|--------|--------------|
| Login returns **401 Unauthorized** | Expired/incorrect JWT secret | Ensure `process.env.JWT_SECRET` matches the one used to sign tokens. Check that the same `.env` is used for both backend and any test scripts. |
| MFA prompt never appears | `SystemConfig.security.mfaEnabled` disabled or user not enrolled | Verify user `mfaEnabled` flag in DB and that `SystemConfig.security.requireMFA` is true if expected. |

---
### 3. Email / SMS Not Sent
| Channel | Cause | Verification |
|--------|-------|---------------|
| Email | `SystemConfig.email.enabled` is false or SMTP env vars missing | Check `SystemConfig.email.enabled` in DB and `.env` for `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`. |
| SMS / WhatsApp | Twilio credentials invalid or channel disabled | Inspect `SystemConfig.sms.enabled` / `whatsapp.enabled` and Twilio keys. Use Twilio console to view usage errors. |

---
### 4. Payment Stuck in **Pending**
| Potential Reason | Action |
|------------------|--------|
| Webhook from Stripe/PayHere not received | Ensure public URL reachable (ngrok or proper domain) and that webhook endpoints are registered. Check server logs for `paymentService` errors. |
| Database transaction failed | Look at `systemlogs` for `payment` errors. Verify atomicity of `createOrder` and `recordPayment` functions. |

---
### 5. Ticket QR Code Not Displaying
| Symptom | Fix |
|---------|-----|
| Blank image or 404 | Verify that the `qrCodeService` generated a file and stored the path. Ensure static middleware points to the correct folder (`/uploads/qrcodes`). |
| Wrong ticket data | Check `finalConfirmationService` that it populates the correct attendee information before calling `qrCodeService`. |

---
### 6. Zone Scan Fails
| Issue | Resolution |
|-------|------------|
| Device reports **invalid QR** | Confirm the QR code format matches `zoneScanService.validate`. Re‑generate QR if corrupted. |
| Scan API returns **403** | RBAC missing – ensure the scanning device user has `SCAN_ZONE` permission via `requirePermission`. |

---
### 7. Docker Containers Exit Immediately
| Cause | Remedy |
|-------|--------|
| Missing env file | Mount `.env` into container or set variables in `docker-compose.yml`. |
| MongoDB connection refused | Ensure `mongo` service is started before `backend`; add `depends_on` if needed. |

---
### 8. General Tips
- **Log Inspection**: Use MongoDB Compass to query `systemlogs`, `requestlogs`, and `auditlogs`.
- **Health Endpoint**: `GET /api/health` should return `{status:"ok"}` – if not, check server startup logs.
- **Clear Cache**: After config changes, restart backend to reload `SystemConfig` cache.
- **Rollback**: Keep a Git tag before large changes; revert with `git reset --hard <tag>`.

---
*All troubleshooting steps are derived from the code’s error handling, logging utilities, and common failure patterns observed in the repository.*
