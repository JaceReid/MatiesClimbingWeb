-- Gear inventory. This file is the source of truth for what can be booked.
--
-- To change quantities or add gear, edit this file and re-run:
--   npx wrangler d1 execute maties-gear --remote --file=./db/seed.sql
-- No code change and no deploy needed.
--
-- Re-running this overwrites quantities with the values below. That is
-- intended: this file is the record of what the club owns.
--
-- NB: this is a true upsert, NOT `INSERT OR REPLACE`. REPLACE deletes the
-- existing row first, which trips the ON DELETE RESTRICT on booking_items and
-- fails with a foreign-key error as soon as any booking references that gear.
-- ON CONFLICT DO UPDATE edits the row in place, so re-seeding is safe at any
-- time, with live bookings in the database.
--
-- Prices are whole rand per day, per bookable unit.
-- deposit_note is free text because deposits are agreed case by case; it is
-- shown on the booking page and repeated in the WhatsApp to the gear officer.
INSERT INTO gear_items
  (id, name, description, quantity, max_per_booking, price_per_day, deposit_note, sort_order, active)
VALUES
  ('circuit-pad',  'Circuit crash pad', 'Full-size bouldering pad',       3,  2,  60, 'Deposit required, depends on use', 10, 1),
  ('mondo-pad',    'Mondo crash pad',   'Extra-large bouldering pad',     2,  1,  60, 'Deposit required, depends on use', 20, 1),
  ('rope',         'Rope',              'Single dynamic rope',            5,  1,  60, NULL,                               30, 1),
  ('half-ropes',   'Half ropes',        'Matched pair, booked together',  1,  1,  60, NULL,                               40, 1),
  ('trad-rack',    'Trad rack',         'Full rack, goes out as one',     1,  1, 100, 'Deposit required, depends on use', 50, 1),
  ('quickdraws',   'Quickdraws (12)',   'Rack of 12 quickdraws',          2,  1,  40, NULL,                               60, 1),
  ('harness',      'Harness',           'Adjustable sport harness',       8,  2,  40, NULL,                               70, 1),
  ('belay-device', 'Belay device',      'ATC + screwgate',                3,  2,  40, NULL,                               80, 1)
ON CONFLICT(id) DO UPDATE SET
  name            = excluded.name,
  description     = excluded.description,
  quantity        = excluded.quantity,
  max_per_booking = excluded.max_per_booking,
  price_per_day   = excluded.price_per_day,
  deposit_note    = excluded.deposit_note,
  sort_order      = excluded.sort_order,
  active          = excluded.active;

-- Retired gear.
--
-- Deactivated rather than deleted: booking_items has ON DELETE RESTRICT, so a
-- DELETE fails as soon as any past booking references the item, and deleting
-- would erase that history anyway. active = 0 removes it from the booking page
-- immediately and is trivially reversible from the admin Inventory tab.
--
-- Note that simply removing a row from the VALUES list above does nothing -
-- this file only ever inserts and updates. Retiring needs this explicit step.
-- 'rope-60m' was replaced by the generic 'rope' entry above.
UPDATE gear_items SET active = 0 WHERE id IN ('shoes', 'helmet', 'rope-60m');
