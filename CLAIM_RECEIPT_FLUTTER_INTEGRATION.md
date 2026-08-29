# Flutter Integration — Claim → Receipt Upload → Reward

Integration guide for the mobile flow that starts when the customer taps **Claim** on an
active campaign.

Every endpoint, field, status code and message here was taken from the running backend and
verified by executing the flow end-to-end. This document and
`CLAIM_RECEIPT_POSTMAN_FLOW.md` describe the **same API contract**.

**Base URL:** `https://api.joinnibbl.com` — all paths prefixed `/api/v1/`
**Auth:** `Authorization: Bearer <access_token>` on every call in this flow.

### Three things to get right up front

1. **The upload is synchronous.** One `POST /receipts/` returns the final verdict. **There is no polling** — do not build any.
2. **Flutter never calls the OCR service.** It is internal, server-to-server, behind the backend.
3. **Never surface the receipt fingerprint or any other customer's data.** The API does not return them; don't invent them.

---

## Flow

```
Campaign card (from GET /offers/)
        │  tap "Claim"
        ▼
POST /api/v1/reservations/          {"campaign": "<campaign_id>"}
        │  201 → claim created, reward locked in
        ▼
Navigate → Claim Details screen
        │  show reward_amount, product_name, brand_name
        ▼
Receipt Upload UI  (camera / gallery)
        │
        ▼
POST /api/v1/receipts/              multipart: reservation + image
        │  ⏳ single request — backend runs OCR + validation + reward
        │     (~1–3 s typical; allow up to ~60 s)
        ▼
   ┌────┴─────────────────────────────────────────┐
   │ 201 status:"verified"  → SUCCESS, reward paid │
   │ 201 status:"pending"   → UNDER REVIEW, no pay │
   │ 400 → validation failed (shop/product/date)   │
   │ 409 → duplicate receipt                        │
   │ 422 → unreadable image (retry)                 │
   │ 503 → OCR unavailable (retry)                  │
   └────┬─────────────────────────────────────────┘
        ▼
GET /api/v1/wallet/                 refresh balance
GET /api/v1/reservations/{id}/      final claim status → "redeemed"
```

---

## 1 — Screen flow

| Screen / state | Trigger | Shows |
|---|---|---|
| **Campaign list** | `GET /offers/` | Cards: `product_name`, `brand_name`, `reward_amount`, `claimable` |
| **Campaign details** | tap a card | Full offer + **Claim** button |
| **Claiming** (loading) | tap Claim | Spinner, button disabled |
| **Claim details** | `201` from claim | Reward, product, shop, expiry, **Upload Receipt** button |
| **Receipt capture** | tap Upload | Camera / gallery picker + preview |
| **Uploading / processing** | POST in flight | Single blocking progress state (see §5) |
| **Reward success** | `201` + `verified` | Reward amount, new wallet balance |
| **Under review** | `201` + `pending` | "We're checking your receipt" + reason |
| **Duplicate receipt** | `409` | "This receipt has already been used." |
| **Receipt rejected** | `400` | Specific reason from `detail` |
| **Unreadable receipt** | `422` | "Couldn't read that photo" + **Retry** |
| **Service unavailable** | `503` | "Try again shortly" + **Retry** |

Use the app's existing card/detail patterns — nothing here requires new architecture.

---

## 2 — Claim button

| | |
|---|---|
| Endpoint | `POST /api/v1/reservations/` |
| Auth | **Required** |
| Content-Type | `application/json` |

### Request

```json
{ "campaign": "cc60c7b4-46bb-44d2-bf12-2027612204fd" }
```

The only field is **`campaign`** — the `campaign_id` from the offers feed. Not `offer_id`,
not `product_id`.

### Loading state

