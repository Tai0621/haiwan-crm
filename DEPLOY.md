# Deploying Haiwan CRM online

The app is built to run on **Vercel** (hosts the Next.js app + the daily cron)
with **Turso** (cloud libsql database). Both have free tiers. Your local SQLite
database uploads to Turso as-is, so all current data (customers, the 1,913
categorised products, etc.) comes with you.

The pieces:

```
GitHub repo ──push──▶ Vercel (builds & hosts the app) ──queries──▶ Turso (cloud DB)
                          │
                          └── Vercel Cron hits /api/cron/eod-analysis daily
```

---

## 1. Put the database on Turso

1. **Install the Turso CLI** (one-time):
   - Windows (PowerShell): `irm https://tur.so/install.ps1 | iex`
     (or `winget install Turso.Turso`)
2. **Sign up / log in** (opens a browser, uses your GitHub):
   `turso auth signup`   (or `turso auth login` if you already have an account)
3. **Create the database from your existing local file** — this uploads
   everything:
   ```
   turso db create haiwan --from-file ../data/haiwan.db
   ```
4. **Get the connection details** (save these — they go into Vercel):
   ```
   turso db show haiwan --url            # -> DATABASE_URL  (libsql://...)
   turso db tokens create haiwan         # -> DATABASE_AUTH_TOKEN
   ```

> Re-uploading later (to refresh prod data from local): `turso db destroy haiwan`
> then repeat step 3. For incremental work, prefer editing prod directly.

---

## 2. Push the code to GitHub

This repo lives at the `app/` folder. Create a **private** GitHub repo and push:

```
git remote add origin https://github.com/<you>/haiwan-crm.git
git push -u origin main
```

(If you have the GitHub CLI: `gh repo create haiwan-crm --private --source=. --push`)

---

## 3. Deploy on Vercel

1. Sign up at vercel.com with your GitHub account.
2. **Add New → Project →** import the `haiwan-crm` repo. Vercel auto-detects
   Next.js. Leave build settings as default (`npm run build` already runs
   `prisma generate`).
3. Before the first deploy, add **Environment Variables** (Settings →
   Environment Variables), for the **Production** environment:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | the `libsql://...` URL from step 1.4 |
   | `DATABASE_AUTH_TOKEN` | the token from step 1.4 |
   | `APP_PASSWORD` | a **strong** shared password (not the dev one) |
   | `ANTHROPIC_API_KEY` | your Claude API key (for WhatsApp analysis) |
   | `CRON_SECRET` | a random string, e.g. `openssl rand -hex 32` |
   | `NEXT_TELEMETRY_DISABLED` | `1` |

4. **Deploy.** When it finishes you'll get a URL like
   `https://haiwan-crm.vercel.app`. Share that + the `APP_PASSWORD` with staff.

---

## 4. The daily EOD analysis

`vercel.json` registers a cron that calls `/api/cron/eod-analysis` every day at
**16:00 UTC = midnight Malaysia time**. Vercel sends the `CRON_SECRET` as a
Bearer token so only Vercel can trigger it. No further setup needed — it appears
under the project's **Cron Jobs** tab once deployed.

To run it manually any time: the **"Run end-of-day analysis"** button on the
`/whatsapp` page still works.

---

## Notes & gotchas

- **Schema changes after launch:** apply migrations to Turso from your machine:
  `turso db shell haiwan < prisma/migrations/<new>/migration.sql`, or point
  `DATABASE_URL`/`DATABASE_AUTH_TOKEN` at Turso locally and run
  `prisma migrate deploy`.
- **Secrets:** never commit `.env`. `.env.example` documents what's needed.
- **Pet photos** are stored inline in the DB (data URLs), so they just work — no
  blob storage required.
- **Free-tier limits:** Vercel Hobby crons run once/day (fine here); Turso free
  tier is generous for this data size. If staff count or traffic grows, upgrade
  the relevant plan.
