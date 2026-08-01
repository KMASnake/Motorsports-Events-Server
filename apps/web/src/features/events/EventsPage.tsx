import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PageHeader } from '../../design-system';
import { deleteEvent, loadEventWorkspace, patchEvent, saveEvent, setEventPublication } from './eventApi';
import { EventCalendarView } from './EventCalendarView';
import { EventDetailsPanel } from './EventDetailsPanel';
import { EventEditorDialog } from './EventEditorDialog';
import { EventListView } from './EventListView';
import { EventsFilters } from './EventsFilters';
import { EventsViewSwitcher } from './EventsViewSwitcher';
import { EventCalendarAlternativeViews } from './EventCalendarAlternativeViews';
import { EventLegend } from './EventLegend';
import { calendarPeriodLabel, emptyEventForm, eventToForm, filterEvents, formDateForDay, moveEvent, navigateCalendarDate, overlappingEvents, resizeEvent, slugify } from './eventUtils';
import type { Championship, Circuit, EventFiltersState, EventFormState, EventRow, EventView } from './eventTypes';
import { availableProviderOptions } from './providerDisplay';

const defaultFilters: EventFiltersState = { search: '', championship: 'all', status: 'all', publication: 'all', provider: 'all' };
const initialView = (): EventView => ['month','week','day','agenda','list'].includes(sessionStorage.getItem('mse-events-view') ?? '') ? sessionStorage.getItem('mse-events-view') as EventView : 'month';

