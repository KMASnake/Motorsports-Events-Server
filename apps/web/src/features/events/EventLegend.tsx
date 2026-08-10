import { assetRegistry } from '../../assets/assetRegistry';
import { eventColor } from './eventColors';
import type { Championship, EventRow } from './eventTypes';

export function EventLegend({ events, championships }: {
  events: EventRow[];
  championships: Championship[];
}) {
  const entries = Array.from(new Map(events.map((event) => [event.championship_id, event])).values())
    .sort((left, right) => left.championship_name.localeCompare(right.championship_name, 'fr'));

  return <div className="events-legend" aria-label="Légende des couleurs du calendrier">
    <div className="events-legend-items">
      {entries.map((event) => <span key={event.championship_id}>
        <i style={{ '--legend-color': eventColor(event, championships) } as React.CSSProperties} />
        <img src={assetRegistry.championship(event.championship_slug,event.championship_logo_url).src} alt="" />
        <b>{event.championship_name}</b>
      </span>)}
      {!entries.length && <small>Aucun championnat visible</small>}
    </div>
  </div>;
}
