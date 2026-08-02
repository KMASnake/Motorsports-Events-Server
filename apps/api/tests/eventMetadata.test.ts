import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { deriveEventTimezone, EventMetadataError, slugifyEventName, uniqueEventSlug } from '../src/lib/eventMetadata.js';

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

  it('déduit le fuseau du circuit et utilise UTC sans circuit', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ timezone: 'Europe/Paris' }], rowCount: 1 });
    const client = { query } as unknown as PoolClient;
    await expect(deriveEventTimezone(client, 'circuit-1')).resolves.toBe('Europe/Paris');
    await expect(deriveEventTimezone(client, null)).resolves.toBe('UTC');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('refuse un circuit inconnu', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(deriveEventTimezone({ query } as unknown as PoolClient, 'absent'))
      .rejects.toBeInstanceOf(EventMetadataError);
  });
});
