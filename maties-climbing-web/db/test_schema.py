"""Validate the capacity trigger against real SQLite before building on it."""
import sqlite3, sys, pathlib

DB = pathlib.Path("/home/james/code/MatiesClimbingWeb/maties-climbing-web/db")

def fresh():
    c = sqlite3.connect(":memory:")
    c.execute("PRAGMA foreign_keys = ON")
    c.executescript((DB / "schema.sql").read_text())
    c.executescript((DB / "seed.sql").read_text())
    return c

def book(c, bid, start, end, items, status="confirmed"):
    """items: [(item_id, qty)]. Mirrors the db.batch() order used in the Function."""
    c.execute(
        "INSERT INTO bookings (id, ref, name, phone, start_date, end_date, status)"
        " VALUES (?,?,?,?,?,?,?)",
        (bid, "MC-" + bid, "T", "+27821234567", start, end, status),
    )
    for item, qty in items:
        # Snapshot the current rate onto the line, as insertBooking() does.
        price = c.execute(
            "SELECT price_per_day FROM gear_items WHERE id=?", (item,)
        ).fetchone()[0]
        c.execute(
            "INSERT INTO booking_items (booking_id, item_id, qty, price_per_day)"
            " VALUES (?,?,?,?)",
            (bid, item, qty, price),
        )

def edit(c, bid, start, end, items, status="confirmed"):
    """The admin PATCH path: delete items, update, re-insert so the trigger re-arms."""
    c.execute("DELETE FROM booking_items WHERE booking_id = ?", (bid,))
    c.execute(
        "UPDATE bookings SET start_date=?, end_date=?, status=?,"
        " edited_at=datetime('now') WHERE id=?", (start, end, status, bid))
    for item, qty in items:
        price = c.execute(
            "SELECT price_per_day FROM gear_items WHERE id=?", (item,)
        ).fetchone()[0]
        c.execute(
            "INSERT INTO booking_items (booking_id, item_id, qty, price_per_day)"
            " VALUES (?,?,?,?)",
            (bid, item, qty, price),
        )

fails = []
def check(label, got, want):
    ok = got == want
    print(f"  {'PASS' if ok else 'FAIL'}  {label}   got={got!r} want={want!r}")
    if not ok:
        fails.append(label)

def attempt(fn):
    """Run inside a savepoint so a failure rolls back like db.batch() would."""
    try:
        fn()
        return "ok"
    except sqlite3.IntegrityError as e:
        return "gear_unavailable" if "gear_unavailable" in str(e) else f"other:{e}"

print("seed sanity")
c = fresh()
check("8 gear types", c.execute("SELECT COUNT(*) FROM gear_items WHERE active=1").fetchone()[0], 8)
check("mondo qty", c.execute("SELECT quantity FROM gear_items WHERE id='mondo-pad'").fetchone()[0], 2)

print("\npricing")
prices = dict(c.execute("SELECT id, price_per_day FROM gear_items"))
check("pad price",        prices["mondo-pad"], 60)
check("circuit pad price", prices["circuit-pad"], 60)
check("trad rack price",  prices["trad-rack"], 100)
check("quickdraw price",  prices["quickdraws"], 40)
check("rope price",       prices["rope"], 60)
check("half rope price",  prices["half-ropes"], 60)
check("harness price",    prices["harness"], 40)
check("ATC price",        prices["belay-device"], 40)
deposits = dict(c.execute("SELECT id, deposit_note FROM gear_items"))
check("pad has a deposit note",  bool(deposits["mondo-pad"]), True)
check("rack has a deposit note", bool(deposits["trad-rack"]), True)
check("rope has none",           deposits["rope"], None)

# A 3-day booking of 1 mondo pad + 1 trad rack: (60 + 100) x 3
book(c, "price", "2026-08-08", "2026-08-10", [("mondo-pad", 1), ("trad-rack", 1)])
total = c.execute("""
  SELECT SUM(bi.qty * bi.price_per_day *
             (julianday(b.end_date) - julianday(b.start_date) + 1))
  FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
  WHERE b.id = 'price'""").fetchone()[0]
