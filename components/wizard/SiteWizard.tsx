"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Send,
  Sparkles,
  ImageIcon,
  RotateCcw,
  Crown,
  Zap,
  Wand2,
} from "lucide-react";
import { buildPreviewHtml } from "@/lib/sitePreview";
import { getTokenCost } from "@/lib/tokenConfig";
import {
  WIZARD_PALETTES,
  WIZARD_IMAGE_MODEL_IDS,
  buildWizardSitePrompt,
  detectNicheFromTopic,
  emptyWizardBrief,
  isBriefReady,
  modelIdForTier,
  nextScriptedStep,
  sectionOptions,
  type WizardBrief,
  type WizardTier,
} from "@/lib/wizardBrief";
import type { SiteSectionId } from "@/lib/brand";
import {
  imagePromptsFromBrief,
  injectSiteImages,
} from "@/lib/injectSiteImages";
import { HostingOffer } from "@/components/HostingOffer";

type ChatBubble =
  | {
      id: string;
      kind: "text";
      role: "user" | "assistant";
      content: string;
      /** Печатать по буквам */
      animate?: boolean;
    }
  | {
      id: string;
      kind: "choice";
      step: "palette" | "sections" | "tier";
      title: string;
    };

type WizardResult = {
  html: string;
  css: string;
  js: string;
  id?: string | null;
};

type Props = {
  getAccessToken: () => Promise<string | null>;
  useContacts: boolean;
  onBalanceRefresh: () => void;
  onSiteReady: (site: {
    id: string;
    prompt: string;
    html: string;
    css: string;
    js: string;
    createdAt: string;
  }) => void;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function Typewriter({
  text,
  onDone,
}: {
  text: string;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    setShown("");
    doneRef.current = false;
    let i = 0;
    const step = Math.max(1, Math.ceil(text.length / 80));
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + step);
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone?.();
        }
      }
    }, 16);
    return () => window.clearInterval(id);
  }, [text, onDone]);

  return (
    <span>
      {shown}
      {shown.length < text.length ? (
        <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-violet-300/80 align-middle" />
      ) : null}
    </span>
  );
}

