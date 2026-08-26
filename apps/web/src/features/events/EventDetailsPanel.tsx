import { StatusChip as Pill } from '../../design-system';
import { eventColor } from './eventColors';
import { eventPresentationStatus, fullDate } from './eventUtils';
import type { Championship, EventRow } from './eventTypes';
import { assetRegistry } from '../../assets/assetRegistry';
import { providerLabel } from './providerDisplay';

interface Props {
  event: EventRow | null;
  championships: Championship[];
  onEdit: (event: EventRow) => void;
  onDuplicate: (event: EventRow) => void;
  onDelete: (event: EventRow) => void;
  onResize: (event: EventRow, end: Date) => void;
}

export function EventDetailsPanel({ event, championships, onEdit, onDuplicate, onDelete, onResize }: Props) {
  if (!event) return <aside className="event-details empty-details"><span>◫</span><h3>Aucun événement sélectionné</h3><p>Sélectionnez un bloc du calendrier ou une ligne de la liste.</p></aside>;
  return <aside className="event-details" style={{ '--event-color': eventColor(event, championships) } as React.CSSProperties}>
    <header><small>DÉTAIL DE L’ÉVÉNEMENT</small><Pill text={event.published ? 'PUBLIÉ' : 'PRIVÉ'} tone={event.published ? 'green' : 'muted'} /></header>
    <div className="event-details-identity"><img src={assetRegistry.championship(event.championship_slug,event.championship_logo_url).src} alt={assetRegistry.championship(event.championship_slug,event.championship_logo_url).alt}/><div><small>{event.championship_name}</small><h3>{event.name}</h3></div></div>
    <dl>
      <div><dt>Championnat</dt><dd>{event.championship_name}</dd></div>
      <div><dt>Circuit</dt><dd>{event.circuit_name ?? 'Non défini'}<small>{assetRegistry.country(event.country_code).src?<img className="country-flag" src={assetRegistry.country(event.country_code).src!} alt={assetRegistry.country(event.country_code).alt}/>:<b className="country-badge">{assetRegistry.country(event.country_code).label}</b>} {event.circuit_city}</small></dd></div>
      <div><dt>Début</dt><dd>{fullDate(event.starts_at)}</dd></div>
      <div><dt>Fin</dt><dd>{event.ends_at ? fullDate(event.ends_at) : 'Non définie'}</dd></div>
      <div><dt>Fuseau</dt><dd>{event.timezone}</dd></div>
      <div><dt>Catégorie</dt><dd>{event.category ?? 'Non définie'}</dd></div>
      <div><dt>Intitulé de session</dt><dd>{event.session_title ?? 'Non défini'}</dd></div>
      <div><dt>Statut affiché</dt><dd>{eventPresentationStatus(event)==='completed'?'Terminé':eventPresentationStatus(event)==='scheduled'?'À venir':eventPresentationStatus(event)==='cancelled'?'Annulé':eventPresentationStatus(event)==='postponed'?'Reporté':'Brouillon'}</dd></div>
      <div><dt>Fournisseur</dt><dd>{providerLabel(event.origin,event.provider_key)}</dd></div>
    </dl>
    {event.description && <p className="event-details-description">{event.description}</p>}
    {event.correction_count ? <div className="event-correction-badge">✎ Corrigé · {event.correction_count} champ(s)</div> : null}
    <footer><button className="danger" onClick={() => onEdit(event)}>Modifier</button><button onClick={() => onDuplicate(event)}>Dupliquer</button><span className="event-resize" aria-label="Redimensionner visuellement la durée"><button disabled={!event.ends_at || new Date(event.ends_at).getTime()-new Date(event.starts_at).getTime()<30*60000} onClick={()=>onResize(event,new Date(new Date(event.ends_at??event.starts_at).getTime()-30*60000))}>−30 min</button><button onClick={()=>onResize(event,new Date(new Date(event.ends_at??event.starts_at).getTime()+30*60000))}>+30 min</button></span><button className="delete" onClick={() => onDelete(event)}>Supprimer</button></footer>
  </aside>;
}
