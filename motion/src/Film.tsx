import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import React from "react";
import { Ch1Mark } from "./chapters/Ch1Mark";
import { Ch2Market } from "./chapters/Ch2Market";
import { Ch3AI } from "./chapters/Ch3AI";
import { Ch4Discovery } from "./chapters/Ch4Discovery";
import { Ch5RoutePay } from "./chapters/Ch5RoutePay";
import { Ch6Taxi } from "./chapters/Ch6Taxi";
import { Ch7Panel } from "./chapters/Ch7Panel";
import { Ch8Close } from "./chapters/Ch8Close";
import { C } from "./theme";

const CHAPTERS = [
  { component: Ch1Mark, from: 0, duration: 240 },
  { component: Ch2Market, from: 240, duration: 480 },
  { component: Ch3AI, from: 720, duration: 480 },
  { component: Ch4Discovery, from: 1200, duration: 480 },
  { component: Ch5RoutePay, from: 1680, duration: 480 },
  { component: Ch6Taxi, from: 2160, duration: 480 },
  { component: Ch7Panel, from: 2640, duration: 360 },
  { component: Ch8Close, from: 3000, duration: 600 },
] as const;

/** Voz en off: una pista por línea, colocada sobre la rejilla de 120 BPM. */
const VOICEOVER = [
  { src: "audio/vo-01.wav", from: 276 },
  { src: "audio/vo-02.wav", from: 744 },
  { src: "audio/vo-03.wav", from: 1240 },
  { src: "audio/vo-04.wav", from: 1720 },
  { src: "audio/vo-05.wav", from: 2206 },
  { src: "audio/vo-06.wav", from: 2680 },
  { src: "audio/vo-07.wav", from: 3060 },
  { src: "audio/vo-08.wav", from: 3270 },
] as const;

export const Film: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      {CHAPTERS.map(({ component: Chapter, from, duration }) => (
        <Sequence key={from} from={from} durationInFrames={duration} premountFor={30}>
          <Chapter duration={duration} />
        </Sequence>
      ))}

      {VOICEOVER.map(({ src, from }) => (
        <Sequence key={src} from={from}>
          <Audio src={staticFile(src)} volume={0.92} />
        </Sequence>
      ))}

      <Sequence from={0} durationInFrames={3600}>
        <Audio src={staticFile("audio/sfx-bed.wav")} volume={0.72} />
      </Sequence>
    </AbsoluteFill>
  );
};
