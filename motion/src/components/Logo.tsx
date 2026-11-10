import React from "react";
import { Img, staticFile } from "remotion";
import { C, F } from "../theme";

/**
 * Lockup real: marca PNG + wordmark como texto HTML.
 * En la app: <span className="text-primary-ink">VIA</span>Nova.
 */
export const Logo: React.FC<{
  markHeight?: number;
  wordSize?: number;
  tone?: "dark" | "light";
  gap?: number;
  opacity?: number;
}> = ({ markHeight = 58, wordSize = 32, tone = "dark", gap = 10, opacity = 1 }) => {
  const light = tone === "light";
  return (
    <div style={{ display: "flex", alignItems: "center", gap, opacity }}>
      <Img
        src={staticFile("brand/brand-mark-principal.png")}
        style={{ height: markHeight, width: "auto", display: "block" }}
      />
      <div
        style={{
          fontFamily: F.sans,
          fontWeight: 600,
          fontSize: wordSize,
          letterSpacing: "-0.045em",
          color: light ? C.ink : C.white,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: C.gold }}>VIA</span>Nova
      </div>
    </div>
  );
};
