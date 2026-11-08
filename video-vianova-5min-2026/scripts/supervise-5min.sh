#!/usr/bin/env bash
# Supervisor: reintenta audio, render por fragmentos y ensamblado hasta
# obtener el MP4 final verificado. Pensado para correr desacoplado.
set -u
cd /root/projects/ViaNovaIA/video-vianova-5min-2026 || exit 1

mkdir -p renders/parts5
log=renders/parts5/supervisor.log
FINAL=renders/video-vianova-5min-final.mp4
PROGRESS=renders/parts5/progress.log

echo "SUPERVISOR_START $(date -Is)" >> "$log"

attempt=0
while true; do
  attempt=$((attempt + 1))
  echo "ATTEMPT $attempt $(date -Is)" >> "$log"

  if [ ! -s assets/audio/master5.m4a ]; then
    echo "BUILD_AUDIO $(date -Is)" >> "$log"
    if node scripts/build-audio-5min.mjs >> renders/parts5/audio.log 2>&1 && bash scripts/normalize-audio-5min.sh >> renders/parts5/audio.log 2>&1; then
      echo "AUDIO_OK $(date -Is)" >> "$log"
    else
      echo "AUDIO_FAIL $(date -Is)" >> "$log"
      sleep 60
      continue
    fi
  fi

  echo "RENDER_SEGMENTS $(date -Is)" >> "$log"
  if bash scripts/render-segments-5min.sh >> renders/parts5/render.log 2>&1; then
    echo "SEGMENTS_OK $(date -Is)" >> "$log"
  else
    echo "SEGMENTS_FAIL $(date -Is)" >> "$log"
    sleep 60
    continue
  fi

  echo "ASSEMBLE $(date -Is)" >> "$log"
  if bash scripts/assemble-5min.sh >> renders/parts5/assemble.log 2>&1; then
    echo "ASSEMBLE_OK $(date -Is)" >> "$log"
  else
    echo "ASSEMBLE_FAIL $(date -Is)" >> "$log"
    sleep 60
    continue
  fi

  if [ -s "$FINAL" ] && grep -q "VERIFIED" "$PROGRESS" 2>/dev/null; then
    echo "ALL_DONE $(date -Is)" >> "$log"
    break
  fi

  echo "RETRY $(date -Is)" >> "$log"
  sleep 60
done