check("3-day pad + rack total", total, 480)

print("\ncapacity: 2 mondo pads")
c = fresh()
check("1st mondo", attempt(lambda: book(c, "a", "2026-08-08", "2026-08-10", [("mondo-pad", 1)])), "ok")
check("2nd mondo", attempt(lambda: book(c, "b", "2026-08-09", "2026-08-11", [("mondo-pad", 1)])), "ok")
c.execute("SAVEPOINT s")
r = attempt(lambda: book(c, "cc", "2026-08-09", "2026-08-09", [("mondo-pad", 1)]))
c.execute("ROLLBACK TO s")
check("3rd mondo on overlapping day", r, "gear_unavailable")
check("3rd mondo on a free day", attempt(lambda: book(c, "d", "2026-08-12", "2026-08-12", [("mondo-pad", 1)])), "ok")

print("\nthe case that breaks a per-unit model")
# A out 8-9, B out 10-11. A request for ONE pad 8-11 must be REFUSED (both are
# committed on every day), but a request for one pad 12-13 must succeed.
c = fresh()
book(c, "a", "2026-08-08", "2026-08-09", [("mondo-pad", 1)])
book(c, "b", "2026-08-10", "2026-08-11", [("mondo-pad", 1)])
check("1 more mondo spanning both (1 free each day)", attempt(lambda: book(c, "e", "2026-08-08", "2026-08-11", [("mondo-pad", 1)])), "ok")
c.execute("SAVEPOINT s")
r = attempt(lambda: book(c, "f", "2026-08-08", "2026-08-11", [("mondo-pad", 1)]))
c.execute("ROLLBACK TO s")
check("a 4th spanning booking (would exceed)", r, "gear_unavailable")

print("\npeak detection: booking that starts mid-range")
# 3 circuit pads. Existing: X 1-10 (qty 2). New: 5-6 qty 2 -> peak 4 > 3, refuse.
c = fresh()
book(c, "x", "2026-08-01", "2026-08-10", [("circuit-pad", 2)])
c.execute("SAVEPOINT s")
r = attempt(lambda: book(c, "y", "2026-08-05", "2026-08-06", [("circuit-pad", 2)]))
c.execute("ROLLBACK TO s")
check("interior overlap exceeding qty", r, "gear_unavailable")
check("interior overlap within qty", attempt(lambda: book(c, "z", "2026-08-05", "2026-08-06", [("circuit-pad", 1)])), "ok")

print("\npeak detection: existing booking starts INSIDE the new range")
# This is the case the event-point trick exists for.
# 3 circuit pads. Existing: P 10-20 qty 3. New booking 1-30 qty 1 -> peak 4, refuse.
c = fresh()
book(c, "p", "2026-08-10", "2026-08-20", [("circuit-pad", 3)])
c.execute("SAVEPOINT s")
r = attempt(lambda: book(c, "q", "2026-08-01", "2026-08-30", [("circuit-pad", 1)]))
c.execute("ROLLBACK TO s")
check("new range enclosing a full existing booking", r, "gear_unavailable")

print("\ncancelled bookings free capacity")
c = fresh()
book(c, "a", "2026-08-08", "2026-08-10", [("mondo-pad", 2)])
c.execute("SAVEPOINT s")
r = attempt(lambda: book(c, "b", "2026-08-08", "2026-08-08", [("mondo-pad", 1)]))
c.execute("ROLLBACK TO s")
check("blocked while confirmed", r, "gear_unavailable")
c.execute("UPDATE bookings SET status='cancelled' WHERE id='a'")
check("allowed once cancelled", attempt(lambda: book(c, "b", "2026-08-08", "2026-08-08", [("mondo-pad", 1)])), "ok")

