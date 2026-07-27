"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { id: 0, label: "Каркас" },
  { id: 1, label: "Текст" },
  { id: 2, label: "Блоки" },
  { id: 3, label: "Картинки" },
  { id: 4, label: "Готово" },
] as const;

const STEP_MS = 2400;

const IMAGES = {
  hero: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
  card1: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80",
  card2: "https://images.unsplash.com/photo-1442512595331-e89e7384260c?auto=format&fit=crop&w=400&q=80",
  card3: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=400&q=80",
};

const CARDS = [
  { title: "Авторский эспрессо", text: "Зерно с обжаркой недели", img: IMAGES.card1 },
  { title: "Завтраки до 12:00", text: "Сырники, боулы, круассаны", img: IMAGES.card2 },
  { title: "Тихие столы", text: "Для работы и встреч", img: IMAGES.card3 },
];

export function GenerationCinema() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, STEP_MS);
    return () => window.clearInterval(t);
  }, []);

  const wire = step === 0;
  const hasText = step >= 1;
  const hasBlocks = step >= 2;
  const hasImages = step >= 3;
  const done = step >= 4;

  return (
    <div className={`wc-cinema${done ? " is-done" : ""}`} aria-hidden>
      <div className="wc-cinema-chrome">
        <span className="wc-cinema-dot" />
        <span className="wc-cinema-dot" />
        <span className="wc-cinema-dot" />
        <span className="wc-cinema-url">daily-cup.ru</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={step}
            className="wc-cinema-step-label"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
          >
            {STEPS[step].label}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className={`wc-cinema-stage${wire ? " is-wire" : ""}`}>
        <div className="wc-cinema-site wc-cinema-site--cafe">
          <motion.nav
            className="wc-cinema-nav"
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <span className={`wc-cinema-brand-pill${wire ? " is-wire" : ""}`}>
              {wire ? "" : "Daily Cup"}
            </span>
            <div className="wc-cinema-nav-links">
              {wire ? (
                <>
                  <i />
                  <i />
                  <i />
                </>
              ) : (
                <>
                  <span>Меню</span>
                  <span>О нас</span>
                  <span className={done ? "is-accent" : ""}>Контакты</span>
                </>
              )}
            </div>
          </motion.nav>

          <div className="wc-cinema-hero-row">
            <div className="wc-cinema-copy">
              <motion.h3
                animate={{
                  opacity: hasText ? 1 : wire ? 0.35 : 0,
                  y: hasText ? 0 : 10,
                }}
                transition={{ duration: 0.45 }}
                className={wire ? "is-wire-line" : undefined}
              >
                {wire ? (
                  <>
                    <span className="wc-cinema-skel skel-lg" />
                    <span className="wc-cinema-skel skel-md" />
                  </>
                ) : (
                  <>
                    Кофе и тишина
                    <br />
                    посреди города
                  </>
                )}
              </motion.h3>

              <motion.p
                animate={{ opacity: hasText ? 0.85 : 0, y: hasText ? 0 : 8 }}
                transition={{ duration: 0.4, delay: 0.06 }}
              >
                Авторская обжарка, завтраки и столы у окна. Забронируйте место
                за минуту.
              </motion.p>

              <motion.span
                className={`wc-cinema-cta${done ? " is-pop" : ""}`}
                animate={{
                  opacity: done ? 1 : hasText ? 0.45 : 0,
                  scale: done ? 1 : 0.96,
                  y: hasText || done ? 0 : 8,
                }}
                transition={{ duration: 0.4 }}
              >
                Забронировать стол
              </motion.span>
            </div>

            <motion.div
              className={`wc-cinema-visual${wire ? " is-wire" : ""}${hasImages ? " has-photo" : ""}`}
              animate={{
                opacity: wire || hasText || hasImages ? 1 : 0,
                scale: hasImages ? 1 : 0.97,
              }}
              transition={{ duration: 0.5 }}
            >
              {hasImages ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={IMAGES.hero} alt="" className="wc-cinema-photo" />
              ) : (
                <div className="wc-cinema-visual-placeholder">
                  {!wire && <span>фото</span>}
                </div>
              )}
              {done && <div className="wc-cinema-visual-glow" />}
            </motion.div>
          </div>

          <div className="wc-cinema-cards">
            {CARDS.map((card, i) => (
              <motion.article
                key={card.title}
                className={`wc-cinema-card${wire ? " is-wire" : ""}`}
                animate={{
                  opacity: hasBlocks || wire ? 1 : 0,
                  y: hasBlocks ? 0 : wire ? 0 : 16,
                }}
                transition={{
                  duration: 0.4,
                  delay: hasBlocks ? i * 0.1 : 0,
                }}
              >
                <div
                  className={`wc-cinema-card-media${hasImages ? " has-photo" : ""}`}
                >
                  {hasImages ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.img} alt="" />
                  ) : null}
                </div>
                {wire ? (
                  <>
                    <span className="wc-cinema-skel skel-sm" />
                    <span className="wc-cinema-skel skel-xs" />
                  </>
                ) : (
                  <>
                    <strong>{card.title}</strong>
                    <p>{card.text}</p>
                  </>
                )}
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
