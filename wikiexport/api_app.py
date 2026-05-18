"""Legacy compatibility layer for older launch commands.

This module keeps `uvicorn wikiexport.api_app:app` working by pointing to
the current FastAPI application defined in `app.main`.
"""

from app.main import app
