// TA-AUD-001, NFR-011 — US-2.18. A brief celebratory burst behind the star
// display. prefers-reduced-motion disables the animation but keeps the
// stars themselves rendering (NFR-011 / TS-E-013: static content stays,
// particle effects don't).

import { useId } from 'react';

export function RewardBurst() {
  const id = useId().replace(/:/g, '');
  return (
    <span aria-hidden="true" style={{ position: 'relative', display: 'inline-block' }}>
      <style>{`
        @keyframes reward-burst-${id} {
          0% { transform: scale(0.3); opacity: 0; }
          40% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        .reward-burst-${id} {
          position: absolute;
          inset: -0.5em;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 214, 92, 0.55), transparent 70%);
          animation: reward-burst-${id} 700ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .reward-burst-${id} { animation: none; display: none; }
        }
      `}</style>
      <span className={`reward-burst-${id}`} />
    </span>
  );
}
