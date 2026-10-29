import { useId } from "react";

type AiSparkIconProps = {
  className?: string;
  title?: string;
};

/**
 * VIANova AI mark: a four-point spark with a smaller satellite spark and an
 * orbital arc. Uses `currentColor` so the same glyph works on the amber core,
 * on the dark avatar and inside the composer.
 */
export default function AiSparkIcon({ className, title }: AiSparkIconProps) {
  const id = useId().replace(/[:]/g, "");
  const gradient = `ai-spark-${id}`;

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gradient} x1="8" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <path
        d="M15.9 3.8c1.02 5.94 3.26 8.18 9.2 9.2-5.94 1.02-8.18 3.26-9.2 9.2-1.02-5.94-3.26-8.18-9.2-9.2 5.94-1.02 8.18-3.26 9.2-9.2Z"
        fill={`url(#${gradient})`}
      />
      <path
        d="M24.9 20.7c.43 2.5 1.37 3.44 3.87 3.87-2.5.43-3.44 1.37-3.87 3.87-.43-2.5-1.37-3.44-3.87-3.87 2.5-.43 3.44-1.37 3.87-3.87Z"
        fill="currentColor"
        opacity="0.78"
      />
      <path
        d="M6.4 7.2A10.6 10.6 0 0 0 4.9 21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle cx="26" cy="7.4" r="1.15" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
