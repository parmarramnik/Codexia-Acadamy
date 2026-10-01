# 🚀 Codexia Academy — Enterprise AI-Powered Learning Management System (ALMS)

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker Compose](https://img.shields.io/badge/Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![PostgreSQL 15](https://img.shields.io/badge/PostgreSQL_15-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis 7](https://img.shields.io/badge/Redis_7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch_8-005571?style=for-the-badge&logo=elasticsearch&logoColor=white)](https://www.elastic.co/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini_AI-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://www.langchain.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

---

## 📌 Overview

**Codexia Academy** is an enterprise-grade, microservice-architected **AI-Powered Learning Management System (ALMS)** engineered for modern computer science education. It bridges the gap between passive video learning and real-world software engineering by delivering:

- **Conversational AI Tutoring & RAG** powered by Google Gemini and LangChain vector search.
- **In-Browser Code Execution & LeetCode-style Problem Hub** using the Monaco Editor.
- **Git-Inspired Version Control for Notes** with branching, commits, diffs, 3-way merge conflict resolution, and AI commit summaries.
- **Tamper-Proof PDF Certificates** with embedded cryptographically verifiable QR codes and public verification endpoints.
- **Real-Time Analytics & Skill Radars** utilizing Redis caching and Recharts visualizations.
- **Multi-Role Governance** supporting granular, database-level RBAC for Students, Instructors, Admins, and Super Admins.

---

## 🏗️ System Architecture

Codexia Academy utilizes an asynchronous **Microservices Architecture** orchestrated behind a **FastAPI Reverse-Proxy API Gateway**, backed by PostgreSQL 15, Redis 7 caching, and Elasticsearch.

```mermaid
flowchart TB
    subgraph Client["Client Tier"]
        UI["React 18 + Vite SPA\n(TanStack Query, Monaco Editor, Recharts)"]
    end

    subgraph Gateway["API Gateway (Port 8000)"]
        GW["FastAPI Reverse Proxy & Router\nRate Limiting (SlowAPI) • JWT Verification"]
    end

    subgraph Services["Microservices Tier"]
        AUTH["Auth Service (:8001)\nOAuth2, JWT, Dynamic RBAC, OTP"]
        COURSE["Course Service (:8002)\nCourses, Modules, Lessons, Enrollments"]
        QUIZ["Quiz & Cert Service (:8003)\nAssessments, Auto-Grading, PDF/QR Engine"]
        CODING["Coding Engine (:8004)\nMonaco Sandbox, Test Runner, Daily Challenges"]
        AI_SVC["AI & RAG Service (:8005)\nGemini LLM, FAISS Vector Search, Study Planner"]
        ANALYTICS["Analytics Service (:8006)\nHeatmaps, Streaks, Leaderboards, System KPIs"]
    end

    subgraph Data["Persistence & Caching Tier"]
        PG[("PostgreSQL 15\n(Primary Relational Store)")]
        RD[("Redis 7\n(Session & Query Cache)")]
        ES[("Elasticsearch 8\n(Full-Text & Problem Search)")]
    end

    subgraph External["External AI Provider"]
        GEMINI["Google Gemini Generative AI API"]
    end

    UI -->|HTTP / REST| GW
    GW --> AUTH
    GW --> COURSE
    GW --> QUIZ
    GW --> CODING
    GW --> AI_SVC
    GW --> ANALYTICS

    AUTH --> PG
    AUTH --> RD
    COURSE --> PG
    COURSE --> RD
    QUIZ --> PG
    CODING --> PG
    CODING --> RD
    AI_SVC --> PG
    AI_SVC --> GEMINI
    ANALYTICS --> PG
    ANALYTICS --> RD
    ANALYTICS --> ES
```

---

## ⚡ Microservices Breakdown & Port Mapping

| Service Name | Port | Description | Core Tech |
| :--- | :---: | :--- | :--- |
| **API Gateway** | `8000` | Unified reverse-proxy entry point, request routing, rate limiting | FastAPI, HTTPX, SlowAPI |
| **Auth Service** | `8001` | Authentication, token rotation, dynamic database RBAC, email OTP | FastAPI, Jose JWT, Passlib/Bcrypt |
| **Course Service** | `8002` | Course catalog, lesson streaming, curriculum authoring, enrollments | FastAPI, SQLAlchemy 2.0 |
| **Quiz Service** | `8003` | Quizzes, auto-grading, PDF certificate generation & QR verification | FastAPI, ReportLab, PyQRCode |
| **Coding Service** | `8004` | In-browser code runner, custom I/O test cases, daily coding challenges | FastAPI, Monaco, Subprocess/Sandboxing |
| **AI Service** | `8005` | Gemini AI Tutor, RAG study planner, static AI code review, flashcards | FastAPI, LangChain, Google Gemini |
| **Analytics Service** | `8006` | Heatmaps, skill radar metrics, gamified streaks, leaderboards | FastAPI, Redis, Elasticsearch |
| **Frontend Web App**| `3000` / `5173` | Responsive SPA with 30+ pages, dark/light theme, code splitting | React 18, Vite, TanStack Query |
| **PostgreSQL DB** | `5432` | Relational data store (`codexia_lms`) | PostgreSQL 15 Alpine |
| **Redis Cache** | `6379` | High-speed cache for queries, rate limiting, and session state | Redis 7 Alpine |
| **Elasticsearch** | `9200` | High-performance search index for courses, notes, and challenges | Elasticsearch 8.11 |

---

## ✨ Key Feature Highlights

### 🧠 1. Enterprise AI & RAG Ecosystem
- **Context-Aware AI Tutor**: Conversational assistant retaining multi-turn session memory to assist students through course concepts.
- **RAG Curriculum Integration**: Powered by LangChain and FAISS vector embeddings to deliver accurate, source-backed answers directly from course materials.
- **AI Code Reviewer**: Instant static analysis evaluating code submissions for **Big-O time and space complexity**, potential edge-case bugs, and concrete optimization recommendations.
- **Automated Study Planner & Flashcards**: Generates personalized weekly study schedules based on student availability and auto-synthesizes flashcard decks for spaced repetition.

### 💻 2. Interactive Coding Sandbox & Problem Hub
- **Monaco Code Editor**: Full syntax highlighting, auto-completion, and multi-language support (Python, JavaScript, C++, Java, Go).
- **LeetCode-Style Problem Hub**: Filter by difficulty, domain tags (Dynamic Programming, Trees, Graphs, Hash Tables), acceptance rates, and completion state.
- **Custom Test Runner**: Run against sample test cases or custom standard input with execution time and memory profiling.
- **Daily Challenges**: Instructor-assigned daily challenges incentivizing consistent coding habits.

### 🌿 3. Git-Inspired Version Control for Notes
- **Full VCS Engine for Rich Notes**: Take Markdown notes during lectures with complete version control capabilities.
- **Commits & Snapshots**: Create manual or checkpoint commits with cryptographic IDs and snapshot history.
- **Branching & Merging**: Create branches, switch contexts (`checkout`), and perform 3-way merges with configurable conflict resolution strategies (`keep_target`, `keep_source`, `merge_both`, `custom`).
- **Visual Diff & Timeline**: Side-by-side diff viewer and interactive SVG commit graph.
- **AI Commit Summaries**: Diff-aware Gemini integration that auto-generates conventional commit messages.
- **Export Options**: One-click export of complete note history to PDF, Markdown, or JSON.

### 📜 4. Tamper-Proof PDF Certificates & Public Verification
- **Dynamic Certificate Generation**: High-resolution, printable PDF certificates generated on-the-fly using ReportLab upon course completion.
- **Cryptographic QR Codes**: Unique QR codes linking to public verification portals (`/verify/:uid` and `/verify-public/:uid`), enabling employers and institutions to verify authenticity instantly without logging in.

### 📊 5. Deep Learning Analytics & Gamification
- **GitHub-Style Heatmaps**: Visual tracking of daily study sessions and problem-solving activity.
- **Multi-Dimensional Skill Radar**: Real-time evaluation of competency across Algorithms, Data Structures, System Design, Databases, and Web Development.
- **Gamification Suite**: Streak counters, achievement badges, and global peer leaderboards.
- **Community Discussion Forums**: Threaded discussions, Q&A on lecture topics, and upvoting mechanisms.

### 🛡️ 6. Enterprise Administration & Dynamic RBAC
- **4-Tier Access Control**: Discrete portals tailored for **Students**, **Instructors**, **Admins**, and **Super Admins**.
- **Dynamic Database-Driven Permissions**: Assign, revoke, or toggle granular permissions across roles without redeploying code.
- **Hardware & System Health**: Live monitoring of CPU, RAM, disk utilization (via `psutil`), and active user session counts.
- **Audit Logging & CSV Exports**: Comprehensive user login history audits and one-click CSV export of student performance and course enrollment metrics.

---

## 🛠️ Technology Stack

```text
Frontend:       React 18 • Vite • TanStack React Query • React Router v6 • Monaco Editor • Recharts
Backend:        Python 3.10+ • FastAPI • Uvicorn • SQLAlchemy 2.0 • Alembic • Pydantic v2
AI & Search:    Google Gemini API • LangChain • FAISS • Sentence-Transformers • Elasticsearch 8
Data & Caching: PostgreSQL 15 • Redis 7 • ReportLab (PDF) • PyQRCode
DevOps:         Docker • Docker Compose • Nginx / FastAPI Gateway • Pytest
```

---

## 📁 Repository Structure

```text
AI Learning Management System/
├── backend/
│   ├── microservices/
│   │   ├── gateway/            # API Gateway (:8000) - Routing & Reverse Proxy
│   │   ├── auth_service/       # Auth & Identity (:8001) - JWT, RBAC, Profiles, OTP
│   │   ├── course_service/     # Course Catalog (:8002) - Lessons, Curriculum, Enrollments
│   │   ├── quiz_service/       # Quiz & Certs (:8003) - Assessments & QR PDF Engine
│   │   ├── coding_service/     # Coding Engine (:8004) - Sandbox Runner & Problem Hub
│   │   ├── ai_service/         # AI & RAG (:8005) - Gemini AI Tutor, Planner & Reviewer
│   │   ├── analytics_service/  # Analytics (:8006) - Heatmaps, Radar, Leaderboards
│   │   └── shared/             # Shared DB Models, Schemas, & Cross-Service Utilities
│   ├── routes/                 # FastAPI Route Handlers (v1 - v4 Enterprise Routes)
│   ├── models/                 # SQLAlchemy 2.0 Database ORM Models
│   ├── schemas/                # Pydantic Request/Response Validation Schemas
│   ├── services/               # Business Logic & Integration Layer
│   ├── seed_db.py              # Comprehensive Database Seeder (Courses, Users, Quizzes)
│   ├── seed_coding_problems.py # Coding Problem Seeder (LeetCode-style challenges)
│   └── requirements.txt        # Python Dependencies
├── frontend/
│   ├── public/                 # Static Assets & Icons
│   ├── src/
│   │   ├── components/         # Reusable UI Components (Layouts, Modals, Loaders)
│   │   ├── context/            # AuthContext, ThemeContext, NotificationContext
│   │   ├── pages/              # 32 Application Pages (Dashboard, AI Tutor, Code Editor, etc.)
│   │   ├── services/           # Axios HTTP API Clients & Gateway Endpoints
│   │   └── styles/             # Modular CSS Design System (Light/Dark themes)
│   ├── package.json            # Node Dependencies
│   └── vite.config.js          # Vite Build & Proxy Configuration
├── docker-compose.yml          # Multi-Container Development Orchestration
├── docker-compose.prod.yml     # Production Multi-Container Orchestration
├── .env.example                # Template Environment Variables
└── README.md                   # Project Documentation
```

---

## 🚀 Quickstart & Setup Guide

### Prerequisites
- **Docker Desktop** (v20+) & **Docker Compose**
- **Node.js** (v18+) & **npm** *(for local frontend development)*
- **Python** (v3.10+) *(for local backend development)*
- **Google Gemini API Key** ([Get one here](https://aistudio.google.com/))

---

### Method 1: Running with Docker Compose (Recommended)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/parmarramnik/Codexia-Acadamy.git
   cd "AI Learning Management System"
   ```

2. **Configure Environment Variables**:
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set your secrets:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   JWT_SECRET_KEY=generate_a_secure_random_key_here
   POSTGRES_PASSWORD=admin_secure_pwd
   ```

3. **Build & Start All Containers**:
   ```bash
   docker-compose up --build
   ```

4. **Access the Platform**:
   - **Frontend Application**: `http://localhost:3000`
   - **API Gateway**: `http://localhost:8000`
   - **Interactive Swagger API Docs**: `http://localhost:8000/docs`

---

### Method 2: Local Non-Docker Development

#### Backend Setup
1. Create and activate a Python virtual environment:
   ```bash
   cd backend
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Seed database with initial data (Users, Courses, Coding Problems):
   ```bash
   python seed_db.py
   python seed_coding_problems.py
   ```

4. Launch the application:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

#### Frontend Setup
1. Open a new terminal and navigate to `frontend`:
   ```bash
   cd frontend
   npm install
   ```

2. Launch Vite dev server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## 🔑 Environment Variables Reference

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API Key for AI features | `AIzaSy...` |
| `JWT_SECRET_KEY` | Secret key used for signing JWT tokens | `32+ character string` |
| `JWT_ALGORITHM` | Algorithm used for JWT encoding | `HS256` |
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://user:pass@localhost:5432/codexia_lms` |
| `REDIS_URL` | Redis connection URI | `redis://localhost:6379/0` |
| `ELASTICSEARCH_URL`| Elasticsearch connection URI | `http://localhost:9200` |
| `SMTP_HOST` / `PORT`| SMTP Mail server for email verification & OTP | `smtp.gmail.com:587` |

---

## 🧪 Testing

Run automated smoke tests across all endpoints and database models:

```bash
# Run backend tests
cd backend
pytest tests/

# Run fast smoke test
python run_smoke.py
```

---

## 📄 License

This project is open-source and distributed under the **[MIT License](LICENSE)**.
