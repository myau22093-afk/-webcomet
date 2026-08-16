"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, Crown, Loader2, Mic, MicOff, Zap } from "lucide-react";
import { SpaceParticlesBg } from "@/components/landing/SpaceParticlesBg";
import StrokeText from "@/components/landing/StrokeText";
import {
  LandingPalettePicker,
  LandingTypewriter,
} from "@/components/landing/LandingPalettePicker";
import { StudioIconRail } from "@/components/studio/StudioIconRail";
import { InlineAuthModal } from "@/components/studio/InlineAuthModal";
import { getSupabase } from "@/lib/supabaseClient";
import { getTokenCost } from "@/lib/tokenConfig";
import {
  WIZARD_PALETTES,
  WIZARD_RESUME_KEY,
  WIZARD_STORAGE_KEY,
  detectNicheFromTopic,
  emptyWizardBrief,
  extractCityFromTopic,
  isBriefReady,
  joinSeoPhrases,
  suggestSeoPhrases,
  type WizardBrief,
  type WizardPalette,
  type WizardTier,
} from "@/lib/wizardBrief";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  animate?: boolean;
};

type Phase =
  | "idle"
  | "topic"
  | "company"
  | "palette"
  | "tier"
  | "ready";

const LANDING_CHAT_KEY = "wc-landing-chat-v1";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadBrief(): WizardBrief {
  try {
    const landing = localStorage.getItem(LANDING_CHAT_KEY);
    if (landing) {
      const data = JSON.parse(landing) as { brief?: WizardBrief; messages?: Msg[] };
      if (data.brief && Array.isArray(data.messages) && data.messages.length) {
        return { ...emptyWizardBrief(), ...data.brief };
      }
    }
  } catch {
    /* ignore */
  }
  return emptyWizardBrief();
}

function saveBrief(brief: WizardBrief, messages: Msg[]) {
  try {
    // Только лендинг-чат. Не затираем result/preview студии в wc-wizard-v3.
    localStorage.setItem(
      LANDING_CHAT_KEY,
      JSON.stringify({ messages, brief, phaseHint: brief.topic ? "topic" : "idle" })
    );
  } catch {
    /* ignore */
  }
}

function saveWizardForStudio(brief: WizardBrief, messages: Msg[]) {
  try {
    let prev: Record<string, unknown> = {};
    try {
      const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
      if (raw) prev = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      prev = {};
    }
    localStorage.setItem(
      WIZARD_STORAGE_KEY,
      JSON.stringify({
        ...prev,
        brief,
        bubbles: messages.map((m) => ({
          id: m.id,
          kind: "text" as const,
          role: m.role,
          content: m.content,
        })),
      })
    );
    localStorage.setItem(
      LANDING_CHAT_KEY,
      JSON.stringify({ messages, brief, phaseHint: brief.topic ? "topic" : "idle" })
    );
  } catch {
    /* ignore */
  }
}

function replyFor(
  phase: Phase,
  text: string,
  brief: WizardBrief
): { next: WizardBrief; phase: Phase; reply: string } {
  const t = text.trim();
  const next = { ...brief };

  if (phase === "idle" || phase === "topic" || !next.topic) {
    next.topic = t;
    next.nicheId = detectNicheFromTopic(t);
    const city = extractCityFromTopic(t);
    if (city) next.city = city;
    next.seoFocus = joinSeoPhrases(suggestSeoPhrases(next));
    return {
      next,
      phase: "company",
      reply: "Ок. Как называется компания или бренд?",
    };
  }

  if (phase === "company" || next.companyName.trim().length < 2) {
    next.companyName = t.slice(0, 80);
    next.detailsConfirmed = true;
    next.sectionsConfirmed = true;
    next.assetsConfirmed = true;
    next.useSettingsContacts = false;
    return {
      next,
      phase: "palette",
      reply: "Выбери палитру ниже.",
    };
  }

  if (phase === "palette" || !next.paletteId) {
    const lower = t.toLowerCase();
    const pal =
      WIZARD_PALETTES.find(
        (p) =>
          lower.includes(p.label.toLowerCase()) ||
          lower.includes(p.id) ||
          (p.id === "violet" && (lower.includes("фиолет") || lower.includes("фиол"))) ||
          (p.id === "ocean" && (lower.includes("син") || lower.includes("океан"))) ||
          (p.id === "forest" && (lower.includes("зел"))) ||
          (p.id === "sunset" && (lower.includes("тёпл") || lower.includes("тепл") || lower.includes("оранж"))) ||
          (p.id === "mono" && (lower.includes("моно") || lower.includes("чёрн") || lower.includes("черн")))
      ) ?? WIZARD_PALETTES[0];
    next.paletteId = pal.id;
    next.colors = [...pal.colors];
    return {
      next,
      phase: "tier",
      reply: "Какой уровень: простой или премиум?",
    };
  }

  if (phase === "tier" || !next.tier) {
    const lower = t.toLowerCase();
    next.tier = lower.includes("прем") ? "premium" : "simple";
    next.photosConfirmed = true;
    return {
      next,
      phase: "ready",
      reply: "Готово. Жми «Создать сайт».",
    };
  }

  next.notes = [next.notes, t].filter(Boolean).join("\n");
  return {
    next,
    phase: "ready",
    reply: "Ок.",
  };
}

