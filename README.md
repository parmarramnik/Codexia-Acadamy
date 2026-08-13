# 🚀 Codexia Academy — AI-Powered Learning Management System (ALMS)

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_15-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis_7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini_AI-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)

---

## 📌 Project Overview

**Codexia Academy** is a modern, enterprise-grade, microservice-based **AI-Powered Learning Management System (ALMS)**. Designed for modern tech education, it combines interactive learning, live multi-language code execution via Monaco Editor, automated quiz evaluations, dynamic PDF certificate generation with QR verification, and an intelligent **AI Tutor** powered by **Google Gemini** and **RAG (Retrieval-Augmented Generation)**.

---

## 🛠️ Technology Stack

### **Frontend**
- **Framework**: React 18 + Vite
- **Routing**: React Router DOM v6
- **State & HTTP**: Context API + Axios
- **Code Editor**: `@monaco-editor/react` (Monaco Code Editor)
- **Data Visualization**: Recharts (Analytics & Progress tracking)
- **Styling & UI**: Custom CSS Design System + `react-icons` + `react-hot-toast`
- **Markdown Rendering**: `react-markdown` + `react-syntax-highlighter`

### **Backend (Microservices Architecture)**
- **Language & Framework**: Python 3.10+ & FastAPI
- **ASGI Server**: Uvicorn
- **ORM & Migrations**: SQLAlchemy 2.0 + Alembic
- **API Security**: JWT Bearer Tokens (OAuth2), Passlib (Bcrypt)

### **AI & Machine Learning**
- **LLM Engine**: Google Gemini API (`google-generativeai`)
- **RAG Framework**: LangChain + FAISS Vector Store
- **Embeddings**: Sentence Transformers (`sentence-transformers`)

### **Database & Caching**
- **Relational Database**: PostgreSQL 15 (Docker containerized)
- **In-Memory Cache**: Redis 7
- **Document / Certificate Engine**: ReportLab (PDF Generation) + PyQRCode

### **DevOps & Infrastructure**
- **Containerization**: Docker & Docker Compose
- **Gateway**: Custom FastAPI Reverse Proxy API Gateway
- **Testing**: Pytest + Pytest-Asyncio

---

## 🏗️ System Architecture & Project Structure

The project is structured into **Microservices**, an **API Gateway**, and a **React Single Page Application (SPA)**:

```text
AI Learning Management System/
├── backend/
│   ├── microservices/
│   │   ├── gateway/            # API Gateway (Port 8000) - Reverse Proxy & Routing
│   │   ├── auth_service/       # Auth & User Service (Port 8001) - Auth, Profiles, RBAC
│   │   ├── course_service/     # Course Service (Port 8002) - Catalog, Lessons, Enrollment
│   │   ├── quiz_service/       # Quiz Service (Port 8003) - Quizzes & PDF Certificates
│   │   ├── coding_service/     # Coding Service (Port 8004) - Live Code Execution Engine
│   │   ├── ai_service/         # AI Service (Port 8005) - Gemini AI Tutor & RAG
│   │   ├── analytics_service/  # Analytics Service (Port 8006) - User Stats & Leaderboards
│   │   └── shared/             # Shared Models, Database Sessions & Schemas
│   ├── database.py             # Shared DB Configuration
│   ├── seed_db.py              # Initial Database Seeder
│   └── requirements.txt        # Python Dependencies
├── frontend/
│   ├── public/                 # Static Assets
│   ├── src/
│   │   ├── components/         # Reusable UI Components (Navbar, Modals, Cards)
│   │   ├── context/            # AuthContext & ThemeContext
│   │   ├── pages/              # 30+ Application Pages (Dashboard, AI Tutor, Code Editor, etc.)
│   │   ├── services/           # Axios API Client Configurations
│   │   └── styles/             # Global & Component CSS
│   ├── package.json            # Node Dependencies
│   └── vite.config.js          # Vite Build Configuration
├── docker-compose.yml          # Multi-container Orchestration Config
├── .env.example                # Sample Environment File
└── README.md                   # Project Documentation
```

---

## ⚡ Microservices Breakdown & Port Mapping

| Service Name | Port | Description |
| :--- | :---: | :--- |
| **API Gateway** | `8000` | Unified API Entry Point (Reverse proxy for all microservices) |
| **Auth Service** | `8001` | User registration, login, JWT validation, role management |
| **Course Service** | `8002` | Courses, modules, lessons, student enrollment tracking |
| **Quiz Service** | `8003` | Quizzes, assessments, auto-grading, PDF certificate generator |
| **Coding Service** | `8004` | Interactive code exercises, multi-language test execution engine |
| **AI Service** | `8005` | Gemini-powered AI Tutor, RAG study guide generator, auto-summarization |
| **Analytics Service** | `8006` | Dashboard metrics, progress stats, gamification leaderboards |
| **PostgreSQL DB** | `5432` | Main database (`codexia_lms`) |
| **Redis Cache** | `6379` | In-memory caching layer |

---

## ✨ Key Features

- 🧠 **AI Tutor with RAG**: Chat in real-time with an AI assistant trained on course materials using Gemini & FAISS vector search.
- 💻 **Interactive Monaco Code Execution**: Solve coding challenges right in the browser with syntax highlighting and instant test results.
- 📜 **QR-Verified PDF Certificates**: Earn downloadable certificates featuring verifiable QR codes upon course completion.
- 📊 **Comprehensive Analytics**: Monitor your learning trajectory with dynamic Recharts progress visualizers.
- 🏆 **Gamification & Leaderboards**: Compete with peers through streak tracking, badges, and real-time leaderboards.
- 🛡️ **Role-Based Portals**: Tailored interfaces for Students, Instructors, and System Administrators.

---

## 🚀 Getting Started

### Prerequisites

- **Docker Desktop** installed & running
- **Node.js** (v18+) & **npm**
- **Python** (v3.10+) *(for local non-Docker development)*
- **Google Gemini API Key** *(for AI features)*

---

### Method 1: Running with Docker Compose (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/parmarramnik/Codexia-Acadamy.git
   cd "AI Learning Management System"
   ```

2. **Setup Environment Variables**:
   Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY=your_google_gemini_api_key_here
   SECRET_KEY=your_jwt_secret_key_here
   ```

3. **Launch Docker Containers**:
   ```bash
   docker-compose up --build
   ```

4. **Access the Services**:
   - **API Gateway**: `http://localhost:8000`
   - **Interactive API Docs (Swagger)**: `http://localhost:8000/docs`

---

### Method 2: Running Frontend Locally

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser at `http://localhost:5173`.

---

## 🧪 Testing & Database Seeding

To seed initial sample data (courses, coding problems, quizzes):

```bash
cd backend
python seed_db.py
python seed_coding_problems.py
```

To run backend smoke tests:
```bash
python backend/run_smoke.py
```

---

## 📄 License

This project is open-source and available under the **MIT License**.
