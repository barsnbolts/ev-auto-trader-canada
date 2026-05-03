# Deployment runbook — ev-auto-trader-canada → Vercel

Per V5 plan decision: working branch `claude/verify-environment-setup-oTu3S`
is production. No preview-vs-production split until project stabilizes.

## First-time setup (one-time, ~10 min)

Run from project root:

```bash
cd ~/ev-auto-trader-canada

# 1. Install Vercel CLI globally if not present
npm install -g vercel
vercel --version    # confirm ≥ 32

# 2. Login (browser opens; pick GitHub auth)
vercel login

# 3. Link the local repo to a Vercel project
vercel link
# Prompts:
#   ? Set up and develop "~/ev-auto-trader-canada"?  Yes
#   ? Which scope?  <pick your account>
#   ? Link to existing project?  No  (first time — create new)
#   ? What's your project's name?  ev-auto-trader-canada
#   ? In which directory is your code located?  ./
# Auto-detects Next.js (no overrides needed).
# Creates .vercel/project.json — gitignored by Next.js default.

# 4. Set production branch (dashboard only — no CLI flag)
# Open https://vercel.com/<your-account>/ev-auto-trader-canada/settings/git
# → "Production Branch" → enter: claude/verify-environment-setup-oTu3S
# → Save

# 5. First deploy
vercel --prod
# First build: ~2-3 min. Subsequent builds: ~30s.
# Returns the live URL: https://ev-auto-trader-canada.vercel.app/

# 6. Verify
curl -sI https://ev-auto-trader-canada.vercel.app/ | head -1
# Expect: HTTP/2 200
```

## Daily auto-deploy (after step 4)

Every push to `claude/verify-environment-setup-oTu3S` triggers a fresh
Vercel build + production swap. The daily cron at 7 AM local pushes new
data; that push deploys automatically. No manual `vercel --prod` needed
after first-time setup.

## Environment variables (none currently)

The site has no secrets / API keys at the moment. All data is in
`data/*.json` shipped with the build. If a future feature needs an env
var:

```bash
vercel env add VITE_OCM_KEY production
# Paste value when prompted; Vercel encrypts at rest.
```

Env vars set in dashboard → applied to the next deploy automatically.

## Rollback

```bash
# List recent deployments
vercel ls

# Promote a prior deployment to production (no rebuild)
vercel promote <deployment-url>
```

Or via dashboard: Project → Deployments → … → Promote to Production.

## Troubleshooting

**Build fails with "no Next.js config found":** ensure `package.json` has
`"next"` in dependencies and `next.config.js` exists at repo root.
`vercel.json` already declares `"framework": "nextjs"` as a fallback.

**Deploy URL 404s:** check the production-branch override matches your
actual working branch name. Misalignment leaves prod pinned to an empty
ref.

**Cookies not working on preview URLs:** preview deployments have
different origins than production. The `buyer-context` cookie set on
production won't be sent on preview. Test cookie flow on production URL
only.

**Build timeout:** unlikely for this project (static Next.js, ~30s build).
If hit: check for accidentally-imported giant data file. Vercel's hard
cap is 45 min — well above what this needs.

## Future: custom domain

Skipped per V5 plan. Re-enable when ready:

```bash
vercel domains add evtrader.example.com
# Then add the printed DNS records to your domain registrar.
```

## Future: Tauri-wrap

Not deploying anything; Vercel deploy continues independently. See
`docs/handoff/research/A0_findings_2026-05-02.md` §5 for the migration
plan when desired.
