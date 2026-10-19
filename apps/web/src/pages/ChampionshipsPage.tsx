import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { PageHeader, Panel, StatusChip as Pill } from '../design-system';
import { assetRegistry } from '../assets/assetRegistry';
import { adminAuthorization, notifyAuthenticationRequired } from '../lib/adminAuth';

const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');

type Championship = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  official_name: string | null;
  category: string | null;
  season: number;
  active: boolean;
  sync_enabled: boolean;
  provider_key: string | null;
  external_id: string | null;
  logo_url: string | null;
  description: string | null;
  event_count: number;
  updated_at: string;
};

type FormState = Omit<Championship, 'id' | 'event_count' | 'updated_at'>;
type Provider = { id: string; name: string; adapter_key: string };
const emptyForm = (): FormState => ({
  slug: '', name: '', short_name: '', official_name: '', category: '',
  season: new Date().getFullYear(), active: true, sync_enabled: false,
  provider_key: null, external_id: '', logo_url: '', description: ''
});

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(adminAuthorization())) headers.set(name, value);

  if (init.body !== undefined && init.body !== null) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  } else {
    headers.delete('Content-Type');
  }

  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers
  });

  if (!response.ok) {
    if (response.status === 401) notifyAuthenticationRequired();
    const payload = await response
      .json()
      .catch(() => ({ message: response.statusText }));

    throw new Error(payload.message ?? 'Une erreur est survenue.');
  }

  return response.status === 204
    ? (undefined as T)
    : response.json();
}

