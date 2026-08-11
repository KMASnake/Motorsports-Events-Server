import { describe, expect, it } from 'vitest';
import { safeLoginDestination } from './LoginPage';

describe('safe login destination', () => {
  it('keeps an internal path including its query', () => {
    expect(safeLoginDestination('/events?page=2')).toBe('/events?page=2');
  });

  it('rejects external and protocol-relative destinations', () => {
    expect(safeLoginDestination('https://evil.invalid')).toBe('/');
    expect(safeLoginDestination('//evil.invalid')).toBe('/');
    expect(safeLoginDestination(undefined)).toBe('/');
  });
});
