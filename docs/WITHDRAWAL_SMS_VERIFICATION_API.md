# Shopper App — Developer Guide

**Audience:** mobile app (and web) developers integrating the shopper flows.
**Date:** 2026-10-07 · updated 2026-10-08

**Covers:**
1. [Withdrawal SMS Verification](#part-1--withdrawal-sms-verification)
2. [Receipt Reminders & Notifications](#part-2--receipt-reminders--notifications)

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

| HTTP | Body `detail` | What it means / do |
|---|---|---|
| `400` | `Verify your mobile number before withdrawing.` | Shopper has no verified phone → route them to phone verification first. |
| `400` | `Invalid or missing verification code.` | Wrong or expired code → let them re-enter or resend (call send-code again). |
| `400` | `Minimum withdrawal is …` / `Insufficient available balance.` | Standard withdrawal validation (same as before). |
| `401` | — | Not authenticated. |
| `503` | `SMS verification is not available right now.` | SMS verification isn't enabled yet (see timing note). |

---

## Prerequisites

- The SMS goes to the shopper's **verified mobile number** (`is_phone_verified`). The shopper must have added and verified a phone before they can withdraw. If not, `send-code` returns `400` (verify phone first).
- Twilio is **US-only, SMS-only**.

---

## Important: timing / rollout

Verification is currently **dormant on production** — Twilio isn't configured yet. Until it's turned on:
- `POST /withdrawals/send-code/` returns **503**.
- `POST /withdrawals/` still works **without** a `code` (unchanged behavior).

**Build the two-step flow now.** It starts being enforced the moment Twilio is enabled on the server — which will be coordinated so nothing breaks. Once enabled, `send-code` works and `code` becomes required.

---

## Quick reference

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/withdrawals/send-code/` | POST | `payout_method`, `amount` | `{ phone }` (masked) |
| `/withdrawals/` | POST | `payout_method`, `amount`, `code` | the created withdrawal |

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
