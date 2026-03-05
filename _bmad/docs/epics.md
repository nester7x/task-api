---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['_bmad/docs/brainstorm.md', '_bmad/docs/prd.md', '_bmad/docs/architecture.md', '_bmad/docs/ux-design-specification.md']
---

# Smart Thermostat Controller — Epic Breakdown

## Overview

This document decomposes all requirements from the PRD, Architecture, and UX Design Specification into implementable epics and stories. Each epic delivers standalone user value. Stories are sized for a single developer session and contain no forward dependencies.

---

## Requirements Inventory

### Functional Requirements

FR1: Admin can register with email and password
FR2: Registered users can log in and receive a JWT access token and refresh token
FR3: Users can refresh their session without re-entering credentials
FR4: Admin can invite a guest user (read-only role)
FR5: Users can log out, invalidating the current refresh token
FR6: Admin can request a password-reset magic link via email
FR7: New users must verify their email address before accessing protected routes
FR8: Users can mark a device as trusted for extended session duration
FR9: Admin can register a new thermostat device with a name and location
FR10: Admin can assign a device to a named room
FR11: Admin can view a list of all registered devices and their online/offline status
FR12: Admin can decommission (remove) a device
FR13: Admin can configure min/max safety temperature thresholds per device
FR14: Any authenticated user can view the current temperature for each device in real time
FR15: Any authenticated user can view current humidity for each device
FR16: Any authenticated user can see whether a device is actively heating or cooling
FR17: Any authenticated user can view a temperature history chart for a configurable time range (1 day / 7 days / 30 days)
FR18: The system marks a device as offline when heartbeats are missed and notifies the Admin
FR19: Admin can set a target temperature for a device
FR20: Admin can set a hold duration for a manual temperature override (1 h / 3 h / until next schedule slot)
FR21: Admin can switch a device between heating, cooling, and auto modes
FR22: The system enforces configured safety thresholds, rejecting target temperatures outside the allowed range
FR23: Admin can create a weekly heating/cooling schedule per device (day-of-week, from/to time, target temperature)
FR24: Admin can edit or delete individual schedule slots
FR25: The schedule is stored and synced to the device so it runs autonomously without a network connection
FR26: Admin can manually activate and deactivate Away mode for a device
FR27: While Away mode is active, the schedule is suspended and a configurable away setpoint is applied
FR28: Admin can configure geo-fence-based automatic Away mode trigger (Phase 3 — deferred)
FR29: Admin receives a push notification when a device reaches its target temperature
FR30: Admin receives a push notification when a temperature anomaly is detected
FR31: Admin receives an in-app alert when a device goes offline
FR32: The system accepts temperature and humidity readings from either the simulation script or an MQTT-connected Arduino without backend code changes
FR33: The system maintains a Device Shadow with `desired` and `reported` state per device
FR34: The system queues commands for a device and delivers them reliably, including across temporary disconnects
FR35: The Arduino can acknowledge received commands, updating the Device Shadow `reported` state
FR36: The system generates and stores hourly aggregate temperature readings for chart performance
FR37: Admin can export temperature history for a selected device and date range (Phase 2 — deferred)
FR38: The dashboard displays today's total heating runtime as a summary widget

### Non-Functional Requirements

NFR1: Dashboard initial load renders all widgets in < 3 s on a standard broadband connection
NFR2: WebSocket temperature update latency (sensor post → browser render) < 5 s end-to-end
NFR3: History chart query (30-day aggregated view) completes in < 2 s
NFR4: REST API endpoints respond in < 500 ms p95 under single-household load
NFR5: Passwords stored as bcrypt hashes, cost factor 12; never logged or transmitted in plaintext
NFR6: JWT access tokens expire in 15 minutes; refresh tokens rotated on each use and blacklisted on logout (Redis)
NFR7: All API endpoints enforce role checks; Guest tokens rejected with HTTP 403 on any write operation
NFR8: WebSocket connections validate JWT on the initial handshake; unauthenticated connections refused
NFR9: Internal device ingestion endpoint requires `x-device-secret` header, not a user JWT
NFR10: All data in transit over HTTPS/WSS; MongoDB Atlas connection over TLS
NFR11: Environment variables validated with Zod at startup; process exits if required vars are missing
NFR12: Simulator crash does not affect API server or WebSocket connections
NFR13: Device Shadow persists in MongoDB; browser refresh restores full state without data loss
NFR14: `SensorAdapter` interface isolates all sensor-source logic; swap via env var, zero app code changes
NFR15: All timestamps stored as UTC in MongoDB; `date-fns-tz` used exclusively for display

### Additional Requirements

**From Architecture:**
- Monorepo with npm workspaces: `/client` (React + Vite), `/server` (Express 5 + TypeScript), `/simulator`
- `server/src/config/env.ts` Zod schema validates all env vars at startup
- Redis required for refresh token blacklist from day one
- `SensorAdapter` interface (`start()`, `stop()`) — factory selects implementation from `SENSOR_ADAPTER` env var
- Device Shadow embedded in Device document: `shadow.desired` and `shadow.reported`
- Two MongoDB collections for readings: `tempReadings` (raw) and `tempReadingsHourly` (aggregated)
- Seed script: `server/src/scripts/seed.ts` — 30 days of readings + one admin user + one device
- Route → Controller → Service → Model is the mandatory call chain
- Socket.io rooms keyed as `device:<deviceId>`

**From UX Design:**
- Mobile-first responsive layout (bottom nav mobile, sidebar desktop)
- Minimum 44 × 44 px touch targets on all interactive elements
- WCAG 2.1 AA compliance — colour contrast, keyboard navigation, ARIA roles
- Optimistic UI updates on all mutations — toast on error, no blocking modals
- `prefers-reduced-motion` respected — animations disabled on request
- `TempGauge` component: `role="meter"`, `aria-live="polite"` for screen reader announcements (max once per 30 s)
- Tabular numerals for temperature displays to prevent layout shift
- Thermal CSS custom property `--temp-hue` (0 = hot red → 220 = cold blue) driven from `shadow.reported.temp`

