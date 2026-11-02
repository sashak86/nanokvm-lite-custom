#!/bin/sh
# Установка на NanoKVM: распаковать архив на устройстве и запустить ./install.sh
# --full дополнительно заменяет /kvmapp деревом из архива (восстановление после сброса карты).
set -e
case "${1:-}" in ""|--ui-only|--full) ;; *) echo "usage: sh install.sh [--ui-only|--full]" >&2; exit 1;; esac
cd "$(dirname "$0")"
# Сохраняем прежний overlay и обе web-копии до любых изменений.
B=/root/nanokvm-backup-$(date +%Y%m%d-%H%M%S)-$$
mkdir -p "$B"
[ ! -d /root/custom ] || cp -r /root/custom "$B/custom"
[ ! -f /etc/init.d/S94kvmcustom ] || cp /etc/init.d/S94kvmcustom "$B/S94kvmcustom"
for NAME in permanent runtime; do
  W=/kvmapp/server/web; [ "$NAME" != runtime ] || W=/tmp/server/web
  [ ! -d "$W" ] || { mkdir -p "$B/$NAME"; for F in index.html m.html branding; do [ ! -e "$W/$F" ] || cp -r "$W/$F" "$B/$NAME/"; done; }
done
mkdir -p /root/custom
cp custom/m.html custom/inject.html custom/S94kvmcustom custom/kvmcustom-watch /root/custom/
[ ! -d custom/branding ] || cp -r custom/branding /root/custom/
cp custom/S94kvmcustom /etc/init.d/S94kvmcustom
chmod 755 /etc/init.d/S94kvmcustom
if [ "${1:-}" = "--full" ]; then
  /etc/init.d/S95nanokvm stop || true
  rm -rf /root/old
  mv /kvmapp /root/old
  cp -r latest /kvmapp
  chmod -R 755 /kvmapp
fi
if [ "${1:-}" = "--ui-only" ]; then
  /etc/init.d/S94kvmcustom refresh-ui
  echo "Интерфейс обновлён без перезапуска. Обновите вкладку браузера."
else
  /etc/init.d/S94kvmcustom start
  echo "Готово. Перезагрузите NanoKVM для проверки автозагрузки: reboot"
fi
echo "Резервная копия: $B"
