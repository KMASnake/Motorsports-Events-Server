from __future__ import annotations

import io
import json
import os
import platform
import re
import socket
from pathlib import Path
from html import escape
from urllib.parse import quote, urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import psutil
import qrcode
from fastapi import APIRouter, Cookie, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy import text
from sqlalchemy.orm import Session as OrmSession

from .application.temporal_corrections import (
    correct_session_timing,
    temporal_anomalies,
)
from .admin.audit import record_admin_action
from .config import get_settings
from .database import engine, get_db
from .domain.temporal_consistency import (
    format_admin_datetime,
    parse_admin_datetime,
)
from .infrastructure.env_file import read_env_file, write_env_updates
from .provider_tests import test_ocblacktop, test_thesportsdb
from .security import require_admin_key

router = APIRouter()
settings = get_settings()

EDITABLE_ENV_FIELDS = (
    ("PROJECT_NAME", "Nom du projet", "text"),
    ("ADMIN_API_KEY", "Clé administrateur", "secret"),
    ("PUBLIC_API_KEY", "Clé API publique", "secret"),
    ("API_DOMAIN", "Domaine HTTPS", "text"),
    ("ACME_EMAIL", "Email ACME", "email"),
    ("API_BIND_PORT", "Port local de l’API", "number"),
    ("OCBLACKTOP_ENABLED", "Activer OCBlackTop", "boolean"),
    ("OCBLACKTOP_BASE_URL", "URL OCBlackTop", "url"),
    ("OCBLACKTOP_API_KEY", "Clé OCBlackTop", "secret"),
    ("OCBLACKTOP_SPORTS", "Sports OCBlackTop", "text"),
    ("THESPORTSDB_ENABLED", "Activer TheSportsDB", "boolean"),
    ("THESPORTSDB_BASE_URL", "URL TheSportsDB", "url"),
    ("THESPORTSDB_API_KEY", "Clé TheSportsDB", "secret"),
    ("THESPORTSDB_LEAGUES", "Ligues TheSportsDB", "text"),
    ("SYNC_INTERVAL_MINUTES", "Intervalle de synchronisation", "number"),
    ("SYNC_SEASON", "Saison synchronisée", "number"),
    ("SYNC_IMPORT_MODE", "Mode d’import", "text"),
    ("TIMEZONE", "Fuseau horaire", "text"),
    ("LOG_LEVEL", "Niveau de logs", "text"),
)
SECRET_ENV_FIELDS = {
    "ADMIN_API_KEY",
    "PUBLIC_API_KEY",
    "OCBLACKTOP_API_KEY",
    "THESPORTSDB_API_KEY",
}
BOOLEAN_ENV_FIELDS = {"OCBLACKTOP_ENABLED", "THESPORTSDB_ENABLED"}
PROTECTED_ENV_FIELDS = (
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
)


def cookie_valid(value: str | None) -> bool:
    return bool(value) and value == settings.admin_api_key


def base_url() -> str:
    domain = os.getenv("API_DOMAIN", "").strip()
    return f"https://{domain}" if domain else "http://localhost:8088"


def admin_env_path() -> Path:
    return Path(os.getenv("ADMIN_ENV_FILE", ".env"))


