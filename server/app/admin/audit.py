from html import escape

from fastapi import APIRouter, Cookie, Depends, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session as OrmSession

from ..config import get_settings
from ..database import get_db
from ..models import AdminAuditLog
from ..security import require_admin_key


router = APIRouter()
settings = get_settings()


def record_admin_action(
    db: OrmSession,
    action: str,
    *,
    status: str = "success",
    resource_type: str | None = None,
    resource_id: str | int | None = None,
    details: dict | None = None,
) -> AdminAuditLog:
    row = AdminAuditLog(
        action=action,
        status=status,
        resource_type=resource_type,
        resource_id=None if resource_id is None else str(resource_id),
        details=details or {},
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _cookie_valid(value: str | None) -> bool:
    return bool(value) and value == settings.admin_api_key


def _payload(row: AdminAuditLog) -> dict:
    return {
        "id": row.id,
        "action": row.action,
        "status": row.status,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "details": row.details,
        "created_at": row.created_at,
    }


@router.get(
    "/api/v1/admin/audit",
    dependencies=[Depends(require_admin_key)],
)
def api_audit_log(
    limit: int = Query(default=100, ge=1, le=500),
    db: OrmSession = Depends(get_db),
):
    rows = (
        db.query(AdminAuditLog)
        .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
        .limit(limit)
        .all()
    )
    return [_payload(row) for row in rows]


@router.get(
    "/admin/audit",
    response_class=HTMLResponse,
    include_in_schema=False,
)
def audit_page(
    me_admin: str | None = Cookie(default=None),
    db: OrmSession = Depends(get_db),
):
    if not _cookie_valid(me_admin):
        return RedirectResponse("/admin/login", status_code=303)
    rows = (
        db.query(AdminAuditLog)
        .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
        .limit(200)
        .all()
    )
    rendered = "".join(
        "<tr>"
        f"<td>{row.id}</td><td>{escape(str(row.created_at))}</td>"
        f"<td>{escape(row.action)}</td><td>{escape(row.status)}</td>"
        f"<td>{escape(row.resource_type or '')}</td>"
        f"<td>{escape(row.resource_id or '')}</td>"
        f"<td><code>{escape(str(row.details or {}))}</code></td></tr>"
        for row in rows
    ) or "<tr><td colspan='7'>Aucune action enregistrée.</td></tr>"
    return (
        "<!doctype html><html lang='fr'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>Journal d’administration</title>"
        "<style>body{font-family:system-ui;background:#f3f5f8;margin:0;color:#1f2937}"
        "header{background:#111827;padding:15px 22px}header a{color:#fff;margin-right:18px}"
        "main{max-width:1280px;margin:24px auto;padding:0 18px}.panel{background:#fff;"
        "border:1px solid #d0d5dd;border-radius:12px;padding:20px}table{width:100%;"
        "border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #d0d5dd;"
        "text-align:left;vertical-align:top}code{white-space:pre-wrap}</style></head>"
        f"<body><header><a href='/admin'><strong>{escape(settings.project_name)}</strong></a>"
        "<a href='/admin/audit'>Journal</a></header><main><section class='panel'>"
        "<h2>Journal d’administration</h2><table><thead><tr><th>ID</th><th>Date</th>"
        "<th>Action</th><th>État</th><th>Ressource</th><th>ID</th><th>Détails</th>"
        f"</tr></thead><tbody>{rendered}</tbody></table></section></main></body></html>"
    )
