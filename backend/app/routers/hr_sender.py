"""HR sender account — CRUD for the singleton hr_sender row.

The HR sender is the dedicated Google account used to send all booking
confirmation emails. There is at most one per deployment (singleton,
hr_sender.id = 1). This router exposes:

  GET    /api/hr-sender            → status (connected / not)
  DELETE /api/hr-sender            → disconnect (remove row)

The OAuth connect flow lives in routers/auth.py at /api/auth/google/start-hr.
"""

from fastapi import APIRouter

from app.services import db

router = APIRouter()


@router.get("/")
async def get_hr_sender_status():
    """Return the current HR sender account (if connected).

    Never returns the refresh token — only the non-sensitive fields the UI
    needs to render the "connected" state.
    """
    supabase = db.get_supabase()
    result = (
        supabase.table("hr_sender")
        .select("email, name, connected_at")
        .eq("id", 1)
        .limit(1)
        .execute()
    )
    if not result.data:
        return {"connected": False}
    row = result.data[0]
    return {
        "connected": True,
        "email": row.get("email"),
        "name": row.get("name"),
        "connected_at": row.get("connected_at"),
    }


@router.delete("/")
async def disconnect_hr_sender():
    """Disconnect the HR sender account by deleting the singleton row.

    The next booking email will fall back to the interviewer's own Gmail
    OAuth until a new HR account is connected.
    """
    supabase = db.get_supabase()
    supabase.table("hr_sender").delete().eq("id", 1).execute()
    return {"disconnected": True}