### FR Coverage Map

FR1: Epic 1 — User registration
FR2: Epic 1 — User login, JWT issuance
FR3: Epic 1 — Token refresh endpoint
FR4: Epic 1 — Guest invitation
FR5: Epic 1 — Logout + token blacklist
FR6: Epic 9 — Password reset magic link
FR7: Epic 9 — Email verification
FR8: Epic 9 — Remember this device
FR9: Epic 2 — Device registration
FR10: Epic 2 — Room management, device assignment
FR11: Epic 2 — Device list with status
FR12: Epic 2 — Device decommission
FR13: Epic 2 — Safety thresholds configuration
FR14: Epic 3 — Live temperature display
FR15: Epic 3 — Live humidity display
FR16: Epic 3 — Heating/cooling indicator
FR17: Epic 4 — History chart UI
FR18: Epic 3 — Heartbeat monitoring + offline detection
FR19: Epic 5 — Target temperature slider
FR20: Epic 7 — Hold duration override
FR21: Epic 5 — Heating/cooling/auto mode toggle
FR22: Epic 5 — Safety threshold enforcement
FR23: Epic 6 — Schedule creation
FR24: Epic 6 — Schedule edit and delete
FR25: Epic 6 — Schedule sync to device
FR26: Epic 7 — Away mode toggle
FR27: Epic 7 — Away setpoint + schedule suspension
FR28: Deferred (Phase 3 geo-fence)
FR29: Epic 8 — Push notification: target reached
FR30: Epic 8 — Push notification: anomaly
FR31: Epic 8 — In-app alert: device offline
FR32: Epic 3 (simulator path) / Epic 10 (MQTT path) — SensorAdapter
FR33: Epic 3 — Device Shadow setup
FR34: Epic 5 — Command queue
FR35: Epic 5 — Arduino ACK → shadow.reported
FR36: Epic 4 — Hourly aggregation
FR37: Deferred (Phase 2 export)
FR38: Epic 4 — Heating runtime widget

---

## Epic List

### Epic 1: Authentication & User Management
Users can register, log in, manage sessions, and invite guests — the foundation all other epics build on.
**FRs covered:** FR1, FR2, FR3, FR4, FR5

### Epic 2: Device & Room Management
Admin can register thermostat devices, organise them into rooms, and configure safety thresholds.
**FRs covered:** FR9, FR10, FR11, FR12, FR13

### Epic 3: Live Temperature Feed
Any logged-in user can see current temperature and humidity updating in real time, and know when a device goes offline.
**FRs covered:** FR14, FR15, FR16, FR18, FR32 (simulator path), FR33

### Epic 4: Temperature History & Reporting
Users can explore historical temperature charts and see today's heating runtime at a glance.
**FRs covered:** FR17, FR36, FR38

### Epic 5: Temperature Control
Admin can set a target temperature, choose a mode, and trust that commands are reliably delivered to the device with visible feedback.
**FRs covered:** FR19, FR20, FR21, FR22, FR34, FR35

### Epic 6: Weekly Scheduling
Admin can build a weekly heating schedule per device that the device follows autonomously.
**FRs covered:** FR23, FR24, FR25

### Epic 7: Away Mode & Boost
Admin can override the schedule for away periods or short boost holds, restoring normal operation on demand.
**FRs covered:** FR20, FR26, FR27

### Epic 8: Notifications & Alerts
Admin receives in-app and push notifications for temperature targets, anomalies, and offline devices.
**FRs covered:** FR29, FR30, FR31

### Epic 9: Auth Enhancements
Users can verify email, reset passwords, and stay logged in on trusted devices.
**FRs covered:** FR6, FR7, FR8

### Epic 10: MQTT & Real Hardware
The backend connects to a real Arduino via MQTT with zero changes to business logic, replacing the simulator transparently.
**FRs covered:** FR32 (MQTT path), FR34, FR35 (MQTT variants)

---

## Epic 1: Authentication & User Management

Users can register, log in, refresh sessions, invite guests, and log out. All subsequent epics require a valid session.

### Story 1.1: Monorepo & Server Foundation

As a developer,
I want the monorepo scaffolded with server, client, and simulator packages, a working Express server, MongoDB connection, Redis connection, and Zod env validation,
So that all subsequent stories have a solid, validated foundation to build on.

**Acceptance Criteria:**

**Given** the repo is cloned and `.env` is populated from `.env.example`
**When** `npm run dev` is run in `/server`
**Then** the Express server starts on `PORT`, connects to MongoDB Atlas, connects to Redis, and logs "Server running on port X"
**And** if any required env var is missing, the process exits with a descriptive error before binding to any port

**Given** `.env.example` exists at repo root
**When** a developer reads it
**Then** all required env vars are documented with descriptions and example values

**Given** the monorepo has `/client`, `/server`, and `/simulator` directories
**When** `npm install` is run at the repo root
**Then** all workspace dependencies are installed and each package resolves its own dependencies correctly

---

### Story 1.2: User Registration

As an Admin,
I want to register with my email and password,
So that I have a personal account with full control over my thermostat.

**Acceptance Criteria:**

**Given** a valid email and password (≥ 8 chars) are submitted to `POST /api/v1/auth/register`
**When** the request is processed
**Then** a new User document is created with `role: 'admin'`, `emailVerified: false`, and a bcrypt hash (cost 12) — never the plaintext password
**And** the response is `201` with `{ data: { message: "Registration successful" } }`

**Given** the same email is submitted a second time
**When** the request is processed
**Then** the response is `409` with `{ error: { code: "EMAIL_ALREADY_EXISTS", message: "..." } }`

**Given** a password shorter than 8 characters is submitted
**When** the Zod validator runs
**Then** the response is `400` with `{ error: { code: "VALIDATION_ERROR", details: [...] } }`

**Given** registration succeeds
**When** the database is inspected
**Then** no plaintext password exists anywhere in the User document or server logs

---

### Story 1.3: User Login with JWT + Refresh Token

As a registered user,
I want to log in with my email and password,
So that I receive a short-lived access token and a secure refresh token.

