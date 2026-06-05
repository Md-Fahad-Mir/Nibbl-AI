# NibblAI Backend — Deployment & Testing Checklist

**Complete checklist for handover, testing, and production deployment.**

---

## Pre-Testing Setup (Local Development)

### Installation & Database

- [ ] Clone repository
- [ ] Install dependencies: `uv sync`
- [ ] Copy env template: `cp .env.example .env`
- [ ] Update `.env` with local settings:
  ```bash
  SECRET_KEY=dev-insecure-change-me
  DEBUG=True
  DATABASE_URL=postgres://nibblai:nibblai@127.0.0.1:5432/nibblai
  ```
- [ ] Start Postgres: `docker compose up -d db`
- [ ] Run migrations: `python manage.py migrate`
- [ ] Seed dummy data: `python manage.py seed_nibblai --users 10 --brands 5`
- [ ] Create superuser: `python manage.py createsuperuser`
- [ ] Run tests: `python manage.py test --settings=core.settings.test`
  - Expected: **200 tests pass** (2 Postgres concurrency tests skip on SQLite)

---

## Local Testing Guide

### 1. Start the Development Server

```bash
python manage.py runserver
```

**Expected output:**
```
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

### 2. Access API Documentation

- **Swagger UI:** http://localhost:8000/api/docs/
- **ReDoc:** http://localhost:8000/api/redoc/
- **OpenAPI Schema:** http://localhost:8000/api/schema/

### 3. Run API Tests (Using Quick API Reference)

**Reference:** [QUICK_API_REFERENCE.md](QUICK_API_REFERENCE.md)

**Option A: Using Postman**
1. Import Postman collection (when generated)
2. Set environment to "NibblAI Development"
3. Run the 20-step end-to-end flow

**Option B: Using curl**
```bash
# 1. Register user
curl -X POST http://localhost:8000/api/v1/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "email": "test@example.com",
    "password": "TestPass123!",
    "accept_terms": true
  }'

# 2. Verify email
curl -X POST http://localhost:8000/api/v1/auth/verify-email/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "code": "123456"
  }'

