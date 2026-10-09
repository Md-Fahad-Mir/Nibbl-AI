# NibblAI — Consumer API Handover (Website + Mobile App)

**Audience:** Website devs · Mobile devs · QA. **Scope:** consumer-facing APIs only (admin & brand-dashboard APIs are intentionally excluded). Verified against the live codebase.

## Conventions (read first)
- **Base URL:** `https://<host>/api/v1/` — every path below is relative to this.
- **Auth:** JWT Bearer. Send `Authorization: Bearer <access_token>` on all authenticated calls.
- **Content type:** `application/json` (except receipt upload = `multipart/form-data`).
- **Money:** all amounts are **decimal strings** (e.g. `"5.00"`), never numbers. Don't do float math — use a decimal lib.
- **IDs:** UUID strings.
- **Pagination:** page-number based. Query: `?page=<n>&page_size=<≤100>` (default size **20**). Paginated responses look like:
  ```json
  { "count": 42, "next": "https://…?page=2", "previous": null, "results": [ … ] }
  ```
  ⚠️ **Not every list is paginated yet.** Each endpoint below says **Paginated: yes/no**. Endpoints marked "no" return a **plain JSON array**. Write your client to handle both per-endpoint.
- **Errors:** standard shape `{ "detail": "…" }` or field errors `{ "field": ["…"] }`. See §13.

---

## 1. Authentication

### Register
- **Endpoint:** `/auth/register/`
- **Method:** `POST` · **Auth:** none
- **Request:**
  ```json
  { "full_name": "Tamim Sarker", "email": "tamim@example.com", "password": "Sup3rSecret!", "accept_terms": true, "referral_code": "AB12CD34" }
  ```
  (`referral_code` optional.)
- **Response `201`:** (note — the user is **pending** until email is verified; `id` is `null` here)
  ```json
  { "id": null, "email": "tamim@example.com", "phone": null, "full_name": "Tamim Sarker",
    "role": "consumer", "is_email_verified": false, "is_phone_verified": false,
    "referral_code": "", "created_at": "2026-06-05T10:00:00Z" }
  ```
- **Validation:** `email` unique + valid; `password` ≥8 chars, not all-numeric, not common, not similar to email/name; `accept_terms` must be `true`.
- **Errors:** `400 {"email":["A user with this email already exists."]}`, `400 {"accept_terms":["You must accept the terms and conditions."]}`, `400 {"password":["…"]}`.
- **Flow:** Register → a 6-digit code is emailed → call **Email Verification** → only then can the user **Login**.

### Email Verification
- **Endpoint:** `/auth/verify-email/` · **Method:** `POST` · **Auth:** none
- **Request:** `{ "email": "tamim@example.com", "code": "123456" }`
- **Response `200`:** full user object (`is_email_verified: true`, real `id`).
- **Resend code:** `POST /auth/resend-email-verification/` `{ "email": "…" }` → `202` (always 202; never reveals if the email exists).
- **Errors:** `400 {"detail":"Invalid or expired code."}`

### Login
- **Endpoint:** `/auth/login/` · **Method:** `POST` · **Auth:** none · **Rate-limited** (10/min)
- **Request:** `{ "email": "tamim@example.com", "password": "Sup3rSecret!", "remember_me": false }`
- **Response `200`:** `{ "access": "<jwt>", "refresh": "<jwt>" }`
- **Token lifetimes:** access **30 min**; refresh **1 day** (or **30 days** if `remember_me: true`).
- **Errors:** `400 {"detail":"Invalid email or password."}`, `400 {"detail":"Email address is not verified."}`, `429` if throttled.

### Logout
- **Endpoint:** `/auth/logout/` · **Method:** `POST` · **Auth:** required
- **Request:** `{ "refresh": "<refresh_token>" }`
- **Response:** `205` (no body). The refresh token is blacklisted. Also clear tokens client-side.
- **Errors:** `400 {"detail":"Invalid or expired refresh token."}`

### Refresh Token
- **Endpoint:** `/auth/token/refresh/` · **Method:** `POST` · **Auth:** none (token is in the body)
- **Request:** `{ "refresh": "<refresh_token>" }`
- **Response `200`:** `{ "access": "<new_jwt>", "refresh": "<new_jwt>" }` — refresh **rotates**; store the new one and discard the old (the old is blacklisted).
- **Errors:** `401 {"detail":"Token is invalid or expired","code":"token_not_valid"}`
- **Pattern:** on any `401` from an authenticated call, call this once, retry the original request; if it also fails, force re-login.

### Password Reset (forgot)
- `POST /auth/password/forgot/` `{ "email": "…" }` → `202` (always; no enumeration). Emails a 6-digit code.
- `POST /auth/password/reset/` `{ "email": "…", "code": "123456", "new_password": "NewPass123!" }` → `200`. Errors: `400 {"detail":"Invalid or expired code."}`

### Social Login — ⚠️ not active
- `POST /auth/social/` `{ "provider": "google", "token": "…" }` → currently returns `400 {"detail":"Social login via google is not yet configured…"}`. Don't build against it until enabled.