**Acceptance Criteria:**

**Given** valid credentials are submitted to `POST /api/v1/auth/login`
**When** bcrypt comparison succeeds
**Then** the response is `200` with `{ data: { accessToken: "<JWT>" } }` and an `HttpOnly; Secure; SameSite=Strict` cookie containing the refresh token (7-day expiry)
**And** the access token is a valid JWT signed with `JWT_ACCESS_SECRET`, expiring in 15 minutes, containing `{ userId, role }`

**Given** an incorrect password is submitted
**When** the request is processed
**Then** the response is `401` with `{ error: { code: "INVALID_CREDENTIALS" } }` — same message for wrong email or wrong password (no enumeration)

**Given** the access token is decoded
**When** it is checked
**Then** it expires exactly 15 minutes from issuance and contains `userId` and `role` claims

---

### Story 1.4: Token Refresh

As an authenticated user,
I want my session to refresh silently,
So that I stay logged in without re-entering credentials.

**Acceptance Criteria:**

**Given** a valid refresh token cookie is sent to `POST /api/v1/auth/refresh`
**When** the token is verified and not on the Redis blacklist
**Then** the response is `200` with a new `accessToken` and a new refresh token cookie (rotation)
**And** the old refresh token is added to the Redis blacklist with TTL equal to its remaining expiry

**Given** a refresh token that was previously used (stolen + replayed)
**When** the same token is sent again
**Then** the response is `401` with `{ error: { code: "TOKEN_REUSE_DETECTED" } }` — the token is already on the blacklist

**Given** an expired refresh token cookie
**When** the request is processed
**Then** the response is `401`, prompting re-login

---

### Story 1.5: Role Guard Middleware

As a system,
I want all protected routes to enforce role-based access,
So that Guests cannot perform write operations and unauthenticated users are rejected.

**Acceptance Criteria:**

**Given** a request with a valid admin JWT to a write endpoint (e.g., `PATCH /api/v1/devices/:id/settings`)
**When** `requireRole('admin')` middleware runs
**Then** the request proceeds to the controller

**Given** a request with a valid guest JWT to the same write endpoint
**When** `requireRole('admin')` middleware runs
**Then** the response is `403` with `{ error: { code: "FORBIDDEN" } }`

**Given** a request with no Authorization header to any protected endpoint
**When** `verifyJwt` middleware runs
**Then** the response is `401` with `{ error: { code: "UNAUTHORIZED" } }`

**Given** an expired access token is sent
**When** `verifyJwt` middleware runs
**Then** the response is `401` with `{ error: { code: "TOKEN_EXPIRED" } }`

---

### Story 1.6: User Logout

As an authenticated user,
I want to log out,
So that my refresh token is immediately invalidated.

**Acceptance Criteria:**

**Given** a valid refresh token cookie and a valid access token are sent to `POST /api/v1/auth/logout`
**When** the request is processed
**Then** the response is `200`, the refresh token is added to the Redis blacklist, and the cookie is cleared (`Max-Age=0`)

**Given** the blacklisted refresh token is sent to `POST /api/v1/auth/refresh` after logout
**When** the request is processed
**Then** the response is `401` — the token cannot be reused

---

### Story 1.7: Guest User Invitation

As an Admin,
I want to create a Guest account with a temporary password,
So that family members can view the thermostat dashboard without being able to change settings.

**Acceptance Criteria:**

**Given** an Admin sends `POST /api/v1/auth/register` with `{ email, password, role: 'guest' }` using their admin JWT
**When** the request is processed
**Then** a User document is created with `role: 'guest'`
**And** the response is `201`

**Given** a non-admin user attempts to create another user
**When** `requireRole('admin')` runs
**Then** the response is `403`

**Given** a Guest user logs in and sends `PATCH /api/v1/devices/:id/settings`
**When** the role guard runs
**Then** the response is `403` — guests cannot write

---

## Epic 2: Device & Room Management

Admin can register devices, group them into rooms, configure thresholds, and remove them. One device is seeded on first run so the app is immediately usable.

### Story 2.1: Device Registration & Seed

As an Admin,
I want to register a new thermostat device with a name and seed one device automatically on first run,
So that the dashboard has a device to display from the moment the server starts.

**Acceptance Criteria:**

**Given** an Admin sends `POST /api/v1/devices` with `{ name: "Living Room", room: "<roomId>" }`
**When** the request is processed
**Then** a Device document is created with `status: 'offline'`, `shadow.desired: { temp: 20, mode: 'heat', awayMode: false }`, `shadow.reported: { temp: null, mode: 'heat', awayMode: false }`, `thresholds: { min: 10, max: 30 }`
**And** the response is `201` with the created device document

**Given** `npm run seed` is run in `/server`
**When** the seed script executes
**Then** exactly one admin user (if none exists) and one device (if none exists) are created
**And** the script is idempotent — running it twice does not create duplicates

---

### Story 2.2: Room Management

As an Admin,
I want to create rooms and assign devices to them,
So that devices are organised by physical location.

**Acceptance Criteria:**

**Given** an Admin sends `POST /api/v1/rooms` with `{ name: "Living Room" }`
**When** the request is processed
**Then** a Room document is created and the response is `201` with the room object

**Given** a Device exists and an Admin sends `PATCH /api/v1/devices/:id/settings` with `{ room: "<roomId>" }`
**When** the request is processed
**Then** `device.room` is updated and the response is `200`

**Given** a Guest user sends `POST /api/v1/rooms`
**When** the role guard runs
**Then** the response is `403`

---

### Story 2.3: Device List with Status

As any authenticated user,
I want to see all registered devices with their current online/offline status,
So that I know which devices are reachable.

**Acceptance Criteria:**

**Given** an authenticated user sends `GET /api/v1/devices`
**When** the request is processed
**Then** the response is `200` with `{ data: [{ id, name, room, status, lastSeen, shadow }] }`

**Given** a device has `status: 'offline'`
**When** the device list renders in the UI
**Then** the DeviceCard shows a red "Offline" badge and the last-seen timestamp
**And** the TempGauge for that device shows a greyed-out arc with "Offline" label

