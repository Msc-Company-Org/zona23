#!/bin/sh
# Snapshot SQLite antes da cópia das mídias imutáveis, sem interromper o serviço.
set -eu
umask 077
exec 9>/run/lock/zona23-backup.lock
flock -n 9 || exit 0
stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
dir=/srv/msc/backups/zona23/$stamp
mkdir -p "$dir"
image=$(docker inspect zona23-acervo-1 --format '{{.Image}}')
docker run --rm --network none --user 0 \
  -v /srv/msc/data/zona23:/data \
  -v "$dir":/backup "$image" \
  bun -e 'import {Database} from "bun:sqlite"; const db = new Database("/data/acervo.sqlite"); db.exec("VACUUM INTO '\''/backup/acervo.sqlite'\''"); db.close();'
tar -C /srv/msc/data/zona23 -czf "$dir/media.tar.gz" media
(cd "$dir" && sha256sum acervo.sqlite media.tar.gz > SHA256SUMS && sha256sum -c SHA256SUMS)
# Retenção local curta para caber no disco da VPS mesmo com o acervo em 10 GiB.
find /srv/msc/backups/zona23 -mindepth 1 -maxdepth 1 -type d -mtime +2 -exec rm -rf -- {} +
printf '%s backup Zona 23 concluído: %s\n' "$stamp" "$dir"
