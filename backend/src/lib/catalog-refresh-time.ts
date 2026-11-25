const CATALOG_SCHEDULE_TIME_ZONE = "Asia/Kolkata";

export function getCatalogScheduleDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: CATALOG_SCHEDULE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function isCatalogRefreshDue(date: Date, scheduledTime: string) {
  const localSchedule = getCatalogScheduleDateTime(date);
  return {
    ...localSchedule,
    due: localSchedule.time >= scheduledTime,
  };
}
