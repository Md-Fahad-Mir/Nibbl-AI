# Running the container

For the backend team. Everything the service needs — including the Tesseract
OCR engine — is inside the image. There is nothing to install on the host
except Docker itself.

---

## Get the image

### Option A — pull the AWS ECR image (nothing to build)

The repository's deployment workflow publishes immutable image tags to ECR.
On an EC2 instance with its ECR instance role, authenticate and pull the tag:

```bash
export AWS_REGION=us-west-1
export REGISTRY=<account-id>.dkr.ecr.${AWS_REGION}.amazonaws.com
export IMAGE_TAG=<git-sha>
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"
docker pull "$REGISTRY/nibblai-ai:$IMAGE_TAG"
export IMAGE="$REGISTRY/nibblai-ai:$IMAGE_TAG"
```

### Option B — build from source

```bash
cd services/ai
docker build -t receipt-ocr:1.0.0 .
export IMAGE=receipt-ocr:1.0.0
```

Takes 5–10 minutes the first time (Tesseract + OpenCV); cached afterwards.

---

## Run it

```bash
docker run -d \
  --name receipt-ocr \
  --restart unless-stopped \
  -p 8001:8001 \
  -e API_KEY="<your-shared-secret>" \
  -e APP_ENV=production \
  -e WEB_CONCURRENCY=1 \
  -e DEFAULT_COUNTRY=US \
  -e DATE_ORDER=MDY \
  "$IMAGE"
```

For the repository-managed AWS deployment, do not run this standalone command:
the root Compose stack starts both services, keeps the host binding for AI on
`127.0.0.1:8001` by default, and lets the backend call `http://ai:8001` over
the private Docker network.

Verify:

```bash
curl -fsS localhost:8001/health   # {"status":"ok",...}
curl -fsS localhost:8001/ready    # must contain "ready":true
```

`/ready` reporting `ocr:tesseract ready:true` is the signal that the engine is
usable. If it returns 503, the container is running but cannot serve — do not
route traffic to it.

---

## AWS repository deployment

The root CI/CD workflow builds and publishes both `nibblai-backend` and
`nibblai-ai` images to ECR, then the EC2 Compose stack runs the AI service on
container port `8001`. Before the first deployment, create
`nibblai/<environment>/ai-api-key` in AWS Secrets Manager and apply the
Terraform bootstrap change that creates the `nibblai-ai` ECR repository. The
Ansible deployment role supplies that one secret to the AI container as
`API_KEY` and to the backend as `RECEIPT_OCR_API_KEY`.

See [the AWS secret setup guide](../../infrastructure/SECRETS_MANAGER_SETUP.md)
for the exact command. Keep port 8001 private; expose an HTTPS reverse-proxy
route only if an external client genuinely needs direct AI API access. Normal
rollbacks use the matching Git SHA for both images; for a backend revision from
before AI images existed, pass a known-compatible `AI_IMAGE_TAG` explicitly.

---

## Configuration

