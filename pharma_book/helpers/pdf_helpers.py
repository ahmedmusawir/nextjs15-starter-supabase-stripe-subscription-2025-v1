from reportlab.lib.pagesizes import letter, landscape
from reportlab.pdfgen import canvas
import os
import pandas as pd

class PDFHelper:
    def __init__(self, report_dir):
        self.REPORT_DIR = report_dir

    def save_pdf(self, df_export, folder, pbm, start, end, email=None):
        os.makedirs(self.REPORT_DIR, exist_ok=True)
        outdir = os.path.join(self.REPORT_DIR, folder)
        os.makedirs(outdir, exist_ok=True)

        fn = f"{folder}_{pbm}_{start}_{end}.pdf".replace(" ", "_")
        path = os.path.join(outdir, fn)

        c = canvas.Canvas(path, pagesize=landscape(letter))
        w, h, m = landscape(letter)[0], landscape(letter)[1], 40
        y = h - m
        c.setFont("Helvetica-Bold",16)
        c.drawCentredString(w/2, y, pbm)
        y -= 24
        if email:
            c.setFont("Helvetica",10)
            c.drawCentredString(w/2, y, email)
            y -= 20

        headers = ["Date","Script","Qty","AAC","Expected","Original Paid","Owed","Report"]
        xs = [m,110,260,320,380,460,540,620]
        c.setFont("Helvetica-Bold",10)
        for x,hdr in zip(xs,headers):
            c.drawString(x,y,hdr)
        y -= 16
        c.setFont("Helvetica",9)

        for _, r in df_export.iterrows():
            if y < m:
                c.showPage(); y = h - m
                c.setFont("Helvetica-Bold",16)
                c.drawCentredString(w/2, y, pbm)
                y -= 24
                if email:
                    c.setFont("Helvetica",10)
                    c.drawCentredString(w/2, y, email)
                    y -= 20
                c.setFont("Helvetica-Bold",10)
                for x,hdr in zip(xs,headers):
                    c.drawString(x,y,hdr)
                y -= 16
                c.setFont("Helvetica",9)

            c.drawString(xs[0], y, r['date_dispensed'].strftime('%Y-%m-%d') if pd.notna(r['date_dispensed']) else "")
            c.drawString(xs[1], y, r['script'])
            c.drawRightString(xs[2]+30, y, str(int(r['qty']) if pd.notna(r['qty']) else 0))
            c.drawRightString(xs[3]+40, y, f"{r['aac']:.2f}")
            c.drawRightString(xs[4]+50, y, f"{r['expected_paid']:.2f}")
            c.drawRightString(xs[5]+50, y, f"{r['total_paid']:.2f}")
            c.drawRightString(xs[6]+30, y, f"{r['difference']:.2f}")
            c.drawString(xs[7], y, '')
            y -= 16

        c.save()
        return path