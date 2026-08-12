import React from "react";
import "./AvailabilityStrip.css";

// A 14-day availability strip: one dot per day, filled/half/hollow depending
// on how many units are free. Shared by the booking page and the admin page.
//
// This exists instead of a full items x days table because the club is
// mobile-heavy - 14 columns on a 360px screen means either horizontal scroll
// or unreadable cells. Fourteen dots at ~22px pitch is ~310px and fits.
//
// Colour never carries meaning on its own: the glyph shape and the per-dot
// aria-label/title both state the count.

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

function weekdayLetter(iso) {
  return WEEKDAY[new Date(iso + "T00:00:00Z").getUTCDay()];
}

function label(iso, free, quantity) {
  const date = new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));
  if (free === 0) return `${date} - fully booked`;
  return `${date} - ${free} of ${quantity} free`;
}

export default function AvailabilityStrip({
  days,
  free,
  quantity,
  fromIndex = -1,
  toIndex = -1,
  showWeekdays = true,
}) {
  const inRange = (i) => fromIndex >= 0 && toIndex >= fromIndex && i >= fromIndex && i <= toIndex;

  return (
    <div className="gear-strip">
      {showWeekdays && (
        <div className="gear-strip-row gear-strip-weekdays" aria-hidden="true">
          {days.map((d) => (
            <span key={d} className="gear-strip-cell">
              {weekdayLetter(d)}
            </span>
          ))}
        </div>
      )}

      <div className="gear-strip-row">
        {days.map((d, i) => {
          const n = free[i];
          const state = n === 0 ? "none" : n < quantity ? "some" : "all";
          return (
            <span
              key={d}
              className={`gear-strip-cell gear-dot gear-dot-${state}${
                inRange(i) ? " gear-dot-selected" : ""
              }`}
              title={label(d, n, quantity)}
              aria-label={label(d, n, quantity)}
              role="img"
            >
              {n === 0 ? "○" : n < quantity ? "◐" : "●"}
            </span>
          );
        })}
      </div>

      <div className="gear-strip-row gear-strip-underline" aria-hidden="true">
        {days.map((d, i) => (
          <span key={d} className="gear-strip-cell">
            <span className={inRange(i) ? "gear-strip-bar" : ""} />
          </span>
        ))}
      </div>
    </div>
  );
}
