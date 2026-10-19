import Fastify from 'fastify';
import {beforeEach,describe,expect,it,vi} from 'vitest';

const poolQuery=vi.hoisted(()=>vi.fn());
vi.mock('../src/lib/db.js',()=>({pool:{query:poolQuery},withTransaction:vi.fn()}));

import {correctionRoutes} from '../src/routes/corrections.js';

beforeEach(()=>poolQuery.mockReset());

describe('canonical correction projection',()=>{
  it('never exposes revoked overrides in lists, counts or details',async()=>{
    poolQuery.mockImplementation(async(sql:string)=>String(sql).includes('count(*)::int total')?{rowCount:1,rows:[{total:0}]}:{rowCount:0,rows:[]});
    const app=Fastify();await app.register(correctionRoutes);
    expect((await app.inject({method:'GET',url:'/api/v1/admin/corrections'})).statusCode).toBe(200);
    expect(String(poolQuery.mock.calls[0][0])).toContain("where ec.status='active'");
    expect((await app.inject({method:'GET',url:'/api/v1/admin/corrections?page=1'})).statusCode).toBe(200);
    expect(String(poolQuery.mock.calls[1][0])).toContain("where ec.status='active'");
    expect((await app.inject({method:'GET',url:'/api/v1/admin/corrections/revoked-id'})).statusCode).toBe(404);
    expect(String(poolQuery.mock.calls.at(-1)?.[0])).toContain("where ec.status='active' and (ec.id::text=$1 or ec.legacy_event_correction_id=$1)");
    await app.close();
  });
});