---

### Story 2.4: Device Settings & Safety Thresholds

As an Admin,
I want to configure safety thresholds (min/max temperature) for a device,
So that the system never sets a dangerous temperature.

**Acceptance Criteria:**

**Given** an Admin sends `PATCH /api/v1/devices/:id/settings` with `{ thresholds: { min: 10, max: 28 } }`
**When** the request is processed
**Then** `device.thresholds` is updated and the response is `200`

**Given** a `GET /api/v1/devices/:id` request
**When** the response is returned
**Then** it includes `thresholds.min` and `thresholds.max`

---

### Story 2.5: Device Decommission

As an Admin,
I want to remove a device from the system,
So that the device list stays clean when hardware is retired.

**Acceptance Criteria:**

**Given** an Admin sends `DELETE /api/v1/devices/:id`
**When** the request is processed
**Then** the device document is deleted and the response is `204`
**And** any associated schedules and events for that device are also deleted

**Given** a Guest user sends `DELETE /api/v1/devices/:id`
**When** the role guard runs
**Then** the response is `403`

**Given** a non-existent device ID is sent
**When** the request is processed
**Then** the response is `404` with `{ error: { code: "DEVICE_NOT_FOUND" } }`

---

## Epic 3: Live Temperature Feed

Any logged-in user can see the current temperature and humidity updating live, and the system automatically detects when a device goes offline.

### Story 3.1: Simulator Script

As a developer without hardware,
I want a Node simulator that posts realistic temperature readings every 30 seconds,
So that the full live-data flow can be developed and tested before the Arduino arrives.

**Acceptance Criteria:**

**Given** the simulator is started with valid `DEVICE_ID`, `DEVICE_SECRET`, and `API_URL` env vars
**When** it runs
**Then** it posts `{ deviceId, temp, humidity }` to `POST /internal/readings` every 30 seconds
**And** temperature follows a day/night sin curve (`BASE_TEMP + sin((hour−6)×π/12)×3 ± noise`)
**And** humidity is fixed at 55 for MVP

**Given** the API server is unreachable
**When** the simulator posts a reading
**Then** the error is logged and the simulator continues running — it does not crash

**Given** the simulator process is stopped
**When** the API server is checked
**Then** it continues serving existing data without error

---

### Story 3.2: Sensor Ingestion Endpoint & SensorAdapter

As the system,
I want a `SensorAdapter` interface and a `SimulatorAdapter` that accepts readings via `POST /internal/readings`,
So that sensor data reaches the database regardless of its source.

**Acceptance Criteria:**

**Given** a POST to `/internal/readings` with `{ deviceId, temp, humidity }` and a valid `x-device-secret` header
**When** the request is processed
**Then** a `TempReading` document is persisted and the response is `201`

**Given** the `x-device-secret` header is missing or incorrect
**When** the request is processed
**Then** the response is `401` — user JWTs are not accepted on this endpoint

**Given** `SENSOR_ADAPTER=simulator` in `.env`
**When** the server starts
**Then** `SimulatorAdapter` is instantiated; no MQTT connection is attempted

**Given** `SENSOR_ADAPTER=mqtt` in `.env`
**When** the server starts
**Then** `MqttAdapter` is instantiated; no HTTP ingestion endpoint is needed for MQTT readings

---

### Story 3.3: Device Shadow Setup

As the system,
I want a Device Shadow (`desired` / `reported`) persisted in MongoDB,
So that the UI always knows both the user's intent and the device's actual state.

**Acceptance Criteria:**

**Given** a Device document is created
**When** inspected in MongoDB
**Then** it contains `shadow: { desired: { temp, mode, awayMode }, reported: { temp: null, mode, awayMode, updatedAt } }`

**Given** a new TempReading is ingested
**When** `ReadingService.ingest()` runs
**Then** `shadow.reported.temp` is updated to the latest reading value and `updatedAt` is set

**Given** the browser refreshes after a WebSocket reconnect
**When** `GET /api/v1/devices/:id` is called
**Then** the full shadow state is returned — no state is lost between sessions

---

### Story 3.4: Socket.io Server with JWT Auth

As an authenticated user,
I want a WebSocket connection that validates my JWT on handshake,
So that only authenticated users receive live device data.

**Acceptance Criteria:**

**Given** a Socket.io client connects with a valid JWT in the handshake auth
**When** the server processes the connection
**Then** the socket is accepted and the user's `userId` and `role` are attached to the socket

**Given** a Socket.io client connects without a JWT or with an expired JWT
**When** the server processes the connection
**Then** the connection is immediately disconnected with an error event

**Given** an authenticated client emits `join` with `{ deviceId }`
**When** the server processes the event
**Then** the socket is added to room `device:<deviceId>` and begins receiving events for that device

---

### Story 3.5: Live Temperature Dashboard Widget

As any authenticated user,
I want to see the current temperature and humidity update live on the dashboard,
So that I always know what my home temperature is right now.

**Acceptance Criteria:**

**Given** the user is on the dashboard and a new reading arrives via WebSocket
**When** the `reading:new` event fires
**Then** the `TempGauge` number animates to the new temperature within 300 ms
**And** the thermal hue (`--temp-hue`) transitions smoothly to the new value
**And** the humidity label updates

**Given** the user navigates away and back to the dashboard
**When** the page loads
**Then** the last known temperature is shown immediately from React Query cache, before the WebSocket connection is established

**Given** the device has `shadow.desired.temp ≠ shadow.reported.temp`
**When** the TempGauge renders
**Then** a "syncing" ring orbits the gauge indicating a pending command

**Given** a screen reader user focuses the gauge
**When** the temperature updates
**Then** the `aria-live="polite"` region announces the new value — at most once every 30 seconds

---

### Story 3.6: Heartbeat Monitoring & Offline Detection

As an Admin,
I want to know immediately when a device stops responding,
So that I can investigate before my home gets too cold.

**Acceptance Criteria:**

