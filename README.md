# Kansas Korean

A community meetup app for organizing hobby gatherings with friends: movie nights, pickleball, bowling, soccer, and more. Live at [kansaskorean.com](https://www.kansaskorean.com/) with 60+ members and 35–40 hosted meetups per month.

🇰🇷 [한국어 문서 (Korean README)](./README.ko.md) — the Korean version is the more detailed one and documents every design decision.

## What it does

- **Hobby feeds** — post a meetup with date, time, place, and capacity; others join or cancel. Weekly recurring meetups are generated 7 days ahead by a daily cron job.
- **Movie night matching** — pick the showtimes you can make; people who chose the same showtime are grouped automatically. Showtimes can be refreshed from the AMC Theatres API, and titles autocomplete from TMDB.
- **Subscriptions & notifications** — subscribe to a hobby and get in-app, KakaoTalk, and Web Push notifications for new, changed, or cancelled meetups.
- **Friends** — friend requests are only possible between people who attended the same meetup. No user search by design.
- **Settlement** — split costs after a meetup. All amounts are integer cents; remainders are distributed so the parts always sum to the total. Money never passes through the app: Venmo deep links and Zelle details only.
- **Two regions, one app** — the domain decides the region (`lib/region.ts`). Meetups, subscriptions, and leaderboards are per region; profiles and friendships are shared.
- **Multilingual** — UI strings in Korean, English, and Spanish. User-written text can be translated on demand with Claude, cached by content hash.
- **Installable PWA** with app badge and push support on iOS (home-screen install) and Android.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack), React 19, TypeScript |
| Database | Neon Postgres via Drizzle ORM; PGlite (in-memory Postgres) in development |
| Cache / movie data | Upstash Redis |
| File storage | Vercel Blob (photos) |
| Auth | Kakao OAuth, signed session cookies |
| Notifications | In-app, KakaoTalk "message to me", Web Push (VAPID) |
| Integrations | AMC Theatres API, TMDB, Claude (translation), Google Maps |
| Hosting | Vercel, with Vercel Cron for reminders and recurring meetups |

## Pages

| Route | Description |
|---|---|
| `/` | Home: hobby categories, subscription toggles, Kakao login |
| `/c/<category>` | Feed for one hobby: create, join, cancel, comment, share |
| `/p/<id>` | Meetup detail, participants, photos, settlement |
| `/movie`, `/movie/groups` | Pick showtimes and see group matches |
| `/notifications`, `/friends` | Notification inbox and friend list |
| `/suggest` | Propose a new hobby category (admins approve in `/admin`) |
| `/admin` | Movie schedule editor, category requests, member tools. Requires `ADMIN_KEY` |

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

With no environment variables set the app runs entirely on local fallbacks: PGlite for Postgres and an in-memory store for movie data. Data resets on restart.

**Safety note:** in development the app ignores a remote `DATABASE_URL` and uses PGlite unless you also set `ALLOW_PROD_DB=1`. This exists because local testing once wrote to production data. `npm run db:push` (drizzle-kit) is not affected and still targets `DATABASE_URL`.

## Configuration

All configuration is read from environment variables. Nothing is hardcoded. Copy the names below into `.env.local` for local work and into Vercel project settings for deployment.

