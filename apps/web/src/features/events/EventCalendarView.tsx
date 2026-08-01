import { buildCalendarDays } from './eventUtils';
import { eventColor } from './eventColors';
import type { Championship, EventRow } from './eventTypes';

interface Props {
  month: Date;
  events: EventRow[];
  championships: Championship[];
  selectedId: string | null;
  onSelect: (event: EventRow) => void;
  onCreateAt: (date: Date) => void;
  onMove: (event: EventRow, date: Date) => void;
}

const week = ['LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.', 'DIM.'];

export function EventCalendarView({ month, events, championships, selectedId, onSelect, onCreateAt, onMove }: Props) {
  const days = buildCalendarDays(month, events);
  return <section className="events-calendar" aria-label="Calendrier mensuel des événements">
    <div className="events-calendar-week">{week.map((day) => <b key={day}>{day}</b>)}</div>
    <div className="events-calendar-grid">
      {days.map((day) => <div key={day.key} className={day.inMonth ? '' : 'outside'} onDoubleClick={() => onCreateAt(day.date)} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{const found=events.find(x=>x.id===e.dataTransfer.getData('text/event-id'));if(found)onMove(found,day.date)}}>
        <button className="events-day-number" onClick={() => onCreateAt(day.date)} aria-label={`Créer un événement le ${day.date.toLocaleDateString('fr-FR')}`}>{day.date.getDate()}</button>
        {day.events.slice(0, 3).map((event) => <button
          key={event.id}
          draggable
          onDragStart={(e)=>e.dataTransfer.setData('text/event-id',event.id)}
          className={`events-calendar-chip status-${event.status}${selectedId === event.id ? ' selected' : ''}`}
          style={{ '--event-color': eventColor(event, championships) } as React.CSSProperties}
          onClick={(click) => { click.stopPropagation(); onSelect(event); }}
          aria-pressed={selectedId === event.id}
        >
          <strong>{event.championship_name}</strong>
          <span>{event.name}</span>
          <small>{event.category ?? (event.published ? 'Publié' : 'Privé')}</small>
          {event.correction_count ? <em title="Correction locale">✎ {event.correction_count}</em> : null}
        </button>)}
        {day.events.length > 3 && <small className="events-calendar-more">+ {day.events.length - 3} autre(s)</small>}
      </div>)}
    </div>
  </section>;
}
