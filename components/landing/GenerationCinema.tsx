"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { id: 0, label: "Каркас" },
  { id: 1, label: "Hero" },
  { id: 2, label: "Блоки" },
  { id: 3, label: "Картинки" },
  { id: 4, label: "Готово" },
] as const;

const STEP_MS = 2200;

export function GenerationCinema() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, STEP_MS);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="wc-cinema" aria-hidden>
      <div className="wc-cinema-chrome">
        <span className="wc-cinema-dot" />
        <span className="wc-cinema-dot" />
        <span className="wc-cinema-dot" />
        <span className="wc-cinema-url">webcomet.ru / генерация</span>
      </div>

      <div className="wc-cinema-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="wc-cinema-step-label"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
          >
            {STEPS[step].label}
          </motion.div>
        </AnimatePresence>

        <div className="wc-cinema-site">
          <motion.div
            className="wc-cinema-nav"
            animate={{ opacity: step >= 0 ? 1 : 0.25 }}
            transition={{ duration: 0.4 }}
          >
            <span className="wc-cinema-brand-pill">ATELIER</span>
            <span className="wc-cinema-nav-links">
              <i />
              <i />
              <i />
            </span>
          </motion.div>

          <div className="wc-cinema-hero-row">
            <div className="wc-cinema-copy">
              <motion.h3
                animate={{
                  opacity: step >= 1 ? 1 : 0.15,
                  y: step >= 1 ? 0 : 8,
                }}
                transition={{ duration: 0.45 }}
              >
                Сайт, который
                <br />
                продаёт с первого экрана
              </motion.h3>
              <motion.p
                animate={{ opacity: step >= 1 ? 0.75 : 0 }}
                transition={{ duration: 0.45, delay: 0.08 }}
              >
                Секции, типографика и призыв — без дизайнера.
              </motion.p>
              <motion.span
                className="wc-cinema-cta"
                animate={{
                  opacity: step >= 4 ? 1 : step >= 1 ? 0.35 : 0,
                  scale: step >= 4 ? 1 : 0.96,
                }}
                transition={{ duration: 0.4 }}
              >
                Оставить заявку
              </motion.span>
            </div>

            <motion.div
              className="wc-cinema-visual"
              animate={{
                opacity: step >= 3 ? 1 : step >= 1 ? 0.2 : 0,
                scale: step >= 3 ? 1 : 0.94,
              }}
              transition={{ duration: 0.5 }}
            >
              <div className="wc-cinema-visual-shine" />
            </motion.div>
          </div>

          <div className="wc-cinema-cards">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="wc-cinema-card"
                animate={{
                  opacity: step >= 2 ? 1 : 0.08,
                  y: step >= 2 ? 0 : 14,
                }}
                transition={{ duration: 0.4, delay: step >= 2 ? i * 0.08 : 0 }}
              >
                <i />
                <b />
                <b className="short" />
              </motion.div>
            ))}
          </div>
        </div>

        <div className="wc-cinema-progress" role="presentation">
          {STEPS.map((s) => (
            <span
              key={s.id}
              className={
                s.id === step
                  ? "wc-cinema-progress-dot is-on"
                  : "wc-cinema-progress-dot"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
