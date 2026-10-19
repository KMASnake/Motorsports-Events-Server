import {afterAll,describe,expect,it} from 'vitest';
import {pool} from '../src/lib/db.js';
import {CanonicalCatalogPublicationService} from '../src/public/canonicalCatalogPublicationService.js';

const enabled=process.env.RUN_F57B_POSTGRES==='1',suite=enabled?describe:describe.skip;
suite('F5-7B PostgreSQL canonical catalog publication',()=>{
  const venueId='57000000-0000-4000-8000-000000000099',service=new CanonicalCatalogPublicationService();
  afterAll(async()=>pool.end());
  it('establishes pre-0038 canonical catalogs idempotently',async()=>{
    const championshipId='57000000-0000-4000-8000-000000000090',seasonId='57000000-0000-4000-8000-000000000091',existingVenueId='57000000-0000-4000-8000-000000000092',layoutId='57000000-0000-4000-8000-000000000093';
    await pool.query(`insert into championships(id,slug,name,season,active,sync_enabled) values($1,'f57b-existing','F57B Existing',2026,true,false)`,[championshipId]);
    await pool.query(`insert into championship_seasons(id,championship_id,key,label,start_year,end_year) values($1,$2,'edition-a','Edition A',2026,2026)`,[seasonId,championshipId]);
    await pool.query(`insert into venues(id,key,name,kind_key) values($1,'f57b-existing','F57B Existing','circuit')`,[existingVenueId]);
    await pool.query(`insert into venue_layouts(id,venue_id,key,name) values($1,$2,'gp','Grand Prix')`,[layoutId,existingVenueId]);
    const established=await service.establish(new Date('2026-09-29T09:00:00Z'));
    expect(established.processed).toBeGreaterThanOrEqual(4);expect(established.changed).toBeGreaterThanOrEqual(4);
    const championshipState=(await pool.query(`select resource_id,canonical_state->>'championshipId' championship_id from public_resource_states where resource_type='championship' and canonical_state->>'championshipId'=$1`,[championshipId])).rows;
    expect(championshipState).toHaveLength(1);expect(championshipState[0]).toMatchObject({championship_id:championshipId});
    for(const [type,id] of [['championshipSeason',seasonId],['venue',existingVenueId],['venueLayout',layoutId]] as const)expect((await pool.query('select revision from public_resource_states where resource_type=$1 and resource_id=$2',[type,id])).rowCount).toBe(1);
    expect(await service.establish(new Date('2026-09-29T09:01:00Z'))).toMatchObject({processed:established.processed,changed:0});
  });
  it('refuses establishment while canonical promotion is disabled',async()=>{
    await pool.query("update publication_controls set enabled=false where control_key='promotion'");
    try{await expect(service.establish(new Date('2026-09-29T09:02:00Z'))).rejects.toThrow('canonical_publication_establishment_disabled');}
    finally{await pool.query("update publication_controls set enabled=true where control_key='promotion'");}
  });
  it('proves replay, mutation, rollback, journal/version atomicity and permanent tombstones',async()=>{
    await pool.query(`insert into venues(id,key,name,kind_key,country_code,timezone) values($1,'f57b-monza','Monza','circuit','IT','Europe/Rome')`,[venueId]);
    expect(await service.publish({resourceType:'venue',canonicalId:venueId,occurredAt:new Date('2026-09-29T10:00:00Z')})).toMatchObject({outcome:'created',revision:1,sequence:expect.any(Number)});
    expect(await service.publish({resourceType:'venue',canonicalId:venueId,occurredAt:new Date('2026-09-29T10:01:00Z')})).toMatchObject({outcome:'unchanged',revision:1,sequence:null});
    for(const table of ['public_change_log','public_resource_versions'])expect((await pool.query(`select count(*)::int count from ${table} where resource_type='venue' and resource_id=$1`,[venueId])).rows[0].count).toBe(1);
    await pool.query('update venues set name=$2 where id=$1',[venueId,'Monza revised']);
    await expect(service.publish({resourceType:'venue',canonicalId:venueId,occurredAt:new Date('2026-09-29T10:02:00Z'),failBeforeCommit:true})).rejects.toThrow('catalog_publication_injected_failure');
    expect((await pool.query(`select revision::int,canonical_state->>'name' name from public_resource_states where resource_type='venue' and resource_id=$1`,[venueId])).rows[0]).toMatchObject({revision:1,name:'Monza'});
    for(const table of ['public_change_log','public_resource_versions'])expect((await pool.query(`select count(*)::int count from ${table} where resource_type='venue' and resource_id=$1`,[venueId])).rows[0].count).toBe(1);
    expect(await service.publish({resourceType:'venue',canonicalId:venueId,occurredAt:new Date('2026-09-29T10:03:00Z')})).toMatchObject({outcome:'updated',revision:2,sequence:expect.any(Number)});
    expect(await service.remove({resourceType:'venue',resourceId:venueId,occurredAt:new Date('2026-09-29T10:04:00Z')})).toMatchObject({outcome:'removed',revision:3,sequence:expect.any(Number)});
    expect(await service.remove({resourceType:'venue',resourceId:venueId,occurredAt:new Date('2026-09-29T10:05:00Z')})).toMatchObject({outcome:'unchanged',revision:3,sequence:null});
    await expect(service.publish({resourceType:'venue',canonicalId:venueId,occurredAt:new Date('2026-09-29T10:06:00Z')})).rejects.toThrow('publication_tombstone_permanent');
    expect((await pool.query(`select lifecycle,revision::int from public_resource_states where resource_type='venue' and resource_id=$1`,[venueId])).rows[0]).toMatchObject({lifecycle:'removed',revision:3});
    expect((await pool.query(`select operation from public_change_log where resource_type='venue' and resource_id=$1 order by sequence`,[venueId])).rows.map(row=>row.operation)).toEqual(['created','updated','removed']);
    expect((await pool.query(`select operation from public_resource_versions where resource_type='venue' and resource_id=$1 order by revision`,[venueId])).rows.map(row=>row.operation)).toEqual(['created','updated','removed']);
  });
});
