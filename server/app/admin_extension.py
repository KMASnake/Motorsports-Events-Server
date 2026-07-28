from __future__ import annotations

import io
import json
import os
import platform
import socket
from html import escape

import psutil
import qrcode
from fastapi import APIRouter, Cookie, Depends
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy import text

from .config import get_settings
from .database import engine
from .provider_tests import test_ocblacktop, test_thesportsdb
from .security import require_admin_key

router = APIRouter()
settings = get_settings()


def cookie_valid(value: str | None) -> bool:
    return bool(value) and value == settings.admin_api_key


def base_url() -> str:
    domain = os.getenv("API_DOMAIN", "").strip()
    return f"https://{domain}" if domain else "http://localhost:8088"


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
button,.button{{background:#b42318;color:#fff;border:0;border-radius:7px;padding:10px 13px;text-decoration:none;cursor:pointer}}
.secondary{{background:#475467}} .muted{{color:#667085}} code{{white-space:pre-wrap}}
</style></head><body><header>
<a href="/admin"><strong>{project}</strong></a>
<a href="/admin/settings">Paramètres</a><a href="/docs">API</a>
</header><main>{content}</main></body></html>"""


@router.get("/admin/settings", response_class=HTMLResponse, include_in_schema=False)
def settings_page(me_admin: str | None = Cookie(default=None)):
    if not cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)

    info = system_info()
    content = f"""
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
async def provider_test_page(me_admin: str | None = Cookie(default=None)):
    if not cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)
    results = [await test_ocblacktop(), await test_thesportsdb()]
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
async def api_provider_tests():
    return {
        "ocblacktop": await test_ocblacktop(),
        "thesportsdb": await test_thesportsdb(),
    }
