import os
import sqlite3
import pandas as pd
import hashlib

class DatabaseHelper:
    def __init__(self, base_dir, inclusion_dir=None, default_aac=None, default_wac=None, default_pbm=None):
        self.base_dir = base_dir
        self.db_path = os.path.join(base_dir, "app.db")
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
        self.QUOTED_USER_TABLE = '"user_data"'
        # Inclusion file paths
        self.inclusion_dir = inclusion_dir or os.path.join(base_dir, "inclusion_lists")
        self.default_aac = default_aac or os.path.join(self.inclusion_dir, "inclusion_AAClist.xlsx")
        self.default_wac = default_wac or os.path.join(self.inclusion_dir, "inclusion_WACMckFullLoad.csv")
        self.default_pbm = default_pbm or os.path.join(self.inclusion_dir, "inclusion_PBMlist.xlsx")
        self.ensure_tables()
        self.ensure_users_table()  # Ensure user table for authentication

    def ensure_tables(self):
        # Main user data table
        self.cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS user_data (
                script TEXT PRIMARY KEY,
                date_dispensed TEXT,
                drug_ndc TEXT,
                drug_name TEXT,
                qty REAL,
                total_paid REAL,
                new_paid REAL,
                bin TEXT,
                pdf_file TEXT,
                status TEXT
            )
        """)
        # PBM info table
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS pbm_info (
                bin TEXT,
                pbm_name TEXT,
                email TEXT
            )
        """)
        # Baseline table
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS baseline (
                ndc TEXT PRIMARY KEY,
                aac REAL
            )
        """)
        # Alternate rates table
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS alt_rates (
                ndc TEXT PRIMARY KEY,
                wac REAL,
                pkg_size REAL,
                pkg_size_mult REAL,
                generic_indicator TEXT
            )
        """)
        # Report files table
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS report_files (
                script TEXT,
                report_type TEXT,
                pdf_file TEXT,
                PRIMARY KEY (script, report_type)
            )
        """)
        # Pharmacy profile table
        self.cursor.execute("""
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
        self.conn.commit()

    # --- USER LOGIN SYSTEM ---

    def ensure_users_table(self):
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password_hash TEXT
            )
        """)
        self.conn.commit()

    def hash_password(self, password):
        return hashlib.sha256(password.encode('utf-8')).hexdigest()

    def create_user(self, username, password):
        password_hash = self.hash_password(password)
        try:
            self.cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, password_hash))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def validate_user(self, username, password):
        password_hash = self.hash_password(password)
        row = self.cursor.execute("SELECT password_hash FROM users WHERE username=?", (username,)).fetchone()
        return row and row[0] == password_hash

    # --- END USER LOGIN SYSTEM ---

    def load_pbm(self):
        if not os.path.exists(self.default_pbm):
            return
        dfp = pd.read_excel(self.default_pbm, dtype=str)
        dfp.columns = dfp.columns.str.strip()
        dfp['BIN']      = dfp['BIN'].astype(str).str.strip()
        dfp['PBM NAME'] = dfp['PBM NAME'].astype(str).str.strip()
        email_col = next((c for c in dfp.columns if 'email' in c.lower()), None)
        dfp['email'] = dfp[email_col].astype(str).str.strip() if email_col else ''
        dfp = dfp.rename(columns={'BIN':'bin','PBM NAME':'pbm_name'})
        dfp[['bin','pbm_name','email']].to_sql("pbm_info", self.conn, if_exists="replace", index=False)

    def load_baseline(self):
        if not os.path.exists(self.default_aac):
            return
        dfb = pd.read_excel(self.default_aac, dtype=str)
        dfb.columns = dfb.columns.str.strip().str.lower()
        dfb['ndc'] = dfb['ndc'].astype(str).str.replace(r'\D+', '', regex=True)
        dfb['aac'] = pd.to_numeric(dfb['aac'], errors='coerce').fillna(0.0)
        dfb.to_sql("baseline", self.conn, if_exists="replace", index=False)

    def load_alt_rates(self):
        if not os.path.exists(self.default_wac):
            return
        dfw_raw = pd.read_csv(self.default_wac, dtype=str, engine='python', on_bad_lines='skip')
        lc = {c.strip().lower(): c for c in dfw_raw.columns}
        ndc_col = next((o for low,o in lc.items() if 'ndc' in low and 'date' not in low), None)
        wac_col = next((o for low,o in lc.items() if 'wac' in low), None)
        pkg_col = next((o for low,o in lc.items() if 'package size' in low), None)
        mult_col= next((o for low,o in lc.items() if 'multiplier' in low), None)
        generic_col = next((o for low,o in lc.items() if 'generic' in low and 'indicator' in low), None)

        mapping = {}
        if ndc_col:      mapping[ndc_col]        = 'ndc'
        if wac_col:      mapping[wac_col]        = 'wac'
        if pkg_col:      mapping[pkg_col]        = 'pkg_size'
        if mult_col:     mapping[mult_col]       = 'pkg_size_mult'
        if generic_col:  mapping[generic_col]    = 'generic_indicator'

        dfw = dfw_raw.rename(columns=mapping)

        for col in ('wac','pkg_size','pkg_size_mult'):
            dfw[col] = pd.to_numeric(dfw.get(col, 0), errors='coerce').fillna(0.0)
        dfw['ndc'] = dfw.get('ndc','').astype(str).str.replace(r'\D+', '', regex=True)

        if 'generic_indicator' in dfw.columns:
            dfw['generic_indicator'] = dfw['generic_indicator'].astype(str).str.strip()
        else:
            dfw['generic_indicator'] = ''

        dfw.to_sql("alt_rates", self.conn, if_exists="replace", index=False)

    def get_profile(self):
        self.ensure_tables()
        self.cursor.execute("SELECT * FROM pharmacy_profile WHERE id=1")
        row = self.cursor.fetchone()
        if row:
            d = dict(row)
            d.pop("id", None)
            return d
        else:
            self.cursor.execute("INSERT INTO pharmacy_profile (id) VALUES (1)")
            self.conn.commit()
            return {
                "pharmacy_name": "",
                "address": "",
                "phone": "",
                "fax": "",
                "email": "",
                "ncpdp": "",
                "npi": "",
                "contact_person": ""
            }

    def set_profile(self, profile_dict):
        self.ensure_tables()
        self.cursor.execute("SELECT id FROM pharmacy_profile WHERE id=1")
        if self.cursor.fetchone():
            set_clause = ", ".join([f"{k}=?" for k in profile_dict])
            values = [profile_dict.get(k, "") for k in profile_dict]
            self.cursor.execute(f"UPDATE pharmacy_profile SET {set_clause} WHERE id=1", values)
        else:
            cols = ", ".join(profile_dict.keys())
            q_marks = ", ".join("?" for _ in profile_dict)
            values = [profile_dict.get(k, "") for k in profile_dict]
            self.cursor.execute(f"INSERT INTO pharmacy_profile (id, {cols}) VALUES (1, {q_marks})", values)
        self.conn.commit()

    def insert_or_update_user_data(self, row):
        existing = self.cursor.execute(
            f"SELECT total_paid FROM {self.QUOTED_USER_TABLE} WHERE script=?", (row['script'],)
        ).fetchone()
        if existing is None:
            self.cursor.execute(f"""
                INSERT INTO {self.QUOTED_USER_TABLE}(script,date_dispensed,drug_ndc,drug_name,qty,total_paid,new_paid,bin)
                VALUES(?,?,?,?,?,?,NULL,?)
            """, (row['script'], row['date_dispensed'], row['drug_ndc'],
                  row['drug_name'], row['qty'], row['total_paid'], row['bin']))
        else:
            orig = existing[0]
            if row['total_paid'] != orig:
                self.cursor.execute(f"""
                    UPDATE {self.QUOTED_USER_TABLE}
                    SET date_dispensed=?, drug_ndc=?, drug_name=?, qty=?, new_paid=?, bin=?
                    WHERE script=?
                """, (row['date_dispensed'], row['drug_ndc'], row['drug_name'],
                      row['qty'], row['total_paid'], row['bin'], row['script']))
        self.conn.commit()

    def update_user_status(self, script, status):
        self.cursor.execute(
            f"UPDATE {self.QUOTED_USER_TABLE} SET status=? WHERE script=?",
            (status, script)
        )
        self.conn.commit()

    def get_report_file(self, script, report_type):
        self.cursor.execute(
            "SELECT pdf_file FROM report_files WHERE script=? AND report_type=?",
            (script, report_type)
        )
        row = self.cursor.fetchone()
        return row['pdf_file'] if row else None

    def insert_report_file(self, script, report_type, pdf_file):
        self.cursor.execute(
            """
            INSERT INTO report_files (script, report_type, pdf_file)
            VALUES (?, ?, ?)
            ON CONFLICT(script, report_type) DO UPDATE SET pdf_file=excluded.pdf_file
            """,
            (script, report_type, pdf_file)
        )
        self.conn.commit()

    def get_pbm_emails(self):
        df = pd.read_sql_query("SELECT pbm_name, email FROM pbm_info", self.conn)
        return dict(zip(df['pbm_name'], df['email']))

    def get_scripts_by_status(self, status):
        self.cursor.execute(
            f"SELECT script FROM {self.QUOTED_USER_TABLE} WHERE status=?",
            (status,)
        )
        return [row['script'] for row in self.cursor.fetchall()]

    def remove_report_file(self, script, report_type):
        self.cursor.execute(
            "DELETE FROM report_files WHERE script=? AND report_type=?",
            (script, report_type)
        )
        self.conn.commit()

    def fetch_user_data_between_dates(self, start_date, end_date):
        query = f"SELECT * FROM {self.QUOTED_USER_TABLE} WHERE date_dispensed BETWEEN ? AND ?"
        return pd.read_sql_query(query, self.conn, params=(start_date, end_date))

    def fetch_table(self, table, cols='*', where=None, params=None):
        sql = f"SELECT {cols} FROM {table}"
        if where:
            sql += f" WHERE {where}"
        return pd.read_sql_query(sql, self.conn, params=params)

    def close(self):
        self.conn.close()