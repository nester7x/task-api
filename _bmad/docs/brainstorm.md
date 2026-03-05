# 🌡️ Smart Thermostat Controller — Brainstorming Session

**Date:** 2026-03-03  
**Project type:** MEAN-ish pet project (MERN with React instead of Angular)  
**Goal:** Build a real, usable smart thermostat controller for home use  
**Complexity:** Medium  

---

## 🧭 Project Overview

A full-stack IoT thermostat web app. React frontend, Node/Express backend, MongoDB Atlas for persistence, Socket.io for real-time updates. Arduino (BME280 sensor) connects via MQTT when hardware is ready. Until then, a Node simulation script generates realistic temperature readings.

---

## 🏗️ Stack

| Layer       | Choice                                      |
|-------------|---------------------------------------------|
| Frontend    | React + Vite, React Query, Recharts         |
| Backend     | Node.js + Express                           |
| Database    | MongoDB Atlas (free tier)                   |
| Realtime    | Socket.io                                   |
| IoT Broker  | Mosquitto (local) → HiveMQ cloud (deployed) |
| Deployment  | Railway                                     |

---

## ✅ Selected Features

### 🔐 Auth Flow
1. **JWT + refresh token rotation** — Redis for token blacklist
2. **Role-based access** — `admin` (owner) vs `guest` (family, read-only)
3. **"Remember this device"** — long-lived device tokens
4. **Email verification flow** with resend logic
5. **Password reset via magic link** — no security questions

### 🌡️ Thermostat Features & UI
6. **Current temp display** — live, updated via WebSocket
7. **Target temp slider** with hold duration (1h / 3h / until next schedule)
8. **Away mode** — triggered manually or via geo-fence (phone location)
9. **Per-room view** — expandable when multiple sensors added
10. **Heating/cooling mode toggle** (or auto)
11. **Min/max safety thresholds** — e.g., never below 10°C
12. **Temperature history chart** — Recharts, aggregated hourly/daily
13. **Push notifications** — "target temp reached", "unusual spike"
14. **Dashboard widget** — today's heating runtime summary
15. **Dark/light mode UI** with thermal color palette (🔴 warm → 🔵 cool)

### 🗄️ Data Architecture
16. **MongoDB schemas** — `User`, `Device`, `Room`, `Schedule`, `TempReading`, `Event`
17. **Node simulation script** — emits realistic readings every 30s with day/night curve
18. **Socket.io** for real-time temp updates to frontend
19. **REST + WebSocket separation** — REST for CRUD, WS for live data
20. **Seed script** — 30 days of historical data for charts on first run
21. **Environment-based config** — dev uses simulator, prod uses Arduino MQTT
22. **`.env` schema validation with `zod`** — fail fast on startup

### 🔌 IoT Integration (Arduino-ready from day one)
23. **MQTT-ready backend** — accepts MQTT messages even before hardware exists
24. **`SensorAdapter` abstraction** — swap simulator → Arduino without rewriting backend
25. **Heartbeat ping** — device posts every 60s; backend marks offline if missed ×3
26. **Command queue** — backend queues commands (e.g., "set temp to 21°C"); Arduino polls and ACKs
27. **Local fallback** — Arduino runs last known schedule from EEPROM if WiFi drops
28. **Device Shadow pattern** — `desired` state (set by app) vs `reported` state (set by Arduino)
29. **BME280 sensor** over DHT22 — gives humidity for free, already in `TempReading` schema

---

## 📦 Data Models

```js
// User
{ email, passwordHash, role: 'admin' | 'guest', createdAt }

// Device
{ name, room, status: 'online' | 'offline', lastSeen, desiredTemp, reportedTemp, isHeating }

// Room
{ name, deviceId }

// Schedule (per device)
{ deviceId, slots: [{ day: 0-6, from: '07:00', to: '09:00', targetTemp }] }

// TempReading (time-series)
{ deviceId, temp, humidity, timestamp }
// → aggregate hourly in a separate collection for chart performance

// Event
{ deviceId, type: 'boost' | 'away' | 'window_open', payload, timestamp }
```

