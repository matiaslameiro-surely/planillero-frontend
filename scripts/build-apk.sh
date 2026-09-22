#!/bin/sh
# Genera un APK Android de prueba dentro de un contenedor y lo deja en ./dist-apk/planillero.apk.
#
# Uso:
#   sh scripts/build-apk.sh <URL-del-backend>
#   EXPO_PUBLIC_API_URL=<URL-del-backend> sh scripts/build-apk.sh
#
# La URL queda dentro del APK. En una tablet `localhost` es la propia tablet: usá la IP de la
# máquina que corre el backend (o su dominio), por ejemplo http://192.168.0.10:8080.
#
# Requiere Docker con BuildKit. La primera vez baja el Android SDK y tarda bastante (varios GB);
# las siguientes reusan la caché.

set -eu

cd "$(dirname "$0")/.."

API_URL="${1:-${EXPO_PUBLIC_API_URL:-}}"
if [ -z "$API_URL" ]; then
  echo "Falta la URL del backend." >&2
  echo "Uso: sh scripts/build-apk.sh http://192.168.0.10:8080" >&2
  exit 1
fi

case "$API_URL" in
  http://localhost*|http://127.0.0.1*)
    echo "Aviso: '$API_URL' apunta a la propia tablet, no a tu computadora." >&2
    ;;
esac

OUT_DIR="dist-apk"
mkdir -p "$OUT_DIR"

echo "==> Construyendo el APK contra $API_URL"
DOCKER_BUILDKIT=1 docker build \
  -f docker/Dockerfile.apk \
  --build-arg "EXPO_PUBLIC_API_URL=$API_URL" \
  --target apk \
  --output "type=local,dest=$OUT_DIR" \
  .

echo "==> Listo: $OUT_DIR/planillero.apk"