---

## 2. Profile APIs

### Get Profile
- **Endpoint:** `/users/me/` · **Method:** `GET` · **Auth:** required
- **Response `200`:**
  ```json
  { "id":"…","email":"tamim@example.com","phone":"+15551234567","full_name":"Tamim Sarker",
    "avatar_url":"https://cdn/…","role":"consumer","is_email_verified":true,
    "is_phone_verified":true,"referral_code":"AB12CD34","created_at":"2026-05-01T10:00:00Z" }
  ```

### Update Profile
- **Endpoint:** `/users/me/` · **Method:** `PATCH` · **Auth:** required
- **Request:** `{ "full_name": "Tamim S.", "avatar_url": "https://cdn/new.png" }` (either field optional)
- **Response `200`:** updated user object. **No password needed to change name/avatar.**
- **Validation:** `avatar_url` must be a valid URL. (Email is **not** editable.)

### Change Password
- **Endpoint:** `/users/me/change-password/` · **Method:** `PATCH` · **Auth:** required
- **Request:** `{ "current_password": "Sup3rSecret!", "new_password": "NewPass123!" }`
- **Response `200`:** `{ "detail": "Password changed." }`
- **Errors:** `400 {"detail":"Current password is incorrect."}`, `400 {"new_password":["…"]}`

### Avatar Upload — ⚠️ URL-only (no binary upload)
- There is **no** multipart avatar-upload endpoint. Set the avatar by sending a hosted URL via `PATCH /users/me/ { "avatar_url": "…" }`. (Binary upload is postponed until object storage is provisioned.)

### Delete Account
- **Endpoint:** `/users/me/` · **Method:** `DELETE` · **Auth:** required
- **Request (body required):** `{ "password": "Sup3rSecret!" }`
- **Response:** `204`. Soft-deletes the account and frees the email/phone for reuse.
- **Errors:** `400 {"detail":"Password is incorrect."}`, `400 {"password":["This field is required."]}`
- **UX:** show a confirm modal that collects the current password.

### Phone (optional) — ⚠️ SMS not wired in prod
- `POST /users/me/phone/` `{ "phone": "+15551234567" }` → `202` (sends a code; in current envs the code is logged, not SMS-delivered).
- `POST /users/me/phone/verify/` `{ "code": "123456" }` → `200`.

---

## 3. Dashboard / Home APIs

The app/site has two consumer hubs: **Offers/Home** and **Rewards Hub (Scan)**. There is no single combined endpoint — call these in parallel.

### Home / Offers screen — load order
| Order | Call | Purpose |
|---|---|---|
| 1 (parallel) | `GET /wallet/` | balance card |
| 1 (parallel) | `GET /offers/?page=1` | offer feed grid |
| 1 (parallel) | `GET /notifications/unread-count/` | bell badge |
| 2 (lazy) | `GET /reservations/?status=active` | "pending rewards" (claimed, awaiting receipt) |
| 2 (lazy) | `GET /reviews/opportunities/` | "leave a review" items |
| 3 (lazy) | `GET /offers/categories/` | filter pills |

### Rewards Hub (Scan) screen — load order
| Order | Call | Purpose |
|---|---|---|
| 1 | `GET /reservations/?status=active` | Pending Rebates |
| 1 | `GET /reviews/opportunities/` | "Want to earn more?" |
| 1 | `GET /receipts/?page=1` | Receipt History |
| 2 (lazy) | `GET /activity/?page=1` | Activity History (money trail) |
| 2 (lazy) | `GET /users/me/referrals/` | Invite Friends card |

---

## 4. Offer APIs

**Offer object** (returned by feed / detail / by-url / by-qr / saved):
```json
{ "campaign_id":"…","name":"Summer Athletic Collection","brand_id":"…","brand_name":"Beast By",
  "product_id":"…","product_name":"Organic Popcorn","product_image":"https://…","category":"Food",
  "offer_type":"premium","reward_amount":"5.00","restriction":"","min_purchase_units":1,
  "is_bogo":false,"in_cooldown":false,"claimable":true,"end_at":"2025-02-28T00:00:00Z",
  "rating":4.0,"review_count":100,"is_claimed":false,"reservation_id":null,
  "deal_type":"free","offer_headline":"Free Organic Popcorn up to $5",
  "offer_description":"Buy one eligible Organic Popcorn product and receive the verified purchase price back, up to $5.",
  "required_quantity":1,"going_fast":false,"temporarily_unavailable":false,
  "campaign_image":"https://…","retailer_required":false,"eligible_retailers":[],
  "eligible_products":[{"id":"…","name":"Organic Popcorn","image":"https://…","rating":4.0,"review_count":100}],
  "cooldown_days":30,"one_time_only":false,
  "where_to_buy":["Kroger","Target","Walmart"],"featured_retailers":["Target"] }
```
- `claimable` → show/enable the Claim button. `is_claimed` + `reservation_id` → user already has a live reservation (route to receipt upload instead).
- ⚠️ **`discount_label` (the "20% OFF" badge text) is not finalized** — it appears only on Saved Offers and is currently `null` (pending a product decision). Until then, render the badge from `reward_amount` + `deal_type` (see below).

