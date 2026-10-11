// Building 7: floors 1-7, eight units a floor (Apt 101-108 ... Apt 701-708).
// Must match normalize_unit() in supabase_two_boards.sql.
export const UNIT_FLOORS = [1, 2, 3, 4, 5, 6, 7].map((floor) => ({
  floor,
  units: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `Apt ${floor}0${n}`),
}));

export const isValidUnit = (value) => UNIT_FLOORS.some((f) => f.units.includes(value));
