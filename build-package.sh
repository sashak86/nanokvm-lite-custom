#!/bin/sh
# Собирает архив своей сборки: заводское приложение Sipeed и наш слой custom/.
# Заводской пакет скачивается с Sipeed; секретов устройства в архиве нет.
set -e
V=${1:?usage: build-package.sh c1 [ожидаемая версия]}
HERE=$(cd "$(dirname "$0")" && pwd); W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
# latest.zip на CDN устарел (2.4.3): актуальный пакет указан в latest.json, как у заводского сервера.
U=https://cdn.sipeed.com/nanokvm
curl -fsSL -o "$W/latest.json" "$U/latest.json?n=$(date +%s)"
eval "$(python3 -I -c 'import json,sys,shlex; m=json.load(open(sys.argv[1])); print("BASE=%s PKG=%s SHA=%s"%(shlex.quote(m["version"]),shlex.quote(m["name"]),shlex.quote(m["sha512"])))' "$W/latest.json")"
case "$PKG" in nanokvm_*.tar.gz) ;; *) echo "неожиданное имя пакета: $PKG" >&2; exit 1;; esac
curl -fsSL -o "$W/$PKG" "$U/$PKG"
[ "$(openssl dgst -sha512 -binary "$W/$PKG" | base64 -w0)" = "$SHA" ] || { echo "sha512 не сошлась" >&2; exit 1; }
mkdir -p "$W/x" "$W/p"; tar -xzf "$W/$PKG" -C "$W/x"
D=$(dirname "$(find "$W/x" -maxdepth 3 -type f -name version | head -1)"); mv "$D" "$W/p/latest"
[ "$(tr -d '\n' < "$W/p/latest/version")" = "$BASE" ] || { echo "версия в пакете другая" >&2; exit 1; }
[ -z "${2:-}" ] || [ "$2" = "$BASE" ] || { echo "ожидалась версия $2, на CDN $BASE" >&2; exit 1; }
N=nanokvm-custom-$BASE-$V
mkdir -p "$W/p/custom" "$HERE/dist"
cp "$HERE/m.html" "$HERE/custom/inject.html" "$HERE/custom/S94kvmcustom" "$HERE/custom/kvmcustom-watch" "$W/p/custom/"
cp -r "$HERE/branding" "$W/p/custom/branding"
cp -r "$HERE/branding" "$W/p/latest/server/web/branding"
cp "$HERE/custom/install.sh" "$W/p/"
cp "$HERE/LICENSE" "$HERE/NOTICE.md" "$HERE/README.md" "$W/p/"
cp "$HERE/m.html" "$W/p/latest/server/web/m.html"
sed -i "/<head>/r $HERE/custom/inject.html" "$W/p/latest/server/web/index.html"
(cd "$W/p" && python3 -m zipfile -c "$HERE/dist/$N.zip" latest custom install.sh LICENSE NOTICE.md README.md)
cd "$HERE/dist" && sha256sum "$N.zip" > "$N.zip.sha256"
ls -la "$N.zip"