export function EventsPage() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [view, setView] = useState<EventView>(initialView);
  const [month, setMonth] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyEventForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const workspace = await loadEventWorkspace();
      setRows(workspace.events); setChampionships(workspace.championships); setCircuits(workspace.circuits);
      setSelectedId((current) => current && workspace.events.some((event) => event.id === current) ? current : workspace.events[0]?.id ?? null);
    } catch (error) { setMessage({ text: (error as Error).message, error: true }); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => filterEvents(rows, filters), [rows, filters]);
  const providers = useMemo(() => availableProviderOptions(rows), [rows]);
  const selected = rows.find((event) => event.id === selectedId) ?? null;
  const conflicts = useMemo(() => new Set(overlappingEvents(filtered).map((event)=>event.id)), [filtered]);

  function changeView(next: EventView) { setView(next); sessionStorage.setItem('mse-events-view', next); }
  function startCreate(date?: Date) {
    setEditing(null);
    setForm({ ...emptyEventForm(), championship_id: championships.find((item) => item.active)?.id ?? '', starts_at: date ? formDateForDay(date) : '' });
    setFormError(null); setEditorOpen(true);
  }
  function startEdit(event: EventRow) { setEditing(event); setForm(eventToForm(event)); setFormError(null); setEditorOpen(true); }
  function startDuplicate(event: EventRow) {
    const copy = eventToForm(event);
    setEditing(null); setForm({ ...copy, name: `${copy.name} — copie`, slug: `${copy.slug}-copie-${Date.now().toString(36)}`, published:false, origin:'manual' }); setFormError(null); setEditorOpen(true);
  }
  function changeName(name: string) { setForm((current) => ({ ...current, name, slug: editing ? current.slug : slugify(name) })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.ends_at && new Date(form.ends_at) < new Date(form.starts_at)) { setFormError('La date de fin doit être postérieure ou égale à la date de début.'); return; }
    setSaving(true); setFormError(null);
    try { await saveEvent(form, editing?.id); setEditorOpen(false); await load(); setMessage({ text: editing ? 'Événement mis à jour.' : 'Événement créé.' }); }
    catch (error) { setFormError((error as Error).message); }
    finally { setSaving(false); }
  }
  async function togglePublication(event: EventRow) {
    try { await setEventPublication(event, !event.published); await load(); setMessage({ text: event.published ? 'Événement retiré de l’API publique.' : 'Événement publié dans l’API publique.' }); }
    catch (error) { setMessage({ text: (error as Error).message, error: true }); }
  }
  async function move(event: EventRow, day: Date) {
    const previous = rows; const source = new Date(event.starts_at); const next = new Date(day); next.setHours(source.getHours(), source.getMinutes(), 0, 0);
    const optimistic = moveEvent(event, next); setRows((current)=>current.map((row)=>row.id===event.id?optimistic:row));
    try { await patchEvent(event.id,optimistic.ends_at ? { starts_at: optimistic.starts_at, ends_at: optimistic.ends_at } : { starts_at: optimistic.starts_at }); setMessage({text:'Événement déplacé.'}); }
    catch(error){ setRows(previous); setMessage({text:`Déplacement annulé : ${(error as Error).message}`,error:true}); }
  }
  async function resize(event:EventRow,end:Date){const previous=rows;const optimistic=resizeEvent(event,end);setRows((current)=>current.map((row)=>row.id===event.id?optimistic:row));try{await patchEvent(event.id,{ends_at:optimistic.ends_at??''});setMessage({text:'Durée mise à jour.'})}catch(error){setRows(previous);setMessage({text:`Redimensionnement annulé : ${(error as Error).message}`,error:true})}}
  async function remove(event: EventRow) {
    if (!confirm(`Supprimer définitivement « ${event.name} » ?`)) return;
    try { await deleteEvent(event.id); await load(); setMessage({ text: 'Événement supprimé.' }); }
    catch (error) { setMessage({ text: (error as Error).message, error: true }); }
  }

  return <>
    <PageHeader title="ÉVÉNEMENTS" subtitle="Calendrier global des événements et sessions" />
    {message && <div className={`lot3-notice ${message.error ? 'error' : ''}`} role="status">{message.text}<button onClick={() => setMessage(null)}>×</button></div>}
    <div className="events-section-title"><h2>Calendrier des événements</h2></div>
    <div className="events-toolbar-main">
      <div className="events-month-nav"><button onClick={() => setMonth((current) => navigateCalendarDate(current, view, -1))} aria-label="Période précédente">‹</button><button onClick={() => setMonth(new Date())}>Aujourd’hui</button><button onClick={() => setMonth((current) => navigateCalendarDate(current, view, 1))} aria-label="Période suivante">›</button><h2>{calendarPeriodLabel(month, view)}</h2></div>
      <EventsViewSwitcher value={view} onChange={changeView} />
      <button className="danger" onClick={() => startCreate()}>+ Nouvel événement</button>
    </div>
    <EventsFilters value={filters} championships={championships} providers={providers} onChange={setFilters} onRefresh={() => void load()} />
    {loading ? <div className="events-loading">Chargement des événements…</div> : <div className="events-workspace">
      <main>{view === 'month'
        ? <><EventCalendarView month={month} events={filtered} championships={championships} selectedId={selectedId} onSelect={(event) => setSelectedId(event.id)} onCreateAt={startCreate} onMove={(event,date)=>void move(event,date)} /><EventLegend events={filtered} championships={championships} /></>
        : view === 'list' ? <EventListView events={filtered} championships={championships} selectedId={selectedId} onSelect={(event) => setSelectedId(event.id)} onEdit={startEdit} onDelete={(event) => void remove(event)} onTogglePublication={(event) => void togglePublication(event)} />
        : <EventCalendarAlternativeViews view={view} date={month} events={filtered} selectedId={selectedId} onSelect={(event)=>setSelectedId(event.id)} onMove={(event,date)=>void move(event,date)} onCreateAt={startCreate}/>}
      </main>
      <EventDetailsPanel event={selected} championships={championships} onEdit={startEdit} onDuplicate={startDuplicate} onDelete={(event) => void remove(event)} onResize={(event,end)=>void resize(event,end)} />
    </div>}
    {conflicts.size > 0 && <div className="events-conflict-warning" role="alert">⚠ {conflicts.size} événement(s) publié(s) se chevauchent sur un même circuit.</div>}
    <div className="events-selection-bar"><span>{selected ? `1 sélectionné · ${selected.name}` : '0 sélectionné'}</span><button disabled={!selected} onClick={() => selected && startEdit(selected)}>Modifier</button><button onClick={() => void load()}>↻ Synchroniser l’affichage</button><b>{filtered.length} événement(s)</b></div>
    <EventEditorDialog open={editorOpen} editing={Boolean(editing)} saving={saving} value={form} championships={championships} circuits={circuits} error={formError} onChange={setForm} onNameChange={changeName} onClose={() => setEditorOpen(false)} onSubmit={submit} />
  </>;
}