export function ChampionshipsPage() {
  const [rows, setRows] = useState<Championship[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Championship | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const championships = await request<Championship[]>('/api/v1/admin/championships');
      setRows(championships);
      try {
        setProviders(await request<Provider[]>('/api/v1/admin/providers'));
      } catch {
        setProviders([]);
      }
    }
    catch (error) { setMessage({ text: (error as Error).message, error: true }); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => rows.filter(row => {
    const text = `${row.name} ${row.slug} ${row.official_name ?? ''}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (status === 'all' || row.active === (status === 'active'));
  }), [rows, search, status]);

  function beginCreate() {
    setEditing(null); setForm(emptyForm()); setOpen(true); setMessage(null);
  }
  function beginEdit(row: Championship) {
    setEditing(row);
    setForm({
      slug: row.slug, name: row.name, short_name: row.short_name ?? '',
      official_name: row.official_name ?? '', category: row.category ?? '', season: row.season,
      active: row.active, sync_enabled: row.sync_enabled, provider_key: row.provider_key,
      external_id: row.external_id ?? '', logo_url: row.logo_url ?? '', description: row.description ?? ''
    });
    setOpen(true); setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const path = editing ? `/api/v1/championships/${editing.id}` : '/api/v1/championships';
      await request(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(form) });
      setOpen(false); await load();
      setMessage({ text: editing ? 'Championnat mis à jour.' : 'Championnat créé.' });
    } catch (error) { setMessage({ text: (error as Error).message, error: true }); }
    finally { setSaving(false); }
  }

  async function toggle(row: Championship) {
    try {
      await request(`/api/v1/championships/${row.id}`, { method: 'PATCH', body: JSON.stringify({ active: !row.active }) });
      await load(); setMessage({ text: `${row.name} est maintenant ${row.active ? 'inactif' : 'actif'}.` });
    } catch (error) { setMessage({ text: (error as Error).message, error: true }); }
  }

  async function remove(row: Championship) {
    if (!confirm(`Supprimer définitivement « ${row.name} » ?`)) return;
    try {
      await request(`/api/v1/championships/${row.id}`, { method: 'DELETE' });
      await load(); setMessage({ text: 'Championnat supprimé.' });
    } catch (error) { setMessage({ text: (error as Error).message, error: true }); }
  }

  const activeCount = rows.filter(row => row.active).length;
  const syncedCount = rows.filter(row => row.sync_enabled).length;
  const providerChoices = [...new Map(providers.map(provider => [provider.adapter_key, provider.name])).entries()];
  if (form.provider_key && !providerChoices.some(([key]) => key === form.provider_key)) {
    providerChoices.push([form.provider_key, `Provider enregistré (${form.provider_key})`]);
  }

  return <>
    <PageHeader title="CHAMPIONNATS" subtitle="Créez et configurez les championnats disponibles sur la plateforme" />
    {message && <div className={`lot3-notice ${message.error ? 'error' : ''}`}>{message.text}<button onClick={() => setMessage(null)}>×</button></div>}
    <div className="lot3-stats">
      <article><span>TOTAL</span><strong>{rows.length}</strong><small>championnats enregistrés</small></article>
      <article><span>ACTIFS</span><strong>{activeCount}</strong><small>visibles et exploitables</small></article>
      <article><span>SYNCHRONISÉS</span><strong>{syncedCount}</strong><small>liés à une source externe</small></article>
      <article><span>ÉVÉNEMENTS LIÉS</span><strong>{rows.reduce((sum, row) => sum + row.event_count, 0)}</strong><small>suppression protégée</small></article>
    </div>
    <div className="section-title">
      <h2>Référentiel des championnats</h2>
      <button className="danger" onClick={beginCreate}>+ Ajouter un championnat</button>
    </div>
    <div className="toolbar lot3-toolbar">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="⌕  Rechercher par nom, slug ou intitulé officiel..." />
      <select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="all">Tous les statuts</option><option value="active">Actifs</option><option value="inactive">Inactifs</option>
      </select>
      <span />
      <button onClick={() => void load()}>↻ Actualiser</button>
    </div>
    <Panel title="">
      {loading ? <div className="lot3-loading">Chargement des championnats…</div> :
      <table className="data-table lot3-table"><thead><tr>
        <th>CHAMPIONNAT</th><th>CATÉGORIE</th><th>SAISON</th><th>STATUT</th><th>SYNCHRONISATION</th><th>ÉVÉNEMENTS</th><th>ACTIONS</th>
      </tr></thead><tbody>
        {filtered.map(row => <tr key={row.id}>
          <td><div className="lot3-identity"><img className="lot3-logo" src={assetRegistry.championship(row.slug,row.logo_url).src} alt={assetRegistry.championship(row.slug,row.logo_url).alt} onError={(event)=>{event.currentTarget.src=assetRegistry.championship(row.slug,null).src}}/><div><strong>{row.name}</strong><small>{row.official_name || row.slug}</small></div></div></td>
          <td>{row.category || <span className="muted-text">Non définie</span>}</td>
          <td>{row.season}</td>
          <td><Pill text={row.active ? 'ACTIF' : 'INACTIF'} tone={row.active ? 'green' : 'muted'} /></td>
          <td>{row.sync_enabled ? <><Pill text="ACTIVÉE" tone="blue" /><small>{row.provider_key} · {row.external_id || 'identifiant absent'}</small></> : <Pill text="MANUELLE" tone="muted" />}</td>
          <td><strong>{row.event_count}</strong></td>
          <td><div className="lot3-actions"><button title="Modifier" onClick={() => beginEdit(row)}>✎</button><button title={row.active ? 'Désactiver' : 'Activer'} onClick={() => void toggle(row)}>{row.active ? '◉' : '○'}</button><button className="delete" title="Supprimer" onClick={() => void remove(row)}>⌫</button></div></td>
        </tr>)}
        {!filtered.length && <tr><td colSpan={7}><div className="lot3-empty">Aucun championnat ne correspond aux filtres.</div></td></tr>}
      </tbody></table>}
    </Panel>

    {open && <div className="lot3-modal-backdrop" onMouseDown={() => !saving && setOpen(false)}>
      <section className="lot3-modal" onMouseDown={e => e.stopPropagation()}>
        <header><div><small>LOT 3 · RÉFÉRENTIEL</small><h2>{editing ? 'Modifier le championnat' : 'Nouveau championnat'}</h2></div><button onClick={() => setOpen(false)}>×</button></header>
        <form onSubmit={submit}>
          <div className="lot3-form-grid">
            <label>Nom public *<input required minLength={2} value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></label>
            <label>Slug technique *<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={e => setForm({...form,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')})}/></label>
            <label>Nom court<input value={form.short_name ?? ''} onChange={e => setForm({...form,short_name:e.target.value})}/></label>
            <label>Saison<input type="number" min="1950" max="2200" value={form.season} onChange={e => setForm({...form,season:Number(e.target.value)})}/></label>
            <label className="wide">Intitulé officiel<input value={form.official_name ?? ''} onChange={e => setForm({...form,official_name:e.target.value})}/></label>
            <label>Catégorie facultative<input value={form.category ?? ''} onChange={e => setForm({...form,category:e.target.value})} placeholder="Ex. Rallye, Endurance…"/></label>
            <label>URL du logo<input type="url" value={form.logo_url ?? ''} onChange={e => setForm({...form,logo_url:e.target.value})}/></label>
            <label className="wide">Description<textarea rows={3} value={form.description ?? ''} onChange={e => setForm({...form,description:e.target.value})}/></label>
          </div>
          <fieldset><legend>Disponibilité</legend><label className="lot3-check"><input type="checkbox" checked={form.active} onChange={e => setForm({...form,active:e.target.checked})}/><span><b>Championnat actif</b><small>Autorise son utilisation dans les événements et les écrans d’administration.</small></span></label></fieldset>
          <fieldset><legend>Synchronisation externe</legend><label className="lot3-check"><input type="checkbox" checked={form.sync_enabled} disabled={!providerChoices.length} onChange={e => setForm({...form,sync_enabled:e.target.checked,provider_key:e.target.checked ? form.provider_key : null})}/><span><b>Activer la synchronisation</b><small>{providerChoices.length?'Le provider doit être choisi parmi les providers réellement configurés.':'Indisponible — aucun provider configuré.'}</small></span></label>
            {form.sync_enabled && <div className="lot3-form-grid inset"><label>Provider *<select required value={form.provider_key ?? ''} onChange={e => setForm({...form,provider_key:e.target.value||null})}><option value="">Sélectionner</option>{providerChoices.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><label>Identifiant externe<input value={form.external_id ?? ''} onChange={e => setForm({...form,external_id:e.target.value})}/></label></div>}
          </fieldset>
          <footer><button type="button" onClick={() => setOpen(false)}>Annuler</button><button className="danger" disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer le championnat'}</button></footer>
        </form>
      </section>
    </div>}
  </>;
}
