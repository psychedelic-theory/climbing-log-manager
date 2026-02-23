# DEPLOYMENT.md — Climbing Log Manager (Solo Project 3)

This document describes how the Climbing Log Manager is deployed in production, including custom domain setup, hosting providers, tech stack, database hosting, deployment/update workflow, and how configuration/secrets are managed.

---

## Domain + Registrar

- **Domain:** `johanzapata.com`
- **WWW Domain:** `www.johanzapata.com`
- **Registrar:** Namecheap

**Routing / Redirect Behavior**
- `johanzapata.com` redirects to `www.johanzapata.com` (the `www` hostname is the canonical site).

---

## Hosting Provider(s)

- **Frontend Hosting:** Render (Static Site)
  - Render subdomain: `https://climbing-log-manager-g83g.onrender.com/`
  - Custom domain: `https://www.johanzapata.com`

- **Backend Hosting:** Render (Web Service)
  - Backend API base URL: `https://climbing-log-manager.onrender.com`

- **Database Hosting:** Render (Managed PostgreSQL)

---

## Tech Stack

### Frontend
- HTML
- CSS
- JavaScript (vanilla)

### Backend
- Python (Flask)
- Gunicorn (production WSGI server)

### Database
- PostgreSQL (Render Managed Postgres)
- **Primary logs table:** `climb_logs`

---

## Database Type + Where It’s Hosted

- **Database Type:** PostgreSQL
- **Hosted On:** Render (Managed PostgreSQL instance)
- **Connection:** Backend connects using a `DATABASE_URL` environment variable provided by Render.

---

## How to Deploy and Update the App

### Source Control
- The project is stored in a GitHub repository and connected to Render services.

### Automatic Deploys (Recommended Workflow)
1. Commit and push changes to the main branch on GitHub.
2. Render automatically triggers a build + deploy for:
   - Frontend Static Site service
   - Backend Web Service

### Render Service Settings (High Level)
- **Frontend (Static Site):**
  - Deployed as static assets (HTML/CSS/JS).
- **Backend (Web Service):**
  - Runs Flask app via Gunicorn.

### Updating the Database Schema / Seed Data
- Database is persistent (Render Postgres).
- Schema creation and seed behavior are handled by the backend application logic.
- If seed behavior is enabled, the backend can populate initial rows from a seed file when the database/table is empty (used to meet the “minimum 30 records” requirement).

---

## Configuration / Secrets Management (Environment Variables)

No secrets are committed to Git. All sensitive values are stored in **Render Environment Variables**.

### Backend Environment Variables
- `DATABASE_URL`
  - PostgreSQL connection string used by the backend to connect to Render Postgres.
  - **This is sensitive** and is only stored in Render (never hardcoded in the repo).

(Any additional backend env vars you use—such as allowed origins, feature flags, or environment mode—should also be stored in Render.)

### Frontend Environment Variables
- `API_BASE_URL`
  - Base URL used by the frontend to send requests to the backend API.

> Note: Frontend “env vars” are not secrets in a browser-based app. The backend API base URL will always be discoverable by users via browser dev tools/network requests. The goal is configuration cleanliness (not secrecy).

---

## Verification Checklist (Quick)
- App loads successfully at: `https://www.johanzapata.com`
- HTTPS is enabled (secure lock icon in browser)
- Backend reachable at: `https://climbing-log-manager.onrender.com/api/health`
- CRUD operations persist to PostgreSQL (not JSON files)
- Data exists in Postgres table `climb_logs` and survives refresh/redeploys