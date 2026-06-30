"""
Base settings shared by every environment.

Environment-specific overrides live in dev.py / prod.py / test.py.
Values that change per environment or are secret are read from the
environment (via a .env file in local dev) using django-environ.
"""

from pathlib import Path

import environ

# services/backend/  (two levels up from this file: core/settings/base.py)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
env = environ.Env(
    DEBUG=(bool, False),
    SECRET_KEY=(str, ""),
    ALLOWED_HOSTS=(list, []),
)

# Load services/backend/.env if present (local dev). In prod, real env vars win.
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
]

# Local apps live under the `Apps` package. As milestones land, append here.
LOCAL_APPS = [
    "Apps.common",
    "Apps.accounts",
    "Apps.billing",
    "Apps.brands",
    "Apps.wallets",
    "Apps.products",
    "Apps.campaigns",
    "Apps.offers",
    "Apps.reservations",
    "Apps.receipts",
    "Apps.rebates",
    "Apps.reviews",
    "Apps.payouts",
    "Apps.notifications",
    "Apps.analytics",
    "Apps.admin_panel",
]

# Promotional referral reward (M1 "Invite Friends, Earn $5").
REFERRAL_BONUS_AMOUNT = env("REFERRAL_BONUS_AMOUNT", default="5.00")

# Public base URL used to build campaign URLs / QR payloads.
PUBLIC_BASE_URL = env("PUBLIC_BASE_URL", default="http://localhost:8000")

# Reservation system (spec 1.3): 7-day expiry + backend-controlled global cap.
RESERVATION_EXPIRY_DAYS = env.int("RESERVATION_EXPIRY_DAYS", default=7)
RESERVATION_GLOBAL_CAP = env.int("RESERVATION_GLOBAL_CAP", default=100_000)

# Receipts / fraud (spec 2.7): soft cap on a customer's concurrent open claims.
MAX_ACTIVE_CLAIMS = env.int("MAX_ACTIVE_CLAIMS", default=25)

# Reviews module (spec 2.4–2.6).
REVIEW_REWARD_AMOUNT = env("REVIEW_REWARD_AMOUNT", default="1.00")
REVIEW_PRODUCT_COOLDOWN_DAYS = env.int("REVIEW_PRODUCT_COOLDOWN_DAYS", default=90)
REVIEW_MAX_PER_RECEIPT = env.int("REVIEW_MAX_PER_RECEIPT", default=5)
REVIEW_SESSION_EXPIRY_DAYS = env.int("REVIEW_SESSION_EXPIRY_DAYS", default=7)
REVIEW_HOLD_DAYS = env.int("REVIEW_HOLD_DAYS", default=30)  # 1–2★ held window
REVIEW_AUTO_PUBLISH_MIN_RATING = env.int("REVIEW_AUTO_PUBLISH_MIN_RATING", default=3)

# AI seam for review prompt generation. Empty key → deterministic mock.
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", default="")
ANTHROPIC_MODEL = env("ANTHROPIC_MODEL", default="claude-3-5-sonnet-20241022")

OPENAI_API_KEY = env("OPENAI_API_KEY", default="")
OPENAI_MODEL = env("OPENAI_MODEL", default="gpt-4o")

GOOGLE_AI_API_KEY = env("GOOGLE_AI_API_KEY", default="")
GOOGLE_STUDIO_API_KEY = env("GOOGLE_STUDIO_API_KEY", default="")
GOOGLE_MODEL = env("GOOGLE_MODEL", default="gemini-1.5-pro")

# Internal receipt-OCR microservice (services/ai, FastAPI + Tesseract). On the
# compose network this is http://ai:8001. Empty -> run_ocr uses the deterministic
# mock. run_ocr also falls back to the mock if the service is unreachable.
AI_SERVICE_URL = env("AI_SERVICE_URL", default="")
AI_OCR_TIMEOUT = env.float("AI_OCR_TIMEOUT", default=30.0)


# Payouts: minimum customer withdrawal amount.
PAYOUT_MIN_AMOUNT = env("PAYOUT_MIN_AMOUNT", default="1.00")

# Notifications. Empty FCM key → push is mocked (logged) in dev.
FCM_SERVER_KEY = env("FCM_SERVER_KEY", default="")
NOTIFY_RECEIPT_REMINDER_AFTER_HOURS = env.int("NOTIFY_RECEIPT_REMINDER_AFTER_HOURS", default=24)
NOTIFY_REVIEW_REMINDER_AFTER_HOURS = env.int("NOTIFY_REVIEW_REMINDER_AFTER_HOURS", default=24)
NOTIFY_INACTIVE_AFTER_DAYS = env.int("NOTIFY_INACTIVE_AFTER_DAYS", default=14)
NOTIFY_DEDUPE_HOURS = env.int("NOTIFY_DEDUPE_HOURS", default=24)
NOTIFY_NEW_OFFER_DEDUPE_DAYS = env.int("NOTIFY_NEW_OFFER_DEDUPE_DAYS", default=7)

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    # CORS must run before anything that can generate a response (CommonMiddleware,
    # WhiteNoise in prod) so it can answer preflight OPTIONS requests itself and
    # attach Access-Control-* headers to every response, including errors.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"
ASGI_APPLICATION = "core.asgi.application"


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
# Local development defaults to SQLite (zero-config: a db.sqlite3 file in the
# project root). Production points DATABASE_URL at AWS RDS PostgreSQL, which
# always takes precedence here; prod.py additionally *requires* it and tunes
# connection pooling. Test settings force an isolated in-memory SQLite DB.
if env("DATABASE_URL", default=""):
    DATABASES = {"default": env.db_url("DATABASE_URL")}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


