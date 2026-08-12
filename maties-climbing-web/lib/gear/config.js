// Every tunable knob for gear booking. Change here, not in the handlers.

export const TIMEZONE = "Africa/Johannesburg"; // SAST, UTC+2, no DST

// Bookable window: today through today + (BOOKING_WINDOW_DAYS - 1), inclusive.
export const BOOKING_WINDOW_DAYS = 14;

// Longest single booking, counted inclusively (8th to 10th = 3 days).
export const MAX_BOOKING_DAYS = 7;

// Anti-hoarding limits. These are deliberately loose enough for a real trad
// day - rope + rack + 12 draws + 2 harnesses + 2 belay devices is 5 distinct
// items and 17 units - while still stopping someone emptying the cupboard.
// Per-item `max_per_booking` in gear_items does the finer-grained limiting.
export const MAX_DISTINCT_ITEMS = 6;
export const MAX_TOTAL_UNITS = 20;
export const MAX_ACTIVE_BOOKINGS_PER_PERSON = 1;

// Rate limits, counted per hashed IP over rolling windows. These only see
// successful bookings; add a Cloudflare WAF rule to cover failed attempts.
export const RATE_LIMIT_PER_IP_PER_HOUR = 3;
export const RATE_LIMIT_PER_IP_PER_DAY = 6;

export const MAX_BODY_BYTES = 8 * 1024;

// Booking reference alphabet. No 0/O/1/I/L - these get read aloud over
// WhatsApp and written on a whiteboard at the wall.
export const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const CALLMEBOT_TIMEOUT_MS = 6000;
