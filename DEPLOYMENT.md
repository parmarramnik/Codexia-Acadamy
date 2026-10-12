# Codexia Academy — Deployment guide (microservices, production)

## 1. Architecture

```
browser ──HTTPS──> edge (Caddy, automatic TLS)
                     └─> frontend (nginx: React build, proxies /api and /static)
                           └─> gateway :8000 ── routes /api/<segment> to the owning service
                                 ├─ auth_service      :8001  auth, users
                                 ├─ course_service    :8002  courses, lectures, course-builder, notes, flashcards, study-planner
                                 ├─ quiz_service      :8003  quizzes, certificates
                                 ├─ coding_service    :8004  coding problems, git, code execution  ──> Judge0 (external, isolated)
                                 ├─ ai_service        :8005  AI tutor, code review, RAG (torch, FAISS, embedding model)
                                 ├─ analytics_service :8006  analytics, admin, logs, search, comms
                                 └─ payment_service   :8007  Razorpay orders, verify, webhook, refunds, pricing
                     shared, private network:  postgres (source of truth)   redis (cache + rate limits)   static volume (uploads)
migrate: one-shot job before everything else (tables, roles, reference data, first admin)
```

Only `edge` (ports 80/443) is published in production. Services are never reachable from the internet.

Design rules worth knowing:
* **Payments are isolated** in their own service and are the only one that holds `RAZORPAY_*` secrets.
* **Only the AI image contains ML libraries** (torch/FAISS/sentence-transformers, ~2 GB); the embedding model is baked in at build time.
* **Student code never runs in these containers.** It runs in Judge0 (external). Without `JUDGE0_URL`, Run/Submit return a clear 503.
* **The gateway never falls back to a monolith.** A down service gives 503 for its routes only; `/api/health/ready` shows which one.
* **Schema work happens only in `migrate`.** Services never create tables, so there are no start-up races.
* The same `JWT_SECRET_KEY` is used by every service (tokens are verified locally in each one).

## 2. Run locally (Docker Desktop)

```
docker compose up -d --build        # first build ~15 min (torch); later builds use the cache
open http://localhost:3000          # API docs at http://localhost:8000 are disabled; see /api/health/ready
```
Local mode uses DEBUG=true: demo accounts (`student@gmail.com`, `instructor@gmail.com`, `admin@gmail.com`, `sadmin@gmail.com`,
password `123456`) and sample courses are created. **These accounts never exist in production.**
Optional search: `docker compose --profile search up -d`. Stop: `docker compose down` (add `-v` to wipe all data).
Single-process alternative (everything in one backend container): `docker compose -f docker-compose.full.yml up -d --build`.

## 3. Deploy to a server (VPS / any Docker host)

Requirements: a Linux server with Docker + Compose v2, **4 GB RAM minimum (8 GB comfortable)**, a domain whose DNS record points
at the server, ports 80 and 443 open.

1. `git clone` the repository onto the server.
2. `cp .env.production.example .env.production` and fill every value (section 4). Generate secrets with
   `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
3. Start:
   ```
   docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```
   Compose refuses to start if a required secret is missing. Certificates are issued automatically on first request.
4. Verify (section 6).
5. Update later: `git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d --build`.

Alternative layout: frontend on Vercel (`VITE_API_URL=https://<DOMAIN>/api`, add the Vercel origin to `CORS_ORIGINS`) and the
backend stack on the server.

Backups: the data lives in Docker volumes `postgres_data` and `static`. Back up Postgres with
`docker compose exec postgres pg_dump -U codexia_admin codexia_lms > backup.sql` and the `static` volume (uploaded videos/avatars).
To use a managed Postgres/Redis instead of the containers, set `EXTERNAL_DATABASE_URL` / `EXTERNAL_REDIS_URL`.

## 4. Environment variables (`.env.production`)