**Given** a device posts a reading (heartbeat) normally every 30–60 seconds
**When** no reading has been received for 180 seconds (3 missed cycles)
**Then** the device `status` is set to `'offline'` and `device:status` is emitted via WebSocket to all clients in `device:<deviceId>` room

**Given** the device comes back online and posts a reading
**When** the reading is ingested
**Then** `device.status` is set to `'online'` and `device:status` is emitted again

**Given** a device goes offline
**When** the dashboard is open
**Then** the DeviceCard badge changes to red "Offline" without a page refresh (FR31 in-app alert)

---

## Epic 4: Temperature History & Reporting

Users can view historical temperature charts across 1-day, 7-day, and 30-day ranges, and see today's heating runtime on the dashboard.

### Story 4.1: Temperature History API

As any authenticated user,
I want to query historical temperature readings for a device within a date range,
So that the chart UI has data to display.

**Acceptance Criteria:**

**Given** `GET /api/v1/readings/:deviceId?from=<ISO>&to=<ISO>` with a valid JWT
**When** the date range spans ≤ 48 hours
**Then** the response returns raw `TempReading` documents in ascending timestamp order

**Given** the date range spans > 48 hours
**When** the request is processed
**Then** the response returns hourly aggregated documents from `TempReadingHourly` instead of raw readings

**Given** no readings exist for the given range
**When** the request is processed
**Then** the response is `200` with `{ data: [] }` — not a 404

**Given** a request for a deviceId the user does not own (wrong user)
**When** the request is processed
**Then** the response is `403`

---

### Story 4.2: Hourly Aggregation Pipeline

As the system,
I want hourly temperature aggregates computed and stored automatically,
So that 30-day chart queries complete in < 2 seconds.

**Acceptance Criteria:**

**Given** a new `TempReading` is ingested
**When** `ReadingService.ingest()` runs
**Then** the corresponding `TempReadingHourly` bucket for that device and hour is upserted with updated `avgTemp`, `minTemp`, `maxTemp`

**Given** an hourly bucket already exists for `deviceId` + `hour`
**When** a new reading arrives within the same hour
**Then** `avgTemp`, `minTemp`, `maxTemp` are recalculated using the running count (no full re-scan)

**Given** a `GET /api/v1/readings/:deviceId?from=<30-days-ago>&to=<now>` request
**When** the query runs
**Then** it uses only the `TempReadingHourly` collection — the raw `TempReading` collection is never scanned
**And** the response arrives in < 2 s

---

### Story 4.3: Seed Historical Data

As a developer,
I want the seed script to generate 30 days of synthetic temperature readings,
So that the history chart is populated immediately on first run without waiting for live data.

**Acceptance Criteria:**

**Given** `npm run seed` is executed with no existing readings
**When** the seed script completes
**Then** `TempReading` documents exist for the seeded device covering the past 30 days at 30-second intervals
**And** corresponding `TempReadingHourly` aggregates are also populated

**Given** the seed is run again when readings already exist
**When** the script checks for existing data
**Then** it skips seeding readings — no duplicate documents are created

---

### Story 4.4: Temperature History Chart UI

As any authenticated user,
I want to view a temperature chart with 1-day, 7-day, and 30-day range options,
So that I can understand my home's temperature patterns.

**Acceptance Criteria:**

**Given** the user opens the History page
**When** the chart loads
**Then** the default view shows the last 7 days of hourly average temperatures as a Recharts area chart
**And** X-axis timestamps are displayed in the user's local timezone (via `date-fns-tz`)

**Given** the user selects the "30 days" range tab
**When** the query fires
**Then** the chart re-renders with daily aggregated data (24-hour buckets) and the query completes in < 2 s

**Given** no data exists for the selected range (new device)
**When** the chart renders
**Then** an empty state message is shown: "No data yet — readings will appear here once the device is active"

**Given** the user hovers over a data point
**When** the Recharts tooltip renders
**Then** it shows the exact temperature, humidity, and formatted local time

---

### Story 4.5: Heating Runtime Widget

As any authenticated user,
I want to see today's total heating runtime on the dashboard,
So that I can understand my energy usage at a glance.

**Acceptance Criteria:**

**Given** the dashboard loads
**When** the `HeatingRuntimeWidget` renders
**Then** it shows today's total minutes/hours that `device.isHeating` was `true`, formatted as "Xh Ym"

**Given** no heating events exist for today
**When** the widget renders
**Then** it shows "0m today" — not an error or empty state

**Given** the device is currently heating
**When** the widget updates via WebSocket
**Then** the runtime counter increments in real time

---

## Epic 5: Temperature Control

Admin can set a target temperature, choose a heating mode, and trust that commands are reliably queued and acknowledged by the device.

### Story 5.1: Target Temperature Slider

As an Admin,
I want to drag a slider to set my target temperature,
So that the house heats or cools toward my chosen temperature.

**Acceptance Criteria:**

**Given** the Admin drags the `TargetSlider` to a new value
**When** the drag ends
**Then** `PATCH /api/v1/devices/:id/settings` fires immediately with `{ desired: { temp: <value> } }`
**And** the UI updates optimistically — the slider label shows the new value before the server responds

**Given** the server responds successfully
**When** the response arrives
**Then** `shadow.desired.temp` is updated in MongoDB and a `device:shadow` event is emitted via WebSocket

**Given** the server returns an error
**When** the response arrives
**Then** the slider animates back to the previous value and a toast reads "Failed to update — tap to retry"

**Given** a Guest user views the dashboard
**When** the TargetSlider renders
**Then** it is displayed as a read-only bar showing `shadow.desired.temp` — no drag handle rendered

---

### Story 5.2: Command Queue

As the system,
I want device commands enqueued in MongoDB and delivered reliably,
So that a command sent while the device is temporarily offline is not lost.

**Acceptance Criteria:**

**Given** an Admin sets a new target temperature
**When** `CommandService.enqueue()` runs
**Then** a command document `{ deviceId, type: 'set-temp', value, status: 'pending', createdAt }` is persisted

**Given** the device is online and polled
**When** the command is delivered
**Then** `command.status` is updated to `'delivered'`

