"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  LANDING_DEMOS,
  type LandingDemo,
  writeWizardSeed,
} from "@/lib/landingShowcase";
import { WIZARD_STORAGE_KEY } from "@/lib/wizardBrief";

type Props = {
  loggedIn: boolean;
};

function DemoThumb({
  demo,
  size = "card",
}: {
  demo: LandingDemo;
  size?: "card" | "modal";
}) {
  const vars = {
    "--demo-accent": demo.accent,
    "--demo-surface": demo.surface,
    "--demo-muted": demo.muted,
  } as CSSProperties;
  const [g0, g1, g2] = demo.gallery;

  return (
    <div
      className={`wc-demo-thumb layout-${demo.layoutId}${size === "modal" ? " wc-demo-thumb--modal" : ""}`}
      style={vars}
    >
      <div className="wc-demo-thumb-chrome">
        <span />
        <span />
        <span />
        <em>{demo.brand.toLowerCase()}.ru</em>
      </div>

      {demo.layoutId === "hero-center" ? (
        <div className="wc-demo-thumb-site">
          <div className="wc-demo-thumb-nav">
            <strong>{demo.brand}</strong>
            <span className="wc-demo-pill" style={{ background: demo.accent }}>
              {demo.navCta}
            </span>
          </div>
          <div className="wc-demo-center-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={demo.image} alt="" />
            <div className="wc-demo-center-copy">
              <b>{demo.headline}</b>
              <span className="wc-demo-pill" style={{ background: demo.accent }}>
                {demo.heroCta}
              </span>
            </div>
          </div>
          <div className="wc-demo-thumb-rows">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g0} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g1} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g2} alt="" />
          </div>
        </div>
      ) : demo.layoutId === "stack-cards" ? (
        <div className="wc-demo-thumb-site">
          <div className="wc-demo-thumb-nav">
            <strong>{demo.brand}</strong>
            <span className="wc-demo-pill" style={{ background: demo.accent }}>
              {demo.navCta}
            </span>
          </div>
          <div className="wc-demo-stack-head">
            <b>{demo.headline}</b>
            <span className="wc-demo-pill" style={{ background: demo.accent }}>
              {demo.heroCta}
            </span>
          </div>
          <div className="wc-demo-stack-list">
            {[g0, g1, g2].map((src) => (
              <div key={src} className="wc-demo-stack-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
                <i />
              </div>
            ))}
          </div>
        </div>
      ) : demo.layoutId === "editorial" ? (
        <div className="wc-demo-thumb-site">
          <div className="wc-demo-thumb-nav">
            <strong>{demo.brand}</strong>
            <span className="wc-demo-pill" style={{ background: demo.accent }}>
              {demo.navCta}
            </span>
          </div>
          <div className="wc-demo-editorial-head">
            <b>{demo.headline}</b>
          </div>
          <div className="wc-demo-editorial-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={demo.image} alt="" />
          </div>
          <div className="wc-demo-editorial-cols">
            {[g0, g1, g2].map((src, i) => (
              <div key={src}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
                <em>0{i + 1}</em>
              </div>
            ))}
          </div>
          <span
            className="wc-demo-pill wc-demo-pill-sm"
            style={{ background: demo.accent }}
          >
            {demo.heroCta}
          </span>
        </div>
      ) : (
        <div className="wc-demo-thumb-site">
          <div className="wc-demo-thumb-nav">
            <strong>{demo.brand}</strong>
            <span className="wc-demo-pill" style={{ background: demo.accent }}>
              {demo.navCta}
            </span>
          </div>
          <div className="wc-demo-thumb-hero">
            <div className="wc-demo-thumb-copy">
              <b>{demo.headline}</b>
              <span className="wc-demo-pill" style={{ background: demo.accent }}>
                {demo.heroCta}
              </span>
            </div>
            <div className="wc-demo-thumb-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={demo.image} alt="" />
            </div>
          </div>
          <div className="wc-demo-thumb-rows">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g0} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g1} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g2} alt="" />
          </div>
        </div>
      )}
    </div>
  );
}

function startDemo(demo: LandingDemo, loggedIn: boolean) {
  try {
    localStorage.removeItem(WIZARD_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  writeWizardSeed({
    topic: demo.topic,
    nicheId: demo.nicheId,
    demoId: demo.id,
    structureLayoutId: demo.layoutId,
  });
  window.location.href = loggedIn
    ? "/dashboard"
    : "/register?next=/dashboard";
}

export function ShowcaseStrip({ loggedIn }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<LandingDemo | null>(null);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const blockWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    el.addEventListener("wheel", blockWheel, { passive: false });
    return () => el.removeEventListener("wheel", blockWheel);
  }, []);

  function scrollByDir(dir: -1 | 1) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.min(360, el.clientWidth * 0.7),
      behavior: "smooth",
    });
  }

  return (
    <section className="wc-showcase" aria-labelledby="wc-showcase-title">
      <div className="wc-showcase-head">
        <div>
          <p className="wc-showcase-kicker">Витрина</p>
          <h2 id="wc-showcase-title" className="wc-showcase-title">
            Выбери стиль — соберём похожий
          </h2>
          <p className="wc-showcase-sub">
            Живые примеры ниш. «Сделать такой» — Студия берёт эту тему и тот же
            каркас layout, что на превью.
          </p>
        </div>
        <div className="wc-showcase-nav">
          <button
            type="button"
            className="wc-showcase-nav-btn"
            onClick={() => scrollByDir(-1)}
            aria-label="Назад"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="wc-showcase-nav-btn"
            onClick={() => scrollByDir(1)}
            aria-label="Вперёд"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div ref={railRef} className="wc-showcase-rail">
        {LANDING_DEMOS.map((demo, i) => (
          <motion.button
            key={demo.id}
            type="button"
            className="wc-showcase-card"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.3) }}
            onClick={() => setActive(demo)}
          >
            <DemoThumb demo={demo} />
            <div className="wc-showcase-meta">
              <span className="wc-showcase-tag">{demo.tag}</span>
              <strong>{demo.niche}</strong>
              <span>{demo.headline}</span>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            className="wc-demo-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label={active.niche}
            onClick={() => setActive(null)}
          >
            <motion.div
              className="wc-demo-modal-panel"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="wc-demo-modal-close"
                onClick={() => setActive(null)}
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>

              <DemoThumb demo={active} size="modal" />

              <div className="wc-demo-modal-actions">
                <div>
                  <p className="wc-showcase-tag">{active.tag}</p>
                  <h3>{active.niche}</h3>
                  <p>
                    {active.title} · каркас «{active.layoutId}» уйдёт в Студию
                    как есть
                  </p>
                </div>
                <button
                  type="button"
                  className="wc-btn wc-btn-glow min-h-12 px-6"
                  onClick={() => startDemo(active, loggedIn)}
                >
                  Сделать такой
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
