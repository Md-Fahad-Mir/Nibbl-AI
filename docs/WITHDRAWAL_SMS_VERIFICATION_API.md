# Shopper App — Developer Guide

**Audience:** mobile app (and web) developers integrating the shopper flows.
**Date:** 2026-10-07 · updated 2026-10-08

**Covers:**
1. [Withdrawal SMS Verification](#part-1--withdrawal-sms-verification)
2. [Receipt Reminders & Notifications](#part-2--receipt-reminders--notifications)
3. [Claiming: consents, claim slots & payout-account review](#part-3--claiming-consents-claim-slots--payout-account-review)

---

# Part 1 — Withdrawal SMS Verification

Withdrawals now require a one-time **SMS code** (Twilio Verify) before a withdrawal request is created. There was no withdrawal verification before (it was never email) — this is a new step.

The change for you is small: **one new endpoint to call first, and one new field** on the existing create-withdrawal request. The create-withdrawal **path is unchanged**.

Base URL (production): `https://api.joinnibbl.com/api/v1`
All endpoints require the shopper's auth token (`Authorization: Bearer <access>`).

---

## The flow

```
1. Shopper enters amount + picks their (locked) payout method
2. App → POST /withdrawals/send-code/   → SMS code sent to their verified phone
3. Shopper reads the 6-digit code and types it in
4. App → POST /withdrawals/ (now with "code")  → withdrawal created
```

### Step 1 — Send the code  (NEW endpoint)

```
POST /api/v1/withdrawals/send-code/
Content-Type: application/json
Authorization: Bearer <access>

{
  "payout_method": "<payout_method_uuid>",
  "amount": "10.00"
}
```

**200 OK**
```json
{ "phone": "•••• ••0123" }
```
→ an SMS code has been sent to the shopper's verified phone. Show the masked
`phone` on the "Verify this withdrawal" screen.

### Step 2 — Create the withdrawal  (SAME path, new `code` field)

```
POST /api/v1/withdrawals/
Content-Type: application/json
Authorization: Bearer <access>

{
  "payout_method": "<payout_method_uuid>",
  "amount": "10.00",
  "code": "123456"          ←  NEW: the 6-digit code from the SMS
}
```

**201 Created** → the withdrawal request is created (status `pending`, goes to admin review as before).

---

## Errors to handle

| HTTP | Body | What it means / do |
|---|---|---|
| `400` | `{"detail": "Verify your mobile number before withdrawing.", "code": "phone_verification_required"}` | No verified phone → open the **phone verification** screen (below), then retry `send-code`. Match on `code`, not the text. |
| `400` | `Withdrawals are paused until <time> UTC because your phone number changed.` | The shopper verified a **new** number in the last 48 h. Show the message; they can withdraw after that time. |
| `400` | `Invalid or missing verification code.` | Wrong or expired code → let them re-enter or resend (call send-code again). |
| `400` | `Minimum withdrawal is …` / `Insufficient available balance.` | Standard withdrawal validation (same as before). |
| `401` | — | Not authenticated. |
| `503` | `SMS verification is not available right now.` | SMS isn't required right now → call `POST /withdrawals/` **without** a code. |

---

## Phone verification (needed before SMS-verified withdrawals)

The SMS code is only ever sent to the shopper's **verified** phone. Build this
screen and reach it two ways: from **Profile → Phone number**, and **inline**
when a withdrawal returns `code: "phone_verification_required"` (then resume
the withdrawal).

```
1. POST /api/v1/users/me/phone/          { "phone": "(555) 123-4567" }   → 202 (code texted)
2. POST /api/v1/users/me/phone/verify/   { "code": "123456" }            → 200 (updated user)
```

- **US mobile numbers only.** Send it in any common format; it's stored as
  `+15551234567`. Invalid/non-US → `400 "Enter a valid US mobile number."`
- A number already used by another account → `400 "That phone number is already in use."`
- Wrong/expired code → `400 "Invalid or expired code."` — offer "Resend" (repeat step 1).
- `GET /users/me/` returns `phone` and `is_phone_verified` — show a "Verified" badge.
- **Changing** a verified number pauses withdrawals for **48 hours** — warn the
  shopper before they change it.

---

## Important: timing / rollout

SMS-verified withdrawals are switched on by an **admin setting**, separate from
SMS sending, so shoppers can verify phones before it's enforced:

1. **Now:** not required → `send-code` returns **503**, `POST /withdrawals/` works without a `code`.
2. **SMS sending goes live:** phone verification texts real codes; withdrawals still don't require one.
3. **Admin turns on "Withdrawals require an SMS code":** `send-code` texts the verified phone and `code` becomes required.

**Build the full flow now** (phone screen + two-step withdrawal + the 503
fallback) — it keeps working through all three phases with no app update.

---

## Quick reference

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/withdrawals/send-code/` | POST | `payout_method`, `amount` | `{ phone }` (masked) |
| `/withdrawals/` | POST | `payout_method`, `amount`, `code` | the created withdrawal |
| `/users/me/phone/` | POST | `phone` | 202 — code texted |
| `/users/me/phone/verify/` | POST | `code` | the updated user |

---

# Part 2 — Receipt Reminders & Notifications

Shoppers are reminded to upload their receipt before a claim expires. The backend
sends **two reminders per claim**, timed to the claim's deadline:

- **First reminder** — 48 hours before the claim expires.
- **Final reminder** — 12 hours before it expires.

These fire automatically (a scheduled backend job). There is **no new or changed
API** for this — reminders are ordinary **notifications** delivered through the
**existing notifications feed**. Nothing special is required to receive them.

Base URL (production): `https://api.joinnibbl.com/api/v1`
All endpoints require the shopper's auth token (`Authorization: Bearer <access>`).

## What you need to do

### 1. Show them in the notifications list (works today — no setup needed)

Use the existing endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/notifications/` | GET | The notification feed (reminders appear here) |
| `/notifications/unread-count/` | GET | Badge count |
| `/notifications/<id>/read/` | POST | Mark one as read |
| `/notifications/read-all/` | POST | Mark all as read |

A receipt reminder looks like this in the feed:

```json
{
  "id": "…",
  "type": "receipt_reminder",
  "title": "Upload your receipt",
  "body": "Don't forget to upload your receipt for <Brand> to claim your reward.",
  "data": { "brand": "<Brand>", "stage": "48h" },
  "status": "sent",
  "read_at": null,
  "created_at": "…"
}
```

Detect it with `type == "receipt_reminder"`; `data.brand` is the brand name to
show. `stage` is `"48h"` (first reminder) or `"12h"` (final reminder).

> **Deep-link note:** the response does **not** yet include the specific
> reservation id, so the app can't currently route the tap straight to that
> one claim's upload screen — tapping can open the shopper's active-claims /
> receipts list instead. If you want tap-to-that-exact-claim, we can add the
> reservation reference to this response (small additive change) — flagged with
> the Nibbl team.

### 2. Register the device for push (for phone banners)

To get a banner on the phone (not just an in-app list item), register the
device's push token after login:

```
POST /api/v1/device-tokens/
Authorization: Bearer <access>

{ "token": "<fcm_or_apns_device_token>", "platform": "android" | "ios" }
```

(Remove on logout via `DELETE /device-tokens/<token_id>/`.)

## Important: push rollout

Phone **push delivery is currently switched off** on the backend (it logs only)
until Firebase/FCM is configured on the server — that setup is pending.

- **In-app notifications work now:** reminders appear in `/notifications/`
  regardless.
- **Phone banners** start firing once FCM is enabled — no app change needed then,
  as long as device tokens are being registered (step 2).

So: build the notifications list + deep-link now, and register device tokens now.
Banners light up automatically once the server side is finished.

---

# Part 3 — Claiming: consents, claim slots & payout-account review

All three are **additive** — existing requests keep working unchanged.

## 1. Two consent checkboxes when claiming an offer

Show two **separate, optional, unticked-by-default** checkboxes on the claim
screen and send them with the claim:

```
POST /api/v1/reservations/
{
  "campaign": "<campaign_uuid>",
  "consent_nibbl": true,     // "Send me NibblAI offers and updates by email and SMS."
  "consent_brand": false     // "Send me offers and updates from <Brand> by email and SMS."
}
```

- Both fields are optional and default to `false` (don't pre-tick them — marketing
  consent must be the shopper's choice).
- They're stored separately: one consent for Nibbl, one per brand.
- Leaving a box unticked on a later claim does **not** withdraw an earlier "yes".

## 2. Active claim slots ("3 of 5")

A shopper can have a limited number of claims open at once (default **5**).

```
GET /api/v1/reservations/slots/
→ { "used": 3, "limit": 5, "available": 2 }
```

Show it as "3 of 5 claims active". When `available` is `0`, a new claim returns
**400** *"You've reached your active claim limit (5). Upload a receipt or let a
claim expire to free up a slot."* — uploading a receipt or letting a claim expire
frees a slot.

## 3. Payout accounts can be "under review"

`GET /api/v1/payout-methods/` now includes `review_status`
(`approved` · `pending` · `rejected`) and `review_note`.

- A shopper's **first** payout account is approved immediately.
- Any **later** account starts as `pending` until an admin approves it.
- Only offer **approved** accounts in the withdraw picker. A withdrawal to a
  pending account returns **400** *"This payout method is under review…"*.
- Adding an account that's already linked to another user returns **400**
  *"…linked to another account and has been flagged for review."*

## Quick reference

| Endpoint | Method | What's new |
|---|---|---|
| `/reservations/` | POST | optional `consent_nibbl`, `consent_brand` |
| `/reservations/slots/` | GET | **new** — `{ used, limit, available }` |
| `/payout-methods/` | GET | `review_status`, `review_note` on each account |
