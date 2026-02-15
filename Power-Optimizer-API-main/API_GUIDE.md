# MRV Energy Optimizer API Guide

## Overview
This module (`energy_optimizer.py`) provides the core logic for recommending appliance states based on room occupancy and weather conditions. It is designed to be stateless and deterministic.

The **FastAPI server** (`app.py`) exposes this logic as REST endpoints.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
python3 -m uvicorn app:app --reload

# Interactive docs
open http://localhost:8000/docs
```

---

## REST API Endpoints

### `GET /health`
Health check.

```bash
curl http://localhost:8000/health
```
```json
{"status": "ok", "timestamp": "2026-02-12T13:24:02+00:00"}
```

---

### `POST /optimize/{room_id}` — **Camera Module Endpoint**
Lightweight endpoint for the CV/camera module. Only send `people_count`.  
Room and appliance config is loaded from `config.json`.

```bash
curl -X POST http://localhost:8000/optimize/1 \
  -H "Content-Type: application/json" \
  -d '{"people_count": 5, "confidence": 0.92}'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `people_count` | int (≥0) | ✅ | Number of people detected |
| `confidence` | float (0-1) | ❌ | Detection confidence (default: 1.0) |

**Response:**
```json
{
  "room_id": 1,
  "people_count": 5,
  "outside_temp_c": 25.0,
  "total_estimated_power_watts": 1810,
  "recommendations": [
    {
      "appliance_id": 1,
      "status": "ON",
      "level": 8,
      "estimated_power_watts": 1600,
      "updated_at": "2026-02-12T13:24:11+00:00"
    },
    {
      "appliance_id": 2,
      "status": "ON",
      "level": 6,
      "estimated_power_watts": 90,
      "updated_at": "2026-02-12T13:24:11+00:00"
    },
    {
      "appliance_id": 3,
      "status": "ON",
      "level": null,
      "estimated_power_watts": 120,
      "updated_at": "2026-02-12T13:24:11+00:00"
    }
  ]
}
```

---

### `POST /optimize` — Full Payload
Send the complete room config, occupancy, and appliance list. Useful for dashboards or testing.

```bash
curl -X POST http://localhost:8000/optimize \
  -H "Content-Type: application/json" \
  -d @demo_input.json
```

The request body matches the format of `demo_input.json`.

---

## Configuration

### `config.json`
Static room and appliance config. The lightweight `/optimize/{room_id}` endpoint loads room data from here so devices only need to send `people_count`.

Add new rooms by adding entries to the `rooms` object:
```json
{
  "rooms": {
    "1": {
      "room_id": 1,
      "max_capacity": 20,
      "latitude": 12.8379,
      "longitude": 80.1870,
      "appliances": [ ... ]
    }
  }
}
```

---

## Logic Rules
- **Empty Room**: All appliances are turned OFF.
- **AC**: Requires at least 2 people to turn ON.
- **Lights/Fans**: Require at least 1 person.
- **Levels**: Adjustable devices (AC, Fan) scale their level (1-10) based on occupancy density.
- **Weather Bias**:
    - Hot (>32°C): Increases cooling level.
    - Cold (<18°C): Decreases cooling level.

## Error Handling
- `400` – Validation errors (negative people_count, room_id mismatch, etc.)
- `404` – Room not found in `config.json`
- `500` – Unexpected server errors

## Interactive Docs
FastAPI auto-generates interactive API docs at:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
