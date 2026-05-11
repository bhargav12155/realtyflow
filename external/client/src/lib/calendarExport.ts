interface CalendarEvent {
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  isAllDay?: boolean;
  eventUrl?: string | null;
}

function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/Chicago";
  }
}

function toUTCString(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function toDateOnly(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function getEndTime(event: CalendarEvent): string {
  if (event.endTime) return event.endTime;
  const start = new Date(event.startTime);
  if (event.isAllDay) {
    start.setDate(start.getDate() + 1);
  } else {
    start.setHours(start.getHours() + 1);
  }
  return start.toISOString();
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildDescription(event: CalendarEvent): string {
  let desc = event.description || "";
  if (event.eventUrl) {
    desc += desc ? `\n\nMore info: ${event.eventUrl}` : event.eventUrl;
  }
  return desc;
}

export function generateICS(event: CalendarEvent): string {
  const end = getEndTime(event);
  const desc = buildDescription(event);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//iMakePage//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
  ];

  if (event.isAllDay) {
    lines.push(`DTSTART;VALUE=DATE:${toDateOnly(event.startTime)}`);
    lines.push(`DTEND;VALUE=DATE:${toDateOnly(end)}`);
  } else {
    lines.push(`DTSTART:${toUTCString(event.startTime)}`);
    lines.push(`DTEND:${toUTCString(end)}`);
  }

  lines.push(`SUMMARY:${escapeICS(event.title)}`);
  if (desc) lines.push(`DESCRIPTION:${escapeICS(desc)}`);
  if (event.location) lines.push(`LOCATION:${escapeICS(event.location)}`);
  if (event.eventUrl) lines.push(`URL:${event.eventUrl}`);

  lines.push(
    `DTSTAMP:${toUTCString(new Date().toISOString())}`,
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@imakepage.com`,
    "END:VEVENT",
    "END:VCALENDAR"
  );

  return lines.join("\r\n");
}

export function downloadICS(event: CalendarEvent): void {
  const ics = generateICS(event);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getGoogleCalendarUrl(event: CalendarEvent): string {
  const end = getEndTime(event);
  const desc = buildDescription(event);

  const startFmt = event.isAllDay ? toDateOnly(event.startTime) : toUTCString(event.startTime);
  const endFmt = event.isAllDay ? toDateOnly(end) : toUTCString(end);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${startFmt}/${endFmt}`,
  });
  if (desc) params.set("details", desc);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function getOutlookCalendarUrl(event: CalendarEvent): string {
  const end = getEndTime(event);
  const desc = buildDescription(event);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: new Date(event.startTime).toISOString(),
    enddt: new Date(end).toISOString(),
  });
  if (event.isAllDay) params.set("allday", "true");
  if (desc) params.set("body", desc);
  if (event.location) params.set("location", event.location);
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

export function getYahooCalendarUrl(event: CalendarEvent): string {
  const end = getEndTime(event);
  const desc = buildDescription(event);

  const startFmt = event.isAllDay ? toDateOnly(event.startTime) : toUTCString(event.startTime);
  const endFmt = event.isAllDay ? toDateOnly(end) : toUTCString(end);

  const params = new URLSearchParams({
    v: "60",
    title: event.title,
    st: startFmt,
    et: endFmt,
  });
  if (event.isAllDay) params.set("dur", "allday");
  if (desc) params.set("desc", desc);
  if (event.location) params.set("in_loc", event.location);
  return `https://calendar.yahoo.com/?${params.toString()}`;
}
