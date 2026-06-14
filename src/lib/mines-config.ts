// Mines safety limits. Kept in sync with migration 009 / function
// mines_config() on the database. These constants are used by both
// server actions and client components — this module must NOT have a
// "use server" directive so plain const exports are allowed.
export const MINES_MAX_BET = 10;
export const MINES_MAX_PAYOUT = 100;
export const MINES_DAILY_CAP = 50;
