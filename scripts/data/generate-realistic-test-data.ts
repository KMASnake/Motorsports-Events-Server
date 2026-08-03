import { createHash } from 'node:crypto';
import pg from 'pg';

const seed = process.argv.find((value) => value.startsWith('--seed='))?.split('=')[1] ?? 'lot-4.2';
const id = (kind: string, index: number) => createHash('sha256')
  .update(`${seed}:${kind}:${index}`)
  .digest('hex')
  .slice(0, 16);
const countries = ['FR', 'GB', 'IT', 'DE', 'ES', 'US', 'JP', 'AU'];
const seedToken = id('seed', 0).slice(0, 8);

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
          providerEvent ? 'synthetic-fixture' : null,
          providerEvent ? `synthetic-${seed}-${index + 1}` : null,
          `Données synthétiques déterministes (${seed}).`
        ]
      );
    }
    console.log(`Données synthétiques générées avec seed=${seed}: 12 championnats, 40 circuits, 96 événements, dont 32 événements fournisseur.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
