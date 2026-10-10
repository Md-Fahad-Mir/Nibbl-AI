# AI Service — Two New Review Endpoints (spec for Sakibur)

**Why:** The Master's review campaigns (#24 AI chat review, #27 ratings display) need two things the AI service doesn't do yet. The backend already calls both endpoints. Until they exist it falls back automatically, so nothing is blocked. Once they're deployed, set the two environment variables below on the backend and the flow upgrades with no backend code change.

Both endpoints follow the existing review routes (`/api/v1/reviews/generate`, `/api/v1/reviews/questions`):
- the same `X-API-Key` header;
- the same envelope: `{ "success": true, "data": {...}, "warnings": [], "errors": [], "processing": {...} }`;
- any 4xx/5xx or `success: false` is treated as "unavailable" and the backend falls back.

---

## 1. Adaptive next question — `POST /api/v1/reviews/next-question`

**Master #24:** *"AI asks five conversational questions based on the product and the shopper's previous answers."* Today the backend asks a fixed list from `/reviews/questions`. This endpoint lets each question follow up on the last answer.

**Backend setting:** `REVIEW_AI_NEXT_QUESTION_PATH=/api/v1/reviews/next-question`

### Request
```json
{
  "product": {
    "name": "Sea Salt Kettle Chips 5oz",
    "category": "Chips",
    "description": "Kettle-cooked potato chips with sea salt.",
    "flavor": "Sea Salt", "format": "Bag", "size_volume": "5oz"
  },
  "conversation": [
    { "role": "assistant", "content": "What made you pick these chips?" },
    { "role": "user", "content": "I wanted something less greasy." }
  ],
  "brand_question": "Which flavor should we make next?",
  "questions_asked": 1,
  "total_questions": 6
}
```
- `product` comes from the Product Library: name, category, description and any of flavor / format / size_volume.
- `conversation` is the chat so far, oldest first. It always ends with the shopper's latest answer.
- `brand_question` is the brand question the backend will insert itself, or `null`. **Don't ask it or rephrase it.** It's provided only so you avoid asking something too similar.
- `questions_asked` / `total_questions` are how many questions have been asked and the planned total. That total includes the brand question and the closing "Would you buy it again or recommend it?", both of which the backend asks itself.

### Response `data`
```json
{ "question": "Nice — how did they compare on greasiness with your usual brand?", "done": false }
```
- `question`: one short, open, conversational question (not yes/no) that builds on the previous answer. Use the product facts, and don't invent claims.
- `done: true` means there's nothing useful left to ask. The backend then moves on to its closing question.

**Rules:** one question per call. Under 160 characters. No personal data requests (email, address, phone). No leading the rating.

---

## 2. Review summary — `POST /api/v1/reviews/summary`

**Master #27:** *"Reviews Overview + AI Summary… a concise AI summary covering both positive and negative themes. AI summaries refresh as published reviews change."*

**Backend setting:** `REVIEW_AI_SUMMARY_PATH=/api/v1/reviews/summary`

### Request
```json
{
  "product_name": "Sea Salt Kettle Chips 5oz",
  "reviews": [
    { "rating": 5, "title": "Crunchy and fresh", "body": "Loved the crunch…" },
    { "rating": 2, "title": "Too salty", "body": "Way too much salt for me…" }
  ]
}
```
- Only **published** reviews are sent, newest first, at most 200.

### Response `data`
```json
{
  "summary": "Shoppers love the crunch and freshness; a few find them too salty.",
  "positives": ["Very crunchy", "Fresh taste"],
  "negatives": ["Too salty for some"]
}
```
- `summary`: 1–2 neutral sentences covering both positive and negative themes.
- `positives` / `negatives`: up to 4 short themes each; an empty list if there are none.
- Base everything only on the reviews provided. Don't quote personal details.

**Caching:** the backend caches the result per product and calls again only when that product's published reviews change, so this is called rarely.

---

## What the backend does today, without these endpoints
- **Questions:** 4 product questions from the existing `/reviews/questions`. If that fails, the backend uses built-in generic ones. Then it adds the rotated brand question (third position) and the closing recommend/buy-again question.
- **Summary:** `ai_summary` is `null` in `GET /products/{id}/review-summary/`. The star distribution, recommendation rate and review list all work without it.
