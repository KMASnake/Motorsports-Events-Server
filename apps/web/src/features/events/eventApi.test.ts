import {beforeEach,describe,expect,it,vi} from 'vitest';
import {saveEvent} from './eventApi';
import type {EventFormState} from './eventTypes';

const form:EventFormState={championship_id:'f1',circuit_id:'silverstone',name:'British Grand Prix',category:'race',starts_at:'2026-07-05T14:00',ends_at:'2026-07-05T16:00',status:'scheduled',published:true,description:'Fixture',session_title:'Race'};
const response=()=>Promise.resolve(new Response(JSON.stringify({id:'event'}),{status:200,headers:{'content-type':'application/json'}}));

describe('event mutation DTO',()=>{
  beforeEach(()=>{vi.stubGlobal('fetch',vi.fn(response));vi.stubGlobal('document',{cookie:'mse_admin_csrf=test-csrf'});vi.stubGlobal('window',{dispatchEvent:vi.fn()});});

  it('persiste race -> qualifying sans renommer la session ni transmettre le Meeting',async()=>{
    await saveEvent({...form,category:'qualifying',meeting_id:'meeting-1',meeting_name:'Singapore Grand Prix'} as EventFormState&{meeting_id:string;meeting_name:string},'event-1');
    const [url,init]=vi.mocked(fetch).mock.calls[0];const payload=JSON.parse(String(init?.body));
    expect(String(url)).toMatch(/\/api\/v1\/admin\/events\/event-1$/);expect(init?.method).toBe('PATCH');expect(payload).toMatchObject({category:'qualifying',name:'British Grand Prix',session_title:'Race'});
    expect(payload).not.toHaveProperty('meeting_id');expect(payload).not.toHaveProperty('meeting_name');
  });

  it('crée un Event manuel avec la catégorie practice',async()=>{
    await saveEvent({...form,category:'practice'});
    const [url,init]=vi.mocked(fetch).mock.calls[0];const payload=JSON.parse(String(init?.body));
    expect(String(url)).toMatch(/\/api\/v1\/admin\/events$/);expect(init?.method).toBe('POST');expect(payload.category).toBe('practice');
  });

  it('sérialise sprint_qualifying sans modifier l’intitulé de session',async()=>{
    await saveEvent({...form,category:'sprint_qualifying',session_title:'Sprint Shootout'},'event-1');
    const payload=JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(payload).toMatchObject({category:'sprint_qualifying',session_title:'Sprint Shootout',name:'British Grand Prix'});
  });

  it('ne renvoie pas une valeur historique non canonique tant qu’elle n’est pas remplacée',async()=>{
    await saveEvent({...form,category:'Grand Prix'},'event-1');
    const payload=JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));expect(payload).not.toHaveProperty('category');
  });
});