Disable the button immediately. The endpoint is **not idempotent for concurrent taps** —
a double tap yields `400 You already have an active claim for this offer.`

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
  "receipt_upload_url": "https://api.joinnibbl.com/api/v1/receipts/",
  "receipt_status": null
}
```

➡️ Keep `id` — it is the **claim id** required by the upload.

### Errors

| Status | `detail` | UI |
|---|---|---|
| `400` | `You already have an active claim for this offer.` | Navigate to the existing claim instead of erroring |
| `400` | `This offer is not available.` | "No longer available" + refresh the feed |
| `400` | `This offer is not currently available.` | "Come back tomorrow" (budget/cooldown) |
| `400` | `Reservation capacity reached. Please try again later.` | Retryable |
| `400` | `The brand wallet has insufficient funds for this reward.` | "Temporarily unavailable" |
| `401` | `Authentication credentials were not provided.` | Refresh token / re-login |

### Navigation

On `201` → push the Claim Details screen with the returned object. No second fetch needed;
the claim response and the details response use the **same serializer**.

---

## 3 — Claim details page

`GET /api/v1/reservations/{reservation_id}/` — auth required, owner-scoped.
Also `GET /api/v1/reservations/?status=active` for "my claims".

Response is identical in shape to §2.

### Field usage

| Field | Type | Nullable | How Flutter uses it |
|---|---|---|---|
| `id` | String (UUID) | no | **Claim id** → send as `reservation` on upload |
| `campaign` | String (UUID) | no | Deep-link back to the campaign |
| `campaign_name` | String | no | Screen title |
| `brand_name` | String | no | **"Buy from <brand_name>"** — the shop the receipt must be from |
| `product_name` | String | no | **"Buy <product_name>"** — the eligible product. Empty string if the campaign has no product |
| `kind` | String enum | no | `rebate` \| `review`. Only `rebate` accepts receipts |
| `offer_type` | String enum | no | `premium` \| `fallback`. Optional badge |
| `reward_amount` | String (decimal) | no | **"Earn 2.00"**. Parse with `Decimal`/`double` — it is a **string** |
| `status` | String enum | no | Drives the state machine (§12) |
| `expires_at` | String (ISO-8601) | no | Countdown — "Upload by …" (7 days from claim) |
| `redeemed_at` | String (ISO-8601) | **yes** | `null` until the reward is issued |
| `created_at` | String (ISO-8601) | no | Claim timestamp |
| `receipt_upload_url` | String (absolute URL) | no | Where to POST the photo (see §4) |
| `receipt_status` | String enum | **yes** | `null` = none submitted; `pending` \| `verified` \| `rejected` |

**Not on this response:** product id, product image, price, vendor address, wallet balance.
Use the `/offers/` feed for richer product data.

### Rendering rules

* `receipt_status == null` && `status == "active"` → show **Upload Receipt**
* `receipt_status == "pending"` → show "Under review", hide upload
* `receipt_status == "verified"` → show reward success
* `status == "expired"` / `"cancelled"` → hide upload, show expired
* `status == "redeemed"` → completed

---

## 4 — Receipt upload

| | |
|---|---|
| Endpoint | `POST /api/v1/receipts/` (value of `receipt_upload_url`) |
| Method | `POST` |
| Content-Type | `multipart/form-data` |
| Auth | **Required** — `Authorization: Bearer <token>` |

### This is NOT a presigned URL

`receipt_upload_url` is **our own backend endpoint**, built per request by Django's
`reverse()`. It:

* does **not** expire (the *claim* expires, via `expires_at`)
* is **not** a storage/S3 URL — there is no presigned upload anywhere in this backend
* **requires** the `Authorization` header (a presigned URL would not)

The backend receives the image, stores it, then calls the OCR service server-to-server.
**Flutter must not call the OCR service.**

Safe to use the constant path `/api/v1/receipts/` against your configured base URL; treat
`receipt_upload_url` as confirmation.

### Multipart fields

| Field | Type | Required | Value |
|---|---|---|---|
| `reservation` | text | **yes** | The claim `id` |
| `image` | **file** | **yes** | The receipt photo |

`image` is mandatory — omitting it returns
`400 {"image": ["No file was submitted."]}`. No other fields are accepted; shop, date,
time, receipt number and line items are **all** read from the photo by OCR and cannot be
supplied by the client.

### Image guidance

Formats the OCR service accepts: JPEG, PNG, WebP, HEIC, PDF (backend infers the
content-type from the filename extension — **always send a real extension**, e.g.
`receipt.jpg`).

Provider-side failures to expect: `EMPTY_FILE`, `IMAGE_TOO_SMALL`, `IMAGE_TOO_LARGE`,
`UNSUPPORTED_FILE_TYPE` — all surface as **`422`**. Compress large camera images before
upload, but not so far that the text becomes unreadable.

### Timeout

The backend's own OCR timeout is `RECEIPT_OCR_TIMEOUT` (default **30 s**), plus validation
and reward work. **Set the Dart client timeout to ~60 s** for this request — the default
short timeout will abort a request the server is still completing.

### Dio sketch

```dart
final form = FormData.fromMap({
  'reservation': reservationId,
  'image': await MultipartFile.fromFile(file.path, filename: 'receipt.jpg'),
});

