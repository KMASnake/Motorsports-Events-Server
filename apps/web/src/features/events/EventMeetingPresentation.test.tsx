import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {EventCalendarView,editCalendarEvent} from './EventCalendarView';
import {EventDetailsPanel} from './EventDetailsPanel';
import {EventListView} from './EventListView';
import type {Championship,EventRow} from './eventTypes';

const championship:Championship={id:'f1',name:'Formule 1',short_name:'F1',slug:'formula-1',active:true};
const event:EventRow={id:'event-qualifying',championship_id:'f1',championship_name:'Formule 1',championship_slug:'formula-1',circuit_id:'marina-bay',circuit_name:'Marina Bay Street Circuit',circuit_city:'Singapore',country_code:'SG',meeting_id:'57000000-0000-4000-8000-000000000100',meeting_name:'Singapore Grand Prix',name:'Qualifying',slug:'qualifying',category:'qualifying',starts_at:'2026-10-10T13:00:00.000Z',ends_at:'2026-10-10T14:00:00.000Z',timezone:'UTC',status:'scheduled',published:true,origin:'provider',description:null,session_title:'Qualifying',provider_key:'ocblacktop'};

describe('présentation Meeting et session',()=>{
  it('distingue l’Épreuve et la session dans le détail et la liste',()=>{
    const details=renderToStaticMarkup(<EventDetailsPanel event={event} championships={[championship]} onEdit={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} onResize={vi.fn()}/>);
    const list=renderToStaticMarkup(<EventListView events={[event]} championships={[championship]} selectedId={event.id} onSelect={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onTogglePublication={vi.fn()}/>);
    for(const rendered of [details,list]){expect(rendered).toContain('Singapore Grand Prix');expect(rendered).toContain('Qualifying');}
  });

  it('présente la même distinction dans le calendrier',()=>{
    const rendered=renderToStaticMarkup(<EventCalendarView month={new Date('2026-10-01T00:00:00Z')} events={[event]} championships={[championship]} selectedId={event.id} onSelect={vi.fn()} onEdit={vi.fn()} onCreateAt={vi.fn()} onCreateRange={vi.fn()} onMove={vi.fn()}/>);
    expect(rendered).toContain('Singapore Grand Prix');expect(rendered).toContain('Qualifying');
  });

  it('conserve le double-clic comme action d’édition de l’Event existant',()=>{
    const onEdit=vi.fn(),click={stopPropagation:vi.fn()};editCalendarEvent(event,onEdit,click);
    expect(click.stopPropagation).toHaveBeenCalledOnce();expect(onEdit).toHaveBeenCalledWith(event);
  });
});
