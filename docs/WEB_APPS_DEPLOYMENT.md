# Web Apps Deployment (website · brand · admin)

The three Next.js apps run as Docker containers on the production box, next to
the backend, behind nginx with Let's Encrypt TLS.

| App | URL | Container | Local port on the box |
|---|---|---|---|
| Shopper website | https://www.joinnibbl.com | `nibblai-website` | 127.0.0.1:3003 |
| Brand dashboard | https://brand.joinnibbl.com | `nibblai-brand` | 127.0.0.1:3001 |
| Admin dashboard | https://admin.joinnibbl.com | `nibblai-admin` | 127.0.0.1:3002 |

## How a deploy works

- `.github/workflows/frontend-deploy.yml` runs on a push to `main` that changes
  `services/website|brand|admin/**`, and only for the apps that changed.
  - It builds `deployment/docker/nextjs.Dockerfile` and pushes `nibblai-<app>:<sha>` to ECR.
  - It then replaces the app's container over SSM and waits until the app answers.
- It never touches the backend / AI containers (`deploy.yml` ignores the web app folders).
- To force a deploy, run the workflow manually (Actions → *Nibbl AI Web Apps
  Deploy* → Run workflow). The default deploys all three apps.
- PR checks build each changed app's image (no push), so a broken build fails before merge.
- `NEXT_PUBLIC_*` values are compiled in at build time:
  - API: `https://api.joinnibbl.com`.
  - Stripe publishable key: GitHub repo variable `STRIPE_PUBLISHABLE_KEY`.
    It must be the same mode (test/live) as the backend's `STRIPE_SECRET_KEY`.
    After changing it, re-run the workflow for `["brand"]`.

## One-time setup (in this order)

1. **ECR repositories + CI push permission.** Run from `infrastructure/terraform/bootstrap`:
   ```bash
   AWS_PROFILE=nibblai terraform plan    # expect: 3 repos + 3 lifecycle policies added, CI policy updated
   AWS_PROFILE=nibblai terraform apply
   ```
2. **Stripe publishable key** (current backend mode; test today):
   ```bash
   gh variable set STRIPE_PUBLISHABLE_KEY --body "pk_test_..."
   ```
3. **DNS (Cloudflare, joinnibbl.com).**
   - Add `A www → 54.219.15.34`, set to **DNS only** (grey cloud).
   - `brand` and `admin` already point to the box; confirm they are DNS only too.
   - Do not change `api`, the MX or the TXT records.
4. **Merge the PR.** The workflow builds and starts all three containers.
5. **nginx + TLS.** Run from the repo root:
   ```bash
   AWS_PROFILE=nibblai ./deployment/scripts/install-frontend-nginx.sh
   ```
6. **Backend links.** Campaign URLs/QR codes and referral emails use `PUBLIC_BASE_URL`.
   - On the box, set `PUBLIC_BASE_URL=https://www.joinnibbl.com` in
     `deployment/environments/.env.production.backend`.
   - Then recreate the backend container.
   - `BRAND_APP_URL` already defaults to `https://brand.joinnibbl.com`.
7. **Check:**
   - Open all three URLs.
   - Sign in on each.
   - Open a campaign's URL / QR from the brand dashboard. It should open the offer on the website.

## Rollback

Re-run the deploy step with an older image: on the box,
`docker rm -f nibblai-<app> && docker run -d --name nibblai-<app> --restart always -p 127.0.0.1:<port>:3000 <registry>/nibblai-<app>:<older sha>`.
