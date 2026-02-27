# Syncline - Distributed Task Management System

> A real-time, full-stack task coordination platform demonstrating modern distributed systems architecture with microservices, WebSocket communication, and cross-language integration.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)
![React](https://img.shields.io/badge/React-18.x-blue.svg)
![Python](https://img.shields.io/badge/Python-3.11-yellow.svg)
![Java](https://img.shields.io/badge/Java-17-orange.svg)

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [System Components](#system-components)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Learning Outcomes](#learning-outcomes)

## 🎯 Overview

Syncline is a production-grade task management system built to demonstrate enterprise-level distributed systems architecture. It showcases real-time collaboration, background job processing, cross-service communication, and modern full-stack development practices.

**Key Highlights:**
- 🚀 **Real-time Updates** - WebSocket-powered instant synchronization
- 🔄 **Distributed Architecture** - 4 microservices working in harmony
- 🌐 **Cross-Language Integration** - JavaScript, Python, and Java services
- 📊 **Automated Workflows** - Background jobs for deadline monitoring
- 🎨 **Modern UI/UX** - Futuristic dark-themed interface
- 🔐 **Secure Authentication** - JWT-based auth with bcrypt password hashing

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          React Frontend (Port 3000)                       │  │
│  │  • Modern UI with Tailwind CSS                            │  │
│  │  • Real-time WebSocket client                             │  │
│  │  • JWT authentication                                     │  │
│  │  • Responsive dashboard                                   │  │
│  └────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────┼─────────────────────────────────────┘
                          │
                          │ HTTP/WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Node.js API Server (Port 3001)                       │  │
│  │  • RESTful API endpoints                                  │  │
│  │  • WebSocket server                                       │  │
│  │  • JWT token management                                   │  │
│  │  • SQLite database integration                            │  │
│  └──────┬───────────────────────────────────┬───────────────┘  │
│         │                                    │                   │
│         │ Database Access                    │ Real-time Events  │
│         ▼                                    ▼                   │
│  ┌─────────────┐                    ┌──────────────────────┐   │
│  │   SQLite    │◄───────────────────┤  Python Worker       │   │
│  │  Database   │   Read/Write       │  (Background Jobs)   │   │
│  │             │                    │  • Deadline checker   │   │
│  │  • users    │                    │  • Task auto-flagging │   │
│  │  • tasks    │                    │  • Runs every 30s     │   │
│  │  • activities│                   └──────────┬───────────┘   │
│  │  • notifications│                           │                │
│  └─────────────┘                               │ HTTP           │
│                                                 ▼                │
│                                         ┌──────────────────┐    │
│                                         │ Java Notifier    │    │
│                                         │ (Port 8080)      │    │
│                                         │ • Email alerts   │    │
│                                         │ • Logging        │    │
│                                         │ • Spring Boot    │    │
│                                         └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action** → React Frontend sends HTTP request
2. **API Processing** → Node.js validates, processes, updates database
3. **Real-time Broadcast** → WebSocket pushes updates to all connected clients
4. **Background Jobs** → Python worker periodically checks for overdue tasks
5. **Notifications** → Worker sends alerts to Java notifier service
6. **Instant UI Update** → All clients receive updates without page refresh

## ✨ Features

### Core Functionality
- ✅ **Task Management** - Create, read, update, delete tasks
- ✅ **Real-time Collaboration** - See changes instantly across all devices
- ✅ **User Authentication** - Secure registration and login with JWT
- ✅ **Task Assignment** - Assign tasks to team members
- ✅ **Priority Levels** - Low, Medium, High, Urgent
- ✅ **Status Tracking** - Pending, In Progress, Completed, Blocked
- ✅ **Deadline Management** - Set and track task deadlines
- ✅ **Task Filtering** - Filter by status, priority, assignee, flagged state
- ✅ **Search Functionality** - Quick search across all tasks
- ✅ **Activity Feed** - Live feed of all system activities

### Advanced Features
- 🤖 **Automated Deadline Detection** - Python worker flags overdue tasks
- 🚩 **Stuck Task Detection** - Auto-flags tasks with no updates for 48+ hours
- 📊 **Task Statistics** - Dashboard with real-time metrics
- 🔔 **Notification System** - Java-powered notification service
- 🎨 **Modern UI** - Futuristic dark theme with glassmorphism
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🔐 **Secure** - bcrypt password hashing, JWT tokens

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI library
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **WebSocket API** - Real-time communication
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Modern icon library

### Backend (Node.js)
- **Node.js 20** - Runtime environment
- **Express.js** - Web framework
- **ws** - WebSocket library
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **SQLite3** - Embedded database
- **dotenv** - Environment configuration

### Background Worker (Python)
- **Python 3.11** - Programming language
- **sqlite3** - Database access
- **requests** - HTTP client

### Notification Service (Java)
- **Java 17** - Programming language
- **Spring Boot 3.2** - Application framework
- **Spring Web** - REST API
- **Maven** - Build tool

### Database
- **SQLite** - Lightweight relational database
- Tables: users, tasks, activities, notifications, comments, sync_conflicts

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:
- **Node.js** 20.x or higher ([Download](https://nodejs.org/))
- **Python** 3.11 or higher ([Download](https://www.python.org/))
- **Java** 17 or higher ([Download](https://adoptium.net/))
- **Git** ([Download](https://git-scm.com/))

### Quick Start (4 Terminals)

#### Terminal 1: API Server
```bash
cd api
npm install
npm run dev
```
Server starts on **http://localhost:3001**

#### Terminal 2: Frontend
```bash
cd web
npm install
npm start
```
Browser opens at **http://localhost:3000**

#### Terminal 3: Python Worker
```bash
cd worker

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\Activate.ps1

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run worker
python src/scheduler.py
```

#### Terminal 4: Java Notifier
```bash
cd notifier

# Using Maven wrapper (Windows)
.\mvnw.cmd spring-boot:run

# Using Maven wrapper (Mac/Linux)
./mvnw spring-boot:run

# Or with Maven installed
mvn spring-boot:run
```
Service starts on **http://localhost:8080**

### Verify Installation

Once all services are running:

1. **API Health Check**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Notifier Health Check**
   ```bash
   curl http://localhost:8080/health
   ```

3. **Open Frontend**
   - Navigate to http://localhost:3000
   - Register a new account
   - Start creating tasks!

## 📦 System Components

### 1. Node.js API (`/api`)

**Purpose:** Core backend service handling all business logic

**Key Features:**
- RESTful API with Express.js
- JWT authentication middleware
- WebSocket server for real-time updates
- SQLite database integration
- CORS configuration for frontend communication

**Main Endpoints:**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/tasks` - Get all tasks (with filters)
- `POST /api/tasks` - Create new task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/stats` - Get task statistics
- `WS /ws` - WebSocket connection

### 2. React Frontend (`/web`)

**Purpose:** User interface and real-time client

**Key Features:**
- Modern React 18 with hooks
- JWT authentication with automatic token refresh
- Real-time task updates via WebSocket
- Responsive design with Tailwind CSS
- Form validation and error handling
- Live activity feed

**Main Components:**
- Login/Register pages
- Dashboard with task management
- Task creation modal
- Real-time activity sidebar
- Search and filter controls

### 3. Python Worker (`/worker`)

**Purpose:** Background job processor for automated tasks

**Jobs:**
- **Deadline Checker** (runs every 30s)
  - Finds tasks past their deadline
  - Flags them as overdue
  - Sends notifications to Java service
  
- **Task Flagger** (runs every 60s)
  - Detects tasks with no updates for 48+ hours
  - Automatically flags them as stuck
  - Alerts assignees

**Key Features:**
- Graceful error handling
- Avoids duplicate flagging
- Handles missing assignees
- Logs all activities

### 4. Java Notifier (`/notifier`)

**Purpose:** Enterprise notification service

**Key Features:**
- RESTful notification API
- Spring Boot framework
- Formatted console logging
- Extensible for email/SMS/Slack
- Health check endpoint

**Endpoints:**
- `POST /notify` - Send notification
- `POST /test` - Send test notification
- `GET /health` - Health check
- `GET /stats` - Service statistics

## 📚 API Documentation

### Authentication

All protected endpoints require a Bearer token:
```
Authorization: Bearer <your-jwt-token>
```

### Task Object Schema

```json
{
  "id": 1,
  "title": "Complete project documentation",
  "description": "Write comprehensive README",
  "status": "in_progress",
  "priority": "high",
  "assignee_id": 1,
  "created_by": 1,
  "deadline": "2026-03-01T17:00:00",
  "flagged": 0,
  "flag_reason": null,
  "version": 1,
  "created_at": "2026-02-27T10:00:00",
  "updated_at": "2026-02-27T10:00:00"
}
```

### WebSocket Events

**Server → Client:**
- `task:created` - New task created
- `task:updated` - Task modified
- `task:status_changed` - Status updated
- `task:deleted` - Task removed
- `task:flagged` - Task flagged by worker
- `pong` - Response to ping

## 🐳 Deployment

### Docker (Optional)

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d

# Stop all services
docker-compose down
```

### Environment Variables

#### API (`api/.env`)
```env
PORT=3001
DATABASE_URL=../database/syncline.db
JWT_SECRET=change-this-to-a-secure-secret-in-production
NODE_ENV=production
```

#### Worker (`worker/.env`)
```env
DATABASE_PATH=../database/syncline.db
NOTIFIER_URL=http://localhost:8080
API_URL=http://localhost:3001
```

## 📝 Project Structure

```
syncline/
├── api/                    # Node.js backend
│   ├── src/
│   │   ├── config/        # Database, JWT, WebSocket
│   │   ├── middleware/    # Authentication
│   │   ├── models/        # User, Task models
│   │   ├── routes/        # API routes
│   │   ├── websocket/     # WebSocket handlers
│   │   └── server.js      # Entry point
│   └── package.json
├── web/                    # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── context/       # Auth context
│   │   ├── services/      # API & WebSocket
│   │   └── App.js
│   └── package.json
├── worker/                 # Python background jobs
│   ├── src/
│   │   ├── config/        # Settings, Database
│   │   ├── tasks/         # Job definitions
│   │   └── scheduler.py   # Main scheduler
│   └── requirements.txt
├── notifier/              # Java notification service
│   ├── src/main/java/    # Spring Boot app
│   └── pom.xml
├── database/
│   ├── schema.sql        # Database schema
│   └── syncline.db       # SQLite database
└── README.md             # This file
```

## 🎓 Learning Outcomes

This project demonstrates:

- **Distributed Systems** - Microservices architecture
- **Real-time Web** - WebSocket implementation
- **Full-Stack Development** - Frontend, backend, database
- **Multi-Language Integration** - JavaScript, Python, Java
- **Authentication & Security** - JWT, bcrypt, middleware
- **Background Processing** - Scheduled jobs and automation
- **RESTful API Design** - Standard HTTP methods
- **Database Design** - Relational schema with indexing
- **Modern Frontend** - React hooks, context API
- **DevOps Practices** - Environment configuration, logging

## 📄 License

This project is licensed under the MIT License.

## 👤 Author

**OketchManu**
- GitHub: [@OketchManu](https://github.com/OketchManu)

---

**⭐ Star this repository if you found it helpful!**

Built with ❤️ to demonstrate distributed systems architecture and full-stack development skills.