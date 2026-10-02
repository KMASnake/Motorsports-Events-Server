import { describe, expect, it } from 'vitest';
import { ALL_NAVIGATION_ITEMS } from './navigation';

describe('navigation opérationnelle', () => {
  it('n’affiche aucun compteur statique pour les modules sans backend', () => {
    expect(ALL_NAVIGATION_ITEMS.every((item) => item.badge === undefined)).toBe(true);
  });
});
