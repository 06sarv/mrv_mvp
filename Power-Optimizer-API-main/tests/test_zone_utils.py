"""Tests for zone_utils — polygon presence detection and temporal persistence."""

import unittest
from datetime import datetime, timezone, timedelta

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from zone_utils import (
    point_in_polygon,
    bbox_center,
    evaluate_zones,
    apply_temporal_persistence,
)


class TestPointInPolygon(unittest.TestCase):
    """Test ray-casting point-in-polygon."""

    def setUp(self):
        # Unit square
        self.square = [(0, 0), (1, 0), (1, 1), (0, 1)]

    def test_inside(self):
        self.assertTrue(point_in_polygon(0.5, 0.5, self.square))

    def test_outside(self):
        self.assertFalse(point_in_polygon(1.5, 0.5, self.square))
        self.assertFalse(point_in_polygon(-0.1, 0.5, self.square))

    def test_on_edge(self):
        # Edge behavior depends on implementation; just ensure no crash
        result = point_in_polygon(0, 0.5, self.square)
        self.assertIsInstance(result, bool)

    def test_triangle(self):
        triangle = [(0, 0), (2, 0), (1, 2)]
        self.assertTrue(point_in_polygon(1, 0.5, triangle))
        self.assertFalse(point_in_polygon(0, 1.5, triangle))


class TestBboxCenter(unittest.TestCase):
    def test_center(self):
        cx, cy = bbox_center(10, 20, 30, 40)
        self.assertEqual(cx, 20.0)
        self.assertEqual(cy, 30.0)

    def test_zero(self):
        cx, cy = bbox_center(0, 0, 0, 0)
        self.assertEqual(cx, 0.0)
        self.assertEqual(cy, 0.0)


class TestEvaluateZones(unittest.TestCase):
    """Test mapping detections to zones."""

    def setUp(self):
        # Two zones: left half and right half (normalized)
        self.zones = [
            {"zone_id": "zone-left", "polygon": [[0, 0], [0.5, 0], [0.5, 1], [0, 1]]},
            {"zone_id": "zone-right", "polygon": [[0.5, 0], [1, 0], [1, 1], [0.5, 1]]},
        ]
        self.frame_w = 640
        self.frame_h = 480

    def test_person_in_left_zone(self):
        detections = [{"class": "person", "bbox": [50, 100, 150, 300]}]
        result = evaluate_zones(detections, self.zones, self.frame_w, self.frame_h)
        self.assertTrue(result["zone-left"])
        self.assertFalse(result["zone-right"])

    def test_person_in_right_zone(self):
        detections = [{"class": "person", "bbox": [400, 100, 500, 300]}]
        result = evaluate_zones(detections, self.zones, self.frame_w, self.frame_h)
        self.assertFalse(result["zone-left"])
        self.assertTrue(result["zone-right"])

    def test_person_in_both_zones(self):
        detections = [
            {"class": "person", "bbox": [50, 100, 150, 300]},   # left
            {"class": "person", "bbox": [400, 100, 500, 300]},  # right
        ]
        result = evaluate_zones(detections, self.zones, self.frame_w, self.frame_h)
        self.assertTrue(result["zone-left"])
        self.assertTrue(result["zone-right"])

    def test_no_detections(self):
        result = evaluate_zones([], self.zones, self.frame_w, self.frame_h)
        self.assertFalse(result["zone-left"])
        self.assertFalse(result["zone-right"])

    def test_non_person_ignored(self):
        detections = [{"class": "chair", "bbox": [50, 100, 150, 300]}]
        result = evaluate_zones(detections, self.zones, self.frame_w, self.frame_h)
        self.assertFalse(result["zone-left"])


class TestTemporalPersistence(unittest.TestCase):
    """Test temporal persistence logic."""

    def test_currently_detected(self):
        """Zone with current detection should be occupied."""
        zone_presence = {"z1": True}
        zone_states = [{"zone_id": "z1", "is_occupied": False, "last_detected": None, "delay_sec": 120}]
        now = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        result = apply_temporal_persistence(zone_presence, zone_states, now)
        self.assertTrue(result["z1"]["is_occupied"])
        self.assertEqual(result["z1"]["appliance_state"], "ON")

    def test_within_persistence_window(self):
        """Zone not currently detected but within delay should stay occupied."""
        zone_presence = {"z1": False}
        last = datetime(2025, 1, 1, 11, 59, 0, tzinfo=timezone.utc)  # 60s ago
        zone_states = [{
            "zone_id": "z1",
            "is_occupied": True,
            "last_detected": last.isoformat(),
            "delay_sec": 120,
        }]
        now = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        result = apply_temporal_persistence(zone_presence, zone_states, now)
        self.assertTrue(result["z1"]["is_occupied"])
        self.assertEqual(result["z1"]["appliance_state"], "ON")

    def test_persistence_expired(self):
        """Zone not detected and past delay should be unoccupied."""
        zone_presence = {"z1": False}
        last = datetime(2025, 1, 1, 11, 57, 0, tzinfo=timezone.utc)  # 180s ago
        zone_states = [{
            "zone_id": "z1",
            "is_occupied": True,
            "last_detected": last.isoformat(),
            "delay_sec": 120,
        }]
        now = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        result = apply_temporal_persistence(zone_presence, zone_states, now)
        self.assertFalse(result["z1"]["is_occupied"])
        self.assertEqual(result["z1"]["appliance_state"], "OFF")

    def test_never_detected_and_no_current(self):
        """Zone never detected and not currently detected should be unoccupied."""
        zone_presence = {"z1": False}
        zone_states = [{"zone_id": "z1", "is_occupied": False, "last_detected": None, "delay_sec": 120}]
        now = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        result = apply_temporal_persistence(zone_presence, zone_states, now)
        self.assertFalse(result["z1"]["is_occupied"])
        self.assertEqual(result["z1"]["appliance_state"], "OFF")


if __name__ == "__main__":
    unittest.main()