### Rebate deals — what changed (Oct 2026 redesign) ⚠️ app update needed

All changes are **additive**: existing fields keep their names and types, so the current app keeps working. Update the app to match the Master Requirements:

| Before | Now |
|---|---|
| Brands set reward tiers + a daily $ budget | Each campaign is one **deal type**: Free, BOGO Free, Buy 1 Get 1 50% Off, or Buy X Get $Y |
| `reward_amount` = the reward paid | `reward_amount` = the **maximum** one redemption can pay. The actual reward comes from the verified receipt price (Free up to $5, item cost $3 → $3 paid) |
| Fallback offer during cooldown (`offer_type: "fallback"`) | **Retired.** `offer_type` is `"premium"` or `null`, never `"fallback"` |
| Cooldown started at claim | Cooldown starts when the redemption is **approved**. An expired claim never starts a cooldown |
| Unlimited claims within the daily budget | **25-hour claim capacity.** When full, the offer is temporarily unavailable until the next 25-hour cycle |
| Campaign dates not enforced for claims | Offers can't be claimed before their start date or after `end_at` |
| Unreadable receipt price paid automatically | Unreadable price → receipt stays **pending review** until a person decides |

**New offer fields**

| Field | Type | Use |
|---|---|---|
| `deal_type` | `"free"` \| `"bogo_free"` \| `"bogo_half"` \| `"buy_x_get_y"` | Offer type |
| `offer_headline` | string | **Main title of the offer** (brand-approved wording). Show exactly as sent |
| `offer_description` | string | Offer description. Show exactly as sent |
| `campaign_image` | URL or `""` | Image at the top of the offer; fall back to `product_image` |
| `required_quantity` | int | Eligible units needed on one receipt (BOGO = 2, Buy X = X) |
| `eligible_products` | `[{id, name, image, rating, review_count}]` | Product slider — every eligible flavor/size |
| `retailer_required` | bool | `true` = receipt must be from a listed retailer |
| `eligible_retailers` | string[] | Retailer names when `retailer_required` is true |
| `cooldown_days` | int | Days before the shopper can redeem again after an approved redemption (0 = none) |
| `one_time_only` | bool | One redemption ever, per shopper |
| `where_to_buy` | string[] | **Where to Buy** list. When `retailer_required`, it's only the eligible receipt retailers — show them all, no "+ more" |
| `featured_retailers` | string[] | Up to 3 retailers to show in the offer summary (e.g. *"Available at Target"*). Informational — doesn't change receipt rules |
| `going_fast` | bool | Show a **"Going fast"** badge |
| `temporarily_unavailable` | bool | 25-hour capacity is full — show the unavailable state |

> **Never show `name` / `campaign_name` to shoppers** — it's the brand's **internal** campaign name. Use `offer_headline` (fallback `product_name`). Reservations, receipts and redemptions now include `offer_headline` too.

**What to display**
- **Title:** `offer_headline` · **Image:** `campaign_image` → `product_image` · **Description:** `offer_description`.
- **Reward badge:** `buy_x_get_y` → `"$<reward_amount> back"`; every other type → `"Up to $<reward_amount>"` (never a fixed amount). `reward_amount` is `null` when not claimable — hide the badge.
- **"Going fast"** badge when `going_fast`.
- **Product slider** from `eligible_products` (ratings belong to each product).
- **Retailers:** `featured_retailers` in the offer summary/card ("Available at …"); `where_to_buy` on the offer details page.
- **Receipt eligibility** — show before claiming, after claiming, in My Offers and on receipt upload:
  - not required → *"Buy at any retailer — your receipt just needs to clearly show the eligible product."*
  - required → *"Purchase required at: Target, Kroger. Your receipt must clearly show the retailer name."*
- **Cooldown line:** `one_time_only` → *"One redemption per customer."* · `cooldown_days > 0` → *"After a redemption is approved, you can redeem this offer again in N days."* · `0` → *"You can redeem this offer again once your previous redemption is approved."*

**Claim button states**

| Condition | Button | Message |
|---|---|---|
| `claimable: true` | **Claim offer** | — |
| `temporarily_unavailable: true` | Disabled | "Current rebates have been claimed. This offer is temporarily unavailable — check back soon." |
| `in_cooldown` + `one_time_only` | Disabled | "You've already redeemed this offer." |
| `in_cooldown: true` | Disabled | "You've redeemed this offer recently. It will be available again after your cooldown." |
| `is_claimed: true` | Go to the existing claim (`reservation_id`) | Continue to receipt upload |
| otherwise `claimable: false` | Disabled | "This offer isn't available right now." |

### Offer List (feed)
- `GET /offers/` · **Auth:** required · **Paginated: yes**
- **Query params:** `search` (free text over offer/brand/product name), `category` (e.g. `Food`; `all`/`explore` = no filter), `page`, `page_size`.
- **Response:** paginated list of Offer objects.

