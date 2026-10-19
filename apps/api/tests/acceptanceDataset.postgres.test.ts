import {createHash} from 'node:crypto';
import {afterAll,describe,expect,it} from 'vitest';
import {pool} from '../src/lib/db.js';
import {generateRealisticTestData} from '../../../scripts/data/generate-realistic-test-data.js';

const enabled=process.env.RUN_F5_RECONCILIATION_POSTGRES==='1';
const suite=enabled?describe:describe.skip;
const seed='lot-4.2';
const fixtureId=(kind:string,index:number)=>createHash('sha256').update(`${seed}:${kind}:${index}`).digest('hex').slice(0,16);

suite('F5-6 acceptance dataset on protected PostgreSQL schema',()=>{
  afterAll(async()=>{await pool.end();});

  it('uses canonical overrides and replays without legacy writes',async()=>{
    const protection=(await pool.query(`select count(*)::int count from pg_trigger where tgrelid='event_corrections'::regclass and not tgisinternal`)).rows[0].count;
    expect(protection).toBeGreaterThan(0);
    await expect(pool.query(`insert into event_corrections(id,event_id,provider_key,field_name,status) values('acceptance-forbidden','missing','fixture','name','active')`)).rejects.toThrow(/read-only after 0037/);

    const legacyBefore=Number((await pool.query('select count(*) count from event_corrections')).rows[0].count);
    await generateRealisticTestData(pool);

    const overrides=await pool.query(
      `select canonical_record_id,field_name,override_value,legacy_status,revision
         from canonical_field_overrides
        where legacy_event_correction_id=any($1::text[])
        order by canonical_record_id,field_name`,
      [Array.from({length:5},(_,index)=>fixtureId('correction',index))]
    );
    expect(overrides.rows).toHaveLength(5);
    expect(overrides.rows.map(row=>row.field_name).sort()).toEqual(['ends_at','name','name','starts_at','status']);
    expect(overrides.rows.every(row=>Number(row.revision)===1)).toBe(true);
    expect(Number((await pool.query(`select count(*) count from canonical_field_override_history history join canonical_field_overrides override on override.id=history.override_id where override.legacy_event_correction_id=any($1::text[])`,[Array.from({length:5},(_,index)=>fixtureId('correction',index))])).rows[0].count)).toBe(5);
    expect((await pool.query('select name from events where id=$1',[fixtureId('event',0)])).rows[0].name).toBe('Grand Prix corrigé');
    expect((await pool.query('select starts_at,ends_at from events where id=$1',[fixtureId('event',3)])).rows[0]).toMatchObject({
      starts_at:new Date('2026-04-11T10:30:00.000Z'),ends_at:new Date('2026-04-11T12:30:00.000Z')
    });
    expect((await pool.query('select status from events where id=$1',[fixtureId('event',6)])).rows[0].status).toBe('postponed');
    expect(Number((await pool.query('select count(*) count from event_corrections')).rows[0].count)).toBe(legacyBefore);

    await generateRealisticTestData(pool);
    expect(Number((await pool.query(`select count(*) count from canonical_field_overrides where legacy_event_correction_id=any($1::text[])`,[Array.from({length:5},(_,index)=>fixtureId('correction',index))])).rows[0].count)).toBe(5);
    expect(Number((await pool.query(`select count(*) count from canonical_field_override_history history join canonical_field_overrides override on override.id=history.override_id where override.legacy_event_correction_id=any($1::text[])`,[Array.from({length:5},(_,index)=>fixtureId('correction',index))])).rows[0].count)).toBe(5);
    expect(Number((await pool.query('select count(*) count from event_corrections')).rows[0].count)).toBe(legacyBefore);
  });
});