**Given** the device goes offline before delivery
**When** the device reconnects
**Then** all pending commands are re-delivered in order — no command is silently dropped

---

### Story 5.3: Command Acknowledgement & Shadow Update

As an Admin,
I want to see the "syncing" indicator clear when the device confirms a temperature change,
So that I know my command was actually applied.

**Acceptance Criteria:**

**Given** the Arduino (or simulator) ACKs a command via `command:ack` WebSocket event
**When** `CommandService.ack()` processes it
**Then** `shadow.reported.temp` is updated in MongoDB and `device:shadow` is emitted via WebSocket

**Given** the browser receives `device:shadow`
**When** `desired.temp === reported.temp`
**Then** the syncing ring stops animating on the TempGauge

**Given** no ACK arrives within 10 seconds of command delivery
**When** the timeout fires
**Then** a toast appears: "Device not responding — command may be queued"

---

### Story 5.4: Heating / Cooling / Auto Mode Toggle

As an Admin,
I want to switch the device between heating, cooling, and auto modes,
So that the system responds correctly to seasonal changes.

**Acceptance Criteria:**

**Given** the Admin selects "cooling" from the mode toggle
**When** `PATCH /api/v1/devices/:id/settings` fires with `{ desired: { mode: 'cool' } }`
**Then** `shadow.desired.mode` is updated and the command is enqueued

**Given** the device operates in cooling mode
**When** a new reading arrives and `reported.temp > desired.temp`
**Then** `device.isHeating` is set to `false` and the cooling indicator is visible in the UI

**Given** the mode is set to "auto"
**When** the system evaluates temperature
**Then** it heats when `reported.temp < desired.temp - 0.5` and cools when `reported.temp > desired.temp + 0.5`

---

### Story 5.5: Safety Threshold Enforcement

As the system,
I want to reject target temperatures outside the configured safety thresholds,
So that a user cannot accidentally freeze or overheat their home.

**Acceptance Criteria:**

**Given** an Admin sets a target temperature below `device.thresholds.min`
**When** `DeviceService.updateShadowDesired()` validates the request
**Then** the response is `400` with `{ error: { code: "TEMP_BELOW_MINIMUM", message: "Target temperature cannot be below 10 °C" } }`

**Given** the target temperature is within thresholds
**When** the same service runs
**Then** the update proceeds normally

**Given** the TargetSlider in the UI renders
**When** it initialises
**Then** its `min` and `max` props are set to `device.thresholds.min` and `device.thresholds.max` — the slider physically cannot be dragged outside safe range

---

## Epic 6: Weekly Scheduling

Admin can define a weekly schedule per device — the device follows it autonomously even without network connectivity.

### Story 6.1: Schedule API

As an Admin,
I want to retrieve and save a full weekly schedule for a device via REST,
So that the schedule builder UI has a backend to persist changes.

**Acceptance Criteria:**

**Given** `GET /api/v1/schedules/:deviceId` with a valid JWT
**When** the request is processed
**Then** the response is `200` with the Schedule document `{ deviceId, slots: [{ day, from, to, targetTemp }] }`

**Given** `PUT /api/v1/schedules/:deviceId` with a valid slots array
**When** the request is processed
**Then** the Schedule document is replaced (full replace, not patch) and the response is `200`
**And** `CommandService.enqueue({ type: 'sync-schedule', payload: slots })` is called

**Given** a slot has `from` equal to or after `to`
**When** the Zod validator runs
**Then** the response is `400` with `{ error: { code: "INVALID_SLOT", message: "from must be before to" } }`

---

### Story 6.2: Schedule Builder UI

As an Admin,
I want to build my weekly schedule by dragging on a visual calendar grid,
So that creating a schedule is faster and more intuitive than filling in a form.

**Acceptance Criteria:**

**Given** the Admin opens the Schedule page
**When** the `ScheduleGrid` renders
**Then** a 7-column (days) × 24-row (hours) CSS grid is displayed with existing slots shown as coloured blocks

**Given** the Admin drags across a time range on the grid
**When** the drag ends
**Then** a slot creation dialog opens with `from` and `to` pre-filled from the drag selection

**Given** the dialog is submitted with a valid `targetTemp`
**When** the slot is saved
**Then** the new block appears on the grid and `PUT /api/v1/schedules/:deviceId` fires in the background

**Given** two slots overlap on the same day
**When** the grid renders
**Then** the overlapping slot is highlighted in red with an "Overlapping slots" tooltip

---

### Story 6.3: Schedule Slot Edit & Delete

As an Admin,
I want to edit or delete individual schedule slots,
So that I can adjust the schedule without rebuilding it from scratch.

**Acceptance Criteria:**

**Given** the Admin clicks an existing slot on the grid
**When** the slot editor dialog opens
**Then** all slot fields (day, from, to, targetTemp) are pre-populated for editing

**Given** the Admin saves changes in the editor
**When** the dialog is submitted
**Then** the slot is updated in local state and `PUT /api/v1/schedules/:deviceId` fires with the updated slots array

**Given** the Admin clicks the delete icon on a slot
**When** the slot is deleted
**Then** it is removed from the grid and the schedule is saved — a toast confirms "Schedule saved and synced"

---

### Story 6.4: Schedule Sync Confirmation

As an Admin,
I want to see confirmation that the schedule was synced to the device,
So that I know the device will follow the new schedule even if it loses connectivity.

**Acceptance Criteria:**

**Given** `PUT /api/v1/schedules/:deviceId` succeeds and the command is enqueued
**When** the server responds
**Then** a toast appears: "Schedule saved and synced to device"

**Given** the device ACKs the `sync-schedule` command
**When** the ACK arrives via WebSocket
**Then** the Schedule page shows a "Synced" status badge next to the device name

**Given** the device is offline when the schedule is saved
**When** the device reconnects
**Then** the pending `sync-schedule` command is delivered and ACKed — no user action required

---

## Epic 7: Away Mode & Boost

Admin can suspend the schedule for away periods or short manual overrides without rebuilding the schedule.

