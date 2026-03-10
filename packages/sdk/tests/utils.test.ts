import { describe, it, expect } from 'vitest';
import { truncateBody, estimateSize, flattenHeaders } from '../src/utils';

describe('truncateBody', () => {
  it('returns empty string for null/undefined', () => {
    expect(truncateBody(null, 1024)).toBe('');
    expect(truncateBody(undefined, 1024)).toBe('');
  });

  it('returns string as-is when under limit', () => {
    expect(truncateBody('hello', 1024)).toBe('hello');
  });

  it('truncates string when over limit', () => {
    const long = 'a'.repeat(200);
    const result = truncateBody(long, 100);
    expect(Buffer.byteLength(result, 'utf-8')).toBeLessThanOrEqual(100 + 3); // +3 for "…" in utf-8
  });

  it('serializes objects to JSON', () => {
    const obj = { key: 'value' };
    expect(truncateBody(obj, 1024)).toBe(JSON.stringify(obj));
  });

  it('truncates large objects', () => {
    const obj = { data: 'x'.repeat(200) };
    const result = truncateBody(obj, 50);
    expect(Buffer.byteLength(result, 'utf-8')).toBeLessThanOrEqual(50 + 3);
  });

  it('returns [unserializable] for circular references', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(truncateBody(obj, 1024)).toBe('[unserializable]');
  });
});

describe('estimateSize', () => {
  it('returns 0 for null/undefined', () => {
    expect(estimateSize(null)).toBe(0);
    expect(estimateSize(undefined)).toBe(0);
  });

  it('returns byte length for strings', () => {
    expect(estimateSize('hello')).toBe(5);
  });

  it('handles multi-byte characters', () => {
    expect(estimateSize('ü')).toBe(2);
  });

  it('serializes objects and returns byte length', () => {
    const obj = { a: 1 };
    expect(estimateSize(obj)).toBe(Buffer.byteLength(JSON.stringify(obj)));
  });

  it('returns 0 for unserializable objects', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(estimateSize(obj)).toBe(0);
  });
});

describe('flattenHeaders', () => {
  it('returns empty object for null/undefined', () => {
    expect(flattenHeaders(null)).toEqual({});
    expect(flattenHeaders(undefined)).toEqual({});
  });

  it('flattens plain objects', () => {
    const headers = { 'content-type': 'application/json', 'x-custom': 123 };
    expect(flattenHeaders(headers)).toEqual({
      'content-type': 'application/json',
      'x-custom': '123',
    });
  });

  it('skips null/undefined values', () => {
    const headers = { 'x-a': 'ok', 'x-b': null, 'x-c': undefined };
    expect(flattenHeaders(headers)).toEqual({ 'x-a': 'ok' });
  });

  it('uses toJSON() when available', () => {
    const headers = {
      toJSON: () => ({ 'content-type': 'text/plain' }),
    };
    expect(flattenHeaders(headers)).toEqual({ 'content-type': 'text/plain' });
  });
});