def validate_env_updates(
    submitted: dict[str, str],
    current: dict[str, str],
) -> dict[str, str]:
    updates: dict[str, str] = {}

    for key, _label, field_type in EDITABLE_ENV_FIELDS:
        if field_type == "boolean":
            updates[key] = (
                "true" if submitted.get(key) == "true" else "false"
            )
            continue

        if key not in submitted:
            continue
        value = submitted.get(key, "").strip()
        if key in SECRET_ENV_FIELDS and value == "":
            continue
        updates[key] = value

    if not updates.get("PROJECT_NAME", current.get("PROJECT_NAME", "")).strip():
        raise ValueError("Le nom du projet est obligatoire.")

    for key in ("SYNC_INTERVAL_MINUTES", "SYNC_SEASON", "API_BIND_PORT"):
        if key not in updates or updates[key] == "":
            continue
        try:
            number = int(updates[key])
        except ValueError as exc:
            raise ValueError(f"{key} doit être un nombre entier.") from exc
        if key == "SYNC_INTERVAL_MINUTES" and not 1 <= number <= 1440:
            raise ValueError("L’intervalle doit être compris entre 1 et 1440.")
        if key == "SYNC_SEASON" and not 2000 <= number <= 2100:
            raise ValueError("La saison doit être comprise entre 2000 et 2100.")
        if key == "API_BIND_PORT" and not 1 <= number <= 65535:
            raise ValueError("Le port API doit être compris entre 1 et 65535.")

    for key in ("OCBLACKTOP_BASE_URL", "THESPORTSDB_BASE_URL"):
        value = updates.get(key, "")
        if value and urlparse(value).scheme not in {"http", "https"}:
            raise ValueError(f"{key} doit être une URL HTTP ou HTTPS.")

    domain = updates.get("API_DOMAIN", "")
    if domain and (
        "://" in domain
        or "/" in domain
        or not re.fullmatch(r"[A-Za-z0-9.-]+", domain)
    ):
        raise ValueError("Le domaine doit être fourni sans protocole ni chemin.")

    email = updates.get("ACME_EMAIL", "")
    if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("L’adresse email ACME est invalide.")

    timezone_name = updates.get("TIMEZONE", "")
    if timezone_name:
        try:
            ZoneInfo(timezone_name)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Le fuseau horaire est invalide.") from exc

    log_level = updates.get("LOG_LEVEL", "").upper()
    if log_level and log_level not in {
        "DEBUG",
        "INFO",
        "WARNING",
        "ERROR",
        "CRITICAL",
    }:
        raise ValueError("Le niveau de logs est invalide.")
    if log_level:
        updates["LOG_LEVEL"] = log_level

    if updates.get("SYNC_IMPORT_MODE", "all") != "all":
        raise ValueError("Le seul mode d’import pris en charge est all.")

    for key in ("ADMIN_API_KEY", "PUBLIC_API_KEY"):
        if key in updates and len(updates[key]) < 16:
            raise ValueError(f"{key} doit contenir au moins 16 caractères.")

    return updates


def env_editor_html(values: dict[str, str], available: bool) -> str:
    if not available:
        return (
            "<p class='warn'>Le fichier .env n’est pas accessible depuis "
            "le conteneur API.</p>"
        )

    fields: list[str] = []
    for key, label, field_type in EDITABLE_ENV_FIELDS:
        value = values.get(key, "")
        if field_type == "boolean":
            checked = " checked" if value.lower() in {"1", "true", "yes"} else ""
            field = (
                f"<label class='check'><input type='checkbox' name='{key}' "
                f"value='true'{checked}> {escape(label)}</label>"
            )
        else:
            html_type = "password" if field_type == "secret" else field_type
            rendered_value = "" if field_type == "secret" else value
            placeholder = (
                "Laisser vide pour conserver la valeur"
                if field_type == "secret"
                else ""
            )
            field = (
                f"<label>{escape(label)} <code>{key}</code>"
                f"<input type='{html_type}' name='{key}' "
                f"value='{escape(rendered_value, quote=True)}' "
                f"placeholder='{escape(placeholder, quote=True)}'></label>"
            )
        fields.append(field)

    protected = "".join(
        f"<li><code>{key}</code> : protégé, modification Web désactivée</li>"
        for key in PROTECTED_ENV_FIELDS
    )
    return (
        "<form method='post' action='/admin/settings/config'>"
        "<div class='form-grid'>"
        + "".join(fields)
        + "</div><p><button>Enregistrer la configuration</button></p></form>"
        "<p class='warn'>Les nouvelles valeurs seront actives après "
        "<code>sudo ./restart.sh</code>. Les secrets laissés vides sont "
        "conservés.</p><details><summary>Paramètres PostgreSQL protégés</summary>"
        f"<ul>{protected}</ul></details>"
    )


def client_config() -> dict:
    return {
        "project_name": settings.project_name,
        "server": base_url(),
        "api_version": "2.3.0",
        "public_api_key": settings.public_api_key,
        "features": {
            "filters": True,
            "delta_sync": True,
            "race_classification": True,
        },
    }


def config_json() -> str:
    return json.dumps(client_config(), ensure_ascii=False, indent=2)


def qr_png() -> bytes:
    image = qrcode.make(config_json())
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def human_bytes(value: int | None) -> str:
    if value is None:
        return "Indisponible"
    amount = float(value)
    for unit in ("o", "Ko", "Mo", "Go", "To"):
        if amount < 1024 or unit == "To":
            return f"{amount:.1f} {unit}"
        amount /= 1024
    return f"{amount:.1f} To"


