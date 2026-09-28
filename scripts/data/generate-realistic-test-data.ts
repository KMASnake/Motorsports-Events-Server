import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { CanonicalFieldOverrideService } from '../../apps/api/src/reconciliation/canonicalFieldOverrideService.js';

const seed = process.argv.find((value) => value.startsWith('--seed='))?.split('=')[1] ?? 'lot-4.2';
const id = (kind: string, index: number) => createHash('sha256')
  .update(`${seed}:${kind}:${index}`)
  .digest('hex')
  .slice(0, 16);
const uuid = (kind: string, index: number) => {
  const value = createHash('sha256').update(`${seed}:${kind}:${index}`).digest('hex');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-a${value.slice(17, 20)}-${value.slice(20, 32)}`;
};
const countries = ['FR', 'GB', 'IT', 'DE', 'ES', 'US', 'JP', 'AU'];
const providers = ['ocblacktop', 'thesportsdb', 'future-timing-feed'];
const seedToken = id('seed', 0).slice(0, 8);
const canonicalEventIndices = new Set([0, 3, 6, 9, 24]);

type CorrectionFixture = {
  eventIndex: number;
  field: string;
  providerValue: unknown;
  overrideValue: unknown;
  status: 'active' | 'conflict';
  author: string;
  daysAgo: number;
};

const overrideService = new CanonicalFieldOverrideService();

export async function generateRealisticTestData(pool: pg.Pool): Promise<void> {
  for (let index = 0; index < 12; index += 1) {
    await pool.query(
        `insert into championships(id,slug,name,short_name,season,active)
         values($1,$2,$3,$4,2026,true) on conflict(id) do nothing`,
        [id('champ', index), `test-${seedToken}-championship-${index + 1}`, `Championnat test ${index + 1}`, `TC${index + 1}`]
    );
  }
    for (let index = 0; index < 40; index += 1) {
      await pool.query(
        `insert into circuits(id,name,city,country_code,timezone)
         values($1,$2,$3,$4,$5) on conflict(id) do nothing`,
        [id('circuit', index), `Circuit test ${index + 1}`, `Ville ${index + 1}`, countries[index % countries.length], 'UTC']
      );
    }
    for (let index = 0; index < 96; index += 1) {
      const start = new Date(Date.UTC(2026, index % 12, 2 + (index * 3) % 25, 8 + (index % 10), 0));
      const providerEvent = index % 3 === 0;
      const client = await pool.connect();
      try {
        await client.query('begin');
        if (canonicalEventIndices.has(index)) {
          await client.query(
            `insert into meetings(id,championship_id,name,season,starts_at,ends_at,timezone)
             values($1,$2,$3,2026,$4,$5,'UTC') on conflict(id) do nothing`,
            [uuid('meeting', index), id('champ', index % 12), `Épreuve test ${index + 1}`, start, new Date(start.getTime() + (1 + index % 5) * 3_600_000)]
          );
        }
        await client.query(
        `insert into events(
           id,championship_id,circuit_id,name,slug,category,session_type_key,starts_at,ends_at,timezone,status,published,
           origin,provider_key,external_id,description,normalized_uuid
         ) values($1,$2,$3,$4,$5,'other','other',$6,$7,'UTC',$8,$9,$10,$11,$12,$13,$14)
         on conflict(id) do update set
           origin=excluded.origin,
           provider_key=excluded.provider_key,
           external_id=excluded.external_id,
           normalized_uuid=coalesce(events.normalized_uuid,excluded.normalized_uuid)`,
        [
          id('event', index), id('champ', index % 12), id('circuit', index % 40),
          `Événement test ${index + 1}`, `event-test-${index + 1}-${id('slug', index)}`,
          start, new Date(start.getTime() + (1 + index % 5) * 3_600_000),
          index % 13 === 0 ? 'cancelled' : index % 17 === 0 ? 'postponed' : start < new Date() ? 'completed' : 'scheduled',
          index % 7 !== 0,
          providerEvent ? 'provider' : 'manual',
          providerEvent ? providers[(index / 3) % providers.length] : null,
          providerEvent ? `synthetic-${seed}-${index + 1}` : null,
          `Données synthétiques déterministes (${seed}).`, canonicalEventIndices.has(index) ? uuid('event', index) : null
        ]
        );
        if (canonicalEventIndices.has(index)) {
          await client.query(
            `insert into meeting_events(meeting_id,event_id,position) values($1,$2,0)
             on conflict(event_id) do update set meeting_id=excluded.meeting_id`,
            [uuid('meeting', index), id('event', index)]
          );
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }

    const corrections: CorrectionFixture[] = [
      { eventIndex: 0, field: 'name', providerValue: 'Grand Prix fournisseur', overrideValue: 'Grand Prix corrigé', status: 'active', author: 'administrateur', daysAgo: 0 },
      { eventIndex: 3, field: 'starts_at', providerValue: '2026-04-11T09:00:00.000Z', overrideValue: '2026-04-11T10:30:00.000Z', status: 'active', author: 'planificateur', daysAgo: 1 },
      { eventIndex: 3, field: 'ends_at', providerValue: '2026-04-11T11:00:00.000Z', overrideValue: '2026-04-11T12:30:00.000Z', status: 'active', author: 'planificateur', daysAgo: 1 },
      { eventIndex: 6, field: 'status', providerValue: 'scheduled', overrideValue: 'postponed', status: 'conflict', author: 'direction-course', daysAgo: 2 },
      { eventIndex: 24, field: 'name', providerValue: 'Rally fournisseur', overrideValue: 'Rally local', status: 'active', author: 'administrateur', daysAgo: 30 }
    ];

    for (const [index, correction] of corrections.entries()) {
      const eventId = id('event', correction.eventIndex);
      const updatedAt = new Date(Date.now() - correction.daysAgo * 86_400_000);
      const client = await pool.connect();
      try {
        await client.query('begin');
        await overrideService.setCompatibleInTransaction(client, {
          entityKind: 'event', entityUuid: uuid('event', correction.eventIndex), canonicalRecordId: eventId,
          fieldName: correction.field, value: correction.overrideValue,
          providerValueAtCreation: correction.providerValue, actorId: correction.author,
          reason: 'Deterministic acceptance fixture', legacyOperationId: `acceptance:${seed}:${index}`,
          legacyEventCorrectionId: id('correction', index), legacyStatus: correction.status
        });
        await client.query(
          `update events set ${correction.field}=$2,updated_at=$3 where id=$1`,
          [eventId, correction.overrideValue, updatedAt]
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }
  console.log(`Données synthétiques générées avec seed=${seed}: 12 championnats, 40 circuits, 96 événements, dont 32 événements fournisseur et 5 corrections canoniques.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  generateRealisticTestData(pool)
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => pool.end());
}
