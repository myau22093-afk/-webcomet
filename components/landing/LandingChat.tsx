"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, Crown, ImagePlus, Loader2, Mic, MicOff, Zap } from "lucide-react";
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
import { getTemplateById } from "@/lib/siteTemplates";
import {
  AD_NICHE_IDS,
  LANDING_AD_FLOW_ENABLED,
  LANDING_CHAT_STORAGE_KEY,
} from "@/lib/landingAdFlow";
import { trackEvent } from "@/components/analytics/WebCometAnalytics";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  animate?: boolean;
};

type Phase =
  | "idle"
  | "niche"
  | "topic"
  | "details"
  | "palette"
  | "tier"
  | "photos"
  | "ready";

const LANDING_CHAT_KEY = LANDING_CHAT_STORAGE_KEY;

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

function saveBrief(brief: WizardBrief, messages: Msg[], phase?: Phase) {
  try {
    localStorage.setItem(
      LANDING_CHAT_KEY,
      JSON.stringify({
        messages,
        brief,
        phaseHint: phase ?? (brief.topic ? "topic" : "idle"),
      })
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
      phase: "details",
      reply: "Заполни данные ниже — название, телефон, почту и пожелания.",
    };
  }

  if (phase === "details" || !next.detailsConfirmed) {
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
  const [paletteStream, setPaletteStream] = useState(false);
  const [detailsPanel, setDetailsPanel] = useState(false);
  const [tierPanel, setTierPanel] = useState(false);
  const [nichePanel, setNichePanel] = useState(false);
  const [photosPanel, setPhotosPanel] = useState(false);
  const [pendingPanel, setPendingPanel] = useState<
    "niche" | "details" | "palette" | "tier" | "photos" | null
  >(null);
  const [hydrated, setHydrated] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);
  const speechRef = useRef<{ stop: () => void } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const adNiches = useMemo(
    () =>
      AD_NICHE_IDS.map((id) => {
        const t = getTemplateById(id);
        return { id, label: t?.name ?? id };
      }),
    []
  );

  function scrollChatEnd(smooth = false) {
    endRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "nearest",
    });
  }

  const ready = useMemo(() => isBriefReady(brief), [brief]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const briefRef = useRef(brief);
  briefRef.current = brief;

  function applyRestoredPhase(b: WizardBrief) {
    setNichePanel(false);
    setDetailsPanel(false);
    setPalettePanel(false);
    setPaletteStream(false);
    setTierPanel(false);
    setPhotosPanel(false);
    setPendingPanel(null);

    if (LANDING_AD_FLOW_ENABLED) {
      if (!b.nicheId || !b.topic) {
        setPhase("niche");
        return;
      }
      setNichePanel(true);
      if (!b.detailsConfirmed || b.companyName.trim().length < 2) {
        setPhase("details");
        setDetailsPanel(true);
        return;
      }
      setDetailsPanel(true);
      if (!b.paletteId) {
        setPhase("palette");
        setPalettePanel(true);
        return;
      }
      setPalettePanel(true);
      if (!b.tier) {
        setPhase("tier");
        setTierPanel(true);
        return;
      }
      setTierPanel(true);
      if (!b.photosConfirmed) {
        setPhase("photos");
        setPhotosPanel(true);
        return;
      }
      setPhotosPanel(true);
      setPhase("ready");
      return;
    }

    if (!b.topic) {
      setPhase("idle");
      return;
    }
    if (!b.detailsConfirmed || b.companyName.trim().length < 2) {
      setPhase("details");
      setDetailsPanel(true);
      return;
    }
    setDetailsPanel(true);
    if (!b.paletteId) {
      setPhase("palette");
      setPaletteStream(false);
      setPalettePanel(true);
      return;
    }
    setPalettePanel(true);
    if (!b.tier) {
      setPhase("tier");
      setTierPanel(true);
      return;
    }
    setTierPanel(true);
    setPhase("ready");
  }

  useEffect(() => {
    try {
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
          applyRestoredPhase(b);
          setHydrated(true);
          return;
        }
      }
      setBrief(emptyWizardBrief());
      setMessages([]);
      setPhase(LANDING_AD_FLOW_ENABLED ? "niche" : "idle");
      setNichePanel(false);
      setDetailsPanel(false);
      setPalettePanel(false);
      setPaletteStream(false);
      setTierPanel(false);
      setPhotosPanel(false);
      setPendingPanel(null);
    } catch {
      /* ignore */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveBrief(brief, messages, phase);
  }, [hydrated, brief, messages, phase]);

  useEffect(() => {
    const smooth = messages.length > prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    scrollChatEnd(smooth);
  }, [messages.length]);

  useEffect(() => {
    scrollChatEnd(false);
  }, [phase, detailsPanel, palettePanel, tierPanel, photosPanel]);

  function persist(nextBrief: WizardBrief, nextMessages: Msg[], nextPhase?: Phase) {
    setBrief(nextBrief);
    setMessages(nextMessages);
    saveBrief(nextBrief, nextMessages, nextPhase ?? phase);
  }

  function finishAnimate(id: string) {
    setMessages((prev) => {
      const next = prev.map((m) =>
        m.id === id ? { ...m, animate: false } : m
      );
      saveBrief(briefRef.current, next, phase);
      return next;
    });
    setPendingPanel((panel) => {
      if (panel === "niche") setNichePanel(true);
      if (panel === "details") setDetailsPanel(true);
      if (panel === "palette") {
        setPaletteStream(true);
        setPalettePanel(true);
      }
      if (panel === "tier") setTierPanel(true);
      if (panel === "photos") setPhotosPanel(true);
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
    if (nextPhase === "niche") {
      setPendingPanel("niche");
    } else if (nextPhase === "details") {
      setPendingPanel("details");
    } else if (nextPhase === "palette") {
      setPendingPanel("palette");
    } else if (nextPhase === "tier") {
      setPendingPanel("tier");
    } else if (nextPhase === "photos") {
      setPendingPanel("photos");
    } else {
      setPendingPanel(null);
    }
    persist(nextBrief, nextMessages, nextPhase);
    setBusy(false);
  }

  function patchBrief(patch: Partial<WizardBrief>) {
    const next = { ...briefRef.current, ...patch };
    setBrief(next);
    saveBrief(next, messagesRef.current, phase);
  }

  function pickNiche(nicheId: string) {
    if (busy || brief.nicheId) return;
    const tpl = getTemplateById(nicheId);
    if (!tpl) return;
    const topic = tpl.name;
    const nextBrief: WizardBrief = {
      ...brief,
      nicheId,
      topic,
      seoFocus: joinSeoPhrases(
        suggestSeoPhrases({ topic, companyName: "", city: "" })
      ),
      sectionsConfirmed: true,
      assetsConfirmed: true,
    };
    setBrief(nextBrief);
    setBusy(true);
    const userMsg: Msg = { id: uid(), role: "user", content: tpl.name };
    const withUser = [...messagesRef.current, userMsg];
    setMessages(withUser);
    saveBrief(nextBrief, withUser, "details");
    window.setTimeout(() => {
      trackEvent("landing_niche", tpl.name, { nicheId });
      pushAssistant(
        nextBrief,
        withUser,
        LANDING_AD_FLOW_ENABLED
          ? "Заполни данные ниже — название, номер для записи и пожелания."
          : "Заполни данные ниже — название, телефон, почту и пожелания.",
        "details"
      );
    }, 280);
  }

  function confirmDetails() {
    if (busy || brief.detailsConfirmed) return;
    if (brief.companyName.trim().length < 2) return;
    const nextBrief: WizardBrief = {
      ...brief,
      companyName: brief.companyName.trim(),
      phone: brief.phone.trim(),
      email: brief.email.trim(),
      notes: brief.notes.trim(),
      detailsConfirmed: true,
      sectionsConfirmed: true,
      assetsConfirmed: true,
      useSettingsContacts: false,
      seoFocus: joinSeoPhrases(suggestSeoPhrases(brief)),
    };
    setBrief(nextBrief);
    saveBrief(nextBrief, messagesRef.current, "palette");
    setBusy(true);
    window.setTimeout(() => {
      trackEvent("landing_details", brief.companyName.trim());
      pushAssistant(
        nextBrief,
        messagesRef.current,
        "Выбери палитру ниже.",
        "palette"
      );
    }, 280);
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
    saveBrief(nextBrief, messagesRef.current, "tier");
    setPaletteStream(false);
    setBusy(true);
    window.setTimeout(() => {
      trackEvent("landing_palette", pal.label, { paletteId: pal.id });
      pushAssistant(
        nextBrief,
        messagesRef.current,
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
      photosConfirmed: LANDING_AD_FLOW_ENABLED ? false : true,
    };
    setBrief(nextBrief);
    const nextPhase: Phase = LANDING_AD_FLOW_ENABLED ? "photos" : "ready";
    saveBrief(nextBrief, messagesRef.current, nextPhase);
    setBusy(true);
    window.setTimeout(() => {
      trackEvent("landing_tier", tier);
      pushAssistant(
        nextBrief,
        messagesRef.current,
        LANDING_AD_FLOW_ENABLED
          ? "Добавь фото или пропусти — ниже."
          : "Готово. Жми «Создать сайт».",
        nextPhase
      );
    }, 280);
  }

  function addLocalPhotos(files: FileList | null) {
    if (!files?.length || brief.photosConfirmed) return;
    const slots = 8 - brief.photoUrls.length;
    if (slots <= 0) return;
    const fileArr = Array.from(files).slice(0, slots);
    void Promise.all(
      fileArr.map(
        (f) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("read"));
            reader.readAsDataURL(f);
          })
      )
    ).then((urls) => {
      const valid = urls.filter(Boolean);
      if (!valid.length) return;
      patchBrief({
        photoUrls: [...briefRef.current.photoUrls, ...valid].slice(0, 8),
      });
    });
  }

  function confirmPhotos() {
    if (busy || brief.photosConfirmed) return;
    const nextBrief: WizardBrief = { ...brief, photosConfirmed: true };
    setBrief(nextBrief);
    saveBrief(nextBrief, messagesRef.current, "ready");
    setBusy(true);
    window.setTimeout(() => {
      trackEvent("landing_photos", brief.photoUrls.length ? "with_photos" : "skip", {
        count: brief.photoUrls.length,
      });
      pushAssistant(
        nextBrief,
        messagesRef.current,
        "Готово. Жми «Создать сайт».",
        "ready"
      );
    }, 280);
  }

  function onCreate() {
    trackEvent("create_site_click", brief.companyName || brief.topic);
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
    if (LANDING_AD_FLOW_ENABLED && phase !== "ready") return;
    if (phase === "tier" && !brief.tier) return;
    if (phase === "palette" && !brief.paletteId) return;
    if (phase === "details" && !brief.detailsConfirmed) return;
    if (phase === "photos" && !brief.photosConfirmed) return;
    setBusy(true);
    setInput("");
    const userMsg: Msg = { id: uid(), role: "user", content: message };
    const withUser = [...messagesRef.current, userMsg];
    const currentBrief = briefRef.current;
    const currentPhase = phase;
    setMessages(withUser);
    saveBrief(currentBrief, withUser);

    await new Promise((r) => setTimeout(r, 420));
    const { next, phase: nextPhase, reply } = replyFor(
      currentPhase,
      message,
      currentBrief
    );
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
        <nav className="flex items-center gap-2">
          {loggedIn ? null : (
            <>
              <button
                type="button"
                className="wc-lovable-link"
                data-wc-event="login"
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
                data-wc-event="register"
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
              {LANDING_AD_FLOW_ENABLED
                ? "Выбери нишу — уточним детали и соберём лендинг."
                : "Опиши идею — уточним детали и соберём лендинг."}
            </p>
            {LANDING_AD_FLOW_ENABLED ? (
              <div className="wc-landing-niche-hero">
                <p className="wc-landing-niche-hero-label">Выбери нишу</p>
                <div className="wc-landing-niche-grid">
                  {adNiches.map((n, i) => (
                    <button
                      key={n.id}
                      type="button"
                      className={`wc-landing-niche-btn ${i === 0 ? "is-featured" : ""}`}
                      disabled={busy}
                      onClick={() => pickNiche(n.id)}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            ref={chatScrollRef}
            className="wc-lovable-chat-scroll mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-2"
          >
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
            {busy && !messages.some((m) => m.animate) && !detailsPanel && !palettePanel && !tierPanel && !photosPanel ? (
              <div className="inline-flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Печатаю…
              </div>
            ) : null}
            {nichePanel && LANDING_AD_FLOW_ENABLED && brief.nicheId ? (
              <div className="wc-landing-niche-done">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Ниша:{" "}
                {getTemplateById(brief.nicheId)?.name ?? brief.nicheId}
              </div>
            ) : null}
            {detailsPanel ? (
              <div className={`wc-landing-details ${brief.detailsConfirmed ? "is-locked" : ""}`}>
                <p className="wc-landing-details-title">Данные компании</p>
                <p className="wc-landing-details-sub">
                  {LANDING_AD_FLOW_ENABLED
                    ? "Название, номер для записи и пожелания — сразу."
                    : "Название, телефон, почта и пожелания — сразу."}
                </p>
                <div className="wc-landing-details-fields">
                  <input
                    value={brief.companyName}
                    disabled={brief.detailsConfirmed}
                    onChange={(e) => patchBrief({ companyName: e.target.value })}
                    placeholder="Название компании *"
                    className="wc-landing-details-input"
                  />
                  {LANDING_AD_FLOW_ENABLED ? (
                    <input
                      value={brief.phone}
                      disabled={brief.detailsConfirmed}
                      onChange={(e) => patchBrief({ phone: e.target.value })}
                      placeholder="Номер для записи"
                      className="wc-landing-details-input"
                    />
                  ) : (
                    <div className="wc-landing-details-row">
                      <input
                        value={brief.phone}
                        disabled={brief.detailsConfirmed}
                        onChange={(e) => patchBrief({ phone: e.target.value })}
                        placeholder="Телефон"
                        className="wc-landing-details-input"
                      />
                      <input
                        type="email"
                        value={brief.email}
                        disabled={brief.detailsConfirmed}
                        onChange={(e) => patchBrief({ email: e.target.value })}
                        placeholder="Почта"
                        className="wc-landing-details-input"
                      />
                    </div>
                  )}
                  <textarea
                    value={brief.notes}
                    disabled={brief.detailsConfirmed}
                    onChange={(e) =>
                      patchBrief({ notes: e.target.value.slice(0, 2000) })
                    }
                    placeholder="Пожелания"
                    rows={3}
                    className="wc-landing-details-input wc-landing-details-area"
                  />
                </div>
                {!brief.detailsConfirmed ? (
                  <button
                    type="button"
                    className="wc-landing-details-go"
                    disabled={busy || brief.companyName.trim().length < 2}
                    onClick={confirmDetails}
                  >
                    Дальше
                  </button>
                ) : (
                  <p className="wc-landing-details-done">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Сохранено
                  </p>
                )}
              </div>
            ) : null}
            {palettePanel ? (
              <LandingPalettePicker
                selectedId={brief.paletteId}
                locked={Boolean(brief.paletteId)}
                streamIn={paletteStream}
                onStreamTick={() => scrollChatEnd(false)}
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
            {tierPanel ? (
              <div className="wc-landing-tier">
                <p className="wc-landing-tier-title">Какой уровень сайта?</p>
                <button
                  type="button"
                  className={`wc-landing-tier-btn ${brief.tier === "simple" ? "is-selected" : ""}`}
                  disabled={busy || Boolean(brief.tier)}
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
                  className={`wc-landing-tier-btn is-premium ${brief.tier === "premium" ? "is-selected" : ""}`}
                  disabled={busy || Boolean(brief.tier)}
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
            {photosPanel ? (
              <div
                className={`wc-landing-photos ${brief.photosConfirmed ? "is-locked" : ""}`}
              >
                <p className="wc-landing-photos-title">Добавить фото</p>
                <p className="wc-landing-photos-sub">
                  Загрузи реальные фото — врачи, зал, товары, работы. Можно
                  пропустить.
                </p>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addLocalPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
                {!brief.photosConfirmed ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => photoInputRef.current?.click()}
                    className="wc-landing-photos-add"
                  >
                    <ImagePlus className="h-4 w-4" aria-hidden />
                    Добавить фото
                    <span className="wc-landing-photos-count">
                      {brief.photoUrls.length
                        ? `${brief.photoUrls.length} шт.`
                        : "+"}
                    </span>
                  </button>
                ) : null}
                {brief.photoUrls.length > 0 ? (
                  <div className="wc-landing-photos-grid">
                    {brief.photoUrls.map((url) => (
                      <div key={url} className="wc-landing-photos-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Фото" />
                        {!brief.photosConfirmed ? (
                          <button
                            type="button"
                            onClick={() =>
                              patchBrief({
                                photoUrls: brief.photoUrls.filter(
                                  (u) => u !== url
                                ),
                              })
                            }
                            className="wc-landing-photos-remove"
                            aria-label="Удалить"
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {!brief.photosConfirmed ? (
                  <button
                    type="button"
                    className="wc-landing-photos-go"
                    disabled={busy}
                    onClick={confirmPhotos}
                  >
                    {brief.photoUrls.length ? "Дальше" : "Пропустить"}
                  </button>
                ) : (
                  <p className="wc-landing-details-done">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    {brief.photoUrls.length
                      ? `Фото: ${brief.photoUrls.length} шт.`
                      : "Без фото"}
                  </p>
                )}
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

        {ready && !empty ? (
          <div className="wc-lovable-ready-bar" role="status">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            Всё готово — нажми «Создать сайт»
          </div>
        ) : null}

        <div className="wc-lovable-dock">
          <form onSubmit={onSubmit} className="wc-lovable-composer">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                empty
                  ? LANDING_AD_FLOW_ENABLED
                    ? "Выбери нишу выше…"
                    : "Например: кофейня в центре Москвы…"
                  : phase === "details"
                    ? "Заполни данные выше…"
                    : phase === "palette"
                      ? "Выбери палитру выше…"
                      : phase === "tier"
                        ? "Выбери уровень выше…"
                        : phase === "photos"
                          ? "Добавь фото выше…"
                          : "Напиши сообщение…"
              }
              className="wc-lovable-input"
              disabled={
                busy ||
                (LANDING_AD_FLOW_ENABLED && (empty || phase === "niche")) ||
                (phase === "details" && !brief.detailsConfirmed) ||
                (phase === "palette" && !brief.paletteId) ||
                (phase === "tier" && !brief.tier) ||
                (phase === "photos" && !brief.photosConfirmed)
              }
            />
            <div className="wc-lovable-composer-actions">
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
                  className="wc-lovable-build is-ready"
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
                    setPhase(LANDING_AD_FLOW_ENABLED ? "niche" : "idle");
                    setNichePanel(false);
                    setDetailsPanel(false);
                    setPalettePanel(false);
                    setPaletteStream(false);
                    setTierPanel(false);
                    setPhotosPanel(false);
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
