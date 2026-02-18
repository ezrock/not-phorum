'use client';

import { useEffect } from 'react';

interface RetroFilterProps {
  enabled: boolean;
}

export function RetroFilter({ enabled }: RetroFilterProps) {
  useEffect(() => {
    document.body.classList.toggle('retro-enabled', enabled);

    return () => {
      document.body.classList.remove('retro-enabled');
    };
  }, [enabled]);

  return (
    <>
      <svg aria-hidden="true" focusable="false" className="retro-filter-defs">
        <defs>
          <filter id="crt" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves={3}
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix in="noise" type="saturate" values="0.8" result="noiseColor" />
            <feBlend in="SourceGraphic" in2="noiseColor" mode="multiply" />
          </filter>
        </defs>
      </svg>

      {enabled && (
        <div className="retro-overlay" aria-hidden="true">
          <div className="retro-overlay-scanlines" />
          <div className="retro-overlay-noise" />
          <div className="retro-overlay-vignette" />
        </div>
      )}
    </>
  );
}
