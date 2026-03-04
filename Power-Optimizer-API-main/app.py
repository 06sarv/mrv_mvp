"""MRV Smart Energy API — Zone-Based Auto-Control.

Endpoints:
  GET  /health  — Health check
  GET  /zones   — Return zone config for frontend overlay rendering
  POST /detect  — Accept a frame image, run YOLO, return zone occupancy + appliance states
"""

from __future__ import annotations

import io
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from ultralytics import YOLO

from zone_utils import apply_temporal_persistence, evaluate_zones

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOG = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load config
# ---------------------------------------------------------------------------
CONFIG_PATH = Path(__file__).parent / "config.json"


def _load_config() -> Dict[str, Any]:
    if not CONFIG_PATH.exists():
        LOG.warning("config.json not found at %s", CONFIG_PATH)
        return {"zones": []}
    with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


CONFIG = _load_config()
ZONES: List[dict] = CONFIG.get("zones", [])
PERSISTENCE_DELAY: int = CONFIG.get("persistence_delay_sec", 30)

# ---------------------------------------------------------------------------
# YOLO model
# ---------------------------------------------------------------------------
MODEL_PATH = Path(__file__).parent / "yolov8n.pt"
model = YOLO(str(MODEL_PATH))

# ---------------------------------------------------------------------------
# In-memory zone states for temporal persistence
# ---------------------------------------------------------------------------
_zone_states: Dict[str, dict] = {}

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="MRV Smart Energy API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/zones")
async def get_zones():
    """Return zone configuration for frontend overlay rendering."""
    return {"zones": ZONES}


@app.post("/detect")
async def detect(image: UploadFile = File(...)):
    """Accept a single frame, run YOLO person detection, evaluate zones, return auto ON/OFF states."""
    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents))
        frame_w, frame_h = img.size

        # Run YOLO inference
        results = model(img)

        detections: List[dict] = []
        people_count = 0

        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                if cls_id != 0 or conf < 0.55:  # person class only, higher threshold
                    continue
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                box_w = x2 - x1
                box_h = y2 - y1
                center_y_norm = ((y1 + y2) / 2) / frame_h

                # Skip detections in the top 25% of frame (ceiling: fans, lights, AC)
                if center_y_norm < 0.25:
                    continue
                # Skip tiny boxes (plants, artifacts) — person bbox should be
                # at least 3% of frame width and 5% of frame height
                if box_w < frame_w * 0.03 or box_h < frame_h * 0.05:
                    continue

                people_count += 1
                detections.append({
                    "class": "person",
                    "confidence": round(conf, 2),
                    "bbox": [int(x1), int(y1), int(x2), int(y2)],
                })

        # Evaluate which zones have people
        zone_presence = evaluate_zones(detections, ZONES, frame_w, frame_h)

        # Build state list from in-memory store for temporal persistence
        now = datetime.now(timezone.utc)
        mem_states = []
        for zone in ZONES:
            zid = zone["zone_id"]
            existing = _zone_states.get(zid, {})
            mem_states.append({
                "zone_id": zid,
                "is_occupied": existing.get("is_occupied", False),
                "last_detected": existing.get("last_detected"),
                "delay_sec": zone.get("delay_sec", PERSISTENCE_DELAY),
            })

        # Apply temporal persistence
        persisted = apply_temporal_persistence(zone_presence, mem_states, now)

        # Update in-memory state and build response
        zone_results: List[dict] = []
        total_power = 0
        zones_occupied = 0

        for zone in ZONES:
            zid = zone["zone_id"]
            state = persisted[zid]
            _zone_states[zid] = state  # persist in memory

            is_on = state["appliance_state"] == "ON"
            fan_watts = zone["fan_power_watts"] * zone["fan_count"] if is_on else 0
            light_watts = zone["light_power_watts"] * zone["light_count"] if is_on else 0
            zone_power = fan_watts + light_watts
            total_power += zone_power
            if state["is_occupied"]:
                zones_occupied += 1

            zone_results.append({
                "zone_id": zid,
                "zone_name": zone["zone_name"],
                "polygon": zone["polygon"],
                "is_occupied": state["is_occupied"],
                "last_detected": state["last_detected"],
                "appliance_state": state["appliance_state"],
                "fan_on": is_on,
                "light_on": is_on,
                "fan_power_watts": fan_watts,
                "light_power_watts": light_watts,
                "zone_power_watts": zone_power,
            })

        return {
            "people_count": people_count,
            "detections": detections,
            "zone_states": zone_results,
            "total_power_watts": total_power,
            "zones_occupied": zones_occupied,
            "zones_total": len(ZONES),
        }

    except Exception as e:
        LOG.exception("Detection error")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Run with: uvicorn app:app --reload
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
