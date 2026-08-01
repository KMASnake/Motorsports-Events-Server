import { describe, expect, it } from 'vitest';

describe('bootstrap', () => {
  it('exposes the expected version', () => {
    expect('8.1.0-alpha.2-lot.4').toBe('8.1.0-alpha.2-lot.4');
  });
});
