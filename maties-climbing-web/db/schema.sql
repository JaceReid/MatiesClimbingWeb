-- Maties Climbing gear booking schema (Cloudflare D1 / SQLite)
--
-- Apply with:
--   npx wrangler d1 execute maties-gear --local  --file=./db/schema.sql
--   npx wrangler d1 execute maties-gear --remote --file=./db/schema.sql
--
-- Do NOT add `PRAGMA foreign_keys = ON;` here. D1 only accepts a whitelist of
-- PRAGMAs and may reject the whole file, leaving a half-applied schema. D1
-- enforces foreign keys by default.

-- ---------------------------------------------------------------- gear types
-- Inventory is tracked as a quantity per TYPE, not a row per physical item.
-- Nobody at the club cares which Mondo pad they get, and counting units lets
-- availability be arithmetic instead of interval packing.
CREATE TABLE IF NOT EXISTS gear_items (
  id               TEXT    PRIMARY KEY,          -- slug, e.g. 'circuit-pad'
  name             TEXT    NOT NULL,
  description      TEXT,
  quantity         INTEGER NOT NULL CHECK (quantity >= 0),
  max_per_booking  INTEGER NOT NULL DEFAULT 2 CHECK (max_per_booking > 0),
  price_per_day    INTEGER NOT NULL DEFAULT 0 CHECK (price_per_day >= 0),  -- whole rand
  deposit_note     TEXT,                         -- free text; deposits vary by use
  sort_order       INTEGER NOT NULL DEFAULT 100,
  active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

-- ----------------------------------------------------------------- bookings
CREATE TABLE IF NOT EXISTS bookings (
  id             TEXT PRIMARY KEY,               -- crypto.randomUUID()
  ref            TEXT NOT NULL UNIQUE,           -- human ref, e.g. 'MC-7QK4'
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,                  -- normalised +27XXXXXXXXX; also
                                                 -- the identity the per-person
                                                 -- booking cap keys on
  total_cost     INTEGER NOT NULL DEFAULT 0,     -- rand, frozen at booking time
  start_date     TEXT NOT NULL,                  -- 'YYYY-MM-DD', SAST calendar date
  end_date       TEXT NOT NULL,                  -- inclusive
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('confirmed', 'cancelled', 'returned')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),  -- UTC; audit only
  cancelled_at   TEXT,
  returned_at    TEXT,
  edited_at      TEXT,                           -- set by admin edits
  ip_hash        TEXT,                           -- salted SHA-256, first 16 bytes
  notified       INTEGER NOT NULL DEFAULT 0,     -- 1 once CallMeBot accepted
  CHECK (end_date >= start_date)
);

-- -------------------------------------------------------------- line items
-- One row per gear type per booking; qty carries multiplicity.
CREATE TABLE IF NOT EXISTS booking_items (
  booking_id    TEXT    NOT NULL REFERENCES bookings(id)   ON DELETE CASCADE,
  item_id       TEXT    NOT NULL REFERENCES gear_items(id) ON DELETE RESTRICT,
  qty           INTEGER NOT NULL CHECK (qty > 0),
  -- Price snapshot. Rates change between seasons; what someone was quoted at
  -- booking time is what they should be charged at the cupboard.
  price_per_day INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (booking_id, item_id)
);

-- ------------------------------------------------------------------ indexes
CREATE INDEX IF NOT EXISTS idx_bookings_live
  ON bookings(status, start_date, end_date);      -- availability scan
CREATE INDEX IF NOT EXISTS idx_bookings_phone
  ON bookings(phone, status, end_date);           -- per-person cap
CREATE INDEX IF NOT EXISTS idx_bookings_ip
  ON bookings(ip_hash, created_at);               -- rate limit
CREATE INDEX IF NOT EXISTS idx_booking_items_item
  ON booking_items(item_id, booking_id);          -- capacity trigger

-- --------------------------------------------------------- capacity trigger
--
-- This is the only thing standing between us and double-booking. D1 has no
-- explicit BEGIN/COMMIT across round-trips, so a SELECT-then-INSERT sequence
-- has a real TOCTOU window. Putting the capacity check inside the INSERT
-- statement itself closes it: db.batch() runs statements in one implicit
-- transaction, and RAISE(ABORT) rolls the whole batch back.
--
-- Candidate days: the new booking's start_date, plus the start_date of every
-- existing confirmed booking that falls inside the new range. The count of
-- overlapping intervals is a step function that only steps UP at an interval
-- start, so the peak provably occurs at one of these points. This avoids a
-- recursive CTE inside a trigger body, which SQLite parses inconsistently.
--
-- Note the booking's own line items are naturally excluded: on INSERT the row
-- does not exist yet, and admin edits DELETE all items before re-inserting.
DROP TRIGGER IF EXISTS trg_booking_items_capacity;
CREATE TRIGGER trg_booking_items_capacity
BEFORE INSERT ON booking_items
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'gear_unavailable')
  WHERE (
    SELECT MAX(used) FROM (
      SELECT (
        SELECT COALESCE(SUM(bi.qty), 0)
        FROM booking_items bi
        JOIN bookings b ON b.id = bi.booking_id
        WHERE bi.item_id   = NEW.item_id
          AND b.status     = 'confirmed'
          AND b.start_date <= p.d
          AND b.end_date   >= p.d
      ) + NEW.qty AS used
      FROM (
        SELECT (SELECT start_date FROM bookings WHERE id = NEW.booking_id) AS d
        UNION
        SELECT b2.start_date
        FROM bookings b2
        JOIN booking_items bi2
          ON bi2.booking_id = b2.id AND bi2.item_id = NEW.item_id
        WHERE b2.status = 'confirmed'
          AND b2.start_date >= (SELECT start_date FROM bookings WHERE id = NEW.booking_id)
          AND b2.start_date <= (SELECT end_date   FROM bookings WHERE id = NEW.booking_id)
      ) p
    )
  ) > (SELECT quantity FROM gear_items WHERE id = NEW.item_id);
END;
