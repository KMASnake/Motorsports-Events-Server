import { describe,expect,it } from 'vitest';
import { OcBlackTopAdapter,TheSportsDbAdapter } from '../src/providers/realAdapters.js';
import { fetchProviderJson } from '../src/providers/providerHttp.js';

const response=(value:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}}));
const context=(base_url:string,api_key='test-key')=>({providerInstanceId:'provider',providerConfig:{base_url},credentials:{api_key},requestCounter:{count:0,increment(){this.count++;},get value(){return this.count;}}});

describe('Lot 5.3 real provider discovery adapters',()=>{
  it('discovers OCBlackTop championships and keeps WRC strategy inside the adapter',async()=>{
    const adapter=new OcBlackTopAdapter(async()=>response({data:[{slug:'formula1',name:'Formula 1'},{slug:'wrc',name:'WRC'}]}));
    const ctx=context('https://api.ocblacktop.com/v1');const rows=[];
    for await(const row of adapter.discoverChampionships(ctx))rows.push(row);
    expect(rows).toHaveLength(2);expect(rows[1]?.sourceConfig).toEqual({strategy:'season-endpoint',external_id:'wrc'});expect(ctx.requestCounter.value).toBe(1);
  });
  it('discovers only motorsport leagues from TheSportsDB',async()=>{
    const adapter=new TheSportsDbAdapter(async()=>response({leagues:[{idLeague:'4454',strLeague:'WorldSBK',strSport:'Motorsport'},{idLeague:'1',strLeague:'Football',strSport:'Soccer'}]}));
    const ctx=context('https://www.thesportsdb.com/api/v1/json');const rows=[];
    for await(const row of adapter.discoverChampionships(ctx))rows.push(row);
    expect(rows.map(row=>row.name)).toEqual(['WorldSBK']);expect(ctx.requestCounter.value).toBe(1);
  });
  it('rejects unsafe endpoints, redirects, oversized bodies and sanitizes HTTP errors',async()=>{
    await expect(fetchProviderJson({url:new URL('http://127.0.0.1/private'),allowedHosts:['api.ocblacktop.com']})).rejects.toMatchObject({code:'unsafe_endpoint'});
    await expect(fetchProviderJson({url:new URL('https://api.ocblacktop.com/v1/sports'),allowedHosts:['api.ocblacktop.com'],fetchImpl:async()=>new Response('x'.repeat(50),{headers:{'content-length':'50'}}),maxBytes:10})).rejects.toMatchObject({code:'response_too_large'});
    await expect(fetchProviderJson({url:new URL('https://api.ocblacktop.com/v1/sports'),allowedHosts:['api.ocblacktop.com'],fetchImpl:async()=>response({message:'secret URL'},401)})).rejects.toMatchObject({code:'http_401',message:'Le fournisseur a répondu HTTP 401.'});
  });
});
