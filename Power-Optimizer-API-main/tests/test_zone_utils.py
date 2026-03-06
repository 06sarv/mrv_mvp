"""Tests for zone_utils — rectangle-based zone assignment and temporal persistence."""

import unittest
from datetime import datetime, timezone, timedelta

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from zone_utils import (
    foot_point,
    point_in_rect,
    scale_zone_bbox,
    distance_to_rect_center,
    bbox_to_normalized_polygon,
    assign_person_to_zone,
    evaluate_zones,
    apply_temporal_persistence,
)


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

class TestFootPoint(unittest.TestCase):
    """Foot-point should be bottom-center of the bbox."""

    def test_basic(self):
        px, py = foot_point([100, 200, 300, 500])
        self.assertAlmostEqual(px, 200.0)
        self.assertAlmostEqual(py, 500.0)

    def test_zero_box(self):
        px, py = foot_point([0, 0, 0, 0])
        self.assertAlmostEqual(px, 0.0)
        self.assertAlmostEqual(py, 0.0)


class TestPointInRect(unittest.TestCase):
    def test_inside(self):
        self.assertTrue(point_in_rect(5, 5, 0, 0, 10, 10))

    def test_outside(self):
        self.assertFalse(point_in_rect(15, 5, 0, 0, 10, 10))
        self.assertFalse(point_in_rect(5, 15, 0, 0, 10, 10))

    def test_on_edge(self):
        # Edges are inclusive
        self.assertTrue(point_in_rect(0, 0, 0, 0, 10, 10))
        self.assertTrue(point_in_rect(10, 10, 0, 0, 10, 10))


class TestScaleZoneBbox(unittest.TestCase):
    def test_same_resolution(self):
        result = scale_zone_bbox([100, 200, 300, 400], 3840, 2160, 3840, 2160)
        self.assertEqual(result, (100, 200, 300, 400))

    def test_half_resolution(self):
        result = scale_zone_bbox([100, 200, 300, 400], 3840, 2160, 1920, 1080)
        self.assertAlmostEqual(result[0], 50)
        self.assertAlmostEqual(result[1], 100)
        self.assertAlmostEqual(result[2], 150)
        self.assertAlmostEqual(result[3], 200)


class TestBboxToNormalizedPolygon(unittest.TestCase):
    def test_basic(self):
        poly = bbox_to_normalized_polygon([0, 0, 3840, 2160], 3840, 2160)
        self.assertEqual(poly, [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]])

    def test_partial(self):
        poly = bbox_to_normalized_polygon([1920, 1080, 3840, 2160], 3840, 2160)
        self.assertAlmostEqual(poly[0][0], 0.5)
        self.assertAlmostEqual(poly[0][1], 0.5)
        self.assertAlmostEqual(poly[2][0], 1.0)
        self.assertAlmostEqual(poly[2][1], 1.0)


# ---------------------------------------------------------------------------
# Zone assignment
# ---------------------------------------------------------------------------

class TestAssignPersonToZone(unittest.TestCase):
    """Test foot-point zone assignment with containment and fallback."""

    def setUp(self):
        # Two non-overlapping zones at reference resolution 1000x1000
        self.zones = [
            {"zone_id": "left", "bbox": [0, 0, 500, 1000]},
            {"zone_id": "right", "bbox": [500, 0, 1000, 1000]},
        ]
        self.ref_w = 1000
        self.ref_h = 1000

    def test_person_in_left(self):
        # Person bbox: bottom-center = (150, 800)  → inside left zone
        result = assign_person_to_zone(
            [100, 600, 200, 800], self.zones,
            self.ref_w, self.ref_h, 1000, 1000,
        )
        self.assertEqual(result, "left")

    def test_person_in_right(self):
        # Bottom-center = (700, 800) → inside right zone
        result = assign_person_to_zone(
            [600, 600, 800, 800], self.zones,
            self.ref_w, self.ref_h, 1000, 1000,
        )
        self.assertEqual(result, "right")

    def test_person_outside_with_fallback(self):
        # Bottom-center = (250, 1050) → outside both, left center=(250,500) dist=550
        result = assign_person_to_zone(
            [200, 900, 300, 1050], self.zones,
            self.ref_w, self.ref_h, 1000, 1000,
            max_fallback_px=600,
        )
        self.assertEqual(result, "left")

    def test_person_too_far_away(self):
        # Bottom-center = (500, 2000) → far from everything
        result = assign_person_to_zone(
            [450, 1800, 550, 2000], self.zones,
            self.ref_w, self.ref_h, 1000, 1000,
            max_fallback_px=100,
        )
        self.assertIsNone(result)


