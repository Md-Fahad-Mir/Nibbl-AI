"""Production settings.

Everything sensitive is required from the environment (no insecure defaults).
Tuned to run inside a container behind a TLS-terminating reverse proxy / load
balancer (nginx, ALB, Cloudflare, etc.).
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import (
    ALLOWED_HOSTS,
    CORS_ALLOW_ALL_ORIGINS,
    CORS_ALLOW_CREDENTIALS,
    MIDDLEWARE,
    env,
)

DEBUG = False

# Fail fast on the one CORS combination browsers reject outright: a wildcard
# origin together with credentials. Catching it at boot beats silently serving
# responses the browser will discard. Use an explicit allowlist for credentials.
if CORS_ALLOW_ALL_ORIGINS and CORS_ALLOW_CREDENTIALS:
    raise ImproperlyConfigured(
        "CORS_ALLOW_ALL_ORIGINS=True cannot be combined with "
        "CORS_ALLOW_CREDENTIALS=True — browsers reject '*' with credentials. "
        "Set CORS_ALLOW_ALL_ORIGINS=False and use CORS_ALLOWED_ORIGINS instead."
    )

# ---------------------------------------------------------------------------
# Database — AWS RDS PostgreSQL (required; no SQLite fallback in production).
# ---------------------------------------------------------------------------
# Set DATABASE_URL to the RDS endpoint; enforce TLS with ?sslmode=require, e.g.
#   postgres://USER:PASS@nibblai.abc123.us-east-1.rds.amazonaws.com:5432/nibblai?sslmode=require
# env.db_url() raises ImproperlyConfigured if DATABASE_URL is unset, so prod
# refuses to start without a real database.
DATABASES = {"default": env.db_url("DATABASE_URL")}
# Persistent connections (RDS round-trips are costly); health-check a pooled
# connection before reuse so a recycled RDS connection can't serve a request.
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True

# ---------------------------------------------------------------------------
# Allowed hosts
# ---------------------------------------------------------------------------
# Keep loopback reachable so the container's own HEALTHCHECK (which hits the
# app on 127.0.0.1) is not rejected by Django's Host-header validation, even
# when operators set ALLOWED_HOSTS to only their public domain.
ALLOWED_HOSTS = list(dict.fromkeys([*ALLOWED_HOSTS, "127.0.0.1", "localhost"]))

# Origins trusted for CSRF on unsafe methods (Django admin login over HTTPS,
# etc.). Comma-separated, full scheme+host: "https://api.nibblai.app".
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# ---------------------------------------------------------------------------
# Security hardening — relies on TLS termination in front of the app.
# ---------------------------------------------------------------------------
# Trust the proxy's X-Forwarded-Proto header to know the original scheme.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Redirect HTTP→HTTPS at the app. Disable (SECURE_SSL_REDIRECT=False) only when
# an upstream proxy already forces HTTPS, to avoid redirect loops.
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
# Never redirect the health endpoint: orchestrators/LBs probe it over plain
# HTTP and must receive 200, not a 301 to HTTPS.
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/?$"]

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 30)  # 30 days
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# ---------------------------------------------------------------------------
# Static files — served by WhiteNoise from inside the app process.
# ---------------------------------------------------------------------------
# WhiteNoise sits immediately after SecurityMiddleware so it can serve the
# hashed, compressed static assets (admin + drf-spectacular UI) without a
# separate web server or S3 bucket.
MIDDLEWARE = list(MIDDLEWARE)
MIDDLEWARE.insert(
    MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,
    "whitenoise.middleware.WhiteNoiseMiddleware",
)

# Media (uploaded files). Defaults to local disk (the media_data volume).
# Flip USE_S3_MEDIA=True to use S3 — requires django-storages + boto3 in the
# image AND the EC2 role granted s3:PutObject on the media bucket.
if env.bool("USE_S3_MEDIA", default=False):
    _default_storage = {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        "OPTIONS": {
            "bucket_name": env("AWS_STORAGE_BUCKET_NAME", default="nibblai-media-prod"),
            "region_name": env("AWS_REGION", default="us-west-1"),
        },
    }
else:
    _default_storage = {"BACKEND": "django.core.files.storage.FileSystemStorage"}

STORAGES = {
    "default": _default_storage,
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# ---------------------------------------------------------------------------
# Cache — Redis (shared across gunicorn workers).
# ---------------------------------------------------------------------------
# DRF throttling counters live in the cache. With multiple gunicorn workers the
# per-process LocMemCache would let each worker keep its own counters, silently
# multiplying every rate limit by the worker count. A shared Redis fixes that.
REDIS_URL = env("REDIS_URL", default="")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