# ---------------------------------------------------------------------------
# Authentication / passwords
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Uploaded files (receipt images). Swap to S3 via django-storages in prod.
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# UUID primary keys are declared per-model; this is only the implicit default.
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ---------------------------------------------------------------------------
# Django REST Framework + OpenAPI
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    # Secure by default: endpoints require auth unless they opt out via AllowAny.
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    # Rate limiting. The "auth" scope guards brute-forceable endpoints
    # (login, register, password reset) via ScopedRateThrottle.
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", default="60/min"),
        "user": env("THROTTLE_USER", default="1000/hour"),
        "auth": env("THROTTLE_AUTH", default="10/min"),
        # Referral invites — abuse/spam control on the friend-invite endpoint.
        "invite": env("THROTTLE_INVITE", default="20/hour"),
    },
}

# Cache (backs DRF throttling). LocMem for dev; use Redis in production.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "nibblai-default",
    }
}

# ---------------------------------------------------------------------------
# JWT (simplejwt)
# ---------------------------------------------------------------------------
import datetime as _dt  # noqa: E402

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": _dt.timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": _dt.timedelta(days=1),
    # "Remember me" issues a longer-lived refresh token (see accounts.services).
    "REFRESH_TOKEN_REMEMBER_LIFETIME": _dt.timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ---------------------------------------------------------------------------
# Logging (structured, key=value style; level overridable via LOG_LEVEL)
# ---------------------------------------------------------------------------
LOG_LEVEL = env("LOG_LEVEL", default="INFO")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
        "Apps": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
    },
}


SPECTACULAR_SETTINGS = {
    "TITLE": "NibblAI API",
    "DESCRIPTION": "Backend API for the NibblAI rebate & review platform.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # Give the plan-slug choice set a stable component name to avoid
    # auto-naming collisions in the generated schema.
    "ENUM_NAME_OVERRIDES": {
        "PlanSlugEnum": "Apps.billing.models.Plan.Slug",
        "WalletKindEnum": "Apps.wallets.models.Wallet.Kind",
        "BookmarkKindEnum": "Apps.offers.models.Bookmark.Kind",
        # Campaign.Status and ReviewCampaign.Status share an identical value set,
        # so a single shared component name resolves the collision.
        "CampaignLifecycleStatusEnum": "Apps.campaigns.models.Campaign.Status",
        "SocialProviderEnum": "Apps.accounts.models.SocialAccount.Provider",
        "PayoutProviderEnum": "Apps.payouts.models.PayoutMethod.Provider",
        "ReviewStatusEnum": "Apps.reviews.models.Review.Status",
    },
}

# ---------------------------------------------------------------------------
# Email configuration
# ---------------------------------------------------------------------------
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="no-reply@nibblai.app")


# ---------------------------------------------------------------------------
# CORS (django-cors-headers)
# ---------------------------------------------------------------------------
# Browser frontends are served from a different origin than the API, so the API
# must echo explicit Access-Control-* headers or every cross-origin request is
# blocked by the same-origin policy. Origins are env-driven (comma-separated,
# full scheme+host, e.g. "https://app.joinnibbl.com"); dev.py adds localhost.
#
# Wildcard switch — TEMPORARY, for frontend development before the API domain is
# wired up everywhere. Safe ONLY because auth is JWT via the Authorization header
# (not cookies): with credentials disabled the browser permits a "*" origin, and
# Bearer tokens still work. It is INVALID combined with CORS_ALLOW_CREDENTIALS=True
# (the browser rejects "*" + credentials); prod.py raises at boot if both are set.
# When True, django-cors-headers ignores the allowlist/regex below and echoes "*".
# Lock this back to False and use the explicit allowlist for production.
CORS_ALLOW_ALL_ORIGINS = env.bool("CORS_ALLOW_ALL_ORIGINS", default=False)

# Explicit per-origin allowlist (used when CORS_ALLOW_ALL_ORIGINS is False).
# CorsMiddleware (placed first in MIDDLEWARE) answers preflight OPTIONS requests
# with 200 before auth runs, so preflights no longer 401.
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# Regex allowlist for origins that are dynamic and can't be enumerated — e.g.
# Vercel preview deploys (https://<branch>-<hash>.vercel.app). Comma-separated
# list of regexes, each one fully anchored so it can only match a real
# *.vercel.app host and NOT a look-alike like "https://vercel.app.evil.com".
#
# SECURITY: combined with CORS_ALLOW_CREDENTIALS=True, any host matching these
# patterns may make credentialed requests. Keep the patterns tight, and only
# trust domains whose subdomains you control (don't broaden beyond previews).
CORS_ALLOWED_ORIGIN_REGEXES = env.list("CORS_ALLOWED_ORIGIN_REGEXES", default=[])

# Send Access-Control-Allow-Credentials: true so the browser will expose
# responses to credentialed (cookie / Authorization) requests.
CORS_ALLOW_CREDENTIALS = env.bool("CORS_ALLOW_CREDENTIALS", default=True)

# Cache preflight results for 24h to cut down on repeat OPTIONS round-trips.
CORS_PREFLIGHT_MAX_AGE = env.int("CORS_PREFLIGHT_MAX_AGE", default=86400)

# The package's defaults already cover the methods and headers the frontend
# needs — methods: GET/POST/PUT/PATCH/DELETE/OPTIONS; headers: accept,
# authorization, content-type, origin, x-csrftoken, x-requested-with, etc.
# Extend CORS_ALLOW_HEADERS via the env list only if the frontend sends a
# custom header beyond those defaults.
_extra_cors_headers = env.list("CORS_EXTRA_ALLOW_HEADERS", default=[])
if _extra_cors_headers:
    from corsheaders.defaults import default_headers

    CORS_ALLOW_HEADERS = (*default_headers, *_extra_cors_headers)

