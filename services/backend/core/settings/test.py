"""Test settings — fast and isolated."""

import tempfile

from .base import *  # noqa: F401,F403
from .base import REST_FRAMEWORK

DEBUG = False

# Uploaded files (receipt photos, avatars) go to a throwaway directory so the
# suite never writes into the real media/ tree.
MEDIA_ROOT = tempfile.mkdtemp(prefix="nibblai-test-media-")

# Always use an isolated in-memory SQLite database for the test suite — never
# touch a real database, even if DATABASE_URL is exported in the environment.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Speed up the test suite (no need for slow password hashing).
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Provide a deterministic key so tests never depend on a local .env.
SECRET_KEY = "test-secret-key-not-for-production"

# Disable throttling so the suite is deterministic. Keep the rate *keys*
# (set to None) so view-level ScopedRateThrottle("auth") doesn't raise; a
# dedicated test re-enables a tiny rate via override_settings.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_THROTTLE_RATES": {
        "anon": None, "user": None, "auth": None, "invite": None,
    },
}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Ensure tests run fully offline without calling external APIs by default
ANTHROPIC_API_KEY = ""
OPENAI_API_KEY = ""
GOOGLE_AI_API_KEY = ""
GOOGLE_STUDIO_API_KEY = ""


