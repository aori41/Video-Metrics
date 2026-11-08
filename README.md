# Live Video Quality Monitor

Analyzes the webcam in the browser and shows live FPS, brightness, motion, face presence and a Good or Poor verdict. Video never leaves the browser. Only the numbers reach the backend.

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

### Tests

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

---

## Stack and free services

| Part | Choice |
|---|---|
| Frontend | React, TypeScript, Vite, Mantine, uPlot, axios, MediaPipe Face Detection |
| Backend | Python, Flask, Pydantic, SQLAlchemy |
| Database | Postgres |
| Free services | Vercel (frontend and backend), Neon (Postgres), GitHub |

Free backends sleep when idle, so the first request can take up to a minute.

---

## Thresholds

Set through `VITE_*` values in `frontend/.env`.

| Metric | Warning when | Message |
|---|---|---|
| FPS | below 15 | Low FPS |
| Brightness | below 60 or above 200 | Too dark or Too bright |
| Motion | above 20 | Hold still |
| Face | none detected in the whole second | No face |

Face detection runs 10 times per second. FPS, brightness and motion use every frame the app processes, calculated in a Web Worker so the UI can't slow down or affect the measurements.

---

## Architecture

```
Browser
  Camera
    ├─ every frame ──→ Web Worker: FPS, brightness, motion
    └─ 10 times/sec ─→ MediaPipe: face detection
                           │
                           ▼
  Per-second sample and verdict (t, fps, brightness, motion, face, verdict, reason)
    ├─→ Live chart (last 30 seconds)
    └─→ Outbox: sends a batch every 2 seconds, keeps samples until saved
                           │
                           │  HTTPS + JSON, numbers only, never video
                           ▼
Flask API (stateless)
  Routes ──→ Services ──→ Repositories
  Pydantic validation, restricted CORS, rate limits, structured logs
                           │
                           │  SQLAlchemy, duplicate samples ignored
                           ▼
Database
  sessions 1 ──→ many samples, primary key (session_id, t)
  Summaries are calculated from the samples on read
```

---

## Edge cases

- **Stop called twice:** returns 200 and keeps the original `ended_at`.
- **Samples after Stop:** saved for 2 minutes, because retries can delay samples measured before Stop. After that they are ignored with a 200 response, so finished sessions stop changing.
- **Leaving the page without Stop:** the browser sends its last samples and a Stop while the page closes. If those don't arrive, the session stays without `ended_at` and its duration is still the `t` of the last saved sample.
- **Tab hidden:** recording pauses and resumes when the tab is visible again. After 5 minutes hidden, the session ends instead of resuming.
