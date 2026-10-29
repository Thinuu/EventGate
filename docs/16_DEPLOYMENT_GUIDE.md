# 16_DEPLOYMENT_GUIDE

## Overview
This guide walks you through setting up the **ENTRYNEX / EAMS** platform locally and in a production environment (Docker or traditional server). It covers prerequisites, configuration, building the frontend, and running the backend.

---
### Prerequisites
| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| **Node.js** | 18.x (LTS) | Runtime for both frontend and backend |
| **npm** | 9.x | Package manager |
| **MongoDB** | 5.x | Database – can be local or hosted (Atlas) |
| **Docker** *(optional)* | 24.x | Containerised deployment |
| **Git** | any | Source control |

---
### 1️⃣ Local Development Setup
1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/eams.git
   cd eams
   ```
2. **Create environment files**
  - Copy the examples:
  ```bash
  cp backend/.env.example backend/.env
  cp frontend/.env.example frontend/.env
  ```
  - Fill in the example values (see **15_ENVIRONMENT_CONFIGURATION.md** for details). Use a local MongoDB URI or a cloud Atlas connection string.
3. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   # Frontend
   cd ../frontend
   npm install
   ```
4. **Run the services** (in separate terminals)
   ```bash
   # Backend (development mode with nodemon)
   cd backend
   npm run dev
   # Frontend (React dev server)
   cd ../frontend
   npm start
   ```
   The API will be available at `http://localhost:5000/api` and the UI at `http://localhost:3000`.

---
### 2️⃣ Production Build (Self‑Hosted)
1. **Build the frontend**
   ```bash
   cd frontend
   npm run build   # creates a static bundle in frontend/build
   ```
2. **Serve the static files**
   - Option A: Let the Express backend serve them. In `backend/src/server.js` ensure the static middleware points to `../frontend/build` (already configured).
   - Option B: Use a dedicated web server (nginx) and proxy API calls to the backend.
3. **Start the backend in production**
   ```bash
   cd backend
   NODE_ENV=production PORT=5000 npm start   # or use a process manager like PM2
   ```
   Make sure the environment variables point to the production DB and have `NODE_ENV=production` for secure cookie flags.

---
### 3️⃣ Dockerised Deployment (Recommended)
> **Note:** The repo ships with a `Dockerfile` for the backend and a separate one for the frontend.
#### Backend Dockerfile (simplified)
```Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ .
RUN npm prune --production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app .
EXPOSE 5000
CMD ["node", "src/server.js"]
```
#### Frontend Dockerfile (simplified)
```Dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
```
#### Docker‑Compose Example
```yaml
version: "3.8"
services:
  mongo:
    image: mongo:5
    restart: always
    volumes:
      - mongo-data:/data/db
    ports:
      - "27017:27017"
  backend:
    build: ./backend
    env_file:
      - backend/.env
    ports:
      - "5000:5000"
    depends_on:
      - mongo
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
volumes:
  mongo-data:
```
Run with `docker compose up -d`. The UI will be reachable at `http://localhost` and the API at `http://localhost:5000/api`.

---
### 4️⃣ Post‑Deployment Checklist
- Verify that **HTTPS** terminates at a reverse proxy (NGINX, Traefik) and that the `secure` flag on cookies is enabled (`process.env.NODE_ENV === 'production'`).
- Set up **process monitoring** (PM2, systemd, or Docker healthchecks).
- Configure **log rotation** for `backend/logs/` and MongoDB logs.
- Populate the `SystemConfig` collection with production values (payment gateway keys, email SMTP credentials, etc.).
- Run a **smoke test**:
  1. Register a new user via the UI.
  2. Create an event, place an order, complete a payment.
  3. Assign tickets and confirm receipt.

---
### 5️⃣ FAQ
- **Why is the frontend build not automatically served?** The backend contains static middleware, but you may prefer a dedicated CDN for better performance.
- **Can I use a different DB?** The code relies heavily on Mongoose; switching to another DB would require major refactoring.
- **How to enable email in production?** Set the `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` env vars and ensure `SystemConfig.email.enabled` is true.

---
*All steps are derived from the repository’s structure (`backend/src/server.js`, Dockerfiles, and environment handling).*
