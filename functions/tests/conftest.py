# Ensure the functions/lib package ("lib") is importable when tests executed from repo root.
import sys
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# ROOT points to functions/ directory; add to sys.path if not already
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
