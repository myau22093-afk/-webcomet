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

function DemoThumb({ demo }: { demo: LandingDemo }) {
  return (
    <div
      className="wc-demo-thumb"
      style={
        {
          "--demo-accent": demo.accent,
          "--demo-surface": demo.surface,
          "--demo-muted": demo.muted,
        } as CSSProperties
      }
    >
      <div className="wc-demo-thumb-chrome">
        <span />
        <span />
        <span />
        <em>{demo.brand.toLowerCase()}.ru</em>
      </div>
      <div className="wc-demo-thumb-site">
        <div className="wc-demo-thumb-nav">
          <strong>{demo.brand}</strong>
          <em style={{ background: demo.accent }} />
        </div>
        <div className="wc-demo-thumb-hero">
          <div className="wc-demo-thumb-copy">
            <b>{demo.headline}</b>
            <i style={{ background: demo.accent }} />
          </div>
          <div className="wc-demo-thumb-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={demo.image} alt="" />
          </div>
        </div>
        <div className="wc-demo-thumb-rows">
          <span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={demo.image} alt="" />
          </span>
          <span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={demo.image} alt="" />
          </span>
          <span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={demo.image} alt="" />
          </span>
        </div>
      </div>
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
            Живые примеры ниш. Открой превью и нажми «Сделать такой» — Мастер
            стартует с этой темой.
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

              <div
                className="wc-demo-modal-preview"
                style={
                  {
                    "--demo-accent": active.accent,
                    "--demo-surface": active.surface,
                    "--demo-muted": active.muted,
                  } as CSSProperties
                }
              >
                <div className="wc-demo-modal-chrome">
                  <span />
                  <span />
                  <span />
                  <em>{active.brand.toLowerCase()}.ru</em>
                </div>
                <div className="wc-demo-modal-site">
                  <header>
                    <strong>{active.brand}</strong>
                    <button type="button" tabIndex={-1}>
                      Связаться
                    </button>
                  </header>
                  <div className="wc-demo-modal-hero">
                    <div>
                      <h3>{active.headline}</h3>
                      <p>
                        Пример лендинга в нише «{active.niche}». Структура,
                        акценты и блоки — то, что Мастер соберёт под ваш бренд.
                      </p>
                      <span>Оставить заявку</span>
                    </div>
                    <aside className="wc-demo-modal-aside">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={active.image} alt="" />
                    </aside>
                  </div>
                  <div className="wc-demo-modal-grid">
                    <article>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={active.image} alt="" />
                      <p>Услуга 1</p>
                    </article>
                    <article>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={active.image} alt="" />
                      <p>Услуга 2</p>
                    </article>
                    <article>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={active.image} alt="" />
                      <p>Услуга 3</p>
                    </article>
                  </div>
                </div>
              </div>

              <div className="wc-demo-modal-actions">
                <div>
                  <p className="wc-showcase-tag">{active.tag}</p>
                  <h3>{active.niche}</h3>
                  <p>{active.title}</p>
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
