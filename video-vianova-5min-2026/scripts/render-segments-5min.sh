#!/usr/bin/env bash
# Render por fragmentos (300 s). Reutiliza los MP4 ya terminados.
set -u
cd /root/projects/ViaNovaIA/video-vianova-5min-2026 || exit 1
export HYPERFRAMES_BROWSER_PATH=/root/.oc-opencode2/cache/ms-playwright/chromium-1187/chrome-linux/chrome

mkdir -p renders/parts5 renders/parts5/logs
progress=renders/parts5/progress.log
: > "$progress"
echo "START $(date -Is)" >> "$progress"

segments=(
  "s01 0 5.5" "s02 5.5 16" "s03 16 27" "s04 27 38" "s05 38 50" "s06 50 58"
  "s08 58 118" "s09 118 178" "s10 178 238" "s11 238 292" "s07 292 300"
)

mem_available() {
  free -m | awk '/^Mem:/ {print $7}'
}

for spec in "${segments[@]}"; do
  read -r name start end <<< "$spec"
  out="renders/parts5/${name}.mp4"

  if [ -s "$out" ]; then
    duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out" 2>/dev/null || true)
    if [ -n "$duration" ] && awk -v d="$duration" -v e="$end" -v s="$start" 'BEGIN { exit !(d > (e-s)-0.20) }'; then
      echo "SKIP $name ($duration s) $(date -Is)" >> "$progress"
      continue
    fi
  fi

  while true; do
    avail=$(mem_available)
    if [ -n "$avail" ] && [ "$avail" -lt 1100 ]; then
      echo "WAIT_RAM $name avail=${avail}MB $(date -Is)" >> "$progress"
      sleep 45
    else
      break
    fi
  done

  echo "BEGIN $name $start-$end $(date -Is)" >> "$progress"
  nice -n 10 npx hyperframes@0.9.19 render . \
    --low-memory-mode --workers=1 --quality looks \
    --start="$start" --end="$end" \
    --output "$out" > "renders/parts5/logs/${name}.log" 2>&1
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "FAIL $name rc=$rc $(date -Is)" >> "$progress"
    exit $rc
  fi
  echo "DONE $name $(date -Is)" >> "$progress"
done

echo "ALL_SEGMENTS_DONE $(date -Is)" >> "$progress"
