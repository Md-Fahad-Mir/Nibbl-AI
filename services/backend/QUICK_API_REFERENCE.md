# NibblAI — Quick API Reference

**Quick lookup guide for the most common endpoints.**

---

## Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/auth/register/` | POST | Create account |
| `/api/v1/auth/login/` | POST | Get JWT tokens |
| `/api/v1/auth/verify-email/` | POST | Verify email with code |
| `/api/v1/auth/logout/` | POST | Logout & blacklist tokens |
| `/api/v1/auth/token/refresh/` | GET | Get new access token |
| `/api/v1/auth/password/forgot/` | POST | Request password reset |
| `/api/v1/auth/password/reset/` | POST | Reset password with code |
| `/api/v1/auth/social/` | POST | Social login (scaffold) |

---

## Users

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/users/me/` | GET | Get current user |
| `/api/v1/users/me/` | PATCH | Update profile |
| `/api/v1/users/me/delete/` | DELETE | Delete account |
| `/api/v1/users/me/change-password/` | PATCH | Change password |
| `/api/v1/users/me/phone/` | POST | Add phone number |
| `/api/v1/users/me/phone/verify/` | POST | Verify phone |
| `/api/v1/users/referrals/` | GET | Get referral stats |

---

## Brands

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/brands/` | GET | List user's brands |
| `/api/v1/brands/` | POST | Create brand |
| `/api/v1/brands/{id}/` | GET | Get brand details |
| `/api/v1/brands/{id}/` | PATCH | Update brand |
| `/api/v1/brands/{id}/members/` | GET | List brand members |
| `/api/v1/brands/{id}/members/` | POST | Add brand member |
| `/api/v1/brands/{id}/customers/` | GET | Get brand customers (plan-gated) |
| `/api/v1/brand-applications/` | POST | Apply to create brand |
| `/api/v1/brand-applications/` | GET | List own applications |

---

## Wallets

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/wallet/` | GET | Get customer wallet balance |
| `/api/v1/wallet/transactions/` | GET | List transactions |
| `/api/v1/brands/{id}/wallet/` | GET | Get brand wallet |
| `/api/v1/brands/{id}/wallet/fund/` | POST | Fund brand wallet |

---

## Products

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/brands/{id}/products/` | GET | List products |
| `/api/v1/brands/{id}/products/` | POST | Create product |
| `/api/v1/brands/{id}/products/{pid}/` | GET | Get product |
| `/api/v1/brands/{id}/products/match/` | POST | Match receipt items |
| `/api/v1/brands/{id}/tags/` | GET | List tags |
| `/api/v1/brands/{id}/tags/generate/` | POST | Generate tags with AI |

---

## Campaigns

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/brands/{id}/campaigns/` | GET | List campaigns |
| `/api/v1/brands/{id}/campaigns/` | POST | Create campaign |
| `/api/v1/brands/{id}/campaigns/{cid}/` | GET | Get campaign |
| `/api/v1/brands/{id}/campaigns/{cid}/activate/` | POST | Activate |
| `/api/v1/brands/{id}/campaigns/{cid}/pause/` | POST | Pause |

---

## Offers & Discovery

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/offers/` | GET | Get offer feed (personalized) |
| `/api/v1/offers/{cid}/` | GET | Get campaign details (public) |
| `/api/v1/bookmarks/` | GET | List bookmarks |
| `/api/v1/bookmarks/` | POST | Bookmark campaign |
| `/api/v1/bookmarks/{bid}/` | DELETE | Remove bookmark |

---

## Receipts

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/receipts/` | GET | List receipts |
| `/api/v1/receipts/` | POST | Upload receipt (OCR) |
| `/api/v1/receipts/{id}/` | GET | Get receipt details |
| `/api/v1/brands/{id}/review-queue/` | GET | Manual review queue |
| `/api/v1/brands/{id}/review-queue/{iid}/approve/` | POST | Approve item |
| `/api/v1/brands/{id}/review-queue/{iid}/decline/` | POST | Decline item |
| `/api/v1/brands/{id}/flag-user/` | POST | Flag user for fraud |

---

## Reservations & Redemptions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/reservations/` | GET | List reservations |
| `/api/v1/reservations/` | POST | Create reservation |
| `/api/v1/reservations/{id}/` | GET | Get reservation |
| `/api/v1/redemptions/` | GET | List redemptions |
| `/api/v1/redemptions/{id}/` | GET | Get redemption |

---

