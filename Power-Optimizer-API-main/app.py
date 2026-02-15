"""FastAPI server for the MRV Power Optimizer.

MVP endpoints:
  POST /optimize              – Full payload (room + occupancy + appliances)
  POST /optimize/{room_id}    – Lightweight: just send people_count, config loaded from config.json
  GET  /health                – Health check
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from energy_optimizer import (
    Appliance,
    GoogleWeatherProvider,
    Occupancy,
    OpenMeteoWeatherProvider,
    Room,
    _get_first_available_conditions,
    _parse_appliance,
    _parse_occupancy,
    _parse_room,
    optimize_room,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOG = logging.getLogger(__name__)

# Rate limiting for DB inserts
LAST_DB_INSERT: Dict[str, datetime] = {}

from dotenv import load_dotenv
load_dotenv()

# ---------------------------------------------------------------------------
# Load static room/appliance config
# ---------------------------------------------------------------------------
CONFIG_PATH = Path(__file__).parent / "config.json"


def _load_config() -> Dict[str, Any]:
    """Load room/appliance configuration from config.json."""
    if not CONFIG_PATH.exists():
        LOG.warning("config.json not found at %s", CONFIG_PATH)
        return {"rooms": {}}
    with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


CONFIG = _load_config()

# ---------------------------------------------------------------------------
# Pydantic request/response models
# ---------------------------------------------------------------------------


class OccupancyInput(BaseModel):
    """Lightweight input from the camera module."""

    people_count: int = Field(..., ge=0, description="Number of people detected in the room")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Detection confidence")



class OptimizeRequest(BaseModel):
    """Full request body for POST /optimize."""

    room: Dict[str, Any]
    occupancy: Dict[str, Any]
    appliances: List[Dict[str, Any]]
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ApplianceStateResponse(BaseModel):
    appliance_id: int
    appliance_type: str  # Added field
    status: str
    level: Optional[int]
    estimated_power_watts: int
    updated_at: str


class OptimizeResponse(BaseModel):
    room_id: int
    people_count: int
    outside_temp_c: Optional[float]
    total_estimated_power_watts: int
    recommendations: List[ApplianceStateResponse]
    optimization_id: Optional[str] = None


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MRV Power Optimizer API",
    description="Smart building energy optimization based on room occupancy and weather conditions.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def _fetch_weather(latitude: Optional[float], longitude: Optional[float]) -> Optional[float]:
    """Attempt to get outdoor temperature from weather providers."""
    if latitude is None or longitude is None:
        return None
    providers = [
        GoogleWeatherProvider(latitude=latitude, longitude=longitude),
        OpenMeteoWeatherProvider(latitude=latitude, longitude=longitude),
    ]
    conditions = _get_first_available_conditions(providers)
    return conditions.temperature_c if conditions else None


def _run_optimizer(
    room_data: Dict[str, Any],
    occupancy_data: Dict[str, Any],
    appliances_data: List[Dict[str, Any]],
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> OptimizeResponse:
    """Parse inputs, run the optimizer, and return a structured response."""

    room = _parse_room(room_data)
    occupancy = _parse_occupancy(occupancy_data)
    appliances = [_parse_appliance(a) for a in appliances_data]

    # If occupancy count is not provided (e.g. from scheduled job), try to fetch from DB
    if occupancy.people_count == -1 and supabase:
        try:
            # Get latest occupancy validation
            res = supabase.table("occupancy_logs").select("*").eq("room_id", str(room.room_id)).order("detected_at", desc=True).limit(1).execute()
            if res.data:
                latest = res.data[0]
                occupancy.people_count = latest["people_count"]
                occupancy.confidence = latest.get("confidence", 1.0)
                occupancy.detected_at = latest["detected_at"]
        except Exception as e:
            LOG.warning("Failed to fetch occupancy from DB: %s", e)

    # Mapping logical IDs to UUIDs (Verified via debug script)
    # 1 -> fb3b770b-ed92-4029-93db-94f3212546c3
    # 2 -> 1dd6b3c0-5e4a-4151-888a-9a30a603607e
    ROOM_UUID_MAP = {
        "1": "fb3b770b-ed92-4029-93db-94f3212546c3",
        "2": "1dd6b3c0-5e4a-4151-888a-9a30a603607e"
    }
    
    # Override appliance active count from database (room_systems)
    if supabase:
        try:
            # key for room_systems is UUID
            target_room_id = ROOM_UUID_MAP.get(str(room.room_id), str(room.room_id))
            
            sys_res = supabase.table("room_systems").select("system_type, active_count").eq("room_id", target_room_id).execute()
            if sys_res.data:
                system_map = {row['system_type']: row['active_count'] for row in sys_res.data}
                # Map DB system_type to config appliance_type
                # DB: LIGHTING, AC, FAF
                # Config: LIGHT, AC, FAN
                mapping = {
                    'LIGHTING': 'LIGHT',
                    'FAF': 'FAN',
                    'AC': 'AC',
                    'UPS': 'UPS'  # Added UPS
                }
                
                for app in appliances:
                    # Reverse map: check if current app type matches any DB type
                    db_type = next((k for k, v in mapping.items() if v == app.appliance_type), None)
                    if db_type and db_type in system_map:
                         # Update the 'number_of_appliances'
                         app.number_of_appliances = system_map[db_type]
                         LOG.info(f"Using DB active_count for {app.appliance_type}: {app.number_of_appliances}")
        except Exception as e:
             LOG.warning("Failed to fetch room_systems: %s", e)

    outside_temp_c = _fetch_weather(latitude, longitude)

    recommendations = optimize_room(room, occupancy, appliances, outside_temp_c=outside_temp_c)

    total_power = sum(r.estimated_power_watts for r in recommendations)
    
    # Store optimization result in DB
    optimization_id = None
    if supabase:
        try:
            rec_data = [asdict(r) for r in recommendations]
            db_res = supabase.table("optimizations").insert({
                "room_id": str(room.room_id),
                "total_power_watts": total_power,
                "optimization_data": json.dumps(rec_data),
                "is_accepted": False
            }).execute()
            if db_res.data:
                optimization_id = db_res.data[0]["id"]
        except Exception as e:
            LOG.error("Failed to store optimization: %s", e)

    return OptimizeResponse(
        room_id=room.room_id,
        people_count=occupancy.people_count,
        outside_temp_c=outside_temp_c,
        total_estimated_power_watts=total_power,
        recommendations=[
            ApplianceStateResponse(**asdict(r)) for r in recommendations
        ],
        optimization_id=optimization_id
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
async def health_check():
    """Simple health check."""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.post("/optimize", response_model=OptimizeResponse)
async def optimize_full(request: OptimizeRequest):
    """Full optimization endpoint.

    Send the complete room configuration, occupancy data, and appliance list.
    Useful for dashboards or when the caller has all the data.

    Example request body – see demo_input.json.
    """
    try:
        return _run_optimizer(
            room_data=request.room,
            occupancy_data=request.occupancy,
            appliances_data=request.appliances,
            latitude=request.latitude,
            longitude=request.longitude,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        LOG.exception("Unexpected error in /optimize")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/optimize/{room_id}", response_model=OptimizeResponse)
async def optimize_by_room(room_id: int, body: OccupancyInput):
    """Lightweight endpoint for the camera module.

    The camera only needs to send:
      { "people_count": 5, "confidence": 0.92 }

    Room and appliance config is loaded from config.json.
    """
    room_key = str(room_id)
    room_cfg = CONFIG.get("rooms", {}).get(room_key)

    if not room_cfg:
        raise HTTPException(
            status_code=404,
            detail=f"Room {room_id} not found in config.json. "
            f"Available rooms: {list(CONFIG.get('rooms', {}).keys())}",
        )

    room_data = {"room_id": room_cfg["room_id"], "max_capacity": room_cfg["max_capacity"]}
    occupancy_data = {
        "room_id": room_cfg["room_id"],
        "people_count": body.people_count,
        "confidence": body.confidence,
    }
    appliances_data = room_cfg["appliances"]
    latitude = room_cfg.get("latitude")
    longitude = room_cfg.get("longitude")

    try:
        return _run_optimizer(
            room_data=room_data,
            occupancy_data=occupancy_data,
            appliances_data=appliances_data,
            latitude=latitude,
            longitude=longitude,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        LOG.exception("Unexpected error in /optimize/%s", room_id)
        raise HTTPException(status_code=500, detail="Internal server error")


# specialized ultralytics imports
from ultralytics import YOLO
from PIL import Image
import io
from supabase import create_client, Client

# Initialize YOLO model (will download yolov8n.pt on first run)
model = YOLO("yolov8n.pt")

# Initialize Supabase Client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        LOG.error("Failed to initialize Supabase: %s", e)
else:
    LOG.warning("SUPABASE_URL or SUPABASE_KEY not set. DB features will be disabled.")


@app.post("/detect/{room_id}")
async def detect(room_id: str, image: UploadFile = File(...)):
    """Real Object Detection & DB Logging Endpoint."""
    try:
        # Read image file
        contents = await image.read()
        img = Image.open(io.BytesIO(contents))

        # Run inference
        results = model(img)
        
        detections = []
        people_count = 0

        # Process results
        for result in results:
            boxes = result.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                
                # Filter for person class (ID 0 in COCO dataset)
                if cls_id == 0 and conf > 0.4:
                    people_count += 1
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    detections.append({
                        "class": "person",
                        "confidence": round(conf, 2),
                        "bbox": [int(x1), int(y1), int(x2), int(y2)]
                    })
        
        # Log to Supabase (Trigger will auto-delete old records for this room)
        if supabase:
            now = datetime.now(timezone.utc)
            last_insert = LAST_DB_INSERT.get(room_id)
            
            # Check if 60 seconds have passed since last insert
            if last_insert is None:
                delta = 9999
            else:
                delta = (now - last_insert).total_seconds()
            
            LOG.info(f"Rate Limit Check: room={room_id}, delta={delta}, last={last_insert}, now={now}")

            if last_insert is None or delta >= 60:
                try:
                    # Log invalid room_id for debugging
                    LOG.info(f"Attempting DB insert for room: {room_id}, count: {people_count}")
                    
                    response = supabase.table("occupancy_logs").insert({
                        "room_id": room_id,
                        "people_count": people_count,
                        "confidence": 0.95, 
                        "detected_at": now.isoformat()
                    }).execute()
                    
                    LAST_DB_INSERT[room_id] = now
                    LOG.info(f"DB Insert Success: {response.data}")
                except Exception as db_err:
                    LOG.error(f"Supabase Insertion Error: {db_err}")
            else:
                pass # Skip insert to save DB bandwidth

        return {"people_count": people_count, "detections": detections, "room_id": room_id}

    except Exception as e:
        LOG.exception("Detection Error")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect")
async def detect_fallback(image: UploadFile = File(...)):
    """Fallback for /detect without room_id. Defaults to '1'."""
    LOG.warning("Received /detect request without room_id. Defaulting to '1'.")
    return await detect("1", image)


@app.post("/optimize/accept/{optimization_id}")
async def accept_optimization(optimization_id: str, appliance_id: Optional[str] = None):
    """Mark an optimization suggestion as accepted and update active unit count.
    
    If appliance_id is provided, only that specific recommendation is applied.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    try:
        # 1. Fetch the optimization details
        opt_res = supabase.table("optimizations").select("optimization_data, room_id").eq("id", optimization_id).execute()
        if not opt_res.data:
            raise HTTPException(status_code=404, detail="Optimization not found")
        
        opt_record = opt_res.data[0]
        room_id = opt_record["room_id"]
        recommendations = opt_record["optimization_data"]
        
        # FIX: Supabase might return this as a string if it's JSONB
        if isinstance(recommendations, str):
            try:
                recommendations = json.loads(recommendations)
            except json.JSONDecodeError:
                LOG.error("Failed to parse optimization_data JSON")
                raise HTTPException(status_code=500, detail="Invalid optimization data format")

        # 2. Iterate through recommendations
        system_decrements = {} # type: int

        for rec in recommendations:
            # Filter if appliance_id is provided
            # Convert both to string for comparison
            rec_id = str(rec.get("appliance_id", ""))
            target_id = str(appliance_id) if appliance_id else None
            
            if target_id and rec_id != target_id:
                LOG.debug(f"Skipping rec {rec_id} (target: {target_id})")
                continue
            
            LOG.info(f"Processing rec {rec_id} for acceptance. Status: {rec.get('status')}")

            # logic: If status is "OFF", it means we suggested turning it OFF.
            if rec.get("status") == "OFF":
                app_type = rec.get("appliance_type")
                # Map back to DB system_type
                db_type = None
                if app_type == 'LIGHT': db_type = 'LIGHTING'
                elif app_type == 'FAN': db_type = 'FAF'
                elif app_type == 'AC': db_type = 'AC'
                elif app_type == 'UPS': db_type = 'UPS' # Added UPS
                
                if db_type:
                    system_decrements[db_type] = system_decrements.get(db_type, 0) + 1
                else:
                    LOG.warning(f"Could not map appliance_type '{app_type}' to DB system_type")

        # 3. Update room_systems
        target_room_id = ROOM_UUID_MAP.get(str(room_id), str(room_id))
        LOG.info(f"Updating counts for Room {room_id} (UUID: {target_room_id}). Decrements: {system_decrements}")

        for sys_type, count in system_decrements.items():
            # Fetch current count to avoid going below zero
            current_res = supabase.table("room_systems").select("active_count").eq("room_id", target_room_id).eq("system_type", sys_type).execute()
            
            if not current_res.data:
                LOG.error(f"System type {sys_type} not found in DB for room {target_room_id}")
                continue

            current_count = current_res.data[0]["active_count"]
            new_count = max(0, current_count - count)
            
            LOG.info(f"Processing {sys_type}: Current={current_count}, Decrement={count}, New={new_count}")

            # Update DB
            upd_res = supabase.table("room_systems").update({"active_count": new_count}).eq("room_id", target_room_id).eq("system_type", sys_type).execute()
            LOG.info(f"DB Update Result: {upd_res.data}")

        # 4. Mark as partially accepted? For now, we don't track partial.
        # Just update the whole optimization row or maybe leave it?
        # User implies checking box = done.
        # We can set is_accepted=True if we want, or maybe just leave it so others can be clicked.
        # Let's set it to True merely to indicate *some* action was taken, but it doesn't prevent further calls.
        supabase.table("optimizations").update({"is_accepted": True}).eq("id", optimization_id).execute()
        
        return {"status": "success", "id": optimization_id, "updated_systems": system_decrements}
    except Exception as e:
        LOG.error(f"Error accepting optimization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Run with: uvicorn app:app --reload
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