**Required for a real deployment**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` or `POSTGRES_URL` | Neon Postgres connection string |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis (also accepted as `KV_REST_API_URL` / `KV_REST_API_TOKEN`) |
| `KAKAO_REST_API_KEY` | Kakao login. `KAKAO_CLIENT_SECRET` if enabled in the Kakao console |
| `AUTH_SECRET` | Session cookie signing key, e.g. `openssl rand -base64 32` |
| `ADMIN_KEY` | Password for `/admin` |
| `ADMIN_KAKAO_ID` | Comma-separated Kakao user ids treated as admins |
| `NEXT_PUBLIC_SITE_URL` | Public URL used in push, share, and calendar links |
| `CRON_SECRET` | Protects `/api/cron/*` endpoints called by Vercel Cron |

**Optional integrations**

| Variable | Feature |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push. Generate with `npx web-push generate-vapid-keys`. Changing the keys invalidates every existing subscription |
| `AMC_VENDOR_KEY`, `AMC_THEATRE_ID`, `AMC_THEATRE_NAME`, `AMC_API_BASE` | Live showtimes from the AMC Theatres API. Vendor keys are issued by AMC on request |
| `TMDB_API_KEY` | Movie title autocomplete with posters and cast |
| `ANTHROPIC_API_KEY` | On-demand translation of user-written text. Without it the feature is hidden |
| `GOOGLE_MAPS_API_KEY` | Google Places lookup for photo and meetup locations (`lib/geocode.ts`) |
| `NEXT_PUBLIC_SITE_URL_PENN`, `AMC_THEATRE_ID_PENN`, `AMC_THEATRE_NAME_PENN`, `DEFAULT_REGION` | Second region |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google login, offered only on regions whose `loginProviders` (in `lib/region.ts`) include `google`. Without the keys the button is not shown |
| `PUSH_IN_DEV`, `KAKAO_MEMO_IN_DEV` | Send real push or KakaoTalk messages from a dev server |

## Deploying to Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new). Next.js is detected automatically.
2. In the project's **Storage** tab create a **Neon Postgres** database and an **Upstash Redis** database. Both inject their environment variables.
3. Create the tables: put `DATABASE_URL` in `.env.local` (or run `vercel env pull`) and run `npm run db:push`. Re-run whenever `lib/db/schema.ts` changes.
4. Add the remaining variables from the tables above, then redeploy.
5. `vercel.json` registers the daily cron that sends reminders and opens the next occurrences of recurring meetups.

### Kakao login

1. Create an app at [developers.kakao.com](https://developers.kakao.com).
2. Register your web domains (`http://localhost:3000` and the production URL) and the redirect URI `https://<domain>/api/auth/callback`.
3. Set `profile_nickname` as a required consent. If you want KakaoTalk notifications, add `talk_message` as an **optional** consent; making it required blocks login for anyone who declines.
4. Put the REST API key in `KAKAO_REST_API_KEY`.

If you add a second domain, register it on the **same** Kakao app. A new app issues different user ids, so the same person would become a different account.

### Google login (optional, per region)

A region can also offer "Sign in with Google" — `loginProviders` in `lib/region.ts` decides which doors a domain opens (Kansas: Kakao only; Penn: Kakao and Google). Accounts stay in the one `users` table: a Google user gets `id = 'google:<sub>'` and their Google account name in `kakao_name`; the provider is derived from the id prefix (`lib/provider.ts`). Kakao and Google callbacks share the same tail (`lib/auth-finish.ts`). On a domain that does not list `google`, `/api/auth/google/*` returns 404.

1. In Google Cloud Console create an OAuth consent screen (External; scopes `openid`, `userinfo.email`, `userinfo.profile` — non-sensitive, no verification) and **publish** it. Left in Testing it caps at 100 test users and expires tokens after 7 days.
2. Create an OAuth client (Web application). Authorized origins: your production origin(s) and `http://localhost:3000`. Redirect URIs: `https://<domain>/api/auth/google/callback` for each origin, plus `http://localhost:3000/api/auth/google/callback`. Exact match, no wildcards.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

Kakao does not expose an email, so a Kakao account and a Google account cannot be linked automatically — one person can hold both. The Google button is hidden inside the KakaoTalk in-app browser, where Google refuses OAuth (`disallowed_useragent`).

## Design notes

- **Integer cents everywhere** (`lib/money.ts`). Dollar floats drift; cents don't. Split remainders are added one cent at a time from the first person so the parts always equal the total.
- **Region by hostname**, not by user setting, so links shared across regions open on the right domain.
- **Anonymous categories** strip author ids, participant ids, and comment user ids on the server, and disable settlement, friend requests, and leaderboards for that category. Hiding names in the UI alone would still leak ids to devtools.
- **Friend activity never sends push or KakaoTalk**, only an in-app line. That path has no `sendNotice` call at all, so the rule is enforced by structure rather than by a flag.
- **Feature flags** live in `lib/flags.ts` instead of scattered `false &&` guards.
- **Translations are cached by `(sha256(text), language)`**, so identical text is translated once and edits invalidate the cache naturally.

## Project layout

```
app/            Next.js routes and API handlers (app/api/*)
lib/            Domain logic: db schema, region, money, notifications, i18n, integrations
lib/db/         Drizzle schema and queries
public/         Static assets and service worker
scripts/        Maintenance scripts (e.g. no-touch-hover.mjs for iOS hover fixes)
docs/           Design notes and mockups
```

## Contributing

Issues and pull requests are welcome. Please run `npm run build` before opening a PR. The Korean README documents the reasoning behind most decisions and is the best place to start before changing behavior.

## License

[MIT](./LICENSE) © 2026 Hyun Lee