### Story 7.1: Away Mode Toggle

As an Admin,
I want to activate Away mode with a single tap,
So that the heating drops to a frost-protection setpoint when I leave the house.

**Acceptance Criteria:**

**Given** the Admin taps the Away toggle on the dashboard
**When** `PATCH /api/v1/devices/:id/settings` fires with `{ desired: { awayMode: true } }`
**Then** `shadow.desired.awayMode` is set to `true` and a command is enqueued with the configured away setpoint (default 15 °C)

**Given** Away mode is activated
**When** the schedule engine evaluates the current slot
**Then** the schedule setpoint is ignored and the away setpoint (15 °C) is applied instead

**Given** the Admin taps Away again to deactivate
**When** the command is processed
**Then** `shadow.desired.awayMode` is set to `false` and normal schedule resumes

---

### Story 7.2: Away Mode Dashboard UX

As any authenticated user,
I want the dashboard to clearly communicate when Away mode is active,
So that I never wonder why the house is colder than expected.

**Acceptance Criteria:**

**Given** `shadow.desired.awayMode === true`
**When** the Dashboard renders
**Then** the entire dashboard header applies a blue-grey colour wash (`away` token)
**And** a persistent banner reads "Away mode — 15 °C until you return"

**Given** a Guest user views the dashboard during Away mode
**When** it renders
**Then** the Away banner is visible but no Away toggle is rendered

**Given** Away mode is deactivated
**When** the `device:shadow` WebSocket event arrives
**Then** the colour wash fades and the banner disappears without a page reload

---

### Story 7.3: Boost / Hold Duration Override

As an Admin,
I want to set a manual temperature hold for 1 hour, 3 hours, or until the next schedule slot,
So that I can temporarily raise the temperature without permanently changing the schedule.

**Acceptance Criteria:**

**Given** the Admin selects a hold duration (1h / 3h / until next slot) from the TargetSlider options
**When** the selection is confirmed
**Then** `PATCH /api/v1/devices/:id/settings` fires with `{ desired: { temp: <current_slider_value>, holdUntil: <ISO timestamp> } }`

**Given** the hold period expires
**When** the schedule engine evaluates the next reading
**Then** the scheduled setpoint for the current time slot is restored — the hold is automatically cleared

**Given** the Admin sets Away mode while a hold is active
**When** Away mode activates
**Then** the hold is suspended and the away setpoint applies — the hold resumes when Away mode ends

---

## Epic 8: Notifications & Alerts

Admin receives timely in-app and push notifications for the events that matter — target reached, anomaly detected, device offline.

### Story 8.1: In-App Device Offline Alert

As an Admin,
I want an in-app alert banner when a device goes offline,
So that I can investigate before the temperature drops to an uncomfortable level.

**Acceptance Criteria:**

**Given** a device transitions to `status: 'offline'`
**When** `device:status` is received via WebSocket
**Then** an alert banner appears on the device card: "Device offline — last seen [timestamp]" in red

**Given** the device comes back online
**When** `device:status` with `status: 'online'` arrives
**Then** the alert banner disappears without user action

**Given** the user is not on the dashboard when the device goes offline
**When** they next open the app
**Then** the offline banner is displayed based on the current device status from the initial `GET /api/v1/devices` response

---

### Story 8.2: Anomaly Detection

As the system,
I want to detect temperature spikes or drops beyond configured thresholds,
So that unusual events can be surfaced to the Admin.

**Acceptance Criteria:**

**Given** a new `TempReading` is ingested with `temp > device.thresholds.max` or `temp < device.thresholds.min`
**When** `ReadingService.ingest()` runs
**Then** an `Event` document is created with `type: 'anomaly'` and `payload: { temp, threshold, direction }`
**And** `device:alert` is emitted via WebSocket to all clients in `device:<deviceId>`

**Given** the browser receives `device:alert`
**When** the dashboard renders
**Then** a persistent alert banner appears: "Temperature spike detected — [temp] °C — tap for history"
**And** tapping the banner navigates to the History page with the anomaly timestamp highlighted

---

### Story 8.3: Web Push Subscription

As an Admin,
I want to opt into push notifications from within the app,
So that I'm alerted even when the app is closed.

**Acceptance Criteria:**

**Given** the Admin opens the dashboard for the first time
**When** the push prompt card renders
**Then** an in-app card (not a browser modal) asks "Enable push notifications?" with Accept / Later options

**Given** the Admin taps Accept
**When** the browser permission dialog is confirmed
**Then** the Push subscription is saved to the User document in MongoDB via `POST /api/v1/users/push-subscription`

**Given** the Admin taps Later
**When** the prompt is dismissed
**Then** it is not shown again for 7 days (stored in `localStorage`)

---

### Story 8.4: Push Notification Delivery

As an Admin,
I want push notifications delivered to my phone for target reached and anomaly events,
So that I'm informed without needing to check the app.

**Acceptance Criteria:**

**Given** `shadow.reported.temp` reaches `shadow.desired.temp` (within ± 0.5 °C)
**When** `ReadingService.ingest()` detects the match
**Then** a Web Push notification is sent to all registered push subscriptions for the Admin: "Target temperature reached: [temp] °C"

**Given** an anomaly event is created (Story 8.2)
**When** `NotificationService.send()` runs
**Then** a Web Push notification is sent: "Temperature alert: [temp] °C — [device name]"

**Given** the Admin taps the push notification
**When** the app opens
**Then** the dashboard for the relevant device is shown directly — not the home screen

---

## Epic 9: Auth Enhancements & Trust

Users can verify email, reset a forgotten password, and stay logged in on trusted personal devices.

### Story 9.1: Email Verification

As a new user,
I want to verify my email address before accessing the app,
So that my account is tied to a real, recoverable email.

**Acceptance Criteria:**

**Given** a new user registers
**When** the registration completes
**Then** a verification email is sent with a signed token link (valid 24 hours)

**Given** the user clicks the verification link
**When** `GET /api/v1/auth/verify-email?token=<token>` is processed
**Then** `user.emailVerified` is set to `true` and the response redirects to the login page

