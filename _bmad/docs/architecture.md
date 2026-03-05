---
stepsCompleted: ['context', 'decisions', 'patterns', 'structure', 'validation']
inputDocuments: ['_bmad/docs/brainstorm.md', '_bmad/docs/prd.md']
workflowType: 'architecture'
project_name: 'Smart Thermostat Controller'
date: '2026-03-03'
---

# Architecture Document — Smart Thermostat Controller

**Author:** Architect
**Date:** 2026-03-03
**Version:** 1.0

---

## System Context

### What We Are Building

A self-hosted full-stack IoT thermostat controller: a React web app that shows live temperature readings, lets the household owner control a target temperature and schedule, and communicates with an Arduino (BME280 sensor) over MQTT. Until the hardware arrives, a Node simulation script acts as a drop-in sensor source.

### System Context Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                        Browser (React)                         │
│   Dashboard · Schedule Builder · History Charts · Alerts       │
└──────────────────────────┬─────────────────────────────────────┘
         HTTPS/WSS (REST + Socket.io)
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                    Express API Server                          │
│   Auth · Devices · Rooms · Schedules · Readings · WebSocket    │
│                    SensorAdapter ◄──── env var switch          │
│          ┌──────────────┴──────────────┐                       │
│          │                             │                       │
│  SimulatorAdapter               MqttAdapter                    │
└──────────┬──────────────────────────── ┬───────────────────────┘
           │ HTTP POST                   │ MQTT publish/subscribe
┌──────────▼──────┐             ┌────────▼────────────────────┐
│  simulator/     │             │   MQTT Broker               │
│  index.ts       │             │   (Mosquitto local /        │
│  (Node process) │             │    HiveMQ cloud)            │
└─────────────────┘             └────────┬────────────────────┘
                                         │
                                ┌────────▼────────────────────┐
                                │   Arduino (ESP32/ESP8266)   │
                                │   BME280 sensor             │
                                │   EEPROM schedule fallback  │
                                └─────────────────────────────┘
