import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const clientQuery = vi.hoisted(() => vi.fn());
const poolQuery = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/db.js', () => ({
  pool: { query: poolQuery },
  withTransaction: vi.fn(async (operation: (client: { query: typeof clientQuery }) => unknown) => operation({ query: clientQuery }))
}));

import { eventRoutes } from '../src/routes/events.js';

const base = {
  id: 'evt-002', championship_id: 'f1', circuit_id: 'silverstone',
  name: 'Grand Prix de Grande-Bretagne', slug: 'grand-prix-de-grande-bretagne-2026',
  category: 'Grand Prix', starts_at: '2026-07-05T14:00:00.000Z', ends_at: '2026-07-05T16:00:00.000Z',
  timezone: 'UTC', status: 'completed', published: true, session_title: null, description: null
};

async function app() {
  const instance = Fastify();
  await instance.register(eventRoutes, { includePublic: false });
  return instance;
}

beforeEach(() => {clientQuery.mockReset();poolQuery.mockReset();});

describe('sécurité des corrections événement fournisseur', () => {
  it('préserve la catégorie existante lorsqu’elle est absente du PATCH de l’éditeur',async()=>{
    const current={...base,origin:'manual',provider_key:null,external_id:null};
    clientQuery.mockImplementation(async(sql:string)=>{
      if(String(sql).startsWith('select * from events'))return {rowCount:1,rows:[current]};
      if(String(sql).startsWith('update events set'))return {rowCount:1,rows:[{...current,name:'Nom modifié'}]};
      return {rowCount:1,rows:[]};
    });
    const instance=await app();
    const response=await instance.inject({method:'PATCH',url:'/api/v1/admin/events/evt-002',payload:{name:'Nom modifié'}});
    expect(response.statusCode).toBe(200);
    const update=clientQuery.mock.calls.find(([sql])=>String(sql).startsWith('update events set'));
    expect(update?.[1][5]).toBe('Grand Prix');
    expect(response.json().category).toBe('Grand Prix');
    await instance.close();
  });

  it('bloque une édition silencieuse si l’origine provider n’a aucune identité', async () => {
    clientQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ ...base, origin: 'provider', provider_key: null, external_id: null }] });
    const instance = await app();
    const response = await instance.inject({ method: 'PATCH', url: '/api/v1/admin/events/evt-002', payload: { name: 'Nom local' } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'provider_identity_incomplete' });
    expect(clientQuery).toHaveBeenCalledTimes(1);
    await instance.close();
  });

  it('persiste une correction avant de modifier un événement fournisseur identifié', async () => {
    const current = { ...base, origin: 'provider', provider_key: 'fixture', external_id: 'british-gp-2026' };
    clientQuery.mockImplementation(async (sql: string) => {
      const statement = String(sql ?? '');
      if (statement.startsWith('select * from events')) return { rowCount: 1, rows: [current] };
      if (statement.includes('from event_corrections')) return { rowCount: 0, rows: [] };
      if (statement.startsWith('update events set')) return { rowCount: 1, rows: [{ ...current, name: 'Nom local' }] };
      return { rowCount: 1, rows: [] };
    });
    const instance = await app();
    const response = await instance.inject({ method: 'PATCH', url: '/api/v1/admin/events/evt-002', payload: { name: 'Nom local' } });
    expect(response.statusCode).toBe(200);
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('insert into event_corrections'))).toBe(true);
    expect(clientQuery.mock.calls.find(([sql]) => String(sql).startsWith('update events set'))).toBeTruthy();
    await instance.close();
  });

  it('rejette explicitement une catégorie administrative hors enum',async()=>{
    const instance=await app();
    const response=await instance.inject({method:'PATCH',url:'/api/v1/admin/events/evt-002',payload:{category:'Grand Prix'}});
    expect(response.statusCode).toBe(400);expect(response.json().message).toBe('Catégorie invalide.');expect(clientQuery).not.toHaveBeenCalled();
    await instance.close();
  });

  it('modifie race en qualifying sans renommer l’Event ou sa session',async()=>{
    const current={...base,name:'FP1',session_title:'FP1',category:'race',origin:'manual',provider_key:null,external_id:null};
    clientQuery.mockImplementation(async(sql:string,args?:unknown[])=>{
      if(String(sql).startsWith('select * from events'))return {rowCount:1,rows:[current]};
      if(String(sql).startsWith('update events set'))return {rowCount:1,rows:[{...current,category:String(args?.[5])}]};
      return {rowCount:1,rows:[]};
    });
    const instance=await app(),response=await instance.inject({method:'PATCH',url:'/api/v1/admin/events/evt-002',payload:{category:'qualifying'}});
    expect(response.statusCode).toBe(200);expect(response.json()).toMatchObject({category:'qualifying',name:'FP1',session_title:'FP1'});
    const update=clientQuery.mock.calls.find(([sql])=>String(sql).startsWith('update events set'))!;expect(update[1][3]).toBe('FP1');expect(update[1][5]).toBe('qualifying');expect(update[1][14]).toBe('FP1');
    await instance.close();
  });

  it('crée un Event manuel avec la catégorie practice',async()=>{
    poolQuery.mockResolvedValue({rowCount:1,rows:[{id:'f1'}]});
    clientQuery.mockImplementation(async(sql:string,args?:unknown[])=>{
      if(String(sql).includes('select slug from events'))return {rowCount:0,rows:[]};
      if(String(sql).includes('insert into events('))return {rowCount:1,rows:[{id:'manual-practice',name:'FP1',session_title:'FP1',category:args?.[5]}]};
      return {rowCount:1,rows:[]};
    });
    const instance=await app(),response=await instance.inject({method:'POST',url:'/api/v1/admin/events',payload:{championship_id:'f1',circuit_id:null,name:'FP1',category:'practice',starts_at:'2026-03-06T01:30:00.000Z',ends_at:'2026-03-06T02:30:00.000Z',status:'scheduled',published:true,session_title:'FP1',description:null}});
    expect(response.statusCode).toBe(201);expect(response.json()).toMatchObject({name:'FP1',session_title:'FP1',category:'practice'});
    await instance.close();
  });

  it('crée une correction contrôlée pour la catégorie d’un Event provider identifié',async()=>{
    const current={...base,name:'Race',session_title:'Race',category:'race',origin:'provider',provider_key:'ocblacktop',external_id:'race-1'};
    clientQuery.mockImplementation(async(sql:string,args?:unknown[])=>{
      if(String(sql).startsWith('select * from events'))return {rowCount:1,rows:[current]};
      if(String(sql).includes('from event_corrections'))return {rowCount:0,rows:[]};
      if(String(sql).startsWith('update events set'))return {rowCount:1,rows:[{...current,category:args?.[5]}]};
      return {rowCount:1,rows:[]};
    });
    const instance=await app(),response=await instance.inject({method:'PATCH',url:'/api/v1/admin/events/evt-002',payload:{category:'qualifying'}});
    expect(response.statusCode).toBe(200);expect(response.json()).toMatchObject({name:'Race',session_title:'Race',category:'qualifying'});
    expect(clientQuery.mock.calls.some(([sql,args])=>String(sql).includes('insert into event_corrections')&&(args as unknown[])[4]==='category')).toBe(true);
    await instance.close();
  });
});
