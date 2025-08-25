import os
import re
import tkinter as tk
from tkinter import filedialog, ttk, messagebox
from tkcalendar import DateEntry
from datetime import date, datetime
import calendar
import pandas as pd
pd.set_option('future.no_silent_downcasting', True)
import sqlite3

from helpers.db_helpers import DatabaseHelper
from helpers.pdf_helpers import PDFHelper
from helpers.email_helpers import EmailHelper
from helpers.login_dialog import LoginDialog  # <-- Import the login dialog

# Modern UI: use ttk everywhere and a good theme
try:
    from ttkthemes import ThemedTk
    root_class = lambda: ThemedTk(theme="arc")
except ImportError:
    root_class = tk.Tk

BASE_DIR = os.path.dirname(__file__)

INCLUSION_LIST_DIR = os.path.join(BASE_DIR, "inclusion_lists")
DEFAULT_AAC = os.path.join(INCLUSION_LIST_DIR, "inclusion_AAClist.xlsx")
DEFAULT_WAC = os.path.join(INCLUSION_LIST_DIR, "inclusion_WACMckFullLoad.csv")
DEFAULT_PBM = os.path.join(INCLUSION_LIST_DIR, "inclusion_PBMlist.xlsx")
REPORT_DIR = os.path.join(BASE_DIR, "ReimbursementReports")
FIXED_FEE = 10.64

PROFILE_FIELDS = [
    ("pharmacy_name", "Pharmacy Name"),
    ("address", "Address"),
    ("phone", "Phone"),
    ("fax", "Fax"),
    ("email", "Email"),
    ("ncpdp", "NCPDP"),
    ("npi", "NPI"),
    ("contact_person", "Contact Person"),
]

def clean_numeric(value):
    if pd.isna(value):
        return 0.0
    s = str(value).strip()
    if s == '':
        return 0.0
    negative = False
    if s.startswith('(') and s.endswith(')'):
        negative = True
        s = s[1:-1]
    s = re.sub(r'[^0-9.\-]', '', s)
    try:
        num = float(s)
    except ValueError:
        return 0.0
    return -num if negative else num

def normalize_date(val):
    try:
        dt = pd.to_datetime(val, errors='coerce')
        if pd.isna(dt):
            return ''
        return dt.strftime('%Y-%m-%d')
    except Exception:
        return ''

def resolve_columns(raw_cols):
    import difflib
    variants = {
        'script': ['script', 'prescription id', 'rx number', 'rx', 'script id', 'rx#'],
        'total_paid': ['total paid', 'total_paid', 'paid amount', 'amount paid', 'payment'],
        'date_dispensed': ['date dispensed', 'dispense date', 'fill date', 'date of fill', 'date_filled'],
        'drug_ndc': ['drug ndc', 'ndc', 'ndc code'],
        'drug_name': ['drug name', 'medication', 'product name', 'drug'],
        'qty': ['qty', 'quantity', 'quantity billed', 'amount dispensed', 'dispensed quantity'],
        'bin': ['bin']
    }
    lc_to_orig = {c.strip().lower(): c for c in raw_cols}
    resolved = {}
    unmatched_required = []
    for canonical, possibles in variants.items():
        found = None
        for p in possibles:
            if p in lc_to_orig:
                found = lc_to_orig[p]
                break
        if not found:
            matches = difflib.get_close_matches(canonical, list(lc_to_orig.keys()), n=1, cutoff=0.7)
            if matches:
                found = lc_to_orig[matches[0]]
            else:
                for p in possibles:
                    matches = difflib.get_close_matches(p, list(lc_to_orig.keys()), n=1, cutoff=0.7)
                    if matches:
                        found = lc_to_orig[matches[0]]
                        break
        if found:
            resolved[canonical] = found
        else:
            if canonical in ('script', 'total_paid', 'date_dispensed'):
                unmatched_required.append(canonical)
            else:
                resolved[canonical] = None
    return resolved, unmatched_required

