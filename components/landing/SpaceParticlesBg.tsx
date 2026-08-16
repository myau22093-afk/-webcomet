"use client";

import dynamic from "next/dynamic";

const Particles = dynamic(() => import("./Particles"), { ssr: false });

/** Космический фон: тёмная глубина + звёздные частицы. */
export function SpaceParticlesBg() {
  return (
    <div className="wc-space" aria-hidden>
      <div className="wc-space-base" />
      <div className="wc-space-glow wc-space-glow-a" />
      <div className="wc-space-glow wc-space-glow-b" />
      <div className="wc-space-particles">
        <Particles
          particleColors={[
            "#ffffff",
            "#f8fafc",
            "#e0e7ff",
            "#c4b5fd",
            "#a78bfa",
            "#7dd3fc",
            "#bae6fd",
          ]}
          particleCount={620}
          particleSpread={12}
          speed={0.06}
          particleBaseSize={140}
          moveParticlesOnHover
          particleHoverFactor={0.4}
          alphaParticles
          disableRotation={false}
          pixelRatio={typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1.5}
          sizeRandomness={1.1}
          cameraDistance={18}
        />
      </div>
      <div className="wc-space-veil" />
    </div>
  );
}
