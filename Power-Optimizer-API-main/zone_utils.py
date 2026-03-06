"""Zone-based occupancy detection utilities.

Hardcoded rectangular zones in pixel coordinates (relative to a reference
resolution).  Uses the **foot-point** (bottom-center of the bounding box) for
zone assignment with a nearest-table-center fallback.

Temporal smoothing keeps a zone marked occupied for a configurable number of
seconds after the last detection to prevent flickering.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

LOG = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def foot_point(bbox: List[int]) -> Tuple[float, float]:
    """Return the bottom-center point of a bounding box (foot approximation).

    For seated people the bottom of the bounding box is the most stable
    proxy for where the person is physically located.

    Args:
        bbox: [x1, y1, x2, y2] in pixel coordinates.

    Returns:
        (px, py) — bottom-center point in pixel coordinates.
    """
    x1, y1, x2, y2 = bbox
    return ((x1 + x2) / 2.0, float(y2))


def scale_zone_bbox(
    bbox: List[int],
    ref_w: int,
    ref_h: int,
    frame_w: int,
    frame_h: int,
) -> Tuple[float, float, float, float]:
    """Scale a zone bbox from reference resolution to actual frame resolution.

    Args:
        bbox: [x1, y1, x2, y2] defined at the reference resolution.
        ref_w, ref_h: Reference resolution the bbox was authored for.
        frame_w, frame_h: Actual frame resolution.

    Returns:
        (x1, y1, x2, y2) scaled to the current frame.
    """
    sx = frame_w / ref_w
    sy = frame_h / ref_h
    return (bbox[0] * sx, bbox[1] * sy, bbox[2] * sx, bbox[3] * sy)


def point_in_rect(
    px: float, py: float,
    x1: float, y1: float, x2: float, y2: float,
) -> bool:
    """Return True if (*px*, *py*) lies inside the axis-aligned rectangle."""
    return x1 <= px <= x2 and y1 <= py <= y2


def distance_to_rect_center(
    px: float, py: float,
    x1: float, y1: float, x2: float, y2: float,
) -> float:
    """Euclidean distance from a point to the center of a rectangle."""
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0
    return math.sqrt((px - cx) ** 2 + (py - cy) ** 2)


def bbox_to_normalized_polygon(
    bbox: List[int],
    ref_w: int,
    ref_h: int,
) -> List[List[float]]:
    """Convert a pixel bbox to a normalised 4-vertex polygon (0-1 coords).

    Used by the API response so the frontend can overlay zones at any display
    resolution without changes.

    Returns:
        [[x1n, y1n], [x2n, y1n], [x2n, y2n], [x1n, y2n]]
    """
    x1, y1, x2, y2 = bbox
    x1n = x1 / ref_w
    y1n = y1 / ref_h
    x2n = x2 / ref_w
    y2n = y2 / ref_h
    return [[x1n, y1n], [x2n, y1n], [x2n, y2n], [x1n, y2n]]


# ---------------------------------------------------------------------------
# Zone assignment
# ---------------------------------------------------------------------------

def assign_person_to_zone(
    person_bbox: List[int],
    zones: List[dict],
    ref_w: int,
    ref_h: int,
    frame_w: int,
    frame_h: int,
    max_fallback_px: float = 200.0,
) -> Optional[str]:
    """Assign a single person detection to the best-matching zone.

    Algorithm
    ---------
    1. Compute the foot-point (bottom-center of the person bbox).
    2. If the foot-point falls inside exactly one zone rectangle → that zone.
    3. Otherwise fall back to the nearest zone center, but only if the
       distance (in reference-resolution pixels) is within *max_fallback_px*.

    Args:
        person_bbox: [x1, y1, x2, y2] of the person detection (frame pixels).
        zones: Zone config list; each entry must have ``zone_id`` and ``bbox``.
        ref_w, ref_h: Reference resolution for the zone coordinates.
        frame_w, frame_h: Actual frame resolution.
        max_fallback_px: Maximum distance (reference pixels) for the
            nearest-zone fallback.  Set to 0 to disable the fallback.

    Returns:
        ``zone_id`` of the matched zone, or *None*.
    """
    px, py = foot_point(person_bbox)

    # --- pass 1: containment ---
    for zone in zones:
        sx1, sy1, sx2, sy2 = scale_zone_bbox(
            zone["bbox"], ref_w, ref_h, frame_w, frame_h,
        )
        if point_in_rect(px, py, sx1, sy1, sx2, sy2):
            return zone["zone_id"]

    # --- pass 2: nearest zone center ---
    if max_fallback_px <= 0:
        return None

    scale_factor = frame_w / ref_w
    max_dist = max_fallback_px * scale_factor

    best_zone: Optional[str] = None
    best_dist = float("inf")
    for zone in zones:
        sx1, sy1, sx2, sy2 = scale_zone_bbox(
            zone["bbox"], ref_w, ref_h, frame_w, frame_h,
        )
        dist = distance_to_rect_center(px, py, sx1, sy1, sx2, sy2)
        if dist < best_dist:
            best_dist = dist
            best_zone = zone["zone_id"]

    return best_zone if best_dist <= max_dist else None


# ---------------------------------------------------------------------------
# Zone evaluation (per frame)
# ---------------------------------------------------------------------------

def evaluate_zones(
    detections: List[dict],
    zones: List[dict],
    frame_w: int,
    frame_h: int,
    ref_resolution: List[int],
    max_fallback_px: float = 200.0,
) -> Dict[str, bool]:
    """Map person detections to zones and return per-zone presence.

    Each detection is processed independently.  A zone is marked occupied if
    **any** person's foot-point falls inside it (or is the nearest zone within
    ``max_fallback_px``).

    Args:
        detections: List of dicts with ``class`` and ``bbox`` keys.
        zones: Zone config list.
        frame_w, frame_h: Frame dimensions in pixels.
        ref_resolution: ``[ref_w, ref_h]`` the zone bboxes were authored for.
        max_fallback_px: Fallback distance (reference pixels).

    Returns:
        ``{zone_id: bool}`` — True when at least one person is in/near the zone.
    """
    ref_w, ref_h = ref_resolution

    if frame_w <= 0 or frame_h <= 0:
        LOG.warning("Invalid frame dimensions: %dx%d", frame_w, frame_h)
        return {z["zone_id"]: False for z in zones}

    presence: Dict[str, bool] = {z["zone_id"]: False for z in zones}

    for det in detections:
        if det.get("class") != "person":
            continue
        zone_id = assign_person_to_zone(
            det["bbox"], zones, ref_w, ref_h, frame_w, frame_h,
            max_fallback_px=max_fallback_px,
        )
        if zone_id:
            presence[zone_id] = True

    return presence


# ---------------------------------------------------------------------------
# Temporal persistence (smoothing)
# ---------------------------------------------------------------------------

def apply_temporal_persistence(
    zone_presence: Dict[str, bool],
    zone_states: List[dict],
    now: Optional[datetime] = None,
) -> Dict[str, dict]:
    """Keep zones marked occupied for *delay_sec* after the last detection.

    This prevents single-frame drop-outs from flickering the zone off.

    Args:
        zone_presence: Current frame's detection result ``{zone_id: bool}``.
        zone_states: Previous state for each zone (from in-memory store).
            Each dict must contain ``zone_id``, ``is_occupied``,
            ``last_detected``, and ``delay_sec``.
        now: Current UTC timestamp (defaults to ``datetime.now(utc)``).

    Returns:
        ``{zone_id: {is_occupied, last_detected, appliance_state}}``
    """
    if now is None:
        now = datetime.now(timezone.utc)

    state_lookup = {s["zone_id"]: s for s in zone_states}
    result: Dict[str, dict] = {}

    for zone_id, currently_detected in zone_presence.items():
        prev = state_lookup.get(zone_id, {})
        delay_sec = prev.get("delay_sec", 3)

        if currently_detected:
            # Person detected right now — zone is occupied
            result[zone_id] = {
                "is_occupied": True,
                "last_detected": now.isoformat(),
                "appliance_state": "ON",
            }
        else:
            # No person — check whether we are inside the persistence window
            last_detected_str = prev.get("last_detected")
            last_detected = _parse_timestamp(last_detected_str)

            if last_detected and (now - last_detected).total_seconds() < delay_sec:
                result[zone_id] = {
                    "is_occupied": True,
                    "last_detected": last_detected_str,
                    "appliance_state": "ON",
                }
            else:
                result[zone_id] = {
                    "is_occupied": False,
                    "last_detected": last_detected_str,
                    "appliance_state": "OFF",
                }

    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_timestamp(value: object) -> Optional[datetime]:
    """Safely parse a timestamp string (ISO-8601) or pass through a datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None
    return None
