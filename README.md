# Live Video Quality Monitor

Analyzes the webcam in the browser and shows live FPS, brightness, motion, face presence and a Good or Poor verdict. Video never leaves the browser. Only the numbers reach the backend.

| Part | Choice |
|---|---|
| Frontend | React, TypeScript, Vite, Mantine, uPlot, axios, MediaPipe Face Detection |
| Backend | Python, Flask, Pydantic, SQLAlchemy |
| Database | Postgres |
| Free services | Vercel (frontend and backend), Neon (Postgres), GitHub |

Free backends sleep when idle, so the first request can take up to a minute.

**Contents:** [Run locally](#run-locally) · [Tests](#tests) · [Project map](#project-map) · [Architecture](#architecture) · [API](#api) · [Thresholds](#thresholds) · [Data and edge cases](#data-and-edge-cases) · [Environment variables](#environment-variables)

---

## Run locally

Requires Python 3.12+, Node 22.12+ and Postgres.

**1. Set your Postgres login.** This is the only setting you need to change.

```bash
cp backend/.env.example backend/.env
```

In `backend/.env`, replace `USER` and `PASSWORD` in `DATABASE_URL` and `TEST_DATABASE_URL`.

**2. Install everything.** You only need to do this once.

```bash
npm run setup
```

This installs the backend and frontend, creates `frontend/.env` with working values, and creates the database and tables if they don't exist.

**3. Start the app.**

```bash
npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:5000

---

## Tests

```bash
cd backend
.venv/bin/python -m pip install -r requirements-dev.txt  # first time only
.venv/bin/python -m pytest

cd ../frontend
npm test
```

On Windows, use `.venv\Scripts\python` for the backend commands.

The backend tests run on Postgres and create the database named in `TEST_DATABASE_URL` if it doesn't exist.

---

## Project map

```
backend/
  wsgi.py                 Entry point
  app/
    __init__.py           create_app: wires everything together
    config.py             Settings read from .env
    errors.py             API errors and their status codes
    routes/               HTTP endpoints
    schemas/              Pydantic request and response validation
    services/             Business rules, summaries, rate limiter
    repositories/         All database queries
    db/                   Models, engine, table creation
    middlewares/          Error handlers, request logging, Origin and rate limit guards
    utils/                Logger
  tests/

frontend/
  src/
    main.tsx, App.tsx     App startup
    router.tsx            Screens and their URLs
    theme.ts              Colors and Mantine theme
    components/           live/, charts/, history/, layout/
    hooks/                Connect React to the session and the API
    session/              Recording lifecycle and the sample outbox
    media/                Camera, frame loop, face detection, worker connection
    workers/              Web Worker that analyzes frames
    domain/               Metric, per-second and verdict calculations
    controllers/          API calls
    config/               Environment values and chart settings
    types/                Shared types
    utils/                Chart and formatting helpers
  tests/                  Same folders as src/

scripts/                  npm run setup and npm run dev
```

### Where to look

| To find | Open |
|---|---|
| FPS, brightness and motion calculations | `frontend/src/domain/frameAnalysis.ts`, `frontend/src/domain/SecondAggregator.ts` |
| The Good or Poor decision | `frontend/src/domain/verdict.ts` |
| Start, pause and Stop | `frontend/src/session/SessionController.ts` |
| Sending, retrying and keeping samples | `frontend/src/session/SampleOutbox.ts` |
| Live screen | `frontend/src/components/live/LiveScreen.tsx` |
| API endpoints | `backend/app/routes/sessions.py` |
| Validation limits | `backend/app/schemas/sample.py`, `backend/app/schemas/session.py` |
| Session rules | `backend/app/services/session_service.py` |
| Summary numbers | `backend/app/services/summary.py`, `backend/app/repositories/session_repository.py` |
| Database tables | `backend/app/db/models.py` |
| Rate limits and Origin check | `backend/app/middlewares/request_guards.py`, `backend/app/services/rate_limiter.py` |

---

## Architecture

```mermaid
flowchart TB
    subgraph browser["Browser: video stays here"]
        direction LR
        camera["Camera"]
        face["Face detection<br/>MediaPipe, main thread"]
        worker["Web Worker<br/>metrics, verdict,<br/>per-second sample"]
        chart["Live chart<br/>last 30 seconds"]
        outbox["Outbox<br/>keeps samples until saved"]

        camera -->|"10 times/sec"| face
        camera -->|"every frame"| worker
        face -->|"face or no face"| worker
        worker --> chart
        worker --> outbox
    end

    subgraph api["Flask API: stateless"]
        direction LR
        guards["CORS, Origin check,<br/>rate limits"]
        routes["Routes,<br/>Pydantic validation"]
        services["Services"]
        repositories["Repositories"]

        guards --> routes --> services --> repositories
    end

    subgraph database["Postgres"]
        direction LR
        sessions["sessions"]
        samples["samples<br/>primary key: session_id, t"]

        sessions -->|"1 to many"| samples
    end

    browser -->|"HTTPS + JSON every 2 seconds, numbers only, never video"| api
    api -->|"SQLAlchemy, duplicate samples ignored"| database
```

Each sample holds `t`, `fps`, `brightness`, `motion`, `face`, `verdict` and `reason`. Summaries are calculated from the samples on read.

---

## API

| Method and path | Purpose |
|---|---|
| `POST /sessions` | Start a session |
| `POST /sessions/{id}/samples` | Save a batch of samples |
| `POST /sessions/{id}/stop` | Stop a session |
| `GET /sessions` | List sessions with summaries, newest first |
| `GET /sessions/{id}` | One session with its samples and summary |
| `GET /health` | Check the API and its database connection |

Errors are JSON with a 4xx or 5xx status: `{"error": {"code", "message", "details"}}`.

---

## Thresholds

Set through `VITE_*` values in `frontend/.env`. When several problems happen in the same second, the message comes from the highest row in this table.

| Metric | Warning when | Message |
|---|---|---|
| Face | none detected in the whole second | No face |
| Brightness | below 60 or above 200 | Too dark or Too bright |
| Motion | above 20 | Hold still |
| FPS | below 15 | Low FPS |

Face detection runs 10 times per second. FPS, brightness and motion come from the frames the app really processed, so FPS drops if the browser is busy and skips frames.

---

## Data and edge cases

- **No lost samples:** the browser keeps each sample until the backend confirms it, and retries after network errors, timeouts, 408, 429 and 5xx.
- **No duplicates:** `(session_id, t)` is the primary key, so a retried sample is ignored.
- **Stop called twice:** returns 200 and keeps the original `ended_at`.
- **Samples after Stop:** saved for 2 minutes, because retries can delay samples measured before Stop. After that they are ignored with a 200 response, so finished sessions stop changing.
- **Leaving the page without Stop:** the browser sends its last samples and a Stop while the page closes. If those don't arrive, the session stays without `ended_at` and its duration is still the `t` of the last saved sample.
- **Tab hidden:** recording pauses and resumes when the tab is visible again. After 5 minutes hidden, the session ends instead of resuming.

---

## Environment variables

`npm run setup` creates each `.env` from its `.env.example` and never replaces an existing one. Restart `npm run dev` after changing a value. After changing `DATABASE_URL`, run `npm run setup` again to create the tables.

### `backend/.env`

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | Local server port. If you change it, update `VITE_API_BASE_URL` too |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@localhost:5432/video_metrics` | Postgres connection URL. Replace `USER` and `PASSWORD` with your login |
| `TEST_DATABASE_URL` | `postgresql://USER:PASSWORD@localhost:5432/video_metrics_test` | Database for the tests, which erase it. Its name must end in `_test` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated frontend origins allowed to call the API |
| `MAX_BATCH_SIZE` | `120` | Most samples accepted in one request |
| `MAX_SESSION_SECONDS` | `86400` | Largest accepted sample time `t` |
| `LATE_SAMPLE_GRACE_SECONDS` | `120` | How long after Stop samples are still saved |
| `MAX_REQUEST_BYTES` | `262144` | Largest accepted request body |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Length of one rate limit window |
| `RATE_LIMIT_CREATE_PER_WINDOW` | `10` | Sessions one client can create per window |
| `RATE_LIMIT_REQUESTS_PER_WINDOW` | `120` | All other session requests one client can make per window |
| `TRUSTED_PROXY_HOPS` | `0` | Proxies in front of the API that set `X-Forwarded-For`. Use `0` when there are none |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING` or `ERROR` |

### `frontend/.env`

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:5000` | Backend URL. Replace `5000` if `PORT` in `backend/.env` is different |
| `VITE_FPS_MIN` | `15` | Lowest acceptable FPS |
| `VITE_BRIGHTNESS_MIN` | `60` | Darkest acceptable brightness |
| `VITE_BRIGHTNESS_MAX` | `200` | Brightest acceptable brightness |
| `VITE_MOTION_MAX` | `20` | Highest acceptable motion |
| `VITE_ANALYSIS_WIDTH` | `160` | Width frames are scaled to for analysis |
| `VITE_ANALYSIS_HEIGHT` | `120` | Height frames are scaled to for analysis |
| `VITE_FACE_DETECT_HZ` | `10` | Face detections per second |
| `VITE_FACE_MIN_CONFIDENCE` | `0.5` | Detection confidence from 0 to 1 needed to count a face |
| `VITE_BATCH_INTERVAL_MS` | `2000` | Time between sends |
| `VITE_BATCH_SIZE` | `120` | Most samples per send. Must not exceed `MAX_BATCH_SIZE` |
| `VITE_REQUEST_TIMEOUT_MS` | `10000` | Time before a request counts as failed and is retried |
| `VITE_MAX_PAUSE_SECONDS` | `300` | A session hidden longer than this ends instead of resuming |
| `VITE_CHART_WINDOW_SECONDS` | `30` | Seconds shown on the live chart |
