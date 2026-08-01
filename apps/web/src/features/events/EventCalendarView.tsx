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
}

const week = ['LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.', 'DIM.'];

export function EventCalendarView({ month, events, championships, selectedId, onSelect, onCreateAt }: Props) {
  const days = buildCalendarDays(month, events);
  return <section className="events-calendar" aria-label="Calendrier mensuel des événements">
    <div className="events-calendar-week">{week.map((day) => <b key={day}>{day}</b>)}</div>
    <div className="events-calendar-grid">
      {days.map((day) => <div key={day.key} className={day.inMonth ? '' : 'outside'} onDoubleClick={() => onCreateAt(day.date)}>
        <button className="events-day-number" onClick={() => onCreateAt(day.date)} aria-label={`Créer un événement le ${day.date.toLocaleDateString('fr-FR')}`}>{day.date.getDate()}</button>
        {day.events.slice(0, 3).map((event) => <button
          key={event.id}
          className={`events-calendar-chip status-${event.status}${selectedId === event.id ? ' selected' : ''}`}
          style={{ '--event-color': eventColor(event, championships) } as React.CSSProperties}
          onClick={(click) => { click.stopPropagation(); onSelect(event); }}
          aria-pressed={selectedId === event.id}
        >
          <strong>{event.championship_name}</strong>
          <span>{event.name}</span>
          <small>{event.category ?? (event.published ? 'Publié' : 'Privé')}</small>
        </button>)}
        {day.events.length > 3 && <small className="events-calendar-more">+ {day.events.length - 3} autre(s)</small>}
      </div>)}
    </div>
  </section>;
}
