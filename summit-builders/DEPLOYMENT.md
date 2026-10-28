# Deployment

Production: **https://summit.nudge-system.com** — Debian 13 LXC on Proxmox, Next.js 15 + Prisma/SQLite behind Caddy.

## Requirements

- Node.js 22 LTS
- 1 vCPU / 1 GB RAM / 8 GB disk (build needs ~1.5 GB heap: `NODE_OPTIONS=--max-old-space-size=1536`)
- A reverse proxy that sets `X-Forwarded-Proto: https`

## Build

```bash
npm ci
npx prisma generate
npm run build
```

`npm run build` runs `prisma generate` automatically.

## Environment

Create `.env` next to `package.json` (never commit it):

```bash
DATABASE_URL="file:./dev.db"
AUTH_SECRET="<openssl rand -hex 32>"
APP_URL="https://your-domain.example"
```

- `AUTH_SECRET` must be unique per deployment.
- `APP_URL` is used for `metadataBase` / absolute Open Graph URLs.
- The session cookie is marked `Secure` only when the request arrives over HTTPS (`x-forwarded-proto`), so plain-HTTP LAN previews still work.

## Run

```bash
npm start -- -H 0.0.0.0 -p 3000
```

Example systemd unit (`/etc/systemd/system/summit.service`):

```ini
[Unit]
Description=Summit Builders CRM (Next.js)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=summit
Group=summit
WorkingDirectory=/opt/summit
Environment=NODE_ENV=production
EnvironmentFile=/opt/summit/.env
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now summit
```

## Reverse proxy (Caddy)

```caddy
your-domain.example {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
```

Caddy obtains and renews the TLS certificate automatically. Do not expose port 3000 or the Proxmox management interface publicly.

## Database

- SQLite file: `prisma/dev.db` (path resolves relative to `prisma/schema.prisma`).
- Seed demo data: `npm run db:seed`.
- Reset: `npm run db:reset` (destructive).
- Back up by copying `prisma/dev.db` while the app is stopped, or use SQLite's `.backup`.
- SQLite is single-writer; this setup targets demo/low-traffic use.

## Deploying an update

```bash
rsync -a --exclude node_modules --exclude .next ./ user@host:/opt/summit/
ssh user@host 'cd /opt/summit && npm ci && npm run build && sudo systemctl restart summit'
```

## Smoke test

```bash
curl -fsS https://your-domain.example/ >/dev/null
curl -fsS https://your-domain.example/projects >/dev/null
curl -s -o /dev/null -w '%{http_code}\n' https://your-domain.example/crm/dashboard   # expect 307 → /login
```

Log in with a demo account (`admin@summitbuilders.com` / `demo1234` in the seeded demo) and check the dashboard, projects, and the public quote form.