## Reviews

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/brands/{id}/review-campaigns/` | GET | List review campaigns |
| `/api/v1/brands/{id}/review-campaigns/` | POST | Create campaign |
| `/api/v1/brands/{id}/review-campaigns/{cid}/generate-prompts/` | POST | Generate AI prompts |
| `/api/v1/reviews/opportunities/` | GET | Get review opportunities |
| `/api/v1/reviews/sessions/{sid}/answer/` | POST | Answer question |
| `/api/v1/reviews/sessions/{sid}/submit/` | POST | Submit review |
| `/api/v1/reviews/` | GET | List user reviews |
| `/api/v1/brands/{id}/reviews/` | GET | List brand reviews |

---

## Notifications

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/notifications/` | GET | List notifications |
| `/api/v1/notifications/{id}/read/` | POST | Mark as read |
| `/api/v1/notifications/read-all/` | POST | Mark all as read |
| `/api/v1/notification-preferences/` | GET | Get preferences |
| `/api/v1/notification-preferences/` | PATCH | Update preferences |
| `/api/v1/device-tokens/` | GET | List device tokens |
| `/api/v1/device-tokens/` | POST | Register device (FCM) |
| `/api/v1/device-tokens/{id}/` | DELETE | Unregister device |

---

## Payouts

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/payout-methods/` | GET | List payout methods |
| `/api/v1/payout-methods/` | POST | Add payout method |
| `/api/v1/payout-methods/{id}/` | DELETE | Delete method |
| `/api/v1/withdrawals/` | GET | List withdrawals |
| `/api/v1/withdrawals/` | POST | Request withdrawal |
| `/api/v1/withdrawals/{id}/` | GET | Get withdrawal details |

---

## Analytics

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/brands/{id}/analytics/overview/` | GET | Brand overview |
| `/api/v1/brands/{id}/analytics/campaigns/` | GET | Campaign analytics |
| `/api/v1/brands/{id}/analytics/products/` | GET | Product analytics |

---

## Admin

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/admin/users/` | GET | List all users |
| `/api/v1/admin/users/{id}/suspend/` | POST | Suspend user |
| `/api/v1/admin/users/{id}/reactivate/` | POST | Reactivate user |
| `/api/v1/admin/fraud-flags/` | GET | List fraud flags |
| `/api/v1/admin/campaigns/` | GET | List all campaigns |
| `/api/v1/admin/transactions/` | GET | List all transactions |
| `/api/v1/admin/reviews/held/` | GET | List held reviews |
| `/api/v1/admin/reviews/{id}/remove/` | POST | Remove review |
| `/api/v1/admin/audit-logs/` | GET | List audit logs |
| `/api/v1/admin/brands/{id}/wallet/credit/` | POST | Issue promo credits |
| `/api/v1/admin/brands/{id}/plan/` | POST | Change brand plan |
| `/api/v1/admin/announcements/` | POST | Send broadcast |
| `/api/v1/admin/brand-applications/` | GET | List applications |
| `/api/v1/admin/brand-applications/{id}/approve/` | POST | Approve application |
| `/api/v1/admin/brand-applications/{id}/reject/` | POST | Reject application |
| `/api/v1/admin/brands/{id}/suspend/` | POST | Suspend brand |
| `/api/v1/admin/brands/{id}/reactivate/` | POST | Reactivate brand |

---

## Status Codes

| Code | Meaning |
|------|---------|
| **200** | OK (success) |
| **201** | Created (new resource) |
| **204** | No Content (logout) |
| **205** | Reset Content (logout) |
| **400** | Bad Request (validation error) |
| **401** | Unauthorized (token expired) |
| **403** | Forbidden (no permission) |
| **404** | Not Found |
| **429** | Too Many Requests (rate limited) |
| **500** | Server Error |

---

## Headers

**All authenticated requests:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Pagination:**
```
?page=1
?page=2&limit=50
```

**Filtering:**
```
?status=active
?resolved=false
?flagged=true
```

---

## Common Errors

```json
{
  "detail": "Authentication credentials were not provided."
}
```
→ Add `Authorization: Bearer {token}` header

```json
{
  "detail": "You do not have permission to perform this action."
}
```
→ You don't have required role (e.g., not a brand manager)

```json
{
  "detail": "Not found."
}
```
→ Resource doesn't exist or you don't have access

```json
{
  "detail": "Request was throttled. Expected available in 50 seconds."
}
```
→ Rate limit exceeded; wait and retry

---

## Example Request

```bash
curl -X GET http://localhost:8000/api/v1/offers/ \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." \
  -H "Content-Type: application/json"
```

---

## Environment Variables

**Required:**
```
SECRET_KEY=your-strong-secret-key
DATABASE_URL=postgres://user:pass@host:5432/db
```

**Optional:**
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
FCM_SERVER_KEY=AAAA...
EMAIL_HOST_USER=sendgrid@
EMAIL_HOST_PASSWORD=SG...
```

---

**For detailed documentation, see:** [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md)