# 3. Login
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
# Copy access token from response
```

### 4. Database Inspection

**Access Django admin:**
```
http://localhost:8000/admin/
Email: (superuser email)
Password: (superuser password)
```

**Query database directly:**
```bash
psql postgres://nibblai:nibblai@127.0.0.1:5432/nibblai
SELECT * FROM accounts_user;
SELECT * FROM brands_brand;
SELECT * FROM campaigns_campaign;
```

---

## Pre-Production Testing

### Code Quality

- [ ] **Tests Pass**
  ```bash
  python manage.py test --settings=core.settings.test
  # Expected: 200 OK
  ```

- [ ] **No Migrations Pending**
  ```bash
  python manage.py makemigrations --check --dry-run
  # Expected: No changes detected
  ```

- [ ] **Schema Valid**
  ```bash
  python manage.py spectacular --validate --file /tmp/schema.yml
  # Expected: 0 errors, 0 warnings
  ```

- [ ] **Code Checks Pass**
  ```bash
  python manage.py check --deploy --settings=core.settings.prod
  # Expected: System check identified no issues (0 silenced)
  ```

### API Coverage

- [ ] All **140+ endpoints** tested:
  - Follow [Complete Testing Flow](API_TESTING_GUIDE.md#phase-4-complete-testing-flow) (20 steps)
  - Or use Postman collection (when generated)

### Authentication

- [ ] **Registration flow** works
  - Register → Verify email → Login ✓
- [ ] **JWT tokens** work
  - Access token valid for 30 min ✓
  - Refresh token works ✓
  - Token expiry handled correctly ✓
- [ ] **Password reset** works
  - Request code → Reset password ✓
- [ ] **Logout** works
  - Token blacklisted after logout ✓

### Core Business Flows

- [ ] **Brand Management**
  - Create brand → Add members → Configure → Manage products ✓

- [ ] **Campaign Lifecycle**
  - Create → Fund wallet → Activate → Track budget ✓

- [ ] **Customer Rewards**
  - Upload receipt → Match items → Reserve reward → Redeem ✓

- [ ] **Reviews**
  - Create campaign → Generate prompts → Customer submits ✓

- [ ] **Payouts**
  - Request withdrawal → Admin approves → Processed ✓

### Tenant Isolation

- [ ] **Brand isolation** verified
  ```bash
  # User B cannot access Brand A resources
  curl -X GET http://localhost:8000/api/v1/brands/brand-a-id/ \
    -H "Authorization: Bearer user-b-token"
  # Expected: 403 Forbidden
  ```

- [ ] **Data visibility** gated by role
  - Admin sees all data ✓
  - Brand member sees only their data ✓
  - Customer sees only their data ✓

### Rate Limiting

- [ ] **Login throttling** works
  ```bash
  # Send 11+ login attempts in 1 minute
  for i in {1..15}; do
    curl -X POST http://localhost:8000/api/v1/auth/login/ ...
  done
  # Expected: Last attempts get 429 Too Many Requests
  ```

### Plan-Based Access

- [ ] **Starter plan** anonymizes customer data ✓
- [ ] **Pro/Scale plans** show full customer data ✓

---

## Production Environment Setup

### Configuration

- [ ] **Settings updated** for production:
  ```bash
  DJANGO_SETTINGS_MODULE=core.settings.prod
  SECRET_KEY={strong-random-key}  # Use: python -c "import secrets; print(secrets.token_urlsafe(64))"
  DEBUG=False
  ALLOWED_HOSTS=api.nibblai.app,www.nibblai.app
  ```

- [ ] **Database configured**
  ```bash
  DATABASE_URL=postgres://user:pass@db-host:5432/nibblai_prod
  # Test: psql $DATABASE_URL -c "SELECT 1"
  ```

- [ ] **Cache configured** (Redis)
  ```bash
  REDIS_URL=redis://cache-host:6379/0
  # Test: redis-cli -u $REDIS_URL PING
  ```

- [ ] **Email configured** (SendGrid, SES, or Postmark)
  ```bash
  EMAIL_HOST_USER=sendgrid-api-key@
  EMAIL_HOST_PASSWORD=SG.xxx...
  # Test: Send test email via Django admin
  ```

### Security

- [ ] **SSL/TLS enabled** (HTTPS only)
- [ ] **SECURE_SSL_REDIRECT=True**
- [ ] **SESSION_COOKIE_SECURE=True**
- [ ] **CSRF_COOKIE_SECURE=True**
- [ ] **SECURE_HSTS_SECONDS=31536000** (1 year)
- [ ] **CORS properly configured** (specify allowed origins)
- [ ] **SECRET_KEY is strong** (50+ chars, random)
- [ ] **No secrets in code** (use `.env.example` only)

### Database & Migrations

- [ ] **Production database created**
  ```bash
  createdb nibblai_prod
  ```

- [ ] **Migrations applied**
  ```bash
  python manage.py migrate --settings=core.settings.prod
  ```

- [ ] **Initial data created**
  - Plans created (Starter, Pro, Scale)
  - Admin user created
  - Demo brands created (optional)

### Monitoring & Logging

- [ ] **Error tracking configured** (Sentry, DataDog, etc.)
- [ ] **Structured logging enabled**
  ```bash
  LOG_LEVEL=INFO
  ```
- [ ] **Uptime monitoring configured**
- [ ] **Health check endpoint responds**
  ```bash
  curl https://api.nibblai.app/api/v1/health/
  # Expected: {"status":"ok"}
  ```

### Optional Integrations

If using these features, configure:

- [ ] **AI providers** (if using reviews)
  - `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`
  - Test: Create review campaign, generate prompts

- [ ] **Push notifications** (if using FCM)
  - `FCM_SERVER_KEY`
  - Test: Register device token, send notification

- [ ] **Email provider** (already covered above)
  - Test: Send verification email

- [ ] **S3 storage** (if storing receipts in cloud)
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_STORAGE_BUCKET_NAME`
  - Test: Upload receipt image

---

## Production Deployment

### Pre-Deployment

- [ ] **Code reviewed** (no security issues)
- [ ] **All tests pass** locally
- [ ] **Database backup created**
- [ ] **Deployment plan documented**
- [ ] **Team informed** of deployment window

### Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
uv sync

# 3. Run migrations
python manage.py migrate --settings=core.settings.prod

# 4. Collect static files
python manage.py collectstatic --noinput --settings=core.settings.prod

# 5. Run pre-deployment checks
python manage.py check --deploy --settings=core.settings.prod

# 6. Validate schema
python manage.py spectacular --validate --settings=core.settings.prod

