# Syncline

A real-time collaborative task management system built with a modern multi-service architecture. Syncline features live updates via WebSocket, offline-capable PWA support, JWT authentication, and a polyglot backend spanning Node.js, Python, and Java.

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
- [Running Tests](#running-tests)
- [Roadmap](#roadmap)

---

## Overview

Syncline is a team task management platform designed for real-time collaboration. Users can create, assign, update, and flag tasks — and every action is broadcast instantly to all connected clients via WebSocket. The system is built to support offline usage with automatic sync when connectivity is restored.

Key capabilities:
- **Real-time updates** — task changes are broadcast to all connected users instantly
- **JWT authentication** — secure access and refresh token system
- **Role-based access control** — `admin`, `manager`, and `member` roles
- **Task flagging & overdue detection** — automated and manual task monitoring
- **Offline sync** — IndexedDB-backed local storage with conflict resolution (PWA)
- **Activity feed** — live log of all team actions

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (React PWA)                │
│    IndexedDB • Service Worker • Sync Manager         │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP + WebSocket
┌───────────────────────▼─────────────────────────────┐
│              Node.js API  (port 3001)                │
│      Express • JWT • WebSocket (ws)                  │
│      REST Endpoints + Real-time Broadcast            │
└──────────┬────────────────────────┬──────────────────┘
           │                        │
┌──────────▼──────────┐  ┌─────────▼─────────────────┐
│   Python Worker     │  │     Java Notifier          │
│  APScheduler jobs   │  │  Email / Webhook / SMS     │
│  Overdue detection  │  │  Enterprise notifications  │
└──────────┬──────────┘  └────────────────────────────┘
           │
┌──────────▼──────────┐
│   SQLite / PostgreSQL│
│   (syncline.db)     │
└─────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Axios, Recharts, Lucide React |
| API Server | Node.js 20+, Express 5, `ws`, `jsonwebtoken`, `bcrypt` |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Background Worker | Python 3.10+, APScheduler |
| Notification Service | Java 17+, Spring Boot (Maven) |
| Real-time | WebSocket (`ws` library) |
| Auth | JWT (access + refresh tokens) |

---

## Project Structure

```
syncline/
├── api/                        # Node.js REST + WebSocket server
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js     # SQLite connection & helpers
│   │   │   ├── jwt.js          # Token generation & verification
│   │   │   └── websocket.js    # WebSocket server initialisation
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT auth middleware & role guards
│   │   ├── models/
│   │   │   ├── User.js         # User DB operations
│   │   │   └── Task.js         # Task DB operations
│   │   ├── routes/
│   │   │   ├── auth.routes.js  # /api/auth endpoints
│   │   │   └── task.routes.js  # /api/tasks endpoints
│   │   ├── websocket/
│   │   │   └── events.js       # WebSocket event handlers
│   │   └── server.js           # App entry point
│   ├── .env
│   ├── package.json
│   └── websocket-test.html     # Browser WebSocket tester
│
├── web/                        # React PWA frontend
│   └── src/
│       ├── components/
│       │   ├── auth/           # Login, Register
│       │   ├── dashboard/      # Dashboard, Stats, Charts
│       │   ├── tasks/          # TaskList, TaskCard, TaskForm
│       │   ├── activity/       # ActivityFeed
│       │   ├── users/          # OnlineUsers
│       │   └── common/         # Header, Sidebar, SyncIndicator
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── services/
│       │   ├── api.js          # Axios API client
│       │   └── websocket.js    # WebSocket client service
│       └── App.js
│
├── worker/                     # Python background jobs
│   └── src/
│       ├── config/
│       ├── tasks/              # Scheduled job definitions
│       ├── services/
│       └── utils/
│
├── notifier/                   # Java notification service
│   └── src/main/java/com/syncline/notifier/
│
└── database/
    ├── migrations/
    └── schema.sql
```

---

## Prerequisites

Install the following before running Syncline locally:

| Tool | Version | Download |
|---|---|---|
| Node.js | 20 LTS or 22 LTS | https://nodejs.org |
| Python | 3.10+ | https://www.python.org |
| Java JDK | 17 or 21 | https://adoptium.net |
| Git | Latest | https://git-scm.com |

> **Windows users:** Run PowerShell as Administrator and execute `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` before using npm.

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/syncline.git
cd syncline
```

### 2. Start the API server

```bash
cd api
npm install
npm run dev
```

The API will be available at `http://localhost:3001`.  
The WebSocket endpoint will be available at `ws://localhost:3001/ws`.

On startup you should see:

```
✅ Connected to SQLite database
✅ Database initialized successfully
✅ WebSocket server initialized on /ws
🚀 HTTP Server: http://localhost:3001
⚡ WebSocket: ws://localhost:3001/ws
```

### 3. Start the React frontend

Open a second terminal:

```bash
cd web
npm install
npm start
```

The app opens automatically at `http://localhost:3000`.

### 4. Start the Python worker (optional)

```bash
cd worker
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
python src/main.py
```

---

## API Reference

All protected routes require the header:

```
Authorization: Bearer <accessToken>
```

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user profile |
| POST | `/api/auth/logout` | Invalidate session |

**Register request body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "fullName": "Jane Doe"
}
```

**Login response:**
```json
{
  "message": "Login successful",
  "user": { "id": 1, "email": "...", "role": "member" },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### Tasks

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | `/api/tasks` | Get all tasks (filterable) | All |
| GET | `/api/tasks/my` | Get tasks assigned to me | All |
| GET | `/api/tasks/stats` | Get task statistics | All |
| GET | `/api/tasks/overdue` | Get overdue tasks | All |
| GET | `/api/tasks/:id` | Get a single task | All |
| POST | `/api/tasks` | Create a task | All |
| PUT | `/api/tasks/:id` | Update a task | All |
| PATCH | `/api/tasks/:id/flag` | Flag a task | All |
| PATCH | `/api/tasks/:id/unflag` | Unflag a task | All |
| DELETE | `/api/tasks/:id` | Delete a task | admin, manager |

**Query parameters for GET `/api/tasks`:**

| Parameter | Values |
|---|---|
| `status` | `pending`, `in_progress`, `completed`, `blocked` |
| `priority` | `low`, `medium`, `high`, `urgent` |
| `assigneeId` | User ID |
| `flagged` | `true` / `false` |

**Create task request body:**
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

---

## WebSocket Events

Connect to `ws://localhost:3001/ws` and authenticate immediately after connection:

```json
{ "type": "auth", "token": "<accessToken>" }
```

### Events received from server

| Event type | Triggered when |
|---|---|
| `task:created` | A new task is created |
| `task:updated` | A task is modified |
| `task:deleted` | A task is deleted |
| `task:flagged` | A task is flagged |
| `task:unflagged` | A task flag is removed |
| `user:connected` | A user comes online |
| `user:disconnected` | A user goes offline |
| `pong` | Response to a client ping |

**Example event payload:**
```json
{
  "type": "task:created",
  "task": { "id": 12, "title": "...", "status": "pending", ... },
  "user": { "id": 8, "fullName": "Jane Doe" },
  "timestamp": "2026-03-02T10:00:00.000Z"
}
```

### Sending a ping

```json
{ "type": "ping" }
```

---

## Database Schema

Core tables (SQLite / PostgreSQL):

| Table | Description |
|---|---|
| `users` | Registered users with roles and online status |
| `tasks` | Tasks with status, priority, versioning, and flag support |
| `activities` | Audit log of all task and user actions |
| `notifications` | Queued notifications for the Java notifier service |
| `refresh_tokens` | Stored refresh tokens for session management |
| `sync_queue` | Offline changes awaiting server sync |

The full schema is in `database/schema.sql`.

---

## Environment Variables

### `api/.env`

```env
PORT=3001
DATABASE_URL=../database/syncline.db
JWT_SECRET=your-secret-key-change-this-in-production
NODE_ENV=development
```

### `worker/.env`

```env
DATABASE_URL=../database/syncline.db
NOTIFIER_URL=http://localhost:8080
```

---

## Running Tests

API manual tests are available in `api/test.http` (requires the VS Code **REST Client** extension) and `api/websocket-test.html` for WebSocket testing in the browser.

To run a quick smoke test via PowerShell:

```powershell
# Login
$body = '{"email":"test@example.com","password":"password123"}'
$res = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $body -ContentType "application/json"
$token = $res.accessToken

# Get tasks
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:3001/api/tasks" -Method GET -Headers $headers
```

---

## Roadmap

- [x] JWT authentication (register, login, refresh, logout)
- [x] Task CRUD with filtering and statistics
- [x] WebSocket real-time broadcast
- [x] Role-based access control
- [x] Task flagging and overdue detection
- [ ] Activity logging and live feed
- [ ] User management routes
- [ ] Python worker — automated overdue flagging
- [ ] Java notifier — email and webhook notifications
- [ ] React PWA frontend with offline sync
- [ ] Conflict resolution UI
- [ ] Docker Compose setup for full-stack deployment

---

## 👤 Author

**OketchManu**
- GitHub: [@OketchManu](https://github.com/OketchManu)

---

**⭐ Star this repository if you found it helpful!**

Built with ❤️ to demonstrate distributed systems architecture and full-stack development skills.

---

## License

MIT