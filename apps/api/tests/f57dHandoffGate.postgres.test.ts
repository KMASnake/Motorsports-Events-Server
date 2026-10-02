import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {pool} from '../src/lib/db.js';
import {BoundedProviderOneShotRunner} from '../src/providers/providerOneShotRunner.js';
import {ProviderAdapterRegistry} from '../src/providers/registry.js';
import {OcBlackTopAdapter} from '../src/providers/realAdapters.js';
import {ProviderConfigurationService} from '../src/providers/providerService.js';
import {ProviderSecretCipher} from '../src/providers/providerSecrets.js';
import {SourceProtectionService} from '../src/providers/sourceProtectionService.js';
import {PostgresNormalizationMappingRepository} from '../src/normalization/postgresNormalizationMappingRepository.js';
import {PostgresReconciliationService} from '../src/reconciliation/postgresReconciliationService.js';
import {CanonicalFieldOverrideService} from '../src/reconciliation/canonicalFieldOverrideService.js';
import {PostgresDeterministicNormalizationService} from '../src/normalization/postgresDeterministicNormalizationService.js';

const enabled=process.env.RUN_F57D_HANDOFF_POSTGRES==='1',suite=enabled?describe:describe.skip;
// These are disposable fixture identities, never the maintainer's real target IDs.
const ids={provider:randomUUID(),association:randomUUID(),stream:randomUUID(),season:randomUUID(),venue:randomUUID(),layout:randomUUID()};
const year=2026;
suite('F57D mandatory no-network production handoff gate',()=>{
  const registry=new ProviderAdapterRegistry(),cipher=new ProviderSecretCipher(new Map([[1,randomBytes(32)]]),1);
  const syntheticSecret=randomBytes(24).toString('hex');
  const blockedExternalFetch=vi.fn<typeof fetch>(async()=>{throw new Error('f57d_unexpected_external_transport');});
  let failureStage='preflight';
  let capturedError:{stage:string;code:string;class:string;message:string}|null=null;
  const capture=(error:unknown)=>{
    const row=error as {code?:unknown;name?:unknown;message?:unknown};
    const clean=(value:unknown)=>String(value??'unknown').split(syntheticSecret).join('[REDACTED]')
      .replace(/https?:\/\/\S+/gi,'[URL REDACTED]').replace(/(?:authorization|x-api-key|ciphertext|nonce|master[_-]?keys?)\s*[:=]\s*\S+/gi,'[REDACTED]').slice(0,300);
    capturedError={stage:failureStage,code:clean(row.code??'runner_failed'),class:clean(row.name??'Error'),message:clean(row.message)};
  };
  const transport=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({data:[{
    id:'f57d-fixture-meeting',name:'F57D Meeting',external_season_id:String(year),status:'scheduled',
    location:{id:'f57d-fixture-circuit'},schedule:[{id:'f57d-fixture-event',name:'F57D Race',type:'race',status:'scheduled',
      startTime:`${year}-12-06T13:00:00Z`,endTime:`${year}-12-06T15:00:00Z`}]
  }],pagination:{total_pages:1,has_next_page:false}}),{status:200,headers:{'content-type':'application/json'}}));
  const adapter=new OcBlackTopAdapter(transport);
  registry.register(adapter);
  const runner=new BoundedProviderOneShotRunner(new ProviderConfigurationService(registry,cipher));
  const policies=new Map<'meeting'|'event',string>();
  beforeAll(async()=>{
    const url=new URL(process.env.DATABASE_URL??'');
    if(url.hostname!=='127.0.0.1'||url.pathname!=='/f57d0b_gate'||process.env.PREVIEW_API_ENABLED!=='false')throw new Error('f57d_disposable_context_required');
    expect(new Date().getUTCFullYear(),'gate season must match production runner current year').toBe(year);
    vi.stubGlobal('fetch',blockedExternalFetch);
    expect(adapter.fetchImpl).toBe(transport);
    expect(registry.get('ocblacktop')).toBe(adapter);
    expect(globalThis.fetch).toBe(blockedExternalFetch);
    console.info('F57D_TRANSPORT_GUARD',JSON.stringify({boundary:'OcBlackTopAdapter.fetchImpl -> fetchProviderJson.fetchImpl',injected:true,globalFetchBlocked:true,realProviderNetworkCapable:false}));
    const restoreCursor=adapter.restoreCursor.bind(adapter);
    vi.spyOn(adapter,'restoreCursor').mockImplementation((...args)=>{
      failureStage='adapter_cursor_restoration';
      try{return restoreCursor(...args);}catch(error){capture(error);throw error;}
    });
    const executeLease=runner.orchestrator.executeLease.bind(runner.orchestrator);
    vi.spyOn(runner.orchestrator,'executeLease').mockImplementation(async input=>{
      failureStage='acquisition_before_transport';
      try{return await executeLease(input);}catch(error){capture(error);throw error;}
    });
    const authorize=runner.quota.authorize.bind(runner.quota);
    vi.spyOn(runner.quota,'authorize').mockImplementation(async(...args)=>{
      failureStage='quota_authorization';
      try{const result=await authorize(...args);console.info('F57D_QUOTA_GATE',JSON.stringify({allowed:result.allowed,blockingReason:result.blocking_reason}));return result;}catch(error){capture(error);throw error;}
    });
    expect((await pool.query('select version from schema_migrations order by version desc limit 1')).rows[0].version).toBe('0040_f5_canonical_timezone_nullability');
    expect((await pool.query('select count(*)::int count from sync_streams where lease_owner is not null')).rows[0].count).toBe(0);
    await pool.query("insert into championships(id,slug,name,season,active,sync_enabled) values('f1','f1','F57D F1 Fixture',$1,true,false) on conflict(id) do nothing",[year]);
    expect((await pool.query("select active from championships where id='f1'")).rows[0].active).toBe(true);
    await pool.query("insert into championship_seasons(id,championship_id,key,label,start_year,end_year) values($1,'f1',$2,$2,$3,$3)",[ids.season,String(year),year]);
    await pool.query("insert into venues(id,key,name,kind_key,timezone) values($1,'f57d','F57D Venue','circuit','UTC')",[ids.venue]);
    await pool.query("insert into venue_layouts(id,venue_id,key,name) values($1,$2,'gp','F57D Layout')",[ids.layout,ids.venue]);
    await pool.query("insert into circuits(id,name,country_code,timezone) values('f57d','F57D Circuit','FR','UTC')");
    await pool.query("insert into circuit_venue_links(circuit_id,venue_id,venue_layout_id) values('f57d',$1,$2)",[ids.venue,ids.layout]);
    await pool.query("insert into provider_instances(id,adapter_key,name,enabled,state,config) values($1,'ocblacktop','F57D Fixture',true,'active','{\"base_url\":\"https://api.ocblacktop.com/v1\"}')",[ids.provider]);
    await pool.query("insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state,is_primary) values($1,$2,'f1','formula1','active',true)",[ids.association,ids.provider]);
    await pool.query("insert into provider_championship_source_configs(provider_championship_id,schema_version,config) values($1,1,'{\"strategy\":\"series-events-v1\",\"external_id\":\"formula1\",\"endpoint_template\":\"/{series}/events\"}')",[ids.association]);
    await pool.query("insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor,current_window_year) values($1,$2,'current','pending',1,'{\"page\":1,\"visited\":[]}',$3)",[ids.stream,ids.association,year]);
    await pool.query('insert into provider_quota_policies(provider_instance_id,monthly_limit) values($1,100)',[ids.provider]);
    const encrypted=cipher.encrypt(syntheticSecret,ids.provider,'api_key');
    await pool.query("insert into provider_secrets(id,provider_instance_id,secret_name,ciphertext,nonce,key_version,algorithm) values($1,$2,'api_key',$3,$4,$5,$6)",[randomUUID(),ids.provider,encrypted.ciphertext,encrypted.nonce,encrypted.keyVersion,encrypted.algorithm]);
    const link=randomUUID();
    await pool.query("insert into championship_source_links(id,provider_instance_id,external_championship_id,championship_id,created_by) values($1,$2,'formula1','f1','f57d')",[link,ids.provider]);
    await pool.query("insert into championship_season_source_links(id,championship_source_link_id,provider_instance_id,external_championship_id,external_season_id,championship_id,championship_season_id,created_by) values($1,$2,$3,'formula1',$4,'f1',$5,'f57d')",[randomUUID(),link,ids.provider,String(year),ids.season]);
    await new PostgresNormalizationMappingRepository().createAndActivateMappingVersion({providerChampionshipId:ids.association,versionLabel:'f57d-gate',rulesVersion:'f57d-r1',actor:'f57d',mappingDocument:{championshipIds:{formula1:'f1'},circuitIds:{'f57d-fixture-circuit':'f57d'},sessionTypes:{race:'race'},statuses:{scheduled:'scheduled'}}});
    for(const kind of ['meeting','event'] as const){
      const id=randomUUID();policies.set(kind,id);
      await pool.query("insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id,activated_at) values($1,'f1',$2,$3,1,'active',$4,$5,$4,'f57d',now())",[id,ids.season,kind,'d'.repeat(64),`f57d-${kind}`]);
      await pool.query("insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority,status_rules) values($1,$2,'name','DISPLAY','[[\"ocblacktop\"],[\"f57d-secondary\"]]','{}')",[randomUUID(),id]);
    }
  });
  afterAll(async()=>{vi.unstubAllGlobals();await pool.end();});
  it('materializes and publishes the policy-selected latest source revision through real reconciliation',async()=>{
    expect((await pool.query('select id,adapter_key,enabled,state from provider_instances where id=$1',[ids.provider])).rows[0]).toEqual({id:ids.provider,adapter_key:'ocblacktop',enabled:true,state:'active'});
    expect((await pool.query('select id,championship_id,external_championship_id,sync_state,is_primary from provider_championships where id=$1',[ids.association])).rows[0]).toEqual({id:ids.association,championship_id:'f1',external_championship_id:'formula1',sync_state:'active',is_primary:true});
    expect((await pool.query('select id,phase,state,current_window_year,lease_owner from sync_streams where id=$1',[ids.stream])).rows[0]).toEqual({id:ids.stream,phase:'current',state:'pending',current_window_year:year,lease_owner:null});
    expect((await pool.query('select config from provider_championship_source_configs where provider_championship_id=$1',[ids.association])).rows[0].config).toEqual({strategy:'series-events-v1',external_id:'formula1',endpoint_template:'/{series}/events'});
    const credentialUsable=(await runner.providers.readSecretForAdapter(ids.provider,'api_key'))===syntheticSecret;
    expect(credentialUsable).toBe(true);
    expect(await runner.preflight({providerInstanceId:ids.provider,providerChampionshipId:ids.association,streamId:ids.stream,maxProviderRequests:1,preflight:true})).toMatchObject({configuration_ready:true,execution_ready:true,credential_present:true});
    expect((await runner.quota.diagnostics(ids.provider)).summary.usage).toBe(0);
    expect(adapter.fetchImpl).toBe(transport);expect(globalThis.fetch).toBe(blockedExternalFetch);
    console.info('F57D_SEED_VALIDATION',JSON.stringify({providerExecutable:true,championship:'f1',externalChampionship:'formula1',streamExecutable:true,currentWindowYear:year,leaseAbsent:true,syntheticCredentialUsable:true,mappingValid:true,previewEnabled:false}));
    const first=await runner.run({providerInstanceId:ids.provider,providerChampionshipId:ids.association,streamId:ids.stream,maxProviderRequests:1,preflight:false});
    if('error' in first&&!capturedError)capture(first.error);
    console.info('F57D_FIRST_GATE_OUTCOME',JSON.stringify({status:first.status,safeFailure:capturedError,transportCalls:transport.mock.calls.length,emitted:first.provider_requests_emitted}));
    if(first.status!=='completed')console.info('F57D_SAFE_STREAM_STATE',JSON.stringify((await pool.query('select state,current_window_year,cursor,lease_generation from sync_streams where id=$1',[ids.stream])).rows[0]));
    expect(first).toMatchObject({status:'completed',provider_requests_emitted:1,handoff:{entities_seen:2,publications_created:2}});
    expect(transport).toHaveBeenCalledTimes(1);
    if(!('traversal_id' in first)||!first.traversal_id)throw new Error('f57d_complete_traversal_missing');
    const snapshot=async()=>({
      canonical:(await pool.query("select 'meeting' kind,name from meetings where championship_id='f1' union all select 'event',name from events where championship_id='f1' order by kind")).rows,
      public:(await pool.query("select resource_type,revision,canonical_state from public_resource_states where championship_id='f1' order by resource_type,resource_id")).rows,
      counts:(await pool.query('select (select count(*)::int from public_change_log) changes,(select count(*)::int from public_resource_versions) versions,(select count(*)::int from meeting_source_contributions) meetings,(select count(*)::int from event_source_contributions) events')).rows[0]
    });
    const initial=await snapshot();
    expect(await runner.handoff.handoffTraversal(first.traversal_id)).toMatchObject({status:'no_changes'});
    expect(await snapshot()).toEqual(initial);
    // A second synthetic provider uses the same injected OCBlackTop parser,
    // but a distinct policy identity. Only the disposable primary association
    // is switched; both providers remain eligible contribution authorities.
    const secondary={provider:randomUUID(),association:randomUUID(),stream:randomUUID()},secondaryAdapter=new OcBlackTopAdapter(transport);
    Object.defineProperty(secondaryAdapter,'key',{value:'f57d-secondary'});
    registry.register(secondaryAdapter);
    expect(secondaryAdapter.fetchImpl).toBe(transport);expect(globalThis.fetch).toBe(blockedExternalFetch);
    await pool.query("insert into provider_instances(id,adapter_key,name,enabled,state,config) select $1,'f57d-secondary','F57D Secondary',true,'active',config from provider_instances where id=$2",[secondary.provider,ids.provider]);
    await pool.query("insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state,is_primary) values($1,$2,'f1','formula1','inactive',true)",[secondary.association,secondary.provider]);
    await pool.query('insert into provider_championship_source_configs(provider_championship_id,schema_version,config) select $1,schema_version,config from provider_championship_source_configs where provider_championship_id=$2',[secondary.association,ids.association]);
    await pool.query("insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor,current_window_year) values($1,$2,'current','pending',1,'{\"page\":1,\"visited\":[]}',2026)",[secondary.stream,secondary.association]);
    await pool.query('insert into provider_quota_policies(provider_instance_id,monthly_limit) values($1,100)',[secondary.provider]);
    const secondarySecret=cipher.encrypt(syntheticSecret,secondary.provider,'api_key'),secondaryLink=randomUUID();
    await pool.query("insert into provider_secrets(id,provider_instance_id,secret_name,ciphertext,nonce,key_version,algorithm) values($1,$2,'api_key',$3,$4,1,'aes-256-gcm')",[randomUUID(),secondary.provider,secondarySecret.ciphertext,secondarySecret.nonce]);
    await pool.query("insert into championship_source_links(id,provider_instance_id,external_championship_id,championship_id,created_by) values($1,$2,'formula1','f1','f57d')",[secondaryLink,secondary.provider]);
    await pool.query("insert into championship_season_source_links(id,championship_source_link_id,provider_instance_id,external_championship_id,external_season_id,championship_id,championship_season_id,created_by) values($1,$2,$3,'formula1','2026','f1',$4,'f57d')",[randomUUID(),secondaryLink,secondary.provider,ids.season]);
    await new PostgresNormalizationMappingRepository().createAndActivateMappingVersion({providerChampionshipId:secondary.association,versionLabel:'f57d-secondary',rulesVersion:'f57d-r1',actor:'f57d',mappingDocument:{championshipIds:{formula1:'f1'},circuitIds:{'f57d-fixture-circuit':'f57d'},sessionTypes:{race:'race'},statuses:{scheduled:'scheduled'}}});
    await pool.query("update provider_championships set sync_state='inactive' where id=$1",[ids.association]);
    await pool.query("update provider_championships set sync_state='active' where id=$1",[secondary.association]);
    const second=await runner.run({providerInstanceId:secondary.provider,providerChampionshipId:secondary.association,streamId:secondary.stream,maxProviderRequests:1,preflight:false});
    expect(second).toMatchObject({status:'completed',provider_requests_emitted:1,handoff:{entities_seen:2,publications_created:0}});
    if(!('traversal_id' in second)||!second.traversal_id)throw new Error('secondary_traversal_missing');
    expect(transport).toHaveBeenCalledTimes(2);
    expect((await snapshot()).public).toEqual(initial.public);
    await pool.query("update provider_championships set sync_state='inactive' where id=$1",[secondary.association]);
    await pool.query("update provider_championships set sync_state='active' where id=$1",[ids.association]);
    const sources=(await pool.query('select id,entity_kind from provider_source_entities where provider_championship_id=$1',[ids.association])).rows;
    expect(sources).toHaveLength(2);
    const protection=new SourceProtectionService();
    for(const source of sources)await protection.upsertCorrection({sourceEntityId:source.id,fieldPath:'name',overrideValue:source.entity_kind==='meeting'?'F57D Corrected Meeting':'F57D Corrected Race',origin:'f57d-gate',actorId:'f57d'});
    // Replay the real handoff with a new source-correction revision, not a new
    // HTTP call or a manually applied reconciliation that would hide a bypass.
    const replay=await runner.handoff.handoffTraversal(first.traversal_id);
    const reconciliation=new PostgresReconciliationService(),evidence=[];
    for(const kind of ['meeting','event'] as const){
      const canonical=(await pool.query(kind==='meeting'?"select id,name from meetings where championship_id='f1'":"select normalized_uuid id,name from events where championship_id='f1'")).rows;
      expect(canonical).toHaveLength(1);
      const preview=await reconciliation.preview({entityKind:kind,entityUuid:canonical[0].id,policyId:policies.get(kind)!,evaluationAt:new Date().toISOString()});
      const expected=kind==='meeting'?'F57D Corrected Meeting':'F57D Corrected Race';
      expect(preview.result.materializationEligible).toBe(true);
      expect(preview.result.effectiveState.name).toBe(expected);
      const state=(await pool.query('select canonical_state,revision from public_resource_states where resource_type=$1 and resource_id=$2',[kind,canonical[0].id])).rows[0];
      const runs=(await pool.query('select count(*)::int count from reconciliation_runs where entity_kind=$1 and entity_uuid=$2',[kind,canonical[0].id])).rows[0].count;
      const contributions=(await pool.query(kind==='meeting'?'select source_revision from meeting_source_contributions where meeting_id=$1 order by source_revision':'select source_revision from event_source_contributions where event_uuid=$1 order by source_revision',[canonical[0].id])).rows;
      expect(contributions.map(row=>Number(row.source_revision))).toEqual([1,1,2]);
      evidence.push({kind,expected,actual:canonical[0].name,publicName:state.canonical_state.name,publicRevision:Number(state.revision),runs,sourceRevisions:contributions.map(row=>Number(row.source_revision))});
    }
    console.info('F57D_HANDOFF_GATE_EVIDENCE',JSON.stringify({transportCalls:transport.mock.calls.length,externalProviderCalls:0,replayStatus:replay.status,entities:evidence}));
    for(const row of evidence){
      expect(row.actual,`${row.kind}: production handoff must materialize F5-6 effective state`).toBe(row.expected);
      expect(row.publicName).toBe(row.expected);
      expect(row.runs).toBeGreaterThan(0);
    }
    const winning=await snapshot();
    expect(winning.counts.changes-initial.counts.changes).toBe(2);
    expect(winning.counts.versions-initial.counts.versions).toBe(2);
    expect(await runner.handoff.handoffTraversal(first.traversal_id)).toMatchObject({status:'no_changes'});
    expect(await snapshot()).toEqual(winning);
    const secondarySources=(await pool.query('select id,entity_kind from provider_source_entities where provider_championship_id=$1',[secondary.association])).rows;
    for(const source of secondarySources)await protection.upsertCorrection({sourceEntityId:source.id,fieldPath:'name',overrideValue:`F57D Losing ${source.entity_kind}`,origin:'f57d-gate',actorId:'f57d'});
    expect(await runner.handoff.handoffTraversal(second.traversal_id)).toMatchObject({status:'no_changes'});
    const losing=await snapshot();
    expect(losing.public).toEqual(winning.public);expect(losing.canonical).toEqual(winning.canonical);
    expect(losing.counts.changes).toBe(winning.counts.changes);expect(losing.counts.versions).toBe(winning.counts.versions);
    expect(losing.counts.meetings-winning.counts.meetings).toBe(1);expect(losing.counts.events-winning.counts.events).toBe(1);
    const correct=async(selected:typeof sources,prefix:string)=>{for(const source of selected)await protection.upsertCorrection({sourceEntityId:source.id,fieldPath:'name',overrideValue:`${prefix} ${source.entity_kind}`,origin:'f57d-gate',actorId:'f57d'});};
    for(const order of ['loser-first','winner-first']){
      const beforeOrder=await snapshot(),winner=`F57D ${order} Winner`;
      await correct(sources,winner);await correct(secondarySources,`F57D ${order} Loser`);
      const traversals=order==='loser-first'?[second.traversal_id,first.traversal_id]:[first.traversal_id,second.traversal_id];
      for(const traversal of traversals)await runner.handoff.handoffTraversal(traversal);
      const afterOrder=await snapshot();
      expect(afterOrder.canonical).toEqual([{kind:'event',name:`${winner} event`},{kind:'meeting',name:`${winner} meeting`}]);
      expect(afterOrder.counts.changes-beforeOrder.counts.changes).toBe(2);
      expect(afterOrder.counts.versions-beforeOrder.counts.versions).toBe(2);
    }
    const overrides=new CanonicalFieldOverrideService();
    for(const kind of ['meeting','event'] as const){
      const target=(await pool.query(kind==='meeting'?"select id from meetings where championship_id='f1'":"select normalized_uuid id from events where championship_id='f1'")).rows[0].id;
      await overrides.set({entityKind:kind,entityUuid:target,fieldName:'name',value:`F57D Admin ${kind}`,expectedRevision:0,idempotencyKey:`f57d-admin-${kind}`,actorId:'f57d-admin',reason:'F57D override precedence proof'});
    }
    await runner.handoff.handoffTraversal(first.traversal_id);
    const overridden=await snapshot();
    await correct(sources,'F57D Overridden Provider');await runner.handoff.handoffTraversal(first.traversal_id);
    expect((await snapshot()).canonical).toEqual([{kind:'event',name:'F57D Admin event'},{kind:'meeting',name:'F57D Admin meeting'}]);
    expect((await snapshot()).public).toEqual(overridden.public);
    expect((await snapshot()).counts.changes).toBe(overridden.counts.changes);
    // Inject failure only after the real Event reconciliation has written its
    // evidence. The enclosing handoff must roll back contributions and both
    // resources, including any earlier Meeting work in the same transaction.
    await correct(sources,'F57D Rollback Provider');
    for(const kind of ['meeting','event'] as const){
      const target=(await pool.query(kind==='meeting'?"select id from meetings where championship_id='f1'":"select normalized_uuid id from events where championship_id='f1'")).rows[0].id;
      await overrides.set({entityKind:kind,entityUuid:target,fieldName:'name',value:`F57D Atomic ${kind}`,expectedRevision:1,idempotencyKey:`f57d-atomic-${kind}`,actorId:'f57d-admin',reason:'F57D transactional publication rollback proof'});
    }
    const beforeFailure=await snapshot(),checkpoints=(await pool.query('select * from normalization_checkpoints order by scope_key')).rows;
    const runsBeforeFailure=(await pool.query('select count(*)::int count from reconciliation_runs')).rows[0].count;
    const reconcile=runner.handoff.reconciliation.reconcileLinkedInTransaction.bind(runner.handoff.reconciliation);
    const failure=vi.spyOn(runner.handoff.reconciliation,'reconcileLinkedInTransaction').mockImplementation(async(client,input)=>{const result=await reconcile(client,input);if(input.entityKind==='event')throw new Error('f57d_after_event_reconciliation_failure');return result;});
    await expect(runner.handoff.handoffTraversal(first.traversal_id)).rejects.toThrow('f57d_after_event_reconciliation_failure');
    failure.mockRestore();expect(await snapshot()).toEqual(beforeFailure);
    expect((await pool.query('select count(*)::int count from reconciliation_runs')).rows[0].count).toBe(runsBeforeFailure);
    expect((await pool.query('select * from normalization_checkpoints order by scope_key')).rows).toEqual(checkpoints);
    await runner.handoff.handoffTraversal(first.traversal_id);
    const corrected=await snapshot();
    expect(corrected.canonical).toEqual([{kind:'event',name:'F57D Atomic event'},{kind:'meeting',name:'F57D Atomic meeting'}]);
    expect(corrected.counts.changes-beforeFailure.counts.changes).toBe(2);
    expect(corrected.counts.versions-beforeFailure.counts.versions).toBe(2);
    expect(await runner.handoff.handoffTraversal(first.traversal_id)).toMatchObject({status:'no_changes'});
    expect(await snapshot()).toEqual(corrected);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(blockedExternalFetch).not.toHaveBeenCalled();
    console.info('F57D_CASES_A_K',JSON.stringify({initial:true,identicalReplay:true,winningMeeting:true,winningEvent:true,losingMeeting:true,losingEvent:true,providerOrderIndependent:true,overridePrecedence:true,noFalseChanges:true,oneChangePerMutation:true,correctedReplay:'no_changes',atomicFailureRollback:true,simulatedRequests:2,realRequests:0}));
  });
  it.each([
    {label:'A explicit identity',data:{external_season_id:'2026'},persisted:2026,expected:2026},
    {label:'B structured numeric season',data:{season:2026},persisted:2025,expected:2026},
    {label:'B structured string season',data:{season:' 2026 '},persisted:2025,expected:2026},
    {label:'C persisted season',data:{},persisted:2026,expected:2026},
    {label:'C invalid structured season',data:{season:'not-a-year'},persisted:2026,expected:2026},
    {label:'D explicit precedence',data:{external_season_id:'2025',season:2026},persisted:2026,expected:2025},
    {label:'E missing exact link',data:{season:2027},persisted:2026,expected:null},
    {label:'E explicit missing link never falls back',data:{external_season_id:'2027',season:2026},persisted:2026,expected:null},
    {label:'invalid explicit identity never falls back',data:{external_season_id:' ',season:2026},persisted:2026,expected:null},
    {label:'no exploitable season',data:{season:false},persisted:null,expected:null},
    {label:'F unresolved Event parent',data:{season:2026},persisted:2026,expected:2026,event:true}
  ])('F5-7D1d $label and G identical normalization replay',async testCase=>{
    const client=await pool.connect();
    try{
      await client.query('begin');
      const season2025=randomUUID(),source=randomUUID(),parent=randomUUID(),scope=`f57d-season:${source}`;
      const sourceLink=(await client.query('select id from championship_source_links where provider_instance_id=$1',[ids.provider])).rows[0].id;
      await client.query("insert into championship_seasons(id,championship_id,key,label,start_year,end_year) values($1,'f1','f57d-2025','F57D 2025',2025,2025)",[season2025]);
      await client.query("insert into championship_season_source_links(id,championship_source_link_id,provider_instance_id,external_championship_id,external_season_id,championship_id,championship_season_id,created_by) values($1,$2,$3,'formula1','2025','f1',$4,'f57d')",[randomUUID(),sourceLink,ids.provider,season2025]);
      if('event' in testCase)await client.query("insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1::uuid,$2,$3,'meeting',$1::text,2026,'{}','f57d-unresolved-parent',now(),now(),now())",[parent,ids.provider,ids.association]);
      const data={name:`F57D Season ${source}`,circuit_id:'f57d-fixture-circuit',session_type:'race',status:'scheduled',starts_at:'2026-12-06T13:00:00Z',...testCase.data};
      await client.query("insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,parent_source_entity_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1::uuid,$2,$3,$4,$1::text,$5,$6,$7::jsonb,$1::text,now(),now(),now())",[source,ids.provider,ids.association,'event' in testCase?'event':'meeting','event' in testCase?parent:null,testCase.persisted,JSON.stringify(data)]);
      const before=(await client.query('select (select count(*) from championship_seasons) seasons,(select count(*) from championship_season_source_links) links,(select count(*) from meetings) meetings,(select count(*) from events) events')).rows[0];
      const normalization=new PostgresDeterministicNormalizationService(),input={sourceEntityId:source,scopeKey:scope,expectedFenceGeneration:1,normalizationNow:new Date('2026-10-02T10:00:00Z'),mapping:{version:'f57d-season',rulesVersion:'f57d-r1',championshipIds:{formula1:'f1'},circuitIds:{'f57d-fixture-circuit':'f57d'},sessionTypes:{race:'race'},statuses:{scheduled:'scheduled' as const}}};
      const result=await normalization.normalizeUnitInTransaction(client,input);
      expect(result.state.championshipSeasonId).toBe(testCase.expected===2025?season2025:testCase.expected===2026?ids.season:null);
      if('event' in testCase)expect(result.resolution).toMatchObject({decision:'review',reason:'parent_identity_unresolved'});
      else if(testCase.expected===null)expect(result.resolution).toMatchObject({decision:'review',reason:'championship_season_unresolved'});
      else expect(result.resolution.decision).toBe('create');
      const persisted=(await client.query('select (select count(*) from normalized_candidates where source_entity_id=$1) candidates,(select count(*) from normalization_decisions where source_entity_id=$1) decisions',[source])).rows[0];
      expect(persisted).toEqual({candidates:'1',decisions:'1'});
      expect(await normalization.normalizeUnitInTransaction(client,input)).toEqual(result);
      expect((await client.query('select (select count(*) from normalized_candidates where source_entity_id=$1) candidates,(select count(*) from normalization_decisions where source_entity_id=$1) decisions',[source])).rows[0]).toEqual(persisted);
      expect((await client.query('select (select count(*) from championship_seasons) seasons,(select count(*) from championship_season_source_links) links,(select count(*) from meetings) meetings,(select count(*) from events) events')).rows[0]).toEqual(before);
    }finally{await client.query('rollback');client.release();}
  });
});