---

## 🔌 API Design

**REST** — CRUD, config, auth  
**WebSocket** — live temp updates, device status changes

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh

GET    /devices
GET    /devices/:id
PATCH  /devices/:id/settings       ← desired temp, mode

GET    /rooms
GET    /schedules/:deviceId
PUT    /schedules/:deviceId

GET    /readings/:deviceId?from=&to=   ← history chart data
GET    /readings/:deviceId/latest

WS     connection → joins room by deviceId
       emits: 'reading', 'device:status', 'command:ack'
```

---

## 🌡️ Simulation Script

Runs as a separate Node process until Arduino arrives. Simulates realistic day/night temperature drift.

```js
// simulator/index.js
const DEVICE_ID = process.env.DEVICE_ID;
const BASE_TEMP = 18;
let current = BASE_TEMP;

setInterval(async () => {
  const hour = new Date().getHours();
  const dayCurve = Math.sin((hour - 6) * Math.PI / 12) * 3; // ±3°C over day
  const noise = (Math.random() - 0.5) * 0.4;
  current = BASE_TEMP + dayCurve + noise;

  await fetch(`${API_URL}/internal/readings`, {
    method: 'POST',
    headers: { 'x-device-secret': process.env.DEVICE_SECRET },
    body: JSON.stringify({ deviceId: DEVICE_ID, temp: current, humidity: 55 })
  });
}, 30_000);
```

When Arduino arrives → this script is removed; Arduino publishes to MQTT instead. Backend handles both via `SensorAdapter`.

---

## 🔌 IoT Architecture

```
Arduino → MQTT broker → Node MQTT client → MongoDB + Socket.io → React
```

**Device Shadow pattern:**
```js
{
  desired:  { temp: 21, mode: 'heat' },  // ← set by user in app
  reported: { temp: 19.4, mode: 'heat' } // ← set by Arduino via MQTT
}
```
App writes to `desired`. Arduino writes to `reported`. Delta = pending work for Arduino.

**Heartbeat:** Arduino publishes to `devices/:id/heartbeat` every 60s. Backend marks offline after 3 missed beats → emits `device:status` via WebSocket.

**Command queue:** Backend pushes to `devices/:id/commands`. Arduino ACKs to `devices/:id/ack`. Commands survive temporary disconnects.

**Local fallback:** Last known schedule stored in EEPROM. Arduino runs autonomously if WiFi drops, resumes MQTT sync on reconnect.

---

## ⚠️ Edge Cases & Hidden Problems

| Problem | Solution |
|---|---|
| WebSocket auth | Validate JWT on WS handshake, not just REST |
| Time zones | Store all times in UTC, display in local time — use `date-fns-tz` from day 1 |
| Simulator → Arduino transition | Abstract sensor input behind `SensorAdapter` now or rewrite 30% of backend later |
| Chart performance | Aggregate readings hourly/daily — don't query raw time-series for 30-day views |
| Guest role enforcement | Guard both REST endpoints and WS event handlers |

---

## 🗂️ Suggested Build Order

| Phase | What to build |
|---|---|
| 1 | Auth — register, login, JWT + refresh, role guard |
| 2 | Device + Room CRUD, seed one device |
| 3 | Simulation script + `/internal/readings` endpoint |
| 4 | WebSocket live temp feed → dashboard widget |
| 5 | History chart with aggregated readings |
| 6 | Schedule builder |
| 7 | Away mode + Boost |
| 8 | Push notifications (Web Push API or in-app toasts first) |
| 9 | Per-room view |
| 10 | MQTT integration when Arduino hardware arrives |

---

## 📌 Next Steps

- [ ] Scaffold monorepo: `/client` (React + Vite), `/server` (Express), `/simulator`
- [ ] Set up MongoDB Atlas cluster + connection string
- [ ] Implement auth (Phase 1) as first PR
- [ ] Deploy skeleton to Railway with env vars wired
- [ ] Order BME280 sensor + Arduino WiFi board (ESP8266 or ESP32 recommended)
