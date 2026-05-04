"""pytest fixtures and shared test utilities."""
import os
import sys

# Ensure server modules are importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
