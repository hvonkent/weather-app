export function formatForecastTime(
  unixTimestamp: number,
  timeZone: string
) {
  const date =
    new Date(
      unixTimestamp * 1000
    );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(date);
}


export function formatCollectedTime(
  isoTimestamp: string,
  timeZone: string
) {
  const date =
    new Date(
      isoTimestamp
    );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }
  ).format(date);
}