import React, { useCallback, useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./page.css";
import "./gear.css";
import AvailabilityStrip from "../components/AvailabilityStrip";

// Gear admin: view, edit, cancel, mark returned, delete, and adjust stock.
//
// Auth is a shared bearer token held in sessionStorage. It goes in the
// Authorization header, never the URL - query strings leak into history,
// Referer headers and server logs.

const TOKEN_KEY = "maties-gear-admin-token";

function useAdminToken() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const save = (value) => {
    sessionStorage.setItem(TOKEN_KEY, value);
    setToken(value);
  };
  const clear = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
  };
  return [token, save, clear];
}

function GearAdminPage() {
  const [token, saveToken, clearToken] = useAdminToken();
  const [tokenInput, setTokenInput] = useState("");
  const [data, setData] = useState(null);
  const [avail, setAvail] = useState(null);
  const [status, setStatus] = useState("confirmed");
  const [tab, setTab] = useState("bookings");
  const [load, setLoad] = useState("idle"); // idle | loading | ready | error | unauthorized
  const [busy, setBusy] = useState(null); // id of the booking being mutated
  const [editing, setEditing] = useState(null); // { id, startDate, endDate, items:{id:qty} }
  const [message, setMessage] = useState(null);

  const pageBackground = {
    backgroundColor: "#f2f4f7",
    minHeight: "100vh",
  };

  const api = useCallback(
    async (path, options = {}) => {
      const res = await fetch(path, {
        ...options,
        headers: {
          ...(options.body ? { "content-type": "application/json" } : {}),
          authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    },
    [token]
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoad("loading");
    const [list, availability] = await Promise.all([
      api(`/api/admin/bookings?status=${status}&all=${status === "confirmed" ? "0" : "1"}`),
      fetch("/api/availability").then((r) => r.json()).catch(() => null),
    ]);

    if (list.status === 401) {
      setLoad("unauthorized");
      return;
    }
    if (list.status !== 200) {
      setLoad("error");
      return;
    }
    setData(list.body);
    setAvail(availability);
    setLoad("ready");
  }, [api, status, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* ---------------------------------------------------------- token gate */

  if (!token || load === "unauthorized") {
    return (
      <div style={pageBackground}>
        <div className="container py-5" style={{ maxWidth: "28rem" }}>
          <div className="gear-admin-card">
            <h2 className="h4 mb-3">Gear Admin</h2>
            {load === "unauthorized" && (
              <div className="alert alert-danger">That token wasn't accepted.</div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveToken(tokenInput.trim());
                setLoad("idle");
              }}
            >
              <label className="form-label" htmlFor="admin-token">
                Admin token
              </label>
              <input
                id="admin-token"
                type="password"
                className="form-control mb-3"
                value={tokenInput}
                autoComplete="current-password"
                onChange={(e) => setTokenInput(e.target.value)}
              />
              <button className="btn btn-primary w-100" type="submit">
                Sign in
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (load === "loading" || load === "idle" || !data) {
    return (
      <div style={pageBackground}>
        <div className="container py-5 text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading</span>
          </div>
        </div>
      </div>
    );
  }

  if (load === "error") {
    return (
      <div style={pageBackground}>
        <div className="container py-5">
          <div className="gear-admin-card">
            <p className="mb-2">Couldn't load bookings.</p>
            <button className="btn btn-outline-primary" onClick={refresh}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { bookings, warnings, items, today } = data;

  // Which gear carries a deposit, so the list can flag bookings that need one.
  const depositItems = new Set(items.filter((i) => i.deposit_note).map((i) => i.id));

  /* ------------------------------------------------------------- actions */

  const act = async (booking, action) => {
    setBusy(booking.id);
    setMessage(null);
    const { status: code, body } = await api(`/api/admin/bookings/${booking.id}`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    if (code !== 200) {
      setMessage({ kind: "warning", text: body.message || "That didn't work." });
      return;
    }
    setMessage({ kind: "success", text: `${booking.ref} updated.` });
    refresh();
  };

  const remove = async (booking) => {
    const typed = window.prompt(
      `Permanently delete ${booking.ref}? This cannot be undone.\n\nType the reference to confirm:`
    );
    if (typed === null) return;
    setBusy(booking.id);
    const { status: code, body } = await api(`/api/admin/bookings/${booking.id}`, {
      method: "DELETE",
      body: JSON.stringify({ ref: typed.trim() }),
    });
    setBusy(null);
    if (code !== 200) {
      setMessage({ kind: "warning", text: body.message || "Not deleted." });
      return;
    }
    setMessage({ kind: "success", text: `${booking.ref} deleted.` });
    refresh();
  };

  const saveEdit = async () => {
    setBusy(editing.id);
    setMessage(null);
    const { status: code, body } = await api(`/api/admin/bookings/${editing.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        startDate: editing.startDate,
        endDate: editing.endDate,
        status: editing.status,
        items: Object.entries(editing.items)
          .filter(([, qty]) => qty > 0)
          .map(([id, qty]) => ({ id, qty })),
      }),
    });
    setBusy(null);
    if (code !== 200) {
      setMessage({ kind: "warning", text: body.message || "Not saved." });
      return;
    }
    setMessage({ kind: "success", text: "Booking updated." });
    setEditing(null);
    refresh();
  };

  const updateStock = async (item, patch) => {
    setBusy(item.id);
    const { status: code, body } = await api(`/api/admin/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setBusy(null);
    if (code !== 200) {
      setMessage({ kind: "warning", text: body.message || "Not saved." });
      return;
    }
    if (body.overcommitted?.length) {
      setMessage({
        kind: "warning",
        text: `Saved, but ${body.overcommitted.length} day(s) are now over-committed. Existing bookings were not cancelled - phone the people affected.`,
      });
    } else {
      setMessage({ kind: "success", text: `${item.name} updated.` });
    }
    refresh();
  };

  /* ---------------------------------------------- availability for edits */

  // The availability payload counts the booking being edited against itself.
  // Add its own units back so the strip shows what would be free if this
  // booking were removed - which is exactly what the edit is deciding.
  const availForEdit = (itemId) => {
    if (!avail) return null;
    const item = avail.items.find((i) => i.id === itemId);
    if (!item) return null;
    if (!editing) return item;

    const original = bookings.find((b) => b.id === editing.id);
    const own = original?.items.find((i) => i.id === itemId);
    if (!own || original.status !== "confirmed") return item;

    const from = avail.days.indexOf(original.start_date);
    const to = avail.days.indexOf(original.end_date);
    const free = item.free.slice();
    for (let i = Math.max(0, from); i <= Math.min(to, free.length - 1); i++) {
      free[i] = Math.min(item.quantity, free[i] + own.qty);
    }
    return { ...item, free };
  };

  const dateRangeIndices = (start, end) =>
    avail ? [avail.days.indexOf(start), avail.days.indexOf(end)] : [-1, -1];

  /* ----------------------------------------------------------------- UI */

  const warnCount = warnings.overdue.length + warnings.unnotified.length;

  return (
    <div style={pageBackground}>
      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1 className="h4 mb-0">Gear Admin</h1>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              clearToken();
              setLoad("idle");
            }}
          >
            Sign out
          </button>
        </div>

        {warnCount > 0 && (
          <div className="alert alert-warning py-2">
            {warnings.overdue.length > 0 && (
              <span className="me-3">&#9888; {warnings.overdue.length} overdue</span>
            )}
            {warnings.unnotified.length > 0 && (
              <span className="me-3">&#9888; {warnings.unnotified.length} not notified</span>
            )}
            {warnings.overcommitted.length > 0 && (
              <span>&#9888; {warnings.overcommitted.length} over-committed day(s)</span>
            )}
          </div>
        )}

        {message && (
          <div className={`alert alert-${message.kind} py-2`} role="status">
            {message.text}
          </div>
        )}

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "bookings" ? "active" : ""}`}
              onClick={() => setTab("bookings")}
            >
              Bookings
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${tab === "inventory" ? "active" : ""}`}
              onClick={() => setTab("inventory")}
            >
              Inventory
            </button>
          </li>
        </ul>

        {tab === "bookings" && (
          <>
            <div className="btn-group btn-group-sm mb-3" role="group">
              {[
                ["confirmed", "Upcoming"],
                ["any", "All"],
                ["cancelled", "Cancelled"],
                ["returned", "Returned"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`btn btn-outline-secondary ${status === value ? "active" : ""}`}
                  onClick={() => setStatus(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {bookings.length === 0 && (
              <div className="gear-admin-card text-muted">Nothing to show.</div>
            )}

            {bookings.map((b) => {
              const overdue = b.status === "confirmed" && b.end_date < today;
              const isEditing = editing?.id === b.id;

              return (
                <div key={b.id} className="gear-admin-card">
                  <div className="d-flex justify-content-between flex-wrap gap-2">
                    <div>
                      <span className="gear-admin-ref me-2">{b.ref}</span>
                      <span>
                        {b.name} &middot;{" "}
                        <a href={`https://wa.me/${b.phone.replace("+", "")}`}>{b.phone}</a>
                      </span>
                      <div className="text-muted small">
                        {b.start_date === b.end_date
                          ? b.start_date
                          : `${b.start_date} to ${b.end_date}`}{" "}
                        &middot; {b.items.map((i) => `${i.qty}x ${i.name}`).join(", ") || "no items"}
                        {b.notes ? ` · ${b.notes}` : ""}
                      </div>
                      <div className="small">
                        <strong>R{b.total_cost}</strong> to collect
                        {b.items.some((i) => depositItems.has(i.id)) && (
                          <span className="text-muted"> + deposit</span>
                        )}
                      </div>
                    </div>
                    <div className="text-end small">
                      {overdue && <div className="text-danger fw-semibold">OVERDUE</div>}
                      {b.status !== "confirmed" && (
                        <div className="text-muted text-uppercase">{b.status}</div>
                      )}
                      {b.status === "confirmed" &&
                        (b.notified ? (
                          <div className="text-success">notified</div>
                        ) : (
                          <div className="text-warning">&#9888; not notified</div>
                        ))}
                    </div>
                  </div>

                  <div className="mt-2 d-flex gap-2 flex-wrap">
                    <button
                      className="btn btn-sm btn-outline-primary"
                      disabled={busy === b.id}
                      onClick={() =>
                        setEditing(
                          isEditing
                            ? null
                            : {
                                id: b.id,
                                startDate: b.start_date,
                                endDate: b.end_date,
                                status: b.status,
                                items: Object.fromEntries(b.items.map((i) => [i.id, i.qty])),
                              }
                        )
                      }
                    >
                      {isEditing ? "Close" : "Edit"}
                    </button>

                    {b.status === "confirmed" && (
                      <>
                        <button
                          className="btn btn-sm btn-outline-success"
                          disabled={busy === b.id}
                          onClick={() => act(b, "return")}
                        >
                          Returned
                        </button>
                        <button
                          className="btn btn-sm btn-outline-warning"
                          disabled={busy === b.id}
                          onClick={() => act(b, "cancel")}
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {b.status !== "confirmed" && (
                      <button
                        className="btn btn-sm btn-outline-success"
                        disabled={busy === b.id}
                        onClick={() => act(b, "restore")}
                      >
                        Restore
                      </button>
                    )}

                    <button
                      className="btn btn-sm btn-outline-danger ms-auto"
                      disabled={busy === b.id}
                      onClick={() => remove(b)}
                    >
                      Delete
                    </button>
                  </div>

                  {isEditing && avail && (
                    <div className="border-top mt-3 pt-3">
                      <div className="row g-2 mb-3">
                        <div className="col-6 col-md-3">
                          <label className="form-label small mb-1">From</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={editing.startDate}
                            onChange={(e) =>
                              setEditing({ ...editing, startDate: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-6 col-md-3">
                          <label className="form-label small mb-1">To</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={editing.endDate}
                            onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                          />
                        </div>
                      </div>

                      {items
                        .filter((i) => i.active || editing.items[i.id])
                        .map((item) => {
                          const view = availForEdit(item.id);
                          const [fi, ti] = dateRangeIndices(editing.startDate, editing.endDate);
                          return (
                            <div
                              key={item.id}
                              className="d-flex align-items-center gap-3 py-1 flex-wrap"
                            >
                              {/* Fixed-width label so every strip below it
                                  starts at the same x and the columns read as
                                  one calendar. */}
                              <div className="small gear-admin-itemname">{item.name}</div>
                              {view && (
                                <AvailabilityStrip
                                  days={avail.days}
                                  free={view.free}
                                  quantity={item.quantity}
                                  fromIndex={fi}
                                  toIndex={ti}
                                  showWeekdays={false}
                                />
                              )}
                              <div className="btn-group btn-group-sm ms-auto">
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  onClick={() =>
                                    setEditing({
                                      ...editing,
                                      items: {
                                        ...editing.items,
                                        [item.id]: Math.max(0, (editing.items[item.id] || 0) - 1),
                                      },
                                    })
                                  }
                                >
                                  &minus;
                                </button>
                                <span className="btn btn-outline-secondary disabled gear-qty">
                                  {editing.items[item.id] || 0}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  onClick={() =>
                                    setEditing({
                                      ...editing,
                                      items: {
                                        ...editing.items,
                                        [item.id]: (editing.items[item.id] || 0) + 1,
                                      },
                                    })
                                  }
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}

                      <div className="text-muted small mt-2">
                        Strips show what would be free if this booking were removed. Saving
                        re-checks capacity; if it doesn't fit, nothing changes.
                      </div>

                      <div className="mt-3 d-flex gap-2">
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={busy === b.id}
                          onClick={saveEdit}
                        >
                          {busy === b.id ? "Saving…" : "Save changes"}
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setEditing(null)}
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {tab === "inventory" && (
          <div className="gear-admin-card">
            <p className="text-muted small">
              Changing a quantity never cancels existing bookings. If you drop below what's already
              booked you'll get a warning telling you how many days are affected.
            </p>
            {items.map((item) => (
              <div
                key={item.id}
                className="d-flex justify-content-between align-items-center gap-3 py-2 border-bottom flex-wrap"
              >
                <div>
                  <div className={item.active ? "" : "text-muted text-decoration-line-through"}>
                    {item.name}{" "}
                    <span className="text-muted">
                      &middot; {item.price_per_day > 0 ? `R${item.price_per_day}/day` : "free"}
                    </span>
                  </div>
                  <div className="text-muted small">
                    {item.description}
                    {item.deposit_note ? ` · ${item.deposit_note}` : ""}
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <div className="btn-group btn-group-sm">
                    <button
                      className="btn btn-outline-secondary"
                      disabled={busy === item.id || item.quantity === 0}
                      onClick={() => updateStock(item, { quantity: item.quantity - 1 })}
                    >
                      &minus;
                    </button>
                    <span className="btn btn-outline-secondary disabled gear-qty">
                      {item.quantity}
                    </span>
                    <button
                      className="btn btn-outline-secondary"
                      disabled={busy === item.id}
                      onClick={() => updateStock(item, { quantity: item.quantity + 1 })}
                    >
                      +
                    </button>
                  </div>
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={!!item.active}
                      disabled={busy === item.id}
                      onChange={(e) => updateStock(item, { active: e.target.checked })}
                      aria-label={`${item.name} bookable`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GearAdminPage;
