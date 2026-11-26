export { addDays } from "./day";
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
