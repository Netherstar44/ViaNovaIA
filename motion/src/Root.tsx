import React from "react";
import { Composition } from "remotion";
import { Film } from "./Film";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ViaNovaFilm"
      component={Film}
      durationInFrames={3600}
      fps={60}
      width={1920}
      height={1080}
    />
  );
};
