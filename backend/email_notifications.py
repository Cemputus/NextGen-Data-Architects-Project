"""
Email notifications for admin: ETL failure and daily digest.
Uses SMTP from environment (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM).
If not configured, logs a warning and no-ops.
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def _smtp_configured():
    host = os.environ.get('SMTP_HOST', '').strip()
    return bool(host)


def send_email(to_address, subject, body_plain, body_html=None):
    """
    Send an email. Returns True if sent, False if skipped (no config or error).
    to_address: single email string
    """
    if not to_address or not (to_address := to_address.strip()):
        return False
    if not _smtp_configured():
        return False
    host = os.environ.get('SMTP_HOST', '').strip()
    port = int(os.environ.get('SMTP_PORT', '587'))
    user = os.environ.get('SMTP_USER', '').strip()
    password = os.environ.get('SMTP_PASSWORD', '')
    from_addr = os.environ.get('SMTP_FROM', user or 'noreply@localhost').strip()
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = from_addr
        msg['To'] = to_address
        msg.attach(MIMEText(body_plain, 'plain'))
        if body_html:
            msg.attach(MIMEText(body_html, 'html'))
        with smtplib.SMTP(host, port) as s:
            if user and password:
                s.starttls()
                s.login(user, password)
            s.sendmail(from_addr, [to_address], msg.as_string())
        return True
    except Exception as e:
        import traceback
        traceback.print_exc()
        return False


def send_etl_failure_email(to_address, log_snippet=None):
    """Send a short email notifying that ETL failed."""
    subject = "[NextGen MIS] ETL Pipeline Failed"
    body = "The ETL pipeline run failed. Please check the ETL logs in the admin console."
    if log_snippet:
        body += "\n\nLast lines of log:\n" + log_snippet
    return send_email(to_address, subject, body)


def send_daily_digest_email(to_address, summary_text):
    """Send daily digest with the given summary text."""
    subject = "[NextGen MIS] Daily Digest"
    body = summary_text
    return send_email(to_address, subject, body)
