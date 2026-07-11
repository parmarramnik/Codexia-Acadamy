# Codexia Academy (Codexia)

A complete, production-quality Learning Management System powered by FastAPI, React, SQLAlchemy, and Gemini AI.

## Project Architecture

- **Backend**: FastAPI, SQLAlchemy ORM (PostgreSQL / SQLite), JWT Auth, direct bcrypt, uvicorn
- **Frontend**: React (Vite), React Router, Axios, Context API, Monaco Editor
- **AI Integration**: Gemini API RAG context retrieval, FAISS vector indexing, dynamic notes / quiz / flashcards generators

---

## Production Deployment Guide

### 1. Database Setup (Neon PostgreSQL)

1. Sign up on [Neon.tech](https://neon.tech) and create a new PostgreSQL database.
2. Retrieve your connection string (e.g., `postgresql://user:password@host/dbname?sslmode=require`).
3. Create a `.env` in the backend folder and set:
   ```env
   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
   ```

### 2. Backend Service Deployment (Render)

1. Create a free account on [Render.com](https://render.com).
2. Click **New Web Service** and connect your GitHub repository.
3. Configure the following settings:
   - **Environment**: `Docker`
   - **Docker Path**: `backend/Dockerfile`
   - **Plan**: `Free`
4. Add the following **Environment Variables**:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string.
   - `JWT_SECRET_KEY`: A secure random secret key.
   - `GEMINI_API_KEY`: Your Gemini API credentials.
   - `FRONTEND_URL`: Your production Vercel frontend URL.
5. Click **Deploy Web Service**.

### 3. Frontend Deployment (Vercel)

1. Connect your repository to [Vercel.com](https://vercel.com).
2. Configure settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add the **Environment Variables**:
   - `VITE_API_URL`: Your deployed Render backend URL (e.g. `https://my-app.onrender.com/api`).
4. Update `vercel.json` rewrite destinations if you need local proxy redirects.
5. Click **Deploy**.
