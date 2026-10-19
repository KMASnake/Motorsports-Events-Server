import Fastify from 'fastify';
import pg from 'pg';

const fail=message=>{throw new Error(`F3 Phase 2 cursor probe refused: ${message}`);};
const mode=process.env.F3_CURSOR_MODE,cursor=process.env.F3_CURSOR_INPUT;
if(!['capture','verify'].includes(mode))fail('mode must be capture or verify');
if(mode==='verify'&&!cursor)fail('cursor input is required for verification');
if(!process.env.DATABASE_URL)fail('internal database connection is absent');
globalThis.fetch=async()=>{throw new Error('external_provider_network_blocked');};
const [{previewReadRoutes},{PostgresPreviewRepository}]=await Promise.all([
  import('/app/apps/api/dist/routes/previewRead.js'),
  import('/app/apps/api/dist/preview/repository.js')
]);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const app=Fastify({logger:false}),secret='lot57pf3-phase2-cursor-compatibility-secret';
try{
  await app.register(previewReadRoutes,{repository:new PostgresPreviewRepository(pool),cursorSecret:secret,now:()=>new Date('2026-08-31T12:00:00Z')});
  if(mode==='capture'){
    const response=await app.inject('/api/v1/events?championship_id=f1&from=1900-01-01T00:00:00Z&limit=1');
    if(response.statusCode!==200)fail(`capture returned HTTP ${response.statusCode}`);
    const value=response.json().pagination?.sync_cursor;
    if(typeof value!=='string'||!value)fail('captured cursor is absent');
    process.stdout.write(`${JSON.stringify({status:'pass',cursor:value,provider_calls:0})}\n`);
  }else{
    const response=await app.inject(`/api/v1/changes?cursor=${encodeURIComponent(cursor)}&limit=1`);
    if(response.statusCode!==200)fail(`cursor verification returned HTTP ${response.statusCode}`);
    process.stdout.write(`${JSON.stringify({status:'pass',cursor_valid:true,provider_calls:0})}\n`);
  }
}finally{await app.close();await pool.end();}