┌───────────────────────────────────────────────────────────────┐
│                      MongoDB Atlas                            │
│  users · devices · rooms · schedules · tempReadings           │
│  tempReadingsHourly · events                                  │
└───────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────┐
│                        Redis                                  │
│  refresh token blacklist                                      │
└───────────────────────────────────────────────────────────────┘
```

### Key Architectural Concerns

| Concern | Decision |
|---------|----------|
| Real-time data | Socket.io — push, not polling |
| Sensor source flexibility | `SensorAdapter` interface; swap via env var |
| Hardware decoupling | Device Shadow (`desired` / `reported`) |
| Chart performance at scale | Pre-aggregated hourly collection, never query raw for 30-day views |
| Auth security | JWT (15 min) + rotating refresh tokens, Redis blacklist |
| Timezone correctness | All DB storage UTC; `date-fns-tz` display only |

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical (block implementation):**
- SensorAdapter interface shape must be defined before any ingestion code
- Device Shadow schema must be defined before any control code
- JWT/refresh token strategy must be decided before any protected route

**Important (shape architecture):**
- Monorepo layout (single repo, three packages)
- REST vs WebSocket responsibility split
- Aggregation strategy for TempReading

**Deferred (post-MVP):**
- Redis → in-memory fallback for single-instance dev (Redis required only for refresh token blacklist; can use in-memory Map locally)
- Geo-fence integration (Phase 3)
- Web Push API subscription management (Phase 3)

---

### Data Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | MongoDB Atlas (free tier) | Document model fits nested Device Shadow; schema-less suits evolving IoT payload |
| ODM | Mongoose 8 | Typed schemas, built-in validation, familiar in MERN stack |
| Time-series strategy | Two collections: raw `tempReadings` + pre-aggregated `tempReadingsHourly` | Raw collection supports future drill-down; hourly collection serves all chart queries in < 2 s |
| Aggregation trigger | MongoDB Change Stream on `tempReadings` OR scheduled job every hour | Change stream preferred (real-time aggregation); cron fallback if Atlas tier lacks change streams |
| Schema validation | Mongoose schema + Zod for request bodies (separate concerns) | Mongoose validates DB writes; Zod validates HTTP input at the boundary |
| Seed data | `server/src/scripts/seed.ts` — 30 days of synthetic readings + one admin user + one device | Enables immediate chart testing without hardware |
| Caching | None in MVP (single-household load is trivial) | Redis already present for token blacklist; can add route-level caching if needed |

**Device Shadow schema detail:**

```ts
// Embedded in Device document
shadow: {
  desired:  { temp: number; mode: 'heat' | 'cool' | 'auto'; awayMode: boolean },
  reported: { temp: number; mode: string; awayMode: boolean; updatedAt: Date }
}
```

The delta `desired − reported` is the pending work for Arduino. The frontend reads `shadow.reported.temp` for the live gauge and `shadow.desired.temp` for the slider position.

---

### Authentication & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth strategy | JWT access token (15 min) + HTTP-only refresh token cookie (7 days) | Short-lived access token limits blast radius; cookie prevents JS token theft |
| Refresh token rotation | Rotate on every `/auth/refresh` call; old token invalidated in Redis blacklist | Detects token reuse (stolen token scenario) |
| Token blacklist | Redis `SET` with TTL equal to token expiry | O(1) lookup, automatic eviction, no manual cleanup |
| Password hashing | bcrypt, cost factor 12 | Industry standard; cost factor 12 ~250 ms on modern hardware |
| Role enforcement | `requireRole(role)` Express middleware | Applied per-router, not per-route, to avoid accidental omissions |
| WebSocket auth | JWT validated in Socket.io `connection` event handler before any room join | Unauthenticated sockets disconnected immediately |
| Device ingestion auth | `x-device-secret` header on `/internal/readings` | Separate from user auth; secret stored in `.env` |
| HTTPS/WSS | Enforced by Railway (TLS termination at reverse proxy) | No custom cert management needed |
| Env validation | Zod schema checked in `server/src/config/env.ts` at startup | Process exits with clear error if required vars missing |

---

### API & Communication

| Decision | Choice | Rationale |
|----------|--------|-----------|
| REST API | Express 5 Router, versioned under `/api/v1` | Standard, cacheable, works with React Query |
| Real-time | Socket.io 4 (WebSocket with fallback) | Handles reconnection, rooms, and namespaces out of the box |
| REST vs WS split | REST = CRUD, auth, config writes. WS = live readings, device status, command ACKs | Clean separation; REST calls are idempotent and cacheable |
| API versioning | `/api/v1` prefix on all routes | Allows future non-breaking parallel versions |
| Response envelope | `{ data, error, meta }` wrapper for all REST responses | Consistent shape for React Query error/loading handling |
| Error format | `{ error: { code: string, message: string, details?: unknown } }` | Structured errors enable client-side i18n of messages |
| HTTP status codes | 200 GET/PATCH success, 201 POST, 204 DELETE, 400 validation, 401 unauth, 403 forbidden, 404 not found, 409 conflict, 500 server error | Conventional subset; no status code overloading |
| WS event naming | `namespace:action` pattern — `device:status`, `reading:new`, `command:ack` | Namespace prevents collisions as event count grows |
| Rate limiting | `express-rate-limit` on auth routes (10 req/min per IP) | Prevents brute-force; no rate limiting on internal readings endpoint (trusted secret) |

---

### Frontend Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build tool | Vite 6 | Fast HMR, native ESM, first-class TypeScript |
| State management | React Query v5 for server state; React `useState`/`useContext` for UI state | No Redux — server state is the only complex state; React Query handles caching, refetch, and loading |
| WebSocket client | Socket.io-client, custom `useSocket` hook | Hook exposes `reading`, `deviceStatus`, `commandAck` as reactive values |
| Charts | Recharts | Composable, React-native, sufficient for line/area charts |
| Routing | React Router v7 | File-based routing via `createBrowserRouter` |
| Component architecture | Feature-based: `components/features/{auth,dashboard,schedule,devices}` + shared `components/ui` | Colocates related code; shared UI stays generic |
| Thermal colour palette | CSS custom property `--temp-hue` interpolated from `cold=220` to `hot=0` based on current temp | Single variable drives all thermal colour accents |
| Date display | `date-fns-tz` `formatInTimeZone(date, Intl.DateTimeFormat().resolvedOptions().timeZone, ...)` | Browser timezone auto-detected; all raw values stay UTC |

---

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hosting | Railway | Free tier, env var management, auto-deploy from GitHub |
| Services deployed | `server` (Express) + `simulator` (Node cron) as two Railway services | Simulator is optional/replaceable; separate service avoids polluting API process |
| MQTT broker | Mosquitto (Docker, local dev) → HiveMQ Cloud free tier (production) | HiveMQ free tier: 100 connections, sufficient for a household |
| MongoDB | Atlas M0 free tier | 512 MB storage, no VPC required, free TLS |
| Redis | Railway Redis plugin (or Upstash free tier) | Managed, zero config, sufficient for token blacklist |
| CI/CD | GitHub Actions: lint + type-check + test on PR; auto-deploy to Railway on `main` push | Basic quality gate without over-engineering |
| Environment config | `.env.example` committed; `.env` gitignored; Zod schema in `server/src/config/env.ts` | Single source of truth for required vars |
| Logging | `pino` (structured JSON) in server; `console.*` in simulator | Pino outputs Railway-parseable JSON; no log aggregation service needed for MVP |

---

## Implementation Patterns & Consistency Rules

### Naming Conventions

**Database (Mongoose collections):**
- Collection names: **camelCase plural** — `tempReadings`, `tempReadingsHourly`, `users`, `devices`, `rooms`, `schedules`, `events`
- Field names: **camelCase** — `deviceId`, `createdAt`, `targetTemp`
- ObjectId ref fields: always named `<entity>Id` — `deviceId`, `roomId`

**REST API endpoints:**
- Resources: **kebab-case plural nouns** — `/devices`, `/temp-readings`, `/schedules`
- Resource identifiers: `:id` (never `:deviceId` in path, use param name `id`)
- Nested resources: `/devices/:id/settings` (shallow nesting only; max one level)
- Query params: **camelCase** — `?from=&to=&deviceId=`

**TypeScript / JavaScript code:**
- Files: **kebab-case** — `device-controller.ts`, `sensor-adapter.ts`, `use-socket.ts`
- Classes/interfaces/types: **PascalCase** — `SensorAdapter`, `DeviceDocument`, `TempReading`
- Functions/variables: **camelCase** — `getDevice`, `currentTemp`, `emitReading`
- Constants: **SCREAMING_SNAKE_CASE** — `MAX_MISSED_HEARTBEATS`, `JWT_EXPIRY_SECONDS`
- React components: **PascalCase** files and exports — `TempGauge.tsx`, `ScheduleBuilder.tsx`

**Socket.io events:**
- Format: `namespace:action` — `device:status`, `reading:new`, `command:ack`, `device:alert`
- Always lowercase, colon-separated

**Mongoose models:**
- Model name: **PascalCase singular** — `Device`, `TempReading`, `User`
- Schema variable: `deviceSchema`, `tempReadingSchema`

---

### API Response Format

**All REST responses use this envelope:**

```ts
// Success
{ "data": <payload>, "meta": { "timestamp": "<ISO UTC>" } }

