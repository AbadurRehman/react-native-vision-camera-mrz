import { describe, expect, it } from '@jest/globals';
import { parseMrzDate } from '../dates';

/** 8 October 2026, local time. */
const TODAY = new Date(2026, 9, 8);

const birth = (raw: string, today = TODAY) => parseMrzDate(raw, 'birth', today);
const expiry = (raw: string, today = TODAY) =>
  parseMrzDate(raw, 'expiry', today);

describe('parseMrzDate', () => {
  it('returns all parts and an ISO date', () => {
    expect(birth('740812')).toEqual({
      valid: true,
      date: {
        raw: '740812',
        year: 1974,
        month: 8,
        day: 12,
        iso: '1974-08-12',
      },
    });
  });

  it('zero-pads the ISO date', () => {
    expect(birth('010203').date.iso).toBe('2001-02-03');
  });

  describe('birth dates', () => {
    it('use the current century when the date is not in the future', () => {
      expect(birth('250101').date.year).toBe(2025);
      expect(birth('261008').date.year).toBe(2026); // today
    });

    it('use the previous century when the date would be in the future', () => {
      expect(birth('261009').date.year).toBe(1926); // tomorrow
      expect(birth('270101').date.year).toBe(1927);
      expect(birth('990101').date.year).toBe(1999);
    });

    it('treat unknown month or day in the current year as not in the future', () => {
      expect(birth('26<<<<').date.year).toBe(2026);
      expect(birth('2610<<').date.year).toBe(2026);
      expect(birth('2611<<').date.year).toBe(1926);
    });

    it('follow the reference date into the next century', () => {
      expect(birth('990101', new Date(2101, 0, 1)).date.year).toBe(2099);
      expect(birth('000101', new Date(2101, 0, 1)).date.year).toBe(2100);
    });
  });

  describe('expiry dates', () => {
    it('allow up to 20 years ahead', () => {
      expect(expiry('361231').date.year).toBe(2036);
      expect(expiry('461231').date.year).toBe(2046);
    });

    it('use the previous century beyond 20 years ahead', () => {
      expect(expiry('470101').date.year).toBe(1947);
      expect(expiry('991231').date.year).toBe(1999);
    });

    it('keep recently expired dates in the current century', () => {
      expect(expiry('120415').date.year).toBe(2012);
      expect(expiry('000101').date.year).toBe(2000);
    });
  });

  describe('unknown parts', () => {
    it('return null for parts marked with fillers', () => {
      expect(birth('74<<<<')).toEqual({
        valid: true,
        date: { raw: '74<<<<', year: 1974, month: null, day: null, iso: null },
      });
      expect(birth('<<<<<<').date).toEqual({
        raw: '<<<<<<',
        year: null,
        month: null,
        day: null,
        iso: null,
      });
    });

    it('accept 29 February when the year is unknown', () => {
      expect(birth('<<0229').valid).toBe(true);
    });

    it('accept any day up to 31 when the month is unknown', () => {
      expect(birth('74<<31').date).toMatchObject({ month: null, day: 31 });
      expect(birth('74<<32').valid).toBe(false);
    });
  });

  describe('invalid dates', () => {
    it.each([
      ['741301', 'month 13'],
      ['740001', 'month 0'],
      ['740800', 'day 0'],
      ['740832', 'day 32'],
      ['740431', '31 April'],
      ['010229', '29 February in a non-leap year'],
      ['7408<1', 'a half-filled part'],
      ['74O812', 'a letter'],
      ['74081', 'too short'],
      ['7408122', 'too long'],
    ])('reject %s (%s)', (raw) => {
      expect(birth(raw)).toEqual({
        valid: false,
        date: { raw, year: null, month: null, day: null, iso: null },
      });
    });

    it('accept 29 February in a leap year', () => {
      expect(birth('000229').date.iso).toBe('2000-02-29');
    });
  });
});
