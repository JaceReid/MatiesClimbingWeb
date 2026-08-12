import React, { useCallback, useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./page.css";
import "./gear.css";
import AvailabilityStrip from "../components/AvailabilityStrip";

// Gear booking.
//
// One /api/availability request drives the whole page: it returns a dense
// `free[]` array per item covering the bookable window, so changing dates is
// array arithmetic rather than another round trip.
//
// The client never computes a calendar date. `today`, `windowEnd` and every
// date string come from the server, because new Date() in a browser between
// midnight and 02:00 SAST reports yesterday in UTC. Rendering only
// server-supplied dates removes that whole class of bug.

const EMPTY_FORM = {
  name: "",
  phone: "",
  notes: "",
  website: "", // honeypot
};

const rand = (amount) => `R${amount}`;

function GearPage() {
  const [avail, setAvail] = useState(null);
  const [load, setLoad] = useState("loading"); // loading | ready | error
  const [range, setRange] = useState({ from: "", to: "" });
  const [picked, setPicked] = useState({}); // { itemId: qty }
  const [form, setForm] = useState(EMPTY_FORM);
  const [submit, setSubmit] = useState("idle"); // idle | sending | done
  const [result, setResult] = useState(null); // success payload or error info

  const pageBackground = {
    backgroundImage: `url(${require("../docs/Rocklands-bouldering-Lumos-Photography.jpg")})`,
    backgroundSize: "cover",
    backgroundAttachment: "fixed",
    backgroundPosition: "center",
    minHeight: "100vh",
  };

  const contentStyle = {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: "0.5rem",
    padding: "2rem",
    marginBottom: "2rem",
  };

  const fetchAvailability = useCallback(async (signal) => {
    const res = await fetch("/api/availability", { signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`availability ${res.status}`);
    return res.json();
  }, []);

  // Initial load. StrictMode double-invokes this in development, so you will
  // see two requests locally and one in production. That is expected.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    fetchAvailability(controller.signal)
      .then((data) => {
        setAvail(data);
        setRange({ from: data.today, to: data.today });
        setLoad("ready");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setLoad("error");
      })
      .finally(() => clearTimeout(timer));

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fetchAvailability]);

  if (load === "loading") {
    return (
      <div style={pageBackground}>
        <div className="container py-5">
          <div style={contentStyle} className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading gear availability</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (load === "error") {
    return (
      <div style={pageBackground}>
        <div className="container py-5">
          <div style={contentStyle}>
            <h2 className="text-primary text-center">Gear Booking</h2>
            <p className="text-center mb-0">
              We couldn't load gear availability just now. Please refresh, or message the club
              WhatsApp group and we'll sort you out.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const days = avail.days;
  const fromIndex = days.indexOf(range.from);
  const toIndex = days.indexOf(range.to);
  const validRange = fromIndex >= 0 && toIndex >= fromIndex;
  const rangeLength = validRange ? toIndex - fromIndex + 1 : 0;

  /** Units of an item free on every day of the selected range. */
  const freeInRange = (item) => {
    if (!validRange) return 0;
    return Math.min(...item.free.slice(fromIndex, toIndex + 1));
  };

  /** Most a person may take of this item right now. */
  const maxFor = (item) => Math.min(item.maxPerBooking, freeInRange(item));

  /**
   * Earliest window of the current length where at least one unit is free
   * every day. Powers the "next free from ..." recovery link, which turns a
   * dead end into a booking.
   */
  const nextFree = (item) => {
    const len = rangeLength || 1;
    for (let i = 0; i + len <= days.length; i++) {
      if (item.free.slice(i, i + len).every((n) => n >= 1)) {
        return { from: days[i], to: days[i + len - 1] };
      }
    }
    return null;
  };

  const totalUnits = Object.values(picked).reduce((a, b) => a + b, 0);
  const distinctItems = Object.values(picked).filter((q) => q > 0).length;

  const chosen = avail.items.filter((it) => picked[it.id] > 0);
  // Mirrors the server's calculation. The server's number is authoritative -
  // this is only so the visitor sees the cost before committing.
  const totalCost = chosen.reduce(
    (sum, it) => sum + picked[it.id] * it.pricePerDay * rangeLength,
    0
  );
  const deposits = chosen.filter((it) => it.depositNote);

  const setFrom = (value) => {
    const i = days.indexOf(value);
    if (i < 0) return;
    // Keep `to` valid: never before `from`, never longer than the cap.
    const maxTo = Math.min(i + avail.maxDays - 1, days.length - 1);
    const currentTo = days.indexOf(range.to);
    const nextTo = currentTo < i || currentTo > maxTo ? days[Math.min(maxTo, i)] : range.to;
    setRange({ from: value, to: nextTo });
    setPicked({});
  };

  const setTo = (value) => {
    const i = days.indexOf(value);
    if (i < 0 || i < fromIndex) return;
    if (i - fromIndex + 1 > avail.maxDays) return;
    setRange({ ...range, to: value });
    setPicked({});
  };

  const bump = (item, delta) => {
    const current = picked[item.id] || 0;
    const next = Math.max(0, Math.min(maxFor(item), current + delta));
    if (next === current) return;
    if (delta > 0) {
      if (totalUnits + delta > avail.maxTotalUnits) return;
      if (current === 0 && distinctItems >= avail.maxDistinctItems) return;
    }
    setPicked({ ...picked, [item.id]: next });
    setResult(null);
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (submit === "sending") return; // double-tap guard

    setSubmit("sending");
    setResult(null);

    const items = Object.entries(picked)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ id, qty }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ...form,
          startDate: range.from,
          endDate: range.to,
          items,
        }),
      });
      const data = await res.json();

      if (res.status === 201) {
        setResult({ kind: "success", ...data });
        setSubmit("done");
        return;
      }

      // Anything else: refresh availability so the grid tells the truth, but
      // keep everything the visitor typed.
      const refreshed = await fetchAvailability().catch(() => null);
      if (refreshed) setAvail(refreshed);

      if (res.status === 409 && Array.isArray(data.items)) {
        const cleared = { ...picked };
        data.items.forEach((id) => delete cleared[id]);
        setPicked(cleared);
      }

      setResult({ kind: "error", message: data.message || "That didn't work.", fields: data.fields });
      setSubmit("idle");
    } catch (err) {
      setResult({
        kind: "error",
        message:
          err.name === "AbortError"
            ? "That took too long. Check your connection and try again."
            : "We couldn't reach the booking service. Please try again.",
      });
      setSubmit("idle");
    } finally {
      clearTimeout(timer);
    }
  };

  /* ------------------------------------------------------- confirmation -- */

  if (submit === "done" && result?.kind === "success") {
    return (
      <div style={pageBackground}>
        <div className="container py-5">
          <div style={contentStyle}>
            <h2 className="text-primary mb-4 text-center">Gear booked</h2>
            <div className="text-center mb-4">
              <div className="display-6 fw-bold">{result.ref}</div>
              <div className="text-muted">your booking reference</div>
            </div>
            <ul className="list-group list-group-flush mb-4">
              <li className="list-group-item d-flex justify-content-between">
                <span>Dates</span>
                <strong>
                  {result.startDate === result.endDate
                    ? result.startDate
                    : `${result.startDate} to ${result.endDate}`}
                </strong>
              </li>
              {result.items.map((i) => (
                <li key={i.id} className="list-group-item d-flex justify-content-between">
                  <span>
                    {i.qty} &times; {i.name}
                  </span>
                  <span className="text-muted">
                    {i.pricePerDay > 0 ? `${rand(i.pricePerDay)}/day` : "free"}
                  </span>
                </li>
              ))}
              <li className="list-group-item d-flex justify-content-between fw-bold">
                <span>Total for {result.days} day{result.days === 1 ? "" : "s"}</span>
                <span>{rand(result.totalCost)}</span>
              </li>
            </ul>

            {result.depositNotes?.length > 0 && (
              <p className="text-center text-muted small">
                A deposit is also required on{" "}
                {result.depositNotes.map((d) => d.name.toLowerCase()).join(" and ")} - the amount is
                agreed when you collect.
              </p>
            )}

            <p className="text-center">
              Screenshot this reference. Collect your gear at the wall and pay the gear officer. They
              have been notified.
            </p>
            <div className="text-center">
              <a href="/gear" className="btn btn-outline-primary">
                Make another booking
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------- form --- */

  return (
    <div style={pageBackground}>
      <div className="container py-4">
        <section style={contentStyle}>
          <h2 className="text-primary mb-3 text-center">Gear Booking</h2>
          <p className="text-center text-muted mb-0">
            Book club gear for up to {avail.maxDays} days, up to {days.length} days ahead. Collect at
            the wall.
          </p>
        </section>

        <form onSubmit={onSubmit}>
          {/* 1. Dates ------------------------------------------------------ */}
          <section style={contentStyle}>
            <h3 className="h5 mb-3">1 &middot; Pick your dates</h3>
            <div className="row g-3 align-items-end">
              <div className="col-sm-5">
                <label className="form-label" htmlFor="gear-from">
                  From
                </label>
                <input
                  id="gear-from"
                  type="date"
                  className="form-control"
                  value={range.from}
                  min={avail.windowStart}
                  max={avail.windowEnd}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="col-sm-5">
                <label className="form-label" htmlFor="gear-to">
                  To
                </label>
                <input
                  id="gear-to"
                  type="date"
                  className="form-control"
                  value={range.to}
                  min={range.from || avail.windowStart}
                  max={days[Math.min(fromIndex + avail.maxDays - 1, days.length - 1)]}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="col-sm-2 text-sm-end">
                <span className="text-muted small">
                  {rangeLength} of {avail.maxDays} days
                </span>
              </div>
            </div>
          </section>

          {/* 2. Gear ------------------------------------------------------- */}
          <section style={contentStyle}>
            <h3 className="h5 mb-3">2 &middot; Pick your gear</h3>

            <div className="list-group list-group-flush mb-3">
              {avail.items.map((item) => {
                const free = freeInRange(item);
                const max = maxFor(item);
                const qty = picked[item.id] || 0;
                const suggestion = free === 0 ? nextFree(item) : null;

                return (
                  <div
                    key={item.id}
                    className={`list-group-item px-0 ${free === 0 ? "gear-item-unavailable" : ""}`}
                  >
                    <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                      <div>
                        <div className="fw-semibold">
                          {item.name}{" "}
                          {item.pricePerDay > 0 ? (
                            <span className="text-body-secondary fw-normal">
                              &middot; {rand(item.pricePerDay)}/day
                            </span>
                          ) : (
                            <span className="text-success fw-normal">&middot; free</span>
                          )}
                        </div>
                        {item.description && (
                          <div className="text-muted small">{item.description}</div>
                        )}
                        {item.depositNote && (
                          <div className="text-muted small fst-italic">{item.depositNote}</div>
                        )}
                      </div>
                      {/* ms-auto keeps this hard right even when the longer
                          deposit text pushes it onto its own line. */}
                      <div className="text-end ms-auto">
                        <div className="small mb-1">
                          {free === 0 ? (
                            <span className="text-danger">fully booked</span>
                          ) : (
                            <span className="text-muted">
                              {free} of {item.quantity} free
                            </span>
                          )}
                        </div>
                        <div className="btn-group btn-group-sm" role="group" aria-label={item.name}>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => bump(item, -1)}
                            disabled={qty === 0}
                            aria-label={`One fewer ${item.name}`}
                          >
                            &minus;
                          </button>
                          <span className="btn btn-outline-secondary disabled gear-qty">{qty}</span>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => bump(item, +1)}
                            disabled={qty >= max}
                            aria-label={`One more ${item.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2">
                      <AvailabilityStrip
                        days={days}
                        free={item.free}
                        quantity={item.quantity}
                        fromIndex={fromIndex}
                        toIndex={toIndex}
                      />
                    </div>

                    {suggestion && (
                      <div className="small mt-1">
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0"
                          onClick={() => {
                            setRange(suggestion);
                            setPicked({});
                          }}
                        >
                          Next free from {suggestion.from} &rarr; use these dates
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="d-flex justify-content-between small text-muted flex-wrap gap-2">
              <span>
                <span className="gear-dot-all">&#9679;</span> free{" "}
                <span className="gear-dot-some">&#9680;</span> some left{" "}
                <span className="gear-dot-none">&#9675;</span> fully booked
              </span>
              <span>
                {totalUnits} of {avail.maxTotalUnits} items selected
              </span>
            </div>

            {chosen.length > 0 && (
              <div className="gear-total mt-3">
                <table className="table table-sm mb-2">
                  <tbody>
                    {chosen.map((it) => (
                      <tr key={it.id}>
                        <td className="ps-0">
                          {picked[it.id]} &times; {it.name}
                        </td>
                        {/* The per-line breakdown is reassurance, not
                            information - drop it rather than let it wrap on a
                            narrow phone. */}
                        <td className="text-muted text-end d-none d-sm-table-cell">
                          {it.pricePerDay > 0
                            ? `${picked[it.id]} × ${rand(it.pricePerDay)} × ${rangeLength} day${
                                rangeLength === 1 ? "" : "s"
                              }`
                            : "free"}
                        </td>
                        <td className="text-end pe-0" style={{ width: "5rem" }}>
                          {rand(picked[it.id] * it.pricePerDay * rangeLength)}
                        </td>
                      </tr>
                    ))}
                    <tr className="fw-bold border-top">
                      <td className="ps-0" colSpan={2}>
                        Total
                      </td>
                      <td className="text-end pe-0">{rand(totalCost)}</td>
                    </tr>
                  </tbody>
                </table>

                {deposits.length > 0 && (
                  <div className="small text-muted">
                    <strong>Plus a deposit</strong> on{" "}
                    {deposits.map((d) => d.name.toLowerCase()).join(" and ")}. The amount depends on
                    what you're using it for and is agreed when you collect.
                  </div>
                )}
                <div className="small text-muted mt-1">Pay the gear officer on collection.</div>
              </div>
            )}
          </section>

          {/* 3. Details ---------------------------------------------------- */}
          <section style={contentStyle}>
            <h3 className="h5 mb-3">3 &middot; Your details</h3>

            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="gear-name">
                  Name
                </label>
                <input
                  id="gear-name"
                  className={`form-control ${result?.fields?.name ? "is-invalid" : ""}`}
                  value={form.name}
                  autoComplete="name"
                  required
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                {result?.fields?.name && <div className="invalid-feedback">{result.fields.name}</div>}
              </div>

              <div className="col-md-6">
                <label className="form-label" htmlFor="gear-phone">
                  WhatsApp number
                </label>
                <input
                  id="gear-phone"
                  className={`form-control ${result?.fields?.phone ? "is-invalid" : ""}`}
                  value={form.phone}
                  type="tel"
                  autoComplete="tel"
                  placeholder="082 123 4567"
                  required
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                {result?.fields?.phone && (
                  <div className="invalid-feedback">{result.fields.phone}</div>
                )}
              </div>

              <div className="col-12">
                <label className="form-label" htmlFor="gear-notes">
                  Anything else <span className="text-muted">(optional)</span>
                </label>
                <input
                  id="gear-notes"
                  className="form-control"
                  value={form.notes}
                  placeholder="Rocklands trip"
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {/* Honeypot. Hidden with CSS rather than type="hidden" so bots
                  that skip hidden inputs still fill it in. */}
              <div className="gear-hp" aria-hidden="true">
                <label htmlFor="gear-website">Website</label>
                <input
                  id="gear-website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </div>
            </div>

            {result?.kind === "error" && (
              <div className="alert alert-warning mt-3 mb-0" role="alert">
                {result.message}
              </div>
            )}

            <p className="text-muted small mt-3 mb-2">
              We'll WhatsApp the gear officer. Pay when you collect at the wall. Your name and number
              are stored to manage this booking and deleted after six months.
            </p>

            <div className="text-center">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={submit === "sending" || totalUnits === 0 || !validRange}
              >
                {submit === "sending" ? "Booking…" : "Book gear"}
              </button>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}

export default GearPage;