// Error
{ "error": { "code": "DEVICE_NOT_FOUND", "message": "Device not found", "details": null } }

// Paginated list (future)
{ "data": [...], "meta": { "total": 42, "page": 1, "limit": 20, "timestamp": "..." } }
```

**Rules:**
- Never return raw arrays at the top level — always wrap in `{ data: [...] }`
- `error.code` is SCREAMING_SNAKE_CASE and machine-readable
- `error.message` is human-readable English (client may override for i18n)
- HTTP status code is always set correctly — do not return 200 with an error body

---

### Error Handling Pattern

**Server:**
```ts
// All async route handlers wrapped with asyncHandler utility
// Thrown errors propagate to global Express error middleware
export const asyncHandler = (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Global error middleware in app.ts
app.use((err: AppError, req, res, next) => {
  const status = err.status ?? 500;
  res.status(status).json({ error: { code: err.code, message: err.message } });
});
```

**Client:**
- React Query `onError` callbacks for server errors
- `ErrorBoundary` wrapping each page-level route
- Toast notifications for non-blocking errors (device offline, command failed)
- Full-page error state only for auth failures and 500s

---

### SensorAdapter Interface

This is the central seam of the architecture. **Never bypass it.**

```ts
// server/src/adapters/sensor-adapter.interface.ts
export interface SensorAdapter {
  start(): void;
  stop(): void;
}

// Controlled by SENSOR_ADAPTER env var
// 'simulator' → SimulatorAdapter (HTTP polling from simulator process)
// 'mqtt'      → MqttAdapter (connects to MQTT broker)
```

The adapter's only job is to receive readings and call:
```ts
ReadingService.ingest({ deviceId, temp, humidity, timestamp })
```

All downstream logic (persistence, aggregation, WebSocket emit, anomaly detection) lives in `ReadingService`, not in adapters.

---

### Device Shadow Update Pattern

```
User action (PATCH /devices/:id/settings)
  → Write shadow.desired only
  → Emit updated desired state via Socket.io to browser

SensorAdapter receives ACK (MQTT command:ack OR simulator ACK response)
  → Write shadow.reported
  → Emit updated reported state via Socket.io to browser

Frontend
  → Slider position = shadow.desired.temp
  → Live gauge     = shadow.reported.temp (latest TempReading)
  → "Pending" indicator shown when desired ≠ reported
```

---

### WebSocket Room Convention

- On connect: client calls `socket.emit('join', { deviceId })`
- Server joins socket to room `device:<deviceId>`
- All device-specific events emitted to `device:<deviceId>` room, never broadcast globally
- Auth middleware validates JWT before allowing room join

---

### Loading & Async State (Frontend)

- Use React Query `isLoading` / `isFetching` / `isError` states — never manage loading booleans manually
- Skeleton screens for initial page load; spinner overlays for mutations
- Optimistic updates for temperature slider (update local state, confirm or rollback on server response)

---

### Date/Time Rules

- **All MongoDB documents store timestamps as `Date` (UTC) — no exceptions**
- **All API responses serialize dates as ISO 8601 UTC strings** — `"2026-03-03T08:00:00.000Z"`
- **All display uses `date-fns-tz`** — `formatInTimeZone(date, userTimezone, 'HH:mm')`
- **Never use `new Date().toLocalString()` or `Date.toISOString()` for display**
- User timezone detected from `Intl.DateTimeFormat().resolvedOptions().timeZone` on the client

---

## Project Structure

### Monorepo Layout

```
thermostat/                         ← repo root
├── .github/
│   └── workflows/
│       └── ci.yml                  ← lint + type-check + test on PR
├── .env.example                    ← documents all required env vars
├── .gitignore
├── package.json                    ← workspaces: ["client","server","simulator"]
├── README.md
│
├── client/                         ← React + Vite frontend
├── server/                         ← Express API + Socket.io
└── simulator/                      ← Node sensor simulation process
```

---

### Server Package

```
server/
├── package.json
├── tsconfig.json
├── nodemon.json
├── .env                            ← gitignored
├── .env.example
│
└── src/
    ├── index.ts                    ← createServer(), connect DB, start adapter
    ├── app.ts                      ← Express app factory (no listen call — testable)
    │
    ├── config/
    │   └── env.ts                  ← Zod env schema; process.exit on failure
    │
    ├── adapters/
    │   ├── sensor-adapter.interface.ts
    │   ├── simulator-adapter.ts    ← accepts POST /internal/readings
    │   ├── mqtt-adapter.ts         ← subscribes to MQTT topics
    │   └── index.ts                ← factory: picks adapter from SENSOR_ADAPTER env
    │
    ├── db/
    │   ├── connect.ts              ← mongoose.connect wrapper
    │   └── models/
    │       ├── user.model.ts
    │       ├── device.model.ts
    │       ├── room.model.ts
    │       ├── schedule.model.ts
    │       ├── temp-reading.model.ts
    │       ├── temp-reading-hourly.model.ts
    │       └── event.model.ts
    │
    ├── middleware/
    │   ├── auth.ts                 ← verifyJwt, requireRole
    │   ├── device-secret.ts        ← verifyDeviceSecret for /internal/*
    │   ├── error-handler.ts        ← global Express error middleware
    │   ├── async-handler.ts        ← wraps async route handlers
    │   └── validate.ts             ← Zod request body validator factory
    │
    ├── routes/
    │   ├── index.ts                ← mounts all routers under /api/v1
    │   ├── auth.routes.ts
    │   ├── devices.routes.ts
    │   ├── rooms.routes.ts
    │   ├── schedules.routes.ts
    │   ├── readings.routes.ts
    │   └── internal.routes.ts      ← /internal/readings (device-secret auth)
    │
    ├── controllers/
    │   ├── auth.controller.ts
    │   ├── devices.controller.ts
    │   ├── rooms.controller.ts
    │   ├── schedules.controller.ts
    │   └── readings.controller.ts
    │
    ├── services/
    │   ├── auth.service.ts         ← register, login, refresh, logout
    │   ├── device.service.ts       ← CRUD, shadow updates, heartbeat tracking
    │   ├── reading.service.ts      ← ingest(), aggregate(), anomaly check
    │   ├── schedule.service.ts
    │   ├── notification.service.ts ← Web Push (Phase 3 stub)
    │   └── command.service.ts      ← enqueue, ack, deliver commands
    │
    ├── sockets/
    │   ├── index.ts                ← Socket.io server setup, JWT auth middleware
    │   └── device.socket.ts        ← join/leave room handlers, emit helpers
    │
    ├── scripts/
    │   └── seed.ts                 ← 30-day readings + admin user + device
    │
    ├── types/
    │   └── express.d.ts            ← declare namespace Express { Request.user }
    │
    └── utils/
        ├── jwt.ts                  ← sign/verify access + refresh tokens
        ├── redis.ts                ← createClient, blacklist helpers
        └── logger.ts               ← pino instance
```

---

### Client Package

```
client/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
│
└── src/
    ├── main.tsx                    ← ReactDOM.createRoot, QueryClient, Router
    ├── App.tsx                     ← route definitions via createBrowserRouter
    │
    ├── api/                        ← React Query hooks (one file per resource)
    │   ├── auth.ts                 ← useLogin, useLogout, useRegister
    │   ├── devices.ts              ← useDevices, useDevice, useUpdateDeviceSettings
    │   ├── readings.ts             ← useReadingsHistory, useLatestReading
    │   ├── schedules.ts            ← useSchedule, useSaveSchedule
    │   └── query-client.ts         ← QueryClient config (staleTime, retry)
    │
    ├── hooks/
    │   ├── use-socket.ts           ← Socket.io connection, event subscriptions
    │   └── use-user-timezone.ts    ← Intl timezone detection
    │
    ├── components/
    │   ├── ui/                     ← Generic, reusable, not business-aware
    │   │   ├── Button.tsx
    │   │   ├── Slider.tsx
    │   │   ├── Card.tsx
    │   │   ├── Toast.tsx
    │   │   ├── Skeleton.tsx
    │   │   └── ErrorBoundary.tsx
    │   │
    │   └── features/
    │       ├── auth/
    │       │   ├── LoginForm.tsx
    │       │   └── RegisterForm.tsx
    │       ├── dashboard/
    │       │   ├── TempGauge.tsx        ← live reported temp, thermal colour
    │       │   ├── TargetSlider.tsx     ← desired temp + hold duration
    │       │   ├── HeatingRuntimeWidget.tsx
    │       │   └── DeviceStatusBadge.tsx
    │       ├── history/
    │       │   └── TempHistoryChart.tsx ← Recharts area chart
    │       ├── schedule/
    │       │   ├── ScheduleBuilder.tsx
    │       │   └── ScheduleSlot.tsx
    │       ├── devices/
    │       │   ├── DeviceList.tsx
    │       │   └── DeviceCard.tsx
    │       └── rooms/
    │           └── RoomView.tsx
    │
    ├── pages/
    │   ├── LoginPage.tsx
    │   ├── DashboardPage.tsx
    │   ├── HistoryPage.tsx
    │   ├── SchedulePage.tsx
    │   └── DevicesPage.tsx
    │
    ├── context/
    │   └── AuthContext.tsx         ← current user, token, logout helper
    │
    ├── styles/
    │   ├── global.css              ← CSS custom properties incl. --temp-hue
    │   └── thermal.css             ← temperature colour interpolation utilities
    │
    └── utils/
        ├── format-date.ts          ← date-fns-tz wrappers
        └── temp-colour.ts          ← hue interpolation helper
```

---

### Simulator Package

```
simulator/
├── package.json
├── tsconfig.json
├── .env                            ← DEVICE_ID, DEVICE_SECRET, API_URL
│
└── src/
    └── index.ts                    ← setInterval loop, day/night sin curve, POST
```

The simulator is intentionally minimal. It is **not** imported by the server — it communicates only via HTTP POST to `/internal/readings`. Replacing it with MQTT requires zero server changes.

---

## Architectural Boundaries

### API Boundaries

```
Public REST    /api/v1/*          requireRole middleware applied at router level
Internal       /internal/*        verifyDeviceSecret middleware; no JWT
WebSocket      /                  JWT validated in Socket.io connection middleware
```

Route → Controller → Service → Model (Mongoose) is the mandatory call chain.
Controllers must not call Mongoose directly. Services must not import Express types.

### Component Boundaries

```
Browser
  └── Page components          ← compose feature components; own no business logic
       └── Feature components  ← own React Query hooks and domain state
            └── UI components  ← purely presentational; no API calls, no hooks
```

Feature components communicate with the server via React Query hooks (`api/` directory) and the Socket.io `useSocket` hook. They never call `fetch` directly.

### Service Boundaries (Server)

```
Route handler
  └── Controller               ← parse request, call service, format response
       └── Service              ← business logic, calls models, emits Socket.io events
            └── Mongoose Model  ← DB access only
```

`ReadingService` is the only service that emits Socket.io events directly (via the `io` instance injected at startup). All other services are pure functions over the database.

### Data Boundaries

```
MongoDB        source of truth for all persistent state
Redis          ephemeral: refresh token blacklist only
Socket.io      ephemeral: in-flight readings and status events
```

The React client caches server state in React Query. It does not maintain its own persistent store. A full page reload restores state from the server within one React Query refetch.

---

## Data Flow

### Live Temperature Reading (Happy Path)

```
1. simulator/index.ts  POST /internal/readings  { deviceId, temp, humidity }
2. internal.routes.ts  → verifyDeviceSecret → ReadingController.ingest
3. ReadingService.ingest()
   a. Persist TempReading document
   b. Check anomaly thresholds → if exceeded, persist Event + notify
   c. Check aggregation window → if hour elapsed, upsert TempReadingHourly
   d. io.to(`device:${deviceId}`).emit('reading:new', payload)
4. Socket.io → browser → useSocket hook → React state update → TempGauge re-render
```

### User Sets Target Temperature

```
1. Browser  PATCH /api/v1/devices/:id/settings  { desired: { temp: 22 } }
2. requireRole('admin') → DeviceController.updateSettings
3. DeviceService.updateShadowDesired()
   a. Write device.shadow.desired in MongoDB
   b. CommandService.enqueue({ deviceId, type: 'set-temp', value: 22 })
   c. io.to(`device:${deviceId}`).emit('device:shadow', updatedShadow)
4. Arduino (MQTT) receives command → adjusts relay → publishes ACK to devices/:id/ack
5. MqttAdapter → CommandService.ack() → DeviceService.updateShadowReported()
   a. Write device.shadow.reported
   b. io.to(`device:${deviceId}`).emit('device:shadow', updatedShadow)
6. Browser TempGauge shows desired=22 °C, reported climbing; "pending" indicator clears on ACK
```

### Authentication Flow

```
POST /auth/login
  → verify password (bcrypt.compare)
  → sign accessToken (JWT, 15 min, in response body)
  → sign refreshToken (JWT, 7 days, in HTTP-only Set-Cookie)
  → store refreshToken id in Redis (for rotation tracking)

POST /auth/refresh
  → read refreshToken from cookie
  → verify JWT signature + check Redis blacklist
  → add old token to blacklist
  → issue new accessToken + new refreshToken (rotation)

POST /auth/logout
  → add current refreshToken to Redis blacklist
  → clear cookie
```

---

## Integration Points

### MQTT (Phase 4)

| Topic | Direction | Publisher | Subscriber |
|-------|-----------|-----------|------------|
| `devices/:id/readings` | Arduino → backend | Arduino | MqttAdapter |
| `devices/:id/heartbeat` | Arduino → backend | Arduino | MqttAdapter |
| `devices/:id/commands` | Backend → Arduino | CommandService | Arduino |
| `devices/:id/ack` | Arduino → backend | Arduino | MqttAdapter |

Local dev: Mosquitto via Docker (`docker run -p 1883:1883 eclipse-mosquitto`)
Production: HiveMQ Cloud free tier cluster URL in env var `MQTT_BROKER_URL`

### Heartbeat Monitoring

```
MqttAdapter subscribes to devices/:id/heartbeat
  → on each beat: DeviceService.recordHeartbeat(deviceId)

Scheduled check every 60 s (setInterval in index.ts):
  → DeviceService.checkHeartbeats()
  → devices where lastSeen < now - 180s → mark status='offline'
  → emit device:status via Socket.io
```

### MongoDB Change Stream (Aggregation)

```ts
// server/src/services/reading.service.ts
// On startup, open change stream on tempReadings collection
// On each insert: check if current hour bucket exists in tempReadingsHourly
//   - if not: create with current reading
//   - if yes:  $set avgTemp, minTemp, maxTemp using running calculation
```

Fallback if Atlas tier does not support change streams: hourly cron job using `node-cron`.

---

## Environment Variables

```bash
# server/.env.example

# App
NODE_ENV=development
PORT=3001
CLIENT_ORIGIN=http://localhost:5173

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/thermostat

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=<32+ char random>
JWT_REFRESH_SECRET=<32+ char random>

# Device ingestion
DEVICE_SECRET=<32+ char random>

# Sensor adapter
SENSOR_ADAPTER=simulator   # 'simulator' | 'mqtt'

# MQTT (only required when SENSOR_ADAPTER=mqtt)
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# Email (Phase 4)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
```

All vars are validated by `server/src/config/env.ts` (Zod). MQTT vars are validated only when `SENSOR_ADAPTER=mqtt`.

---

## Development Workflow

### Starting the Stack Locally

```bash
# Terminal 1 — MongoDB Atlas (remote, free tier, always on)
# No local process needed

# Terminal 2 — Redis
docker run -p 6379:6379 redis:7-alpine

# Terminal 3 — MQTT broker (optional, only if SENSOR_ADAPTER=mqtt)
docker run -p 1883:1883 eclipse-mosquitto

# Terminal 4 — API server
cd server && npm run dev       # nodemon + ts-node

# Terminal 5 — Simulator (when SENSOR_ADAPTER=simulator)
cd simulator && npm run dev    # ts-node, posts readings every 30s

# Terminal 6 — React client
cd client && npm run dev       # Vite
```

### Testing Strategy

| Layer | Tool | Location |
|-------|------|----------|
| Unit (services) | Vitest | `server/src/services/*.test.ts` |
| Integration (routes) | Supertest + Vitest | `server/src/routes/*.test.ts` |
| Component | React Testing Library + Vitest | `client/src/**/*.test.tsx` |
| E2E (Phase 2) | Playwright | `e2e/` at repo root |

Test files colocated with source files (`*.test.ts` / `*.test.tsx`).
CI runs `npm test` in both `server` and `client` on every PR.

### CI Pipeline (`.github/workflows/ci.yml`)

```
on: pull_request
jobs:
  server:
    - npm ci
    - npm run type-check
    - npm run lint
    - npm run test
  client:
    - npm ci
    - npm run type-check
    - npm run lint
    - npm run test
```

Railway auto-deploys `server` and `simulator` services on push to `main`.

---

## Architecture Decision Records (ADRs)

### ADR-001: Monorepo with npm workspaces

**Context:** Three packages (client, server, simulator) with shared types.
**Decision:** npm workspaces monorepo in a single git repository.
**Rationale:** Simplest setup for a pet project; avoids separate repos and publish steps. Shared TypeScript types can be extracted to a `packages/shared` workspace later if needed.
**Consequences:** All packages share `node_modules`; Railway services point to subdirectories.

---

### ADR-002: SensorAdapter over direct MQTT integration

**Context:** Arduino hardware unavailable at project start.
**Decision:** Introduce `SensorAdapter` interface; select implementation via `SENSOR_ADAPTER` env var.
**Rationale:** Without this seam, replacing simulator with MQTT would require touching `ReadingService`, routes, and potentially tests. The interface limits the change surface to one file.
**Consequences:** Slight indirection cost; completely eliminates refactor risk when hardware arrives.

---

### ADR-003: Pre-aggregated hourly collection instead of MongoDB aggregation pipeline per request

**Context:** 30-day history = ~1,440 raw readings/device (assuming 30s interval). Aggregating on read would scan 1,440 documents per chart request.
**Decision:** Maintain a separate `tempReadingsHourly` collection updated on write (change stream or cron).
**Rationale:** Moves aggregation cost to write path (one device, low frequency); makes chart queries a simple range scan on an indexed collection.
**Consequences:** Two collections to maintain; aggregation must be backfilled on seed; slight data staleness (up to 1 hour for hourly view, acceptable for charts).

---

### ADR-004: HTTP-only cookie for refresh token

**Context:** JWT access tokens expire in 15 min; refresh tokens need longer life.
**Decision:** Refresh token stored in `HttpOnly; Secure; SameSite=Strict` cookie, not in `localStorage`.
**Rationale:** `HttpOnly` cookies are inaccessible to JavaScript, mitigating XSS token theft. `SameSite=Strict` mitigates CSRF. Access token in memory (React context) expires quickly.
**Consequences:** Mobile app support would require different flow (native cookie handling); not a concern for MVP (web only).

---

### ADR-005: Redis for refresh token blacklist

**Context:** Rotating refresh tokens need invalidation on logout and on rotation.
**Decision:** Redis `SET tokenId ""` with TTL matching token expiry.
**Rationale:** O(1) lookup, automatic expiry via TTL, zero maintenance. Alternative (DB blacklist) adds latency and requires periodic cleanup job.
**Consequences:** Redis becomes a required service; single Redis node is acceptable for MVP (single-household, no HA requirement).