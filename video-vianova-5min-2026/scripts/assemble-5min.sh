#!/usr/bin/env bash
# Une los fragmentos en video-only y monta el audio maestro de 300 s.
set -euo pipefail
cd /root/projects/ViaNovaIA/video-vianova-5min-2026

mkdir -p renders/parts5
progress=renders/parts5/progress.log

for name in s01 s02 s03 s04 s05 s06 s08 s09 s10 s11 s07; do
  test -s "renders/parts5/${name}.mp4" || { echo "Falta renders/parts5/${name}.mp4" >&2; exit 1; }
done

: > renders/parts5/concat.txt
for name in s01 s02 s03 s04 s05 s06 s08 s09 s10 s11 s07; do
  echo "file '$PWD/renders/parts5/${name}.mp4'" >> renders/parts5/concat.txt
done

echo "CONCAT_VIDEO $(date -Is)" >> "$progress"
ffmpeg -y -v error -f concat -safe 0 -i renders/parts5/concat.txt -map 0:v:0 -an -c:v copy -movflags +faststart renders/video-only-5min.mp4

echo "MUX_AUDIO $(date -Is)" >> "$progress"
ffmpeg -y -v error -i renders/video-only-5min.mp4 -i assets/audio/master5.m4a -map 0:v:0 -map 1:a:0 -c:v copy -c:a copy -shortest -movflags +faststart renders/video-vianova-5min-final.mp4

echo "VERIFY $(date -Is)" >> "$progress"
ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=index,codec_name,codec_type,width,height,r_frame_rate,nb_frames,sample_rate,channels -of default=nw=1 renders/video-vianova-5min-final.mp4 | tee renders/parts5/final-probe.txt
ffmpeg -hide_banner -nostats -i renders/video-vianova-5min-final.mp4 -map 0:a:0 -af ebur128=peak=true -f null - 2>&1 | tail -12 | tee renders/parts5/final-loudness.txt
ffmpeg -v error -i renders/video-vianova-5min-final.mp4 -f null - 2>&1 | tee renders/parts5/decode-check.txt
echo "VERIFIED $(date -Is)" >> "$progress"
