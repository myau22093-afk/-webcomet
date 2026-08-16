"use client";

import { useEffect, useRef } from "react";

/**
 * Мягкий aurora-фон: размытые пятна + лёгкий сдвиг к курсору.
 * Не яркий, не «неон» — как у Lovable, но с реакцией на мышь.
 */
export function AuroraCursorBg() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let raf = 0;
    let tx = 0.5;
    let ty = 0.45;
    let cx = tx;
    let cy = ty;

    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      tx = e.clientX / w;
      ty = e.clientY / h;
    };

    const tick = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      root.style.setProperty("--ax", `${(cx * 100).toFixed(2)}%`);
      root.style.setProperty("--ay", `${(cy * 100).toFixed(2)}%`);
      raf = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rootRef} className="wc-aurora" aria-hidden>
      <div className="wc-aurora-base" />
      <div className="wc-aurora-blob wc-aurora-blob-a" />
      <div className="wc-aurora-blob wc-aurora-blob-b" />
      <div className="wc-aurora-blob wc-aurora-blob-c" />
      <div className="wc-aurora-veil" />
    </div>
  );
}
