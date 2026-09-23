import Fastify from 'fastify';
import {beforeEach,describe,expect,it,vi} from 'vitest';

const clientQuery=vi.hoisted(()=>vi.fn());
const poolQuery=vi.hoisted(()=>vi.fn());
vi.mock('../src/lib/db.js',()=>({
  pool:{query:poolQuery},
  withTransaction:vi.fn(async(operation:(client:{query:typeof clientQuery})=>unknown)=>operation({query:clientQuery}))
}));

import {championshipRoutes} from '../src/routes/championships.js';
import {sessionRoutes} from '../src/routes/sessions.js';

beforeEach(()=>{clientQuery.mockReset();poolQuery.mockReset();});

describe('F5-1 taxonomy administration routes',()=>{
  it('adds a discipline and family as audited data',async()=>{
    clientQuery.mockImplementation(async(sql:string)=>String(sql).startsWith('insert into disciplines')
      ?{rowCount:1,rows:[{key:'karting',label:'Karting',family_key:'circuit_racing',active:true}]}
      :{rowCount:1,rows:[]});
    const app=Fastify();await app.register(championshipRoutes,{includePublic:false});
    const response=await app.inject({method:'POST',url:'/api/v1/admin/disciplines',payload:{key:'karting',label:'Karting',family_key:'circuit_racing',active:true}});
    expect(response.statusCode).toBe(201);expect(response.json()).toMatchObject({key:'karting',family_key:'circuit_racing'});
    expect(clientQuery.mock.calls.some(([sql])=>String(sql).includes('admin_audit_log'))).toBe(true);
    await app.close();
  });

  it('adds a family as reference data rather than an unbounded discipline property',async()=>{
    clientQuery.mockImplementation(async(sql:string)=>String(sql).startsWith('insert into discipline_families')
      ?{rowCount:1,rows:[{key:'off_road',label:'Tout-terrain',active:true}]}
      :{rowCount:1,rows:[]});
    const app=Fastify();await app.register(championshipRoutes,{includePublic:false});
    const response=await app.inject({method:'POST',url:'/api/v1/admin/discipline-families',payload:{key:'off_road',label:'Tout-terrain',active:true}});
    expect(response.statusCode).toBe(201);expect(response.json().key).toBe('off_road');await app.close();
  });

  it('adds a future session classification without creating a Session identity',async()=>{
    clientQuery.mockImplementation(async(sql:string)=>String(sql).startsWith('insert into session_types')
      ?{rowCount:1,rows:[{key:'super_special',label:'Super spéciale',sort_order:90,active:true}]}
      :{rowCount:1,rows:[]});
    const app=Fastify();await app.register(sessionRoutes);
    const response=await app.inject({method:'POST',url:'/api/v1/admin/session-types',payload:{key:'super_special',label:'Super spéciale',sort_order:90,active:true}});
    expect(response.statusCode).toBe(201);expect(response.json().key).toBe('super_special');
    expect(clientQuery.mock.calls.some(([sql])=>String(sql).startsWith('insert into sessions'))).toBe(false);
    await app.close();
  });

  it('rejects malformed keys before touching the database',async()=>{
    const app=Fastify();await app.register(championshipRoutes,{includePublic:false});
    expect((await app.inject({method:'POST',url:'/api/v1/admin/disciplines',payload:{key:'../karting',label:'Karting',family_key:'circuit_racing'}})).statusCode).toBe(400);
    expect(clientQuery).not.toHaveBeenCalled();await app.close();
  });

  it.each([
    ['discipline family','/api/v1/admin/discipline-families',{key:'circuit_racing',label:'Duplicate',active:true}],
    ['discipline','/api/v1/admin/disciplines',{key:'rally',label:'Duplicate',family_key:'rally',active:true}]
  ])('rejects a duplicate %s key with a deterministic conflict',async(_label,url,payload)=>{
    clientQuery.mockRejectedValue(Object.assign(new Error('duplicate'),{code:'23505'}));
    const app=Fastify();await app.register(championshipRoutes,{includePublic:false});
    expect((await app.inject({method:'POST',url,payload})).statusCode).toBe(409);
    await app.close();
  });

  it('rejects a duplicate session type key with a deterministic conflict',async()=>{
    clientQuery.mockRejectedValue(Object.assign(new Error('duplicate'),{code:'23505'}));
    const app=Fastify();await app.register(sessionRoutes);
    expect((await app.inject({method:'POST',url:'/api/v1/admin/session-types',payload:{key:'race',label:'Duplicate',sort_order:99,active:true}})).statusCode).toBe(409);
    await app.close();
  });

  it('rejects an unknown discipline family on create and patch',async()=>{
    clientQuery.mockImplementation(async(sql:string)=>{
      if(String(sql).startsWith('select * from disciplines'))return {rowCount:1,rows:[{key:'karting',label:'Karting',family_key:'circuit_racing',active:true}]};
      throw Object.assign(new Error('foreign key'),{code:'23503'});
    });
    const app=Fastify();await app.register(championshipRoutes,{includePublic:false});
    expect((await app.inject({method:'POST',url:'/api/v1/admin/disciplines',payload:{key:'karting',label:'Karting',family_key:'unknown_family',active:true}})).statusCode).toBe(400);
    expect((await app.inject({method:'PATCH',url:'/api/v1/admin/disciplines/karting',payload:{family_key:'unknown_family'}})).statusCode).toBe(400);
    await app.close();
  });

  it('rejects an unknown championship discipline and accepts an explicit null discipline',async()=>{
    const payload={name:'Historic Series',slug:'historic-series',category:'Legacy free label',season:2026,active:true,sync_enabled:false};
    clientQuery.mockRejectedValueOnce(Object.assign(new Error('foreign key'),{code:'23503'}));
    const app=Fastify();await app.register(championshipRoutes,{includePublic:false});
    expect((await app.inject({method:'POST',url:'/api/v1/championships',payload:{...payload,discipline_key:'unknown_discipline'}})).statusCode).toBe(400);
    clientQuery.mockImplementation(async(sql:string)=>String(sql).startsWith('insert into championships')
      ?{rowCount:1,rows:[{id:'taxonomy-null-discipline',...payload,discipline_key:null}]}
      :{rowCount:1,rows:[]});
    const accepted=await app.inject({method:'POST',url:'/api/v1/championships',payload:{...payload,slug:'historic-series-null',discipline_key:null}});
    expect(accepted.statusCode).toBe(201);expect(accepted.json().discipline_key).toBeNull();
    await app.close();
  });
});
