import Fastify from 'fastify';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const database=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('../src/lib/db.js',()=>({pool:database,withTransaction:vi.fn()}));

import {eventRoutes} from '../src/routes/events.js';

const meetingId='57000000-0000-4000-8000-000000000100';
const rows=['Practice 1','Qualifying','Race'].map((name,index)=>({
  id:`event-${index+1}`,name,session_title:name,meeting_id:meetingId,
  meeting_name:'Singapore Grand Prix'
}));

describe('projection Meeting des Events administratifs',()=>{
  let app:ReturnType<typeof Fastify>;
  beforeEach(async()=>{database.query.mockReset();app=Fastify({logger:false});await app.register(eventRoutes,{includePublic:false});});
  afterEach(async()=>app.close());

  it('expose le même Meeting pour ses trois Events sans dupliquer la liste',async()=>{
    database.query.mockResolvedValueOnce({rows,rowCount:rows.length});
    const response=await app.inject('/api/v1/admin/events');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(rows);
    const sql=String(database.query.mock.calls[0]?.[0]);
    expect(sql).toContain('left join meeting_events me on me.event_id=e.id');
    expect(sql).toContain('left join meetings m on m.id=me.meeting_id');
    expect(sql).toContain('me.meeting_id,m.name meeting_name');
  });

  it('expose la projection Meeting dans le détail et conserve les null pour un Event autonome',async()=>{
    database.query.mockResolvedValueOnce({rows:[rows[1]],rowCount:1});
    expect((await app.inject('/api/v1/admin/events/event-2')).json()).toMatchObject({meeting_id:meetingId,meeting_name:'Singapore Grand Prix',name:'Qualifying'});
    database.query.mockResolvedValueOnce({rows:[{...rows[1],meeting_id:null,meeting_name:null}],rowCount:1});
    expect((await app.inject('/api/v1/admin/events/manual-event')).json()).toMatchObject({meeting_id:null,meeting_name:null});
  });

  it('recherche les sessions par le nom du Meeting parent',async()=>{
    database.query.mockResolvedValueOnce({rows,rowCount:rows.length});
    const response=await app.inject('/api/v1/admin/events?search=Singapore%20Grand%20Prix');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(3);
    const [sql,params]=database.query.mock.calls[0] as [string,unknown[]];
    expect(sql).toContain("coalesce(m.name,'') ilike $1");
    expect(params).toEqual(['%Singapore Grand Prix%']);
  });
});
