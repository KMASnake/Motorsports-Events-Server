import { describe, expect, it } from 'vitest';
import { assetRegistry } from './assetRegistry';

describe('country asset registry', () => {
  it.each(['FR', 'br', 'ZA', 'NZ'])('resolves ISO country %s without a whitelist', (code) => {
    expect(assetRegistry.country(code).src).toBe(`/assets/flags/${code.toLowerCase()}.svg`);
  });

  it('keeps a safe text fallback for an invalid country code', () => {
    expect(assetRegistry.country('FRA')).toEqual({ label: '--', src: null, alt: 'Pays non renseigné' });
  });
});
