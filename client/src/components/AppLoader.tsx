import { motion, useReducedMotion } from 'framer-motion';
import logoMark from '@/assets/vianova-mark.png';
import '@/styles/app-loader.css';

const WORDMARK = [
  { char: 'V', accent: true },
  { char: 'I', accent: true },
  { char: 'A', accent: true },
  { char: 'N', accent: false },
  { char: 'o', accent: false },
  { char: 'v', accent: false },
  { char: 'a', accent: false },
] as const;

interface AppLoaderProps {
  /** `splash` is the full boot experience; `route` is the quiet lazy-route fallback. */
  variant?: 'splash' | 'route';
}

const EASE = [0.23, 1, 0.32, 1] as const;

export default function AppLoader({ variant = 'splash' }: AppLoaderProps) {
  const reduceMotion = useReducedMotion();
  const isSplash = variant === 'splash';

  return (
    <motion.div
      className={`app-loader${isSplash ? '' : ' app-loader--route'}`}
      role="status"
      aria-live="polite"
      aria-label="Cargando VIANova"
      initial={{ opacity: 1 }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 1.012 }
      }
      transition={{ duration: reduceMotion ? 0.18 : 0.3, ease: EASE }}
    >
      <div className="app-loader__stage">
        <div className="app-loader__mark-wrap">
          <span className="app-loader__halo-slot" aria-hidden="true">
            <motion.span
              className="app-loader__halo"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.82 }}
              animate={{ opacity: isSplash ? 0.9 : 0.38, scale: 1.04 }}
              transition={{
                duration: isSplash ? 0.9 : 0.35,
                ease: EASE,
              }}
            />
          </span>

          <motion.img
            src={logoMark}
            alt=""
            draggable={false}
            className="app-loader__mark"
            initial={
              reduceMotion || !isSplash
                ? false
                : { opacity: 0, y: 18, scale: 0.965 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: isSplash ? 0.52 : 0.3,
              delay: isSplash && !reduceMotion ? 0.07 : 0,
              ease: EASE,
            }}
          />
        </div>

        <p className="app-loader__word" aria-label="VIANova">
          {WORDMARK.map((letter, index) => (
            <motion.span
              key={`${letter.char}-${index}`}
              aria-hidden="true"
              className={`app-loader__letter${letter.accent ? ' app-loader__letter--accent' : ''}`}
              initial={
                reduceMotion || !isSplash
                  ? false
                  : { opacity: 0, y: 16 }
              }
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: isSplash ? 0.32 : 0.24,
                delay:
                  isSplash && !reduceMotion
                    ? 0.25 + index * 0.034
                    : 0,
                ease: EASE,
              }}
            >
              {letter.char}
            </motion.span>
          ))}
        </p>
      </div>
    </motion.div>
  );
}