**Given** an unverified user attempts to log in
**When** the login endpoint runs
**Then** the response is `403` with `{ error: { code: "EMAIL_NOT_VERIFIED", message: "Please verify your email" } }` and a "Resend verification" link

---

### Story 9.2: Password Reset via Magic Link

As a user who forgot their password,
I want to receive a magic link to reset it,
So that I can regain access without contacting support.

**Acceptance Criteria:**

**Given** the user submits their email to `POST /api/v1/auth/forgot-password`
**When** the email is found
**Then** a password-reset email is sent with a signed token link (valid 1 hour)
**And** the response is always `200` — same message whether the email exists or not (no enumeration)

**Given** the user clicks the reset link and submits a new password
**When** `POST /api/v1/auth/reset-password` is processed with a valid, unexpired token
**Then** the password is updated (bcrypt re-hashed) and all existing refresh tokens are invalidated

**Given** the token has expired or was already used
**When** the request is processed
**Then** the response is `400` with `{ error: { code: "INVALID_OR_EXPIRED_TOKEN" } }`

---

### Story 9.3: Remember This Device

As a frequent user,
I want to stay logged in on my personal devices without re-authenticating every 7 days,
So that checking the thermostat feels effortless.

**Acceptance Criteria:**

**Given** the user checks "Remember this device" on the login form
**When** login succeeds
**Then** the refresh token cookie is issued with a 30-day expiry instead of 7 days

**Given** the 30-day token is rotated on `POST /api/v1/auth/refresh`
**When** the new token is issued
**Then** it also has a 30-day expiry — the "remember me" state is preserved across rotations

**Given** the user logs out explicitly
**When** logout completes
**Then** the long-lived token is blacklisted — the "remember me" state is not a free pass to ignore logout

---

## Epic 10: MQTT & Real Hardware

The backend connects to the real Arduino via MQTT, replacing the simulator transparently. Zero business logic changes required.

### Story 10.1: MQTT Adapter

As the system,
I want an `MqttAdapter` that subscribes to Arduino MQTT topics and ingests readings through the same `ReadingService.ingest()` path as the simulator,
So that switching from simulator to hardware requires only an env var change.

**Acceptance Criteria:**

**Given** `SENSOR_ADAPTER=mqtt` and valid `MQTT_BROKER_URL` in `.env`
**When** the server starts
**Then** `MqttAdapter.start()` connects to the MQTT broker and subscribes to `devices/+/readings` and `devices/+/heartbeat`

**Given** the Arduino publishes `{ temp, humidity }` to `devices/<id>/readings`
**When** `MqttAdapter` receives the message
**Then** `ReadingService.ingest({ deviceId, temp, humidity })` is called — identical to the simulator path

**Given** `SENSOR_ADAPTER=simulator`
**When** the server starts
**Then** no MQTT connection is attempted and no MQTT env vars are required

---

### Story 10.2: Heartbeat via MQTT

As the system,
I want the Arduino's heartbeat published via MQTT to be processed by the existing offline detection logic,
So that heartbeat monitoring works identically regardless of sensor source.

**Acceptance Criteria:**

**Given** the Arduino publishes to `devices/<id>/heartbeat` every 60 seconds
**When** `MqttAdapter` receives the message
**Then** `DeviceService.recordHeartbeat(deviceId)` is called — the same function used in simulator mode

**Given** the Arduino stops publishing for 180 seconds
**When** the heartbeat check interval fires
**Then** `device.status` transitions to `'offline'` and `device:status` is emitted via WebSocket — identical behaviour to simulator offline detection

---

### Story 10.3: Command Delivery & ACK via MQTT

As the system,
I want pending commands delivered to the Arduino via MQTT and ACKs received back,
So that the Device Shadow is kept in sync with hardware state.

**Acceptance Criteria:**

**Given** a command is enqueued for a device
**When** `MqttAdapter` is active
**Then** the command is published to `devices/<id>/commands` as a JSON payload

**Given** the Arduino ACKs by publishing to `devices/<id>/ack`
**When** `MqttAdapter` receives the message
**Then** `CommandService.ack(commandId)` is called, `shadow.reported` is updated, and `command:ack` is emitted via WebSocket

**Given** the broker is temporarily unreachable
**When** the connection is restored
**Then** undelivered commands are re-published — no command is silently dropped

---

### Story 10.4: Environment-Based Adapter Switch

As a developer,
I want to switch between simulator and MQTT by changing a single env var,
So that I can develop without hardware and deploy with hardware using the same codebase.

**Acceptance Criteria:**

**Given** `SENSOR_ADAPTER=simulator` in `.env`
**When** the adapter factory runs in `adapters/index.ts`
**Then** `SimulatorAdapter` is instantiated and `MqttAdapter` is never imported or constructed

**Given** `SENSOR_ADAPTER=mqtt` in `.env`
**When** the adapter factory runs
**Then** `MqttAdapter` is instantiated; Zod validates that `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` are also present — process exits if missing

**Given** `SENSOR_ADAPTER=invalid-value` in `.env`
**When** the Zod env schema validates at startup
**Then** the process exits with "SENSOR_ADAPTER must be 'simulator' or 'mqtt'"

---

### Story 10.5: MQTT Broker Configuration

As a developer/operator,
I want clear documentation and Docker Compose setup for the local MQTT broker,
So that the full MQTT flow can be tested locally without a cloud broker.

**Acceptance Criteria:**

**Given** `docker compose up` is run at the repo root
**When** the MQTT service starts
**Then** Mosquitto is available on `localhost:1883` with no authentication required for local development

**Given** `MQTT_BROKER_URL=mqtt://<hivemq-cluster>` is set in the Railway environment
**When** `MqttAdapter` connects in production
**Then** TLS (`mqtts://`) and credentials (`MQTT_USERNAME`, `MQTT_PASSWORD`) are used automatically based on the URL scheme

**Given** the `.env.example` file is read
**When** a developer sets up the project
**Then** all MQTT-related env vars are documented with descriptions and example values for both local and HiveMQ configurations