# 7. Restart application
supervisorctl restart nibblai-api
# or: systemctl restart gunicorn-nibblai
# or: docker restart nibblai-backend
```

### Post-Deployment

- [ ] **Health check passing**
  ```bash
  curl -I https://api.nibblai.app/api/v1/health/
  # Expected: 200 OK
  ```

- [ ] **API responding**
  ```bash
  curl -I https://api.nibblai.app/api/docs/
  # Expected: 200 OK
  ```

- [ ] **Errors being logged** (check error tracking)
- [ ] **Metrics being collected** (check monitoring dashboard)
- [ ] **Users can log in** (test manually with a browser)

### Monitoring

After deployment, monitor:

- [ ] **Error rate** < 1%
- [ ] **Response time** < 500ms p95
- [ ] **CPU usage** < 70%
- [ ] **Memory usage** < 80%
- [ ] **Database connections** stable
- [ ] **Cache hit rate** > 80%

---

## Testing Documentation

**For detailed testing information, see:**

1. **[API_TESTING_GUIDE.md](API_TESTING_GUIDE.md)**
   - Complete 8-phase testing guide
   - Dummy data setup instructions
   - 140+ endpoint documentation
   - 20-step end-to-end testing flow
   - Authentication flow details

2. **[QUICK_API_REFERENCE.md](QUICK_API_REFERENCE.md)**
   - Quick endpoint reference table
   - Status codes and error messages
   - Example curl commands

3. **[SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md)** (from earlier)
   - How to manage API keys and credentials
   - Secret rotation procedures

---

## Handover Checklist (For Frontend/Mobile Teams)

**Before handover, ensure:**

- [ ] **All docs updated**
  - API_TESTING_GUIDE.md ✓
  - QUICK_API_REFERENCE.md ✓
  - Backend README.md ✓

- [ ] **API running** and accessible
  - Swagger docs available
  - All endpoints responding

- [ ] **Test data available**
  - Seed script provided: `python manage.py seed_nibblai`
  - Sample credentials provided
  - Postman collection provided

- [ ] **Authentication working**
  - OAuth / social login configured (if used)
  - JWT tokens being issued correctly

- [ ] **Support plan in place**
  - Slack channel for questions
  - Backend developer assigned
  - Issue tracking set up

---

## Quick Commands Reference

```bash
# Setup
uv sync                                          # Install dependencies
python manage.py migrate                         # Apply migrations
python manage.py createsuperuser                 # Create admin
python manage.py seed_nibblai                    # Populate dummy data

# Development
python manage.py runserver                       # Start dev server
python manage.py test --settings=core.settings.test  # Run tests
python manage.py test --settings=core.settings.test Apps.accounts  # Test single app

# Database
python manage.py dbshell                         # Open database shell
python manage.py makemigrations --check --dry-run  # Check for unmigrated changes
python manage.py migrate --plan                  # Show migration plan

# Deployment
python manage.py migrate --settings=core.settings.prod  # Migrate prod
python manage.py collectstatic --noinput --settings=core.settings.prod  # Collect static
python manage.py check --deploy --settings=core.settings.prod  # Pre-deploy check
python manage.py spectacular --validate --settings=core.settings.prod  # Validate schema

# Troubleshooting
python manage.py shell                           # Interactive shell
python -m pytest --help                          # Pytest options (if using pytest)
python manage.py dumpdata > backup.json          # Backup database
```

---

## Troubleshooting

### Common Issues

**"ModuleNotFoundError" on startup**
```bash
uv sync  # Reinstall dependencies
```

**"Database connection refused"**
```bash
docker compose up -d db  # Start Postgres
# or check ALLOWED_HOSTS, DB_PASSWORD, etc.
```

**"Token is invalid or expired"**
```
Frontend should use refresh token to get new access token
POST /api/v1/auth/token/refresh/ with refresh token
```

**"Verification code not received"**
```
Dev: Check server console output (EMAIL_BACKEND=console)
Prod: Check email provider (SendGrid, SES) logs
```

**"Rate limit exceeded (429)"**
```
Wait 1 minute before retrying
Check THROTTLE_* settings if limits are too strict
```

**"Permission denied (403)"**
```
Check user role and brand membership
Ensure user is authenticated (has valid access token)
```

---

## Support & Escalation

### Contact

| Role | Contact | Availability |
|------|---------|--------------|
| Backend Lead | (contact) | (hours) |
| DevOps | (contact) | (hours) |
| Database Admin | (contact) | (hours) |

### Escalation Path

1. Check documentation ([API_TESTING_GUIDE.md](API_TESTING_GUIDE.md))
2. Ask in Slack (dev-support channel)
3. Open GitHub issue
4. Contact Backend Lead

---

## Success Criteria

### Testing Complete When:

- ✅ All 140+ endpoints tested and working
- ✅ 20-step end-to-end flow successful
- ✅ Authentication (register → login → token refresh) working
- ✅ Core business flows working (campaigns, receipts, rewards, reviews)
- ✅ Rate limiting active
- ✅ Tenant isolation verified
- ✅ Plan-based access gating working
- ✅ All 200 unit tests passing
- ✅ Schema validation clean (0 errors, 0 warnings)
- ✅ Deployment check passing
- ✅ Documentation complete and reviewed

### Ready for Production When:

- ✅ All testing complete
- ✅ Security audit passed
- ✅ Performance benchmarks met
- ✅ Monitoring & alerting configured
- ✅ Backup & disaster recovery tested
- ✅ Team trained on system
- ✅ Runbooks written
- ✅ Support plan in place

---

**Generated:** 2026-06-05  
**Status:** Production-Ready 🚀  
**Last Updated:** As documented above
