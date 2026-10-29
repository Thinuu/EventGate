# 17_OPERATIONS_GUIDE

## Overview
This guide provides day‑to‑day operational procedures for running and maintaining the **ENTRYNEX / EAMS** platform.

### 1. Starting / Stopping Services
- **Development**:
  - Backend: `cd backend && npm run dev`
  - Frontend: `cd frontend && npm start`
- **Production (systemd)**:
  ```bash
  sudo systemctl start eams-backend
  sudo systemctl stop eams-backend
  sudo systemctl restart eams-backend
  ```
- **Docker**: `docker compose up -d` / `docker compose down`

### 2. Database Management
- **Backup** (MongoDB):
  ```bash
  mongodump --uri="${MONGODB_URI}" --out=/backups/eams_$(date +%F)
  ```
- **Restore**:
  ```bash
  mongorestore --uri="${MONGODB_URI}" /backups/eams_<date>
  ```
- **Migrations**: Scripts are located in `backend/scripts/migrations/`. Run with:
  ```bash
  node backend/scripts/migrations/<script>.js
  ```

### 3. Monitoring & Logging
- **Application Logs**: `backend/logs/app.log` – rotate with `logrotate`.
- **Request Logs**: Stored in `requestlogs` collection; query via MongoDB Compass.
- **System & Audit Logs**: `systemlogs` and `auditlogs` collections.
- **Health Checks**:
  - HTTP: `GET /api/health` returns `{status: "ok"}`.
  - Docker healthcheck is defined in `docker-compose.yml`.

### 4. Incident Response
| Symptom | Likely Cause | Immediate Action |
|---------|--------------|------------------|
| API returns 500 | Unhandled exception – check `systemlogs` | Restart backend, inspect recent code changes |
| Emails not sent | SMTP config missing or disabled | Verify `SystemConfig.email.enabled` and env vars `SMTP_*` |
| SMS/WhatsApp not delivered | Twilio credentials or disabled channel | Check `SystemConfig.sms.enabled`/`whatsapp.enabled` and Twilio keys |
| Payments stuck at *Pending* | Payment gateway timeout – inspect gateway logs | Verify `paymentService` integration, check gateway dashboard |

### 5. Scaling
- **Horizontal scaling**: Deploy multiple backend instances behind a load balancer (NGINX). Ensure the session store is stateless (JWT) and MongoDB can handle the load.
- **Cache**: Optional Redis layer can be introduced for frequently accessed data (e.g., event details) – requires code changes.

---
*All operational procedures are derived from the repository’s scripts, Docker config, and logging utilities.*
