# Deploying the wedding site

Everything the server needs is in this folder. The images come from GitHub's
registry (GHCR), built by GitHub Actions on every push to `develop`:

| Image | Built from |
|---|---|
| `ghcr.io/sovannthai/e-invitation-wedding:develop` | the website repo |
| `ghcr.io/sovannthai/api-e-wedding:develop` | this repo (Directus + schema snapshot + scripts) |

Caddy sits in front and handles HTTPS for both domains by itself.

## Before you start

- Docker with the compose plugin on the server.
- Two DNS A records pointing at the server, e.g. `wedding.example.com` (the
  site) and `api.wedding.example.com` (Directus admin).
- Ports 80 and 443 open.
- The images are built for x86-64 (`linux/amd64`). On an ARM server, add
  `platforms: linux/arm64` to the build step in both `.github/workflows/docker.yml`.

## First deploy

1. **Copy this folder to the server**, e.g. to `~/e-wedding`:

   ```bash
   scp -r deploy <user>@<server>:~/e-wedding
   ```

2. **Log the server in to GHCR.** Packages are private by default. Create a
   GitHub token (Settings → Developer settings → Personal access tokens →
   classic) with only the `read:packages` scope, then on the server:

   ```bash
   docker login ghcr.io -u Sovannthai
   ```

   and paste the token as the password. (Or make both packages public on
   GitHub and skip this.)

3. **Fill in `.env`:**

   ```bash
   cd ~/e-wedding && cp .env.example .env && nano .env
   ```

   Set the two domains, new passwords and a new `DIRECTUS_SECRET`. Leave
   `NUXT_DIRECTUS_TOKEN` empty for now.

4. **Start the API and create the schema:**

   ```bash
   docker compose up -d postgres directus
   docker compose exec -e DIRECTUS_URL=http://127.0.0.1:8055 directus node scripts/setup.mjs
   ```

   It prints `NUXT_DIRECTUS_TOKEN=...` **once**. Put it in `.env`.

5. **Start everything:**

   ```bash
   docker compose up -d
   ```

   The site is at `https://<SITE_DOMAIN>` and the admin app at
   `https://<API_DOMAIN>/admin`. The first request takes a few seconds while
   Caddy gets the certificates.

## Updating

After a push to `develop` has finished building (GitHub → Actions):

```bash
cd ~/e-wedding && docker compose pull && docker compose up -d
```

To roll back, set `WEB_TAG` / `API_TAG` in `.env` to an older `sha-<commit>`
tag (listed under the repo's Packages on GitHub) and run the same command.

If a new version changes the schema, re-run the `setup.mjs` command from
step 4 — it only adds what is missing.

## Guests

Add them in the admin app, or import a CSV sheet:

```bash
docker compose cp "guests.csv" directus:/tmp/guests.csv
docker compose exec -e DIRECTUS_URL=http://127.0.0.1:8055 directus \
  node scripts/import-guests.mjs /tmp/guests.csv "University PNC"
```

To bring over the guests already in your local database instead, dump them
on your laptop (in the repo root, with the local stack running):

```bash
docker compose exec -T postgres pg_dump -U admin -d e-wedding --data-only -t guests -t wishes > guests.sql
```

copy `guests.sql` to the server and load it after step 4:

```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < guests.sql
```

Guest ids are kept, so invitation links made locally stay valid.

## Backup

```bash
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > backup-$(date +%F).sql
```

Uploaded files live in the `e-wedding_directus_uploads` volume.
