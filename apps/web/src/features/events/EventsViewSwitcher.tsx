import type { EventView } from './eventTypes';

export function EventsViewSwitcher({ value, onChange }: { value: EventView; onChange: (view: EventView) => void }) {
  return <div className="events-view-switcher" role="tablist" aria-label="Mode d’affichage des événements">
    <button role="tab" aria-selected={value === 'calendar'} onClick={() => onChange('calendar')}>Mois</button>
    <button role="tab" aria-selected={value === 'list'} onClick={() => onChange('list')}>Liste</button>
  </div>;
}