### Offer Categories
- `GET /offers/categories/` · **Auth:** required · **Paginated: no** → `[{ "category": "Food" }, { "category": "Electronics" }]`

### Offer Detail (thin)
- `GET /offers/{campaign_id}/` · **Auth:** required → single Offer object.

### Offer Detail (rich content page)
- `GET /offers/{campaign_id}/details/` · **Auth:** required → Offer object **plus**:
  ```json
  { "...offer fields...":"…","description":"Step into summer…",
    "how_it_works":[{"icon":"gift","text":"Claim this offer, then buy the eligible product at any store or online retailer."},
                    {"icon":"upload","text":"Upload your receipt in NibblAI within 7 days of claiming."},
                    {"icon":"wallet","text":"Get your reward in your Nibbl wallet once your receipt is approved."}] }
  ```
- `how_it_works` is worded per offer: when the offer requires specific retailers, step 1 names them (e.g. "…buy the eligible product at Target, Kroger."). Render the `text` as sent.

### Public entry points (no login required)
- `GET /offers/by-url/{token}/` and `GET /offers/by-qr/{token}/` · **Auth:** none → Offer object. Use for shared links / scanned QR landing.

### Claim Offer
- Claiming = **creating a reservation** → `POST /reservations/` (see §5). There is no separate `/claim` endpoint.

