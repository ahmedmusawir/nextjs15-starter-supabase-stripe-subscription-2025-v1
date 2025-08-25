import os
import webbrowser
import urllib.parse
import mimetypes
from datetime import datetime
from email.message import EmailMessage
from email import policy

class EmailHelper:
    def __init__(self, report_dir):
        self.REPORT_DIR = report_dir

    def create_eml_draft(self, to_email, subject, body, attachment_paths, output_path, from_email="Pharmacy Owedbook <noreply@example.com>"):
        msg = EmailMessage(policy=policy.SMTP)
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["From"] = from_email
        msg.set_content(body)

        for path in attachment_paths:
            if not os.path.exists(path):
                continue
            ctype, encoding = mimetypes.guess_type(path)
            if ctype is None:
                ctype = "application/octet-stream"
            maintype, subtype = ctype.split("/", 1)
            with open(path, "rb") as f:
                data = f.read()
            msg.add_attachment(data, maintype=maintype, subtype=subtype,
                            filename=os.path.basename(path))

        with open(output_path, "wb") as f:
            f.write(msg.as_bytes())
        return output_path

    def compose_email_with_attachments(self, to_email, subject, body, attachments, set_status=None):
        if not to_email:
            if set_status:
                set_status("No PBM email to send to.")
            return

        try:
            import win32com.client
            outlook = win32com.client.Dispatch("Outlook.Application")
            mail = outlook.CreateItem(0)
            mail.To = to_email
            mail.Subject = subject
            mail.Body = body
            for a in attachments:
                if os.path.exists(a):
                    mail.Attachments.Add(os.path.abspath(a))
            mail.Display()
            if set_status:
                set_status("Email draft opened in Outlook.")
            return
        except Exception:
            # fallback: create .eml draft with attachments
            try:
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                eml_name = f"draft_{ts}.eml"
                eml_path = os.path.join(self.REPORT_DIR, eml_name)
                os.makedirs(self.REPORT_DIR, exist_ok=True)
                self.create_eml_draft(
                    to_email=to_email,
                    subject=subject,
                    body=body,
                    attachment_paths=attachments,
                    output_path=eml_path
                )
                os.startfile(eml_path)
                if set_status:
                    set_status("Opened .eml draft with attachments.")
                return
            except Exception:
                # last fallback to mailto (no attachments)
                params = {"subject": subject, "body": body}
                query = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
                mailto = f"mailto:{urllib.parse.quote(to_email)}?{query}"
                webbrowser.open(mailto)
                for path in attachments:
                    if os.path.exists(path):
                        folder = os.path.dirname(os.path.abspath(path))
                        try:
                            os.startfile(folder)
                        except Exception:
                            pass
                if set_status:
                    set_status("Opened default mail client; please attach manually.")
                return