def ensure_profile_table_exists(conn):
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS pharmacy_profile (
            id INTEGER PRIMARY KEY,
            pharmacy_name TEXT,
            address TEXT,
            phone TEXT,
            fax TEXT,
            email TEXT,
            ncpdp TEXT,
            npi TEXT,
            contact_person TEXT
        )
    """)
    conn.commit()

def get_profile(conn):
    ensure_profile_table_exists(conn)
    c = conn.cursor()
    c.execute("SELECT * FROM pharmacy_profile WHERE id=1")
    row = c.fetchone()
    if row:
        d = dict(zip([desc[0] for desc in c.description], row))
        d.pop("id", None)
        return d
    else:
        c.execute("INSERT INTO pharmacy_profile (id) VALUES (1)")
        conn.commit()
        return {k: "" for k, _ in PROFILE_FIELDS}

def set_profile(conn, profile_dict):
    ensure_profile_table_exists(conn)
    c = conn.cursor()
    c.execute("SELECT id FROM pharmacy_profile WHERE id=1")
    if c.fetchone():
        set_clause = ", ".join(f"{k}=?" for k, _ in PROFILE_FIELDS)
        values = [profile_dict.get(k, "") for k, _ in PROFILE_FIELDS]
        c.execute(f"UPDATE pharmacy_profile SET {set_clause} WHERE id=1", values)
    else:
        cols = ", ".join(k for k, _ in PROFILE_FIELDS)
        q_marks = ", ".join("?" for _ in PROFILE_FIELDS)
        values = [profile_dict.get(k, "") for k, _ in PROFILE_FIELDS]
        c.execute(f"INSERT INTO pharmacy_profile (id, {cols}) VALUES (1, {q_marks})", values)
    conn.commit()

class ProfileDialog(tk.Toplevel):
    def __init__(self, master, conn, *args, **kwargs):
        super().__init__(master, *args, **kwargs)
        self.title("Pharmacy Profile")
        self.conn = conn
        self.vars = {}
        profile = get_profile(self.conn)
        frm = ttk.Frame(self)
        frm.pack(fill='both', expand=True, padx=16, pady=16)
        for i, (key, label) in enumerate(PROFILE_FIELDS):
            ttk.Label(frm, text=label + ":").grid(row=i, column=0, sticky='e', pady=4, padx=4)
            var = tk.StringVar(value=profile.get(key, ""))
            entry = ttk.Entry(frm, textvariable=var, width=40)
            entry.grid(row=i, column=1, sticky='w', pady=4)
            self.vars[key] = var
        btns = ttk.Frame(frm)
        btns.grid(row=len(PROFILE_FIELDS), column=0, columnspan=2, pady=(12, 0))
        ttk.Button(btns, text="Save", command=self.save).pack(side='left', padx=6)
        ttk.Button(btns, text="Cancel", command=self.destroy).pack(side='left', padx=6)
    def save(self):
        profile_data = {k: v.get() for k, v in self.vars.items()}
        set_profile(self.conn, profile_data)
        messagebox.showinfo("Saved", "Profile saved successfully.")
        self.destroy()

class ReimbursementComparer:
    def __init__(self, master):
        self.master = master
        self.db = DatabaseHelper(
            BASE_DIR,
            inclusion_dir=INCLUSION_LIST_DIR,
            default_aac=DEFAULT_AAC,
            default_wac=DEFAULT_WAC,
            default_pbm=DEFAULT_PBM
        )
        self.pdf = PDFHelper(REPORT_DIR)
        self.email = EmailHelper(REPORT_DIR)
        self.profile_conn = sqlite3.connect(os.path.join(BASE_DIR, "app.db"))
        ensure_profile_table_exists(self.profile_conn)
        self.profile = get_profile(self.profile_conn)
        self.db.load_pbm()
        self.db.load_baseline()
        self.db.load_alt_rates()
        self.current_email = ''
        self._status_clear_job = None
        self.build_dashboard(master)

    # --- SORTING UTILS ---
    def _sort_treeview(self, tree, col, data_list, value_func=None):
        direction = getattr(tree, "_sort_dir", {})
        reverse = direction.get(col, False)
        direction[col] = not reverse
        tree._sort_dir = direction

        if not value_func:
            value_func = lambda v: v

        sorted_list = sorted(data_list, key=lambda x: value_func(x[col]), reverse=reverse)
        for item in tree.get_children():
            tree.delete(item)
        for row in sorted_list:
            tree.insert('', 'end', values=[row[c] for c in tree["columns"]])

    def _treeview_sort_handler(self, tree, df, cols, col_types):
        def handler(col):
            data = []
            for item in tree.get_children():
                vals = tree.item(item, "values")
                row = {name: val for name, val in zip(cols, vals)}
                if col_types[col]:
                    try:
                        row[col] = col_types[col](row[col].replace(",","").replace("$",""))
                    except:
                        row[col] = 0
                data.append(row)
            self._sort_treeview(tree, col, data, value_func=lambda v: v)
        for i, col in enumerate(cols):
            tree.heading(col, command=lambda c=col: handler(c))
    # --- END SORTING UTILS ---

    def set_status(self, msg, duration=6000):
        if hasattr(self, 'status_var'):
            self.status_var.set(msg)
            if self._status_clear_job:
                self.master.after_cancel(self._status_clear_job)
            self._status_clear_job = self.master.after(duration, lambda: self.status_var.set(''))

    def build_dashboard(self, master):
        master.title("Pharmacy Owedbook Dashboard")
        style = ttk.Style(master)
        if "arc" in style.theme_names():
            style.theme_use("arc")
        style.configure('.', font=('Segoe UI', 10))
        style.configure('TButton', font=('Segoe UI', 10, 'bold'))
        style.configure('TLabel', font=('Segoe UI', 10))
        style.configure('Treeview.Heading', font=('Segoe UI', 10, 'bold'))
        style.configure("BigTitle.TLabel", font=("Segoe UI", 24, "bold"))
        style.configure("Subtitle.TLabel", font=("Segoe UI", 10, "italic"))
        # Modernized title and subtitle using ttk
        ttk.Label(master, text="Owedbook", style="BigTitle.TLabel").pack(pady=(8,4))
        ttk.Label(master, text="Ledger-level clarity on what’s still owed", style="Subtitle.TLabel").pack()
        ctrl = ttk.Frame(master); ctrl.pack(fill='x', pady=4, padx=4)
        ttk.Button(ctrl, text='Import User Data', command=self.import_data).pack(side='left', padx=4)
        ttk.Button(ctrl, text='Profile', command=self.show_profile_dialog).pack(side='left', padx=4)
        ttk.Label(ctrl, text='From:').pack(side='left')
        self.ctrl_from = DateEntry(ctrl, date_pattern='yyyy-mm-dd'); self.ctrl_from.pack(side='left', padx=4)
        ttk.Label(ctrl, text='To:').pack(side='left')
        self.ctrl_to = DateEntry(ctrl, date_pattern='yyyy-mm-dd'); self.ctrl_to.pack(side='left', padx=4)
        self.ctrl_from.bind("<<DateEntrySelected>>", lambda e: self._render_all(*self._current_controls()))
        self.ctrl_to.bind("<<DateEntryEntry>>", lambda e: self._render_all(*self._current_controls()))
        today = date.today()
        fd = today.replace(day=1)
        ld = today.replace(day=calendar.monthrange(today.year, today.month)[1])
        self.ctrl_from.set_date(fd); self.ctrl_to.set_date(ld)
        ttk.Label(ctrl, text='Filter:').pack(side='left', padx=(16,0))
        self.ctrl_filter = ttk.Combobox(ctrl, values=['All','Underpaid','Overpaid'], state='readonly')
        self.ctrl_filter.set('All'); self.ctrl_filter.pack(side='left', padx=4)
        self.ctrl_filter.bind("<<ComboboxSelected>>", lambda e: self._render_all(*self._current_controls()))
        ttk.Label(ctrl, text='PBM:').pack(side='left', padx=(16,0))
        vals = [r[0] for r in self.db.conn.execute("SELECT DISTINCT pbm_name FROM pbm_info")] + ['Federal']
        pbms = ['All'] + sorted(set(vals))
        self.ctrl_pbm = ttk.Combobox(ctrl, values=pbms, state='readonly')
        self.ctrl_pbm.set('All'); self.ctrl_pbm.pack(side='left', padx=4)
        self.ctrl_pbm.bind("<<ComboboxSelected>>", lambda e: self._render_all(*self._current_controls()))
        status_frame = ttk.Frame(master)
        status_frame.pack(fill='x', padx=4)
        self.status_var = tk.StringVar()
        ttk.Label(status_frame, textvariable=self.status_var, anchor='w').pack(fill='x')
        self.kpi_frame = ttk.Frame(master)
        self.kpi_frame.pack(fill='x', padx=4, pady=(0,4))
        # Use ttk.Label for KPIs
        self.lbl_underpaid_commercial = ttk.Label(
            self.kpi_frame,
            text="Commercial Underpaid: $0.00",
            style="KPI.TLabel"
        )
        self.lbl_underpaid_commercial.pack(side='left', padx=8)
        self.lbl_script_count = ttk.Label(
            self.kpi_frame,
            text="Commercial Scripts: 0",
            style="KPI.TLabel"
        )
        self.lbl_script_count.pack(side='left', padx=8)
        self.lbl_updated_difference = ttk.Label(
            self.kpi_frame,
            text="Updated Difference: $0.00",
            style="KPI.TLabel"
        )
        self.lbl_updated_difference.pack(side='left', padx=8)
        self.lbl_owed = ttk.Label(
            self.kpi_frame,
            text="Owed: $0.00",
            style="KPI.TLabel"
        )
        self.lbl_owed.pack(side='left', padx=8)
        style.configure("KPI.TLabel", font=("Segoe UI", 12, "bold"))
        self.nb = ttk.Notebook(master); self.nb.pack(fill='both', expand=True)
        t1 = ttk.Frame(self.nb); t2 = ttk.Frame(self.nb)
        t3 = ttk.Frame(self.nb); t4 = ttk.Frame(self.nb)
        self.nb.add(t1, text='Commercial Dollars')
        self.nb.add(t2, text='Updated Commercial Payments')
        self.nb.add(t3, text='Federal Dollars')
        self.nb.add(t4, text='Summary')
        self.f1, self.f2, self.f3, self.f4 = [ttk.Frame(t) for t in (t1, t2, t3, t4)]
        for f in (self.f1, self.f2, self.f3, self.f4):
            f.pack(fill='both', expand=True)
        bottom = ttk.Frame(master); bottom.pack(fill='x', pady=4)
        self.lbl_email = ttk.Label(bottom, text="", style="Email.TLabel", cursor="hand2")
        self.lbl_email.pack(side='left', padx=8)
        self.lbl_email.bind("<Button-1>", lambda e: os.system(f'start mailto:{self.current_email}') if self.current_email else None)
        style.configure("Email.TLabel", font=("Segoe UI", 9, "underline"), foreground="blue")
        self.btn_save = ttk.Button(bottom, text='Save PDF', command=lambda: self.save_pdf(*self._current_controls()))
        self.btn_email = ttk.Button(bottom, text='Send Email', command=lambda: self.manual_email_dialog(*self._current_controls()))
        self._render_all(*self._current_controls())

    def show_profile_dialog(self):
        dlg = ProfileDialog(self.master, self.profile_conn)
        self.master.wait_window(dlg)
        self.profile = get_profile(self.profile_conn)

    def _current_controls(self):
        return (self.ctrl_from.get_date(), self.ctrl_to.get_date(),
                self.ctrl_filter.get(), self.ctrl_pbm.get())

    def import_data(self):
        files = filedialog.askopenfilenames(
            filetypes=[
                ("Excel/CSV files", ("*.xlsx", "*.xls", "*.xlsm", "*.csv")),
                ("All files", "*.*")
            ]
        )
        if not files:
            return
        total_inserted = 0
        total_updated = 0
        for p in files:
            ext = os.path.splitext(p)[1].lower()
            try:
                if ext in (".xlsx", ".xlsm"):
                    df = pd.read_excel(p, dtype=str, engine="openpyxl")
                elif ext == ".xls":
                    df = pd.read_excel(p, dtype=str, engine="xlrd")
                elif ext == ".csv":
                    df = pd.read_csv(p, dtype=str, engine="python", on_bad_lines='skip')
                else:
                    continue
            except Exception as e:
                messagebox.showwarning("Import failed", f"Could not read {os.path.basename(p)}: {e}")
                self.set_status(f"Failed to read {os.path.basename(p)}: {e}")
                continue
            resolved, missing_required = resolve_columns(df.columns)
            if missing_required:
                msg = (
                    f"File {os.path.basename(p)} is missing required columns: "
                    f"{', '.join(missing_required)}. Detected headers: {list(df.columns)}"
                )
                messagebox.showwarning("Import skipped", msg)
                self.set_status(f"Skipped {os.path.basename(p)} (missing: {', '.join(missing_required)})")
                continue
            rename_map = {resolved[canon]: canon for canon in resolved if resolved.get(canon)}
            df = df.rename(columns=rename_map)
            applied = ", ".join(f"{orig}→{new}" for orig, new in rename_map.items())
            self.set_status(f"Imported {os.path.basename(p)}: {applied}")
            df['script'] = df['script'].astype(str).str.strip()
            df['total_paid'] = df['total_paid'].apply(clean_numeric)
            df['qty'] = df.get('qty', '').apply(clean_numeric)
            df['drug_ndc'] = df.get('drug_ndc', '').astype(str).str.replace(r'\D+', '', regex=True)
            df['drug_name'] = df.get('drug_name', '').astype(str).str.strip()
            df['bin'] = df.get('bin', '').astype(str).str.strip()
            df['date_dispensed'] = df['date_dispensed'].apply(normalize_date)
            for _, r in df.iterrows():
                if not r['date_dispensed']:
                    continue
                existing = self.db.cursor.execute(
                    f"SELECT total_paid FROM {self.db.QUOTED_USER_TABLE} WHERE script=?", (r['script'],)
                ).fetchone()
                if existing is None:
                    self.db.cursor.execute(f"""
                        INSERT INTO {self.db.QUOTED_USER_TABLE}(script,date_dispensed,drug_ndc,drug_name,qty,total_paid,new_paid,bin)
                        VALUES(?,?,?,?,?,?,NULL,?)
                    """, (r['script'], r['date_dispensed'], r['drug_ndc'],
                          r['drug_name'], r['qty'], r['total_paid'], r['bin']))
                    total_inserted += 1
                else:
                    orig = existing[0]
                    if r['total_paid'] != orig:
                        self.db.cursor.execute(f"""
                            UPDATE {self.db.QUOTED_USER_TABLE}
                            SET date_dispensed=?, drug_ndc=?, drug_name=?, qty=?, new_paid=?, bin=?
                            WHERE script=?
                        """, (r['date_dispensed'], r['drug_ndc'], r['drug_name'],
                              r['qty'], r['total_paid'], r['bin'], r['script']))
                        total_updated += 1
        self.db.conn.commit()
        self.set_status(f"Inserted: {total_inserted}, Updated: {total_updated}")
        self._render_all(*self._current_controls())

    def fetch_data(self, start, end, flt, pbm):
        df_act = pd.read_sql_query(
            f"SELECT * FROM {self.db.QUOTED_USER_TABLE} WHERE date_dispensed BETWEEN ? AND ?", self.db.conn,
            params=(start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))
        )
        df_act['date_dispensed'] = pd.to_datetime(df_act['date_dispensed'], errors='coerce')
        df_bas = pd.read_sql_query("SELECT ndc,aac FROM baseline", self.db.conn)
        df_alt = pd.read_sql_query("SELECT ndc,wac,pkg_size,pkg_size_mult,generic_indicator FROM alt_rates", self.db.conn)
        df_pbm = pd.read_sql_query("SELECT bin,pbm_name,email FROM pbm_info", self.db.conn)
        df_act['ndc'] = df_act['drug_ndc'].astype(str).str.replace(r'\D+', '', regex=True)
        df_bas['ndc'] = df_bas['ndc'].astype(str).str.replace(r'\D+', '', regex=True)
        df_alt['ndc']= df_alt['ndc'].astype(str).str.replace(r'\D+', '', regex=True)
        df = (df_act
              .merge(df_bas, on='ndc', how='left')
              .merge(df_alt, on='ndc', how='left', suffixes=('','_alt'))
              .merge(df_pbm, on='bin', how='left'))
        df['pbm_name']=df['pbm_name'].fillna('Federal')
        df['email']   =df['email'].fillna('')
        df['baseline_present'] = df['aac'].notna()
        def compute_fallback(r):
            if r['pkg_size'] > 0 and r['pkg_size_mult'] > 0 and r['wac'] > 0:
                gi = str(r.get('generic_indicator', '')).strip().upper()
                if gi == 'N':
                    return (r['wac'] * 0.96) / (r['pkg_size'] * r['pkg_size_mult'])
                else:
                    return r['wac'] / (r['pkg_size'] * r['pkg_size_mult'])
            return 0.0
        df['aac'] = df.apply(lambda r: r['aac'] if r['baseline_present'] else compute_fallback(r), axis=1)
        def method_for_row(r):
            if r['baseline_present']:
                return 'AAC'
            elif r['pkg_size']>0 and r['pkg_size_mult']>0 and r['wac']>0:
                gi = str(r.get('generic_indicator', '')).strip().upper()
                if gi == 'N':
                    return '0.96*WAC/(pkg_size*pkg_size_mult)'
                else:
                    return 'WAC/(pkg_size*pkg_size_mult)'
            else:
                return ''
        df['method'] = df.apply(method_for_row, axis=1)
        df['expected_paid']=df['qty'] * df['aac'] + FIXED_FEE
        df['difference']   =df['total_paid'] - df['expected_paid']
        df['updated_diff'] =df['new_paid'] - df['total_paid']
        if pbm!='All':
            df = df[df['pbm_name']==pbm]
        if flt=='Underpaid':
            df = df[df['difference']<0]
        elif flt=='Overpaid':
            df = df[df['difference']>0]
        return df

    def _update_action_buttons(self, flt, pbm):
        can_save = (flt == 'Underpaid') and (pbm != 'All')
        if can_save:
            if not self.btn_save.winfo_ismapped():
                self.btn_save.pack(side='right', padx=8)
        else:
            if self.btn_save.winfo_ismapped():
                self.btn_save.pack_forget()
        can_email = (pbm not in ('All', 'Federal'))
        if can_email:
            if not self.btn_email.winfo_ismapped():
                self.btn_email.pack(side='right', padx=4)
        else:
            if self.btn_email.winfo_ismapped():
                self.btn_email.pack_forget()

    def save_pdf(self, start, end, flt, pbm):
        title = self.nb.tab(self.nb.select(), option='text')
        folder = {
          'Commercial Dollars':'report_commercialdollars',
          'Updated Commercial Payments':'report_updatedcommercialdollars',
          'Federal Dollars':'report_federaldollars',
          'Summary':'report_summary'
        }[title]
        outdir = os.path.join(REPORT_DIR, folder)
        os.makedirs(outdir, exist_ok=True)
        fn = f"{folder}_{pbm}_{start}_{end}.pdf".replace(" ", "_")
        path = os.path.join(outdir, fn)
        df = self.fetch_data(start, end, flt, pbm)
        if df.empty:
            messagebox.showinfo("No Data", "Nothing to export on this filter/pbm.")
            return
        scripts = list(df['script'].dropna().unique())
        existing = []
        if scripts:
            placeholders = ",".join("?" for _ in scripts)
            q = f"""
                SELECT script, pdf_file FROM report_files
                WHERE report_type=? AND script IN ({placeholders}) AND pdf_file IS NOT NULL AND pdf_file<>''
            """
            params = [title] + scripts
            rows = self.db.cursor.execute(q, params).fetchall()
            existing = [r[0] for r in rows if r[1]]
        to_include = [s for s in scripts if s not in existing]
        if not to_include:
            messagebox.showinfo("No New Data", "All rows already have a saved report for this tab; nothing new to export.")
            return
        df_export = df[df['script'].isin(to_include)]
        profile_email = self.profile.get("email", "")
        effective_email = profile_email or (df_export['email'].iloc[0] if not df_export.empty else None)
        path = self.pdf.save_pdf(df_export, folder, pbm, start, end, email=effective_email)
        rel = os.path.join(folder, os.path.basename(path))
        for s in to_include:
            self.db.cursor.execute("""
                INSERT INTO report_files(script, report_type, pdf_file)
                VALUES(?,?,?)
                ON CONFLICT(script,report_type) DO UPDATE SET pdf_file=excluded.pdf_file
            """, (s, title, rel))
            self.db.cursor.execute(f"UPDATE {self.db.QUOTED_USER_TABLE} SET pdf_file=? WHERE script=?", (rel, s))
        self.db.conn.commit()
        self._render_all(*self._current_controls())
        messagebox.showinfo("Saved", f"PDF saved to:\n{path}")

    def manual_email_dialog(self, start, end, flt, pbm):
        if pbm in ("All", "Federal"):
            self.set_status("Select a specific PBM to email.")
            return
        df = self.fetch_data(start, end, flt, pbm)
        if df.empty:
            self.set_status("No data to email.")
            return
        title = self.nb.tab(self.nb.select(), option='text')
        df_available = df[df.get('status', '') != 'emailed PBM']
        if df_available.empty:
            self.set_status("All displayed rows already marked as emailed.")
            return
        scripts_available = list(df_available['script'].dropna().unique())
        if not scripts_available:
            self.set_status("No scripts to email.")
            return
        placeholders = ",".join("?" for _ in scripts_available)
        df_reports = pd.read_sql_query(
            f"SELECT script, report_type, pdf_file FROM report_files WHERE script IN ({placeholders}) AND report_type=?",
            self.db.conn, params=scripts_available + [title]
        )
        pdf_to_scripts = {}
        for _, row in df_reports.iterrows():
            rel = row['pdf_file'] or ''
            if not rel:
                continue
            full = os.path.join(REPORT_DIR, rel)
            if not os.path.exists(full):
                continue
            pdf_to_scripts.setdefault(full, set()).add(row['script'])
        if not pdf_to_scripts:
            self.set_status("No saved report PDFs available for selection.")
            return
        dlg = tk.Toplevel(self.master)
        dlg.title("Select Reports to Email")
        ttk.Label(dlg, text=f"PBM: {pbm}    Tab: {title}", font=("Segoe UI", 10, "bold")).pack(anchor='w', padx=8, pady=(8,0))
        frame = ttk.Frame(dlg)
        frame.pack(fill='both', expand=True, padx=8, pady=4)
        var_map = {}
        for pdf_path, scripts in pdf_to_scripts.items():
            var = tk.BooleanVar(value=False)
            name = os.path.basename(pdf_path)
            display = f"{name}"
            cb = ttk.Checkbutton(frame, text=display, variable=var)
            cb.pack(anchor='w', pady=2)
            var_map[pdf_path] = (var, scripts)
        btn_frame = ttk.Frame(dlg)
        btn_frame.pack(fill='x', pady=8)
        def on_send():
            selected = [(pdf, scripts) for pdf,(v,scripts) in var_map.items() if v.get()]
            if not selected:
                messagebox.showwarning("No selection", "Please select at least one report to send.")
                return
            from_email = self.profile.get("email", "")
            row = self.db.cursor.execute("SELECT email FROM pbm_info WHERE pbm_name=?", (pbm,)).fetchone()
            to_email = row[0] if row else ""
            if not to_email:
                self.set_status(f"No email for PBM {pbm}")
                dlg.destroy()
                return
            subject = f"{pbm} {title} Report {start} to {end}"
            body = (f"Hello {pbm},\n\n"
                    f"Please find attached the selected report(s) for period {start} to {end}.\n\n"
                    "Regards,\nPharmacy Owedbook")
            attachments = [pdf for (pdf, _) in selected]
            # Only create and open .eml draft, do NOT try Outlook or mailto
            self.email.compose_email_with_attachments(
                to_email, subject, body, attachments, set_status=self.set_status
            )
            for _, scripts in selected:
                for script in scripts:
                    self.db.cursor.execute(f"UPDATE {self.db.QUOTED_USER_TABLE} SET status=? WHERE script=?", ("emailed PBM", script))
            self.db.conn.commit()
            self._render_all(*self._current_controls())
            dlg.destroy()
        ttk.Button(btn_frame, text="Send", command=on_send).pack(side='right', padx=4)
        ttk.Button(btn_frame, text="Cancel", command=dlg.destroy).pack(side='right')

    def _on_double(self, event, tree, cols):
        col = tree.identify_column(event.x)
        idx = int(col.lstrip('#')) - 1
        if cols[idx] == 'pdf_file':
            item = tree.identify_row(event.y)
            rel  = tree.set(item,'pdf_file')
            full = os.path.join(REPORT_DIR, rel)
            if rel and os.path.exists(full):
                os.startfile(full)

    def _render_all(self, fd, td, flt, pbm):
        df = self.fetch_data(fd, td, flt, pbm)
        self._update_action_buttons(flt, pbm)
        scripts = list(df['script'].dropna().unique())
        if scripts:
            placeholders = ",".join("?" for _ in scripts)
            df_reports = pd.read_sql_query(
                f"SELECT script, report_type, pdf_file FROM report_files WHERE script IN ({placeholders})",
                self.db.conn, params=scripts
            )
            for _, row in df_reports.iterrows():
                rpt = row['report_type']
                rel = row['pdf_file'] or ''
                if rel:
                    full = os.path.join(REPORT_DIR, rel)
                    if not os.path.exists(full):
                        self.db.cursor.execute("""
                            DELETE FROM report_files WHERE script=? AND report_type=?
                        """, (row['script'], rpt))
                        self.db.cursor.execute(
                            f"UPDATE {self.db.QUOTED_USER_TABLE} SET status='' WHERE script=?",
                            (row['script'],)
                        )
        self.db.conn.commit()
        if scripts:
            df_reports = pd.read_sql_query(
                f"SELECT script, report_type, pdf_file FROM report_files WHERE script IN ({placeholders})",
                self.db.conn, params=scripts
            )
            if not df_reports.empty:
                pivot = df_reports.pivot(index='script', columns='report_type', values='pdf_file')
                pivot = pivot.rename(columns={
                    'Commercial Dollars': 'pdf_commercial',
                    'Updated Commercial Payments': 'pdf_updated',
                    'Federal Dollars': 'pdf_federal',
                    'Summary': 'pdf_summary'
                }).fillna('')
                df = df.merge(pivot.reset_index(), on='script', how='left')
        for col in ('pdf_commercial','pdf_updated','pdf_federal','pdf_summary'):
            if col not in df.columns:
                df[col] = ''
        comm = df[df['pbm_name'] != 'Federal']
        underpaid_total = comm.loc[comm['difference'] < 0, 'difference'].sum()
        underpaid_amt = -underpaid_total if underpaid_total < 0 else 0.0
        script_count = comm['script'].nunique()
        updated_diff_total = comm['updated_diff'].fillna(0).infer_objects(copy=False).sum()
        owed = underpaid_amt - updated_diff_total
        # Update KPI labels with ttk
        self.lbl_underpaid_commercial.config(
            text=f"Commercial Underpaid: ${underpaid_amt:,.2f}",
            foreground="red"
        )
        self.lbl_script_count.config(text=f"Commercial Scripts: {script_count}")
        color_ud = "green" if updated_diff_total >= 0 else "red"
        self.lbl_updated_difference.config(text=f"Updated Difference: ${updated_diff_total:,.2f}", foreground=color_ud)
        self.lbl_owed.config(text=f"Owed: ${owed:,.2f}", foreground="red")
        if flt=='Underpaid' and pbm not in ('All','Federal'):
            row=self.db.cursor.execute("SELECT email FROM pbm_info WHERE pbm_name=?", (pbm,)).fetchone()
            self.current_email = row[0] if row else ''
            self.lbl_email.config(text=f"Email: {self.current_email}")
        else:
            self.current_email=''; self.lbl_email.config(text='')
        # Recreate all treeviews with ttk

        # --- Commercial Dollars (sortable) ---
        for w in self.f1.winfo_children(): w.destroy()
        cols_commercial = ['date_dispensed','script','qty','aac','method',
                           'expected_paid','total_paid','difference','pdf_file','status']
        hdrs_commercial = {
            'date_dispensed':'Date',
            'script':'Script',
            'qty':'Qty',
            'aac':'Medicaid Rate',
            'method':'Method',
            'expected_paid':'Expected',
            'total_paid':'Original Paid',
            'difference':'Owed',
            'pdf_file':'Report',
            'status':'Status'
        }
        tr1 = ttk.Treeview(self.f1, columns=cols_commercial, show='headings', style="Treeview")
        for c in cols_commercial:
            tr1.heading(c, text=hdrs_commercial[c]); tr1.column(c, width=80, anchor='center')
        tr1_data = []
        for _, r in df[df['pbm_name']!='Federal'].iterrows():
            owed_val = round(r['difference'],2)
            if flt!='All' and owed_val==0: continue
            report_ref = r.get('pdf_commercial', '')
            if pd.isna(report_ref):
                report_ref = ''
            status_val = r.get('status','') if not pd.isna(r.get('status','')) else ''
            vals = (
                r['date_dispensed'].strftime('%Y-%m-%d') if pd.notna(r['date_dispensed']) else '',
                r['script'],
                int(r['qty']) if pd.notna(r['qty']) else 0,
                f"{r['aac']:.2f}",
                r.get('method',''),
                f"{r['expected_paid']:.2f}",
                f"{r['total_paid']:.2f}",
                f"{owed_val:.2f}",
                report_ref,
                status_val
            )
            tr1.insert('', 'end', values=vals)
            tr1_data.append(dict(zip(cols_commercial, vals)))
        tr1.pack(fill='both', expand=True)
        tr1.bind("<Double-1>", lambda e, t=tr1, c=cols_commercial: self._on_double(e,t,c))
        col_types_1 = {
            'date_dispensed': None, 'script': None, 'qty': int, 'aac': float, 'method': None,
            'expected_paid': float, 'total_paid': float, 'difference': float, 'pdf_file': None, 'status': None
        }
        self._treeview_sort_handler(tr1, df, cols_commercial, col_types_1)

        # --- Updated Commercial Payments (sortable) ---
        for w in self.f2.winfo_children(): w.destroy()
        cols2 = ['date_dispensed','script','total_paid','new_paid','updated_diff','pdf_file']
        hdr2 = {
            'date_dispensed':'Date',
            'script':'Script',
            'total_paid':'Original Paid',
            'new_paid':'New Paid',
            'updated_diff':'Updated Difference',
            'pdf_file':'Report'
        }
        tr2 = ttk.Treeview(self.f2, columns=cols2, show='headings', style="Treeview")
        for c in cols2:
            tr2.heading(c, text=hdr2[c]); tr2.column(c, width=80, anchor='center')
        tr2_data = []
        df_upd = df[df['new_paid'].notna()]
        for _, r in df_upd.iterrows():
            report_ref = r.get('pdf_updated', '')
            if pd.isna(report_ref):
                report_ref = ''
            vals = (
                r['date_dispensed'].strftime('%Y-%m-%d') if pd.notna(r['date_dispensed']) else '',
                r['script'],
                f"{r['total_paid']:.2f}",
                f"{r['new_paid']:.2f}",
                f"{r.get('updated_diff', 0.0):.2f}",
                report_ref
            )
            tr2.insert('', 'end', values=vals)
            tr2_data.append(dict(zip(cols2, vals)))
        tr2.pack(fill='both', expand=True)
        tr2.bind("<Double-1>", lambda e, t=tr2, c=cols2: self._on_double(e,t,c))
        col_types_2 = {
            'date_dispensed': None, 'script': None, 'total_paid': float, 'new_paid': float,
            'updated_diff': float, 'pdf_file': None
        }
        self._treeview_sort_handler(tr2, df, cols2, col_types_2)

        # --- Federal Dollars (sortable) ---
        for w in self.f3.winfo_children(): w.destroy()
        cols_federal = ['date_dispensed','script','qty','aac',
                        'expected_paid','total_paid','difference','pdf_file']
        hdrs_federal = {
            'date_dispensed':'Date',
            'script':'Script',
            'qty':'Qty',
            'aac':'AAC',
            'expected_paid':'Expected',
            'total_paid':'Original Paid',
            'difference':'Diff',
            'pdf_file':'Report'
        }
        tr3 = ttk.Treeview(self.f3, columns=cols_federal, show='headings', style="Treeview")
        for c in cols_federal:
            tr3.heading(c, text=hdrs_federal[c]); tr3.column(c, width=80, anchor='center')
        tr3_data = []
        fed = df[df['pbm_name']=='Federal']
        for _, r in fed.iterrows():
            report_ref = r.get('pdf_federal', '')
            if pd.isna(report_ref):
                report_ref = ''
            vals = (
                r['date_dispensed'].strftime('%Y-%m-%d') if pd.notna(r['date_dispensed']) else '',
                r['script'],
                int(r['qty']) if pd.notna(r['qty']) else 0,
                f"{r['aac']:.2f}",
                f"{r['expected_paid']:.2f}",
                f"{r['total_paid']:.2f}",
                f"{r['difference']:.2f}",
                report_ref
            )
            tr3.insert('', 'end', values=vals)
            tr3_data.append(dict(zip(cols_federal, vals)))
        tr3.pack(fill='both', expand=True)
        tr3.bind("<Double-1>", lambda e, t=tr3, c=cols_federal: self._on_double(e,t,c))
        col_types_3 = {
            'date_dispensed': None, 'script': None, 'qty': int, 'aac': float,
            'expected_paid': float, 'total_paid': float, 'difference': float, 'pdf_file': None
        }
        self._treeview_sort_handler(tr3, df, cols_federal, col_types_3)

        # --- Summary ---
        for w in self.f4.winfo_children(): w.destroy()
        summary = df.groupby('pbm_name')['difference'].sum().reset_index()
        fed_sum = round(df.loc[df['pbm_name']=='Federal','difference'].sum(),2)
        tr4 = ttk.Treeview(self.f4, columns=['pbm_name','Commercial Dollars','Federal Dollars'], show='headings', style="Treeview")
        tr4.heading('pbm_name', text='PBM Name'); tr4.column('pbm_name', width=200, anchor='center')
        tr4.heading('Commercial Dollars', text='Commercial Dollars'); tr4.column('Commercial Dollars', width=150, anchor='center')
        tr4.heading('Federal Dollars', text='Federal Dollars'); tr4.column('Federal Dollars', width=150, anchor='center')
        total_com = 0.0
        for _, r in summary.iterrows():
            if r['pbm_name'] != 'Federal':
                cd = round(r['difference'],2)
                tr4.insert('', 'end', values=(r['pbm_name'], f"{cd:.2f}", ''))
                total_com += cd
            else:
                fd = round(r['difference'],2)
                tr4.insert('', 'end', values=(r['pbm_name'], '', f"{fd:.2f}"))
        tr4.insert('', 'end', values=('Total', f"{total_com:.2f}", f"{fed_sum:.2f}"))
        tr4.pack(fill='both', expand=True)

if __name__ == '__main__':
    root = root_class()
    db = DatabaseHelper(BASE_DIR,
                        inclusion_dir=INCLUSION_LIST_DIR,
                        default_aac=DEFAULT_AAC,
                        default_wac=DEFAULT_WAC,
                        default_pbm=DEFAULT_PBM)
    # Hide the main window while showing login
    root.withdraw()
    
    # Display login dialog
    login = LoginDialog(root, db)
    root.wait_window(login)
    
    if login.result is None:
        # Login was canceled or failed -- exit
        root.destroy()
    else:
        # Login successful -- show dashboard
        root.deiconify()
        app = ReimbursementComparer(root)
        root.mainloop()