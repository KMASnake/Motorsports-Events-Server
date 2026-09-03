import {describe,expect,it,vi} from 'vitest';
import type {PoolClient} from 'pg';
import {PostgresPublicationService} from '../src/normalization/postgresPublicationService.js';

const ready={resourceKind:'event',name:'FP1',sessionType:'practice',sessionLabel:null,status:'scheduled',championshipId:'f1',circuitId:'yas-marina',season:2026,round:null,startsAt:'2026-12-04T09:30:00.000Z',endsAt:'2026-12-04T10:30:00.000Z',timezone:'UTC',presence:'seen'};
function database(parent:true|false|'none'=true){
  const query=vi.fn(async(sql:string)=>{
    if(sql.includes("publication_controls"))return {rows:[{enabled:true}]};
    if(sql.includes('from normalized_candidates candidate'))return {rows:[{id:'candidate',source_entity_id:'source-event',source_hash:'hash',normalization_version:'mapping',resource_kind:'event',decision:'create',target_id:null,source_external_id:'provider-fp1',parent_source_entity_id:parent==='none'?null:'source-meeting',source_position:'0',adapter_key:'fixture',candidate_data:{normalized:ready,proposed_uuid:'57000000-0000-4000-8000-000000000101'}}]};
    if(sql==='select meeting_id from meeting_source_links where source_entity_id=$1')return {rows:parent===true?[{meeting_id:'57000000-0000-4000-8000-000000000100'}]:[]};
    if(sql==='select normalized_event_uuid from event_source_links where source_entity_id=$1')return {rows:[{normalized_event_uuid:'57000000-0000-4000-8000-000000000101'}]};
    if(sql.startsWith('select * from publication_receipts'))return {rows:[]};
    if(sql.startsWith('select * from public_resource_states'))return {rows:[]};
    if(sql==='select meeting_id from meeting_events where event_id=$1')return {rows:[{meeting_id:'57000000-0000-4000-8000-000000000100'}]};
    if(sql.includes('returning sequence'))return {rows:[{sequence:1}]};
    return {rows:[]};
  });
  return {client:{query} as unknown as PoolClient,query};
}

describe('canonical meeting/event publication relation',()=>{
  it('materializes a canonical Meeting and its durable source link',async()=>{
    const query=vi.fn(async(sql:string)=>{
      if(sql.includes('publication_controls'))return {rows:[{enabled:true}]};
      if(sql.includes('from normalized_candidates candidate'))return {rows:[{id:'meeting-candidate',source_entity_id:'source-meeting',source_hash:'hash',normalization_version:'mapping',resource_kind:'meeting',decision:'create',target_id:null,source_external_id:'provider-meeting',parent_source_entity_id:null,adapter_key:'fixture',candidate_data:{normalized:{...ready,resourceKind:'meeting',name:'Abu Dhabi Grand Prix',sessionType:'other'},proposed_uuid:'57000000-0000-4000-8000-000000000100'}}]};
      if(sql==='select meeting_id from meeting_source_links where source_entity_id=$1')return {rows:[{meeting_id:'57000000-0000-4000-8000-000000000100'}]};
      if(sql.startsWith('select * from publication_receipts')||sql.startsWith('select * from public_resource_states'))return {rows:[]};
      if(sql.includes('returning sequence'))return {rows:[{sequence:1}]};
      return {rows:[]};
    });
    await expect(new PostgresPublicationService().publishCandidateInTransaction({query} as unknown as PoolClient,{candidateId:'meeting-candidate',occurredAt:new Date('2026-08-27T00:00:00Z')})).resolves.toMatchObject({outcome:'created'});
    expect(query.mock.calls.some(([sql])=>String(sql).includes('insert into meetings('))).toBe(true);
    expect(query.mock.calls.some(([sql])=>String(sql).startsWith('insert into meeting_source_links('))).toBe(true);
    expect(query.mock.calls.some(([sql])=>String(sql).startsWith('insert into meeting_source_link('))).toBe(false);
  });
  it('materializes a provider Event and its already-resolved parent relation atomically',async()=>{
    const {client,query}=database();
    await expect(new PostgresPublicationService().publishCandidateInTransaction(client,{candidateId:'candidate',occurredAt:new Date('2026-08-27T00:00:00Z')})).resolves.toMatchObject({outcome:'created'});
    expect(query.mock.calls.some(([sql])=>String(sql).includes('insert into events('))).toBe(true);
    expect(query.mock.calls.some(([sql])=>String(sql).includes('insert into event_source_links'))).toBe(true);
    expect(query.mock.calls.some(([sql,args])=>String(sql).includes('insert into meeting_events')&&(args as unknown[])[0]==='57000000-0000-4000-8000-000000000100'&&(args as unknown[])[2]===0)).toBe(true);
  });
  it('does not materialize an Event while its source parent is unresolved',async()=>{
    const {client,query}=database(false);
    await expect(new PostgresPublicationService().publishCandidateInTransaction(client,{candidateId:'candidate',occurredAt:new Date()})).resolves.toMatchObject({outcome:'review_required'});
    expect(query.mock.calls.some(([sql])=>String(sql).includes('insert into events('))).toBe(false);
  });
  it('preserves simple provider Event publication without creating new legacy rows',async()=>{
    const {client,query}=database('none');
    await expect(new PostgresPublicationService().publishCandidateInTransaction(client,{candidateId:'candidate',occurredAt:new Date()})).resolves.toMatchObject({outcome:'created'});
    expect(query.mock.calls.some(([sql])=>String(sql).includes('insert into events('))).toBe(false);
    expect(query.mock.calls.some(([sql])=>String(sql).includes('insert into public_resource_states'))).toBe(true);
  });
});
