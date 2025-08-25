import re

def safe_filename(s):
    """
    Replace unsafe characters in filename with underscores.
    This helps avoid problems with saving files on different OSes.
    """
    return re.sub(r'[\\/*?:"<>|]', "_", str(s))