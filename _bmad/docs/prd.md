---
stepsCompleted: ['discovery', 'vision', 'success', 'journeys', 'domain', 'innovation', 'project-type', 'scoping', 'functional', 'nonfunctional']
inputDocuments: ['_bmad/docs/brainstorm.md']
workflowType: 'prd'
---

# Product Requirements Document — Smart Thermostat Controller

**Author:** Project Owner
**Date:** 2026-03-03
**Version:** 1.0

---

## Executive Summary

A full-stack IoT thermostat web application for home use. The system provides real-time temperature monitoring and control via a React frontend, Node/Express backend, and MongoDB Atlas persistence. Socket.io delivers live sensor readings to the browser without polling. An Arduino with a BME280 sensor is the target hardware; a Node simulation script substitutes until hardware is ready, with the backend abstracting both sources behind a `SensorAdapter` interface.

**Problem:** Consumer smart thermostats are closed ecosystems. A self-hosted solution gives full control over data, scheduling logic, and hardware choices.

**Target users:** A household owner (`admin`) and optionally family members (`guest`) who need read-only visibility.

**Stack:** React + Vite, Node/Express, MongoDB Atlas, Socket.io, MQTT (Mosquitto → HiveMQ), deployed on Railway.

---

## Success Criteria

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | Real-time temperature updates reach the browser | Socket.io `reading` event arrives within 5 seconds of sensor post |
| 2 | Target temperature persisted and applied | Device `desired` state updated in DB, Arduino ACKs within 3 cycles |
| 3 | Auth is secure | JWT + refresh token rotation; no raw passwords in DB or logs |
| 4 | History charts render without timeout | Aggregated hourly/daily queries complete in < 2 s for 30-day window |
| 5 | Away mode reduces energy use | Mode flag stored, schedule overridden while active |
| 6 | Simulator is a drop-in replacement | Switching `SENSOR_ADAPTER=simulator|mqtt` requires zero backend code changes |
| 7 | Guest role enforced everywhere | Guest tokens rejected on any write endpoint and write WS event |

---

## User Personas & Journeys

### Personas

**Admin (household owner)**
- Sets target temperatures, creates schedules, configures devices
- Receives push notifications for anomalies
- Manages user accounts and device registration

**Guest (family member)**
- Views current temperature and schedule
- Cannot change settings or device configuration

**Arduino (hardware device)**
- Publishes readings and heartbeats via MQTT
- Receives and ACKs commands from the backend command queue
- Falls back to EEPROM schedule when connectivity is lost

### Key Journeys

**Journey 1 — Morning warm-up (Admin)**
1. Admin opens dashboard → sees current temp (live, via WebSocket)
2. Admin adjusts target temp slider → sets 3-hour boost
3. Backend writes `desired.temp` to Device Shadow
4. Arduino receives command, adjusts heating, ACKs
5. Dashboard shows `reported.temp` climbing toward target
6. Push notification fires when target is reached

**Journey 2 — Leaving home (Admin)**
1. Admin activates Away mode (manual or geo-fence trigger)
2. Backend overrides active schedule with away setpoint (e.g., 15 °C)
3. Arduino receives new desired state via command queue
4. On return, Admin deactivates Away mode → schedule resumes

**Journey 3 — Guest checking temperature (Guest)**
1. Guest logs in → sees current temp and today's schedule (read-only)
2. Any attempt to change settings is blocked with HTTP 403 / WS rejection

**Journey 4 — Weekly schedule setup (Admin)**
1. Admin opens Schedule Builder
2. Defines time slots per day with target temperatures
3. Schedule saved and synced to Arduino via command queue
4. Arduino runs schedule autonomously, even without WiFi (EEPROM fallback)

**Journey 5 — Anomaly alert (System)**
1. Sensor reports temperature spike or drop outside configured thresholds
2. Backend emits `device:alert` via WebSocket
3. Push notification sent to Admin

---

## Domain Requirements

### IoT / Hardware
- MQTT protocol (Mosquitto locally, HiveMQ in production)
- Device Shadow pattern: `desired` (set by app) vs `reported` (set by Arduino)
- Heartbeat: device posts every 60 s; backend marks offline after 3 missed beats
- Command queue: commands survive transient disconnects; Arduino ACKs each
- EEPROM fallback: Arduino stores last known schedule, runs autonomously if WiFi drops
- BME280 sensor provides both temperature and humidity in a single reading

### Data retention
- Raw `TempReading` documents retained indefinitely (time-series)
- Hourly aggregates pre-computed into a separate collection for chart performance
- Seed script provides 30 days of synthetic history on first run

### Security / Compliance
- GDPR-adjacent: minimal PII (email, hashed password); no third-party analytics
- All times stored in UTC; displayed in browser local time via `date-fns-tz`
- Env vars validated with `zod` at startup (fail-fast)

---

## Innovation & Design Patterns