Everything is environment-driven. The full annotated list is in
[`.env.example`](.env.example); these are the ones that matter in production.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8001` | The port inside this image. Map host and container with `-p 8001:8001`; platforms that inject `PORT` may override it. |
| `WEB_CONCURRENCY` | `2` | One worker per ~512 MB. Measured: 68 MB idle, 84 MB under load. |
| `API_KEY` | *(empty)* | **Set this if the service is reachable from the internet.** Empty disables auth. |
| `APP_ENV` | `production` | Also blocks the test-fixture OCR provider. |
| `DEFAULT_COUNTRY` | *(empty)* | e.g. `US`. Resolves an ambiguous `$` to a real currency. |
| `DATE_ORDER` | `none` | `MDY` or `DMY`. Without it, `03/04/2026` returns `null` by design. |
| `CORS_ALLOW_ORIGINS` | *(empty)* | Set only if a browser calls the API directly. |
| `MAX_FILE_SIZE_MB` | `10` | Upload limit. |
| `OCR_LANGUAGES` | `eng` | Extra languages need their `tesseract-ocr-<lang>` pack in the image. |
| `OCR_PROVIDER` | `tesseract` | The image includes Tesseract and Paddle. Use `paddleocr` for PP-OCRv5 on CPU (seconds). Use `paddleocr_vl` only with a GPU (minutes on CPU). Set `openai_vision` to have a cloud multimodal model read receipts instead. |
| `VISION_MODEL` | `gpt-4o-mini` | Vision model. Names move -- verify with `python scripts/check_llm.py --list`. |
| `VISION_API_KEY` | *(empty)* | Required when `OCR_PROVIDER=openai_vision`. |
| `LLM_MODEL` | `gpt-4o-mini` | Text model for the review endpoints. |
| `LLM_API_KEY` | *(empty)* | Required for `/api/v1/reviews/*`. |
| `LLM_BASE_URL` | OpenAI API | Point at any OpenAI-compatible gateway to change vendor. |

`DEFAULT_COUNTRY` and `DATE_ORDER` are the highest-value settings here. Without
them the pipeline deliberately refuses to guess, and you get `null` for dates
like `03/04/2026` and for a bare `$`.

---

## Calling the API

```bash
curl -X POST http://localhost:8001/api/v1/receipts/extract \
  -H "X-API-Key: <your-shared-secret>" \
  -F "image=@receipt.jpg"
```

```python
import requests

response = requests.post(
    "http://receipt-ocr:8001/api/v1/receipts/extract",
    headers={"X-API-Key": API_KEY},
    files={"image": open("receipt.jpg", "rb")},
    timeout=60,
)
body = response.json()
```

Full contract: [`docs/api.md`](docs/api.md). Importable OpenAPI schema and
worked examples: [`contract/`](contract/).

### Three things that will bite you if unread

**Money is a JSON string**, not a number — `"total": "17.28"`. Parse it into a
decimal type. `JSON.parse` / `float()` reintroduces exactly the rounding error
the pipeline exists to prevent.

**`success: true` means processed, not correct.** A receipt that was read but
does not add up returns `200` with warnings, a lowered confidence and
`review.review_required = true`. Check before auto-approving:

```python
if not body["success"]:                          handle_failure(body["errors"])
elif body["data"]["review"]["review_required"]:  queue_for_human_review()
elif body["data"]["confidence"]["overall"] < 0.9: flag_for_audit()
else:                                            auto_approve()
```

**Absent means `null`** — never `"N/A"`, never `0`. `merchant.phone is None`
means the receipt did not print one.

---

## Changing the model

Model names change on the provider's schedule. Both defaults are known-good
rather than newest, and swapping either is a `.env` edit with no rebuild:

```bash
VISION_MODEL=<newer-model>
LLM_MODEL=<newer-model>
```

Confirm a name exists before deploying it:

```bash
python scripts/check_llm.py --list   # what this key can use
python scripts/check_llm.py --test   # one real call per configured model
```

Exit code 1 when a configured model is unavailable, so it can gate a deploy.
A model that disappears at runtime raises a message naming the model and the
fix, rather than a bare HTTP 404.

## Operations

### Probes

| Endpoint | Use | Auth |
|---|---|---|
| `/health` | liveness — restart on repeated failure | public |
| `/ready` | readiness — remove from load balancer on 503 | public |
| `/version` | API, pipeline and schema versions | public |
| `/api/v1/*` | the service | `X-API-Key` when configured |

Probes are intentionally unauthenticated: an orchestrator has no credential to
present, and they expose nothing sensitive.

### Sizing

Measured on the built image: **68 MB idle, 84 MB under OCR load, ~200 ms per
receipt** on one worker. OCR is CPU-bound and single-threaded per request, so
scale with workers and replicas, not with threads.

### Logs

Structured JSON on stderr, one object per event, every line carrying
`request_id`. Client-supplied `X-Request-ID` is honoured and echoed back, so
traces span your services.

Secrets are scrubbed automatically, and receipt text never appears unless
`LOG_DOCUMENT_CONTENT=true` — leave that off in production, receipts are PII.

### Privacy defaults

Nothing is persisted. `ENABLE_RAW_OCR_STORAGE=false`, card-like sequences are
masked out of returned OCR text, and only `card_last4` is ever captured.

---

## Behind a reverse proxy

```nginx
location /receipts/ {
    proxy_pass         http://receipt-ocr:8001/;   # container port, not the host port
    proxy_set_header   X-Request-ID $request_id;
    client_max_body_size 12m;          # above MAX_FILE_SIZE_MB
    proxy_read_timeout 120s;           # OCR can take a few seconds
}
```

Terminate TLS at the proxy. Add rate limiting there too — the service has none
of its own.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `/ready` 503, `PROVIDER_UNAVAILABLE` | Not possible with this image — Tesseract is baked in. Check the container actually started. |
| `401 UNAUTHORIZED` | `API_KEY` is set but the `X-API-Key` header is missing or wrong. |
| Container unreachable on a PaaS | Something set `PORT` explicitly. Let the platform inject it. |
| Everything flagged for review | Poor image quality, or `CONFIDENCE_THRESHOLD` too high. Read `review.reasons`. |
| `AMBIGUOUS_DATE_FORMAT` on every receipt | Working as designed. Set `DATE_ORDER`. |
| `currency: null` despite a `$` | Working as designed. Set `DEFAULT_COUNTRY`. |
| OOM kill | `WEB_CONCURRENCY` too high for the instance. One worker per ~512 MB. |
| Slow first request after idle | A PaaS free tier scaled to zero. Use a paid tier. |
