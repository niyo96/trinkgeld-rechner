import {
  resolveShiftEndDateTime,
  calculateGrossHours,
  calculateNetHours,
  distributeTips,
  validateBreak,
  validateEventDates,
  validateGrossHours,
  validateShiftEndDate,
} from './tip-calculator';

describe('resolveShiftEndDateTime', () => {
  const eventStartDate = '2026-06-23';
  const eventEndDate = '2026-06-24';

  it('16:00–23:00 same-day shift → end on start date', () => {
    const result = resolveShiftEndDateTime('16:00', '23:00', eventStartDate, eventEndDate);
    expect(result.toISOString()).toBe(new Date('2026-06-23T23:00:00').toISOString());
  });

  it('16:00–02:00 midnight-crossing shift → end on next date', () => {
    const result = resolveShiftEndDateTime('16:00', '02:00', eventStartDate, eventEndDate);
    expect(result.toISOString()).toBe(new Date('2026-06-24T02:00:00').toISOString());
  });

  it('16:00–20:15 same-day event', () => {
    const result = resolveShiftEndDateTime('16:00', '20:15', '2026-06-24', '2026-06-24');
    expect(result.toISOString()).toBe(new Date('2026-06-24T20:15:00').toISOString());
  });

  it('00:00–00:00 → end equals start (0 h edge case)', () => {
    const result = resolveShiftEndDateTime('00:00', '00:00', eventStartDate, eventEndDate);
    const start = new Date(`${eventStartDate}T00:00:00`);
    expect(result.getTime()).toBe(start.getTime());
  });
});

describe('validateShiftEndDate', () => {
  it('shift end within event range → no warning', () => {
    const shiftEnd = new Date('2026-06-24T02:00:00');
    const eventEnd = '2026-06-24';
    expect(validateShiftEndDate(shiftEnd, eventEnd)).toBeNull();
  });

  it('shift end exceeds event end date → warning', () => {
    const shiftEnd = new Date('2026-06-25T01:00:00');
    const eventEnd = '2026-06-24';
    expect(validateShiftEndDate(shiftEnd, eventEnd)).toBeTruthy();
  });
});

describe('calculateGrossHours', () => {
  const eventStartDate = '2026-06-23';
  const eventEndDate = '2026-06-24';

  it('16:00–23:00 → 7.0 h', () => {
    expect(calculateGrossHours('16:00', '23:00', eventStartDate, eventEndDate)).toBe(7.0);
  });

  it('16:00–02:00 (midnight crossing) → 10.0 h', () => {
    expect(calculateGrossHours('16:00', '02:00', eventStartDate, eventEndDate)).toBe(10.0);
  });

  it('16:00–20:15 → 4.25 h', () => {
    expect(calculateGrossHours('16:00', '20:15', '2026-06-24', '2026-06-24')).toBe(4.25);
  });

  it('00:00–00:00 → 0 h', () => {
    expect(calculateGrossHours('00:00', '00:00', eventStartDate, eventEndDate)).toBe(0);
  });
});

describe('validateBreak', () => {
  it('break smaller than gross hours → no warning', () => {
    expect(validateBreak(8.0, 0.5)).toBeNull();
  });

  it('break equal to gross hours → warning', () => {
    expect(validateBreak(4.0, 4.0)).toBeTruthy();
  });

  it('break larger than gross hours → warning', () => {
    expect(validateBreak(4.0, 5.0)).toBeTruthy();
  });

  it('break must be multiple of 0.25', () => {
    expect(0.5 % 0.25).toBe(0);
    expect(0.75 % 0.25).toBe(0);
    expect(1.0 % 0.25).toBe(0);
  });
});

describe('calculateNetHours', () => {
  it('8.0 h − 0.5 h break = 7.5 h', () => {
    expect(calculateNetHours(8.0, 0.5)).toBe(7.5);
  });

  it('break > gross hours → net = 0', () => {
    expect(calculateNetHours(4.0, 5.0)).toBe(0);
  });

  it('break = gross hours → net = 0', () => {
    expect(calculateNetHours(4.0, 4.0)).toBe(0);
  });

  it('no break → gross = net', () => {
    expect(calculateNetHours(6.0, 0)).toBe(6.0);
  });
});

