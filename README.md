# MRV Smart Energy Dashboard

Zone-based energy optimization system for Mahindra Research Valley. Uses real-time occupancy detection (YOLOv8) to automatically control appliances per zone, reducing energy waste.

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐
│  Frontend (Vite)    │────▶│  Backend (FastAPI)    │
│  React + TypeScript │◀────│  YOLOv8 + Zone Utils  │
│  :5173              │     │  :8000                │
└─────────────────────┘     └──────────────────────┘
```

**Frontend** — React dashboard with video upload/playback, zone overlay rendering, real-time occupancy status, and power consumption display.

**Backend** — FastAPI server running YOLOv8 person detection with zone-based occupancy mapping and temporal persistence.

## Prerequisites

- **Node.js** >= 18
- **Python** >= 3.10

## Quick Start

### 1. Backend

```bash
cd Power-Optimizer-API-main

python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt

python3 -m uvicorn app:app --reload --port 8000
```

The YOLO model (`yolov8n.pt`) will be downloaded automatically on first detection request.

### 2. Frontend

```bash
cd smart-energy-dashboard

npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Environment Variables

### Backend

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `8000`) |

### Frontend (`smart-energy-dashboard/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_AI_ENGINE_URL` | No | Backend URL (default: `http://localhost:8000`) |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/zones` | Return zone config for frontend overlay rendering |
| `POST` | `/detect` | Accept a frame image, run YOLOv8, return zone occupancy and appliance states |

## Project Structure

```
Mahindra-Sneha/
├── Power-Optimizer-API-main/        # Backend
│   ├── app.py                       # FastAPI server
│   ├── zone_utils.py                # Occupancy detection + temporal persistence
│   ├── config.json                  # Zone polygon definitions
│   ├── yolov8n.pt                   # YOLOv8 model weights
│   ├── requirements.txt
│   └── Procfile
├── smart-energy-dashboard/          # Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/           # Dashboard, VideoFeedWidget, ZoneStatusPanel
│   │   │   └── layout/             # Layout, Header, WeatherWidget
│   │   ├── context/                 # EnergyContext (global state)
│   │   └── types/                   # TypeScript interfaces
│   ├── .env.example
│   └── package.json
└── README.md
```

## License

Internal — Mahindra Research Valley
