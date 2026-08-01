import type { EventView } from './eventTypes';

export function EventsViewSwitcher({ value, onChange }: { value: EventView; onChange: (view: EventView) => void }) {
  return <div className="events-view-switcher" role="tablist" aria-label="Mode d’affichage des événements">
    {([['month','Mois'],['week','Semaine'],['day','Jour'],['agenda','Agenda'],['list','Liste']] as const).map(([key,label]) =>
      <button key={key} role="tab" aria-selected={value === key} onClick={() => onChange(key)}>{label}</button>)}
  </div>;
}
