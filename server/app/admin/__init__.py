from fastapi import APIRouter

from ..admin_extension import router as extension_router
from .audit import router as audit_router
from .core import router as core_router


router = APIRouter()
router.include_router(audit_router)
router.include_router(core_router)
router.include_router(extension_router)
