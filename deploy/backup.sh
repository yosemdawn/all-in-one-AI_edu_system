#!/bin/sh
# Run from the repository root during a maintenance window after stopping backend writes.
set -eu
if [ "${1:-}" != "--quiesced" ]; then
  echo 'Stop backend writes first, then run: sh deploy/backup.sh --quiesced' >&2
  exit 1
fi
umask 077
directory="backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$directory"
docker compose --env-file backend/.env.production exec -T mongo sh -c 'exec mongodump --host 127.0.0.1 --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db yosem_ai --archive --gzip' > "$directory/mongo.archive.gz"
docker compose --env-file backend/.env.production run --rm --no-deps --entrypoint tar backend -czf - -C /app/uploads . > "$directory/uploads.tar.gz"
test -s "$directory/mongo.archive.gz"
test -s "$directory/uploads.tar.gz"
echo "Backup written to $directory. Copy it to restricted off-host storage and verify restoration."
