import {beforeEach,describe,expect,it,vi} from 'vitest';
import {saveEvent} from './eventApi';
import type {EventFormState} from './eventTypes';

const form:EventFormState={championship_id:'f1',circuit_id:'silverstone',name:'British Grand Prix',starts_at:'2026-07-05T14:00',ends_at:'2026-07-05T16:00',status:'scheduled',published:true,description:'Fixture',session_title:'Race'};
const response=()=>Promise.resolve(new Response(JSON.stringify({id:'event'}),{status:200,headers:{'content-type':'application/json'}}));

describe('event mutation DTO',()=>{
  beforeEach(()=>{vi.stubGlobal('fetch',vi.fn(response));vi.stubGlobal('document',{cookie:'mse_admin_csrf=test-csrf'});vi.stubGlobal('window',{dispatchEvent:vi.fn()});});

  it('préserve une catégorie existante en l’omettant du PATCH',async()=>{
    await saveEvent({...form,category:'Grand Prix'} as EventFormState&{category:string},'event-1');
    const [url,init]=vi.mocked(fetch).mock.calls[0];const payload=JSON.parse(String(init?.body));
    expect(String(url)).toMatch(/\/api\/v1\/admin\/events\/event-1$/);expect(init?.method).toBe('PATCH');expect(payload).not.toHaveProperty('category');
  });

  it('crée un Event sans inventer de catégorie',async()=>{
    await saveEvent(form);
    const [url,init]=vi.mocked(fetch).mock.calls[0];const payload=JSON.parse(String(init?.body));
    expect(String(url)).toMatch(/\/api\/v1\/admin\/events$/);expect(init?.method).toBe('POST');expect(payload).not.toHaveProperty('category');
  });
});
