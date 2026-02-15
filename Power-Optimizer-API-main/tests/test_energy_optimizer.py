import unittest
from datetime import datetime, timezone
import sys
import os

# Add parent directory to path so we can import the module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from energy_optimizer import (
    optimize_room,
    Room,
    Occupancy,
    Appliance,
    ApplianceState,
    PEOPLE_PER_UNIT
)

class TestEnergyOptimizer(unittest.TestCase):
    def setUp(self):
        self.room = Room(room_id=1, max_capacity=20)
        self.appliances = [
            Appliance(appliance_id=1, room_id=1, appliance_type="AC", max_power_watts=2000, adjustable=True, number_of_appliances=2),
            Appliance(appliance_id=2, room_id=1, appliance_type="FAN", max_power_watts=75, adjustable=True, number_of_appliances=4),
            Appliance(appliance_id=3, room_id=1, appliance_type="LIGHT", max_power_watts=40, adjustable=False, number_of_appliances=6)
        ]

    def test_empty_room_all_off(self):
        """Test that everything turns OFF when the room is empty."""
        occupancy = Occupancy(room_id=1, people_count=0, detected_at="", confidence=1.0)
        result = optimize_room(self.room, occupancy, self.appliances)
        
        for state in result:
            self.assertEqual(state.status, "OFF")
            self.assertEqual(state.estimated_power_watts, 0)

    def test_low_occupancy_no_ac(self):
        """Test that AC stays OFF if occupancy is too low (< 2 people)."""
        occupancy = Occupancy(room_id=1, people_count=1, detected_at="", confidence=1.0)
        result = optimize_room(self.room, occupancy, self.appliances)
        
        ac_state = next(s for s in result if s.appliance_id == 1)
        self.assertEqual(ac_state.status, "OFF") # AC needs 2+ people

        fan_state = next(s for s in result if s.appliance_id == 2)
        self.assertEqual(fan_state.status, "ON") # Fan needs 1+ person

    def test_high_occupancy_scaling(self):
        """Test that levels increase with more people."""
        # Low load
        occ_low = Occupancy(room_id=1, people_count=5, detected_at="", confidence=1.0)
        res_low = optimize_room(self.room, occ_low, self.appliances)
        
        # High load
        occ_high = Occupancy(room_id=1, people_count=18, detected_at="", confidence=1.0)
        res_high = optimize_room(self.room, occ_high, self.appliances)

        ac_low = next(s for s in res_low if s.appliance_id == 1)
        ac_high = next(s for s in res_high if s.appliance_id == 1)
        
        self.assertTrue(ac_high.level > ac_low.level, "AC level should increase with occupancy") 

    def test_temperature_bias_hot(self):
        """Test that high outdoor temperature increases AC level."""
        occupancy = Occupancy(room_id=1, people_count=10, detected_at="", confidence=1.0)
        
        # Normal temp
        res_normal = optimize_room(self.room, occupancy, self.appliances, outside_temp_c=25)
        # Hot temp
        res_hot = optimize_room(self.room, occupancy, self.appliances, outside_temp_c=35)

        ac_normal = next(s for s in res_normal if s.appliance_id == 1)
        ac_hot = next(s for s in res_hot if s.appliance_id == 1)

        self.assertTrue(ac_hot.level > ac_normal.level, "AC level should increase when it's hot outside")

    def test_temperature_bias_cold(self):
        """Test that cold outdoor temperature decreases levels."""
        occupancy = Occupancy(room_id=1, people_count=10, detected_at="", confidence=1.0)
        
        # Normal temp
        res_normal = optimize_room(self.room, occupancy, self.appliances, outside_temp_c=25)
        # Cold temp
        res_cold = optimize_room(self.room, occupancy, self.appliances, outside_temp_c=15)

        ac_normal = next(s for s in res_normal if s.appliance_id == 1)
        ac_cold = next(s for s in res_cold if s.appliance_id == 1)

        self.assertTrue(ac_cold.level < ac_normal.level, "AC level should decrease when it's cold outside")

    def test_input_validation(self):
        """Test that invalid inputs raise ValueErrors."""
        # Mismatched room ID
        occupancy = Occupancy(room_id=999, people_count=5, detected_at="", confidence=1.0)
        with self.assertRaises(ValueError):
            optimize_room(self.room, occupancy, self.appliances)

        # Negative people count
        occupancy = Occupancy(room_id=1, people_count=-5, detected_at="", confidence=1.0)
        with self.assertRaises(ValueError):
            optimize_room(self.room, occupancy, self.appliances)

if __name__ == '__main__':
    unittest.main()