type Props = {
  loggedIn: boolean;
  userEmail?: string | null;
  onAuthSuccess?: () => void;
};

export function LandingChat({
  loggedIn,
  userEmail = null,
  onAuthSuccess,
}: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [brief, setBrief] = useState<WizardBrief>(() => emptyWizardBrief());
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("register");
  const [listening, setListening] = useState(false);
  const [palettePanel, setPalettePanel] = useState(false);
  const [tierPanel, setTierPanel] = useState(false);
  const [pendingPanel, setPendingPanel] = useState<"palette" | "tier" | null>(
    null
  );
  const [railExpanded, setRailExpanded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<{ stop: () => void } | null>(null);

  const ready = useMemo(() => isBriefReady(brief), [brief]);

  useEffect(() => {
    try {
      // Гостям не восстанавливаем старый чат — только чистый старт.
      // Залогиненным можно продолжить незавершённый бриф.
      if (!loggedIn) {
        setBrief(emptyWizardBrief());
        setMessages([]);
        setPhase("idle");
        return;
      }
      const raw = localStorage.getItem(LANDING_CHAT_KEY);
      if (raw) {
        const data = JSON.parse(raw) as {
          messages?: Msg[];
          brief?: WizardBrief;
        };
        if (Array.isArray(data.messages) && data.messages.length) {
          const b = data.brief
            ? { ...emptyWizardBrief(), ...data.brief }
            : loadBrief();
          setBrief(b);
          setMessages(data.messages.map((m) => ({ ...m, animate: false })));
          if (isBriefReady(b)) setPhase("ready");
          else if (!b.topic) setPhase("idle");
          else if (b.companyName.trim().length < 2) setPhase("company");
          else if (!b.paletteId) {
            setPhase("palette");
            setPalettePanel(true);
          } else if (!b.tier) {
            setPhase("tier");
            setTierPanel(true);
          } else setPhase("ready");
          return;
        }
      }
      setBrief(emptyWizardBrief());
      setMessages([]);
      setPhase("idle");
    } catch {
      /* ignore */
    }
  }, [loggedIn]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, phase, brief.paletteId, palettePanel, tierPanel]);

  function persist(nextBrief: WizardBrief, nextMessages: Msg[]) {
    setBrief(nextBrief);
    setMessages(nextMessages);
    saveBrief(nextBrief, nextMessages);
  }

  function finishAnimate(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, animate: false } : m))
    );
    setPendingPanel((panel) => {
      if (panel === "palette") setPalettePanel(true);
      if (panel === "tier") setTierPanel(true);
      return null;
    });
  }

  function pushAssistant(
    nextBrief: WizardBrief,
    baseMessages: Msg[],
    reply: string,
    nextPhase: Phase
  ) {
    const botMsg: Msg = {
      id: uid(),
      role: "assistant",
      content: reply,
      animate: true,
    };
    const nextMessages = [...baseMessages, botMsg];
    setPhase(nextPhase);
    if (nextPhase === "palette") {
      setPalettePanel(false);
      setTierPanel(false);
      setPendingPanel("palette");
    } else if (nextPhase === "tier") {
      setPalettePanel(false);
      setTierPanel(false);
      setPendingPanel("tier");
    } else {
      setPendingPanel(null);
    }
    persist(nextBrief, nextMessages);
    setBusy(false);
  }

  function applyPalette(
    pal: WizardPalette | { id: string; label: string; colors: string[] }
  ) {
    if (busy || brief.paletteId) return;
    const nextBrief: WizardBrief = {
      ...brief,
      paletteId: pal.id,
      colors: [...pal.colors],
    };
    setBrief(nextBrief);
    setPalettePanel(false);
    setBusy(true);
    window.setTimeout(() => {
      pushAssistant(
        nextBrief,
        messages,
        `Отлично, берём «${pal.label}». Выбери уровень сайта.`,
        "tier"
      );
    }, 350);
  }

  function pickTier(tier: WizardTier) {
    if (busy || brief.tier) return;
    const nextBrief: WizardBrief = {
      ...brief,
      tier,
      photosConfirmed: true,
    };
    setTierPanel(false);
    setBusy(true);
    window.setTimeout(() => {
      pushAssistant(
        nextBrief,
        messages,
        "Готово. Жми «Создать сайт».",
        "ready"
      );
    }, 280);
  }

  function onCreate() {
    saveWizardForStudio(brief, messages);
    try {
      localStorage.setItem(WIZARD_RESUME_KEY, "1");
    } catch {
      /* ignore */
    }
    if (loggedIn) {
      window.location.assign("/dashboard");
      return;
    }
    setAuthOpen(true);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    if (phase === "tier" && !brief.tier) return;
    if (phase === "palette" && !brief.paletteId) return;
    setBusy(true);
    setInput("");
    const userMsg: Msg = { id: uid(), role: "user", content: message };
    const withUser = [...messages, userMsg];
    setMessages(withUser);

    await new Promise((r) => setTimeout(r, 420));
    const { next, phase: nextPhase, reply } = replyFor(phase, message, brief);
    pushAssistant(next, withUser, reply, nextPhase);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function toggleVoice() {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        start: () => void;
        stop: () => void;
        onresult: ((ev: {
          results: ArrayLike<{ 0: { transcript: string } }>;
        }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        start: () => void;
        stop: () => void;
        onresult: ((ev: {
          results: ArrayLike<{ 0: { transcript: string } }>;
        }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
      };
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      speechRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "ru-RU";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript ?? "";
      if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    speechRef.current = rec;
    setListening(true);
    rec.start();
  }

  const empty = messages.length === 0;
  const showRail = messages.length > 0 || loggedIn;

  return (
    <div
      className={`wc-lovable wc-lovable-shell relative ${
        showRail && railExpanded ? "has-rail-expanded" : ""
      }`}
    >
      <SpaceParticlesBg />

      {railExpanded && showRail ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          aria-label="Закрыть меню"
          onClick={() => setRailExpanded(false)}
        />
      ) : null}

      <StudioIconRail
        visible={showRail}
        expanded={railExpanded}
        onExpandedChange={setRailExpanded}
        loggedIn={loggedIn}
        userEmail={userEmail}
        activeId="studio"
        onSelectStudio={() => setRailExpanded(false)}
        onSelectSettings={() => {
          if (!loggedIn) {
            setAuthTab("login");
            setAuthOpen(true);
            return;
          }
          window.location.assign("/dashboard?mode=settings");
        }}
        onAuthClick={() => {
          setAuthTab("login");
          setAuthOpen(true);
        }}
        onSignOut={() => {
          void getSupabase()
            .auth.signOut()
            .then(() => {
              onAuthSuccess?.();
            });
        }}
      />

      <div
        className={`wc-lovable-shell-main relative z-10 ${showRail ? "has-rail" : ""}`}
      >
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        {!showRail ? (
          <Link href="/" className="wc-lovable-mark" aria-label="WebComet.ru">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="wc-lovable-mark-badge"
              src="/wc-mark.png?v=4"
              alt=""
              width={40}
              height={40}
              decoding="async"
            />
            <span className="wc-lovable-mark-text">
              <span className="wc-lovable-mark-name">WebComet</span>
              <span className="wc-lovable-mark-tld">.ru</span>
            </span>
          </Link>
        ) : (
          <span className="wc-lovable-mark-text text-white/90">
            <span className="wc-lovable-mark-name">Студия</span>
          </span>
        )}
        <nav className="flex items-center gap-2">
          {loggedIn ? null : (
            <>
              <button
                type="button"
                className="wc-lovable-link"
                onClick={() => {
                  setAuthTab("login");
                  setAuthOpen(true);
                }}
              >
                Войти
              </button>
              <button
                type="button"
                className="wc-lovable-btn-dark"
                onClick={() => {
                  setAuthTab("register");
                  setAuthOpen(true);
                }}
              >
                Регистрация
              </button>
            </>
          )}
        </nav>
      </header>

      <main
        className={`relative z-10 mx-auto flex w-full max-w-[42rem] flex-1 flex-col px-4 sm:px-6 ${
          empty ? "wc-lovable-stage-empty" : "wc-lovable-stage-chat"
        }`}
      >
        {empty ? (
          <div className="wc-lovable-hero">
            <h1 className="wc-lovable-title wc-lovable-title-stroke">
              <StrokeText
                text="Собери сайт в чате"
                strokeColor="#A78BFA"
                fillColor="#F8FAFC"
                strokeWidth={2.2}
                drawDuration={1.35}
                fillDelay={0.12}
                stagger={0.045}
                fillMode="wipe"
                trigger="mount"
                fontSize={72}
                fontWeight={750}
                letterSpacing={-2.5}
                fontFamily="Syne, Plus Jakarta Sans, sans-serif"
              />
            </h1>
            <p className="wc-lovable-lead">
              Опиши идею — уточним детали и соберём лендинг.
            </p>
          </div>
        ) : (
          <div className="mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-white/12 text-white backdrop-blur-md"
                      : "bg-white/10 text-zinc-100 shadow-sm backdrop-blur-md ring-1 ring-white/10"
                  }`}
                >
                  {m.role === "assistant" && m.animate ? (
                    <LandingTypewriter
                      text={m.content}
                      onDone={() => finishAnimate(m.id)}
                    />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {busy && !messages.some((m) => m.animate) && !palettePanel && !tierPanel ? (
              <div className="inline-flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Печатаю…
              </div>
            ) : null}
            {palettePanel ? (
              <LandingPalettePicker
                selectedId={brief.paletteId}
                locked={Boolean(brief.paletteId)}
                onPick={(p) => applyPalette(p)}
                onPickCustom={(colors) =>
                  applyPalette({
                    id: "custom",
                    label: "Свой",
                    colors,
                  })
                }
              />
            ) : null}
            {tierPanel && !brief.tier ? (
              <div className="wc-landing-tier">
                <p className="wc-landing-tier-title">Какой уровень сайта?</p>
                <button
                  type="button"
                  className="wc-landing-tier-btn"
                  disabled={busy}
                  onClick={() => pickTier("simple")}
                >
                  <span className="wc-landing-tier-ico">
                    <Zap className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[14px] text-zinc-100">
                      Простой · −{getTokenCost("gpt-5.6-sol")} ток.
                    </span>
                    <span className="mt-1 block text-[12px] leading-relaxed text-zinc-500">
                      Чистый современный лендинг. Быстрее и дешевле.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="wc-landing-tier-btn is-premium"
                  disabled={busy}
                  onClick={() => pickTier("premium")}
                >
                  <span className="wc-landing-tier-ico">
                    <Crown className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[14px] text-violet-50">
                      Премиум · −{getTokenCost("claude-fable-5")} ток.
                    </span>
                    <span className="mt-1 block text-[12px] leading-relaxed text-violet-200/70">
                      Сильнее дизайн и анимации.
                    </span>
                  </span>
                </button>
              </div>
            ) : null}
            {brief.paletteId && !palettePanel ? (
              <div className="wc-space-pal-chosen">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Палитра:{" "}
                {WIZARD_PALETTES.find((p) => p.id === brief.paletteId)?.label ??
                  (brief.paletteId === "custom" ? "Свой" : brief.paletteId)}
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        )}

        <div className="wc-lovable-dock">
          <form onSubmit={onSubmit} className="wc-lovable-composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                empty
                  ? "Например: кофейня в центре Москвы…"
                  : phase === "company"
                    ? "Название компании…"
                    : phase === "palette"
                      ? "Выбери палитру выше…"
                      : phase === "tier"
                        ? "Выбери уровень выше…"
                        : "Напиши сообщение…"
              }
              className="wc-lovable-input"
              disabled={
                busy ||
                (phase === "palette" && !brief.paletteId) ||
                (phase === "tier" && !brief.tier)
              }
            />
            <div className="flex items-center gap-1.5 pr-1.5">
              <button
                type="button"
                onClick={toggleVoice}
                className={`wc-lovable-icon-btn ${listening ? "is-on" : ""}`}
                title="Голос"
                aria-label="Голос"
              >
                {listening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
              {ready ? (
                <button
                  type="button"
                  onClick={onCreate}
                  className="wc-lovable-build"
                >
                  Создать сайт
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="wc-lovable-send"
                  aria-label="Отправить"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
              {!empty ? (
                <button
                  type="button"
                  className="wc-lovable-link"
                  onClick={() => {
                    try {
                      localStorage.removeItem(LANDING_CHAT_KEY);
                      localStorage.removeItem(WIZARD_STORAGE_KEY);
                      localStorage.removeItem(WIZARD_RESUME_KEY);
                    } catch {
                      /* ignore */
                    }
                    setMessages([]);
                    setBrief(emptyWizardBrief());
                    setPhase("idle");
                    setPalettePanel(false);
                    setTierPanel(false);
                    setPendingPanel(null);
                    setRailExpanded(false);
                    setInput("");
                    setBusy(false);
                    setAuthOpen(false);
                    setListening(false);
                    speechRef.current?.stop();
                  }}
                >
                  Заново
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </main>
      </div>

      <InlineAuthModal
        open={authOpen}
        initialTab={authTab}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          saveWizardForStudio(brief, messages);
          try {
            localStorage.setItem(WIZARD_RESUME_KEY, "1");
          } catch {
            /* ignore */
          }
          onAuthSuccess?.();
          window.location.assign("/dashboard");
        }}
      />
    </div>
  );
}