final res = await dio.post(
  '/api/v1/receipts/',
  data: form,
  options: Options(
    headers: {'Authorization': 'Bearer $accessToken'},
    sendTimeout:    const Duration(seconds: 60),
    receiveTimeout: const Duration(seconds: 60),
    validateStatus: (s) => s != null && s < 500, // handle 4xx yourself; let 503 throw
  ),
  onSendProgress: (sent, total) => updateProgress(sent / total),
);
```

Do **not** set `Content-Type` manually — the multipart boundary must be generated.

### Success / failure

* `201` → parse the receipt object; branch on `status` (§6)
* `4xx` → show the mapped message (§8)
* `503` / network error → retryable

---

## 5 — Processing state

> **There is no polling. The API is synchronous.** Upload, OCR, validation, duplicate
> check, reward issuance and wallet credit all complete **inside the single
> `POST /receipts/` request**, and the `201` body contains the final result.
>
> There is no Celery task, no job id, and no status endpoint to poll on this path.
> **Do not implement polling or retry loops.**

Show **one** progress state for the whole request. Because upload progress and server
processing are indistinguishable to the client, drive the copy from `onSendProgress`:

| Phase | Copy |
|---|---|
| `progress < 1.0` | "Uploading receipt…" (with % if you like) |
| `progress == 1.0`, awaiting response | "Reading your receipt…" |

Keep it non-dismissible (or warn on cancel) — cancelling the HTTP request does **not**
cancel server-side processing, which may still credit the reward.

Typical latency: OCR ~0.7 s in the captured run; budget 1–3 s end to end.

### The one case that continues elsewhere

`201` with `status: "pending"` means a **human at the brand** must review it. That
resolution can take hours or days. Do **not** poll for it. Refresh
`GET /api/v1/reservations/{id}/` when the user revisits the screen (pull-to-refresh or
`onResume`) and read `receipt_status`.

---

## 6 — Success state

`201 Created` with `status: "verified"` — reward already credited.

```json
{
  "id": "f6b6438c-58c2-4d27-90ba-8135b52b8000",
  "reservation": "c9e6228c-3ff9-45ae-ac54-c03bd6b5402a",
  "campaign": "cc60c7b4-46bb-44d2-bf12-2027612204fd",
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

Show:

* ✅ "Receipt accepted"
* **Reward: `reward_amount`** (`"2.00"`)
* "Added to your wallet"
* Updated balance — **requires `GET /api/v1/wallet/`** (§9); it is not in this response
* Claim status → refetch `GET /api/v1/reservations/{id}/` → `"redeemed"`

Optional detail: `merchant`, `purchased_at`, `receipt_number`, and the matched line
(`matched_product_name != null`).

### `201` but `status: "pending"` — not a success

Reward **not** issued. Show a neutral "under review" state, using `decision_reason`:

| `decision_reason` | Suggested copy |
|---|---|
| `Receipt number could not be read.` | "We couldn't read the receipt number. A team member is reviewing it." |
| `Purchase date could not be read.` | "We couldn't read the purchase date. Under review." |
| `Product could not be matched.` | "We're checking the items on your receipt." |

Do **not** show a reward, and do **not** refresh the wallet.

---

## 7 — Duplicate receipt

**`409 Conflict`** (captured verbatim):

```json
{ "detail": "This receipt has already been used." }
```

### Flutter behaviour

* Show the backend's `detail` verbatim in a dialog or banner
* Treat as **terminal for this receipt** — no automatic retry
* Offer "Try a different receipt" → back to the picker
* The claim is **still `active`**, so the customer can upload a different receipt

### Must NOT be shown

* ❌ The receipt fingerprint/hash — the API never returns it
* ❌ Who used the receipt first, or their claim
* ❌ Internal database ids or constraint names

The backend deliberately returns a generic message. Don't enrich it.

---

## 8 — Validation errors

Every response is JSON. `400`, `409` and `422` bodies use `{"detail": "..."}`; the missing
file error uses `{"image": [...]}`.

| Case | Status | `detail` | UI | Retry? |
|---|---|---|---|---|
| Wrong product | `400` | `This receipt does not contain the product this offer is for.` | "This receipt doesn't include **<product_name>**." | ✅ different receipt |
| Wrong shop | `400` | `This receipt is from a different shop than the one this offer is for.` | "This receipt isn't from **<brand_name>**." | ✅ different receipt |
| Date before campaign | `400` | `This receipt predates the campaign period.` | "Purchased before this offer started." | ✅ different receipt |
| Date after campaign | `400` | `This receipt is dated after the campaign ended.` | "Purchased after this offer ended." | ✅ different receipt |
| Missing date | `201` `pending` | `Purchase date could not be read.` | "Under review" | ❌ already accepted |
| Missing receipt number | `201` `pending` | `Receipt number could not be read.` | "Under review" | ❌ already accepted |
| Missing time | — | — | **No error.** Time is optional; defaults to `00:00:00` | — |
| Unreadable image | `422` | provider message, e.g. `No text found.` | "We couldn't read that receipt. Try a clearer, well-lit photo." | ✅ **same receipt** |
| OCR down / timeout | `503` | `The receipt OCR service is unavailable.` | "Service is busy. Try again in a moment." | ✅ **same receipt** |
| No image attached | `400` | `{"image":["No file was submitted."]}` | "Attach a receipt photo." | ✅ |
| Claim expired | `400` | `This claim is no longer active.` | "This claim has expired." | ❌ re-claim if still active |
| Already submitted | `400` | `A receipt has already been submitted for this claim.` | Show current receipt status | ❌ |
| Claim not found | `400` | `Reservation not found.` | "Claim not found." Return to list | ❌ |
| Duplicate | `409` | `This receipt has already been used.` | §7 | ❌ |
| Unauthorized | `401` | `Authentication credentials were not provided.` | Refresh token, else logout | after re-auth |
| Network failure | — | — | "Check your connection." | ✅ |
| Campaign expired (at claim) | `400` | `This offer is not available.` | "No longer available." Refresh feed | ❌ |
| Already claimed | `400` | `You already have an active claim for this offer.` | Navigate to existing claim | ❌ |

### Critical retry rule

On **`422`** and **`503`** the claim is **completely untouched** — still `active`, no
receipt stored, nothing charged. Retrying the **same photo** is safe and correct.

On `400` validation failures nothing is stored either, but retrying the same photo will
fail identically — the customer needs a *different* receipt.

### Error parsing

```dart
String messageFor(Response r) {
  final d = r.data;
  if (d is Map && d['detail'] != null) return d['detail'].toString();
  if (d is Map && d['image'] is List) return (d['image'] as List).first.toString();
  return 'Something went wrong. Please try again.';
}
```

> Guard against non-JSON bodies. A misconfigured server can return an HTML error page; a
> blind `json.decode` throws `FormatException`. Check `content-type`/status first and fall
> back to a generic message.

---

## 9 — Wallet update

**The wallet balance is NOT in the receipt response.** `reward_amount` tells you what was
credited, not the new balance. To show it, call the wallet API.

| Purpose | Method | Endpoint |
|---|---|---|
| Balance | `GET` | `/api/v1/wallet/` |
| Transactions (paginated) | `GET` | `/api/v1/wallet/transactions/` |
| Activity feed | `GET` | `/api/v1/activity/` |
| Statement | `GET` | `/api/v1/wallet/statement/` |
| Reward records | `GET` | `/api/v1/redemptions/` |

### `GET /api/v1/wallet/` — `200`

```json
{
  "id": "afd93c5d-3eda-4a6c-afe0-984dd1ce27e5",
  "kind": "customer",
  "currency": "USD",
  "balance": "2.00",
  "held": 0.0,
  "available": 2.0,
  "updated_at": "2026-08-29T11:59:54.351639Z"
}
```

> ⚠️ **Mixed JSON types.** `balance` is a **String**; `held` and `available` are
> **numbers** (`double`). Model them accordingly, or normalise in `fromJson`.

For a customer wallet `held` is normally `0.0` (holds sit on the *brand* wallet), so
display `balance`.

### When to refresh

Call `GET /api/v1/wallet/` **only** after `201` with `status == "verified"`.
Do not refresh on `pending`, `400`, `409`, `422` or `503` — nothing was credited.

### Transaction proof (optional)

`GET /api/v1/wallet/transactions/` → paginated `{count, next, previous, results}`:

```json
{
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
}
```

`reference_id` is the **claim (reservation) id** — use it to link a transaction back to a
claim.

---

## 10 — API contract table

| Step | API | Method | Auth | Content-Type | Purpose |
|---|---|---|---|---|---|
| Login | `/api/v1/auth/login/` | `POST` | No | `application/json` | Obtain `access` / `refresh` |
| Token refresh | `/api/v1/auth/token/refresh/` | `POST` | No | `application/json` | Renew access token |
| Campaign feed | `/api/v1/offers/` | `GET` | Yes | — | Active campaigns (paginated) |
| Campaign detail | `/api/v1/offers/{campaign_id}/` | `GET` | Yes | — | Single offer |
| **Claim** | `/api/v1/reservations/` | `POST` | Yes | `application/json` | Claim a campaign |
| My claims | `/api/v1/reservations/` | `GET` | Yes | — | List (`?status=active`) |
| **Claim details** | `/api/v1/reservations/{id}/` | `GET` | Yes | — | Claim + `receipt_upload_url` + `receipt_status` |
| **Upload receipt** | `/api/v1/receipts/` | `POST` | Yes | `multipart/form-data` | Submit photo; returns final verdict |
| **Verify receipt** | `/api/v1/receipts/{id}/` | `GET` | Yes | — | Receipt status |
| Receipt history | `/api/v1/receipts/` | `GET` | Yes | — | Own receipts (paginated) |
| **Wallet** | `/api/v1/wallet/` | `GET` | Yes | — | Balance |
| Transactions | `/api/v1/wallet/transactions/` | `GET` | Yes | — | Ledger (paginated) |
| Rewards | `/api/v1/redemptions/` | `GET` | Yes | — | Issued rewards (paginated) |

**Not called by Flutter:** the OCR service. It is internal, server-to-server, and its URL
lives only in backend environment variables.

---

## 11 — Flutter data models

Only fields that actually exist are listed.

### `Claim` — reservation response

```dart
class Claim {
  final String id;                    // claim id
  final String campaign;              // UUID
  final String campaignName;
  final String brandName;
  final String productName;           // "" if none
  final String kind;                  // "rebate" | "review"
  final String offerType;             // "premium" | "fallback"
  final String rewardAmount;          // decimal STRING
  final String status;                // ClaimStatus
  final DateTime expiresAt;
  final DateTime? redeemedAt;         // nullable
  final DateTime createdAt;
  final String receiptUploadUrl;
  final String? receiptStatus;        // nullable: pending|verified|rejected
}
```

### `Receipt` — receipt response

```dart
class Receipt {
  final String id;
  final String reservation;           // claim id
  final String campaign;
  final String campaignName;
  final String brandName;
  final String status;                // ReceiptStatus
  final String merchant;              // "" if OCR read none
  final DateTime? purchasedAt;        // nullable
  final String receiptNumber;         // "" if unreadable
  final String? total;                // decimal string, nullable
  final bool matched;
  final int matchedUnits;
  final String rewardAmount;          // decimal string
  final String decisionReason;
  final List<ReceiptLineItem> lineItems;
  final DateTime createdAt;
}

class ReceiptLineItem {
  final String id;
  final String description;
  final int quantity;
  final String? unitPrice;            // decimal string, nullable
  final String? matchedProduct;       // product UUID, nullable
  final String? matchedProductName;   // nullable
}
```

> `fingerprint` is **not** in the API response. Do not add it.

### `Wallet`

```dart
class Wallet {
  final String id;
  final String kind;                  // "customer"
  final String currency;              // e.g. "USD"
  final String balance;               // STRING
  final double held;                  // NUMBER
  final double available;             // NUMBER
  final DateTime updatedAt;
}
```

### `LedgerEntry`

```dart
class LedgerEntry {
  final String id;
  final String entryType;             // "credit" | "debit"
  final String amount;                // decimal string
  final String signedAmount;          // decimal string
  final String category;              // "rebate_reward", "referral_bonus", "payout", …
  final String balanceAfter;
  final String referenceType;         // "redemption"
  final String referenceId;           // claim id
  final String description;
  final DateTime createdAt;
}
```

### Enums (exact backend values)

```dart
enum ClaimStatus { active, redeemed, expired, rejected, cancelled }
enum ReceiptStatus { pending, verified, rejected }
enum OfferType { premium, fallback }
enum ClaimKind { rebate, review }
```

`LedgerEntry.category`: `funding`, `rebate_reward`, `rebate_fee`, `review_reward`,
`review_fee`, `subscription`, `payout`, `referral_bonus`, `adjustment`.

### Paginated envelope

`/offers/`, `/reservations/`, `/receipts/`, `/wallet/transactions/`, `/redemptions/`,
`/activity/`, `/wallet/statement/` all return:

```json
{ "count": 1, "next": null, "previous": null, "results": [ … ] }
```

`GET /reservations/{id}/`, `/receipts/{id}/` and `/wallet/` return **bare objects**.

### Parsing notes

* Money is a **String** everywhere except `Wallet.held` / `Wallet.available`. Parse with `Decimal` (package `decimal`) — avoid `double` for money arithmetic.
* Timestamps are ISO-8601 UTC (`…Z`) → `DateTime.parse(...).toLocal()`.
* `merchant` and `receiptNumber` are `""` (empty string), never `null`, when OCR read nothing.
* `purchasedAt` and `total` **can** be `null`.

---

## 12 — State machine

```
                 INITIAL
                    │ tap Claim
                    ▼
                 CLAIMING ──── 400/401 ──► CLAIM_FAILED
                    │ 201                    │
                    ▼                        └─► ALREADY_CLAIMED → open existing claim
             RECEIPT_REQUIRED
             (claim.status=active, receipt_status=null)
                    │ pick photo
                    ▼
                UPLOADING  (multipart in flight)
                    │
                    ▼
                PROCESSING (awaiting response — server-side OCR + validation)
                    │
    ┌───────────────┼────────────────┬──────────────┬──────────────┐
    │ 201 verified  │ 201 pending    │ 400          │ 409          │ 422 / 503
    ▼               ▼                ▼              ▼              ▼
 SUCCESS       UNDER_REVIEW    INVALID_RECEIPT  DUPLICATE   RETRYABLE_ERROR
 (redeemed)    (no reward)     (wrong shop/     (no reward)  (claim untouched)
    │                           product/date)        │              │
    ▼                                │               └──────┬───────┘
 refresh wallet                      │                      │ retry
    │                                ▼                      ▼
    ▼                        back to RECEIPT_REQUIRED   UPLOADING
 COMPLETED
```

### Backend values behind each state

| Flutter state | Backend truth |
|---|---|
| `RECEIPT_REQUIRED` | `claim.status == "active"` && `receipt_status == null` |
| `UPLOADING` / `PROCESSING` | one in-flight `POST /receipts/` (client-side only) |
| `SUCCESS` | `201` + `receipt.status == "verified"` → claim becomes `redeemed` |
| `UNDER_REVIEW` | `201` + `receipt.status == "pending"` |
| `INVALID_RECEIPT` | `400` |
| `DUPLICATE` | `409` |
| `RETRYABLE_ERROR` | `422`, `503`, network |
| `EXPIRED` | `claim.status == "expired"` (7-day expiry) |
| `REJECTED` | `receipt_status == "rejected"` (brand declined a `pending` receipt) |

`UNDER_REVIEW` → `SUCCESS` or `REJECTED` happens **later**, decided by a human at the
brand. Resolve it by re-fetching the claim on screen resume — **never by polling**.

---

## 13 — Complete example

> Example data. Real captured responses; IDs shortened.

**1. Tap Claim** on `Chocolate Purchase Reward` — reward `2.00`, product
`Dark Chocolate Bar 100g`, shop `Fahad Chocolate Shop`.

**2. Request**
```http
POST /api/v1/reservations/
Authorization: Bearer <token>
Content-Type: application/json

{ "campaign": "cc60c7b4-46bb-44d2-bf12-2027612204fd" }
```

**3. Response — `201`**
```json
{ "id": "c9e6228c-…", "campaign_name": "Chocolate Purchase Reward",
  "brand_name": "Fahad Chocolate Shop", "product_name": "Dark Chocolate Bar 100g",
  "reward_amount": "2.00", "status": "active",
  "expires_at": "2026-09-05T11:59:54Z",
  "receipt_upload_url": "https://api.joinnibbl.com/api/v1/receipts/",
  "receipt_status": null }
```

**4. Navigate** → Claim Details.
"Buy **Dark Chocolate Bar 100g** at **Fahad Chocolate Shop** · Earn **2.00** · Upload by
5 Sep".

**5. Show Upload button** — `receipt_status == null` && `status == "active"`.

**6. Customer photographs the receipt** → `receipt.jpg`.

**7. Upload**
```http
POST /api/v1/receipts/
Authorization: Bearer <token>
Content-Type: multipart/form-data

reservation = c9e6228c-…
image       = receipt.jpg
```

**8. Processing** — "Uploading receipt…" then "Reading your receipt…". Single request;
no polling.

**9. Response — `201`**
```json
{ "id": "f6b6438c-…", "status": "verified",
  "merchant": "Fahad Chocolate Shop",
  "purchased_at": "2026-08-29T14:30:00Z",
  "receipt_number": "INV-12345", "total": "35.00",
  "matched": true, "matched_units": 1,
  "reward_amount": "2.00", "decision_reason": "Auto-verified.",
  "line_items": [
    { "description": "Dark Chocolate Bar", "quantity": 1,
      "matched_product_name": "Dark Chocolate Bar 100g" },
    { "description": "Coca Cola", "quantity": 1, "matched_product_name": null },
    { "description": "Biscuits",  "quantity": 1, "matched_product_name": null } ] }
```

**10. Success screen** — "Receipt accepted · **+2.00** added to your wallet".

**11. Wallet refresh**
```http
GET /api/v1/wallet/
```
```json
{ "kind": "customer", "currency": "USD",
  "balance": "2.00", "held": 0.0, "available": 2.0 }
```

**12. Claim status refresh**
```http
GET /api/v1/reservations/c9e6228c-…/
```
```json
{ "status": "redeemed", "redeemed_at": "2026-08-29T11:59:54Z",
  "receipt_status": "verified" }
```

### Same receipt, second customer

```http
POST /api/v1/receipts/    reservation=<B's claim>, image=<same receipt>
```
**409 Conflict**
```json
{ "detail": "This receipt has already been used." }
```
→ Show that message. B's wallet stays `0.00`; B's claim stays `active`, so they may upload
a different receipt.

---

## 14 — Implementation checklist

**Auth**
- [ ] Access token stored securely; attached to every call in this flow
- [ ] `401` → refresh via `/api/v1/auth/token/refresh/`, else logout
- [ ] Token refresh retries the original request once

**Claim**
- [ ] `POST /reservations/` with `{"campaign": "<campaign_id>"}`
- [ ] Button disabled during the request (prevents double-claim)
- [ ] `You already have an active claim…` → navigate to the existing claim, not an error
- [ ] Claim `id` persisted for the upload

**Claim details**
- [ ] `GET /reservations/{id}/` integrated
- [ ] Renders `reward_amount`, `product_name`, `brand_name`, `expires_at`
- [ ] Upload button gated on `receipt_status == null && status == "active"`
- [ ] Refresh on screen resume / pull-to-refresh

**Receipt upload**
- [ ] Camera **and** gallery
- [ ] `multipart/form-data`; `Content-Type` **not** set manually
- [ ] Fields `reservation` + `image`, filename has a real extension (`receipt.jpg`)
- [ ] Send/receive timeout **~60 s**
- [ ] Upload progress via `onSendProgress`
- [ ] Image compressed but still legible

**States**
- [ ] Loading (claim)
- [ ] Uploading → Processing (single blocking state, **no polling**)
- [ ] Success (`201` + `verified`) — reward + wallet refresh
- [ ] Under review (`201` + `pending`) — no reward, no wallet refresh
- [ ] Duplicate (`409`) — exact backend message, no retry
- [ ] Invalid receipt (`400`) — specific `detail`, retry with a different receipt
- [ ] Unreadable (`422`) — retry **same** photo allowed
- [ ] Service unavailable (`503`) — retry **same** photo allowed
- [ ] Expired claim / already submitted handled

**Wallet**
- [ ] `GET /wallet/` refreshed **only** after `verified`
- [ ] `balance` parsed as **String**; `held`/`available` as **numbers**
- [ ] Money handled as `Decimal`, not `double`

**Robustness**
- [ ] Non-JSON error bodies handled without `FormatException`
- [ ] Network failure → retryable with a clear message
- [ ] Cancelling the upload warns that processing may still complete
- [ ] Fingerprint / other customers' data **never** displayed
- [ ] OCR service **never** called from the app
