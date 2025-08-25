@echo off
REM change directory to your app folder
cd /d "C:\Users\fbtan\Manage Medical Dropbox\Frank Tant\PC (2)\Desktop\PBM Audit Tools\PharmacyBooks"

REM activate the venv
call venv\Scripts\activate

REM run the Python script
python pharmacybooks.py

REM keep window open if there’s an error
pause

