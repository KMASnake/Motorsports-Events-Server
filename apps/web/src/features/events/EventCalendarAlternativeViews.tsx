import { fullDate } from './eventUtils';
import type { EventRow, EventView } from './eventTypes';
import { assetRegistry } from '../../assets/assetRegistry';

export function EventCalendarAlternativeViews({ view, date, events, selectedId, onSelect, onEdit, onMove, onCreateAt }: {
  view: Exclude<EventView, 'month' | 'list'>; date: Date; events: EventRow[]; selectedId: string | null;
  onSelect: (event: EventRow) => void; onEdit: (event: EventRow) => void; onMove: (event: EventRow, date: Date) => void; onCreateAt: (date: Date) => void;
}) {
  const start = new Date(date); start.setHours(0,0,0,0);
  if (view === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const days = view === 'week' ? 7 : view === 'day' ? 1 : 30;
  const visible = events.filter((event) => {
    const value = new Date(event.starts_at); return value >= start && value < new Date(start.getTime() + days * 86400000);
  });
  if (view === 'agenda') return <section className="events-agenda" aria-label="Agenda des événements">
    {visible.length ? visible.map((event) => <button key={event.id} className={selectedId === event.id ? 'selected' : ''} onClick={() => onSelect(event)} onDoubleClick={()=>onEdit(event)}>
      <time>{fullDate(event.starts_at)}</time><strong>{event.meeting_name ?? event.name}<small>{event.session_title ?? (event.meeting_name ? event.name : '')}</small></strong><span className="event-agenda-brand"><img src={assetRegistry.championship(event.championship_slug,event.championship_logo_url).src} alt=""/>{event.championship_name}{assetRegistry.country(event.country_code).src&&<img src={assetRegistry.country(event.country_code).src!} alt={assetRegistry.country(event.country_code).alt}/>}</span>{event.correction_count ? <b>Corrigé · {event.correction_count}</b> : null}
    </button>) : <p>Aucun événement dans cette période.</p>}
  </section>;
  return <section className={`events-time-grid ${view}`}>
    {Array.from({length: days}, (_, index) => { const day = new Date(start); day.setDate(start.getDate()+index); return <div key={day.toISOString()} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{const found=events.find(x=>x.id===e.dataTransfer.getData('text/event-id')); if(found){const next=new Date(day);next.setHours(new Date(found.starts_at).getHours(),new Date(found.starts_at).getMinutes());onMove(found,next);}}}>
      <header><button onClick={()=>onCreateAt(day)}>+ {day.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}</button></header>
      {visible.filter((event)=>new Date(event.starts_at).toDateString()===day.toDateString()).map((event)=><button draggable key={event.id} className={selectedId===event.id?'selected':''} onDragStart={(e)=>e.dataTransfer.setData('text/event-id',event.id)} onClick={()=>onSelect(event)} onDoubleClick={()=>onEdit(event)}><span className="event-time-brand"><img src={assetRegistry.championship(event.championship_slug,event.championship_logo_url).src} alt=""/>{assetRegistry.country(event.country_code).src&&<img className="event-chip-flag" src={assetRegistry.country(event.country_code).src!} alt={assetRegistry.country(event.country_code).alt}/>}</span><time>{new Date(event.starts_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</time><strong>{event.meeting_name ?? event.name}</strong><small>{event.session_title ?? (event.meeting_name ? event.name : '')}</small></button>)}
    </div>})}
  </section>;
}
