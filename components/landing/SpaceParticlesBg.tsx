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
          particleColors={["#ffffff", "#c4b5fd", "#7dd3fc", "#a78bfa"]}
          particleCount={220}
          particleSpread={10}
          speed={0.08}
          particleBaseSize={90}
          moveParticlesOnHover
          particleHoverFactor={0.55}
          alphaParticles
          disableRotation={false}
          pixelRatio={1}
          sizeRandomness={0.85}
          cameraDistance={22}
        />
      </div>
      <div className="wc-space-veil" />
    </div>
  );
}
