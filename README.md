# Orbit Campus

**Buy low. Sell before move-out.**

Orbit is a student exchange for universities. It runs as one Next.js app with one Supabase
database, and every campus gets its own market at `/<slug>` (for example `localhost:3000/ua`).

| Feature | Where it lives in the app | Backend |
| --- | --- | --- |
| Multi-tenant core, campus themes, isolation | every page; school colors from `tenant_branding` | `proxy.ts`, RLS in `supabase/migrations/01–04` |
| `.edu` login | `/ua/login` (6-digit email code) | `before_user_created_hook`, `join_my_school()` |
| Markets terminal: feed, filters, search | `/ua` (watchlist, candles, order book, time & sales) | `market_overview`, `market_candles`, `listing_fair_values` |
| Photo-to-listing (Gemini) | `/ua/sell` | Edge Function `photo-to-listing` |
| Escrow: held → handed off → released, live status, code/QR handoff | `/ua/l/<id>` (buy), `/ua/portfolio` (live) | Edge Function `escrow`, Solana devnet USDC |
| Liquidity Engine: My Semester forecast + Buyback Lock | `/ua/semester` | `my_semester()`, `lock_buyback()`, Edge Functions `import-schedule`, `liquidation-pools` |
| Launch a Campus | `/launch` (staff passcode) | Edge Function `campus` + a trigger that turns a launched campus into a live school |

```
src/                 the app (Next.js 16)
supabase/migrations  run these in order in the SQL Editor
supabase/seed        sample market history + sample course catalog for demos
supabase/tests       isolation, .edu login and merged-feature tests
engine/              your Edge Functions (photo-to-listing, escrow, liquidity, campus) + their tests
cli/orbit.ts         launch a school from a YAML file
```

---

## Upgrade your project (you already ran migrations 01–04)

**1. Database.** In Supabase, go to **SQL Editor** and run each file, in this order:

1. `supabase/migrations/20261017000002_provisioning.sql`: run it **again**, since it was updated.
2. `20261017000005_listings_and_market.sql`
3. `20261017000006_escrow.sql`
4. `20261017000007_liquidity.sql`
5. `20261017000008_campus.sql`. This also gives UA and Auburn their campus rows and drop points.
6. `supabase/seed/market-history.sql`: about 6 months of sample sales so the charts have data.
7. `supabase/seed/liquidity-sample.sql`: the sample course catalog for My Semester.

If you created listings while testing the old escrow page, attach them to UA so they show up:

```sql
update public.listings set tenant_id = (select id from public.tenants where slug = 'ua') where tenant_id is null;
```

**2. Edge Functions.** Keep the ones you deployed. **Redeploy `escrow`** by pasting in
`engine/supabase/functions/escrow/index.ts`. It now checks that the buyer belongs to the
listing's school, and it tags completed sales with the school.

Under **Edge Functions → Secrets** you need:

| Secret | What it is |
| --- | --- |
| `GEMINI_API_KEY` | your Gemini API key |
| `ORBIT_ADMIN_TOKEN` | any long password you choose |
| `ORBIT_ESCROW_SECRET_KEY` | your devnet escrow wallet |

**3. `.env.local`.** Add the same admin token:

```
ORBIT_ADMIN_TOKEN=the-same-long-password
```

**4. Run it**

```bash
npm install
npm run dev
```

Open http://localhost:3000. Pick a campus, or go straight to http://localhost:3000/ua.
The older `ua.localhost:3000` addresses still work too.

---

## Demo script (about 3 minutes)

1. **Launch a campus.** Go to `/launch`, enter the passcode, fill in a school, click
   **Draft with Gemini**, confirm the drop points, then click **Launch**. The clock shows it's
   live in under 2 minutes. Open its portal.
2. **Sign in** at `/ua` with a `@crimson.ua.edu` email and enter the 6-digit code.
3. **Sell.** On **Sell**, snap a photo. Gemini writes and prices the listing. Click **Post listing**.
4. **Markets.** The listing appears in the order book with "vs fair" (compared with sales of the
   same item), next to the candles and time & sales.
5. **Escrow.** A second student clicks **Buy** and pays test USDC (Phantom or the QR code), then
   gets a 6-digit code. In **Portfolio**, the seller enters the code and the status moves live:
   held → handed off → released. Use **Settle escrow now** in `/launch` to release it during a demo.
6. **My Semester.** Import a schedule screenshot and add items to your shelf.
   **Run semester plan** in `/launch` posts buybacks; click **Lock price** to use Buyback Lock.

---

## Deploy (free Vercel address)

1. Push to GitHub, then in Vercel choose **Add New → Project**.
2. Add the variables from `.env.local`, setting `ORBIT_APP_URL` to your Vercel URL.
3. Schools live at `https://<project>.vercel.app/ua`, `/auburn`, and so on. No custom domain needed.
4. In Supabase, go to **Authentication → URL Configuration** and set **Site URL** to your Vercel URL.

## Tests

```bash
npm run typecheck
psql "$DATABASE_URL" -f supabase/tests/isolation_test.sql
psql "$DATABASE_URL" -f supabase/tests/edu_login_test.sql
psql "$DATABASE_URL" -f supabase/tests/features_test.sql   # needs both seeds loaded
cd engine && npm test                                       # 79 Edge Function tests
```

## Known gaps

- The course catalog (courses, materials, dorms) is shared across campuses. Student data
  (schedules, shelves, offers) is private to each student.
- Analytics events land in `event_outbox` (listings, escrow status changes, Buyback Locks).
  Shipping them to Tiger Data is the next step.
- Escrow runs on Solana **devnet** with test USDC. Mainnet is blocked in the escrow function on purpose.