- **SensorAdapter abstraction** — clean seam between simulator and real hardware; swap without touching business logic
- **Device Shadow pattern** — decouples user intent (`desired`) from hardware state (`reported`); delta drives Arduino work queue
- **Thermal colour palette** — dashboard hue shifts warm/cool based on current temperature (red → blue), giving instant visual feedback without reading a number
- **Day/night simulation curve** — `sin()` curve ±3 °C over 24 hours + noise makes chart data indistinguishable from real sensor data during development

---

## Project Scoping & Phased Development

### MVP Strategy

**Approach:** Experience MVP — deliver a working thermostat loop end-to-end so the system is genuinely usable before adding advanced features.

**MVP boundary:** Phases 1–5 from the build order constitute the MVP. The app must control temperature, show live readings, display history, and enforce auth before anything else ships.

### Phase 1 — MVP (Phases 1–5 of build order)

**Must-have capabilities:**
- User registration, login, JWT + refresh token rotation, role guard
- Device and Room CRUD; seed one device on first run
- Simulation script + `/internal/readings` ingestion endpoint
- WebSocket live temperature feed to dashboard widget
- Temperature history chart (hourly/daily aggregates, 30-day window)

### Phase 2 — Control & Scheduling (Phases 6–7)

- Weekly schedule builder (per-device, per-day time slots)
- Away mode (manual toggle)
- Boost / hold override (1 h / 3 h / until next slot)
- Min/max safety thresholds enforced on backend

### Phase 3 — Notifications & Multi-room (Phases 8–9)

- Push notifications (target reached, anomaly alerts) via Web Push API
- Per-room view with expandable sensor cards
- Geo-fence-triggered away mode (phone location integration)
- Dark/light mode UI toggle

### Phase 4 — Real Hardware (Phase 10)

- MQTT integration (Mosquitto → HiveMQ)
- Arduino heartbeat monitoring and offline detection
- Command queue + ACK flow
- EEPROM fallback documentation and testing
- "Remember this device" long-lived device tokens
- Email verification + password reset via magic link

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Arduino delivery delay | Simulator is production-quality and swappable at config level |
| MongoDB query performance on large time-series | Hourly aggregates from day 1; raw collection never queried for charts |
| WebSocket auth bypass | JWT validated on WS handshake, not only on REST |
| Time-zone bugs | `date-fns-tz` mandatory from day 1; all DB storage UTC |
| Scope creep | Per-room and geo-fence deferred to Phase 3 |

---

## Functional Requirements

### User Management

- FR1: Admin can register with email and password
- FR2: Registered users can log in and receive a JWT access token and refresh token
- FR3: Users can refresh their session without re-entering credentials
- FR4: Admin can invite a guest user (read-only role)
- FR5: Users can log out, invalidating the current refresh token
- FR6: Admin can request a password-reset magic link via email
- FR7: New users must verify their email address before accessing protected routes
- FR8: Users can mark a device as trusted for extended session duration

### Device & Room Management

- FR9: Admin can register a new thermostat device with a name and location
- FR10: Admin can assign a device to a named room
- FR11: Admin can view a list of all registered devices and their online/offline status
- FR12: Admin can decommission (remove) a device
- FR13: Admin can configure min/max safety temperature thresholds per device

### Temperature Monitoring

- FR14: Any authenticated user can view the current temperature for each device in real time
- FR15: Any authenticated user can view current humidity for each device
- FR16: Any authenticated user can see whether a device is actively heating or cooling
- FR17: Any authenticated user can view a temperature history chart for a configurable time range (1 day / 7 days / 30 days)
- FR18: The system marks a device as offline when heartbeats are missed and notifies the Admin

### Temperature Control

- FR19: Admin can set a target temperature for a device
- FR20: Admin can set a hold duration for a manual temperature override (1 h / 3 h / until next schedule slot)
- FR21: Admin can switch a device between heating, cooling, and auto modes
- FR22: The system enforces configured safety thresholds, rejecting target temperatures outside the allowed range

### Scheduling

- FR23: Admin can create a weekly heating/cooling schedule per device (day-of-week, from/to time, target temperature)
- FR24: Admin can edit or delete individual schedule slots
- FR25: The schedule is stored and synced to the device so it runs autonomously without a network connection

### Away Mode

- FR26: Admin can manually activate and deactivate Away mode for a device
- FR27: While Away mode is active, the schedule is suspended and a configurable away setpoint is applied
- FR28: Admin can configure geo-fence-based automatic Away mode trigger (Phase 3)

### Notifications & Alerts

- FR29: Admin receives a push notification when a device reaches its target temperature
- FR30: Admin receives a push notification when a temperature anomaly (spike or drop beyond threshold) is detected
- FR31: Admin receives an in-app alert when a device goes offline

### IoT / Hardware Integration

- FR32: The system accepts temperature and humidity readings from either the simulation script or an MQTT-connected Arduino without backend code changes
- FR33: The system maintains a Device Shadow with `desired` and `reported` state per device
- FR34: The system queues commands for a device and delivers them reliably, including across temporary disconnects
- FR35: The Arduino can acknowledge received commands, updating the Device Shadow `reported` state

