import { StatusChip as Pill } from '../../design-system';
import { eventColor } from './eventColors';
import { fullDate } from './eventUtils';
import type { Championship, EventRow } from './eventTypes';

interface Props {
  event: EventRow | null;
  championships: Championship[];
  onEdit: (event: EventRow) => void;
  onDuplicate: (event: EventRow) => void;
  onDelete: (event: EventRow) => void;
}

export function EventDetailsPanel({ event, championships, onEdit, onDuplicate, onDelete }: Props) {
  if (!event) return <aside className="event-details empty-details"><span>◫</span><h3>Aucun événement sélectionné</h3><p>Sélectionnez un bloc du calendrier ou une ligne de la liste.</p></aside>;
  return <aside className="event-details" style={{ '--event-color': eventColor(event, championships) } as React.CSSProperties}>
    <header><small>DÉTAIL DE L’ÉVÉNEMENT</small><Pill text={event.published ? 'PUBLIÉ' : 'PRIVÉ'} tone={event.published ? 'green' : 'muted'} /></header>
    <div className="event-details-identity"><i>{event.championship_name.slice(0, 3).toUpperCase()}</i><div><small>{event.championship_name}</small><h3>{event.name}</h3></div></div>
    <dl>
      <div><dt>Championnat</dt><dd>{event.championship_name}</dd></div>
      <div><dt>Circuit</dt><dd>{event.circuit_name ?? 'Non défini'}<small>{[event.circuit_city, event.country_code].filter(Boolean).join(' · ')}</small></dd></div>
      <div><dt>Début</dt><dd>{fullDate(event.starts_at)}</dd></div>
      <div><dt>Fin</dt><dd>{event.ends_at ? fullDate(event.ends_at) : 'Non définie'}</dd></div>
      <div><dt>Fuseau</dt><dd>{event.timezone}</dd></div>
      <div><dt>Catégorie</dt><dd>{event.category ?? 'Non définie'}</dd></div>
      <div><dt>Statut</dt><dd>{event.status}</dd></div>
      <div><dt>Origine administrative</dt><dd>{event.origin}</dd></div>
    </dl>
    {event.description && <p className="event-details-description">{event.description}</p>}
    <footer><button className="danger" onClick={() => onEdit(event)}>Modifier</button><button onClick={() => onDuplicate(event)}>Dupliquer</button><button className="delete" onClick={() => onDelete(event)}>Supprimer</button></footer>
  </aside>;
}
