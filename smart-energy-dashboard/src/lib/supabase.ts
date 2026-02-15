import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Missing Supabase environment variables. ' +
        'Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_KEY.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export type Room = {
    room_id: string;
    room_name: string;
    length_m: number;
    width_m: number;
    floor: number;
    seating_capacity: number;
};

export type RoomSystem = {
    system_id: string;
    room_id: string;
    system_type: 'LIGHTING' | 'AC' | 'FAF' | 'UPS' | 'RAW_POWER';
    unit_count: number;
    unit_power_watts: number;
    total_power_watts: number;
    metadata?: Record<string, unknown>;
};

export type MonthlyEnergy = {
    energy_id: string;
    room_id: string;
    month: string;
    ac_kwh: number;
    lighting_kwh: number;
    raw_power_kwh: number;
    ups_kwh: number;
};
