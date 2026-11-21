# Directus for the wedding API: the official image plus this repo's schema
# snapshot and setup scripts, so the server needs nothing but the image.
#
#   docker build -t api-e-wedding .
#
# All configuration (database, secret, admin user, URLs) comes from the
# environment at run time — see deploy/docker-compose.yml.
FROM directus/directus:12.5.1

COPY --chown=node:node snapshots /directus/snapshots
COPY --chown=node:node scripts /directus/scripts
