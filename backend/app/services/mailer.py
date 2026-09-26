"""Plain candidate emails sent from the connected HR Gmail account."""

from __future__ import annotations

import html

from app.config import settings


def _shell(title: str, body_html: str, company: str) -> str:
    return f"""<!DOCTYPE html><html><body style="margin:0;padding:32px 16px;background:#f5f4fa;
font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1b2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#6d4ae8;padding:20px 32px;color:#fff;font-weight:700">{html.escape(company)} · Recruiting</td></tr>
<tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:20px">{html.escape(title)}</h1>{body_html}</td></tr>
</table></td></tr></table></body></html>"""


async def send_email(to: str, subject: str, title: str, paragraphs: list[str],
                     button: tuple[str, str] | None = None, company: str | None = None) -> str | None:
    """Send from the HR sender account. Returns the Gmail id, or None if not sent."""
    from app.services.calendar_service import _send_via_gmail_api, get_hr_access_token

    company = company or settings.hr_company_name
    token, sender_email, sender_name = await get_hr_access_token()
    if not token or not to:
        return None
    body = "".join(f'<p style="font-size:15px;line-height:1.6;margin:0 0 14px">{html.escape(p)}</p>' for p in paragraphs)
    text = "\n\n".join(paragraphs)
    if button:
        label, url = button
        body += (f'<p style="margin:24px 0"><a href="{html.escape(url)}" style="background:#6d4ae8;color:#fff;'
                 f'padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">{html.escape(label)}</a></p>'
                 f'<p style="font-size:12px;color:#6b6780">Or open: {html.escape(url)}</p>')
        text += f"\n\n{label}: {url}"
    return await _send_via_gmail_api(
        access_token=token,
        sender_display=settings.hr_sender_name or sender_name or f"{company} Recruiting",
        sender_email=sender_email,
        to_email=to,
        subject=subject,
        html_body=_shell(title, body, company),
        text_body=text,
        ics_body="",
        ics_filename="",
        reply_to=settings.hr_reply_to or None,
    )
