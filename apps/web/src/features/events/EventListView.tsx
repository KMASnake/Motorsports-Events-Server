import { StatusChip as Pill } from '../../design-system';
import { eventColor } from './eventColors';
import { fullDate } from './eventUtils';
import type { Championship, EventRow } from './eventTypes';

const statusMeta = {
  draft: { text: 'BROUILLON', tone: 'muted' }, scheduled: { text: 'À VENIR', tone: 'blue' },
  completed: { text: 'TERMINÉ', tone: 'green' }, cancelled: { text: 'ANNULÉ', tone: 'red' },
  postponed: { text: 'REPORTÉ', tone: 'amber' }
} as const;

interface Props {
  events: EventRow[];
  championships: Championship[];
  selectedId: string | null;
  onSelect: (event: EventRow) => void;
  onEdit: (event: EventRow) => void;
  onDelete: (event: EventRow) => void;
  onTogglePublication: (event: EventRow) => void;
}

export function EventListView({ events, championships, selectedId, onSelect, onEdit, onDelete, onTogglePublication }: Props) {
  return <div className="events-list-wrap">
    <div className="events-list-head"><b>DATE ET HEURE</b><b>ÉVÉNEMENT</b><b>CHAMPIONNAT</b><b>CIRCUIT</b><b>STATUT</b><b>API</b><b>ACTIONS</b></div>
    <div className="events-list">
      {events.map((event) => <article key={event.id} className={selectedId === event.id ? 'selected' : ''} onClick={() => onSelect(event)}>
        <time><strong>{fullDate(event.starts_at)}</strong><small>{event.timezone}</small></time>
        <div className="events-list-name"><i style={{ background: eventColor(event, championships) }}>{event.championship_name.slice(0, 3).toUpperCase()}</i><span><strong>{event.name}</strong><small>{event.category || event.slug}</small></span></div>
        <div><strong>{event.championship_name}</strong><small>{event.origin === 'manual' ? 'Gestion manuelle' : event.origin === 'mixed' ? 'Gestion hybride' : 'Synchronisé'}</small></div>
        <div><strong>{event.circuit_name || 'Circuit non défini'}</strong><small>{[event.circuit_city, event.country_code].filter(Boolean).join(' · ') || event.timezone}</small></div>
        <Pill text={statusMeta[event.status].text} tone={statusMeta[event.status].tone} />
        <button className={`events-publish ${event.published ? 'on' : ''}`} onClick={(click) => { click.stopPropagation(); onTogglePublication(event); }}>{event.published ? 'PUBLIÉ' : 'PRIVÉ'}</button>
        <div className="events-row-actions"><button title="Modifier" onClick={(click) => { click.stopPropagation(); onEdit(event); }}>✎</button><button className="delete" title="Supprimer" onClick={(click) => { click.stopPropagation(); onDelete(event); }}>⌫</button></div>
      </article>)}
      {!events.length && <div className="events-empty">Aucun événement ne correspond aux filtres.</div>}
    </div>
  </div>;
}
