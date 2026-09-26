import Fastify from 'fastify';
import { beforeEach,describe,expect,it,vi } from 'vitest';

const clientQuery=vi.hoisted(()=>vi.fn());
const poolQuery=vi.hoisted(()=>vi.fn());
vi.mock('../src/lib/db.js',()=>({pool:{query:poolQuery},withTransaction:vi.fn(async operation=>operation({query:clientQuery}))}));
import { venueRoutes } from '../src/routes/venues.js';

const venueId='34000000-0000-4000-8000-000000000001';
const otherVenueId='34000000-0000-4000-8000-000000000002';
const layoutId='34000000-0000-4000-8000-000000000003';
const venue={id:venueId,key:'silverstone-venue',name:'Silverstone',kind_key:'circuit',city:null,region:null,country_code:'GB',timezone:'Europe/London',latitude:52.0786,longitude:-1.0169};
const layout={id:layoutId,venue_id:venueId,key:'grand-prix',name:'Grand Prix'};
beforeEach(()=>{clientQuery.mockReset();poolQuery.mockReset();});

describe('F5-3 Venue/Layout admin routes',()=>{
  it('creates, lists and gets a Venue with an IANA timezone and coordinates',async()=>{
    clientQuery.mockImplementation(async(sql:string)=>{
      if(sql.startsWith('select key from venue_kinds'))return{rowCount:1,rows:[{key:'circuit'}]};
      if(sql.includes('insert into venues'))return{rowCount:1,rows:[venue]};
      return{rowCount:1,rows:[]};
    });
    poolQuery.mockResolvedValueOnce({rowCount:1,rows:[venue]}).mockResolvedValueOnce({rowCount:1,rows:[venue]});
    const app=Fastify();await app.register(venueRoutes);
    const created=await app.inject({method:'POST',url:'/api/v1/admin/venues',payload:{key:venue.key,name:venue.name,kind_key:'circuit',country_code:'GB',timezone:'Europe/London',latitude:venue.latitude,longitude:venue.longitude}});
    expect(created.statusCode,created.body).toBe(201);
    expect((await app.inject({method:'GET',url:'/api/v1/admin/venues'})).json()).toEqual([venue]);
    expect((await app.inject({method:'GET',url:`/api/v1/admin/venues/${venueId}`})).json()).toEqual(venue);
    expect(clientQuery.mock.calls.some(([sql])=>String(sql).includes('admin_audit_log'))).toBe(true);
    await app.close();
  });

  it('updates mutable metadata while retaining Venue UUID and key',async()=>{
    clientQuery.mockImplementation(async(sql:string)=>{
      if(sql.includes('from venues where id=$1 for update'))return{rowCount:1,rows:[venue]};
      if(sql.startsWith('select key from venue_kinds'))return{rowCount:1,rows:[{key:'street_circuit'}]};
      if(sql.startsWith('update venues'))return{rowCount:1,rows:[{...venue,name:'Silverstone updated',kind_key:'street_circuit'}]};
      return{rowCount:1,rows:[]};
    });
    const app=Fastify();await app.register(venueRoutes);
    const response=await app.inject({method:'PATCH',url:`/api/v1/admin/venues/${venueId}`,payload:{name:'Silverstone updated',kind_key:'street_circuit'}});
    expect(response.statusCode,response.body).toBe(200);
    expect(response.json()).toMatchObject({id:venueId,key:venue.key,name:'Silverstone updated'});
    await app.close();
  });

  it('creates/lists/gets/updates Layout without changing session or canonical identities',async()=>{
    clientQuery.mockImplementation(async(sql:string)=>{
      if(sql.startsWith('select id from venues'))return{rowCount:1,rows:[{id:venueId}]};
      if(sql.includes('insert into venue_layouts'))return{rowCount:1,rows:[layout]};
      if(sql.includes('from venue_layouts where id=$1 for update'))return{rowCount:1,rows:[layout]};
      if(sql.startsWith('update venue_layouts'))return{rowCount:1,rows:[{...layout,name:'GP updated'}]};
      return{rowCount:1,rows:[]};
    });
    poolQuery.mockResolvedValueOnce({rowCount:1,rows:[{id:venueId}]})
      .mockResolvedValueOnce({rowCount:1,rows:[layout]}).mockResolvedValueOnce({rowCount:1,rows:[layout]});
    const app=Fastify();await app.register(venueRoutes);
    expect((await app.inject({method:'POST',url:`/api/v1/admin/venues/${venueId}/layouts`,payload:{key:'grand-prix',name:'Grand Prix'}})).statusCode).toBe(201);
    expect((await app.inject({method:'GET',url:`/api/v1/admin/venues/${venueId}/layouts`})).json()).toEqual([layout]);
    expect((await app.inject({method:'GET',url:`/api/v1/admin/venue-layouts/${layoutId}`})).json()).toEqual(layout);
    const updated=await app.inject({method:'PATCH',url:`/api/v1/admin/venue-layouts/${layoutId}`,payload:{name:'GP updated'}});
    expect(updated.json()).toMatchObject({id:layoutId,key:'grand-prix',name:'GP updated'});
    expect(clientQuery.mock.calls.some(([sql])=>/update (events|meetings|championship_seasons)/.test(String(sql)))).toBe(false);
    await app.close();
  });

  it('creates and explicitly updates a Circuit mapping',async()=>{
    clientQuery.mockImplementation(async(sql:string)=>{
      if(sql.startsWith('select id from circuits'))return{rowCount:1,rows:[{id:'silverstone'}]};
      if(sql.startsWith('select id from venues'))return{rowCount:1,rows:[{id:venueId}]};
      if(sql.includes('venue_layouts where id=$1 and venue_id=$2'))return{rowCount:1,rows:[layout]};
      if(sql.startsWith('select * from circuit_venue_links'))return{rowCount:0,rows:[]};
      if(sql.includes('insert into circuit_venue_links'))return{rowCount:1,rows:[{circuit_id:'silverstone',venue_id:venueId,venue_layout_id:layoutId}]};
      return{rowCount:1,rows:[]};
    });
    poolQuery.mockResolvedValueOnce({rowCount:1,rows:[{circuit_id:'silverstone',venue_id:venueId,venue_layout_id:layoutId}]});
    const app=Fastify();await app.register(venueRoutes);
    const mapped=await app.inject({method:'PUT',url:'/api/v1/admin/circuits/silverstone/venue-link',payload:{venue_id:venueId,venue_layout_id:layoutId}});
    expect(mapped.statusCode,mapped.body).toBe(200);
    expect((await app.inject({method:'GET',url:'/api/v1/admin/circuit-venue-links'})).json()).toHaveLength(1);
    await app.close();
  });

  it.each([
    ['POST','/api/v1/admin/venues',{key:'',name:'A',kind_key:'circuit'}],
    ['POST','/api/v1/admin/venues',{key:'   ',name:'A',kind_key:'circuit'}],
    ['POST','/api/v1/admin/venues',{key:'valid',name:'   ',kind_key:'circuit'}],
    ['POST','/api/v1/admin/venues',{key:'valid',name:'A',kind_key:'circuit',timezone:'Mars/Olympus'}],
    ['POST','/api/v1/admin/venues',{key:'valid',name:'A',kind_key:'circuit',latitude:48}],
    ['POST','/api/v1/admin/venues',{key:'valid',name:'A',kind_key:'circuit',latitude:91,longitude:2}],
    ['POST','/api/v1/admin/venues',{key:'valid',name:'A',kind_key:'circuit',latitude:48,longitude:-181}],
    ['PATCH',`/api/v1/admin/venues/${venueId}`,{key:'changed'}],
    ['PATCH',`/api/v1/admin/venue-layouts/${layoutId}`,{key:'changed'}],
    ['GET','/api/v1/admin/venues/not-a-uuid',undefined],
    ['GET','/api/v1/admin/venue-layouts/not-a-uuid',undefined]
  ] as const)('rejects invalid input with 400 and no persistence',async(method,url,payload)=>{
    const app=Fastify();await app.register(venueRoutes);
    const response=await app.inject({method,url,payload});expect(response.statusCode,response.body).toBe(400);
    expect(clientQuery).not.toHaveBeenCalled();expect(poolQuery).not.toHaveBeenCalled();await app.close();
  });

  it('validates the merged coordinate state on PATCH',async()=>{
    clientQuery.mockResolvedValueOnce({rowCount:1,rows:[venue]});
    const app=Fastify();await app.register(venueRoutes);
    const response=await app.inject({method:'PATCH',url:`/api/v1/admin/venues/${venueId}`,payload:{longitude:null}});
    expect(response.statusCode,response.body).toBe(400);
    expect(clientQuery.mock.calls.some(([sql])=>String(sql).startsWith('update venues'))).toBe(false);
    await app.close();
  });

  it('returns deterministic errors for invalid kind and cross-Venue Layout mapping',async()=>{
    clientQuery.mockResolvedValueOnce({rowCount:0,rows:[]});
    const app=Fastify();await app.register(venueRoutes);
    expect((await app.inject({method:'POST',url:'/api/v1/admin/venues',payload:{key:'valid',name:'Valid',kind_key:'unknown'}})).statusCode).toBe(400);
    clientQuery.mockReset();
    clientQuery.mockImplementation(async(sql:string)=>{
      if(sql.startsWith('select id from circuits'))return{rowCount:1,rows:[{id:'silverstone'}]};
      if(sql.startsWith('select id from venues'))return{rowCount:1,rows:[{id:otherVenueId}]};
      if(sql.includes('and venue_id=$2'))return{rowCount:0,rows:[]};
      if(sql.startsWith('select id from venue_layouts'))return{rowCount:1,rows:[layout]};
      return{rowCount:1,rows:[]};
    });
    const crossed=await app.inject({method:'PUT',url:'/api/v1/admin/circuits/silverstone/venue-link',payload:{venue_id:otherVenueId,venue_layout_id:layoutId}});
    expect(crossed.statusCode,crossed.body).toBe(400);
    await app.close();
  });

  it('returns 404 deterministically for unknown Venue, Circuit and Layout references',async()=>{
    poolQuery.mockResolvedValueOnce({rowCount:0,rows:[]});
    const app=Fastify();await app.register(venueRoutes);
    expect((await app.inject({method:'GET',url:`/api/v1/admin/venues/${venueId}`})).statusCode).toBe(404);

    clientQuery.mockResolvedValueOnce({rowCount:0,rows:[]});
    expect((await app.inject({method:'PUT',url:'/api/v1/admin/circuits/unknown/venue-link',payload:{venue_id:venueId}})).statusCode).toBe(404);

    clientQuery.mockReset();
    clientQuery.mockResolvedValueOnce({rowCount:1,rows:[{id:'silverstone'}]}).mockResolvedValueOnce({rowCount:0,rows:[]});
    expect((await app.inject({method:'PUT',url:'/api/v1/admin/circuits/silverstone/venue-link',payload:{venue_id:venueId}})).statusCode).toBe(404);

    clientQuery.mockReset();
    clientQuery.mockResolvedValueOnce({rowCount:1,rows:[{id:'silverstone'}]}).mockResolvedValueOnce({rowCount:1,rows:[venue]})
      .mockResolvedValueOnce({rowCount:0,rows:[]}).mockResolvedValueOnce({rowCount:0,rows:[]});
    expect((await app.inject({method:'PUT',url:'/api/v1/admin/circuits/silverstone/venue-link',payload:{venue_id:venueId,venue_layout_id:layoutId}})).statusCode).toBe(404);
    await app.close();
  });
});
