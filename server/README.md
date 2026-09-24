# WhatsApp relay

Holds the shop's WhatsApp linked-device session so the POS — running in a normal
browser tab — can send bills and reminders directly. This is the same approach
other POS products use when they advertise "WhatsApp built in, just scan once".

The browser cannot do this by itself: a WhatsApp session is a long-lived socket
that has to stay connected while nobody is looking at the screen. That is what
this process is for.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Same URL the app uses |
| `SUPABASE_ANON_KEY` | yes | Anon key only. **Never put the service_role key here** — this service does not need it |
| `ALLOWED_ORIGINS` | yes in production | Comma-separated, e.g. `https://gsoft-erp.vercel.app`. Unset means "allow any origin", which is fine locally and wrong in production |
| `DATA_DIR` | recommended | Where sessions are stored. Must be a **persistent disk** |
| `PORT` | no | Defaults to 8080 |

## Persistence

`DATA_DIR` holds the WhatsApp credentials. Put it on a persistent volume.
On a host with ephemeral disk (Render free tier, a plain Vercel/Netlify function)
the credentials vanish on every deploy and the shop has to scan the QR again —
and serverless platforms cannot keep the socket open at all, so they will not work.

Those files are equivalent to being logged into the shop's WhatsApp. They are
gitignored; keep them off backups that other people can read.

## Deploying

Any host that runs a long-lived Node process with a disk works. A `Dockerfile` is
included for hosts that want one.

```bash
# locally
SUPABASE_URL=... SUPABASE_ANON_KEY=... npm start
```

On a VPS, run it under `pm2` or a systemd unit and put nginx in front with TLS —
the browser will refuse to call a plain-HTTP service from an HTTPS page.

Then point the frontend at it by setting `VITE_WA_SERVER_URL` in the app's build
environment (in Vercel: Project → Settings → Environment Variables) and redeploy.

## Security

Every endpoint except `/health` requires the caller's Supabase access token. The
service verifies it with Supabase and resolves the caller's store through RLS, so
a store can only ever reach its own session, and no admin key lives here.

Sends are rate limited per store (20/min, 500/day) because WhatsApp blocks numbers
that behave like bots. Raise it only if the shop genuinely needs more.

## API

All routes take `Authorization: Bearer <supabase access token>`.

| Route | Purpose |
|---|---|
| `GET /health` | Liveness, no auth |
| `GET /status` | `{ status, qr, me, name }` — poll while pairing |
| `POST /connect` | Start pairing. `{ reset: true }` forces a fresh QR |
| `POST /send` | `{ phone, text }` |
| `POST /logout` | Unlink and delete the stored session |