### Save / Bookmark
- **Save an offer:** `POST /offers/{campaign_id}/save/` · **Auth:** required → `201` Bookmark object. (Saves the offer's underlying product.)
- **Bookmark directly:** `POST /bookmarks/` `{ "kind": "product", "product": "<uuid>" }` or `{ "kind": "brand", "brand": "<uuid>" }` → `201`.
- **Remove bookmark:** `DELETE /bookmarks/{bookmark_id}/` → `204`.
- **List raw bookmarks:** `GET /bookmarks/` · **Paginated: yes** (thin rows: `id,kind,product,brand,product_name,brand_name,created_at`).

### Saved Offers (render-ready cards)
- `GET /offers/saved/` · **Auth:** required · **Paginated: yes**
- Returns full Offer cards for the user's bookmarked products that have an **active** campaign, each with extra `bookmark_id` and `discount_label` (null for now). Use this (not `/bookmarks/`) to render the Saved Offers screen. Remove a card via `DELETE /bookmarks/{bookmark_id}/`.

---

## 5. Reservation APIs

A **reservation** = a claimed offer, held for the user while they upload a receipt.

**Lifecycle:** `active` (claimed, awaiting receipt — **7 days**, see `/config/`) → `redeemed` (receipt verified, reward paid) → or `expired` / `rejected` / `cancelled`.

**Reservation object:**
```json
{ "id":"…","campaign":"…","campaign_name":"Summer…","offer_headline":"Free Organic Popcorn up to $5","brand_name":"Beast By","product_name":"Organic Popcorn",
  "kind":"premium","offer_type":"premium","reward_amount":"5.00","status":"active",
  "expires_at":"2026-06-12T…","redeemed_at":null,"created_at":"2026-06-05T…" }
```

### Create Reservation (claim)
- `POST /reservations/` `{ "campaign": "<campaign_id>" }` · **Auth:** required → `201` Reservation.
- `reward_amount` on a reservation is the **reserved maximum**; the paid amount is on the redemption (§8) once approved.
- **Errors `400`** (show `detail` as-is):
  - `"Current rebates have been claimed. This offer is temporarily unavailable."` — 25-hour capacity filled
  - `"You've already redeemed this offer recently."` — cooldown
  - `"You already have an active claim for this offer."` — already reserved
  - `"This offer is not available."` — not live, before its start date, or past its end date

### Reservation List
- `GET /reservations/` · **Auth:** required · **Paginated: yes** · **Query:** `status` (e.g. `active`), `page`.
- ⚠️ "Pending rewards" = `?status=active` (the claimed-but-not-yet-redeemed state). The value is **`active`**, not "reserved/pending".

### Reservation Detail
- `GET /reservations/{reservation_id}/` · **Auth:** required → Reservation.

---

## 6. Receipt APIs

**Receipt status flow:** `pending` → `verified` (reward issued) or `rejected`.

### Upload Receipt
- `POST /receipts/` · **Auth:** required · **Content-Type:** `multipart/form-data`
- **Required:** `reservation` (UUID) — **a receipt must be tied to an existing active reservation** (claim the offer first).
- **Fields:** `reservation` (req), `image` (file, optional), `merchant` (string), `purchased_at` (ISO datetime), `total` (decimal string), `items` (JSON array of `{ "description","quantity","unit_price" }`).
- **File rules:** images (`image/jpeg`, `image/png`) — validate MIME + size client-side (recommend ≤10 MB). A structured "digital receipt" (items without image) is also accepted.
- **Response `201`:** Receipt object:
  ```json
  { "id":"…","reservation":"…","campaign":"…","campaign_name":"…","offer_headline":"…","brand_name":"…",
    "status":"pending","merchant":"Starbucks","purchased_at":"2026-06-04T…","total":"25.50",
    "matched":true,"matched_units":1,"decision_reason":"","line_items":[…],"created_at":"…" }
  ```
- **Errors `400`:** invalid/expired reservation, duplicate receipt, validation (in `detail`).
- `status: "pending"` = under review. More common now: a receipt whose price can't be read waits for a person instead of paying automatically. Show it as "Under review", not as an error.
  - A receipt under review is decided within **7 days of upload**: the brand approves or rejects it, otherwise it is approved automatically (at the offer's maximum reward). Safe to tell shoppers: *"We'll review your receipt within 7 days."*
  - While a receipt is under review, its reservation stays `active` (it is **not** expired at the 7-day claim deadline). Don't offer "Upload Receipt" again for a reservation that already has a pending receipt.
- `status: "rejected"` → show `decision_reason` to the shopper. Brand rejections now use standard reasons:
  "Purchase outside reservation period", "Required retailer not eligible", "Eligible item not found", "Required quantity not met", "Price not visible", "Receipt unreadable after resubmission", "Duplicate receipt or previously allocated item", "Final resubmission rejected" (sometimes followed by " — <brand note>").
- If the offer requires specific retailers (`retailer_required`), show the receipt-eligibility line on this screen too (see §4).

### Receipt List
- `GET /receipts/` · **Auth:** required · **Paginated: yes** → Receipt objects (newest first). Use for "Receipt History".

### Receipt Detail
- `GET /receipts/{receipt_id}/` · **Auth:** required → Receipt object (includes `line_items`).

---

## 7. Review APIs

Earn extra cash by reviewing purchased products. **Lifecycle:** an opportunity (review session) is created after a verified receipt → user answers/submits → review is `published` (or `held` for low ratings, or `removed`).

### Review Opportunities
- `GET /reviews/opportunities/` · **Auth:** required · **Paginated: no** (plain array)
- Returns open **review sessions**:
  ```json
  [{ "id":"…","product":"…","product_name":"Lacroix Grapefruit 12pk","brand_name":"…",
     "reward_amount":"1.00","status":"active","expires_at":"…","messages":[…],
     "prompts":["What did you think of…?","…"],"created_at":"…" }]
  ```

### Review Session Detail
- `GET /reviews/sessions/{session_id}/` · **Auth:** required → session object (with `prompts` + `messages`).

### Answer a prompt (chat-style, optional)
- `POST /reviews/sessions/{session_id}/answer/` `{ "text": "Loved it" }` → `200`.

### Submit Review
- `POST /reviews/sessions/{session_id}/submit/` `{ "rating": 5, "content": "Great product!" }` → `201` Review.
- **Validation:** `rating` 1–5 (required); `content` optional.
- **Errors `400`:** session expired / not eligible (in `detail`).

### My Reviews (status)
- `GET /reviews/` · **Auth:** required · **Paginated: no** (plain array)
- Items: `{ id, product, product_name, user_email, rating, content, status, published_at, created_at }`. `status` ∈ `published | held | removed`.

### Public Product Reviews (for offer/product pages)
- `GET /products/{product_id}/reviews/` · **Auth:** required · **Paginated: yes** — published reviews, **no email** exposed: `{ id, author_name, author_avatar, rating, content, published_at, created_at }`.
- `GET /products/{product_id}/review-summary/` → `{ "rating": 4.0, "review_count": 100 }`.

---

## 8. Wallet APIs

### Wallet Summary
- `GET /wallet/` · **Auth:** required → `{ "id":"…","kind":"customer","currency":"USD","balance":"51.25","held":"10.00","available":"41.25","updated_at":"…" }`
- **`available` = balance − held**; use `available` as the withdrawable amount. `held` = amount tied up in pending withdrawals.

### Wallet Transactions (full ledger)
- `GET /wallet/transactions/` · **Auth:** required · **Paginated: yes**
- Items: `{ id, entry_type ("credit"|"debit"), amount, signed_amount, category, balance_after, reference_type, reference_id, description, created_at }`. These are **posted (completed)** entries only.

### Activity Feed (Rewards-Hub "Activity History")
- `GET /activity/` · **Auth:** required · **Paginated: yes**
- Normalized money-trail items: `{ id, entry_type, category, amount (signed), title, reference_type, reference_id, created_at }`.

### Wallet Statement (Transaction Summary modal — completed **and** pending)
- `GET /wallet/statement/` · **Auth:** required · **Paginated: yes**
- Merges completed ledger entries **+ open (pending) withdrawals**: `{ id, kind ("ledger"|"withdrawal"), description, amount (signed; withdrawals are negative), status ("completed"|"pending"|…), created_at }`. Use this when the UI shows mixed Completed/Pending rows.

### Redemptions (reward history)
- `GET /redemptions/` · **Auth:** required · **Paginated: yes**
- Items: `{ id, reservation, receipt, campaign, campaign_name, offer_headline, brand_name, reward_amount, fee_amount, status, issued_at, created_at }`.
- `reward_amount` here is the **amount actually paid** — it can be lower than the offer's "up to" amount. Title rows with `offer_headline`, not `campaign_name`.
- New: `approval_type` (`auto_verified` | `brand_approved` | `auto_approved` | `alias_approved`) + `approval_label` (e.g. "Automatically Approved — Review Deadline Passed"). Optional to show; useful in reward details.
- `GET /redemptions/{redemption_id}/` → single redemption.

---

## 9. Withdrawal APIs

**Manual payout flow:** (1) user adds a payout method → (2) user submits a withdrawal for an amount → (3) the amount is **held** on the wallet (`available` drops) → (4) an admin sends the money out-of-band → (5) admin marks it **paid** (the hold is captured as a ledger debit). Rejected/flagged releases the hold.

### Payout Methods
- **List:** `GET /payout-methods/` · **Auth:** required · **Paginated: no** (array) → `[{ id, provider, handle, is_default, created_at }]`
- **Create:** `POST /payout-methods/` `{ "provider": "paypal", "handle": "me@paypal.com", "is_default": true }` → `201`. `provider` ∈ `paypal | venmo`. `handle` = the email/username to pay.
- **Delete:** `DELETE /payout-methods/{method_id}/` → `204`.

### Withdraw Funds
- `POST /withdrawals/` `{ "payout_method": "<method_id>", "amount": "40.00" }` · **Auth:** required → `201` Withdrawal.
- **Validation:** `amount` > 0, ≥ **minimum** (`payout_min_amount` from `/config/`, default `$1.00`), and ≤ wallet `available` (else `400`).
- **Withdrawal object:** `{ id, payout_method, provider, handle, amount, status, admin_note, batch, reviewed_at, paid_at, created_at }`. `status` ∈ `pending | approved | processing | paid | rejected | flagged`.
- Multiple pending withdrawals are allowed (each holds its own amount, bounded by `available`).

### Withdrawal History
- `GET /withdrawals/` · **Auth:** required · **Paginated: yes**
- `GET /withdrawals/{withdrawal_id}/` → single withdrawal.

---

## 10. Referral APIs

**Reward condition:** the inviter earns the referral bonus (see `referral_bonus_amount` in `/config/`, default `$5`) when the invited friend signs up with the inviter's code and completes their first receipt + review.

### Referral Summary
- `GET /users/me/referrals/` · **Auth:** required → `{ "referral_code":"AB12CD34", "total_referrals":2, "referrals":[{ "id","full_name","created_at" }] }`

### Invite Friend
- `POST /users/me/referrals/invite/` · **Auth:** required · **Rate-limited** (20/hr)
- **Request:** `{ "full_name": "Jane Doe", "contact": "jane@example.com" }`
- **Response `202`:** `{ "status": "sent", "channel": "email" }`
- ⚠️ **Email only.** A phone number in `contact` returns `400 {"detail":"Phone invites aren't available yet — use an email address."}` (SMS not wired). Self-invite returns `400`. Existing-user contacts still return `202` (no enumeration).

### Referral History
- Same as Referral Summary (`referrals[]` array). There is no separate paginated history endpoint.

---

## 11. Notification APIs

### List Notifications
- `GET /notifications/` · **Auth:** required · **Paginated: no** (plain array) · **Query:** `unread=true` to filter.
- Items: `{ id, type, title, body, data, status, read_at, created_at }`.

### Unread Count (bell badge)
- `GET /notifications/unread-count/` → `{ "unread_count": 2 }`

### Mark Read / Mark All Read
- `POST /notifications/{notification_id}/read/` → `{ "detail": "Marked as read." }`
- `POST /notifications/read-all/` → `{ "marked_read": 5 }`

### Device Tokens (push registration)
- `GET /device-tokens/` (array) · `POST /device-tokens/` `{ "token":"<fcm_token>", "platform":"ios" }` (`platform` ∈ `ios|android|web`) → `201` · `DELETE /device-tokens/{token_id}/` → `204`.

---

## 12. Settings APIs

### Notification Preferences
- `GET /notification-preferences/` · **Auth:** required → `{ "push_enabled":true,"receipt_reminders":true,"review_reminders":true,"rewards":true,"new_offers":true,"inactivity":true,"promotional":true }`
- `PATCH /notification-preferences/` `{ "push_enabled": false }` (any subset) → updated object. The single "Notification" toggle on the Profile screen maps to **`push_enabled`**.

### Account Settings
- Covered by Profile (§2): update name/avatar, change password, delete account, phone.

### Legal / Content Pages — **static frontend** (no API)
- Privacy Policy, Terms & Conditions, FAQ, Help & Support, Contact Us are **frontend-static for Phase 1** — there are **no content endpoints**. Ship the copy in the app/site.
- Platform constants you *can* fetch: `GET /config/` (no auth) → `{ "claim_window_days":7, "review_reward_amount":"1.00", "referral_bonus_amount":"5.00", "payout_min_amount":"1.00" }`. Use these instead of hardcoding amounts/limits in UI copy.

---

## 13. API Error Standards

All errors are JSON. Common shapes:

- **400 Validation** — business rule or bad input:
  ```json
  { "detail": "Email address is not verified." }
  ```
  or field-level:
  ```json
  { "password": ["This password is too common."] }
  ```
- **401 Unauthorized** — missing/expired access token → refresh then retry:
  ```json
  { "detail": "Given token not valid for any token type", "code": "token_not_valid" }
  ```
  or `{ "detail": "Authentication credentials were not provided." }`
- **403 Forbidden** — authenticated but not allowed:
  ```json
  { "detail": "You do not have permission to perform this action." }
  ```
- **404 Not Found:**
  ```json
  { "detail": "Not found." }
  ```
- **429 Too Many Requests** — hit a rate limit (login/register/reset, invite):
  ```json
  { "detail": "Request was throttled. Expected available in 42 seconds." }
  ```
- **500 Server Error:** `{ "detail": "…" }` — show a generic "something went wrong", offer retry.

**Client rules of thumb:** treat `4xx` `detail` as a user-displayable message; on `401` run the refresh-retry cycle once; on `429` back off using the seconds in the message.

---

## 14. Frontend Integration Notes (per screen)

**Auth / Onboarding**
- Register → `POST /auth/register/` → `POST /auth/verify-email/` → `POST /auth/login/`.

**Home / Offers**
- `GET /wallet/` · `GET /offers/?page=1` · `GET /notifications/unread-count/` · (lazy) `GET /reservations/?status=active` · `GET /reviews/opportunities/` · `GET /offers/categories/`

**Offer Detail**
- `GET /offers/{id}/details/` → claim with `POST /reservations/ {campaign}` → on success route to receipt upload for `reservation_id`.

**Rewards Hub (Scan)**
- `GET /reservations/?status=active` · `GET /reviews/opportunities/` · `GET /receipts/?page=1` · (lazy) `GET /activity/?page=1` · `GET /users/me/referrals/` · upload via `POST /receipts/`.

**Wallet**
- `GET /wallet/` · `GET /redemptions/?page=1` · `GET /payout-methods/` · history modal `GET /wallet/statement/?page=1` · withdraw `POST /withdrawals/`.

**Withdraw Modal**
- Require a payout method (`GET /payout-methods/`; if none → prompt `POST /payout-methods/`). Submit `POST /withdrawals/ {payout_method, amount}` (validate `amount ≤ wallet.available` and `≥ payout_min_amount`).

**Profile**
- `GET /users/me/` · toggle `PATCH /notification-preferences/ {push_enabled}` · logout `POST /auth/logout/` · delete `DELETE /users/me/ {password}`.

**Edit Profile**
- `PATCH /users/me/ {full_name, avatar_url}`; if password fields filled → `PATCH /users/me/change-password/`.

**Saved Offers**
- `GET /offers/saved/?page=1`; remove `DELETE /bookmarks/{bookmark_id}/`; claim `POST /reservations/`.

**Invite Friends**
- `GET /users/me/referrals/` (code + count) · `POST /users/me/referrals/invite/ {full_name, contact}`.

**Notifications**
- `GET /notifications/` · `POST /notifications/{id}/read/` · `POST /notifications/read-all/` · badge `GET /notifications/unread-count/`.

---

## 15. Final API Inventory

Legend: ✅ Ready · ⚠️ Requires frontend awareness · ❌ Not implemented

| Feature | Endpoint | Method | Auth | Status |
|---|---|---|---|---|
| Register | `/auth/register/` | POST | No | ✅ (returns pending user; verify email next) |
| Verify email | `/auth/verify-email/` | POST | No | ✅ |
| Resend verification | `/auth/resend-email-verification/` | POST | No | ✅ |
| Login | `/auth/login/` | POST | No | ✅ (rate-limited) |
| Logout | `/auth/logout/` | POST | Yes | ✅ |
| Refresh token | `/auth/token/refresh/` | POST | No (body) | ✅ (refresh rotates) |
| Forgot password | `/auth/password/forgot/` | POST | No | ✅ |
| Reset password | `/auth/password/reset/` | POST | No | ✅ |
| Social login | `/auth/social/` | POST | No | ❌ not configured |
| Get profile | `/users/me/` | GET | Yes | ✅ |
| Update profile | `/users/me/` | PATCH | Yes | ✅ |
| Change password | `/users/me/change-password/` | PATCH | Yes | ✅ |
| Avatar upload | — | — | — | ❌ URL-only via PATCH |
| Delete account | `/users/me/` | DELETE | Yes | ⚠️ requires `{password}` in body |
| Add phone | `/users/me/phone/` | POST | Yes | ⚠️ SMS not wired |
| Verify phone | `/users/me/phone/verify/` | POST | Yes | ⚠️ SMS not wired |
| Config (constants) | `/config/` | GET | No | ✅ |
| Offer feed | `/offers/` | GET | Yes | ✅ paginated · `search`,`category` |
| Offer categories | `/offers/categories/` | GET | Yes | ⚠️ not paginated (array) |
| Offer detail | `/offers/{id}/` | GET | Yes | ✅ |
| Offer detail (rich) | `/offers/{id}/details/` | GET | Yes | ✅ |
| Offer by URL | `/offers/by-url/{token}/` | GET | No | ✅ |
| Offer by QR | `/offers/by-qr/{token}/` | GET | No | ✅ |
| Save offer | `/offers/{id}/save/` | POST | Yes | ✅ |
| Saved offers (cards) | `/offers/saved/` | GET | Yes | ✅ paginated · ⚠️ `discount_label` null |
| Bookmarks list | `/bookmarks/` | GET | Yes | ✅ paginated (thin) |
| Add bookmark | `/bookmarks/` | POST | Yes | ✅ |
| Remove bookmark | `/bookmarks/{id}/` | DELETE | Yes | ✅ |
| Create reservation (claim) | `/reservations/` | POST | Yes | ✅ |
| Reservation list | `/reservations/` | GET | Yes | ✅ paginated · `status=active` |
| Reservation detail | `/reservations/{id}/` | GET | Yes | ✅ |
| Upload receipt | `/receipts/` | POST | Yes | ⚠️ multipart + requires `reservation` |
| Receipt list | `/receipts/` | GET | Yes | ✅ paginated |
| Receipt detail | `/receipts/{id}/` | GET | Yes | ✅ |
| Review opportunities | `/reviews/opportunities/` | GET | Yes | ⚠️ not paginated (array) |
| Review session detail | `/reviews/sessions/{id}/` | GET | Yes | ✅ |
| Answer review prompt | `/reviews/sessions/{id}/answer/` | POST | Yes | ✅ |
| Submit review | `/reviews/sessions/{id}/submit/` | POST | Yes | ✅ |
| My reviews | `/reviews/` | GET | Yes | ⚠️ not paginated (array) |
| Product reviews (public) | `/products/{id}/reviews/` | GET | Yes | ✅ paginated · no email |
| Product review summary | `/products/{id}/review-summary/` | GET | Yes | ✅ |
| Wallet summary | `/wallet/` | GET | Yes | ✅ |
| Wallet transactions | `/wallet/transactions/` | GET | Yes | ✅ paginated |
| Activity feed | `/activity/` | GET | Yes | ✅ paginated (money trail) |
| Wallet statement | `/wallet/statement/` | GET | Yes | ✅ paginated (completed+pending) |
| Redemptions list | `/redemptions/` | GET | Yes | ✅ paginated |
| Redemption detail | `/redemptions/{id}/` | GET | Yes | ✅ |
| Payout methods list | `/payout-methods/` | GET | Yes | ⚠️ not paginated (array) |
| Add payout method | `/payout-methods/` | POST | Yes | ✅ (`paypal`/`venmo`) |
| Delete payout method | `/payout-methods/{id}/` | DELETE | Yes | ✅ |
| Request withdrawal | `/withdrawals/` | POST | Yes | ✅ |
| Withdrawal list | `/withdrawals/` | GET | Yes | ✅ paginated |
| Withdrawal detail | `/withdrawals/{id}/` | GET | Yes | ✅ |
| Referral summary | `/users/me/referrals/` | GET | Yes | ✅ |
| Invite friend | `/users/me/referrals/invite/` | POST | Yes | ⚠️ email only (phone → 400) |
| Notifications list | `/notifications/` | GET | Yes | ⚠️ not paginated · `unread=true` |
| Unread count | `/notifications/unread-count/` | GET | Yes | ✅ |
| Mark read | `/notifications/{id}/read/` | POST | Yes | ✅ |
| Mark all read | `/notifications/read-all/` | POST | Yes | ✅ |
| Notification preferences | `/notification-preferences/` | GET/PATCH | Yes | ✅ |
| Device tokens | `/device-tokens/` | GET/POST | Yes | ⚠️ list not paginated |
| Delete device token | `/device-tokens/{id}/` | DELETE | Yes | ✅ |
| Legal/FAQ/Contact content | — | — | — | ❌ static frontend (by design) |

### Known frontend-awareness items (summary)
1. **Not-paginated lists** (plain arrays): `/offers/categories/`, `/reviews/opportunities/`, `/reviews/`, `/notifications/`, `/payout-methods/`, `/device-tokens/`. Everything else listed as "paginated" returns the `{count,next,previous,results}` envelope.
2. **`discount_label`** is `null` pending a product decision.
3. **Avatar** is URL-only; **phone/SMS** and **social login** are not active; **legal content** is static.
4. **Receipt upload** is multipart and requires an existing **active** reservation.
5. **Reservation "pending"** filter value is **`active`**.
6. **Rebate redesign (Oct 2026)** — see §4 "Rebate deals — what changed": title offers with `offer_headline` (never `name`/`campaign_name`), reward badge "Up to $X", "Going fast", claim-button states, receipt-eligibility and cooldown lines, product slider. `offer_type` is never `"fallback"` any more.
7. **Receipt review (Oct 2026)** — see §6: receipts under review are decided within 7 days of upload (auto-approved otherwise); show `decision_reason` on rejected receipts; a reservation with a pending receipt stays `active`.
