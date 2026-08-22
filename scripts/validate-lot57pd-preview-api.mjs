import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {previewReadRoutes} from '../apps/api/dist/routes/previewRead.js';
import {pool} from '../apps/api/dist/lib/db.js';

const app=Fastify({logger:false}),secret='lot-5-7-p-d-cursor-proof-secret-32-chars';
await app.register(previewReadRoutes,{cursorSecret:secret,now:()=>new Date('2026-08-22T12:00:00Z')});
const get=async url=>{const response=await app.inject(url);assert.equal(response.statusCode,200,`${url}: ${response.body}`);return response.json();};
try{
  const first=await get('/api/v1/events?limit=1&championship=formula-1&session_type=race');
  assert.equal(first.data.length,1);assert.equal(first.data[0].name,'Preview Race 1');assert.equal(first.pagination.has_more,true);
  assert.equal(JSON.stringify(first).includes('provider'),false);assert.notEqual(first.pagination.next_cursor,first.pagination.sync_cursor);
  await pool.query(`update public_resource_states set revision=2,canonical_state=canonical_state||'{"status":"postponed"}'::jsonb,promoted_at='2026-08-22T12:01:00Z' where resource_id='57000000-0000-4000-8000-000000000302'`);
  await pool.query(`insert into public_change_log(resource_type,resource_id,resource_revision,operation,changed_fields,state_checksum,occurred_at) values('event','57000000-0000-4000-8000-000000000302',2,'updated',array['status'],repeat('b',64),'2026-08-22T12:01:00Z')`);
  const second=await get(`/api/v1/events?limit=1&championship=formula-1&session_type=race&cursor=${first.pagination.next_cursor}`);
  assert.equal(second.data.length,0,'a resource changed beyond the snapshot boundary must be replayed through /changes');
  const changes=await get(`/api/v1/changes?cursor=${first.pagination.sync_cursor}&include=data`);
  assert.deepEqual(changes.data.map(change=>change.sequence),[3]);assert.equal(changes.data[0].current.status,'postponed');
  assert.equal((await app.inject('/api/v1/events?limit=101')).statusCode,400);
  assert.equal((await app.inject('/api/v1/events?cursor=forged.value')).statusCode,400);
  assert.equal((await app.inject('/api/v1/events?championship=f1&championship_id=57000000-0000-4000-8000-000000000300')).statusCode,400);
  assert.equal((await app.inject('/api/v1/changes?cursor='+first.pagination.next_cursor)).statusCode,400);
  assert.equal((await app.inject('/api/v1/events/57000000-0000-4000-8000-000000000399')).statusCode,404);
  console.log('Lot 5.7-P-D PostgreSQL Preview API: PASS');
  console.log('D01-D14 read/filter/snapshot/cursor/change/security boundary: PASS');
}finally{await app.close();await pool.end();}