def system_info() -> dict:
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    db_size = None
    try:
        with engine.connect() as connection:
            db_size = connection.execute(
                text("SELECT pg_database_size(current_database())")
            ).scalar()
    except Exception:
        pass
    return {
        "hostname": socket.gethostname(),
        "platform": platform.platform(),
        "python": platform.python_version(),
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory_percent": memory.percent,
        "memory_used": memory.used,
        "memory_total": memory.total,
        "disk_percent": disk.percent,
        "disk_used": disk.used,
        "disk_total": disk.total,
        "database_size": db_size,
    }


def page(content: str) -> str:
    project = escape(settings.project_name)
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paramètres — {project}</title>
<style>
body{{font-family:system-ui;background:#f3f5f8;margin:0;color:#1f2937}}
header{{background:#111827;color:#fff;padding:15px 22px}}
header a{{color:#fff;text-decoration:none;margin-right:18px}}
main{{max-width:1100px;margin:24px auto;padding:0 18px}}
.panel{{background:#fff;border:1px solid #d0d5dd;border-radius:12px;padding:20px;margin-bottom:18px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}}
.metric{{border:1px solid #d0d5dd;border-radius:10px;padding:16px}}
.metric strong{{display:block;font-size:26px}}
input{{width:100%;padding:10px;border:1px solid #d0d5dd;border-radius:7px}}
.row{{display:grid;grid-template-columns:1fr auto auto;gap:8px}}
.form-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}}
.form-grid label{{display:block;font-weight:600}} .form-grid code{{font-weight:400}}
.form-grid input{{margin-top:6px}} .form-grid .check{{padding:12px;border:1px solid #d0d5dd;border-radius:7px}}
.form-grid .check input{{width:auto;margin-right:8px}}
button,.button{{background:#b42318;color:#fff;border:0;border-radius:7px;padding:10px 13px;text-decoration:none;cursor:pointer}}
.secondary{{background:#475467}} .muted{{color:#667085}} .warn{{color:#b54708;font-weight:600}}
.flash{{padding:12px;border-radius:8px;background:#ecfdf3;border:1px solid #abefc6;margin-bottom:16px}}
.error{{padding:12px;border-radius:8px;background:#fef3f2;border:1px solid #fecdca;margin-bottom:16px}}
table{{width:100%;border-collapse:collapse}} th,td{{padding:10px;border-bottom:1px solid #d0d5dd;text-align:left;vertical-align:top}}
code{{white-space:pre-wrap}}
</style></head><body><header>
<a href="/admin"><strong>{project}</strong></a>
<a href="/admin/temporal-issues">Incohérences horaires</a>
<a href="/admin/settings">Paramètres</a><a href="/admin/audit">Journal</a>
<a href="/docs">API</a>
</header><main>{content}</main></body></html>"""


@router.get("/admin/settings", response_class=HTMLResponse, include_in_schema=False)
def settings_page(
    message: str = "",
    error: str = "",
    me_admin: str | None = Cookie(default=None),
):
    if not cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)

    info = system_info()
    env_path = admin_env_path()
    env_values: dict[str, str] = {}
    env_available = False
    try:
        _env_text, env_values = read_env_file(env_path)
        env_available = True
    except OSError:
        pass

    notice = ""
    if message:
        notice = f"<div class='flash'>{escape(message)}</div>"
    if error:
        notice += f"<div class='error'>{escape(error)}</div>"

    content = f"""
{notice}
<section class="panel"><h2>Clés API</h2>
<h3>Clé publique</h3><p class="muted">À utiliser côté plugin MyBB et application Android.</p>
<div class="row"><input id="public-key" type="password" readonly value="{escape(settings.public_api_key)}">
<button class="secondary" onclick="toggleSecret('public-key')">Afficher</button>
<button onclick="copySecret('public-key')">Copier</button></div>
<h3>Clé administrateur</h3><p class="muted">Ne jamais intégrer cette clé dans un client public.</p>
<div class="row"><input id="admin-key" type="password" readonly value="{escape(settings.admin_api_key)}">
<button class="secondary" onclick="toggleSecret('admin-key')">Afficher</button>
<button onclick="copySecret('admin-key')">Copier</button></div>
</section>

<section class="panel"><h2>Configuration client</h2>
<p><a class="button" href="/admin/client-config.json">Télécharger le JSON</a>
<a class="button" href="/admin/client-config.qr.png">Afficher le QR Code</a></p>
<details><summary>Aperçu</summary><pre><code>{escape(config_json())}</code></pre></details>
</section>

<section class="panel"><h2>Configuration du serveur</h2>
<p class="muted">Édition contrôlée du fichier <code>.env</code>. Les paramètres
PostgreSQL sont volontairement protégés pour éviter de rendre la base
inaccessible.</p>
{env_editor_html(env_values, env_available)}
</section>

<section class="panel"><h2>État système</h2><div class="grid">
<div class="metric"><span>CPU</span><strong>{info['cpu_percent']:.1f} %</strong></div>
<div class="metric"><span>Mémoire</span><strong>{info['memory_percent']:.1f} %</strong>
<small>{human_bytes(info['memory_used'])} / {human_bytes(info['memory_total'])}</small></div>
<div class="metric"><span>Disque</span><strong>{info['disk_percent']:.1f} %</strong>
<small>{human_bytes(info['disk_used'])} / {human_bytes(info['disk_total'])}</small></div>
<div class="metric"><span>PostgreSQL</span><strong>{human_bytes(info['database_size'])}</strong></div>
</div><p class="muted">{escape(info['hostname'])} · {escape(info['platform'])} · Python {escape(info['python'])}</p></section>

<section class="panel"><h2>Providers</h2>
<form method="post" action="/admin/providers/test"><button>Tester les providers</button></form>
</section>

<script>
function toggleSecret(id){{const e=document.getElementById(id);e.type=e.type==='password'?'text':'password';}}
async function copySecret(id){{await navigator.clipboard.writeText(document.getElementById(id).value);alert('Valeur copiée.');}}
</script>
"""
    return page(content)


@router.post("/admin/settings/config", include_in_schema=False)
async def update_settings(
    request: Request,
    me_admin: str | None = Cookie(default=None),
    db: OrmSession = Depends(get_db),
):
    if not cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)

    env_path = admin_env_path()
    try:
        _text, current = read_env_file(env_path)
        form = await request.form()
        submitted = {str(key): str(value) for key, value in form.items()}
        updates = validate_env_updates(submitted, current)
        write_env_updates(env_path, updates)
    except (OSError, ValueError) as exc:
        record_admin_action(
            db,
            "settings.update",
            status="failure",
            details={"error": type(exc).__name__},
        )
        return RedirectResponse(
            f"/admin/settings?error={quote(str(exc))}",
            status_code=303,
        )

    record_admin_action(
        db,
        "settings.update",
        details={"fields": sorted(updates)},
    )
    return RedirectResponse(
        "/admin/settings?message="
        + quote(
            "Configuration enregistrée. Exécutez sudo ./restart.sh "
            "pour appliquer les changements."
        ),
        status_code=303,
    )


@router.get(
    "/admin/temporal-issues",
    response_class=HTMLResponse,
    include_in_schema=False,
)
def temporal_issues_page(
    message: str = "",
    error: str = "",
    me_admin: str | None = Cookie(default=None),
    db: OrmSession = Depends(get_db),
):
    if not cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)

    rows = temporal_anomalies(db)
    timezone_name = settings.timezone
    rendered_rows = "".join(
        "<tr>"
        f"<td>{row.id}</td>"
        f"<td>{escape(row.event.sport_id)}</td>"
        f"<td>{escape(row.event.name)}</td>"
        f"<td>{escape(row.name)}</td>"
        f"<td><form id='temporal-{row.id}' method='post' "
        f"action='/admin/temporal-issues/{row.id}/correct'></form>"
        f"<input form='temporal-{row.id}' type='datetime-local' step='1' "
        f"name='start_at' required "
        f"value='{format_admin_datetime(row.start_at, timezone_name)}'>"
        "</td><td>"
        f"<input form='temporal-{row.id}' type='datetime-local' step='1' "
        f"name='end_at' required "
        f"value='{format_admin_datetime(row.end_at, timezone_name)}'>"
        f"</td><td><button form='temporal-{row.id}'>Corriger</button></td></tr>"
        for row in rows
    )
    if not rendered_rows:
        rendered_rows = (
            "<tr><td colspan='7'>Aucune incohérence temporelle détectée.</td></tr>"
        )

    notice = ""
    if message:
        notice = f"<div class='flash'>{escape(message)}</div>"
    if error:
        notice += f"<div class='error'>{escape(error)}</div>"

    return page(
        notice
        + "<section class='panel'><h2>Incohérences horaires</h2>"
        "<p>Une séance est signalée lorsque sa fin précède son début. "
        "La correction est appliquée immédiatement et conservée comme override "
        "pour les synchronisations suivantes.</p>"
        f"<p class='muted'>Fuseau affiché : {escape(timezone_name)}</p>"
        "<table><thead><tr><th>ID</th><th>Sport</th><th>Épreuve</th>"
        "<th>Séance</th><th>Début</th><th>Fin</th><th>Action</th></tr>"
        f"</thead><tbody>{rendered_rows}</tbody></table></section>"
    )


@router.post(
    "/admin/temporal-issues/{session_id}/correct",
    include_in_schema=False,
)
def correct_temporal_issue(
    session_id: int,
    start_at: str = Form(...),
    end_at: str = Form(...),
    me_admin: str | None = Cookie(default=None),
    db: OrmSession = Depends(get_db),
):
    if not cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)

    try:
        parsed_start = parse_admin_datetime(start_at, settings.timezone)
        parsed_end = parse_admin_datetime(end_at, settings.timezone)
        correct_session_timing(
            db,
            session_id,
            parsed_start,
            parsed_end,
        )
    except (LookupError, ValueError) as exc:
        record_admin_action(
            db,
            "temporal_issue.correct",
            status="failure",
            resource_type="session",
            resource_id=session_id,
            details={"error": type(exc).__name__},
        )
        return RedirectResponse(
            f"/admin/temporal-issues?error={quote(str(exc))}",
            status_code=303,
        )

    record_admin_action(
        db,
        "temporal_issue.correct",
        resource_type="session",
        resource_id=session_id,
    )
    return RedirectResponse(
        "/admin/temporal-issues?message="
        + quote("Horaire corrigé et override enregistré."),
        status_code=303,
    )


@router.get("/admin/client-config.json", include_in_schema=False)
def download_config(me_admin: str | None = Cookie(default=None)):
    if not cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)
    return Response(
        config_json(),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="motorsports-events-client.json"'},
    )


@router.get("/admin/client-config.qr.png", include_in_schema=False)
def download_qr(me_admin: str | None = Cookie(default=None)):
    if not cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)
    return Response(qr_png(), media_type="image/png")


@router.post("/admin/providers/test", response_class=HTMLResponse, include_in_schema=False)
async def provider_test_page(
    me_admin: str | None = Cookie(default=None),
    db: OrmSession = Depends(get_db),
):
    if not cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)
    results = [await test_ocblacktop(), await test_thesportsdb()]
    record_admin_action(
        db,
        "providers.test",
        status="success" if all(row["ok"] for row in results) else "failure",
        details={
            "providers": {
                row["provider"]: {
                    "ok": row["ok"],
                    "latency_ms": row["latency_ms"],
                }
                for row in results
            }
        },
    )
    rows = "".join(
        f"<tr><td>{escape(r['provider'])}</td><td>{'OK' if r['ok'] else 'Erreur'}</td>"
        f"<td>{escape(r['message'])}</td><td>{r['latency_ms'] or '—'} ms</td></tr>"
        for r in results
    )
    return page(
        "<section class='panel'><h2>Tests providers</h2>"
        "<table><tr><th>Provider</th><th>État</th><th>Message</th><th>Latence</th></tr>"
        f"{rows}</table><p><a class='button' href='/admin/settings'>Retour</a></p></section>"
    )


@router.get("/api/v1/admin/client-config", dependencies=[Depends(require_admin_key)])
def api_client_config():
    return client_config()


@router.get("/api/v1/admin/system", dependencies=[Depends(require_admin_key)])
def api_system():
    return system_info()


@router.post("/api/v1/admin/providers/test", dependencies=[Depends(require_admin_key)])
async def api_provider_tests(db: OrmSession = Depends(get_db)):
    results = {
        "ocblacktop": await test_ocblacktop(),
        "thesportsdb": await test_thesportsdb(),
    }
    record_admin_action(
        db,
        "providers.test",
        status=(
            "success"
            if all(row["ok"] for row in results.values())
            else "failure"
        ),
        details={
            "providers": {
                name: {
                    "ok": row["ok"],
                    "latency_ms": row["latency_ms"],
                }
                for name, row in results.items()
            }
        },
    )
    return results
