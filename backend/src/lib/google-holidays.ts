const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars";

export type GoogleHoliday = {
  id: string;
  title: string;
  description: string;
  date: string;
  category: "festival";
  source: "google";
};

export type GoogleHolidayResult = {
  configured: boolean;
  events: GoogleHoliday[];
  error?: string;
};

function googleEventDate(event: { start?: { date?: string; dateTime?: string } }) {
  return event.start?.date ?? event.start?.dateTime?.slice(0, 10) ?? "";
}

export async function loadGoogleHolidays(start: Date, end: Date): Promise<GoogleHolidayResult> {
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY?.trim();
  if (!apiKey) return { configured: false, events: [] };

  const calendarId = process.env.GOOGLE_HOLIDAY_CALENDAR_ID?.trim()
    || "en.indian#holiday@group.v.calendar.google.com";
  const url = new URL(`${GOOGLE_CALENDAR_API}/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("timeMin", start.toISOString());
  url.searchParams.set("timeMax", end.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("timeZone", "Asia/Kolkata");

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const result = await response.json() as {
    items?: Array<{
      id?: string;
      summary?: string;
      description?: string;
      start?: { date?: string; dateTime?: string };
    }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(result.error?.message || `Google Calendar returned status ${response.status}.`);
  }

  return {
    configured: true,
    events: (result.items ?? []).flatMap((event) => {
      const date = googleEventDate(event);
      if (!event.id || !event.summary || !date) return [];
      return [{
        id: event.id,
        title: event.summary.slice(0, 120),
        description: (event.description ?? "").slice(0, 1000),
        date,
        category: "festival" as const,
        source: "google" as const,
      }];
    }),
  };
}
