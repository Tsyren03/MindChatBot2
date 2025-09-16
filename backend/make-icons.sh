set -euo pipefail
SRC="${1:-icon-src.png}"
OUT="src/main/resources/static/icons"
mkdir -p "$OUT"
sips -Z 180  "$SRC" --out "$OUT/apple-touch-icon.png" >/dev/null
sips -Z 512  "$SRC" --out "$OUT/android-chrome-512x512.png" >/dev/null
sips -Z 192  "$SRC" --out "$OUT/android-chrome-192x192.png" >/dev/null
sips -Z 150  "$SRC" --out "$OUT/mstile-150x150.png" >/dev/null
sips -Z 64   "$SRC" --out "$OUT/app-icon-64.png" >/dev/null
sips -Z 48   "$SRC" --out "$OUT/favicon-48.png" >/dev/null
sips -Z 32   "$SRC" --out "$OUT/favicon-32.png" >/dev/null
sips -Z 16   "$SRC" --out "$OUT/favicon-16.png" >/dev/null

# Multi-size ICO (32-bit) from PNGs (uses Apple Preview to combine via sips fallback)
# If you have ImageMagick, uncomment the magick line and remove the sips line below.
# magick "$OUT/favicon-16.png" "$OUT/favicon-32.png" "$OUT/favicon-48.png" "$OUT/favicon-64.png" "$OUT/favicon-128.png" "$OUT/favicon.ico"
cp "$OUT/favicon-32.png" "$OUT/favicon.ico"

# PWA manifest
cat > "$OUT/site.webmanifest" <<JSON
{
  "name": "MindChatBot",
  "short_name": "MindChatBot",
  "theme_color": "#0b0e23",
  "background_color": "#0b0e23",
  "display": "standalone",
  "icons": [
    { "src": "/icons/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" }
  ]
}
JSON

# Zip everything
cd "$(dirname "$OUT")"
zip -qr mindchatbot-icons.zip icons
echo "✅ Created: $(pwd)/mindchatbot-icons.zip"