### Data & Reporting

- FR36: The system generates and stores hourly aggregate temperature readings for chart performance
- FR37: Admin can export temperature history for a selected device and date range (Phase 2)
- FR38: The dashboard displays today's total heating runtime as a summary widget

---

## Non-Functional Requirements

### Performance

- Dashboard initial load (all widgets rendered): < 3 s on a standard broadband connection
- WebSocket temperature update latency (sensor post → browser render): < 5 s end-to-end
- History chart query (30-day aggregated view): < 2 s response time
- REST API endpoints (CRUD): < 500 ms p95 response time under typical single-household load

### Security

- Passwords stored as bcrypt hashes (minimum cost factor 12); never logged or transmitted in plaintext
- JWT access tokens expire in 15 minutes; refresh tokens rotated on each use and invalidated on logout (blacklist in Redis)
- All API endpoints enforce role checks; Guest tokens rejected with HTTP 403 on any write operation
- WebSocket connections validate JWT on the initial handshake; unauthenticated connections are refused
- Internal device ingestion endpoint (`/internal/readings`) requires a separate `x-device-secret` header, not a user JWT
- All data in transit over HTTPS/WSS; MongoDB Atlas connection over TLS
- Environment variables validated with `zod` at startup; process exits if required vars are missing

### Reliability

- Simulator runs as a separate process; if it crashes, the backend continues to serve historical data and WebSocket connections unaffected
- Device Shadow persists in MongoDB; a browser refresh or reconnect restores full state without data loss
- Schedule stored in EEPROM on Arduino; thermostat continues operating during backend or network outages

### Maintainability

- `SensorAdapter` interface isolates all sensor-source logic; swapping simulator → MQTT requires changing one environment variable and zero application code
- All timestamps stored as UTC in MongoDB; `date-fns-tz` used exclusively for display conversion
- `.env` schema defined in `zod` and documented; no undeclared environment variables in production

### Scalability

- Single-household pet project; no multi-tenancy requirement in MVP
- MongoDB Atlas free tier sufficient for Phase 1–3; upgrade path to paid tier if data volume grows
- Architecture (REST + WebSocket separation, adapter pattern) does not block future multi-home support

---

## Data Models

```ts
// User
{ email: string, passwordHash: string, role: 'admin' | 'guest', emailVerified: boolean, createdAt: Date }

// Device
{ name: string, room: ObjectId, status: 'online' | 'offline', lastSeen: Date,
  shadow: { desired: { temp: number, mode: 'heat'|'cool'|'auto' },
            reported: { temp: number, mode: string } },
  isHeating: boolean, thresholds: { min: number, max: number } }

// Room
{ name: string, deviceId: ObjectId }

// Schedule (per device)
{ deviceId: ObjectId, slots: [{ day: 0-6, from: string, to: string, targetTemp: number }] }

// TempReading (raw time-series)
{ deviceId: ObjectId, temp: number, humidity: number, timestamp: Date }

// TempReadingHourly (aggregated)
{ deviceId: ObjectId, hour: Date, avgTemp: number, minTemp: number, maxTemp: number }

// Event
{ deviceId: ObjectId, type: 'boost' | 'away' | 'window_open' | 'anomaly', payload: object, timestamp: Date }
```

---

## API Surface

### REST

```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password

GET    /devices
GET    /devices/:id
POST   /devices
PATCH  /devices/:id/settings        ← desired temp, mode, thresholds
DELETE /devices/:id

GET    /rooms
POST   /rooms

GET    /schedules/:deviceId
PUT    /schedules/:deviceId

GET    /readings/:deviceId?from=&to=
GET    /readings/:deviceId/latest

POST   /internal/readings           ← simulator + Arduino ingestion (device-secret auth)
```

### WebSocket (Socket.io)

```
Client → Server:  join room by deviceId
Server → Client:  'reading'         { deviceId, temp, humidity, timestamp }
                  'device:status'   { deviceId, status: 'online'|'offline' }
                  'command:ack'     { commandId, deviceId, accepted: boolean }
                  'device:alert'    { deviceId, type, message }
```

---

## Build Order (Implementation Phases)

| Phase | Deliverable |
|-------|-------------|
| 1 | Auth — register, login, JWT + refresh, role guard |
| 2 | Device + Room CRUD, seed one device |
| 3 | Simulation script + `/internal/readings` endpoint |
| 4 | WebSocket live temp feed → dashboard widget |
| 5 | History chart with aggregated readings |
| 6 | Schedule builder |
| 7 | Away mode + Boost hold |
| 8 | Push notifications (Web Push API or in-app toasts first) |
| 9 | Per-room view |
| 10 | MQTT integration when Arduino hardware arrives |

---

## Out of Scope

- Multi-home / multi-tenant support (single household only)
- Native mobile app (web app only, responsive design)
- Voice assistant integration
- Third-party smart home protocol support (Matter, Z-Wave, Zigbee)
- Billing or subscription management