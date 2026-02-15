# MRV Smart Energy Dashboard

AI-powered energy optimization system for Mahindra Research Valley. Uses real-time occupancy detection (YOLOv8) and temperature-aware heuristics to recommend appliance state changes, reducing energy waste while maintaining comfort.

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌────────────┐
│  Frontend (Vite)    │────▶│  Backend (FastAPI)    │────▶│  Supabase  │
│  React + TypeScript │◀────│  YOLOv8 + Optimizer   │◀────│  Postgres  │
│  :5173              │     │  :8000                │     │            │
└─────────────────────┘     └──────────────────────┘     └────────────┘
```

**Frontend** — React dashboard with live camera feed, room-level optimization recommendations, and system status monitoring.

**Backend** — FastAPI server with YOLOv8 people detection (`/detect/{room_id}`), energy optimizer (`/optimize`), and real-time weather integration.

**Database** — Supabase (Postgres) storing rooms, appliance systems, occupancy logs, optimization history, and energy data.

## Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **Supabase** account ([supabase.com](https://supabase.com))
- **Webcam** (for live people detection)

## Quick Start

### 1. Database Setup

1. Create a new Supabase project
2. Go to **SQL Editor** and run the contents of [`Power-Optimizer-API-main/setup.sql`](Power-Optimizer-API-main/setup.sql)
3. This creates all tables, RLS policies, and seeds room + energy data

### 2. Backend Setup

```bash
cd Power-Optimizer-API-main

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Run the server
python3 -m uvicorn app:app --reload --port 8000
```

The YOLO model (`yolov8n.pt`) will be downloaded automatically on first detection request.

### 3. Frontend Setup

```bash
cd smart-energy-dashboard

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Run the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Environment Variables

### Backend (`Power-Optimizer-API-main/.env`)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_KEY` | ✅ | Your Supabase anon key |
| `GOOGLE_WEATHER_API_KEY` | ❌ | Optional — falls back to Open-Meteo |

### Frontend (`smart-energy-dashboard/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_KEY` | ✅ | Your Supabase anon key |
| `VITE_AI_ENGINE_URL` | ❌ | Backend URL (default: `http://localhost:8000`) |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/optimize` | Generate optimization recommendations for a room |
| `POST` | `/detect/{room_id}` | Detect people in an uploaded frame (YOLOv8) |
| `POST` | `/accept/{optimization_id}` | Accept an optimization suggestion |
| `GET` | `/health` | Health check |

## Project Structure

```
Mahindra-Sneha/
├── Power-Optimizer-API-main/   # Backend
│   ├── app.py                  # FastAPI server
│   ├── energy_optimizer.py     # Optimization engine
│   ├── setup.sql               # Database setup (run in Supabase)
│   ├── requirements.txt
│   └── .env.example
├── smart-energy-dashboard/     # Frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── context/            # State management
│   │   └── lib/                # Supabase client
│   ├── .env.example
│   └── package.json
└── README.md                   # This file
```

## License

Internal — Mahindra Research Valley
