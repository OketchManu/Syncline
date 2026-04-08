# Syncline

A real-time collaborative task management platform for teams and individuals. Syncline features live updates via WebSocket, Firebase authentication, company workspace management, role-based access control, and a fully responsive Progressive Web App frontend.

**Live:** [https://syncline-8010e.web.app](https://syncline-8010e.web.app)  
**API:** [https://syncline-1.onrender.com](https://syncline-1.onrender.com)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Roadmap](#roadmap)
- [Legal](#legal)
- [Author](#author)

---

## Overview

Syncline is a team operations platform built for real-time collaboration. Users can register as individuals or create a company workspace, manage tasks, invite teammates, assign roles, and track progress — all updated live across all connected clients via WebSocket.

Key capabilities:

- **Real-time updates** — task changes are broadcast instantly to all connected users
- **Firebase authentication** — secure sign-in with email/password or Google
- **Company workspaces** — create a company, invite members by email or invite code, manage roles
- **Role-based access control** — `owner`, `admin`, `manager`, and `member` roles
- **Task management** — create, assign, update, flag, and delete tasks with priority and deadlines
- **Progress reports** — team members submit reports; managers review and approve
- **Overdue detection** — automatic overdue flagging with visual indicators
- **Responsive PWA** — works on desktop, tablet, and mobile with offline awareness
- **Profile persistence** — name and avatar survive server redeployments via `profile_data` table

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│            Client (React PWA)                        │
│   Firebase Auth • Axios • WebSocket • DM Sans UI     │
│   Hosted on Firebase Hosting                         │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS + WebSocket (WSS)
┌───────────────────────▼─────────────────────────────┐
│          Node.js / Express API  (port 3001)          │
│   Firebase Admin SDK • WebSocket (ws)                │
│   REST Endpoints + Real-time Broadcast               │
│   Hosted on Render                                   │
└──────────────────────┬──────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  SQLite DB      │
              │  (Render disk)  │
              │  syncline.db    │
              └─────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Axios, Lucide React |
| API Server | Node.js 20+, Express, `ws` WebSocket library |
| Database | SQLite (`better-sqlite3` / `sqlite3`) |
| Authentication | Firebase Auth (email/password + Google OAuth) |
| Auth Middleware | Firebase Admin SDK (token verification) |
| File Uploads | Multer (avatars + company logos) |
| Email Invites | Nodemailer (SMTP) |
| Hosting — Frontend | Firebase Hosting |
| Hosting — API | Render (Node.js web service) |
| Real-time | WebSocket (`ws` library, server-side broadcast) |

---

## Project Structure

```
syncline/
├── api/                              # Node.js REST + WebSocket server
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js           # SQLite connection, helpers, minimal schema
│   │   │   ├── firebase.js           # Firebase Admin SDK initialisation
│   │   │   ├── migrate.js            # Idempotent schema migrations (runs on boot)
│   │   │   ├── backfill.js           # Data backfills (invite codes etc.)
│   │   │   └── websocket.js          # WebSocket server + broadcast helpers
│   │   ├── middleware/
│   │   │   └── auth.js               # Firebase token verification + role guards
│   │   ├── models/
│   │   │   ├── User.js               # User DB operations
│   │   │   └── Task.js               # Task DB operations
│   │   ├── routes/
│   │   │   ├── auth.routes.js        # /api/auth — register, sync, me, delete
│   │   │   ├── task.routes.js        # /api/tasks — CRUD + flag/unflag
│   │   │   ├── users.routes.js       # /api/users — profile, password, delete
│   │   │   ├── company.routes.js     # /api/company — team, invites, join
│   │   │   └── task-reports.routes.js# /api/task-reports — reports + progress
│   │   └── server.js                 # App entry point + startup sequence
│   ├── uploads/
│   │   ├── avatars/                  # User avatar images
│   │   └── logos/                    # Company logo images
│   ├── .env
│   └── package.json
│
├── web/                              # React PWA frontend
│   ├── public/
│   │   ├── index.html                # App shell + favicon + meta tags
│   │   ├── favicon.svg               # Syncline lightning bolt favicon
│   │   └── manifest.json             # PWA manifest
│   └── src/
│       ├── components/
│       │   ├── auth/
│       │   │   ├── Login.jsx          # Email/password + Google login
│       │   │   ├── Register.jsx       # Registration (personal or company)
│       │   │   ├── ForgotPassword.jsx
│       │   │   ├── ResetPassword.jsx
│       │   │   └── JoinCompany.jsx    # Invite code / invite link join flow
│       │   ├── dashboard/
│       │   │   └── Dashboard.jsx      # Main dashboard (personal + company views)
│       │   └── company/
│       │       ├── CompanyOnboarding.jsx  # Company setup, team, invitations
│       │       ├── TeamManagement.jsx
│       │       ├── ProgressMonitor.jsx
│       │       ├── ReportManagement.jsx
│       │       └── TaskAssignment.jsx
│       ├── context/
│       │   └── AuthContext.jsx        # Firebase auth state + backend sync
│       ├── services/
│       │   ├── api.js                 # Axios API client
│       │   └── websocket.js           # WebSocket client service
│       ├── firebase.js                # Firebase app + provider config
│       └── App.js                     # Routes + protected route guards
│
└── database/
    └── schema.sql                     # Base schema (applied on first boot)
```

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS or 22 LTS |
| npm | 9+ |
| Git | Latest |
| Firebase project | With Auth enabled (email + Google) |

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/OketchManu/syncline.git
cd syncline
```

### 2. Configure environment variables

Create `api/.env`:

```env
PORT=3001
NODE_ENV=development
BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Firebase Admin SDK — paste the JSON as a single line, or use a file path
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}

# Optional — email invitations via SMTP
EMAIL_HOST=smtp.yourprovider.com
EMAIL_PORT=587
EMAIL_USER=noreply@yourapp.com
EMAIL_PASS=yourpassword
EMAIL_FROM="Syncline" <noreply@yourapp.com>
```

Create `web/src/firebase.js` with your Firebase project config (from the Firebase Console → Project Settings → Your Apps).

### 3. Start the API server

```bash
cd api
npm install
npm run dev
```

The API will be available at `http://localhost:3001`.  
WebSocket endpoint: `ws://localhost:3001/ws`

On startup you should see:

```
✅ Firebase Admin initialised
✅ Connected to SQLite database
✅ Database initialized successfully
✅ Migrations done
✅ WebSocket server initialized on /ws
🚀 HTTP Server: http://localhost:3001
```

### 4. Start the React frontend

Open a second terminal:

```bash
cd web
npm install
npm start
```

The app opens at `http://localhost:3000`.

---

## API Reference

All protected routes require:

```
Authorization: Bearer <Firebase ID Token>
```

### Auth — `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user (with optional company) |
| POST | `/api/auth/firebase-sync` | Sync Firebase user to backend DB |
| GET | `/api/auth/me` | Get current user profile |
| POST | `/api/auth/logout` | Server-side logout |
| DELETE | `/api/auth/delete-firebase-user` | Permanently delete Firebase Auth account |

### Tasks — `/api/tasks`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | Get all tasks (scoped by user or company) |
| GET | `/api/tasks/my` | Get tasks assigned to or created by me |
| GET | `/api/tasks/stats` | Get task statistics |
| GET | `/api/tasks/overdue` | Get overdue tasks |
| GET | `/api/tasks/:id` | Get a single task |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/:id` | Update a task |
| PATCH | `/api/tasks/:id/flag` | Flag a task with a reason |
| PATCH | `/api/tasks/:id/unflag` | Remove flag from task |
| DELETE | `/api/tasks/:id` | Delete a task |

**Create task body:**
```json
{
  "title": "Design login screen",
  "description": "Create mockups in Figma",
  "status": "in_progress",
  "priority": "high",
  "assigneeId": 3,
  "deadline": "2026-03-15T23:59:59"
}
```

### Users — `/api/users`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/me` | Get my profile |
| PUT / PATCH | `/api/users/me` | Update profile (name, avatar) |
| PUT / PATCH | `/api/users/me/password` | Change password |
| DELETE | `/api/users/me` | Delete and anonymize account |

### Company — `/api/company`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/company/team` | Get team members + company info |
| GET | `/api/company/details` | Get company details |
| PATCH | `/api/company/details` | Update company details + logo |
| GET | `/api/company/invitations` | List pending email invitations |
| POST | `/api/company/team/invite` | Send email invitation |
| DELETE | `/api/company/invitations/:id` | Revoke invitation |
| POST | `/api/company/join/:code` | Join via invite code or email link |
| GET | `/api/company/join-requests` | List join requests |
| PATCH | `/api/company/join-requests/:id/accept` | Accept a join request |
| PATCH | `/api/company/join-requests/:id/decline` | Decline a join request |
| PATCH | `/api/company/team/:userId/role` | Change member role |
| DELETE | `/api/company/team/:userId` | Remove member |

### Task Reports — `/api/task-reports`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/task-reports` | List all reports |
| POST | `/api/task-reports` | Submit a report |
| POST | `/api/task-reports/:taskId/assign` | Assign a task to user(s) |
| POST | `/api/task-reports/:taskId/progress` | Log progress update |
| GET | `/api/task-reports/:taskId/progress` | Get progress history |
| PATCH | `/api/task-reports/:id/approve` | Approve a report |
| PATCH | `/api/task-reports/:id/reject` | Reject a report |
| DELETE | `/api/task-reports/:id` | Delete a report |

---

## WebSocket Events

Connect to `ws://localhost:3001/ws` (or `wss://syncline-1.onrender.com/ws` in production).

### Events broadcast from server

| Event | Triggered when |
|---|---|
| `task:created` | A task is created |
| `task:updated` | A task is modified |
| `task:deleted` | A task is deleted |
| `task:flagged` | A task is flagged |
| `task:assigned` | A task is assigned |
| `task:progress_updated` | Progress is logged |
| `report:submitted` | A report is submitted |
| `report:requested` | A manager requests a report |
| `user:profile_updated` | A user updates their profile |
| `user:account_deleted` | A user deletes their account |

**Example payload:**
```json
{
  "type": "task:created",
  "task": { "id": 12, "title": "...", "status": "pending" },
  "creator": { "id": 8, "fullName": "Jane Doe" },
  "timestamp": "2026-04-06T10:00:00.000Z"
}
```

---

## Database Schema

| Table | Description |
|---|---|
| `users` | All registered users with roles, company membership, and Firebase UID |
| `companies` | Company workspaces with invite code and logo |
| `company_members` | Company membership records |
| `tasks` | Tasks with status, priority, deadline, and flag support |
| `task_assignments` | Many-to-many task assignment records |
| `task_reports` | Progress reports submitted by members |
| `task_progress` | Per-task progress update log |
| `report_requests` | Manager-initiated report requests |
| `join_requests` | Pending requests to join a company |
| `team_invitations` | Email-based invite records with expiry |
| `profile_data` | Persisted name/avatar by Firebase UID (survives DB wipes) |
| `notifications` | In-app notifications |
| `activities` | Audit log of team actions |

---

## Environment Variables

### `api/.env`

| Variable | Description |
|---|---|
| `PORT` | API server port (default: `3001`) |
| `NODE_ENV` | `development` or `production` |
| `BASE_URL` | Public URL of the API (used for file URL construction) |
| `FRONTEND_URL` | Public URL of the frontend (used in invite emails) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK service account JSON (single-line) |
| `RESET_DB` | Set to `true` to wipe the DB on next deploy (Render only) |
| `EMAIL_HOST` | SMTP host for invite emails |
| `EMAIL_PORT` | SMTP port (default: `587`) |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password |
| `EMAIL_FROM` | Sender display name and address |

---

## Roadmap

- [x] Firebase authentication (email/password + Google)
- [x] Personal and company account types
- [x] Company workspace creation and management
- [x] Email + invite code team invitations
- [x] Role-based access control (owner, admin, manager, member)
- [x] Task CRUD with priority, deadline, and assignment
- [x] Task flagging and overdue detection
- [x] Progress reports — submit, review, approve, reject
- [x] WebSocket real-time broadcast
- [x] Responsive PWA (mobile, tablet, desktop)
- [x] Profile persistence across server redeployments
- [x] Account deletion (full anonymization + Firebase Auth removal)
- [ ] Python worker — automated scheduled overdue flagging
- [ ] Java notifier — email and webhook notifications for enterprise
- [ ] Docker Compose for full-stack local development
- [ ] Conflict resolution UI for offline sync

---

## Legal

**Terms of Service and Privacy Policy** are located at:

```
web/public/terms.html
web/public/privacy.html
```

Link to them from:
1. **Register page** (`web/src/components/auth/Register.jsx`) — add a line below the sign-up button:
   ```jsx
   <p>By registering you agree to our <a href="/terms.html">Terms of Service</a> and <a href="/privacy.html">Privacy Policy</a>.</p>
   ```
2. **Login page footer** — same links, smaller text
3. **Dashboard footer** — optional, keeps them discoverable after login
4. **`index.html`** — add to the `<head>` for SEO:
   ```html
   <link rel="canonical" href="https://syncline-8010e.web.app" />
   ```

---

## Author

**OketchManu**  
GitHub: [@OketchManu](https://github.com/OketchManu)

---

Built with ❤️ to demonstrate real-time full-stack architecture, Firebase integration, and modern React UI design.

---

## License

MIT