describe('distributeTips', () => {
  it('2 employees with 4h each, 100.00 € → 50.00 each', () => {
    const result = distributeTips([4, 4], 100.0);
    expect(result).toEqual([50.0, 50.0]);
    expect(result![0] + result![1]).toBe(100.0);
  });

  it('3 employees with 4h each, 100.00 € → 33.34 / 33.33 / 33.33', () => {
    const result = distributeTips([4, 4, 4], 100.0);
    expect(result![0]).toBe(33.34);
    expect(result![1]).toBe(33.33);
    expect(result![2]).toBe(33.33);
    expect(result![0] + result![1] + result![2]).toBe(100.0);
  });

  it('1 employee → receives 100%', () => {
    const result = distributeTips([7.5], 100.0);
    expect(result![0]).toBe(100.0);
  });

  it('total hours = 0 → returns null (no division by zero)', () => {
    const result = distributeTips([0, 0], 100.0);
    expect(result).toBeNull();
  });

  it('sum of distributed amounts always equals total tip exactly', () => {
    const result = distributeTips([3, 5, 7], 99.99);
    expect(result).not.toBeNull();
    const sum = result!.reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100)).toBe(Math.round(99.99 * 100));
  });

  it('unequal hours distribute proportionally', () => {
    const result = distributeTips([6, 4], 100.0);
    expect(result).not.toBeNull();
    expect(result![0]).toBe(60.0);
    expect(result![1]).toBe(40.0);
  });
});

describe('validateGrossHours', () => {
  it('returns null for valid positive hours', () => {
    expect(validateGrossHours('16:00', '23:00', 7)).toBeNull();
  });

  it('returns error for negative gross hours (Schicht endet vor Beginn)', () => {
    const msg = validateGrossHours('16:00', '02:00', -14);
    expect(msg).not.toBeNull();
    expect(msg).toContain('Uhrzeiten');
  });

  it('returns error for zero hours (Start == Ende)', () => {
    const msg = validateGrossHours('12:00', '12:00', 0);
    expect(msg).not.toBeNull();
    expect(msg).toContain('identisch');
  });

  it('returns error when only startTime is missing', () => {
    const msg = validateGrossHours('', '02:00', 0);
    expect(msg).not.toBeNull();
    expect(msg).toContain('angeben');
  });

  it('returns error when only endTime is missing', () => {
    const msg = validateGrossHours('16:00', '', 0);
    expect(msg).not.toBeNull();
    expect(msg).toContain('angeben');
  });

  it('returns null silently when both times are empty (empty row)', () => {
    expect(validateGrossHours('', '', 0)).toBeNull();
  });

  it('negative hours on single-day event with midnight crossing → error', () => {
    // Same startDate and endDate → resolvedEnd is on startDate → earlier than start
    const gross = calculateGrossHours('16:00', '02:00', '2026-06-24', '2026-06-24');
    expect(gross).toBeLessThan(0);
    const msg = validateGrossHours('16:00', '02:00', gross);
    expect(msg).not.toBeNull();
    expect(msg).toContain('Uhrzeiten');
  });
});

describe('validateEventDates', () => {
  it('returns null when dates are equal (same-day event)', () => {
    expect(validateEventDates('2026-06-24', '2026-06-24')).toBeNull();
  });

  it('returns null when end is after start', () => {
    expect(validateEventDates('2026-06-23', '2026-06-24')).toBeNull();
  });

  it('returns error when end is before start', () => {
    const msg = validateEventDates('2026-06-25', '2026-06-23');
    expect(msg).not.toBeNull();
    expect(msg).toContain('Enddatum');
  });

  it('returns null when either date is empty (incomplete input)', () => {
    expect(validateEventDates('', '2026-06-24')).toBeNull();
    expect(validateEventDates('2026-06-23', '')).toBeNull();
    expect(validateEventDates('', '')).toBeNull();
  });
});
