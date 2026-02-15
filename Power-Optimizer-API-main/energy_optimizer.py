"""Production-ready energy optimization module for an industrial smart building.

This module remains self-contained (no DB connectivity) and mirrors DB tables
with dataclasses. It fetches outdoor weather (Google first, Open-Meteo fallback),
optimizes appliance states using occupancy and temperature heuristics, and
returns a deterministic recommendation payload suitable for an API layer.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from math import ceil
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib import error, request


# ---------------------------------------------------------------------------
# Data models that mirror DB tables
# ---------------------------------------------------------------------------


@dataclass
class Room:
    room_id: int
    max_capacity: int


@dataclass
class Occupancy:
    room_id: int
    people_count: int
    detected_at: str  # ISO timestamp string for simplicity
    confidence: float  # 0.0 to 1.0


@dataclass
class Appliance:
    appliance_id: int
    room_id: int
    appliance_type: str  # e.g., "AC", "FAN", "LIGHT"
    max_power_watts: int
    adjustable: bool
    number_of_appliances: int = 1


@dataclass
class ApplianceState:
    appliance_id: int
    appliance_type: str  # Added field for UI
    status: str  # "ON" or "OFF"
    level: Optional[int]  # None for non-adjustable or when OFF
    estimated_power_watts: int
    updated_at: str  # ISO timestamp string


@dataclass
class WeatherConditions:
    temperature_c: float
    humidity: Optional[float]
    observed_at: str


LOG = logging.getLogger(__name__)

# Default people-per-unit assumptions for a more realistic split across multiple devices.
PEOPLE_PER_UNIT: Dict[str, int] = {
    "AC": 6,
    "FAN": 4,
    "LIGHT": 2,
}


class GoogleWeatherProvider:
    """Fetch current conditions via Google Maps Weather API.

    Expects the environment variable GOOGLE_WEATHER_API_KEY to be set.
    See: https://developers.google.com/maps/documentation/weather
    """

    BASE_URL = "https://weather.googleapis.com/v1/weather:lookup"

    def __init__(self, latitude: float, longitude: float, api_key: Optional[str] = None):
        self.latitude = latitude
        self.longitude = longitude
        self.api_key = api_key or os.getenv("GOOGLE_WEATHER_API_KEY")

    def get_current_conditions(self, timeout: float = 5.0) -> Optional[WeatherConditions]:
        if not self.api_key:
            LOG.debug("GoogleWeatherProvider skipped: missing API key")
            return None

        url = (
            f"{self.BASE_URL}?location={self.latitude},{self.longitude}"
            "&units=metric&languageCode=en&hourlyOnly=false"
            f"&key={self.api_key}"
        )

        try:
            with request.urlopen(url, timeout=timeout) as resp:
                if resp.status != 200:
                    LOG.warning("GoogleWeatherProvider HTTP %s", resp.status)
                    return None
                payload = json.loads(resp.read().decode("utf-8"))
        except (error.URLError, error.HTTPError, TimeoutError, ValueError) as exc:
            LOG.warning("GoogleWeatherProvider error: %s", exc)
            return None

        current = payload.get("currentWeather") or payload.get("current") or {}
        temp = current.get("temperature")
        humidity = current.get("humidity")
        timestamp = current.get("time") or datetime.now(timezone.utc).isoformat()

        if temp is None:
            LOG.warning("GoogleWeatherProvider missing temperature in response")
            return None

        return WeatherConditions(
            temperature_c=float(temp),
            humidity=float(humidity) if humidity is not None else None,
            observed_at=str(timestamp),
        )


class OpenMeteoWeatherProvider:
    """Lightweight weather fetcher using the free Open-Meteo API (no key required).

    This keeps us unblocked while you evaluate other providers (e.g., Google).
    """

    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    def __init__(self, latitude: float, longitude: float):
        self.latitude = latitude
        self.longitude = longitude

    def get_current_conditions(self, timeout: float = 5.0) -> Optional[WeatherConditions]:
        url = (
            f"{self.BASE_URL}?latitude={self.latitude}&longitude={self.longitude}"
            "&current_weather=true&hourly=relativehumidity_2m"
        )

        try:
            with request.urlopen(url, timeout=timeout) as resp:
                if resp.status != 200:
                    LOG.warning("OpenMeteo HTTP %s", resp.status)
                    return None
                payload = json.loads(resp.read().decode("utf-8"))
        except (error.URLError, error.HTTPError, TimeoutError, ValueError) as exc:
            LOG.warning("OpenMeteo error: %s", exc)
            return None

        current = payload.get("current_weather") or {}
        temp = current.get("temperature")
        timestamp = current.get("time") or datetime.now(timezone.utc).isoformat()

        humidity = None
        # Try to read the first hourly humidity value if present.
        hourly = payload.get("hourly") or {}
        humidity_values = hourly.get("relativehumidity_2m")
        if isinstance(humidity_values, list) and humidity_values:
            humidity = humidity_values[0]

        if temp is None:
            LOG.warning("OpenMeteo missing temperature in response")
            return None

        return WeatherConditions(
            temperature_c=float(temp),
            humidity=float(humidity) if humidity is not None else None,
            observed_at=str(timestamp),
        )


# ---------------------------------------------------------------------------
# Core optimization logic
# ---------------------------------------------------------------------------


def optimize_room(
    room: Room,
    occupancy: Occupancy,
    appliances: Sequence[Appliance],
    outside_temp_c: Optional[float] = None,
) -> List[ApplianceState]:
    """Recommend appliance states for a room based on occupancy.

    Rules applied:
    - If people_count == 0: everything OFF.
    - If people_count < room.max_capacity: reduce power proportionally and per-unit.
    - AC turns ON only when people_count >= 2.
    - Lights and fans require at least 1 person.
    - Per-unit capacity by type (people-per-unit) decides how many units to activate.

    The function returns a list of ApplianceState recommendations; caller can
    later persist them to the DB.
    """

    _validate_inputs(room, occupancy, appliances)

    people = occupancy.people_count
    now_iso = datetime.now(timezone.utc).isoformat()

    if room.max_capacity <= 0:
        raise ValueError("room.max_capacity must be positive")

    # if people < 0:
    #     raise ValueError("people_count must be non-negative")

    # When empty, everything is off.
    if people == 0:
        return [
            ApplianceState(
                appliance_id=a.appliance_id,
                appliance_type=a.appliance_type,
                status="OFF",
                level=None,
                estimated_power_watts=0,
                updated_at=now_iso,
            )
            for a in appliances
        ]

    # Scale between 0 and 1 based on occupancy versus capacity.
    load_factor = min(1.0, people / room.max_capacity)

    recommendations: List[ApplianceState] = []
    for appliance in appliances:
        should_run, level, units_on = _decide_appliance_state(appliance, people, load_factor)

        if not should_run:
            recommendations.append(
                ApplianceState(
                    appliance_id=appliance.appliance_id,
                    appliance_type=appliance.appliance_type,
                    status="OFF",
                    level=None,
                    estimated_power_watts=0,
                    updated_at=now_iso,
                )
            )
            continue

        if level is not None:
            level = _apply_temperature_bias(level, outside_temp_c)

        estimated_power = _estimate_power(appliance, level, units_on)
        recommendations.append(
            ApplianceState(
                appliance_id=appliance.appliance_id,
                appliance_type=appliance.appliance_type,
                status="ON",
                level=level,
                estimated_power_watts=estimated_power,
                updated_at=now_iso,
            )
        )

    return recommendations


def _validate_inputs(room: Room, occupancy: Occupancy, appliances: Sequence[Appliance]) -> None:
    if occupancy.room_id != room.room_id:
        raise ValueError("occupancy.room_id does not match room.room_id")
    for appliance in appliances:
        if appliance.room_id != room.room_id:
            raise ValueError(f"appliance {appliance.appliance_id} is not in room {room.room_id}")


def _decide_appliance_state(
    appliance: Appliance, people: int, load_factor: float
) -> Tuple[bool, Optional[int], int]:
    """Return (should_run, level, units_on) for an appliance.

    - For adjustable devices, level is 1-10 (10 = full power).
    - For non-adjustable devices, level is None.
    """

    appliance_type = appliance.appliance_type.upper()

    # Basic presence requirements per type.
    if people < 1 and appliance_type in {"LIGHT", "FAN"}:
        return False, None, 0
    if people < 2 and appliance_type == "AC":
        return False, None, 0

    units_on = _compute_units_on(appliance_type, appliance.number_of_appliances, people)

    if not appliance.adjustable:
        return True, None, units_on

    # Adjustable: map occupancy load to a discrete level 1-10.
    per_unit_cap = PEOPLE_PER_UNIT.get(appliance_type, 1)
    load_per_unit = min(1.0, people / (units_on * per_unit_cap)) if units_on else 0
    level = _clamp_level(round(load_per_unit * 10))
    return True, level, units_on


def _estimate_power(appliance: Appliance, level: Optional[int], units_on: int) -> int:
    """Estimate power draw in watts for the appliance recommendation."""

    units = max(1, units_on)

    if appliance.adjustable and level:
        # Linear scaling with the level (1-10).
        per_unit = appliance.max_power_watts * (level / 10)
        return int(per_unit * units)

    # Non-adjustable or level None: assume full draw when ON.
    return appliance.max_power_watts * units


def _apply_temperature_bias(level: int, outside_temp_c: Optional[float]) -> int:
    """Nudge the level based on outdoor temperature.

    Simple heuristic:
    - Very hot (>= 32C): +2
    - Warm (>= 28C): +1
    - Cool (<= 22C): -1
    - Cold (<= 18C): -2
    """

    if outside_temp_c is None:
        return level

    bias = 0
    if outside_temp_c >= 32:
        bias = 2
    elif outside_temp_c >= 28:
        bias = 1
    elif outside_temp_c <= 18:
        bias = -2
    elif outside_temp_c <= 22:
        bias = -1

    return _clamp_level(level + bias)


def _compute_units_on(appliance_type: str, available_units: int, people: int) -> int:
    per_unit_cap = PEOPLE_PER_UNIT.get(appliance_type, 1)
    if people <= 0:
        return 0
    needed = ceil(people / per_unit_cap)
    return max(1, min(available_units, needed))


def _get_first_available_conditions(providers: Sequence[object]) -> Optional[WeatherConditions]:
    """Return the first successful weather conditions from a provider list."""
    for provider in providers:
        getter = getattr(provider, "get_current_conditions", None)
        if not callable(getter):
            continue
        conditions = getter()
        if conditions:
            return conditions
    return None


def _clamp_level(level: int) -> int:
    return max(1, min(10, level))


def _load_demo_payload() -> Optional[Dict[str, Any]]:
    inline_json = os.getenv("DEMO_INPUT_JSON")
    file_path = os.getenv("DEMO_INPUT_FILE")

    raw = None
    if inline_json:
        raw = inline_json
    elif file_path:
        try:
            with open(file_path, "r", encoding="utf-8") as fh:
                raw = fh.read()
        except OSError as exc:
            LOG.error("Failed to read demo input file: %s", exc)
            return None

    if not raw:
        return None

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        LOG.error("Invalid JSON for demo input: %s", exc)
        return None

    if not isinstance(payload, dict):
        LOG.error("Demo input must be a JSON object")
        return None

    required_keys = {"room", "occupancy", "appliances"}
    if not required_keys.issubset(payload.keys()):
        missing = required_keys - set(payload.keys())
        LOG.error("Demo input missing keys: %s", ", ".join(sorted(missing)))
        return None

    return payload


def _parse_room(data: Dict[str, Any]) -> Room:
    return Room(
        room_id=int(data["room_id"]),
        max_capacity=int(data["max_capacity"]),
    )


def _parse_occupancy(data: Dict[str, Any]) -> Occupancy:
    return Occupancy(
        room_id=int(data["room_id"]),
        people_count=int(data["people_count"]),
        detected_at=str(data.get("detected_at") or datetime.now(timezone.utc).isoformat()),
        confidence=float(data.get("confidence", 1.0)),
    )


def _parse_appliance(data: Dict[str, Any]) -> Appliance:
    return Appliance(
        appliance_id=int(data["appliance_id"]),
        room_id=int(data["room_id"]),
        appliance_type=str(data["appliance_type"]),
        max_power_watts=int(data.get("max_power_watts") or 60),
        adjustable=bool(data.get("adjustable", True)),
        number_of_appliances=int(data.get("number_of_appliances", 1)),
    )


# ---------------------------------------------------------------------------
# Demo usage with mocked data
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    # Demo input is now external to avoid hardcoded values.
    # Provide either DEMO_INPUT_JSON (inline JSON string) or DEMO_INPUT_FILE (path to JSON).
    demo_payload = _load_demo_payload()
    if not demo_payload:
        raise SystemExit(
            "Set DEMO_INPUT_JSON or DEMO_INPUT_FILE with room, occupancy, appliances, "
            "and optional latitude/longitude"
        )

    room = _parse_room(demo_payload["room"])
    occupancy = _parse_occupancy(demo_payload["occupancy"])
    appliances = [_parse_appliance(a) for a in demo_payload["appliances"]]

    latitude = demo_payload.get("latitude")
    longitude = demo_payload.get("longitude")

    providers: Sequence[object] = []
    if latitude is not None and longitude is not None:
        providers = [
            GoogleWeatherProvider(latitude=latitude, longitude=longitude),
            OpenMeteoWeatherProvider(latitude=latitude, longitude=longitude),
        ]

    conditions = _get_first_available_conditions(providers) if providers else None
    outside_temp_c = conditions.temperature_c if conditions else None

    recommendations = optimize_room(
        room,
        occupancy,
        appliances,
        outside_temp_c=outside_temp_c,
    )

    total_power = sum(r.estimated_power_watts for r in recommendations)

    print("Recommendations for room", room.room_id)
    print("People:", occupancy.people_count, "/", room.max_capacity)
    print("Outside temp (C):", outside_temp_c)
    print("Confidence:", occupancy.confidence)
    print("--")
    for rec in recommendations:
        print(
            f"{rec.appliance_id}: status={rec.status}, "
            f"level={rec.level}, estimated_power={rec.estimated_power_watts} W"
        )
    print("Total estimated power:", total_power, "W")
