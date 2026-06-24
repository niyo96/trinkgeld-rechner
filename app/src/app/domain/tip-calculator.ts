function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function resolveShiftEndDateTime(
  startTime: string,
  endTime: string,
  eventStartDate: string,
  eventEndDate: string
): Date {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (endMinutes >= startMinutes) {
    // same time (0h) or end later same day → end on start date
    return new Date(`${eventStartDate}T${endTime}:00`);
  } else {
    // midnight crossing → end on next date
    return new Date(`${eventEndDate}T${endTime}:00`);
  }
}

export function validateShiftEndDate(shiftEnd: Date, eventEndDate: string): string | null {
  const eventEnd = new Date(`${eventEndDate}T23:59:59`);
  if (shiftEnd > eventEnd) {
    return `Schichtende (${shiftEnd.toLocaleDateString('de-DE')}) überschreitet das Veranstaltungsende (${eventEndDate}).`;
  }
  return null;
}

export function calculateGrossHours(
  startTime: string,
  endTime: string,
  eventStartDate: string,
  eventEndDate: string
): number {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (startMinutes === endMinutes) return 0;

  const start = new Date(`${eventStartDate}T${startTime}:00`);
  const end = resolveShiftEndDateTime(startTime, endTime, eventStartDate, eventEndDate);

  const diffMs = end.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60);
}

export function validateGrossHours(
  startTime: string,
  endTime: string,
  grossHours: number
): string | null {
  if (!startTime && !endTime) return null; // empty row — silent
  if (!startTime || !endTime) return 'Bitte Schichtbeginn und -ende angeben.';
  if (grossHours < 0) return 'Schicht endet vor dem Beginn — bitte Uhrzeiten prüfen.';
  if (grossHours === 0) return 'Schichtbeginn und -ende sind identisch — 0 Arbeitsstunden.';
  return null;
}

export function validateEventDates(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return null;
  if (endDate < startDate) return 'Enddatum liegt vor dem Startdatum.';
  return null;
}

export function validateBreak(grossHours: number, breakHours: number): string | null {
  if (breakHours >= grossHours) {
    return `Pause (${breakHours} h) ist größer oder gleich der Arbeitszeit (${grossHours} h). Nettostunden werden auf 0 gesetzt.`;
  }
  return null;
}

export function calculateNetHours(grossHours: number, breakHours: number): number {
  return Math.max(0, grossHours - breakHours);
}

export function distributeTips(netHours: number[], totalTip: number): number[] | null {
  const totalNetHours = netHours.reduce((sum, h) => sum + h, 0);
  if (totalNetHours === 0) return null;

  const totalCents = Math.round(totalTip * 100);

  // Raw proportional cents (floored)
  const rawCents = netHours.map(h => Math.floor((h / totalNetHours) * totalCents));
  const distributed = rawCents.reduce((a, b) => a + b, 0);
  let remainder = totalCents - distributed;

  // Largest remainder method: compute fractional parts for sorting
  const remainders = netHours.map((h, i) => ({
    index: i,
    frac: (h / totalNetHours) * totalCents - rawCents[i],
  }));
  remainders.sort((a, b) => b.frac - a.frac);

  const result = [...rawCents];
  for (let i = 0; i < remainder; i++) {
    result[remainders[i].index]++;
  }

  return result.map(c => c / 100);
}
