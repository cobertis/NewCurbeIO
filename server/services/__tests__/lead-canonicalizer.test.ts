import { describe, it, expect } from 'vitest';
import {
  splitCsvList,
  normalizePhoneToE164,
  normalizeEmail,
  parsePhoneWithDnc
} from '../lead-canonicalizer-service';

describe('splitCsvList', () => {
  it('returns empty array for null', () => {
    expect(splitCsvList(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(splitCsvList(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(splitCsvList('')).toEqual([]);
  });

  it('splits comma-separated values', () => {
    expect(splitCsvList('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace from values', () => {
    expect(splitCsvList(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });

  it('removes empty values', () => {
    expect(splitCsvList('a,,b')).toEqual(['a', 'b']);
  });
});

describe('normalizePhoneToE164', () => {
  it('normalizes 10-digit US phone', () => {
    expect(normalizePhoneToE164('5551234567')).toEqual({
      normalized: '+15551234567',
      isValid: true
    });
  });

  it('normalizes 11-digit US phone starting with 1', () => {
    expect(normalizePhoneToE164('15551234567')).toEqual({
      normalized: '+15551234567',
      isValid: true
    });
  });

  it('normalizes formatted phone with parentheses and dashes', () => {
    expect(normalizePhoneToE164('(555) 123-4567')).toEqual({
      normalized: '+15551234567',
      isValid: true
    });
  });

  it('returns invalid for short numbers', () => {
    expect(normalizePhoneToE164('123')).toEqual({
      normalized: '123',
      isValid: false
    });
  });

  it('returns invalid for empty string', () => {
    expect(normalizePhoneToE164('')).toEqual({
      normalized: '',
      isValid: false
    });
  });
});

describe('normalizeEmail', () => {
  it('normalizes email to lowercase', () => {
    expect(normalizeEmail('Test@Example.COM')).toEqual({
      normalized: 'test@example.com',
      isValid: true
    });
  });

  it('returns invalid for email without @', () => {
    expect(normalizeEmail('invalid')).toEqual({
      normalized: 'invalid',
      isValid: false
    });
  });

  it('returns invalid for empty string', () => {
    expect(normalizeEmail('')).toEqual({
      normalized: '',
      isValid: false
    });
  });
});

describe('parsePhoneWithDnc', () => {
  it('aligns phones with DNC flags correctly (3 phones, 3 DNC flags)', () => {
    const result = parsePhoneWithDnc('555-111-1111,555-222-2222,555-333-3333', 'Y,N,Y', 'mobile');
    expect(result.phones).toHaveLength(3);
    expect(result.phones[0].dncStatus).toBe('yes');
    expect(result.phones[1].dncStatus).toBe('no');
    expect(result.phones[2].dncStatus).toBe('yes');
    expect(result.warnings).toHaveLength(0);
  });

  it('generates warning when DNC count mismatches (3 phones, 2 DNC flags)', () => {
    const result = parsePhoneWithDnc('555-111-1111,555-222-2222,555-333-3333', 'Y,N', 'mobile');
    expect(result.phones).toHaveLength(3);
    expect(result.phones[0].dncStatus).toBe('yes');
    expect(result.phones[1].dncStatus).toBe('no');
    expect(result.phones[2].dncStatus).toBe('unknown');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].phonesCount).toBe(3);
    expect(result.warnings[0].dncsCount).toBe(2);
  });

  it('sets all to unknown when no DNC flags provided', () => {
    const result = parsePhoneWithDnc('555-111-1111,555-222-2222', '', 'mobile');
    expect(result.phones).toHaveLength(2);
    expect(result.phones[0].dncStatus).toBe('unknown');
    expect(result.phones[1].dncStatus).toBe('unknown');
  });

  it('parses Y flag as yes', () => {
    const result = parsePhoneWithDnc('555-111-1111', 'Y', 'mobile');
    expect(result.phones[0].dncStatus).toBe('yes');
  });

  it('parses N flag as no', () => {
    const result = parsePhoneWithDnc('555-111-1111', 'N', 'mobile');
    expect(result.phones[0].dncStatus).toBe('no');
  });

  it('parses missing flag as unknown', () => {
    const result = parsePhoneWithDnc('555-111-1111', null, 'mobile');
    expect(result.phones[0].dncStatus).toBe('unknown');
  });
});
