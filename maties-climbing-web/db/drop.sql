-- Destructive. Drops every gear booking table.
--
-- Used only by `npm run db:reset`, which is hardcoded to --local. Never run
-- this with --remote unless you genuinely intend to erase all bookings;
-- schema.sql is written to be safely re-runnable and is what production uses.
--
-- This exists because schema.sql uses CREATE TABLE IF NOT EXISTS, so it cannot
-- apply column changes to a database that already has the old shape.

DROP TRIGGER IF EXISTS trg_booking_items_capacity;
DROP TABLE IF EXISTS booking_items;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS gear_items;