print("\nadmin edit: delete-then-reinsert")
c = fresh()
book(c, "a", "2026-08-08", "2026-08-09", [("mondo-pad", 1)])
book(c, "b", "2026-08-08", "2026-08-09", [("mondo-pad", 1)])
check("shrink own booking (no self-collision)", attempt(lambda: edit(c, "a", "2026-08-08", "2026-08-08", [("mondo-pad", 1)])), "ok")
check("extend into own freed day", attempt(lambda: edit(c, "a", "2026-08-08", "2026-08-09", [("mondo-pad", 1)])), "ok")
book(c, "c", "2026-08-10", "2026-08-10", [("mondo-pad", 2)])
c.execute("SAVEPOINT s")
r = attempt(lambda: edit(c, "a", "2026-08-08", "2026-08-10", [("mondo-pad", 1)]))
c.execute("ROLLBACK TO s")
check("extend over a full day", r, "gear_unavailable")
row = c.execute("SELECT start_date, end_date FROM bookings WHERE id='a'").fetchone()
check("failed edit left booking untouched", row, ("2026-08-08", "2026-08-09"))
check("failed edit left items intact",
      c.execute("SELECT COUNT(*) FROM booking_items WHERE booking_id='a'").fetchone()[0], 1)

print("\nadmin restore of a cancelled booking is capacity-checked")
c = fresh()
book(c, "a", "2026-08-08", "2026-08-08", [("mondo-pad", 2)])
c.execute("UPDATE bookings SET status='cancelled' WHERE id='a'")
book(c, "b", "2026-08-08", "2026-08-08", [("mondo-pad", 2)])
c.execute("SAVEPOINT s")
r = attempt(lambda: edit(c, "a", "2026-08-08", "2026-08-08", [("mondo-pad", 2)], status="confirmed"))
c.execute("ROLLBACK TO s")
check("restore blocked when slot was taken", r, "gear_unavailable")
c.execute("UPDATE bookings SET status='cancelled' WHERE id='b'")
check("restore succeeds when slot is free", attempt(lambda: edit(c, "a", "2026-08-08", "2026-08-08", [("mondo-pad", 2)], status="confirmed")), "ok")

print("\nmulti-item booking: partial failure rolls back everything")
c = fresh()
book(c, "hog", "2026-08-08", "2026-08-08", [("mondo-pad", 2)])
c.execute("SAVEPOINT s")
r = attempt(lambda: book(c, "m", "2026-08-08", "2026-08-08", [("harness", 1), ("mondo-pad", 1)]))
c.execute("ROLLBACK TO s")
check("mixed booking with one unavailable item", r, "gear_unavailable")
check("no orphan harness row", c.execute("SELECT COUNT(*) FROM booking_items WHERE booking_id='m'").fetchone()[0], 0)
check("no orphan booking row", c.execute("SELECT COUNT(*) FROM bookings WHERE id='m'").fetchone()[0], 0)

print("\navailability query")
c = fresh()
book(c, "a", "2026-08-08", "2026-08-10", [("mondo-pad", 1)])
book(c, "b", "2026-08-09", "2026-08-09", [("mondo-pad", 1)])
rows = c.execute("""
WITH RECURSIVE days(d) AS (
  SELECT ?1 UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < ?2
),
commitments AS (
  SELECT bi.item_id, bi.qty, b.start_date AS s, b.end_date AS e
  FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id
  WHERE b.status = 'confirmed' AND b.start_date <= ?2 AND b.end_date >= ?1
)
SELECT g.id, days.d, COALESCE(SUM(c.qty), 0)
FROM gear_items g
CROSS JOIN days
LEFT JOIN commitments c ON c.item_id = g.id AND c.s <= days.d AND c.e >= days.d
WHERE g.active = 1
GROUP BY g.id, g.sort_order, days.d
ORDER BY g.sort_order, g.id, days.d
""", ("2026-08-07", "2026-08-20")).fetchall()
check("row count = 8 items x 14 days", len(rows), 112)
mondo = [r[2] for r in rows if r[0] == "mondo-pad"]
check("mondo committed per day", mondo, [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
harness = [r[2] for r in rows if r[0] == "harness"]
check("uncommitted item is all zeros", harness, [0] * 14)

print()
if fails:
    print(f"{len(fails)} FAILED: {fails}")
    sys.exit(1)
print("all passed")
