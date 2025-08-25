import tkinter as tk
from tkinter import ttk, messagebox

class LoginDialog(tk.Toplevel):
    def __init__(self, master, db_helper, *args, **kwargs):
        super().__init__(master, *args, **kwargs)
        self.title("Login")
        self.db_helper = db_helper
        self.resizable(False, False)
        self.username_var = tk.StringVar()
        self.password_var = tk.StringVar()
        self.result = None

        # Add "Pharmacy Books" title at the top
        title_label = ttk.Label(self, text="Pharmacy Books", font=("Segoe UI", 16, "bold"))
        title_label.pack(padx=20, pady=(20, 0))

        frm = ttk.Frame(self)
        frm.pack(padx=20, pady=20)
        ttk.Label(frm, text="Username:").grid(row=0, column=0, sticky="e", pady=4)
        ttk.Entry(frm, textvariable=self.username_var).grid(row=0, column=1, pady=4)
        ttk.Label(frm, text="Password:").grid(row=1, column=0, sticky="e", pady=4)
        ttk.Entry(frm, textvariable=self.password_var, show="*").grid(row=1, column=1, pady=4)
        ttk.Button(frm, text="Login", command=self.login).grid(row=2, column=0, pady=(10,0))
        ttk.Button(frm, text="Register", command=self.register).grid(row=2, column=1, pady=(10,0))

    def login(self):
        username = self.username_var.get().strip()
        password = self.password_var.get()
        if self.db_helper.validate_user(username, password):
            self.result = username
            self.destroy()
        else:
            messagebox.showerror("Login Failed", "Invalid username or password.")

    def register(self):
        username = self.username_var.get().strip()
        password = self.password_var.get()
        if not username or not password:
            messagebox.showwarning("Missing info", "Enter both username and password.")
            return
        if self.db_helper.create_user(username, password):
            messagebox.showinfo("Registered", "User registered! You can now log in.")
        else:
            messagebox.showerror("Register Failed", "Username already exists.")