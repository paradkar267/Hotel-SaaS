-- Insert a set of 12 sample rooms for testing
INSERT INTO public.rooms (
    id, tenant_id, property_id, room_number, floor, room_type, base_rate_paise, status, updated_at
) VALUES 
-- Floor 1: Standard Rooms
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '101', '1', 'Standard', 250000, 'AVAILABLE', current_timestamp),
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '102', '1', 'Standard', 250000, 'OCCUPIED', current_timestamp),
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '103', '1', 'Standard', 250000, 'HOUSEKEEPING', current_timestamp),
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '104', '1', 'Standard', 250000, 'AVAILABLE', current_timestamp),

-- Floor 2: Deluxe Rooms
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '201', '2', 'Deluxe', 400000, 'AVAILABLE', current_timestamp),
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '202', '2', 'Deluxe', 400000, 'OCCUPIED', current_timestamp),
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '203', '2', 'Deluxe', 400000, 'HOUSEKEEPING', current_timestamp),
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '204', '2', 'Deluxe', 400000, 'MAINTENANCE', current_timestamp),

-- Floor 3: Premium & Suites
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '301', '3', 'Premium', 550000, 'AVAILABLE', current_timestamp),
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '302', '3', 'Premium', 550000, 'OCCUPIED', current_timestamp),
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '303', '3', 'Suite', 850000, 'AVAILABLE', current_timestamp),
('room_' || gen_random_uuid(), 'tnt_admin123', 'prp_admin123', '304', '3', 'Suite', 850000, 'HOUSEKEEPING', current_timestamp)

ON CONFLICT (property_id, room_number) DO UPDATE SET
    room_type = EXCLUDED.room_type,
    base_rate_paise = EXCLUDED.base_rate_paise,
    status = EXCLUDED.status,
    updated_at = current_timestamp;
