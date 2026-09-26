"""Google OAuth routes for connecting interviewer calendars and the HR sender account."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse

from app.config import settings
from app.services import calendar_service
from app.services import db
from app.security import require_signed_link

router = APIRouter()

# State sentinel used when the OAuth flow is connecting the global HR sender
# account (singleton), as opposed to a specific interviewer. The callback
# branches on this.
HR_SENDER_STATE = "hr:sender"


def _error_page(title: str, body: str, status: int = 400) -> HTMLResponse:
    return HTMLResponse(
        f"<html><body><h2>{title}</h2><p>{body}</p>"
        f"<p><a href='{settings.frontend_url}/dashboard/settings'>Return to settings</a></p>"
        f"</body></html>",
        status_code=status,
    )


@router.get("/google/start", dependencies=[Depends(require_signed_link)])
async def start_google_oauth(interviewer_id: str = Query(...)):
    """Kick off OAuth flow for a specific interviewer.

    Frontend redirects the user here when they click "Connect Google Calendar".
    We redirect to Google's consent screen with interviewer_id in the state param.
    """
    # Verify interviewer exists
    supabase = db.get_supabase()
    result = supabase.table("interviewers").select("id").eq("id", interviewer_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Interviewer not found")

    auth_url = calendar_service.build_auth_url(interviewer_id)
    return RedirectResponse(url=auth_url)


@router.get("/google/start-hr", dependencies=[Depends(require_signed_link)])
async def start_hr_sender_oauth():
    """Kick off OAuth flow for the dedicated HR sender account.

    Frontend redirects the user here when they click "Connect HR Email" in
    Settings. The user signs in with their recruiting account (e.g.
    recruiting@example.com) and the tokens are saved to the hr_sender
    singleton table.
    """
    auth_url = calendar_service.build_hr_auth_url()
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
):
    """Google redirects here after the user approves (or denies).

    Branches on the state parameter:
      - `hr:sender` → save tokens to hr_sender singleton table
      - anything else → treat as interviewer_id and update interviewers row
    """
    if error:
        return _error_page("Google authorization failed", error)

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    state = calendar_service.verify_state(state)
    if state is None:
        return _error_page("Invalid sign-in link", "Please start the connection again from Settings.", status=403)

    try:
        token_data = await calendar_service.exchange_code_for_tokens(code)
    except Exception as e:
        return _error_page("Token exchange failed", str(e), status=500)

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)

    if not refresh_token:
        return _error_page(
            "Missing refresh token",
            "Google did not return a refresh token. Please revoke access at "
            "<a href='https://myaccount.google.com/permissions'>Google Account Permissions</a>"
            " and try again.",
        )

    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=expires_in)).isoformat()
    supabase = db.get_supabase()

    # --- HR sender branch ------------------------------------------------
    if state == HR_SENDER_STATE:
        # Discover which Google account the user authenticated as so we can
        # save the correct email on the hr_sender row.
        userinfo = await calendar_service.fetch_google_user_info(access_token)
        if not userinfo or not userinfo.get("email"):
            return _error_page(
                "Could not read HR account email",
                "Google did not return user info. Please try reconnecting.",
                status=500,
            )

        hr_email = userinfo["email"]
        hr_name = userinfo.get("name") or ""

        try:
            supabase.table("hr_sender").upsert({
                "id": 1,
                "email": hr_email,
                "name": hr_name,
                "google_refresh_token": refresh_token,
                "google_access_token": access_token,
                "google_access_token_expires_at": expires_at,
                "connected_at": now.isoformat(),
            }).execute()
        except Exception as e:
            return _error_page("Failed to save HR sender", str(e), status=500)

        return RedirectResponse(
            url=f"{settings.frontend_url}/dashboard/settings?hr_sender_connected=1"
        )

    # --- Interviewer branch (default) -----------------------------------
    interviewer_id = state
    supabase.table("interviewers").update({
        "google_refresh_token": refresh_token,
        "google_access_token": access_token,
        "google_access_token_expires_at": expires_at,
        "google_connected_at": now.isoformat(),
    }).eq("id", interviewer_id).execute()

    return RedirectResponse(url=f"{settings.frontend_url}/dashboard/settings?calendar_connected=1")


# ── Microsoft 365 / Outlook ──────────────────────────────────────────────

@router.get("/microsoft/start", dependencies=[Depends(require_signed_link)])
async def start_microsoft_oauth(interviewer_id: str = Query(...)):
    from app.services import microsoft_calendar
    if not microsoft_calendar.is_configured():
        return _error_page("Outlook isn't set up", "Ask your admin to set MS_CLIENT_ID and MS_CLIENT_SECRET.", status=503)
    return RedirectResponse(url=microsoft_calendar.build_auth_url(interviewer_id))


@router.get("/microsoft/callback")
async def microsoft_oauth_callback(
    code: str = Query(None), state: str = Query(None), error: str = Query(None),
    error_description: str = Query(None),
):
    from app.services import microsoft_calendar
    if error:
        return _error_page("Microsoft sign-in failed", error_description or error)
    value = calendar_service.verify_state(state or "")
    if not code or not value or not value.startswith("ms:"):
        return _error_page("Invalid sign-in link", "Please start the connection again from Settings.", status=403)
    try:
        await microsoft_calendar.connect(value[3:], code)
    except Exception as e:
        return _error_page("Couldn't connect Outlook", str(e), status=500)
    return RedirectResponse(url=f"{settings.frontend_url}/dashboard/settings?calendar_connected=1")