class TestEvaluateZones(unittest.TestCase):
    """Test mapping detections to zones using foot-point."""

    def setUp(self):
        self.zones = [
            {"zone_id": "zone-left", "bbox": [0, 0, 500, 1000]},
            {"zone_id": "zone-right", "bbox": [500, 0, 1000, 1000]},
        ]
        self.ref = [1000, 1000]
        self.frame_w = 1000
        self.frame_h = 1000

    def test_person_in_left_zone(self):
        # Foot-point: (150, 800) → inside left
        detections = [{"class": "person", "bbox": [100, 600, 200, 800]}]
        result = evaluate_zones(detections, self.zones, self.frame_w, self.frame_h, self.ref)
        self.assertTrue(result["zone-left"])
        self.assertFalse(result["zone-right"])

    def test_person_in_right_zone(self):
        # Foot-point: (700, 800) → inside right
        detections = [{"class": "person", "bbox": [600, 600, 800, 800]}]
        result = evaluate_zones(detections, self.zones, self.frame_w, self.frame_h, self.ref)
        self.assertFalse(result["zone-left"])
        self.assertTrue(result["zone-right"])

    def test_people_in_both_zones(self):
        detections = [
            {"class": "person", "bbox": [100, 600, 200, 800]},   # left
            {"class": "person", "bbox": [600, 600, 800, 800]},   # right
        ]
        result = evaluate_zones(detections, self.zones, self.frame_w, self.frame_h, self.ref)
        self.assertTrue(result["zone-left"])
        self.assertTrue(result["zone-right"])

    def test_no_detections(self):
        result = evaluate_zones([], self.zones, self.frame_w, self.frame_h, self.ref)
        self.assertFalse(result["zone-left"])
        self.assertFalse(result["zone-right"])

    def test_non_person_ignored(self):
        detections = [{"class": "chair", "bbox": [100, 600, 200, 800]}]
        result = evaluate_zones(detections, self.zones, self.frame_w, self.frame_h, self.ref)
        self.assertFalse(result["zone-left"])


# ---------------------------------------------------------------------------
# Temporal persistence
# ---------------------------------------------------------------------------

class TestTemporalPersistence(unittest.TestCase):
    """Test temporal persistence logic."""

    def test_currently_detected(self):
        """Zone with current detection should be occupied."""
        zone_presence = {"z1": True}
        zone_states = [{"zone_id": "z1", "is_occupied": False, "last_detected": None, "delay_sec": 3}]
        now = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        result = apply_temporal_persistence(zone_presence, zone_states, now)
        self.assertTrue(result["z1"]["is_occupied"])
        self.assertEqual(result["z1"]["appliance_state"], "ON")

    def test_within_persistence_window(self):
        """Zone not currently detected but within delay should stay occupied."""
        zone_presence = {"z1": False}
        last = datetime(2025, 1, 1, 11, 59, 58, tzinfo=timezone.utc)  # 2s ago
        zone_states = [{
            "zone_id": "z1",
            "is_occupied": True,
            "last_detected": last.isoformat(),
            "delay_sec": 3,
        }]
        now = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        result = apply_temporal_persistence(zone_presence, zone_states, now)
        self.assertTrue(result["z1"]["is_occupied"])
        self.assertEqual(result["z1"]["appliance_state"], "ON")

    def test_persistence_expired(self):
        """Zone not detected and past delay should be unoccupied."""
        zone_presence = {"z1": False}
        last = datetime(2025, 1, 1, 11, 59, 55, tzinfo=timezone.utc)  # 5s ago
        zone_states = [{
            "zone_id": "z1",
            "is_occupied": True,
            "last_detected": last.isoformat(),
            "delay_sec": 3,
        }]
        now = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        result = apply_temporal_persistence(zone_presence, zone_states, now)
        self.assertFalse(result["z1"]["is_occupied"])
        self.assertEqual(result["z1"]["appliance_state"], "OFF")

    def test_never_detected_and_no_current(self):
        """Zone never detected and not currently detected should be unoccupied."""
        zone_presence = {"z1": False}
        zone_states = [{"zone_id": "z1", "is_occupied": False, "last_detected": None, "delay_sec": 3}]
        now = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        result = apply_temporal_persistence(zone_presence, zone_states, now)
        self.assertFalse(result["z1"]["is_occupied"])
        self.assertEqual(result["z1"]["appliance_state"], "OFF")

    def test_smoothing_prevents_flickering(self):
        """Simulate detection → miss → still occupied (within window)."""
        now = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        # Frame 1: person detected
        result1 = apply_temporal_persistence(
            {"z1": True},
            [{"zone_id": "z1", "is_occupied": False, "last_detected": None, "delay_sec": 3}],
            now,
        )
        self.assertTrue(result1["z1"]["is_occupied"])

        # Frame 2 (1s later): detection lost — should still be occupied
        result2 = apply_temporal_persistence(
            {"z1": False},
            [{"zone_id": "z1", "is_occupied": True, "last_detected": now.isoformat(), "delay_sec": 3}],
            now + timedelta(seconds=1),
        )
        self.assertTrue(result2["z1"]["is_occupied"])
        self.assertEqual(result2["z1"]["appliance_state"], "ON")

        # Frame 3 (4s later): still no detection — persistence expired
        result3 = apply_temporal_persistence(
            {"z1": False},
            [{"zone_id": "z1", "is_occupied": True, "last_detected": now.isoformat(), "delay_sec": 3}],
            now + timedelta(seconds=4),
        )
        self.assertFalse(result3["z1"]["is_occupied"])
        self.assertEqual(result3["z1"]["appliance_state"], "OFF")


if __name__ == "__main__":
    unittest.main()
