#!/usr/bin/env bash
# Render the 66 s film scene by scene. Each segment is small enough to
# survive on the phone, and completed segments are reused on a retry.
set -u

cd /root/projects/ViaNovaIA/video-vianova-2026 || exit 1
export HYPERFRAMES_BROWSER_PATH=/root/.oc-opencode2/cache/ms-playwright/chromium-1187/chrome-linux/chrome

mkdir -p renders/parts renders/parts/logs
progress=renders/parts/progress.log
: > "$progress"
echo "START $(date -Is)" >> "$progress"

segments=(
  "s01 0 5.5"
  "s02 5.5 16"
  "s03 16 27"
  "s04 27 38"
  "s05 38 50"
  "s06 50 58"
  "s07 58 66"
)

for spec in "${segments[@]}"; do
  read -r name start end <<< "$spec"
  out="renders/parts/${name}.mp4"

  if [ -s "$out" ]; then
    duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out" 2>/dev/null || true)
    if [ -n "$duration" ] && awk -v d="$duration" -v e="$end" -v s="$start" 'BEGIN { exit !(d > (e-s)-0.15) }'; then
      echo "SKIP $name ($duration s) $(date -Is)" >> "$progress"
      continue
    fi
  fi

  echo "BEGIN $name $start-$end $(date -Is)" >> "$progress"
  npx hyperframes@0.9.19 render . \
    --low-memory-mode --workers=1 --quality looks \
    --start="$start" --end="$end" \
    --output "$out" > "renders/parts/logs/${name}.log" 2>&1
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "FAIL $name rc=$rc $(date -Is)" >> "$progress"
    exit $rc
  fi
  echo "DONE $name $(date -Is)" >> "$progress"
done

echo "ALL_DONE $(date -Is)" >> "$progress"