function BuildLoader() {
  const lines = [
    "Собираю структуру…",
    "Подбираю типографику…",
    "Настраиваю цвета…",
    "Рисую блоки…",
    "Почти готово…",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = window.setInterval(
      () => setIdx((v) => (v + 1) % lines.length),
      2200
    );
    return () => window.clearInterval(t);
  }, [lines.length]);

  return (
    <div className="relative flex h-full min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#07090f]">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />
      </div>
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border border-violet-400/30 border-t-violet-300" />
        <span className="absolute inset-2 animate-spin rounded-full border border-white/10 border-b-violet-200/80 [animation-duration:1.6s] [animation-direction:reverse]" />
        <Sparkles className="relative h-6 w-6 text-violet-200" />
      </div>
      <p className="relative text-sm font-medium text-zinc-100">{lines[idx]}</p>
      <p className="relative mt-2 text-[11px] text-zinc-500">
        Это займёт немного времени — сайт собирается с нуля
      </p>
      <div className="relative mt-8 flex gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300/80"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SiteWizard({
  getAccessToken,
  useContacts,
  onBalanceRefresh,
  onSiteReady,
}: Props) {
  const [brief, setBrief] = useState<WizardBrief>(() => emptyWizardBrief());
  const [bubbles, setBubbles] = useState<ChatBubble[]>(() => [
    {
      id: uid(),
      kind: "text",
      role: "assistant",
      content:
        "Привет! Напиши, для какого бизнеса нужен сайт — например «мебель в Санкт-Петербурге» или «стоматология».",
      animate: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [error, setError] = useState("");
  const [showPreviewPane, setShowPreviewPane] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const menuDelayRef = useRef<number | null>(null);

  const siteCost = getTokenCost(modelIdForTier(brief.tier ?? "simple"));
  const imageCost = getTokenCost(WIZARD_IMAGE_MODEL_IDS[0]);
  const ready = isBriefReady(brief);

  const briefSummary = useMemo(() => {
    const parts = [
      brief.topic ? `Тема: ${brief.topic}` : null,
      brief.paletteId ? `Палитра: ${brief.paletteId}` : null,
      brief.sections.length ? `Секции: ${brief.sections.join(", ")}` : null,
      brief.nicheId ? `Ниша: ${brief.nicheId}` : null,
      brief.tier ? `Уровень: ${brief.tier}` : null,
      brief.notes ? `Заметки: ${brief.notes}` : null,
    ];
    return parts.filter(Boolean).join("\n");
  }, [brief]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, building, result, showPreviewPane]);

  useEffect(() => {
    return () => {
      if (menuDelayRef.current) window.clearTimeout(menuDelayRef.current);
    };
  }, []);

  function pushAssistant(content: string, animate = true) {
    setBubbles((prev) => [
      ...prev,
      { id: uid(), kind: "text", role: "assistant", content, animate },
    ]);
  }

  function pushChoice(
    step: "palette" | "sections" | "tier",
    title: string,
    delayMs = 700
  ) {
    if (menuDelayRef.current) window.clearTimeout(menuDelayRef.current);
    menuDelayRef.current = window.setTimeout(() => {
      setBubbles((prev) => {
        if (prev.some((b) => b.kind === "choice" && b.step === step)) {
          return prev;
        }
        return [...prev, { id: uid(), kind: "choice", step, title }];
      });
    }, delayMs);
  }

  function ensureScriptMenus(next: WizardBrief) {
    const step = nextScriptedStep(next);
    if (step === "palette") {
      pushChoice("palette", "Выбери цветовую палитру", 1400);
    } else if (step === "sections") {
      pushChoice("sections", "Какие блоки нужны на сайте?", 1400);
    } else if (step === "tier") {
      pushChoice("tier", "Какой уровень сайта?", 1400);
    } else if (step === "ready") {
      pushAssistant(
        "Бриф готов — жми «Собрать сайт». Превью откроется справа.",
        true
      );
    }
  }

  async function sendChat(text: string) {
    const message = text.trim();
    if (!message || chatLoading) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Войдите в аккаунт");
      return;
    }

    setError("");
    setBubbles((prev) => [
      ...prev,
      { id: uid(), kind: "text", role: "user", content: message },
    ]);
    setInput("");

    const nextBrief = { ...brief };
    if (!nextBrief.topic || nextBrief.topic.length < 3) {
      nextBrief.topic = message;
      nextBrief.nicheId = detectNicheFromTopic(message);
      setBrief(nextBrief);
    } else {
      nextBrief.notes = [nextBrief.notes, message].filter(Boolean).join("\n");
      if (!nextBrief.nicheId) {
        nextBrief.nicheId = detectNicheFromTopic(
          `${nextBrief.topic}\n${message}`
        );
      }
      setBrief(nextBrief);
    }

    setChatLoading(true);
    try {
      const history = bubbles
        .filter(
          (b): b is Extract<ChatBubble, { kind: "text" }> => b.kind === "text"
        )
        .map((b) => ({ role: b.role, content: b.content }));

      const res = await fetch("/api/wizard/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message,
          history,
          briefSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка чата");
      pushAssistant(data.response ?? data.reply ?? "Ок", true);
      onBalanceRefresh();
      ensureScriptMenus(nextBrief);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка чата";
      setError(msg);
      pushAssistant(`Не удалось ответить: ${msg}`, true);
    } finally {
      setChatLoading(false);
    }
  }

  function pickPalette(id: string) {
    const pal = WIZARD_PALETTES.find((p) => p.id === id);
    if (!pal || brief.paletteId) return;
    const next = { ...brief, paletteId: id, colors: [...pal.colors] };
    setBrief(next);
    setBubbles((prev) => [
      ...prev,
      {
        id: uid(),
        kind: "text",
        role: "user",
        content: `Палитра: ${pal.label}`,
      },
    ]);
    pushAssistant(`Отлично, палитра «${pal.label}».`, true);
    ensureScriptMenus(next);
  }

  function toggleSection(id: SiteSectionId) {
    setBrief((prev) => {
      const has = prev.sections.includes(id);
      const sections = has
        ? prev.sections.filter((s) => s !== id)
        : [...prev.sections, id];
      return { ...prev, sections };
    });
  }

  function confirmSections() {
    if (brief.sections.length < 2) {
      pushAssistant("Выбери хотя бы два блока.", true);
      return;
    }
    const next = { ...brief, sectionsConfirmed: true };
    setBrief(next);
    const labels = sectionOptions()
      .filter((s) => brief.sections.includes(s.id as SiteSectionId))
      .map((s) => s.label)
      .join(", ");
    setBubbles((prev) => [
      ...prev,
      {
        id: uid(),
        kind: "text",
        role: "user",
        content: `Блоки: ${labels}`,
      },
    ]);
    pushAssistant("Структуру зафиксировал.", true);
    ensureScriptMenus(next);
  }

  function pickTier(tier: WizardTier) {
    if (brief.tier) return;
    const next = { ...brief, tier };
    setBrief(next);
    setBubbles((prev) => [
      ...prev,
      {
        id: uid(),
        kind: "text",
        role: "user",
        content: tier === "premium" ? "Премиум сайт" : "Простой сайт",
      },
    ]);
    pushAssistant(
      tier === "premium"
        ? "Премиум: сильнее визуал и анимации. Можно собирать."
        : "Простой: чистый современный лендинг. Можно собирать.",
      true
    );
    ensureScriptMenus(next);
  }

  async function buildSite() {
    if (!ready || building) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Войдите в аккаунт");
      return;
    }
    setShowPreviewPane(true);
    setBuilding(true);
    setError("");
    try {
      const built = buildWizardSitePrompt(brief);
      const displayTitle = brief.topic.trim();
      const res = await fetch("/api/generate-site", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          // Короткий заголовок в историю; полный бриф — в customRequirements
          prompt: displayTitle,
          customRequirements: [built.prompt, built.customRequirements]
            .filter(Boolean)
            .join("\n\n"),
          brandColors: built.brandColors,
          sections: built.sections,
          modelId: built.modelId,
          wizardMode: true,
          templateId: built.templateId,
          expressMode: false,
          useContacts,
          qualityMode: "quality",
          images: [],
          hasImages: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка генерации");
      if (!data.html?.trim()) throw new Error("Пустой ответ модели");

      const site: WizardResult = {
        html: data.html,
        css: data.css ?? "",
        js: data.js ?? "",
        id: data.id,
      };
      setResult(site);
      setPreviewHtml(
        buildPreviewHtml({
          html: site.html,
          css: site.css,
          js: site.js,
        })
      );
      onSiteReady({
        id: String(data.id ?? crypto.randomUUID()),
        prompt: displayTitle,
        html: site.html,
        css: site.css,
        js: site.js,
        createdAt: data.created_at ?? new Date().toISOString(),
      });
      onBalanceRefresh();
      pushAssistant(
        "Сайт собран. Можно добавить картинки кнопкой ниже.",
        true
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка генерации";
      setError(msg);
      pushAssistant(`Не удалось собрать сайт: ${msg}`, true);
    } finally {
      setBuilding(false);
    }
  }

  async function generateOneImage(
    accessToken: string,
    prompt: string
  ): Promise<string | null> {
    let lastError = "Модель картинок недоступна";
    for (const modelId of WIZARD_IMAGE_MODEL_IDS) {
      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ prompt, modelId }),
        });
        const data = await res.json();
        if (!res.ok) {
          lastError = data.error ?? lastError;
          continue;
        }
        const url = data.url ?? data.imageUrl;
        if (url) return url as string;
      } catch (e) {
        lastError = e instanceof Error ? e.message : lastError;
      }
    }
    throw new Error(lastError);
  }

  async function addImages() {
    if (!result || imagesLoading) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Войдите в аккаунт");
      return;
    }
    setImagesLoading(true);
    setError("");
    try {
      const prompts = imagePromptsFromBrief(
        brief.topic,
        brief.nicheId ?? detectNicheFromTopic(brief.topic)
      );
      const urls: string[] = [];
      for (const prompt of prompts) {
        const url = await generateOneImage(accessToken, prompt);
        if (url) urls.push(url);
      }
      const html = injectSiteImages(result.html, urls);
      const next = { ...result, html };
      setResult(next);
      setPreviewHtml(
        buildPreviewHtml({ html: next.html, css: next.css, js: next.js })
      );
      onSiteReady({
        id: String(next.id ?? crypto.randomUUID()),
        prompt: brief.topic,
        html: next.html,
        css: next.css,
        js: next.js,
        createdAt: new Date().toISOString(),
      });
      onBalanceRefresh();
      pushAssistant(
        urls.length
          ? `Добавил ${urls.length} картинки на сайт.`
          : "Картинки не удалось получить.",
        true
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка картинок";
      setError(msg);
      pushAssistant(`Картинки: ${msg}`, true);
    } finally {
      setImagesLoading(false);
    }
  }

  function resetWizard() {
    setBrief(emptyWizardBrief());
    setResult(null);
    setPreviewHtml("");
    setError("");
    setShowPreviewPane(false);
    setBubbles([
      {
        id: uid(),
        kind: "text",
        role: "assistant",
        content:
          "Начнём заново. Для какого бизнеса или темы делаем сайт?",
        animate: true,
      },
    ]);
  }

  const isFreshStart = bubbles.length <= 2 && !brief.topic && !showPreviewPane;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        className={`relative flex min-h-0 flex-col border-white/10 ${
          showPreviewPane ? "w-full lg:w-[44%] lg:border-r" : "w-full"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
          <div className="absolute bottom-24 right-0 h-48 w-48 rounded-full bg-sky-500/8 blur-3xl" />
        </div>

        <div className="relative z-[1] flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-400/20">
              <Wand2 className="h-4 w-4 text-violet-200" />
            </span>
            <div>
              <p className="text-[15px] font-medium tracking-tight text-zinc-100">
                Мастер сайта
              </p>
              <p className="text-[12px] text-zinc-500">
                {brief.tier === "premium"
                  ? `Премиум · ${siteCost} ток.`
                  : brief.tier === "simple"
                    ? `Простой · ${siteCost} ток.`
                    : "Пара вопросов — и сайт готов"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetWizard}
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Сначала
          </button>
        </div>

        <div
          className={`relative z-[1] flex-1 overflow-y-auto px-5 py-5 ${
            isFreshStart ? "flex flex-col justify-center" : ""
          }`}
        >
          <div
            className={`mx-auto w-full space-y-4 ${
              showPreviewPane ? "max-w-xl" : "max-w-2xl"
            }`}
          >
            {isFreshStart ? (
              <div className="mb-2 animate-[wcFadeIn_0.5s_ease]">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">
                  С чего начать
                </p>
                <h2 className="mt-2 font-display text-2xl tracking-tight text-zinc-50 sm:text-[1.75rem]">
                  Опиши бизнес одной фразой
                </h2>
                <p className="mt-2 max-w-md text-[14px] leading-relaxed text-zinc-500">
                  Например: мебель в Санкт-Петербурге, стоматология, салон красоты.
                  Дальше выберешь цвета и уровень сайта.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    "мебель в СПб",
                    "стоматология",
                    "ресторан",
                    "IT-стартап",
                  ].map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      onClick={() => void sendChat(hint)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[12px] text-zinc-400 transition hover:border-violet-400/35 hover:bg-violet-500/10 hover:text-zinc-200"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {bubbles.map((b) => {
              if (b.kind === "text") {
                if (isFreshStart && b.role === "assistant") return null;
                return (
                  <div
                    key={b.id}
                    className={`max-w-[min(94%,34rem)] rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm animate-[wcFadeIn_0.35s_ease] ${
                      b.role === "user"
                        ? "ml-auto bg-gradient-to-br from-violet-500/35 to-violet-600/20 text-violet-50 ring-1 ring-violet-400/20"
                        : "bg-white/[0.05] text-zinc-200 ring-1 ring-white/[0.06]"
                    }`}
                  >
                    {b.role === "assistant" && b.animate ? (
                      <Typewriter text={b.content} />
                    ) : (
                      b.content
                    )}
                  </div>
                );
              }

              if (b.step === "palette") {
                return (
                  <div
                    key={b.id}
                    className="max-w-xl animate-[wcFadeIn_0.4s_ease] rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-5"
                  >
                    <p className="mb-4 text-[14px] font-medium text-zinc-100">
                      {b.title}
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {WIZARD_PALETTES.map((p) => {
                        const selected = brief.paletteId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={Boolean(brief.paletteId)}
                            onClick={() => pickPalette(p.id)}
                            className={`flex items-center gap-3.5 rounded-2xl border px-3.5 py-3.5 text-left transition ${
                              selected
                                ? "border-violet-400/50 bg-violet-500/15"
                                : "border-white/10 bg-black/25 hover:border-white/25"
                            } disabled:opacity-50`}
                          >
                            <span className="flex -space-x-2">
                              {p.colors.map((c) => (
                                <span
                                  key={c}
                                  className="h-8 w-8 rounded-full border-2 border-[#0b0f19] shadow-lg"
                                  style={{ background: c }}
                                />
                              ))}
                            </span>
                            <span className="text-[14px] text-zinc-200">
                              {p.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (b.step === "sections") {
                return (
                  <div
                    key={b.id}
                    className="max-w-xl animate-[wcFadeIn_0.4s_ease] rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                  >
                    <p className="mb-4 text-[14px] font-medium text-zinc-100">
                      {b.title}
                    </p>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {sectionOptions().map((s) => {
                        const on = brief.sections.includes(
                          s.id as SiteSectionId
                        );
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={brief.sectionsConfirmed}
                            onClick={() =>
                              toggleSection(s.id as SiteSectionId)
                            }
                            className={`rounded-full border px-3.5 py-2 text-[13px] transition ${
                              on
                                ? "border-violet-400/50 bg-violet-500/20 text-violet-100"
                                : "border-white/12 text-zinc-400 hover:border-white/30"
                            } disabled:opacity-50`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                    {!brief.sectionsConfirmed ? (
                      <button
                        type="button"
                        onClick={confirmSections}
                        className="rounded-xl bg-white/10 px-4 py-2.5 text-[13px] font-medium text-zinc-100 hover:bg-white/15"
                      >
                        Дальше
                      </button>
                    ) : null}
                  </div>
                );
              }

              return (
                <div
                  key={b.id}
                  className="max-w-xl animate-[wcFadeIn_0.4s_ease] space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                >
                  <p className="mb-1 text-[14px] font-medium text-zinc-100">
                    {b.title}
                  </p>
                  <button
                    type="button"
                    disabled={Boolean(brief.tier)}
                    onClick={() => pickTier("simple")}
                    className="flex w-full items-start gap-3.5 rounded-2xl border border-white/12 bg-black/25 p-3.5 text-left transition hover:border-violet-400/40 disabled:opacity-50"
                  >
                    <span className="mt-0.5 rounded-xl bg-white/10 p-2.5">
                      <Zap className="h-4 w-4 text-zinc-200" />
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
                    disabled={Boolean(brief.tier)}
                    onClick={() => pickTier("premium")}
                    className="flex w-full items-start gap-3.5 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-3.5 text-left transition hover:border-violet-400/50 disabled:opacity-50"
                  >
                    <span className="mt-0.5 rounded-xl bg-violet-500/20 p-2.5">
                      <Crown className="h-4 w-4 text-violet-200" />
                    </span>
                    <span>
                      <span className="block text-[14px] text-violet-50">
                        Премиум · −{getTokenCost("claude-fable-5")} ток.
                      </span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-violet-200/70">
                        Сильнее дизайн и анимации — заметно выше обычного.
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}

            {chatLoading && (
              <div className="inline-flex items-center gap-2 text-[13px] text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Печатаю…
              </div>
            )}

            {result ? <HostingOffer compact className="mt-2" /> : null}
            <div ref={endRef} />
          </div>
        </div>

        {error ? (
          <p className="relative z-[1] px-5 pb-1 text-[12px] text-rose-300">
            {error}
          </p>
        ) : null}

        <div className="relative z-[1] space-y-3 border-t border-white/[0.06] bg-black/20 px-5 py-4 backdrop-blur-md">
          {(ready || result) && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!ready || building}
                onClick={() => void buildSite()}
                className="wc-btn wc-btn-primary px-4 py-2.5 text-[13px] disabled:opacity-50"
              >
                {building ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Собрать сайт (−{siteCost})
              </button>
              {result ? (
                <button
                  type="button"
                  disabled={imagesLoading}
                  onClick={() => void addImages()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-4 py-2.5 text-[13px] text-zinc-200 transition hover:bg-white/5 disabled:opacity-50"
                >
                  {imagesLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  Картинки (−{imageCost * 3})
                </button>
              ) : null}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendChat(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                brief.topic
                  ? "Уточнение или правка…"
                  : "Напиши тему сайта…"
              }
              className="wc-input flex-1 py-3 text-[14px]"
              disabled={chatLoading}
            />
            <button
              type="submit"
              disabled={chatLoading || !input.trim()}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {showPreviewPane ? (
        <div className="flex min-h-[320px] flex-1 flex-col bg-black/25">
          <div className="border-b border-white/[0.06] px-5 py-3 text-[12px] text-zinc-500">
            Превью
          </div>
          <div className="min-h-0 flex-1 p-4">
            {building ? (
              <BuildLoader />
            ) : previewHtml ? (
              <iframe
                title="wizard-preview"
                srcDoc={previewHtml}
                className="h-full min-h-[420px] w-full rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/40"
              />
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-[14px] text-zinc-600">
                Превью появится после сборки
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
