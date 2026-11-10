/** Match the local day selected by the calendar, including its year. */
export function sameLocalCalendarDay(first: Date, second: Date): boolean {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}
