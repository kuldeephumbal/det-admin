'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Tween a number from 0 (or `from`) up to `value` on mount.
 * Uses requestAnimationFrame, eases out, respects prefers-reduced-motion.
 *
 *   <CountUp value={1234} />
 *   <CountUp value={42}   durationMs={600} prefix="$" />
 */
export default function CountUp({
  value,
  from = 0,
  durationMs = 900,
  prefix = '',
  suffix = '',
  formatter,
}) {
  const [n, setN] = useState(from);
  const rafRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || value === from) {
      setN(value);
      return undefined;
    }

    const start = performance.now();
    const delta = value - from;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — smooth landing
      const eased = 1 - Math.pow(1 - t, 3);
      setN(from + delta * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, from, durationMs]);

  const display = formatter
    ? formatter(n)
    : Math.round(n).toLocaleString();

  return <span>{prefix}{display}{suffix}</span>;
}
