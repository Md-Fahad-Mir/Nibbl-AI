# Rebate Campaign Redesign — Plan

Covers Master requirements **#4, #5, #6, #7, #8, #9, #44**.
Source: *Nibbl Master Requirements (Consistency Final)* — Rebate Campaign builder ①–⑧,
"Offer Type Inputs and Shopper Output", Campaign Detail Page, 25-hour cycle,
Reserved Reward Funding, Admin → Campaign Approvals.

## Old model → new model

| | Today | Master |
|---|---|---|
| Reward | Tiers ($5/$3/$1 by allocation %) + optional fallback | One **deal type**: Free · BOGO Free · Buy 1 Get 1 50% Off · Buy X Get $Y |
| Payout | Fixed tier amount | From **verified receipt price**, capped at max rebate (Buy X Get $Y = fixed reward) |
| Volume | Daily $ budget, resets at midnight | **25-hour claim capacity** = ⌈desired redemptions ÷ estimated redemption rate⌉, resets every 25 h from activation; expired claims never restore a slot |
| Go-live | Brand activates directly | Draft → Submit → Nibbl review → Approve / Changes Requested; edits re-reviewed while the approved version stays live |
| Wording | Brand description | Nibbl-suggested headline + description per deal type (editable); locked rules control payout |
| Cooldown | Days, starts at claim | None / 30 / 60 / 90 / one-time; starts at **approved redemption** |
| Claim | Fixed reward held | **Snapshot of terms**; hold the **max**, pay the **actual**, return the difference |

`deal_type` is used for the Master's "offer type" because the shopper API already has
`offer_type` (= premium/fallback tier) and existing API fields must not change.

## Locked reward math (per approved redemption, one reward per claim)

| Deal type | Qualifies when | Reward |
|---|---|---|
| Free | ≥1 eligible unit | eligible unit price, capped at max rebate |
| BOGO Free | ≥2 eligible units, same receipt | lower-priced of the two qualifying units, capped |
| B1G1 50% | ≥2 eligible units, same receipt | 50% of the lower-priced unit (normal rounding), capped |
| Buy X Get $Y | ≥X eligible units (X = 1–3) | fixed $Y |

Prices are the eligible line's net unit price before tax. If a needed price or the quantity
can't be confirmed, the receipt goes to **manual review** — never auto-rejected.

## Decisions (2026-10-08)
- **Existing 15 campaigns** (test brand): converted to Free, max rebate = top tier,
  25-hour capacity derived from the old daily budget. Open claims keep their original terms.
- **Existing live campaigns**: grandfathered as **approved** when the approval workflow ships.
- Until the new builder ships, the old builder's inputs (tiers, daily budget) are mapped
  onto the new model so there is only one reward engine.

## Phases
1. ✅ **Backend engine** (done 2026-10-08; migration 0005 converts existing campaigns) — deal types + reward math, suggested wording, 25-hour capacity,
   term snapshot, reserve-max / pay-actual, cooldown semantics. API changes additive only.
2. ✅ **Approval workflow** (done 2026-10-08; migration 0007 grandfathers running campaigns) — submit/review statuses, revisions (approved version stays
   live), admin approval queue (#44).
3. ✅ **Brand builder UI** (done 2026-10-08) — new campaign builder + campaign detail page
   (status banner, "Current cycle claims X of Y", review activity).
4. ✅ **Shopper side** (done 2026-10-09; app guide: docs/CONSUMER_API_HANDOVER.md §4) — headline/description on offer pages, "Going fast"; app guide.
