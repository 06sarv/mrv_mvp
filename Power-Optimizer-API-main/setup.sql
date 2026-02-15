-- ============================================================
-- MRV Smart Energy Dashboard — Complete Database Setup
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. CORE TABLES
-- ============================================================

-- Rooms (from Excel data)
CREATE TABLE IF NOT EXISTS rooms (
    room_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT NOT NULL,
    length_m  NUMERIC(6,2),
    width_m   NUMERIC(6,2),
    floor     INT,
    seating_capacity INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Room Systems (AC / Lighting / FAF / UPS design parameters)
CREATE TABLE IF NOT EXISTS room_systems (
    system_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id           UUID REFERENCES rooms(room_id) ON DELETE CASCADE,
    system_type       TEXT NOT NULL,  -- 'LIGHTING', 'AC', 'FAF', 'UPS', 'RAW_POWER'
    unit_count        INT,
    unit_power_watts  NUMERIC(10,2),
    total_power_watts NUMERIC(10,2),
    active_count      INT,           -- current active units (updated by optimizer)
    metadata          JSONB,
    created_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. REAL-TIME TABLES
-- ============================================================

-- Occupancy logs (written by /detect endpoint)
CREATE TABLE IF NOT EXISTS occupancy_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     VARCHAR(50) NOT NULL,
    people_count INT NOT NULL,
    confidence  FLOAT,
    detected_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-cleanup: keep only latest occupancy per room
CREATE OR REPLACE FUNCTION delete_old_occupancy()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM occupancy_logs
    WHERE room_id = NEW.room_id AND id != NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delete_old_occupancy ON occupancy_logs;
CREATE TRIGGER trigger_delete_old_occupancy
AFTER INSERT ON occupancy_logs
FOR EACH ROW EXECUTE FUNCTION delete_old_occupancy();

-- System state log (ON/OFF + load level, written on accept)
CREATE TABLE IF NOT EXISTS system_state (
    state_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id           UUID REFERENCES room_systems(system_id) ON DELETE CASCADE,
    status              TEXT,            -- ON / OFF
    load_percent        NUMERIC(5,2),
    estimated_power_watts NUMERIC(10,2),
    source              TEXT,            -- 'user_optimization'
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Optimizations (written by /optimize endpoint)
CREATE TABLE IF NOT EXISTS optimizations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id           TEXT NOT NULL,
    total_power_watts NUMERIC(10,2),
    optimization_data JSONB,
    is_accepted       BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. HISTORICAL ENERGY DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_energy (
    energy_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id          UUID REFERENCES rooms(room_id) ON DELETE CASCADE,
    month            DATE NOT NULL,
    ac_kwh           NUMERIC(12,2),
    lighting_kwh     NUMERIC(12,2),
    raw_power_kwh    NUMERIC(12,2),
    ups_kwh          NUMERIC(12,2),
    created_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE (room_id, month)
);

-- Energy savings log (optional)
CREATE TABLE IF NOT EXISTS energy_savings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     VARCHAR(50) NOT NULL,
    watts_saved INT,
    recorded_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE rooms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_systems      ENABLE ROW LEVEL SECURITY;
ALTER TABLE occupancy_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_energy    ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_savings    ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write for all tables (development)
-- In production, replace with proper auth policies
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'rooms', 'room_systems', 'occupancy_logs',
        'system_state', 'optimizations', 'monthly_energy', 'energy_savings'
    ]) LOOP
        EXECUTE format('CREATE POLICY IF NOT EXISTS "anon_select_%s" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY IF NOT EXISTS "anon_insert_%s" ON %I FOR INSERT TO anon WITH CHECK (true)', tbl, tbl);
        EXECUTE format('CREATE POLICY IF NOT EXISTS "anon_update_%s" ON %I FOR UPDATE TO anon USING (true) WITH CHECK (true)', tbl, tbl);
    END LOOP;
END $$;

-- ============================================================
-- 5. SEED DATA (from Excel)
-- ============================================================

-- Rooms
INSERT INTO rooms (room_name, length_m, width_m, floor, seating_capacity)
VALUES
    ('MTA Seating Area - 1 (Near VES Lab)', 27.2, 12.2, 1, 78),
    ('MTA Seating Area - 2 (Opp to MTA Office)', 32.5, 12.2, 1, 111)
ON CONFLICT DO NOTHING;

-- Room Systems — LIGHTING
INSERT INTO room_systems (room_id, system_type, unit_count, unit_power_watts, total_power_watts, active_count)
SELECT room_id, 'LIGHTING', 32, 36, 32 * 36, 32
FROM rooms WHERE room_name LIKE '%Area - 1%';

INSERT INTO room_systems (room_id, system_type, unit_count, unit_power_watts, total_power_watts, active_count)
SELECT room_id, 'LIGHTING', 44, 36, 44 * 36, 44
FROM rooms WHERE room_name LIKE '%Area - 2%';

-- Room Systems — AC
INSERT INTO room_systems (room_id, system_type, unit_count, total_power_watts, active_count, metadata)
SELECT room_id, 'AC', 8, 26860, 8,
    jsonb_build_object('hp', 36, 'indoor_units', 8, 'ac_indoor_kw', 6.4)
FROM rooms WHERE room_name LIKE '%Area - 1%';

INSERT INTO room_systems (room_id, system_type, unit_count, total_power_watts, active_count, metadata)
SELECT room_id, 'AC', 12, 38790, 12,
    jsonb_build_object('hp', 52, 'indoor_units', 12, 'ac_indoor_kw', 9.6)
FROM rooms WHERE room_name LIKE '%Area - 2%';

-- Room Systems — FAF (Fresh Air Fans)
INSERT INTO room_systems (room_id, system_type, unit_count, total_power_watts, active_count, metadata)
SELECT room_id, 'FAF', 2, 2000, 2, jsonb_build_object('cfm', 1000)
FROM rooms WHERE room_name LIKE '%Area - 1%';

INSERT INTO room_systems (room_id, system_type, unit_count, total_power_watts, active_count, metadata)
SELECT room_id, 'FAF', 3, 3000, 3, jsonb_build_object('cfm', 2000)
FROM rooms WHERE room_name LIKE '%Area - 2%';

-- Room Systems — UPS
INSERT INTO room_systems (room_id, system_type, unit_count, total_power_watts, active_count)
SELECT room_id, 'UPS', 1, 1200, 1
FROM rooms WHERE room_name LIKE '%Area - 1%';

INSERT INTO room_systems (room_id, system_type, unit_count, total_power_watts, active_count)
SELECT room_id, 'UPS', 1, 1100, 1
FROM rooms WHERE room_name LIKE '%Area - 2%';

-- Monthly Energy — Seating Area 1 (Apr 2023 – Feb 2024)
INSERT INTO monthly_energy (room_id, month, ac_kwh, lighting_kwh, raw_power_kwh, ups_kwh)
SELECT room_id, m.month, m.ac_kwh, m.lighting_kwh, m.raw_power_kwh, m.ups_kwh
FROM rooms
CROSS JOIN LATERAL (
    VALUES
    (date '2023-04-01', 10017.51, 2640.21, 967.56,  1130.00),
    (date '2023-05-01', 10099.49, 2753.85, 1106.39, 1150.55),
    (date '2023-06-01', 10442.59, 2583.00, 952.15,  1125.23),
    (date '2023-07-01', 10068.31, 2802.32, 1006.12, 1110.11),
    (date '2023-08-01', 9029.95,  2538.00, 1107.12, 1145.22),
    (date '2023-09-01', 10281.82, 2621.98, 1016.65, 1131.22),
    (date '2023-10-01', 10111.16, 2715.73, 900.95,  1128.06),
    (date '2023-11-01', 6663.30,  135.33,  829.16,  1180.02),
    (date '2023-12-01', 6558.95,  2400.29, 980.38,  1168.12),
    (date '2024-01-01', 6496.14,  2674.32, 898.66,  1198.39),
    (date '2024-02-01', 7141.72,  2421.55, 930.05,  1149.84)
) AS m(month, ac_kwh, lighting_kwh, raw_power_kwh, ups_kwh)
WHERE room_name LIKE '%Area - 1%';

-- Monthly Energy — Seating Area 2 (Apr 2023 – Feb 2024)
INSERT INTO monthly_energy (room_id, month, ac_kwh, lighting_kwh, raw_power_kwh, ups_kwh)
SELECT room_id, m.month, m.ac_kwh, m.lighting_kwh, m.raw_power_kwh, m.ups_kwh
FROM rooms
CROSS JOIN LATERAL (
    VALUES
    (date '2023-04-01', 6108.00,  1640.00, 766.00,  1000.00),
    (date '2023-05-01', 8369.00,  1553.95, 706.51,  1100.00),
    (date '2023-06-01', 6443.00,  1583.33, 752.25,  1058.11),
    (date '2023-07-01', 8088.62,  1802.00, 806.12,  1096.00),
    (date '2023-08-01', 6823.81,  1500.34, 707.24,  1072.25),
    (date '2023-09-01', 6000.00,  1412.85, 617.33,  1099.04),
    (date '2023-10-01', 5060.16,  1715.35, 608.95,  1023.55),
    (date '2023-11-01', 4303.00,  123.53,  629.22,  1000.00),
    (date '2023-12-01', 3957.29,  1612.11, 779.76,  1021.55),
    (date '2024-01-01', 4496.07,  1498.24, 698.59,  1084.29),
    (date '2024-02-01', 5141.75,  1349.15, 746.25,  1089.21)
) AS m(month, ac_kwh, lighting_kwh, raw_power_kwh, ups_kwh)
WHERE room_name LIKE '%Area - 2%';
