#!/usr/bin/env bash
# Normaliza master5v-pre.wav a ~-14 LUFS con limitador y codifica master5v.m4a.
set -euo pipefail
cd /root/projects/ViaNovaIA/video-vianova-5min-2026

PRE=assets/audio/master5v-pre.wav
NORM=assets/audio/master5v-norm.wav
OUT=assets/audio/master5v.m4a

I=$(ffmpeg -hide_banner -nostats -i "$PRE" -af ebur128=peak=true -f null - 2>&1 | grep -E '^\s+I:' | tail -1 | awk '{print $2}')
echo "Loudness integrada pre: ${I} LUFS"
GAIN=$(awk -v i="$I" 'BEGIN { printf "%.2f", -14.0 - i + 0.4 }')
echo "Ganancia: ${GAIN} dB"
ffmpeg -y -v error -i "$PRE" -af "volume=${GAIN}dB,alimiter=limit=0.841:attack=5:release=60:level=false" -ar 48000 -ac 2 -c:a pcm_s24le "$NORM"
ffmpeg -y -v error -i "$NORM" -c:a aac -b:a 256k -ar 48000 -ac 2 -movflags +faststart "$OUT"
echo "---NORM---"
ffmpeg -hide_banner -nostats -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | tail -12
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
