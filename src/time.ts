export function getDateParts(timeZone: string, date = new Date()): { date: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

export function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  utc.setUTCDate(utc.getUTCDate() + days);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatWindow(startHour: number, endHour: number): string {
  return `${formatHour(startHour)}–${formatHour(endHour)}`;
}

export function formatDisplayDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const dd = String(day ?? 1).padStart(2, '0');
  const mm = String(month ?? 1).padStart(2, '0');
  const yy = String(year ?? 0).slice(-2).padStart(2, '0');
  return `${dd}.${mm}.${yy}`;
}
