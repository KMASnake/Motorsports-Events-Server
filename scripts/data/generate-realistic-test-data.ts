import { createHash } from 'node:crypto';
import pg from 'pg';

const seed = process.argv.find((value) => value.startsWith('--seed='))?.split('=')[1] ?? 'lot-4.2';
const id = (kind: string, index: number) => createHash('sha256')
  .update(`${seed}:${kind}:${index}`)
  .digest('hex')
  .slice(0, 16);
const countries = ['FR', 'GB', 'IT', 'DE', 'ES', 'US', 'JP', 'AU'];
const providers = ['ocblacktop', 'thesportsdb', 'future-timing-feed'];
const seedToken = id('seed', 0).slice(0, 8);

type CorrectionFixture = {
  eventIndex: number;
  field: string;
  providerValue: unknown;
  overrideValue: unknown;
  status: 'active' | 'conflict' | 'resolved' | 'ignored';
  author: string;
  daysAgo: number;
};

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
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
      await pool.query(
        `insert into events(
           id,championship_id,circuit_id,name,slug,starts_at,ends_at,timezone,status,published,
           origin,provider_key,external_id,description
         ) values($1,$2,$3,$4,$5,$6,$7,'UTC',$8,$9,$10,$11,$12,$13)
         on conflict(id) do update set
           origin=excluded.origin,
           provider_key=excluded.provider_key,
           external_id=excluded.external_id`,
        [
          id('event', index), id('champ', index % 12), id('circuit', index % 40),
          `Événement test ${index + 1}`, `event-test-${index + 1}-${id('slug', index)}`,
          start, new Date(start.getTime() + (1 + index % 5) * 3_600_000),
          index % 13 === 0 ? 'cancelled' : index % 17 === 0 ? 'postponed' : start < new Date() ? 'completed' : 'scheduled',
          index % 7 !== 0,
          providerEvent ? 'provider' : 'manual',
          providerEvent ? providers[(index / 3) % providers.length] : null,
          providerEvent ? `synthetic-${seed}-${index + 1}` : null,
          `Données synthétiques déterministes (${seed}).`
        ]
      );
    }

    const corrections: CorrectionFixture[] = [
      { eventIndex: 0, field: 'name', providerValue: 'Grand Prix fournisseur', overrideValue: 'Grand Prix corrigé', status: 'active', author: 'administrateur', daysAgo: 0 },
      { eventIndex: 0, field: 'circuit_id', providerValue: id('circuit', 0), overrideValue: id('circuit', 1), status: 'conflict', author: 'administrateur', daysAgo: 0 },
      { eventIndex: 3, field: 'starts_at', providerValue: '2026-04-11T09:00:00.000Z', overrideValue: '2026-04-11T10:30:00.000Z', status: 'active', author: 'planificateur', daysAgo: 1 },
      { eventIndex: 3, field: 'ends_at', providerValue: '2026-04-11T11:00:00.000Z', overrideValue: '2026-04-11T12:30:00.000Z', status: 'active', author: 'planificateur', daysAgo: 1 },
      { eventIndex: 6, field: 'status', providerValue: 'scheduled', overrideValue: 'postponed', status: 'conflict', author: 'direction-course', daysAgo: 2 },
      { eventIndex: 9, field: 'published', providerValue: true, overrideValue: false, status: 'active', author: 'éditeur', daysAgo: 3 },
      { eventIndex: 12, field: 'description', providerValue: 'Description fournisseur', overrideValue: 'Description locale vérifiée', status: 'active', author: 'éditeur', daysAgo: 5 },
      { eventIndex: 15, field: 'category', providerValue: 'Race', overrideValue: 'Course principale', status: 'conflict', author: 'administrateur', daysAgo: 7 },
      { eventIndex: 18, field: 'name', providerValue: 'Épreuve internationale', overrideValue: 'Épreuve internationale 2026', status: 'resolved', author: 'réviseur', daysAgo: 12 },
      { eventIndex: 21, field: 'description', providerValue: null, overrideValue: 'Information en attente', status: 'ignored', author: 'réviseur', daysAgo: 20 },
      { eventIndex: 24, field: 'name', providerValue: 'Rally fournisseur', overrideValue: 'Rally local', status: 'active', author: 'administrateur', daysAgo: 30 },
      { eventIndex: 24, field: 'published', providerValue: false, overrideValue: true, status: 'conflict', author: 'administrateur', daysAgo: 30 }
    ];

    for (const [index, correction] of corrections.entries()) {
      const eventId = id('event', correction.eventIndex);
      const providerKey = providers[(correction.eventIndex / 3) % providers.length];
      const updatedAt = new Date(Date.now() - correction.daysAgo * 86_400_000);
      await pool.query(
        `insert into event_corrections(
           id,event_id,provider_key,external_id,field_name,provider_value,override_value,
           status,created_by,created_at,updated_at,last_provider_seen_at,conflict_detected_at
         ) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$10,$10,$11)
         on conflict(event_id,field_name) do update set
           provider_key=excluded.provider_key,
           external_id=excluded.external_id,
           provider_value=excluded.provider_value,
           override_value=excluded.override_value,
           status=excluded.status,
           created_by=excluded.created_by,
           created_at=excluded.created_at,
           updated_at=excluded.updated_at,
           last_provider_seen_at=excluded.last_provider_seen_at,
           conflict_detected_at=excluded.conflict_detected_at`,
        [
          id('correction', index), eventId, providerKey,
          `synthetic-${seed}-${correction.eventIndex + 1}`, correction.field,
          JSON.stringify(correction.providerValue), JSON.stringify(correction.overrideValue),
          correction.status, correction.author, updatedAt,
          correction.status === 'conflict' ? updatedAt : null
        ]
      );
      if (correction.status === 'active' || correction.status === 'conflict') {
        await pool.query(
          `update events set ${correction.field}=$2,updated_at=$3 where id=$1`,
          [eventId, correction.overrideValue, updatedAt]
        );
      }
    }
    console.log(`Données synthétiques générées avec seed=${seed}: 12 championnats, 40 circuits, 96 événements, dont 32 événements fournisseur et 12 corrections.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
