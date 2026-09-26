import { useEffect, useMemo, useState } from 'react';
import { StatusChip as Pill } from '../../design-system';
import { eventColor } from './eventColors';
import { eventPage, eventPresentationStatus, fullDate, sortEventList, type EventListSortDirection, type EventListSortKey } from './eventUtils';
import type { Championship, EventRow } from './eventTypes';
import { providerLabel } from './providerDisplay';

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
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: EventListSortKey; direction: EventListSortDirection }>({ key: 'starts_at', direction: 'nearest' });
  const ordered = useMemo(() => sortEventList(events, sort.key, sort.direction), [events, sort]);
  const pageCount = Math.max(1, Math.ceil(ordered.length / 25));
  const visible = eventPage(ordered, Math.min(page, pageCount));
  useEffect(() => setPage(1), [events]);

  function changeSort(key: EventListSortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
    setPage(1);
  }

  function sortLabel(key: EventListSortKey) {
    if (sort.key !== key) return '';
    if (sort.direction === 'nearest') return ' ◉';
    return sort.direction === 'asc' ? ' ↑' : ' ↓';
  }

  const header = (key: EventListSortKey, label: string) => <button
    type="button"
    className={sort.key === key ? 'active' : ''}
    aria-label={`Trier par ${label}`}
    onClick={() => changeSort(key)}
  >{label}{sortLabel(key)}</button>;

  return <div className="events-list-wrap">
    <div className="events-list-head">{header('starts_at', 'DATE ET HEURE')}{header('name', 'ÉVÉNEMENT')}{header('championship', 'CHAMPIONNAT')}{header('circuit', 'CIRCUIT')}{header('status', 'STATUT')}{header('publication', 'API')}<b>ACTIONS</b></div>
    <div className="events-list">
      {visible.map((event) => {const visualStatus=eventPresentationStatus(event);return <article key={event.id} className={selectedId === event.id ? 'selected' : ''} onClick={() => onSelect(event)} onDoubleClick={()=>onEdit(event)}>
        <time><strong>{fullDate(event.starts_at)}</strong><small>{event.timezone}</small></time>
        <div className="events-list-name"><i style={{ background: eventColor(event, championships) }}>{event.championship_name.slice(0, 3).toUpperCase()}</i><span><strong>{event.meeting_name ?? event.name}</strong><small>{event.session_title || (event.meeting_name ? event.name : event.category || event.slug)}</small></span></div>
        <div><strong>{event.championship_name}</strong><small>{providerLabel(event.origin,event.provider_key)}</small></div>
        <div><strong>{event.circuit_name || 'Circuit non défini'}</strong><small>{[event.circuit_city, event.country_code].filter(Boolean).join(' · ') || event.timezone}</small></div>
        <Pill text={statusMeta[visualStatus].text} tone={statusMeta[visualStatus].tone} />
        <button className={`events-publish ${event.published ? 'on' : ''}`} onClick={(click) => { click.stopPropagation(); onTogglePublication(event); }}>{event.published ? 'PUBLIÉ' : 'PRIVÉ'}</button>
        <div className="events-row-actions"><button title="Modifier" onClick={(click) => { click.stopPropagation(); onEdit(event); }}>✎</button><button className="delete" title="Supprimer" onClick={(click) => { click.stopPropagation(); onDelete(event); }}>⌫</button></div>
      </article>})}
      {!events.length && <div className="events-empty">Aucun événement ne correspond aux filtres.</div>}
    </div>
    {events.length > 0 && <nav className="events-pagination" aria-label="Pagination des événements">
      <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹ Précédente</button>
      <span>Page <b>{Math.min(page, pageCount)}</b> sur <b>{pageCount}</b> · {events.length} événements</span>
      <button disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Suivante ›</button>
    </nav>}
  </div>;
}
