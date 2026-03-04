"""Zone-based occupancy detection utilities.

Pure functions for mapping person detections (bounding boxes) to polygon zones
and applying temporal persistence to prevent flickering.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Tuple

import logging

LOG = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def bbox_center(x1: float, y1: float, x2: float, y2: float) -> Tuple[float, float]:
    """Return the center point of a bounding box."""
    return ((x1 + x2) / 2, (y1 + y2) / 2)


def point_in_polygon(px: float, py: float, polygon: Sequence[Tuple[float, float]]) -> bool:
    """Ray-casting algorithm to test if a point is inside a polygon.

    Args:
        px, py: Point coordinates.
        polygon: List of (x, y) vertices defining the polygon.

    Returns:
        True if the point is inside the polygon.
    """
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


# ---------------------------------------------------------------------------
# Zone evaluation
# ---------------------------------------------------------------------------

def evaluate_zones(
    detections: List[dict],
    zones: List[dict],
    frame_w: int,
    frame_h: int,
) -> Dict[str, bool]:
    """Map person detections to zones and return per-zone presence.

    Args:
        detections: List of detection dicts with 'bbox': [x1, y1, x2, y2] in pixel coords.
        zones: List of zone dicts with 'zone_id' and 'polygon' (normalized 0-1 coords).
        frame_w: Frame width in pixels.
        frame_h: Frame height in pixels.

    Returns:
        Dict mapping zone_id -> True if at least one person center is inside the zone.
    """
    if frame_w <= 0 or frame_h <= 0:
        LOG.warning("Invalid frame dimensions: %dx%d", frame_w, frame_h)
        return {z["zone_id"]: False for z in zones}

    # Pre-compute person center points in normalized coordinates
    person_centers = []
    for det in detections:
        if det.get("class") != "person":
            continue
        bbox = det["bbox"]
        cx, cy = bbox_center(*bbox)
        # Normalize to 0-1
        person_centers.append((cx / frame_w, cy / frame_h))

    presence: Dict[str, bool] = {}
    for zone in zones:
        zone_id = zone["zone_id"]
        polygon = [(p[0], p[1]) for p in zone["polygon"]]
        occupied = False
        for (cx, cy) in person_centers:
            if point_in_polygon(cx, cy, polygon):
                occupied = True
                break
        presence[zone_id] = occupied

    return presence


def apply_temporal_persistence(
    zone_presence: Dict[str, bool],
    zone_states: List[dict],
    now: Optional[datetime] = None,
) -> Dict[str, dict]:
    """Apply temporal persistence: keep zones marked occupied for delay_sec after last detection.

    Args:
        zone_presence: Current frame's detection result {zone_id: bool}.
        zone_states: List of zone state dicts from DB, each with:
            - zone_id, is_occupied, last_detected, delay_sec
        now: Current timestamp (defaults to utcnow).

    Returns:
        Dict mapping zone_id -> {is_occupied: bool, last_detected: str, appliance_state: 'ON'|'OFF'}
    """
    if now is None:
        now = datetime.now(timezone.utc)

    # Build a lookup for current DB state
    state_lookup = {s["zone_id"]: s for s in zone_states}

    result: Dict[str, dict] = {}

    for zone_id, currently_detected in zone_presence.items():
        db_state = state_lookup.get(zone_id, {})
        delay_sec = db_state.get("delay_sec", 120)

        if currently_detected:
            # Person detected right now — zone is occupied
            result[zone_id] = {
                "is_occupied": True,
                "last_detected": now.isoformat(),
                "appliance_state": "ON",
            }
        else:
            # No person detected — check temporal persistence
            last_detected_str = db_state.get("last_detected")
            if last_detected_str:
                if isinstance(last_detected_str, str):
                    try:
                        last_detected = datetime.fromisoformat(last_detected_str.replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        last_detected = None
                else:
                    last_detected = last_detected_str
            else:
                last_detected = None

            if last_detected and (now - last_detected).total_seconds() < delay_sec:
                # Within persistence window — keep occupied
                result[zone_id] = {
                    "is_occupied": True,
                    "last_detected": last_detected_str,
                    "appliance_state": "ON",
                }
            else:
                # Persistence expired — mark unoccupied
                result[zone_id] = {
                    "is_occupied": False,
                    "last_detected": last_detected_str,
                    "appliance_state": "OFF",
                }

    return result
