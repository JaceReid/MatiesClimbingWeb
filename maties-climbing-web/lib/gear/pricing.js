// Rental pricing.
//
// Prices are whole rand per day, per bookable unit. Money is never a float:
// everything here is integer arithmetic on rand, so totals cannot drift.
//
// Deposits are deliberately NOT computed. The club sets them case by case
// ("depends on use"), so gear_items.deposit_note carries free text that is
// shown to the booker and repeated to the gear officer, and the actual amount
// is agreed at the cupboard.

/** Total for one line: units x rate x nights. */
export function lineTotal({ qty, pricePerDay }, days) {
  return qty * pricePerDay * days;
}

/** Total for a whole booking. `items` need qty + pricePerDay. */
export function bookingTotal(items, days) {
  return items.reduce((sum, item) => sum + lineTotal(item, days), 0);
}

/**
 * Every chosen item that carries a deposit, in item order.
 *
 * Deliberately NOT de-duplicated by note text: several items share the exact
 * wording "Deposit required, depends on use", and collapsing on that would
 * silently drop all but the first, so the gear officer would only be told
 * about one of the two things needing a deposit.
 */
export function depositNotes(items) {
  return items
    .filter((item) => item.depositNote)
    .map((item) => ({ name: item.name, note: item.depositNote }));
}

/** 'R60'. Whole rand - the club doesn't deal in cents. */
export function formatRand(amount) {
  return `R${amount}`;
}
