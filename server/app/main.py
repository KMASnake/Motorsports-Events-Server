from datetime import datetime, timezone
from html import escape
from urllib.parse import quote

from fastapi import Cookie, Depends, FastAPI, Form, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import BigInteger, and_, cast, func, or_
from sqlalchemy.orm import Session as OrmSession, joinedload

from .admin_extension import router as admin_extension_router
from .api.client_contract import (
    MAX_CURSOR_ID,
    InvalidCursor,
    change_payload,
    decode_cursor,
    encode_cursor,
    epoch_microseconds,
    event_payload,
    normalize_utc,
)
from .api.event_filters import EventFilters, parse_csv_values, session_is_visible
from .api.schemas import (
    ChangeFeedResponse,
    EventResponse,
    HealthResponse,
    SportResponse,
    VersionResponse,
)
from .config import get_settings
from .database import get_db
from .models import Event, ManualOverride, Session, Sport, SyncRun
from .schema_migrations import assert_schema_current
from .security import require_admin_key, require_public_key
from .sync_service import synchronize
from .version_info import version_payload

settings = get_settings()
assert_schema_current()

app = FastAPI(
    title=f"{settings.project_name} API",
    version="2.7.0-alpha.2",
    description=(
        f"Serveur central de {settings.project_name}. "
        "Le contrat /api/v1 reste rétrocompatible pendant toute la série 2.x."
    ),
)


def admin_cookie_valid(value: str | None) -> bool:
    return bool(value) and value == settings.admin_api_key


def require_admin_cookie(
    me_admin: str | None = Cookie(default=None),
) -> None:
    if not admin_cookie_valid(me_admin):
        raise HTTPException(status_code=401, detail="Authentification requise.")


