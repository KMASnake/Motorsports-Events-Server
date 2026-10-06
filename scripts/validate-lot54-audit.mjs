import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../apps/api/dist/lib/db.js';
import { PersistentSchedulerService } from '../apps/api/dist/providers/schedulerService.js';

let now = new Date('2027-02-10T12:00:00Z');
const scheduler = new PersistentSchedulerService({ now: () => new Date(now) });
const context = { principal: { sub: 'lot54-audit', role: 'admin' }, requestId: 'lot54-audit' };
const providers = [], championships = [];
async function make(label, maxConcurrency = 4) {
  const provider = randomUUID(), championship = randomUUID(), link = randomUUID();
  providers.push(provider); championships.push(championship);
  await pool.query(`insert into provider_instances(id,adapter_key,name,enabled,state,config,max_concurrency,discovery_enabled)
    values($1,'fixture',$2,true,'active','{}',$3,true)`, [provider, `Audit ${label}`, maxConcurrency]);
  await pool.query(`insert into championships(id,slug,name,season,active,sync_enabled)
    values($1,$2,$3,2027,true,false)`, [championship, `lot54-audit-${label}`, `Audit ${label}`]);
  await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary)
    values($1,$2,$3,$4,'manual','inactive',true)`, [link, provider, championship, `audit-${label}`]);
  await pool.query(`insert into provider_championship_source_configs(provider_championship_id,schema_version,config,validated_at)
    values($1,1,'{"strategy":"fixture"}',now())`, [link]);
  await scheduler.activate(link, context);
  return { provider, championship, link };
}
async function finish(lease) {
  await scheduler.commit({ streamId: lease.stream.id, runId: lease.run_id, workerId: lease.stream.lease_owner, generation: lease.lease_generation, cursorAfter: { audit: true } });
}
async function activationSnapshot(link) {
  const state = (await pool.query('select sync_state,sync_state_before_championship_disable from provider_championships where id=$1', [link])).rows[0];
  const streams = await scheduler.streams(link);
  return { state, streams: streams.map(row => ({ phase: row.phase, state: row.state, cursor: row.cursor, current_window_start: row.current_window_start, priority_boost_until: row.priority_boost_until, historical_state: row.historical_state })) };
}

try {
  const active = await make('active'), inactive = await make('inactive'), paused = await make('paused');
  const initiallyActive = await activationSnapshot(active.link);
  assert.equal((await scheduler.setChampionshipActive(active.link, true, context)).noop, true);
  assert.deepEqual(await activationSnapshot(active.link), initiallyActive);
  const historicalBefore = (await scheduler.streams(active.link)).find(row => row.phase === 'historical').historical_state;
  await scheduler.setChampionshipActive(active.link, false, context);
  assert.equal((await pool.query('select sync_state_before_championship_disable from provider_championships where id=$1', [active.link])).rows[0].sync_state_before_championship_disable, 'active');
  const disabledSnapshot = await activationSnapshot(active.link);
  assert.equal((await scheduler.setChampionshipActive(active.link, false, context)).noop, true);
  assert.deepEqual(await activationSnapshot(active.link), disabledSnapshot);
  await scheduler.setChampionshipActive(active.link, true, context);
  const activeRows = await scheduler.streams(active.link);
  assert.equal((await pool.query('select sync_state from provider_championships where id=$1', [active.link])).rows[0].sync_state, 'active');
  assert.equal(activeRows.find(row => row.phase === 'current').state, 'ready');
  assert.equal(new Date(activeRows.find(row => row.phase === 'current').current_window_start).toISOString().slice(0, 10), '2027-02-03');
  assert.ok(activeRows.find(row => row.phase === 'current').priority_boost_until);
  assert.deepEqual(activeRows.find(row => row.phase === 'historical').historical_state, historicalBefore);
  const reactivatedSnapshot = await activationSnapshot(active.link);
  assert.equal((await scheduler.setChampionshipActive(active.link, true, context)).noop, true);
  assert.deepEqual(await activationSnapshot(active.link), reactivatedSnapshot);

  await scheduler.deactivate(inactive.link, context);
  const inactiveNoop = await activationSnapshot(inactive.link);
  await scheduler.setChampionshipActive(inactive.link, true, context);
  assert.deepEqual(await activationSnapshot(inactive.link), inactiveNoop);
  await scheduler.setChampionshipActive(inactive.link, false, context);
  await scheduler.setChampionshipActive(inactive.link, true, context);
  assert.equal((await pool.query('select sync_state from provider_championships where id=$1', [inactive.link])).rows[0].sync_state, 'inactive');
  await scheduler.pause(paused.link, context);
  const pausedNoop = await activationSnapshot(paused.link);
  await scheduler.setChampionshipActive(paused.link, true, context);
  assert.deepEqual(await activationSnapshot(paused.link), pausedNoop);
  await scheduler.setChampionshipActive(paused.link, false, context);
  await scheduler.setChampionshipActive(paused.link, true, context);
  assert.equal((await pool.query('select sync_state from provider_championships where id=$1', [paused.link])).rows[0].sync_state, 'paused');
  for (const state of ['error', 'suspended']) {
    await pool.query('update provider_championships set sync_state=$2 where id=$1', [paused.link, state]);
    await pool.query('update sync_streams set state=$2 where provider_championship_id=$1', [paused.link, state]);
    const before = await activationSnapshot(paused.link);
    await scheduler.setChampionshipActive(paused.link, true, context);
    assert.deepEqual(await activationSnapshot(paused.link), before);
  }
  assert.ok(Number((await pool.query("select count(*) from admin_audit_log where actor='lot54-audit' and action='championship.activation_noop'")).rows[0].count) >= 5);

  const stale = await scheduler.acquire('stale-A'); assert.ok(stale);
  const providerBefore = (await pool.query('select state from provider_instances where id=(select provider_instance_id from provider_championships where id=$1)', [stale.stream.provider_championship_id])).rows[0].state;
  now = new Date(now.getTime() + 121_000);
  await assert.rejects(() => scheduler.fail({ streamId: stale.stream.id, runId: stale.run_id, workerId: 'stale-A', generation: stale.lease_generation, durable: true, code: 'auth_401', authentication: true }), error => error.statusCode === 409);
  assert.equal((await pool.query('select state from provider_instances where id=(select provider_instance_id from provider_championships where id=$1)', [stale.stream.provider_championship_id])).rows[0].state, providerBefore);
  assert.equal((await pool.query('select status from sync_runs where id=$1', [stale.run_id])).rows[0].status, 'running');
  await pool.query("update sync_streams set state='paused' where id<>$1 and lease_owner is null", [stale.stream.id]);
  await scheduler.recover();
  const replacement = await scheduler.acquire('stale-B'); assert.ok(replacement);
  assert.equal(replacement.stream.id, stale.stream.id); assert.equal(replacement.lease_generation, stale.lease_generation + 1);
  await assert.rejects(() => scheduler.fail({ streamId: stale.stream.id, runId: stale.run_id, workerId: 'stale-A', generation: stale.lease_generation, durable: true, code: 'auth_401', authentication: true }), error => error.statusCode === 409);
  await finish(replacement);

  const auditLinks = [active.link, inactive.link, paused.link];
  await pool.query("update provider_championships set sync_state='active' where id=any($1::uuid[])", [auditLinks]);
  await pool.query(`insert into provider_acquisition_state(provider_championship_id,bootstrap_state,recent_catchup_state,deep_history_state,deep_history_season,current_cycle_started_at)
    select id,'deep_history','complete','running',2026,$2 from provider_championships where id=any($1::uuid[])
    on conflict(provider_championship_id) do update set bootstrap_state='deep_history',recent_catchup_state='complete',deep_history_state='running',deep_history_season=2026,updated_at=$2`, [auditLinks, now]);
  await pool.query("update championships set active=true where id=any($1::text[])", [championships]);
  await pool.query("update sync_streams set state='ready',lease_owner=null,lease_acquired_at=null,lease_expires_at=null,priority_boost_until=null where provider_championship_id=any($1::uuid[])", [auditLinks]);
  await pool.query("update provider_instances set discovery_lease_owner=null,discovery_lease_expires_at=null,state='active',last_discovery_at=null where id=any($1::uuid[])", [providers]);
  await pool.query('update scheduler_configuration set dispatch_counter=0,global_worker_pool=4');
  const four = [];
  for (let index = 0; index < 4; index++) { const lease = await scheduler.acquire(`pool-${index}`); assert.ok(lease); four.push(lease); }
  assert.equal(await scheduler.acquireDueDiscovery('pool-discovery-blocked'), null);
  await finish(four.pop());
  const discovery = await scheduler.acquireDueDiscovery('pool-discovery'); assert.ok(discovery);
  assert.equal(await scheduler.acquire('pool-fifth'), null);
  await scheduler.heartbeatDiscovery(discovery.id, 'pool-discovery', Number(discovery.discovery_lease_generation));
  await scheduler.releaseDiscovery(discovery.id, 'pool-discovery', Number(discovery.discovery_lease_generation));
  for (const lease of four) await finish(lease);

  await pool.query("update sync_streams set state='paused'");
  await pool.query("update provider_instances set discovery_enabled=false,max_concurrency=1,discovery_lease_owner=null,discovery_lease_expires_at=null");
  await pool.query("update provider_instances set discovery_enabled=true where id=$1", [active.provider]);
  await pool.query("update sync_streams set state='ready' where provider_championship_id=$1 and phase='current'", [active.link]);
  const providerSync = await scheduler.acquire('provider-sync'); assert.equal(providerSync.stream.provider_championship_id, active.link);
  assert.equal(await scheduler.acquireDueDiscovery('provider-discovery-blocked'), null);
  await finish(providerSync);
  const providerDiscovery = await scheduler.acquireDueDiscovery('provider-discovery'); assert.equal(providerDiscovery.id, active.provider);
  assert.equal(await scheduler.acquire('provider-sync-blocked'), null);
  await pool.query("update provider_championships set sync_state='active' where id=$1", [inactive.link]);
  await pool.query("update sync_streams set state='ready' where provider_championship_id=$1 and phase='current'", [inactive.link]);
  const independent = await scheduler.acquire('provider-independent'); assert.equal(independent.stream.provider_championship_id, inactive.link); await finish(independent);
  await scheduler.releaseDiscovery(active.provider, 'provider-discovery', Number(providerDiscovery.discovery_lease_generation));
  const staleDiscovery = await scheduler.acquireDueDiscovery('stale-discovery'); assert.ok(staleDiscovery);
  now = new Date(now.getTime() + 121_000);
  await assert.rejects(() => scheduler.heartbeatDiscovery(staleDiscovery.id, 'stale-discovery', Number(staleDiscovery.discovery_lease_generation)), error => error.statusCode === 409);
  await assert.rejects(() => scheduler.releaseDiscovery(staleDiscovery.id, 'stale-discovery', Number(staleDiscovery.discovery_lease_generation)), error => error.statusCode === 409);

  await pool.query("update sync_streams set state='paused'");
  await pool.query("update provider_instances set discovery_enabled=false,discovery_lease_owner=null,discovery_lease_expires_at=null");
  const rrCurrent = active.link, rrRecent = inactive.link, rrDeep = paused.link;
  await pool.query("update provider_championships set sync_state='active' where id=any($1::uuid[])", [[rrCurrent, rrRecent, rrDeep]]);
  await pool.query("update sync_streams set state='ready' where provider_championship_id=$1 and phase='current'", [rrCurrent]);
  await pool.query("update sync_streams set state='ready',historical_state='{" + '"recent_catchup_queue":[{"year":2026}],"deep_history_year":2025,"deep_history_cursor":{}' + "}'::jsonb where provider_championship_id=$1 and phase='historical'", [rrRecent]);
  await pool.query("update sync_streams set state='ready',historical_state='{" + '"recent_catchup_queue":[],"deep_history_year":2025,"deep_history_cursor":{}' + "}'::jsonb where provider_championship_id=$1 and phase='historical'", [rrDeep]);
  await pool.query('update scheduler_configuration set dispatch_counter=0');
  const classes = [];
  for (let index = 0; index < 6; index++) { const lease = await scheduler.acquire(`rr-${index}`); assert.ok(lease); classes.push(lease.work_class); await finish(lease); }
  assert.deepEqual(classes, ['current', 'current', 'current', 'recent_catchup', 'recent_catchup', 'deep_history']);
  await pool.query("update sync_streams set state='paused' where provider_championship_id=$1", [rrRecent]);
  const counterBefore = BigInt((await scheduler.config()).dispatch_counter);
  for (let index = 0; index < 6; index++) { const lease = await scheduler.acquire(`redistribute-${index}`); assert.ok(lease); assert.notEqual(lease.work_class, 'recent_catchup'); await finish(lease); }
  assert.equal(BigInt((await scheduler.config()).dispatch_counter), counterBefore + 6n);
  console.log('Réactivation, stale fail, pool discovery et round-robin PostgreSQL Lot 5.4 : OK');
} finally {
  for (const provider of providers) await pool.query('delete from provider_instances where id=$1', [provider]);
  for (const championship of championships) await pool.query('delete from championships where id=$1', [championship]);
  await pool.query('update scheduler_configuration set global_worker_pool=4,dispatch_counter=0');
  await pool.end();
}
