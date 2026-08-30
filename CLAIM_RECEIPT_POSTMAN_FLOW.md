# Claim → Receipt → OCR → Reward: Backend Flow & Postman Guide

Backend reference for the flow that runs **after** a logged-in customer taps *Claim* on an
active campaign.

Every endpoint, field name, status code and message in this document was read from the
source and then **verified by executing the flow** against the running backend and the live
OCR service. Response bodies below are real captured output (IDs and tokens replaced).

**Base URL used in examples:** `{{base_url}}` → e.g. `https://api.joinnibbl.com`
All API paths are prefixed `/api/v1/`.

> **Example data notice.** Product `Dark Chocolate Bar 100g`, shop `Fahad Chocolate Shop`,
> receipt `INV-12345` and reward `2.00` are **example values** used throughout. UUIDs are
> illustrative. Note the wallet `currency` field currently defaults to `"USD"`
> (`Apps/wallets/models.py`) even though the business examples are written in BDT — the
> reward arithmetic is currency-agnostic.

---

## Table of contents

1. [Complete flow overview](#1--complete-flow-overview)
2. [Claim API](#2--claim-api)
3. [Claim details API](#3--claim-details-api)
4. [Receipt upload URL](#4--receipt-upload-url)
5. [OCR API](#5--ocr-api)
6. [OCR JSON → receipt validation](#6--ocr-json--receipt-validation)
7. [Product matching](#7--product-matching)
8. [Shop / vendor matching](#8--shop--vendor-matching)
9. [Date & time validation](#9--date--time-validation)
10. [Receipt fingerprint / hash](#10--receipt-fingerprint--hash)
11. [Duplicate receipt](#11--duplicate-receipt)
12. [Reward processing](#12--reward-processing)
13. [Wallet credit](#13--wallet-credit)
14. [Error cases](#14--error-cases)
15. [Complete Postman testing guide](#15--complete-postman-testing-guide)
16. [End-to-end example](#16--end-to-end-example)
17. [Duplicate end-to-end example](#17--duplicate-end-to-end-example)
18. [Not currently implemented](#18--not-currently-implemented)

---

## 1 — Complete flow overview

### Flow diagram (actual implementation)

```
Customer (authenticated, JWT)
   │
   ▼
GET  /api/v1/offers/                     ← active campaigns feed
   │  copy campaign_id
   ▼
POST /api/v1/reservations/               ← THE CLAIM  {"campaign": "<campaign_id>"}
   │  creates Reservation (status=active, 7-day expiry)
   │  escrows the reward as a Hold on the BRAND wallet
   │  starts the per-campaign cooldown (premium offers)
   ▼
GET  /api/v1/reservations/{id}/          ← CLAIM DETAILS
   │  returns reward_amount, product_name, brand_name,
   │          receipt_upload_url, receipt_status
   ▼
POST /api/v1/receipts/                   ← RECEIPT UPLOAD (multipart)
   │  fields: reservation + image
   │
   ├─► backend → Receipt Intelligence API (server-to-server, URL from .env)
   │      POST {RECEIPT_OCR_API_URL}/api/v1/receipts/extract
   │   ◄── OCR JSON
   │
   ├─► map provider JSON → internal fields
   ├─► VALIDATE  shop      → mismatch  = 400 reject
   ├─►           date/time → outside   = 400 reject | unreadable = manual review
   ├─►           product   → wrong     = 400 reject | unrecognised = manual review
   │
   ├─► FINGERPRINT  SHA-256(product|shop|date|time|receipt_no)
   ├─► DUPLICATE    INSERT against a UNIQUE index → conflict = 409
   │
   ├─► VERIFY   Receipt.status = "verified"
   │      └─ signal receipt_verified → rebates.issue_reward()
   │             ├─ capture brand Hold  (brand pays the reward)
   │             ├─ CREDIT customer wallet  ← WALLET CREDIT
   │             ├─ debit brand the processing fee
   │             ├─ Reservation.status = "redeemed"
   │             └─ create Redemption + RewardIssuance
   ▼
201 response already contains the final receipt status
   │
   ▼
GET /api/v1/wallet/                      ← updated balance
GET /api/v1/reservations/{id}/           ← FINAL CLAIM STATUS = "redeemed"
```

### Step-by-step

| # | Step | API | Caller | Auth | What happens internally |
|---|------|-----|--------|------|--------------------------|
| 1 | See campaigns | `GET /offers/` | App | Bearer | `active_offers()` — campaigns with `status=active` from operational brands |
| 2 | **Claim** | `POST /reservations/` | App | Bearer | `reservations.services.create_reservation()` — locks campaign row, picks the reward tier (waterfall within daily budget), creates `Reservation`, places a `Hold` on the brand wallet, starts cooldown |
| 3 | **Claim details** | `GET /reservations/{id}/` | App | Bearer | `ReservationSerializer` — includes `receipt_upload_url` and `receipt_status` |
| 4 | **Upload receipt** | `POST /receipts/` | App | Bearer | `receipts.services.upload_receipt()` — the whole pipeline below, **synchronously** |
| 5 | OCR | *internal* | **Backend**, not the app | see §5 | `receipts.ocr.extract_receipt()` posts the image to the OCR service |
| 6 | Validation | *internal* | Backend | — | shop → date → product, then fingerprint |
| 7 | Duplicate check | *internal* | Backend | — | DB `UNIQUE` index on `Receipt.fingerprint` |
| 8 | Reward | *internal* | Backend | — | `receipt_verified` signal → `rebates.services.issue_reward()` |
| 9 | Wallet credit | *internal* | Backend | — | `wallets.services.credit()` writes an immutable `LedgerEntry` |
| 10 | Verify result | `GET /receipts/{id}/` | App | Bearer | Read-back of receipt status |
| 11 | Wallet | `GET /wallet/` | App | Bearer | Customer wallet balance |
| 12 | Final claim status | `GET /reservations/{id}/` | App | Bearer | `status` becomes `redeemed` |

**Steps 4–9 happen inside one HTTP request.** The `201` response already carries the final
verdict. There is no queue, no Celery task and no polling in this path.

---

## 2 — Claim API

The claim is a **`Reservation`** (`Apps/reservations/models.py`). There is no separate
"Claim" model.

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `{{base_url}}/api/v1/reservations/` |
| **View** | `ReservationListCreateView.post` — `Apps/reservations/api/views.py` |
| **Auth** | **Required** — `Authorization: Bearer <access_token>` (`IsAuthenticated`) |
| **Content-Type** | `application/json` |
| **Path params** | none |
| **Query params** | none |

### Request body

Serializer `CreateReservationSerializer` — exactly **one** field:

| Field | Type | Required | Notes |
|---|---|---|---|
| `campaign` | UUID string | **yes** | The **campaign_id**, from `campaign_id` in the `/offers/` feed |

> The ID required is the **campaign id** — not an offer id, not a product id, not a claim id.

```json
{ "campaign": "cc60c7b4-46bb-44d2-bf12-2027612204fd" }
```

### Example request

```http
POST {{base_url}}/api/v1/reservations/
Authorization: Bearer {{access_token}}
Content-Type: application/json

{ "campaign": "cc60c7b4-46bb-44d2-bf12-2027612204fd" }
```

### Success — `201 Created`

```json
{
  "id": "c9e6228c-3ff9-45ae-ac54-c03bd6b5402a",
  "campaign": "cc60c7b4-46bb-44d2-bf12-2027612204fd",
  "campaign_name": "Chocolate Purchase Reward",
  "brand_name": "Fahad Chocolate Shop",
  "product_name": "Dark Chocolate Bar 100g",
  "kind": "rebate",
  "offer_type": "premium",
  "reward_amount": "2.00",
  "status": "active",
  "expires_at": "2026-09-05T11:59:54.067640Z",
  "redeemed_at": null,
  "created_at": "2026-08-29T11:59:54.067815Z",
  "receipt_upload_url": "{{base_url}}/api/v1/receipts/",
  "receipt_status": null
}
```

`id` is the **claim id** (`reservation_id`) needed for the receipt upload.

### Error responses

All from `ReservationError` → `400` with `{"detail": "..."}`:

| Status | `detail` | Cause |
|---|---|---|
| `400` | `This offer is not available.` | Campaign missing, not `active`, or brand suspended |
| `400` | `You already have an active claim for this offer.` | One active reservation per user per campaign (DB constraint `uniq_active_reservation_per_user_campaign`) |
| `400` | `This offer is not currently available.` | Daily budget exhausted / in cooldown with no fallback |
| `400` | `Reservation capacity reached. Please try again later.` | Global active-reservation cap (`RESERVATION_GLOBAL_CAP`) |
| `400` | `The brand wallet has insufficient funds for this reward.` | Brand escrow can't cover the reward |
| `401` | `Authentication credentials were not provided.` | Missing/invalid token |

---

## 3 — Claim details API

| | |
|---|---|
| **Method** | `GET` |
| **URL** | `{{base_url}}/api/v1/reservations/{reservation_id}/` |
| **View** | `ReservationDetailView.get` |
| **Auth** | **Required** (Bearer). Scoped to the owner — `get_user_reservation(user, id)` |
| **Body** | none |

There is also `GET /api/v1/reservations/` (paginated list, optional `?status=active`).

### Response — `200 OK`

Identical shape to the claim response (same serializer). After a verified receipt:

```json
{
  "id": "c9e6228c-3ff9-45ae-ac54-c03bd6b5402a",
  "campaign": "cc60c7b4-46bb-44d2-bf12-2027612204fd",
  "campaign_name": "Chocolate Purchase Reward",
  "brand_name": "Fahad Chocolate Shop",
  "product_name": "Dark Chocolate Bar 100g",
  "kind": "rebate",
  "offer_type": "premium",
  "reward_amount": "2.00",
  "status": "redeemed",
  "expires_at": "2026-09-05T11:59:54.067640Z",
  "redeemed_at": "2026-08-29T11:59:54.352039Z",
  "created_at": "2026-08-29T11:59:54.067815Z",
  "receipt_upload_url": "{{base_url}}/api/v1/receipts/",
  "receipt_status": "verified"
}
```

### Field reference

| Field | Type | Meaning |
|---|---|---|
| `id` | UUID | **Claim id.** Send as `reservation` when uploading the receipt |
| `campaign` | UUID | Campaign id |
| `campaign_name` | string | Campaign title |
| `brand_name` | string | The shop the receipt must come from |
| `product_name` | string | Eligible product — from `campaign.products.first()` |
| `kind` | enum | `rebate` \| `review`. Only `rebate` accepts receipts |
| `offer_type` | enum | `premium` \| `fallback` — which tier was reserved |
| `reward_amount` | decimal string | Amount credited on success. **Locked in at claim time** |
| `status` | enum | `active` \| `redeemed` \| `expired` \| `rejected` \| `cancelled` |
| `expires_at` | datetime | Claim expiry (`RESERVATION_EXPIRY_DAYS`, default **7 days**) |
| `redeemed_at` | datetime \| null | Set when the reward is issued |
| `receipt_upload_url` | string (absolute URL) | Where to POST the receipt photo |
| `receipt_status` | `pending`\|`verified`\|`rejected`\|`null` | Latest non-rejected receipt for this claim; `null` = none submitted |

**Product information:** only `product_name` is exposed here. There is no product id,
image or price on this response — use the `/offers/` feed for richer product data.

---

## 4 — Receipt upload URL

Source: `ReservationSerializer.get_receipt_upload_url` (`Apps/reservations/serializers.py`)

```python
path = reverse("v1:receipts:receipt-list")            # -> /api/v1/receipts/
return request.build_absolute_uri(path)
```

| Question | Answer |
|---|---|
| Where does it come from? | Django reverse of the receipts route — built per request |
| Is it a presigned URL? | **No.** No presigned/storage URLs exist anywhere in this codebase |
| Whose URL is it? | **Our own backend API**, always `{{base_url}}/api/v1/receipts/` |
| Validity window | **Does not expire.** It is a static route, not a signed token. The *claim* expires (`expires_at`), not the URL |
| HTTP method | `POST` |
| Content-Type | `multipart/form-data` |
| Auth required? | **Yes** — Bearer token |
| Does the app upload directly to storage? | **No** |
| Does the backend receive the image? | **Yes** — saved to `Receipt.image` (`FileField`, `upload_to="receipts/"`) |
| How is completion detected? | Not needed — the request is synchronous; the `201` body *is* the result |

**Architecture: option (A).** Customer → our backend → OCR service. The client never
touches the OCR service, and no storage URL is involved.

The value is per-request absolute, so it reflects the host that was called
(`https://api.joinnibbl.com/api/v1/receipts/` in production). The client may safely use
its own base URL instead — it is the same fixed path.

### Postman example

```http
POST {{base_url}}/api/v1/receipts/
Authorization: Bearer {{access_token}}
```
Body → **form-data** (do **not** set `Content-Type` manually; Postman adds the boundary):

| Key | Type | Value |
|---|---|---|
| `reservation` | Text | `c9e6228c-3ff9-45ae-ac54-c03bd6b5402a` |
| `image` | **File** | the receipt photo |

---

## 5 — OCR API

External service: **Receipt Intelligence API v1.0.0** (owned by the AI team).

### Configuration — environment only

The backend reads the service location from environment variables
(`core/settings/base.py`, via `django-environ`). **No URL is hardcoded in application
code.** Configure in `.env`:

| Variable | Default | Purpose |
|---|---|---|
| `RECEIPT_OCR_API_URL` | falls back to `AI_SERVICE_URL` | Base URL of the OCR service |
| `RECEIPT_OCR_EXTRACT_PATH` | `/api/v1/receipts/extract` | Endpoint path |
| `RECEIPT_OCR_TIMEOUT` | `30.0` | Request timeout (seconds) |
| `RECEIPT_OCR_API_KEY` | `""` | Sent as `X-API-Key: <value>` when set — **required** now that the OCR service is deployed with `API_KEY` enforced |
| `RECEIPT_ALLOW_MISSING_NUMBER` | `False` | See §10 |

If `RECEIPT_OCR_API_URL` is empty the upload endpoint returns **`503`** rather than
accepting an unverifiable receipt.

### Endpoint (server-to-server only)

| | |
|---|---|
| **Method** | `POST` |
| **URL** | `{RECEIPT_OCR_API_URL}{RECEIPT_OCR_EXTRACT_PATH}` |
| **Auth** | `X-API-Key: <RECEIPT_OCR_API_KEY>` — the deployed service rejects requests without it (`401 UNAUTHORIZED`) |
| **Content-Type** | `multipart/form-data` |
| **File field** | **`image`** (required) |
| **Other fields** | `fixture` (optional, dev-only replay of a recorded fixture) |
| **Optional header** | `X-Request-ID` |

Caller: `Apps/receipts/ocr.py::extract_receipt`. **The Flutter app must never call this
service directly.**

### Response structure (actual contract)

```jsonc
{
  "success": true,                    // "processed", not "confident"
  "data": {                           // null when success = false
    "schema_version": "1.0",
    "document_type": "receipt",
    "merchant":    { "name": "…", "address": "…", "phone": null, … },
    "transaction": { "transaction_id": "…", "date": "YYYY-MM-DD",
                     "time": "HH:MM:SS", "datetime": "…",
                     "raw_date": "…", "raw_time": "…", "timezone": null, … },
    "items": [ { "description": "…", "sku": null, "quantity": "…",
                 "unit": "…", "unit_price": "…", "total_price": "…",
                 "category": null, "line_index": 4, … } ],
    "receipt_number": "…",
    "total": "35.00",
    "currency": null,
    "subtotal": null, "tax": {…}, "payment": {…},
    "confidence": { "overall": 0.90, "fields": {…} },
    "validation": { "is_valid": true, "warnings": [...], "errors": [] },
    "review":     { "review_required": false, "status": "not_required" }
  },
  "warnings": [ { "code": "MISSING_CURRENCY", "message": "…", "field": "currency" } ],
  "errors":   [],
  "processing": { "request_id": "…", "api_version": "v1",
                  "pipeline_version": "1.0.0", "processing_time_ms": 655.9 }
}
```

All monetary/quantity values are **strings or null**. `merchant`, `transaction` and every
identity field may be `null`.

### Real OCR response (captured live)

Sent: a receipt image for `Fahad Chocolate Shop` listing three products.

```json
{
  "success": true,
  "data": {
    "merchant": { "name": "Fahad Chocolate Shop", "address": "12Gulshan Ave, Dhaka" },
    "transaction": {
      "transaction_id": "INV-12345",
      "date": "2026-08-29",
      "time": "14:30:00",
      "datetime": "2026-08-29T14:30:00",
      "raw_date": "2026-08-29",
      "raw_time": "14:30"
    },
    "items": [
      { "description": "Dark Chocolate Bar", "quantity": "100", "unit": "G",
        "unit_price": "1.00", "total_price": "10.00", "line_index": 4 },
      { "description": "Coca Cola", "quantity": "500", "unit": "ML",
        "unit_price": "1.00", "total_price": "5.00", "line_index": 5 },
      { "description": "Biscuits", "quantity": null, "unit": null,
        "unit_price": "2.00", "total_price": "20.00", "line_index": 6 }
    ],
    "receipt_number": "INV-12345",
    "total": "35.00"
  },
  "warnings": [{ "code": "MISSING_CURRENCY", "message": "Currency could not be determined.", "field": "currency" }],
  "errors": [],
  "processing": { "request_id": "4ad019b6-…", "processing_time_ms": 655.9 }
}
```

> **Note the parsing quirk:** `"Dark Chocolate Bar 100g"` came back as
> `description:"Dark Chocolate Bar"` + `quantity:"100"` + `unit:"G"`. The size was split
> off the name. Both consequences are handled — see §6 and §7.

### OCR error responses

| HTTP | Meaning | Backend maps to |
|---|---|---|
| `400` | Upload empty/unreadable | `422` |
| `413` | File too large | `422` |
| `415` | Unsupported file type | `422` |
| `422` | Image too small | `422` |
| `502` | OCR failed | `503` |
| `503` | Provider unavailable | `503` |
| `504` | OCR timed out | `503` |
| `200` + `success:false` | Processed, not a usable receipt | `422` |

`ErrorCode` values: `INVALID_IMAGE`, `UNSUPPORTED_FILE_TYPE`, `IMAGE_TOO_LARGE`,
`IMAGE_TOO_SMALL`, `EMPTY_FILE`, `UNSAFE_FILENAME`, `OCR_FAILED`, `OCR_TIMEOUT`,
`OCR_EMPTY_RESULT`, `PROVIDER_UNAVAILABLE`, `PROVIDER_NOT_REGISTERED`,
`EXTRACTION_FAILED`, `INVALID_RECEIPT`, `LLM_FAILED`, `LLM_TIMEOUT`,
`LLM_INVALID_OUTPUT`, `REQUEST_TOO_LARGE`, `RATE_LIMITED`, `INTERNAL_ERROR`.

---

## 6 — OCR JSON → receipt validation

Mapping layer: `Apps/receipts/ocr.py::map_payload` → `ExtractedReceipt`.
Validation: `Apps/receipts/services.py::upload_receipt`.

### Extraction

```
OCR JSON
   │
   ├─ Shop           ← data.merchant.name
   ├─ Date           ← data.transaction.date        (fallback: data.transaction.raw_date)
   ├─ Time           ← data.transaction.time        (fallback: data.transaction.raw_time)
   ├─ Receipt number ← data.receipt_number          (fallback: data.transaction.transaction_id)
   ├─ Total          ← data.total
   └─ Items[]        ← data.items[].description / .quantity / .unit / .unit_price
```

### A receipt has many products — only the campaign's matters

The eligible product comes from the **claim**:

```
Reservation → Reservation.campaign → campaign.products  (ManyToMany)
```

`_match_eligible_product()` walks every OCR line, resolves each against the brand's
product library, and looks for one whose id is in `campaign.products`. Chocolate, Coca
Cola, Chips, Biscuits, Water can all be on the receipt — **only the campaign product needs
to be found**; everything else is stored as a line item and ignored for the decision.

### Quantity vs package size

`_map_item()` — if `unit` is a measurement unit
(`g, kg, mg, ml, l, cl, oz, lb, fl, floz, gal, gm, gr, ltr, cc`) the `quantity` is a
**package size, not a purchase count**, so the count becomes `1`.

Without this, `"Dark Chocolate Bar 100g"` would report **100 units** and satisfy any
`min_purchase_units` rule from a single bar.

### Validation order and outcomes

| # | Check | Function | Fails how |
|---|---|---|---|
| 0 | Claim valid & unused | `_load_reservation` | `400` |
| 1 | **Shop** | `_check_shop` | `400` reject |
| 2 | **Date window** | `_check_purchase_window` | `400` reject *(outside)* / manual review *(unreadable)* |
| 3 | **Product** | `_match_eligible_product` | `400` reject *(wrong)* / manual review *(unrecognised)* |
| 4 | **Receipt number** | `_build_fingerprint` | manual review when missing |
| 5 | **Duplicate** | DB `UNIQUE` | `409` |

**Hard rejection** = provably ineligible → nothing is stored, no `Receipt` row is created.
**Manual review** = we cannot tell → a `Receipt` is stored with `status="pending"`, a
`ManualReviewItem` is queued for the brand, and **no reward is issued**.

Pre-flight claim checks (`_load_reservation`):
`Reservation not found.` · `Only rebate claims accept receipts.` ·
`This claim is no longer active.` · `A receipt has already been submitted for this claim.`

---

## 7 — Product matching

`_match_item()` → reuses the **existing** `Apps/products/selectors.py::match_product`.
No new matcher was introduced.

| Aspect | Behaviour |
|---|---|
| DB value | `Product.normalized_name` (auto-computed on save) and `ProductAlias.normalized` |
| OCR value | `data.items[].description` |
| Normalization | `Apps/common/text.py::normalize_text` — lowercase, strip apostrophes, replace other punctuation with a space, collapse whitespace |
| Case sensitivity | **Insensitive** — `DARK CHOCOLATE BAR` = `Dark Chocolate Bar` |
| Whitespace | Collapsed and trimmed |
| Matching type | **Exact match on the normalized string.** No fuzzy/AI matching |
| Alias system | **Yes** — `ProductAlias`, checked *before* the product name |
| Scope | Brand-scoped, `is_active=True` products only |

### Two match candidates per line

Because the OCR splits the size off the name, each line is tried twice — both **exact**:

1. `description` → `"Dark Chocolate Bar"`
2. `description_with_size` → `"Dark Chocolate Bar 100G"` (size restored from `quantity`+`unit`)

Candidate 2 normalizes to `dark chocolate bar 100g`, which equals the library's
`normalized_name` → match. No fuzzy logic, so no false positives.

### Example

Campaign product: `Dark Chocolate Bar 100g` → normalized `dark chocolate bar 100g`

```json
{ "items": [
  { "description": "Coca Cola",          "quantity": "500", "unit": "ML" },
  { "description": "Dark Chocolate Bar", "quantity": "100", "unit": "G"  },
  { "description": "Biscuits",           "quantity": null,  "unit": null }
] }
```

Result — only line 2 matches; `matched_units = 1`:

```json
"line_items": [
  { "description": "Dark Chocolate Bar", "quantity": 1, "unit_price": "1.00",
    "matched_product": "76a18440-…", "matched_product_name": "Dark Chocolate Bar 100g" },
  { "description": "Coca Cola", "quantity": 1, "unit_price": "1.00",
    "matched_product": null, "matched_product_name": null },
  { "description": "Biscuits",  "quantity": 1, "unit_price": "2.00",
    "matched_product": null, "matched_product_name": null }
]
```

### Failure behaviour — two distinct cases

| Situation | Outcome |
|---|---|
| A line matches **another product in this brand's library**, but not the campaign's | **`400`** `This receipt does not contain the product this offer is for.` No receipt stored |
| **Nothing** on the receipt matches anything | **`201`**, `status:"pending"`, `decision_reason:"Product could not be matched."`, `ManualReviewItem` queued, **no reward** |

The second case is deliberate: an unrecognised line is as likely an **alias gap** as a
wrong receipt. The brand resolves it from the review queue and can attach the text as a
`ProductAlias` (`POST /brands/{brand_id}/review-queue/{item_id}/add-alias/`), which makes
future receipts match automatically. A brand approval there issues the reward.

Additionally, if `matched_units < min_purchase_units`, the receipt goes to manual review
with a `no_match` fraud flag rather than auto-verifying.

---

## 8 — Shop / vendor matching

`_check_shop()` (`Apps/receipts/services.py`).

| Aspect | Value |
|---|---|
| DB value | **`Brand.name`** — the `Brand` is the shop/vendor entity (`campaign.brand`) |
| OCR value | `data.merchant.name` |
| Normalization | `normalize_text` on both |
| Logic | exact match **or** one contained in the other, provided the shorter string is **≥ 4 characters** |

```python
if shop == expected: OK
shorter, longer = sorted((shop, expected), key=len)
if len(shorter) >= 4 and shorter in longer: OK
```

The containment rule allows real-world variants — brand `Acme` vs printed
`Acme Superstore #12`. The 4-character floor stops a very short brand name from matching
everything.

**No shop-alias system exists.** Matching is against `Brand.name` only.

### Behaviours

| Case | Result |
|---|---|
| Match | Continue |
| `merchant.name` is `null`/empty | **Skipped** — a blank read is not evidence of a wrong shop. Falls through to the product rules |
| Mismatch | **`400`** `This receipt is from a different shop than the one this offer is for.` No receipt stored, no reward |

---

## 9 — Date & time validation

`_check_purchase_window()`.

| Item | Source |
|---|---|
| Campaign start | `Campaign.start_at` — `DateTimeField`, **nullable** |
| Campaign end | `Campaign.end_at` — `DateTimeField`, **nullable** |
| Receipt date | `data.transaction.date` → `_parse_date` |
| Receipt time | `data.transaction.time` → `_parse_time` |

Accepted date formats: `%Y-%m-%d`, `%d/%m/%Y`, `%m/%d/%Y`, `%d-%m-%Y`, `%Y/%m/%d`.
Accepted time formats: `%H:%M:%S`, `%H:%M`, `%I:%M %p`, `%I:%M:%S %p`.
Anything else parses to `None`.

**Timezone.** Date + time are combined into a naive datetime, then made timezone-aware
with `timezone.get_current_timezone()` (project `TIME_ZONE`) and compared to the campaign
bounds. The provider's `transaction.timezone` field is **not** used.

**If `start_at`/`end_at` are `null` there is no window restriction** — any readable date
passes.

### Rules

| Situation | Result |
|---|---|
| Date inside the window | Continue |
| Date **before** `start_at` | `400` `This receipt predates the campaign period.` |
| Date **after** `end_at` | `400` `This receipt is dated after the campaign ended.` |
| Date unreadable/missing | **Manual review** — `201`, `status:"pending"`, `decision_reason:"Purchase date could not be read."`, no reward. Also blocks the fingerprint |
| Time missing (date present) | **Allowed.** Time defaults to `00:00:00` in the fingerprint. Does **not** block auto-verify |

### Examples — campaign 1 Aug → 30 Aug 2026

| Receipt date | Outcome |
|---|---|
| `2026-08-15` | ✅ verified |
| `2026-07-25` | ❌ `400` predates |
| `2026-09-02` | ❌ `400` after end |
| unreadable | ⚠️ pending, manual review |

---

## 10 — Receipt fingerprint / hash

`Apps/receipts/ocr.py::build_fingerprint`.

### The five components

| # | Component | Source |
|---|---|---|
| 1 | Product name | **`Product.name` from our database** (the matched campaign product) |
| 2 | Shop name | `data.merchant.name` |
| 3 | Date | `data.transaction.date` |
| 4 | Time | `data.transaction.time` |
| 5 | Receipt number | `data.receipt_number` → fallback `data.transaction.transaction_id` |

> **Why #1 is the library name, not the OCR text.** Two photos of one receipt can OCR the
> same line differently (`"Dark Chocolate Bar"` vs `"Dark Chocolate Bar 100g"`). Hashing
> raw OCR text would produce two different hashes and the duplicate would be **paid
> twice**. Both readings resolve to the same `Product`, so anchoring on the library name
> keeps the fingerprint stable across photos and devices.

### Canonical string

```
v1|<norm product>|<norm shop>|<YYYY-MM-DD>|<HH:MM:SS>|<norm receipt number>
```

* `v1` = `FINGERPRINT_VERSION`, so schemes can never be confused
* product / shop / number → `normalize_text` (lowercase, punctuation stripped, whitespace collapsed)
* date → `date.isoformat()`
* time → `time.isoformat()`, microseconds dropped; **missing time → `00:00:00`**
* nothing photo-specific participates — no image bytes, no user, no upload time

### Hash

```
hashlib.sha256(canonical.encode("utf-8")).hexdigest()   # 64 hex chars
```

Python's built-in `hash()` is **not** used (it is salted per process and not stable).

### Worked example

```
Input
  product : "Dark Chocolate Bar 100g"     (from DB)
  shop    : "Fahad Chocolate Shop"
  date    : 2026-08-29
  time    : 14:30:00
  number  : "INV-12345"

Canonical
  v1|dark chocolate bar 100g|fahad chocolate shop|2026-08-29|14:30:00|inv 12345

SHA-256
  0dbd4821d09bb623462ba926ecc03c5baec6791f113931b170bcec1fb13fb493
```

*(Real value produced by the live run with the example data above.)*

Because normalization runs first, `"  FAHAD CHOCOLATE SHOP "` yields the **same** hash.

### Storage

| | |
|---|---|
| Model | `Apps/receipts/models.py::Receipt` (existing model, no new table) |
| Field | `fingerprint = CharField(max_length=64, unique=True, null=True, blank=True)` |
| Constraint | **Database `UNIQUE`** |
| Scope | **Global** — across all users, brands and campaigns |
| Also stored | `receipt_number` (`CharField(max_length=100, blank=True)`) |

**`NULL` when the fingerprint cannot be built** — no matched product, no readable date, or
no receipt number. `NULL` is exempt from `UNIQUE` in both SQLite and PostgreSQL, so those
receipts get **no duplicate protection** and are routed to manual review instead.

### Missing receipt number

Controlled by **`RECEIPT_ALLOW_MISSING_NUMBER`** (default **`False`**):

* `False` → no fingerprint, `status:"pending"`, `decision_reason:"Receipt number could not be read."`, manual review, **no reward**. No number is ever fabricated.
* `True` → fingerprints the remaining four components. Weaker: two genuinely different purchases of the same product at the same shop in the same minute would collide and the second customer would be wrongly refused.

### Never exposed

`fingerprint` is deliberately **absent from `ReceiptSerializer`** — exposing it would let a
client probe whether a physical receipt has already been used.

---

## 11 — Duplicate receipt

### Scenario

```
Customer A ── receipt photo ──► hash A ── not in DB ──► accepted ──► +2.00 credited
Customer B ── same physical receipt ──► hash A ── already in DB ──► 409, no reward
```

### Detection mechanism

The guard is the **database `UNIQUE` index**, not a check-then-insert:

```python
try:
    with transaction.atomic():
        receipt = Receipt.objects.create(..., fingerprint=fingerprint, ...)
except IntegrityError:
    raise DuplicateReceipt("This receipt has already been used.")
```

A read-then-write check would leave a race window between the two statements. Letting the
`INSERT` fail closes it — whichever transaction commits second is refused by the database.

### API response — `409 Conflict`

```json
{ "detail": "This receipt has already been used." }
```

Captured live. It reveals **nothing** about the first customer, the claim, or the hash.

### Effects on the second customer

| | |
|---|---|
| Receipt row | **Not created** |
| Reward | **Not issued** |
| Wallet | **Unchanged** (`0.00`) |
| Claim status | Stays **`active`** — they can still submit their own receipt |
| Brand escrow | Their hold remains until they succeed or the claim expires |

### Idempotency (same customer resubmitting)

Three independent layers:

1. `_load_reservation` — `A receipt has already been submitted for this claim.` (`400`) for any non-rejected receipt on that claim
2. The `UNIQUE` fingerprint index — `409`
3. `rebates.services.issue_reward` — returns the existing `Redemption` if one exists for the reservation; wallet `credit`/`capture_hold` additionally dedupe on `idempotency_key` (`redeem-customer:{reservation_id}`, `redeem-reward:{reservation_id}`)

A duplicate can therefore never produce a second wallet credit.

---

## 12 — Reward processing

### Where the amount comes from

```
Campaign
   └── RewardTier (campaigns.RewardTier)   reward_amount + allocation_percent
            │  selected at CLAIM time by _select_claimable_offer() (waterfall, highest first)
            ▼
   Reservation.reward_amount   ← snapshot, locked in when the customer claims
            │
            ▼
   Redemption.reward_amount / customer wallet credit
```

**The reward comes from the campaign's `RewardTier`** (or `FallbackOffer` when the
customer is in cooldown / the premium tier's daily allocation is spent — then
`offer_type` is `fallback`). It is **not** on the product, and not recomputed at receipt
time.

Because the amount is snapshotted onto the `Reservation` at claim time, a brand editing
tiers afterwards **cannot change what an open claim pays out**.

### Issuance — `Apps/rebates/services.py::issue_reward`

Triggered by the `receipt_verified` signal (`Apps/rebates/signals.py`), inside the same
atomic transaction as the receipt:

1. Guard: return the existing `Redemption` if one exists (no double issue)
2. Guard: reservation must be `active`, its `Hold` must be `active`
3. **Capture** the brand's `Hold` → brand pays the reward (`rebate_reward` debit)
4. **Credit** the customer's wallet the reward (`rebate_reward` credit)
5. **Debit** the brand the processing fee (`rebate_fee`) — plan-based, `billing_services.rebate_processing_fee`; can be `0.00`
6. `Reservation.status = redeemed`, `redeemed_at` set
7. Create `Redemption` (`status="issued"`) + `RewardIssuance` linking all three ledger entries and the hold

The customer receives the full `reward_amount`; the fee is charged to the **brand**, not
deducted from the customer.

### Example

```
Campaign reward tier : 2.00
Claim (reservation)  : reward_amount = "2.00"
Verified receipt     → customer +2.00, brand −2.00 (reward) −fee
```

Live `GET /api/v1/redemptions/`:

```json
{ "count": 1, "next": null, "previous": null,
  "results": [{
    "id": "4e675bee-9738-4121-b648-23d86d984419",
    "reservation": "c9e6228c-3ff9-45ae-ac54-c03bd6b5402a",
    "receipt": "f6b6438c-58c2-4d27-90ba-8135b52b8000",
    "campaign": "cc60c7b4-46bb-44d2-bf12-2027612204fd",
    "campaign_name": "Chocolate Purchase Reward",
    "brand_name": "Fahad Chocolate Shop",
    "user_email": "customer@example.com",
    "reward_amount": "2.00",
    "fee_amount": "0.00",
    "status": "issued",
    "issued_at": "2026-08-29T11:59:54.352259Z",
    "created_at": "2026-08-29T11:59:54.352392Z"
  }]
}
```

---

## 13 — Wallet credit

### Models (`Apps/wallets/models.py`)

| Model | Role |
|---|---|
| `Wallet` | One per customer (`kind="customer"`) or brand (`kind="brand"`). `balance` = sum of all ledger entries |
| `LedgerEntry` | **Immutable, append-only** money movement. `save()` on an existing row and `delete()` both raise |
| `Hold` | Escrow reservation on a wallet. `available = balance − active holds` |

### The credit

`wallets.services.credit()`:

| Attribute | Value |
|---|---|
| Wallet | Customer's (`get_or_create_customer_wallet`) |
| `entry_type` | `credit` |
| `category` | `rebate_reward` |
| `amount` | The reward (`2.00`) |
| `balance_after` | Snapshot after the entry |
| `reference_type` | `"redemption"` |
| `reference_id` | **The reservation (claim) id** |
| `description` | `"Rebate reward — <campaign name>"` |
| `idempotency_key` | `redeem-customer:{reservation_id}` — blocks double posting |
| `created_at` | Auto timestamp |

**Relationships from a ledger entry:** `reference_id` → `Reservation` → `Campaign` →
`Brand`. The `Redemption` row links reservation ⇄ receipt ⇄ campaign ⇄ user, and
`RewardIssuance` links the three ledger entries and the hold.

### Atomicity

`issue_reward` is `@transaction.atomic`, and it runs inside `upload_receipt`'s transaction
via the signal. Receipt row, fingerprint, hold capture, customer credit, fee debit,
reservation status and `Redemption` **all commit together or none do**. There is no state
where the hash is stored but the wallet was not credited.

### Before / after (captured live)

`GET /api/v1/wallet/` **before**:

```json
{ "id": "afd93c5d-…", "kind": "customer", "currency": "USD",
  "balance": "0.00", "held": 0.0, "available": 0.0,
  "updated_at": "2026-08-29T11:59:54.094930Z" }
```

**after** the verified receipt:

```json
{ "id": "afd93c5d-…", "kind": "customer", "currency": "USD",
  "balance": "2.00", "held": 0.0, "available": 2.0,
  "updated_at": "2026-08-29T11:59:54.351639Z" }
```

> Type quirk to code against: **`balance` is a JSON string**, while `held` and `available`
> are JSON **numbers** (they come from `SerializerMethodField`).

### Verification APIs

| Purpose | Method | Endpoint |
|---|---|---|
| Balance | `GET` | `/api/v1/wallet/` |
| Ledger (paginated) | `GET` | `/api/v1/wallet/transactions/` |
| Activity feed | `GET` | `/api/v1/activity/` |
| Statement (ledger + pending withdrawals) | `GET` | `/api/v1/wallet/statement/` |

`GET /api/v1/wallet/transactions/` after the reward:

```json
{ "count": 1, "next": null, "previous": null,
  "results": [{
    "id": "b7e3aae7-…",
    "entry_type": "credit",
    "amount": "2.00",
    "signed_amount": "2.00",
    "category": "rebate_reward",
    "balance_after": "2.00",
    "reference_type": "redemption",
    "reference_id": "c9e6228c-3ff9-45ae-ac54-c03bd6b5402a",
    "description": "Rebate reward — Chocolate Purchase Reward",
    "created_at": "2026-08-29T11:59:54.351862Z"
  }]
}
```

---

## 14 — Error cases

All responses are **JSON**. Every case below was executed and captured.

### Claim endpoint — `POST /reservations/`

| Status | Body | Meaning | App should show |
|---|---|---|---|
| `400` | `{"detail":"This offer is not available."}` | Campaign missing/inactive, brand suspended | "This offer is no longer available." Refresh feed |
| `400` | `{"detail":"You already have an active claim for this offer."}` | Already claimed | Navigate to the existing claim |
| `400` | `{"detail":"This offer is not currently available."}` | Daily budget spent / cooldown | "Come back tomorrow." |
| `400` | `{"detail":"Reservation capacity reached. Please try again later."}` | Global cap | "Try again shortly." Retryable |
| `400` | `{"detail":"The brand wallet has insufficient funds for this reward."}` | Brand escrow empty | "Offer temporarily unavailable." |
| `401` | `{"detail":"Authentication credentials were not provided."}` | No/invalid token | Re-authenticate |

### Receipt endpoint — `POST /receipts/`

| Status | Body | Meaning | App should show | Retry? |
|---|---|---|---|---|
| `400` | `{"image":["No file was submitted."]}` | Image field missing | "Please attach a receipt photo." | Yes |
| `400` | `{"detail":"Reservation not found."}` | Bad/foreign claim id | "Claim not found." | No |
| `400` | `{"detail":"Only rebate claims accept receipts."}` | Review-kind claim | Should not occur in this flow | No |
| `400` | `{"detail":"This claim is no longer active."}` | Expired/redeemed/rejected | "This claim has expired." | No |
| `400` | `{"detail":"A receipt has already been submitted for this claim."}` | Already submitted | Show existing receipt status | No |
| `400` | `{"detail":"This receipt is from a different shop than the one this offer is for."}` | Wrong shop | "This receipt isn't from <brand>." | Yes, different receipt |
| `400` | `{"detail":"This receipt does not contain the product this offer is for."}` | Wrong product | "This receipt doesn't include <product>." | Yes, different receipt |
| `400` | `{"detail":"This receipt predates the campaign period."}` | Too early | "Purchased before the offer started." | Yes, different receipt |
| `400` | `{"detail":"This receipt is dated after the campaign ended."}` | Too late | "Purchased after the offer ended." | Yes, different receipt |
| `409` | `{"detail":"This receipt has already been used."}` | **Duplicate** | Exactly that message. Never show hash/other customer | No |
| `422` | `{"detail":"No text found."}` *(message comes from the OCR provider)* | Unreadable image | "We couldn't read that receipt. Try a clearer photo." | **Yes** |
| `503` | `{"detail":"The receipt OCR service is unavailable."}` | Provider down/timeout/unconfigured/malformed JSON | "Service busy, try again shortly." | **Yes** |
| `401` | `{"detail":"Authentication credentials were not provided."}` | Missing token | Re-authenticate | — |

**Important:** the claim is **untouched** on `422` and `503` — still `active`, no receipt
stored, nothing charged. The customer can safely retry.

### Accepted-but-not-rewarded — `201` with `status:"pending"`

These are **not** errors. HTTP `201`, receipt stored, queued for the brand's manual
review, **no reward yet**:

| `decision_reason` | Cause |
|---|---|
| `"Receipt number could not be read."` | No `receipt_number` and no `transaction_id` |
| `"Purchase date could not be read."` | Date unparseable/missing |
| `"Product could not be matched."` | No OCR line matched anything in the library |

Captured example (missing receipt number):

```json
{ "id": "2ce4f080-…", "status": "pending",
  "merchant": "Fahad Chocolate Shop",
  "purchased_at": "2026-08-29T14:30:00Z",
  "receipt_number": "", "total": "10.00",
  "matched": true, "matched_units": 1, "reward_amount": "2.00",
  "decision_reason": "Receipt number could not be read." }
```

### Not applicable

* **Wallet failure** — no distinct wallet error surfaces on this path. `InsufficientFunds`
  is caught at *claim* time. If issuance failed, the whole transaction rolls back.
* **OCR timeout** — not a separate status; folded into `503`.
* **Already rewarded** — prevented by the three idempotency layers (§11); surfaces as
  `400 A receipt has already been submitted for this claim.`

---

## 15 — Complete Postman testing guide

### Environment variables

| Variable | Example |
|---|---|
| `base_url` | `https://api.joinnibbl.com` |
| `access_token` | *(set in Step 1)* |
| `campaign_id` | *(Step 2)* |
| `reservation_id` | *(Step 3)* |
| `receipt_id` | *(Step 5)* |

---

### STEP 1 — Login

```http
POST {{base_url}}/api/v1/auth/login/
Content-Type: application/json

{ "email": "customer@example.com", "password": "StrongPass123!", "remember_me": false }
```

**200 OK**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "user": {
    "id": "3099723a-1168-4dbc-8705-2d0ef4f1d47e",
    "email": "customer@example.com",
    "full_name": "Customer A",
    "role": "consumer",
    "role_id": { "consumer_id": "3099723a-…" },
    "is_approved": true,
    "is_email_verified": true,
    "referral_code": "4DN3WC3N",
    "created_at": "2026-08-29T11:59:53.601834Z"
  }
}
```

➡️ Save `access` → `{{access_token}}`.
Login requires a **verified** email; brand-role accounts also require admin approval.

---

### STEP 2 — Get active campaigns

```http
GET {{base_url}}/api/v1/offers/?page=1
Authorization: Bearer {{access_token}}
```

**200 OK**
```json
{ "count": 1, "next": null, "previous": null,
  "results": [{
    "campaign_id": "cc60c7b4-46bb-44d2-bf12-2027612204fd",
    "name": "Chocolate Purchase Reward",
    "brand_id": "b68a17d1-…", "brand_name": "Fahad Chocolate Shop",
    "product_id": "76a18440-…", "product_name": "Dark Chocolate Bar 100g",
    "product_image": "", "category": "Confectionery",
    "offer_type": "premium", "reward_amount": "2.00",
    "restriction": "No minimum purchase", "min_purchase_units": 1,
    "is_bogo": false, "in_cooldown": false, "claimable": true,
    "end_at": null, "rating": null, "review_count": 0,
    "is_claimed": false, "reservation_id": null }]
}
```

➡️ Save `campaign_id`. Optional filters: `?search=`, `?category=`.

---

### STEP 3 — Claim the campaign

```http
POST {{base_url}}/api/v1/reservations/
Authorization: Bearer {{access_token}}
Content-Type: application/json

{ "campaign": "{{campaign_id}}" }
```

**201 Created** — see §2. ➡️ Save `id` → `{{reservation_id}}`.

---

### STEP 4 — Get claim details

```http
GET {{base_url}}/api/v1/reservations/{{reservation_id}}/
Authorization: Bearer {{access_token}}
```

**200 OK** — see §3. Confirm `receipt_upload_url` and `receipt_status: null`.

Optional baseline: `GET {{base_url}}/api/v1/wallet/` → `"balance": "0.00"`.

---

### STEP 5 — Upload the receipt

```http
POST {{base_url}}/api/v1/receipts/
Authorization: Bearer {{access_token}}
```
Body → **form-data** (let Postman set `Content-Type`):

| Key | Type | Value |
|---|---|---|
| `reservation` | Text | `{{reservation_id}}` |
| `image` | **File** | receipt photo (`.jpg` / `.png`) |

**201 Created**
```json
{
  "id": "f6b6438c-58c2-4d27-90ba-8135b52b8000",
  "reservation": "c9e6228c-…",
  "campaign": "cc60c7b4-…",
  "campaign_name": "Chocolate Purchase Reward",
  "brand_name": "Fahad Chocolate Shop",
  "status": "verified",
  "merchant": "Fahad Chocolate Shop",
  "purchased_at": "2026-08-29T14:30:00Z",
  "receipt_number": "INV-12345",
  "total": "35.00",
  "matched": true,
  "matched_units": 1,
  "reward_amount": "2.00",
  "decision_reason": "Auto-verified.",
  "line_items": [
    { "id": "beed55cf-…", "description": "Dark Chocolate Bar", "quantity": 1,
      "unit_price": "1.00", "matched_product": "76a18440-…",
      "matched_product_name": "Dark Chocolate Bar 100g" },
    { "id": "7bdf31fc-…", "description": "Coca Cola", "quantity": 1,
      "unit_price": "1.00", "matched_product": null, "matched_product_name": null },
    { "id": "f4dac8cc-…", "description": "Biscuits", "quantity": 1,
      "unit_price": "2.00", "matched_product": null, "matched_product_name": null }
  ],
  "created_at": "2026-08-29T11:59:54.341508Z"
}
```

➡️ Save `id` → `{{receipt_id}}`.

---

### STEP 6 — OCR processing

**No request to make.** OCR ran server-side during Step 5 (~0.7 s in the captured run).
Confirm from Step 5's response: `merchant`, `purchased_at`, `receipt_number` and
`line_items` are all OCR-derived.

Do **not** call the OCR service from Postman as part of this flow — it is internal.

---

### STEP 7 — Verify the receipt

```http
GET {{base_url}}/api/v1/receipts/{{receipt_id}}/
Authorization: Bearer {{access_token}}
```

**200 OK** — same body as Step 5. Check `status`:

| `status` | Meaning |
|---|---|
| `verified` | Accepted, reward issued |
| `pending` | Awaiting brand manual review — see `decision_reason` |
| `rejected` | Declined by the brand reviewer |

History: `GET {{base_url}}/api/v1/receipts/` (paginated, own receipts only).

---

### STEP 8 — Check the claim

```http
GET {{base_url}}/api/v1/reservations/{{reservation_id}}/
Authorization: Bearer {{access_token}}
```

**200 OK** → `"status": "redeemed"`, `"redeemed_at": "…"`, `"receipt_status": "verified"`.

---

### STEP 9 — Check the wallet

```http
GET {{base_url}}/api/v1/wallet/
Authorization: Bearer {{access_token}}
```

**200 OK** → `"balance": "2.00"`, `"available": 2.0`

Ledger proof:
```http
GET {{base_url}}/api/v1/wallet/transactions/
Authorization: Bearer {{access_token}}
```
→ one `credit` of `2.00`, category `rebate_reward`, `reference_id` = the reservation id.

Reward record: `GET {{base_url}}/api/v1/redemptions/` → `status: "issued"`.

---

## 16 — End-to-end example

> Example data. Real captured responses, IDs shortened.

**Setup** — Brand `Fahad Chocolate Shop` · Product `Dark Chocolate Bar 100g` ·
Campaign `Chocolate Purchase Reward`, reward tier `2.00`, daily budget `100.00`, active.

**Physical receipt**
```
Fahad Chocolate Shop
12 Gulshan Ave, Dhaka
Date: 2026-08-29   Time: 14:30
Receipt No: INV-12345
Dark Chocolate Bar 100g   1   10.00
Coca Cola 500ml           1    5.00
Biscuits                  2   20.00
TOTAL                         35.00
```

**1. Claim request**
```http
POST /api/v1/reservations/      { "campaign": "cc60c7b4-…" }
```

**2. Claim response — `201`**
```json
{ "id": "c9e6228c-…", "reward_amount": "2.00", "status": "active",
  "product_name": "Dark Chocolate Bar 100g", "brand_name": "Fahad Chocolate Shop",
  "receipt_upload_url": "{{base_url}}/api/v1/receipts/", "receipt_status": null,
  "expires_at": "2026-09-05T11:59:54Z" }
```

**3. Claim details — `GET /api/v1/reservations/c9e6228c-…/` → `200`** (same shape)

**4. Receipt upload**
```http
POST /api/v1/receipts/     form-data: reservation=c9e6228c-…, image=<photo>
```

**5. OCR response** (internal — see §5 for the full captured body)
```
merchant.name              = "Fahad Chocolate Shop"
transaction.date           = "2026-08-29"
transaction.time           = "14:30:00"
receipt_number             = "INV-12345"
items[0].description       = "Dark Chocolate Bar"  (quantity "100", unit "G")
```

**6. Validation**

| Check | Result |
|---|---|
| Shop | `fahad chocolate shop` == brand → ✅ |
| Date | campaign has no window → ✅ |
| Product | `"Dark Chocolate Bar 100G"` → `dark chocolate bar 100g` → ✅ matched |
| Units | unit `G` = size → counted as **1**, ≥ `min_purchase_units` 1 → ✅ |
| Receipt number | `INV-12345` present → ✅ |

**7. Hash**
```
v1|dark chocolate bar 100g|fahad chocolate shop|2026-08-29|14:30:00|inv 12345
→ 0dbd4821d09bb623462ba926ecc03c5baec6791f113931b170bcec1fb13fb493
```

**8. Database result**

| Table | Row |
|---|---|
| `Receipt` | `status=verified`, `matched_units=1`, `receipt_number=INV-12345`, fingerprint stored |
| `ReceiptLineItem` | 3 rows; one linked to the product |
| `OCRResult` | Raw provider payload retained |
| `Reservation` | `status=redeemed` |
| `Redemption` | `reward_amount=2.00`, `status=issued` |
| `LedgerEntry` | customer `credit` 2.00 · brand `debit` 2.00 · brand fee debit |
| `Hold` | `captured` |

**9. Reward** — `GET /api/v1/redemptions/` → `reward_amount "2.00"`, `status "issued"`

**10. Wallet balance**
```
Before : { "balance": "0.00", "available": 0.0 }
After  : { "balance": "2.00", "available": 2.0 }
```

---

## 17 — Duplicate end-to-end example

### Customer A — accepted

```http
POST /api/v1/receipts/   form-data: reservation=<A's claim>, image=<photo of INV-12345>
```
**201 Created**
```json
{ "id": "f6b6438c-…", "status": "verified", "merchant": "Fahad Chocolate Shop",
  "receipt_number": "INV-12345", "matched": true, "matched_units": 1,
  "reward_amount": "2.00", "decision_reason": "Auto-verified." }
```
`GET /api/v1/wallet/` → `{"balance": "2.00", "available": 2.0}`

### Customer B — same physical receipt

```http
POST /api/v1/reservations/   { "campaign": "cc60c7b4-…" }      → 201, claim active
POST /api/v1/receipts/       reservation=<B's claim>, image=<photo of the SAME receipt>
```

OCR returns identical values → identical canonical string → identical SHA-256 →
`INSERT` violates the `UNIQUE` index → `IntegrityError` → `DuplicateReceipt`.

**409 Conflict**
```json
{ "detail": "This receipt has already been used." }
```

`GET /api/v1/wallet/` (Customer B) →
```json
{ "id": "32a04996-…", "kind": "customer", "currency": "USD",
  "balance": "0.00", "held": 0.0, "available": 0.0 }
```

### Outcome

| | Customer A | Customer B |
|---|---|---|
| Receipt row | created, `verified` | **not created** |
| Reward | `2.00` issued | **none** |
| Wallet | `0.00 → 2.00` | `0.00` unchanged |
| Claim status | `redeemed` | **`active`** — can still submit their own receipt |
| Response | `201` | **`409`** |

### Contrast — a genuinely different receipt

Same shop, same product, later purchase (`time 16:45:00`, `INV-12346`) → different
canonical string → different hash → **accepted**, `2.00` credited. Same product + same
shop does **not** make a duplicate; all five components must match.

---

## 18 — Not currently implemented

Flagged explicitly so nothing here is mistaken for an available feature.

| Item | Status |
|---|---|
| **Presigned / direct-to-storage upload URL** | **NOT CURRENTLY IMPLEMENTED.** The image is posted to our backend (`Receipt.image`, local `MEDIA_ROOT`). No S3/GCS presigning exists |
| **Asynchronous receipt processing / polling** | **NOT CURRENTLY IMPLEMENTED.** Upload → OCR → validation → reward is one synchronous request. No Celery task, no job id, no status-poll endpoint on this path |
| **A dedicated "claim details" endpoint** | Not separate — `GET /reservations/{id}/` serves this, with the same serializer as the claim response |
| **Separate receipt time field** | `Receipt` stores a single `purchased_at` datetime. The time is used in the fingerprint but not persisted independently |
| **Wallet balance in the receipt response** | Not included. `reward_amount` is returned; the new balance requires `GET /api/v1/wallet/` |
| **Shop aliases** | No alias model for shops. Matching is `Brand.name` only (product aliases *do* exist) |
| **Campaign "duration in days"** | No duration field. Windows are explicit `start_at` / `end_at` datetimes, both nullable |
| **Automatic campaign expiry by `end_at`** | No task flips a campaign to `completed` when `end_at` passes; it stays `active` in `/offers/` until paused/archived. Receipt date validation still enforces the window |
| **OCR retry / circuit breaker** | Single attempt, then `503`. No backoff or retry queue |
| ~~`RECEIPT_OCR_API_KEY` not required~~ | **Superseded.** The deployed service enforces `API_KEY` — every request needs `X-API-Key`, confirmed live (`401 UNAUTHORIZED` without it) |

### Deployment note

`services/backend/media/` must be **writable by the application user**. It is currently
`root`-owned in the checked environment, which makes `Receipt.image` saving fail with
`PermissionError`. This is an environment/permissions issue, not a code issue.
