# api-e-wedding

Directus 12 + Postgres 17 backend for the wedding invitation (`../e-invitation-wedding`).

| | |
|---|---|
| Directus admin | http://localhost:8055 — `admin@e-wedding.com` / `sovannthai` |
| Postgres | `localhost:5433`, database `e-wedding`, user `admin` / `sovannthai` |

Postgres is on **5433** because 5432 is already used by another project's container.

## Run

```bash
docker compose up -d
```

First time only, create the schema, permissions and the frontend's API user:

```bash
node --env-file=.env scripts/setup.mjs
```

It prints `NUXT_DIRECTUS_TOKEN=...` once — put it in `../e-invitation-wedding/.env`.
`snapshots/schema.yaml` is a Directus schema snapshot of the same collections.

## Guests

Add guests in the admin app (Content → Guests). Each guest's invitation link is
`https://<site>/<guest id>`, and the envelope is addressed to their `name`.
Once a guest is saved, the **Open invitation** button on their page goes to
that link (right-click it to copy the address). The site address comes from
`CORS_ORIGIN` (or `SITE_URL`) when `scripts/setup.mjs` runs; re-run the script
if the address changes.

The website reads guests through its own server route (`server/api/guests/[id].get.ts`)
using the "Frontend" user's token, which can only read guests and read/add wishes.
The public role has no access, so the guest list (names, phones, notes) can't be
read from the browser.

## Wishes

Blessings sent from the website's guestbook land in Content → Wishes, with the
guest whose invitation link they came from (empty for the general link). Every
visitor sees the published ones; set a wish's status to **Hidden** to take it
off the site without deleting it.

The website goes through `server/api/wishes` (list + add). On an existing
install, re-run `scripts/setup.mjs` to add the collection and its permissions —
the frontend token stays the same.

### Importing guest lists

Export each sheet of the invitation spreadsheet as CSV (File → Download → CSV
exports the open sheet only) and import it with the sheet name as the group:

```bash
node --env-file=.env scripts/import-guests.mjs "<file.csv>" "University PNC"
```

Guests already in that group (same name) are skipped, so a re-export can be re-imported.
# api-e-wedding

## Deploy

Pushing to `develop` builds `ghcr.io/sovannthai/api-e-wedding:develop`
(`.github/workflows/docker.yml`). The production stack — Postgres, Directus,
the website and Caddy for HTTPS — and the steps to run it on a server are in
[`deploy/`](deploy/README.md).