| Variable | Required | Meaning |
|---|---|---|
| `DOMAIN`, `ACME_EMAIL` | **yes** | Public domain and Let's Encrypt contact |
| `FRONTEND_URL`, `CORS_ORIGINS` | **yes** | Public frontend URL (emails/QR codes) and allowed browser origins |
| `JWT_SECRET_KEY` | **yes** | ≥ 32 random chars, shared by all services |
| `CERTIFICATE_SIGNING_KEY` | **yes** | Random; keep stable (changing it invalidates issued certificates) |
| `POSTGRES_PASSWORD` | **yes** | Database password (or use `EXTERNAL_DATABASE_URL`) |
| `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` | recommended | First admin, created once; remove the password afterwards |
| `GEMINI_API_KEY` | for AI | AI tutor, code review, quiz/flashcard generation. Without it AI endpoints return 503 |
| `JUDGE0_URL`, `JUDGE0_API_KEY`, `JUDGE0_AUTH_HEADER` (+`JUDGE0_RAPIDAPI_HOST`) | for code execution | See section 5 |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | for paid courses | Use `rzp_test_…` until section 7 passes |
| `BREVO_API_KEY` **or** `SMTP_HOST/PORT/USER/PASSWORD`, `FROM_EMAIL` | for email | Verification OTPs, notifications |
| `ADMIN_EMAIL`, `INSTRUCTOR_EMAIL` | optional | Notification addresses |
| `REDIS_REQUIRED` | default true in prod | Readiness fails if Redis is down (rate limits/cache are shared) |
| `EXTERNAL_DATABASE_URL`, `EXTERNAL_REDIS_URL` | optional | Managed Postgres (`?sslmode=require`) / Redis (`rediss://`) |
| `RAG_ENABLED`, `EMBEDDING_MODEL`, `RAG_TOP_K`, `RAG_MIN_SCORE` | optional | Course RAG tuning (model is baked into the image at build time) |
| `WEB_CONCURRENCY`, `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `MAX_UPLOAD_SIZE_MB` | optional | Tuning; keep services × workers × (pool + overflow) below Postgres' 200 connections |

Production start-up validation (every service and `migrate`) **fails fast** if: `JWT_SECRET_KEY` is the placeholder or < 32 chars,
`DATABASE_URL` is SQLite, or `FRONTEND_URL` is localhost.

## 5. External services you must provide

* **Judge0 (code execution).** Needs a sandbox that can enforce CPU/memory/process/network limits, which cannot run safely inside
  the application containers. Use a hosted Judge0 (e.g. RapidAPI: `JUDGE0_URL=https://judge0-ce.p.rapidapi.com`,
  `JUDGE0_AUTH_HEADER=X-RapidAPI-Key`, `JUDGE0_RAPIDAPI_HOST=judge0-ce.p.rapidapi.com`) or self-host Judge0 CE on a *separate* VM
  (it requires privileged containers). Language ids are for Judge0 CE 1.13.x; readiness lists any your instance lacks.
* **Gemini API key**, **Razorpay account**, **email provider** (Brevo or SMTP), a **domain**.
* Optional: managed Postgres (Neon/RDS) and Redis (Upstash/ElastiCache).

## 6. Verification after every deploy

1. `curl https://<DOMAIN>/api/health/ready` → `"status":"ready"`, all 7 services `ready`; read the `components`
   (`database`, `cache`, `ai`, `rag`, `payments`, `code_execution`: any `degraded`/`not configured` tells you which key is missing).
2. Log in with the bootstrap admin; the Admin portal "Server Diagnostics" panel shows the same data.
3. Code execution: `docker compose exec coding_service python scripts/check_code_execution.py` (6 cases × 6 languages).
4. RAG: as an instructor upload a PDF in a course (`POST /api/rag/courses/{id}/documents`), then ask the tutor about it as an enrolled
   student; the answer should carry `sources`. A student who has not paid must get 403.
5. Logs: `docker compose logs -f gateway` (one line per request with a request id that is also in the service log).

## 7. Razorpay Test Mode (manual)

Register the webhook `https://<DOMAIN>/api/payments/razorpay/webhook` (events `payment.captured, payment.authorized, payment.failed,
order.paid, refund.created, refund.processed, refund.failed`) with the same secret as `RAZORPAY_WEBHOOK_SECRET`. Buy a paid course with
a test card/UPI → enrollment appears once; close the tab mid-payment → webhook still grants access; refund from admin → access
revoked only after Razorpay confirms; replay a webhook → no second enrollment. Only then switch to `rzp_live_…` keys.
Key rotation: create the new key → update `.env.production` → `docker compose up -d payment_service` → revoke the old key.

## 8. Operations

* Restart one service: `docker compose restart course_service`. Scale CPU-bound services with `WEB_CONCURRENCY`.
* The AI service holds one copy of the embedding model (≈1 GB RAM). Do not give it more than 1 worker.
* Rate limits are stored in Redis, so they hold across workers and services.
* There is no Celery: RAG document ingestion runs as a background task and its status is stored on the document; documents interrupted
  by a restart are marked failed and can be re-indexed.
* Known limits: the project has no migration tool. `create_all` adds new tables and `database.py` adds a fixed list of known columns;
  any other schema change needs a manual migration; request-size limits beyond `Content-Length` are enforced at Caddy/nginx (520 MB).
