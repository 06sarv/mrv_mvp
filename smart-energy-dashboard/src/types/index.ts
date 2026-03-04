export interface ZoneConfig {
  zone_id: string;
  zone_name: string;
  polygon: [number, number][];
  fan_count: number;
  light_count: number;
  fan_power_watts: number;
  light_power_watts: number;
}

export interface ZoneState {
  zone_id: string;
  zone_name: string;
  polygon: [number, number][];
  is_occupied: boolean;
  last_detected: string | null;
  appliance_state: 'ON' | 'OFF';
  fan_on: boolean;
  light_on: boolean;
  fan_power_watts: number;
  light_power_watts: number;
  zone_power_watts: number;
}

export interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface DetectResponse {
  people_count: number;
  detections: Detection[];
  zone_states: ZoneState[];
  total_power_watts: number;
  zones_occupied: number;
  zones_total: number;
}
