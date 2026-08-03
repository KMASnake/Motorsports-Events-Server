import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { EVENT_STORAGE_TIMEZONE, slugifyEventName, uniqueEventSlug } from '../src/lib/eventMetadata.js';

describe('métadonnées techniques des événements', () => {
  it('génère un slug stable sans accent', () => {
    expect(slugifyEventName('Grand Prix d’Été — France')).toBe('grand-prix-d-ete-france');
    expect(slugifyEventName('***')).toBe('evenement');
  });

  it('ajoute un suffixe déterministe quand le slug existe', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ slug: 'grand-prix' }, { slug: 'grand-prix-2' }], rowCount: 2 });
    const slug = await uniqueEventSlug({ query } as unknown as PoolClient, 'Grand Prix');
    expect(slug).toBe('grand-prix-3');
  });

  it('impose UTC comme fuseau de stockage unique', () => {
    expect(EVENT_STORAGE_TIMEZONE).toBe('UTC');
  });
});
