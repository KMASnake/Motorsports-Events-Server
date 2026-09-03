import assert from 'node:assert/strict';
import fs from 'node:fs';
import Fastify from 'fastify';
import pg from 'pg';
import {PreviewClientSecurityService} from '../apps/api/dist/preview/clientSecurity.js';
import {PostgresPreviewRepository} from '../apps/api/dist/preview/repository.js';
import {previewSecurityRoutes} from '../apps/api/dist/routes/previewSecurity.js';

const mode=process.argv[2];

const exactKeys=(value,keys,label)=>{
  assert(value&&typeof value==='object'&&!Array.isArray(value),`${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),`${label} fields must match the strict schema`);
};

async function certify(){
  const databaseUrl=process.env.DATABASE_URL;
  assert(databaseUrl,'internal DATABASE_URL is required');
  const parsedDatabaseUrl=new URL(databaseUrl);
  assert.equal(parsedDatabaseUrl.hostname,'postgres');
  assert.equal(parsedDatabaseUrl.port,'5432');
  assert.equal(parsedDatabaseUrl.pathname,'/pp171_certification');
  assert.equal(parsedDatabaseUrl.username,'pp171_certification');

  const pool=new pg.Pool({connectionString:databaseUrl});
  const transaction=async operation=>{const client=await pool.connect();try{await client.query('begin');const result=await operation(client);await client.query('commit');return result;}catch(error){await client.query('rollback');throw error;}finally{client.release();}};
  const security=new PreviewClientSecurityService('pp171-isolated-certification-pepper-0001',pool,transaction);
  class CertificationRepository extends PostgresPreviewRepository{
    failNextList=false;
    async list(input){if(this.failNextList){this.failNextList=false;throw new Error('pp171_controlled_repository_failure');}return super.list(input);}
  }
  const repository=new CertificationRepository(pool);
  const prefix='PP-171 certification';
  const cleanupClients=async()=>{await pool.query(`delete from api_keys where client_id in(select id from api_clients where name like $1)`,[`${prefix}%`]);await pool.query('delete from api_clients where name like $1',[`${prefix}%`]);};
  const client=async(name,rateLimit,dailyQuota)=>{const created=await security.createClient({name:`${prefix} ${name}`,scopes:['events:read','changes:read'],championshipIds:['f1'],rateLimit,dailyQuota,pageLimit:100,changesPageLimit:100});return {id:created.id,createKey:async keyName=>(await security.createKey(created.id,'test',keyName)).api_key};};
  const usage=async(table,id)=>Number((await pool.query(`select coalesce(sum(request_count),0)::text count from ${table} where client_id=$1`,[id])).rows[0].count);
  const minuteUsage=async(id)=>usage('api_client_minute_usage',id);
  const dailyUsage=async(id)=>usage('api_client_daily_usage',id);
  const responseBody=async response=>{const text=await response.text();return text?JSON.parse(text):null;};
  const assertLimitHeaders=(response,{limit,remaining,dailyLimit,dailyRemaining})=>{
    assert.equal(response.headers.get('ratelimit-limit'),String(limit));
    assert.equal(response.headers.get('ratelimit-remaining'),String(remaining));
    assert(Number(response.headers.get('ratelimit-reset'))>0);
    assert.equal(response.headers.get('x-dailylimit-limit'),String(dailyLimit));
    assert.equal(response.headers.get('x-dailylimit-remaining'),String(dailyRemaining));
    assert(response.headers.get('x-request-id'));
  };

  let current=new Date('2026-08-29T12:34:15Z');
  const app=Fastify({logger:false});
  const baseUrl='http://127.0.0.1:3001';
  const http=async(key,path='/api/v1/events?championship_id=f1')=>fetch(`${baseUrl}${path}`,{headers:{authorization:`Bearer ${key}`}});
  let listening=false;
  try{
    await cleanupClients();
    await app.register(previewSecurityRoutes,{security,repository,cursorSecret:'pp171-isolated-cursor-secret-at-least-32-characters',now:()=>current});
    await app.listen({host:'0.0.0.0',port:3001});
    listening=true;
    let ready=false;
    for(let attempt=0;attempt<25&&!ready;attempt++){try{ready=(await fetch(`${baseUrl}/api/v1/events`)).status===401;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
    assert(ready,'real HTTP listener did not become ready');

    const clientA=await client('client-a',2,100),a1=await clientA.createKey('A1'),a2=await clientA.createKey('A2');
    const clientB=await client('client-b',2,100),b1=await clientB.createKey('B1');
    const aFirst=await http(a1);assert.equal(aFirst.status,200);assertLimitHeaders(aFirst,{limit:2,remaining:1,dailyLimit:100,dailyRemaining:99});
    const aSecond=await http(a2);assert.equal(aSecond.status,200);assertLimitHeaders(aSecond,{limit:2,remaining:0,dailyLimit:100,dailyRemaining:98});
    const aBlocked=await http(a1);assert.equal(aBlocked.status,429);assert.equal((await responseBody(aBlocked)).error.code,'rate_limit_exceeded');assertLimitHeaders(aBlocked,{limit:2,remaining:0,dailyLimit:100,dailyRemaining:98});assert.equal(aBlocked.headers.get('retry-after'),'45');
    const bAllowed=await http(b1);assert.equal(bAllowed.status,200);assertLimitHeaders(bAllowed,{limit:2,remaining:1,dailyLimit:100,dailyRemaining:99});
    assert.equal(await minuteUsage(clientA.id),2);assert.equal(await minuteUsage(clientB.id),1);assert.equal(await dailyUsage(clientA.id),2);assert.equal(await dailyUsage(clientB.id),1);

    const dailyClient=await client('daily',10,2),dailyKey=await dailyClient.createKey('daily');
    const dailyFirst=await http(dailyKey);assert.equal(dailyFirst.status,200);assertLimitHeaders(dailyFirst,{limit:10,remaining:9,dailyLimit:2,dailyRemaining:1});
    const dailySecond=await http(dailyKey);assert.equal(dailySecond.status,200);assertLimitHeaders(dailySecond,{limit:10,remaining:8,dailyLimit:2,dailyRemaining:0});
    const dailyBlocked=await http(dailyKey);assert.equal(dailyBlocked.status,429);assert.equal((await responseBody(dailyBlocked)).error.code,'daily_quota_exceeded');assertLimitHeaders(dailyBlocked,{limit:10,remaining:8,dailyLimit:2,dailyRemaining:0});assert.equal(Number(dailyBlocked.headers.get('retry-after')),41145);assert.equal(await minuteUsage(dailyClient.id),2);assert.equal(await dailyUsage(dailyClient.id),2);

    const resetClient=await client('utc-reset',10,1),resetKey=await resetClient.createKey('reset');
    current=new Date('2026-08-29T23:59:59Z');assert.equal((await http(resetKey)).status,200);
    const beforeReset=await http(resetKey);assert.equal(beforeReset.status,429);assert.equal((await responseBody(beforeReset)).error.code,'daily_quota_exceeded');assert.equal(beforeReset.headers.get('retry-after'),'1');
    current=new Date('2026-08-30T00:00:01Z');const afterReset=await http(resetKey);assert.equal(afterReset.status,200);assertLimitHeaders(afterReset,{limit:10,remaining:9,dailyLimit:1,dailyRemaining:0});
    const days=await pool.query('select usage_day::text,request_count from api_client_daily_usage where client_id=$1 order by usage_day',[resetClient.id]);assert.deepEqual(days.rows.map(row=>({day:String(row.usage_day).slice(0,10),count:Number(row.request_count)})),[{day:'2026-08-29',count:1},{day:'2026-08-30',count:1}]);

    const fixtureIds=['17100000-0000-4000-8000-000000000001','17100000-0000-4000-8000-000000000002','17100000-0000-4000-8000-000000000003'];
    for(const [index,id] of fixtureIds.entries()){const checksum=String(index+1).repeat(64);const change=await pool.query(`insert into public_change_log(resource_type,resource_id,resource_revision,operation,changed_fields,state_checksum,occurred_at) values('event',$1,1,'created',$2,$3,$4) returning sequence`,[id,['name'],checksum,current]);await pool.query(`insert into public_resource_versions(resource_type,resource_id,revision,publication_sequence,operation,championship_id,lifecycle,canonical_state,state_checksum,published_at) values('event',$1,1,$2,'created','f1','active',$3,$4,$5)`,[id,change.rows[0].sequence,{name:`PP-171 fixture ${index+1}`,championshipId:'f1',startsAt:`2026-09-0${index+1}T12:00:00Z`,sessionType:'race'},checksum,current]);}
    const changesClient=await client('changes',10,10),changesKey=await changesClient.createKey('changes');const changesResponse=await http(changesKey,'/api/v1/changes?limit=10');assert.equal(changesResponse.status,200);const changesBody=await responseBody(changesResponse);assert.equal(changesBody.data.length,3);assert.equal(await minuteUsage(changesClient.id),1);assert.equal(await dailyUsage(changesClient.id),1);

    const failureClient=await client('failure',10,3),failureKey=await failureClient.createKey('failure');assert.equal(await minuteUsage(failureClient.id),0);assert.equal(await dailyUsage(failureClient.id),0);repository.failNextList=true;const failed=await http(failureKey);assert.equal(failed.status,500);assert.equal((await responseBody(failed)).error.code,'internal_error');assert.equal(await minuteUsage(failureClient.id),1);assert.equal(await dailyUsage(failureClient.id),0);

    current=new Date('2026-08-30T12:00:05Z');const concurrentClient=await client('concurrent',5,100),concurrentKey=await concurrentClient.createKey('concurrent');const burst=await Promise.all(Array.from({length:12},()=>http(concurrentKey)));const accepted=burst.filter(response=>response.status===200),rejected=burst.filter(response=>response.status===429);assert.equal(accepted.length,5);assert.equal(rejected.length,7);for(const response of rejected){assert.equal(response.status,429);assert.equal((await responseBody(response)).error.code,'rate_limit_exceeded');assertLimitHeaders(response,{limit:5,remaining:0,dailyLimit:100,dailyRemaining:95});assert.equal(response.headers.get('retry-after'),'55');}assert.equal(await minuteUsage(concurrentClient.id),5);assert.equal(await dailyUsage(concurrentClient.id),5);

    const raw={schema:'lot57pf-pp171-runtime-v1',status:'pass',assertions:{real_http:true,real_postgres:true,multi_key_same_client:true,multi_client_isolation:true,rate_limit_429:true,retry_after:true,ratelimit_headers:true,daily_quota_429:true,utc_reset:true,changes_one_request:true,five_xx_compensation:true,concurrent_limit:true},metrics:{client_a_allowed:2,client_a_blocked:1,client_b_allowed:1,changes_rows:3,changes_requests_charged:1,concurrent_allowed:5,concurrent_blocked:7},provider_calls_external:0,provider_credits_consumed:0,worker_started:false};
    process.stdout.write(`${JSON.stringify(raw)}\n`);
  }finally{
    if(listening)await app.close();
    await cleanupClients();
    await pool.end();
  }
}

function finalize(){
  const [rawPath,outputPath,gitSha,version]=process.argv.slice(3);
  assert(rawPath&&outputPath&&gitSha&&version,'finalize requires raw path, output path, Git SHA and version');
  assert(/^[0-9a-f]{40}$/.test(gitSha),'Git SHA must be canonical');
  assert(version!=='unknown'&&version.trim(),'version must be known');
  const raw=JSON.parse(fs.readFileSync(rawPath,'utf8'));
  exactKeys(raw,['schema','status','assertions','metrics','provider_calls_external','provider_credits_consumed','worker_started'],'runtime evidence');
  exactKeys(raw.assertions,['real_http','real_postgres','multi_key_same_client','multi_client_isolation','rate_limit_429','retry_after','ratelimit_headers','daily_quota_429','utc_reset','changes_one_request','five_xx_compensation','concurrent_limit'],'assertions');
  exactKeys(raw.metrics,['client_a_allowed','client_a_blocked','client_b_allowed','changes_rows','changes_requests_charged','concurrent_allowed','concurrent_blocked'],'metrics');
  assert.equal(raw.schema,'lot57pf-pp171-runtime-v1');assert.equal(raw.status,'pass');for(const value of Object.values(raw.assertions))assert.equal(value,true);assert.deepEqual(raw.metrics,{client_a_allowed:2,client_a_blocked:1,client_b_allowed:1,changes_rows:3,changes_requests_charged:1,concurrent_allowed:5,concurrent_blocked:7});assert.equal(raw.provider_calls_external,0);assert.equal(raw.provider_credits_consumed,0);assert.equal(raw.worker_started,false);
  const evidence={schema:'lot57pf-pp171-evidence-v1',status:'pass',certified_at:new Date().toISOString(),git_sha:gitSha,version,results:raw,cleanup_verified:true};
  const serialized=JSON.stringify(evidence,null,2);assert(!/(authorization|api[_-]?key|credential|secret|password|pepper|nonce|ciphertext|database[_-]?url|provider[_-]?(?:source|payload))/i.test(serialized),'sensitive field or value refused');fs.writeFileSync(outputPath,`${serialized}\n`,{mode:0o600});process.stdout.write(`${outputPath}\n`);
}

if(mode==='certify')await certify();
else if(mode==='finalize')finalize();
else throw new Error('Usage: validate-lot57pf-pp171.mjs certify|finalize');