def layout(title: str, content: str) -> str:
    project = escape(settings.project_name)
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)} — {project}</title>
<style>
:root{{--bg:#f3f5f8;--panel:#fff;--text:#1f2937;--muted:#667085;--accent:#b42318;
--ok:#067647;--warn:#b54708;--border:#d0d5dd}}
*{{box-sizing:border-box}}
body{{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--text)}}
header{{background:#111827;color:#fff;padding:15px 22px;display:flex;align-items:center;justify-content:space-between}}
header a{{color:#fff;text-decoration:none}}
nav a{{margin-left:18px}}
main{{max-width:1280px;margin:24px auto;padding:0 18px}}
.panel{{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:18px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}}
.metric{{background:#fff;border:1px solid var(--border);border-radius:10px;padding:16px}}
.metric strong{{display:block;font-size:28px;margin-top:6px}}
.muted{{color:var(--muted)}}
.ok{{color:var(--ok);font-weight:700}} .warn{{color:var(--warn);font-weight:700}}
table{{width:100%;border-collapse:collapse}} th,td{{padding:10px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}}
th{{background:#f9fafb}} code{{white-space:pre-wrap;overflow-wrap:anywhere}}
button,.button{{background:var(--accent);color:#fff;border:0;border-radius:7px;padding:9px 13px;cursor:pointer;text-decoration:none;display:inline-block}}
button.secondary{{background:#475467}} button.danger{{background:#b42318}}
input{{width:100%;padding:10px;border:1px solid var(--border);border-radius:7px}}
form.inline{{display:inline}} .flash{{padding:12px;border-radius:8px;background:#ecfdf3;border:1px solid #abefc6;margin-bottom:16px}}
</style>
</head>
<body>
<header><a href="/admin"><strong>{project}</strong></a>
<nav><a href="/admin">Tableau de bord</a>
<a href="/admin/temporal-issues">Incohérences horaires</a>
<a href="/admin/settings">Paramètres</a><a href="/docs">API</a>
<form class="inline" method="post" action="/admin/logout"><button class="secondary">Déconnexion</button></form></nav>
</header>
<main>{content}</main>
</body></html>"""


app.include_router(admin_extension_router)

@app.get("/")
def root():
    return {
        "name": settings.project_name,
        "version": "2.7.0-alpha.2",
        "docs": "/docs",
        "admin": "/admin",
    }



@app.get("/api/v1/version", response_model=VersionResponse)
def api_version():
    return version_payload()


@app.get("/api/v1/health", response_model=HealthResponse)
def health():
    return {"status": "ok", "time": datetime.now(timezone.utc)}


@app.get(
    "/api/v1/sports",
    dependencies=[Depends(require_public_key)],
    response_model=list[SportResponse],
)
def sports(db: OrmSession = Depends(get_db)):
    return db.query(Sport).filter_by(enabled=True).order_by(Sport.name).all()


@app.get(
    "/api/v1/events",
    dependencies=[Depends(require_public_key)],
    response_model=list[EventResponse],
)
def events(
    from_date: datetime | None = Query(default=None, alias="from"),
    to_date: datetime | None = Query(default=None, alias="to"),
    sports: str = "",
    season: int | None = None,
    session_types: str = "",
    categories: str = "",
    statuses: str = "",
    is_race: bool | None = None,
    include_cancelled: bool = True,
    include_deleted: bool = False,
    db: OrmSession = Depends(get_db),
):
    session_query = db.query(
        Session.event_id.label("event_id"),
        func.min(Session.start_at).label("first_start"),
    )

    if not include_deleted:
        session_query = session_query.filter(Session.deleted.is_(False))

    if from_date:
        session_query = session_query.filter(Session.end_at >= from_date)

    if to_date:
        session_query = session_query.filter(Session.start_at <= to_date)

    if season is not None:
        session_query = session_query.filter(
            func.extract("year", Session.start_at) == season
        )

    if session_types:
        session_query = session_query.filter(
            Session.session_type.in_(
                [item.strip() for item in session_types.split(",") if item.strip()]
            )
        )

    if categories:
        session_query = session_query.filter(
            Session.category.in_(
                [item.strip() for item in categories.split(",") if item.strip()]
            )
        )

    if statuses:
        session_query = session_query.filter(
            Session.status.in_(
                [item.strip() for item in statuses.split(",") if item.strip()]
            )
        )

    if is_race is not None:
        session_query = session_query.filter(Session.is_race.is_(is_race))

    if not include_cancelled:
        session_query = session_query.filter(
            func.lower(Session.status).notin_(
                ["cancelled", "canceled", "annulé", "annule"]
            )
        )

    matching_sessions = session_query.group_by(Session.event_id).subquery()
    query = (
        db.query(Event)
        .options(joinedload(Event.sessions))
        .join(
            matching_sessions,
            matching_sessions.c.event_id == Event.id,
        )
    )

    if sports:
        query = query.filter(
            Event.sport_id.in_(
                [item.strip() for item in sports.split(",") if item.strip()]
            )
        )

    rows = query.order_by(matching_sessions.c.first_start, Event.id).all()

    event_filters = EventFilters(
        from_date=from_date,
        to_date=to_date,
        season=season,
        session_types=parse_csv_values(session_types),
        categories=parse_csv_values(categories),
        statuses=parse_csv_values(statuses),
        is_race=is_race,
        include_cancelled=include_cancelled,
        include_deleted=include_deleted,
    )

    result = []

    for event in rows:
        visible_sessions = [
            session
            for session in event.sessions
            if session_is_visible(session, event_filters)
        ]

        if not visible_sessions:
            continue

        result.append(event_payload(event, visible_sessions))

    return result


@app.get(
    "/api/v1/events/changes",
    dependencies=[Depends(require_public_key)],
    response_model=ChangeFeedResponse,
)
def changes(
    since: datetime | None = Query(
        default=None,
        description="Compatibilité historique : date ISO 8601 du dernier appel.",
    ),
    cursor: str | None = Query(
        default=None,
        description="Curseur opaque retourné par l'appel précédent.",
    ),
    limit: int = Query(default=500, ge=1, le=1000),
    db: OrmSession = Depends(get_db),
):
    if since is None and cursor is None:
        raise HTTPException(
            status_code=422,
            detail="Le paramètre since ou cursor est obligatoire.",
        )
    if since is not None and cursor is not None:
        raise HTTPException(
            status_code=422,
            detail="Utilisez since ou cursor, pas les deux.",
        )

    latest_sync = db.query(SyncRun).order_by(SyncRun.id.desc()).first()
    sync_run_id = latest_sync.id if latest_sync is not None else 0

    if latest_sync is not None and latest_sync.status == "running":
        raise HTTPException(
            status_code=503,
            detail="Synchronisation en cours. Réessayez dans quelques instants.",
            headers={"Retry-After": "10"},
        )

    if cursor is not None:
        try:
            boundary = decode_cursor(cursor)
        except InvalidCursor as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if boundary.sync_run_id != sync_run_id:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Le curseur a été invalidé par une synchronisation. "
                    "Recommencez depuis le dernier since confirmé."
                ),
            )
        snapshot_at = boundary.snapshot_at
        updated_epoch = cast(
            func.extract("epoch", Session.updated_at) * 1_000_000,
            BigInteger,
        )
        boundary_epoch = epoch_microseconds(boundary.updated_at)
        snapshot_epoch = epoch_microseconds(snapshot_at)
        query = db.query(Session).filter(updated_epoch <= snapshot_epoch)
        query = query.filter(
            or_(
                updated_epoch > boundary_epoch,
                and_(
                    updated_epoch == boundary_epoch,
                    Session.id > boundary.row_id,
                ),
            )
        )
    else:
        snapshot_at = datetime.now(timezone.utc)
        updated_epoch = cast(
            func.extract("epoch", Session.updated_at) * 1_000_000,
            BigInteger,
        )
        query = db.query(Session).filter(
            updated_epoch <= epoch_microseconds(snapshot_at)
        )
        query = query.filter(
            updated_epoch > epoch_microseconds(since)
        )

    rows = query.order_by(updated_epoch, Session.id).limit(limit + 1).all()

    current_sync = db.query(SyncRun).order_by(SyncRun.id.desc()).first()
    current_sync_run_id = current_sync.id if current_sync is not None else 0
    if (
        current_sync_run_id != sync_run_id
        or (current_sync is not None and current_sync.status == "running")
    ):
        raise HTTPException(
            status_code=503,
            detail="Synchronisation démarrée pendant la lecture. Réessayez.",
            headers={"Retry-After": "10"},
        )
    has_more = len(rows) > limit
    page = rows[:limit]

    if has_more and page:
        next_at = normalize_utc(page[-1].updated_at)
        next_id = page[-1].id
    else:
        next_at = snapshot_at
        next_id = MAX_CURSOR_ID

    return {
        "updated": [change_payload(row) for row in page],
        "next_cursor": next_at,
        "cursor": encode_cursor(
            next_at,
            next_id,
            snapshot_at,
            sync_run_id,
        ),
        "has_more": has_more,
        "snapshot_at": snapshot_at,
    }


@app.post("/api/v1/admin/sync", dependencies=[Depends(require_admin_key)])
async def run_sync(db: OrmSession = Depends(get_db)):
    run = await synchronize(db)
    return {
        "id": run.id,
        "status": run.status,
        "created": run.created,
        "updated": run.updated,
        "errors": run.errors,
        "details": run.details,
    }


@app.get("/api/v1/admin/overrides", dependencies=[Depends(require_admin_key)])
def list_overrides(db: OrmSession = Depends(get_db)):
    return db.query(ManualOverride).order_by(
        ManualOverride.updated_at.desc()
    ).all()


@app.post("/api/v1/admin/overrides", dependencies=[Depends(require_admin_key)])
def save_override(payload: dict, db: OrmSession = Depends(get_db)):
    required = ["source", "source_event_id", "source_session_id", "sport_id"]
    if any(not payload.get(key) for key in required):
        raise HTTPException(status_code=422, detail="Identifiants incomplets.")

    row = db.query(ManualOverride).filter_by(
        source=payload["source"],
        source_event_id=payload["source_event_id"],
        source_session_id=payload["source_session_id"],
    ).one_or_none()

    if row is None:
        row = ManualOverride(
            source=payload["source"],
            source_event_id=payload["source_event_id"],
            source_session_id=payload["source_session_id"],
            sport_id=payload["sport_id"],
        )

    row.override_data = payload.get("override_data") or {}
    row.state = "active"
    row.active = True
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.delete("/api/v1/admin/overrides/{override_id}", dependencies=[Depends(require_admin_key)])
def delete_override(override_id: int, db: OrmSession = Depends(get_db)):
    row = db.get(ManualOverride, override_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Correction introuvable.")
    db.delete(row)
    db.commit()
    return {"deleted": True}


@app.get("/admin/login", response_class=HTMLResponse, include_in_schema=False)
def admin_login_page(error: str = ""):
    message = '<p class="warn">Clé incorrecte.</p>' if error else ""
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connexion — {escape(settings.project_name)}</title>
<style>body{{font-family:system-ui;background:#f3f5f8}}main{{max-width:430px;margin:12vh auto;background:white;padding:28px;border-radius:12px}}
input{{width:100%;padding:11px;margin:12px 0;border:1px solid #d0d5dd;border-radius:7px}}
button{{width:100%;padding:11px;background:#b42318;color:white;border:0;border-radius:7px}}</style>
</head><body><main><h1>{escape(settings.project_name)}</h1><p>Administration</p>{message}
<form method="post" action="/admin/login"><label>Clé administrateur</label>
<input type="password" name="admin_key" required autofocus><button>Se connecter</button></form>
</main></body></html>"""


@app.post("/admin/login", include_in_schema=False)
def admin_login(admin_key: str = Form(...)):
    if admin_key != settings.admin_api_key:
        return RedirectResponse("/admin/login?error=1", status_code=303)
    response = RedirectResponse("/admin", status_code=303)
    response.set_cookie(
        "me_admin",
        admin_key,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=8 * 3600,
    )
    return response


@app.post("/admin/logout", include_in_schema=False)
def admin_logout():
    response = RedirectResponse("/admin/login", status_code=303)
    response.delete_cookie("me_admin")
    return response


@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
def admin_dashboard(
    message: str = "",
    me_admin: str | None = Cookie(default=None),
    db: OrmSession = Depends(get_db),
):
    if not admin_cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)

    counts = {
        "sports": db.query(func.count(Sport.id)).scalar() or 0,
        "events": db.query(func.count(Event.id)).scalar() or 0,
        "sessions": db.query(func.count(Session.id)).filter(Session.deleted.is_(False)).scalar() or 0,
        "overrides": db.query(func.count(ManualOverride.id)).filter(ManualOverride.active.is_(True)).scalar() or 0,
        "temporal_issues": db.query(func.count(Session.id)).filter(
            Session.end_at < Session.start_at
        ).scalar() or 0,
    }

    sync_rows = db.query(SyncRun).order_by(SyncRun.started_at.desc()).limit(12).all()
    override_rows = db.query(ManualOverride).order_by(
        ManualOverride.updated_at.desc()
    ).limit(100).all()

    sync_html = "".join(
        "<tr>"
        f"<td>{row.id}</td><td>{escape(str(row.started_at))}</td>"
        f"<td>{escape(row.status)}</td><td>{row.created}</td>"
        f"<td>{row.updated}</td><td>{row.errors}</td>"
        f"<td><code>{escape(row.details or '')}</code></td>"
        "</tr>"
        for row in sync_rows
    ) or "<tr><td colspan='7'>Aucune synchronisation.</td></tr>"

    override_html = "".join(
        "<tr>"
        f"<td>{row.id}</td><td>{escape(row.sport_id)}</td>"
        f"<td>{escape(row.source)}</td><td>{escape(row.state)}</td>"
        f"<td><code>{escape(str(row.override_data))}</code></td>"
        "<td><form class='inline' method='post' "
        f"action='/admin/overrides/{row.id}/delete'>"
        "<button class='danger' onclick=\"return confirm('Supprimer cette correction ?')\">Supprimer</button>"
        "</form></td></tr>"
        for row in override_rows
    ) or "<tr><td colspan='6'>Aucune correction.</td></tr>"

    provider_rows = [
        (
            "OCBlackTop",
            settings.ocblacktop_enabled,
            settings.ocblacktop_base_url,
            ", ".join(settings.ocblacktop_sport_list) or "Aucun sport",
        ),
        (
            "TheSportsDB",
            settings.thesportsdb_enabled,
            settings.thesportsdb_base_url,
            ", ".join(f"{k}:{v}" for k, v in settings.thesportsdb_league_map.items()),
        ),
    ]
    providers_html = "".join(
        "<tr>"
        f"<td>{escape(name)}</td>"
        f"<td class='{'ok' if enabled else 'warn'}'>{'Activé' if enabled else 'Désactivé'}</td>"
        f"<td>{escape(url)}</td><td>{escape(details)}</td>"
        "</tr>"
        for name, enabled, url, details in provider_rows
    )

    flash = f"<div class='flash'>{escape(message)}</div>" if message else ""
    content = f"""
{flash}
<div class="grid">
<div class="metric"><span class="muted">Sports</span><strong>{counts['sports']}</strong></div>
<div class="metric"><span class="muted">Épreuves</span><strong>{counts['events']}</strong></div>
<div class="metric"><span class="muted">Séances</span><strong>{counts['sessions']}</strong></div>
<div class="metric"><span class="muted">Corrections actives</span><strong>{counts['overrides']}</strong></div>
<div class="metric"><span class="muted">Incohérences horaires</span>
<strong>{counts['temporal_issues']}</strong>
<a href="/admin/temporal-issues">Examiner et corriger</a></div>
</div>

<section class="panel"><h2>Version installée</h2>
<table>
<tr><th>Version</th><td>{escape(version_payload()['version'])}</td></tr>
<tr><th>Build</th><td>{escape(version_payload()['build'])}</td></tr>
<tr><th>Git</th><td>{escape(version_payload()['git_commit'])}</td></tr>
</table></section>

<section class="panel"><h2>Actions</h2>
<form method="post" action="/admin/sync"><button>Lancer une synchronisation</button></form>
<p class="muted">Saison {settings.sync_season} · mode {escape(settings.sync_import_mode)}
· intervalle {settings.sync_interval_minutes} minutes · {escape(settings.timezone)}</p></section>

<section class="panel"><h2>Providers</h2>
<table><thead><tr><th>Provider</th><th>État</th><th>URL</th><th>Configuration</th></tr></thead>
<tbody>{providers_html}</tbody></table></section>

<section class="panel"><h2>Historique des synchronisations</h2>
<table><thead><tr><th>ID</th><th>Début</th><th>État</th><th>Créés</th>
<th>Mis à jour</th><th>Erreurs</th><th>Détails</th></tr></thead>
<tbody>{sync_html}</tbody></table></section>

<section class="panel"><h2>Corrections manuelles</h2>
<table><thead><tr><th>ID</th><th>Sport</th><th>Source</th><th>État</th>
<th>Données</th><th>Action</th></tr></thead><tbody>{override_html}</tbody></table></section>
"""
    return layout("Administration", content)


@app.post("/admin/sync", include_in_schema=False)
async def admin_sync(
    me_admin: str | None = Cookie(default=None),
    db: OrmSession = Depends(get_db),
):
    if not admin_cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)
    run = await synchronize(db)
    message = quote(
        f"Synchronisation {run.status} : {run.created} créés, "
        f"{run.updated} mis à jour, {run.errors} erreur(s)."
    )
    return RedirectResponse(f"/admin?message={message}", status_code=303)


@app.post("/admin/overrides/{override_id}/delete", include_in_schema=False)
def admin_delete_override(
    override_id: int,
    me_admin: str | None = Cookie(default=None),
    db: OrmSession = Depends(get_db),
):
    if not admin_cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)
    row = db.get(ManualOverride, override_id)
    if row is not None:
        db.delete(row)
        db.commit()
    return RedirectResponse(
        "/admin?message=Correction%20supprim%C3%A9e.",
        status_code=303,
    )
