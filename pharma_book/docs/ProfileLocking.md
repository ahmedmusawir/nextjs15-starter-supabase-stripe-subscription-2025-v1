# Profile Locking Plan (Desktop + Web)

This document defines how to lock sensitive identity fields in the desktop app and how the `pharmacy_id` anchors multi‑tenant security in the web version.

## Desktop (Tkinter) – Lock after first save

Fields to lock: `npi`, `ncpdp`, optionally `pharmacy_name`.

Implementation sketch in `pharmacybooks.py` where the Profile dialog is constructed:

```python
# After loading profile row
locked = bool(profile_row and (profile_row.get('npi') or profile_row.get('ncpdp')))

# When creating Entry widgets
npi_entry = ttk.Entry(parent)
npi_entry.insert(0, profile_row.get('npi', ''))
if locked:
    npi_entry.state(['disabled'])  # or npi_entry.configure(state='disabled')

ncpdp_entry = ttk.Entry(parent)
ncpdp_entry.insert(0, profile_row.get('ncpdp', ''))
if locked:
    ncpdp_entry.state(['disabled'])

name_entry = ttk.Entry(parent)
name_entry.insert(0, profile_row.get('pharmacy_name', ''))
if locked:  # optional
    name_entry.state(['disabled'])

# On Save: ignore disabled fields and persist only editable ones
```

UX: disabled fields appear greyed‑out; optionally add a small note: "Contact admin to change pharmacy identity".

## Web (Supabase + Next.js)

- `pharma_pharmacy_profile.pharmacy_id UUID` is the tenant anchor.
- `pharma_pharmacy_members (pharmacy_id, user_id)` links users to a pharmacy.
- Row Level Security policies (see `README_DDL.sql`) ensure users access only rows where they are members.
- Web UI should render `npi`, `ncpdp`, and `pharmacy_name` as read‑only once set; allow admins to edit via a protected route.

## Migration notes

- During SQLite → Supabase migration, generate one `pharmacy_id` and stamp it on tenant rows.
- Consider adding audit fields later (`created_by`, `updated_by`).
