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
  Mic,
  Plus,
  Check,
  X,
  Rocket,
  Maximize2,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import { buildPreviewHtml } from "@/lib/sitePreview";
import { getTokenCost } from "@/lib/tokenConfig";
import {
  WIZARD_PALETTES,
  WIZARD_IMAGE_MODEL_IDS,
  WIZARD_STORAGE_KEY,
  buildWizardSitePrompt,
  detectNicheFromTopic,
  emptyWizardBrief,
  extractCityFromTopic,
  isBriefReady,
  modelIdForTier,
  nextScriptedStep,
  sectionOptions,
  suggestSeoPhrases,
  parseSeoPhrases,
  joinSeoPhrases,
  type WizardBrief,
  type WizardTier,
} from "@/lib/wizardBrief";
import { getTemplateById } from "@/lib/siteTemplates";
import {
  LOGO_ACCEPT,
  PREVIEW_DEVICE_WIDTH,
  type PreviewDevice,
  type SiteSectionId,
} from "@/lib/brand";
import {
  countImageSlots,
  imagePromptsFromBrief,
  injectSiteImagesDetailed,
} from "@/lib/injectSiteImages";
import { PublishModal } from "@/components/PublishModal";
import { CometPlayground } from "@/components/wizard/CometPlayground";
import { PaletteMock } from "@/components/wizard/PaletteMock";
import { looksLikeSiteEdit } from "@/lib/costOptimization";

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
      step: "palette" | "sections" | "tier" | "details" | "assets";
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
  const steps = [
    "Структура страниц",
    "Типографика и цвета",
    "Блоки и тексты",
    "Финальная сборка",
  ];
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const stepTimer = window.setInterval(() => {
      setIdx((v) => (v + 1) % steps.length);
    }, 3200);
    const progTimer = window.setInterval(() => {
      setProgress((p) => Math.min(92, p + 1.2 + Math.random() * 2));
    }, 800);
    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(progTimer);
    };
  }, [steps.length]);

  return (
    <div className="relative flex h-full min-h-[480px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0a0b10] px-6 py-8">
      <div className="relative w-full max-w-md">
        <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-zinc-500">
          Сборка сайта
        </p>
        <p className="mt-2 text-xl font-medium tracking-tight text-zinc-50 sm:text-2xl">
          {steps[idx]}…
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-400">
          Обычно около минуты. Пока можно поиграть с кометой.
        </p>

        <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-violet-400 transition-[width] duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ul className="mt-8 space-y-3">
          {steps.map((label, i) => {
            const done = i < idx;
            const current = i === idx;
            return (
              <li
                key={label}
                className={`flex items-center gap-3 text-[15px] ${
                  done
                    ? "text-zinc-300"
                    : current
                      ? "text-zinc-50"
                      : "text-zinc-600"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                    done
                      ? "bg-violet-500/30 text-violet-100"
                      : current
                        ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/40"
                        : "bg-white/5 text-zinc-600"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                {label}
              </li>
            );
          })}
        </ul>

        <CometPlayground />
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
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickCount, setImagePickCount] = useState(3);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [error, setError] = useState("");
  const [showPreviewPane, setShowPreviewPane] = useState(false);
  const [customColors, setCustomColors] = useState<[string, string, string]>([
    "#6c3bf4",
    "#f5f3ff",
    "#0b0f19",
  ]);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [listening, setListening] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<
    null | "reference" | "logo" | "tz"
  >(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [abA, setAbA] = useState("violet");
  const [abB, setAbB] = useState("ocean");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [seoDraft, setSeoDraft] = useState("");
  const [seoEditingIdx, setSeoEditingIdx] = useState<number | null>(null);
  const [seoEditText, setSeoEditText] = useState("");
  const seoSeededRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const menuDelayRef = useRef<number | null>(null);
  const speechRef = useRef<{ stop: () => void } | null>(null);
  const resultRef = useRef<WizardResult | null>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const tzInputRef = useRef<HTMLInputElement>(null);

  resultRef.current = result;

  const siteCost = getTokenCost(modelIdForTier(brief.tier ?? "simple"));
  const imageCost = getTokenCost(WIZARD_IMAGE_MODEL_IDS[0]);
  const ready = isBriefReady(brief);

  const briefSummary = useMemo(() => {
    const parts = [
      brief.topic ? `Тема: ${brief.topic}` : null,
      brief.companyName ? `Компания: ${brief.companyName}` : null,
      brief.city ? `Город: ${brief.city}` : null,
      brief.paletteId ? `Палитра: ${brief.paletteId}` : null,
      brief.tier ? `Уровень: ${brief.tier}` : null,
      brief.seoFocus ? `SEO: ${brief.seoFocus}` : null,
      brief.notes ? `Заметки: ${brief.notes}` : null,
    ];
    return parts.filter(Boolean).join("\n");
  }, [brief]);

  useEffect(() => {
    const hasDetails = bubbles.some(
      (b) => b.kind === "choice" && b.step === "details"
    );
    if (!hasDetails || brief.detailsConfirmed || seoSeededRef.current) return;
    if (parseSeoPhrases(brief.seoFocus).length > 0) {
      seoSeededRef.current = true;
      return;
    }
    if (!brief.topic.trim()) return;
    const seeded = suggestSeoPhrases(brief);
    if (!seeded.length) return;
    seoSeededRef.current = true;
    setBrief((prev) =>
      parseSeoPhrases(prev.seoFocus).length
        ? prev
        : { ...prev, seoFocus: joinSeoPhrases(seeded) }
    );
  }, [
    bubbles,
    brief.detailsConfirmed,
    brief.seoFocus,
    brief.topic,
    brief.city,
    brief.companyName,
  ]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as {
          brief?: WizardBrief;
          bubbles?: ChatBubble[];
          result?: WizardResult | null;
          previewHtml?: string;
          showPreviewPane?: boolean;
        };
        if (data.brief) {
          const merged = { ...emptyWizardBrief(), ...data.brief };
          if (
            data.brief.assetsConfirmed === undefined &&
            (data.brief.tier || data.brief.detailsConfirmed)
          ) {
            merged.assetsConfirmed = true;
          }
          setBrief(merged);
        }
        if (Array.isArray(data.bubbles)) setBubbles(data.bubbles);
        if (data.result) setResult(data.result);
        if (data.previewHtml) setPreviewHtml(data.previewHtml);
        if (data.showPreviewPane) setShowPreviewPane(true);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || building) return;
    try {
      localStorage.setItem(
        WIZARD_STORAGE_KEY,
        JSON.stringify({
          brief,
          bubbles,
          result,
          previewHtml,
          showPreviewPane,
        })
      );
    } catch {
      /* ignore */
    }
  }, [brief, bubbles, result, previewHtml, showPreviewPane, hydrated, building]);

  useEffect(() => {
    if (!hydrated) return;
    const step = nextScriptedStep(brief);
    if (
      step === "palette" ||
      step === "details" ||
      step === "assets" ||
      step === "sections" ||
      step === "tier"
    ) {
      const has = bubbles.some(
        (b) => b.kind === "choice" && b.step === step
      );
      if (!has && brief.topic.trim().length >= 3) {
        ensureScriptMenus(brief);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore menus once after hydrate
  }, [hydrated]);

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
    step: "palette" | "sections" | "tier" | "details" | "assets",
    title: string,
    delayMs = 500
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
      pushChoice("palette", "Выбери цветовую палитру", 400);
    } else if (step === "details") {
      pushChoice("details", "Название и контакты", 500);
    } else if (step === "assets") {
      pushChoice("assets", "Референс, логотип, ТЗ — по желанию", 500);
    } else if (step === "sections") {
      pushChoice("sections", "Какие блоки нужны на сайте?", 500);
    } else if (step === "tier") {
      pushChoice("tier", "Какой уровень сайта?", 500);
    }
  }

  async function applySiteEdit(text: string) {
    const message = text.trim();
    if (!message || !result || editing) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Войдите в аккаунт");
      return;
    }

    setError("");
    setInput("");
    setBubbles((prev) => [
      ...prev,
      { id: uid(), kind: "text", role: "user", content: message },
    ]);
    setEditing(true);
    setShowPreviewPane(true);

    const beforeKey = `${result.html}\n${result.css}\n${result.js}`;

    try {
      const res = await fetch("/api/edit-site", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          html: result.html,
          css: result.css,
          js: result.js,
          editPrompt: message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка правки");
      if (!data.html?.trim()) throw new Error("Пустой ответ модели");

      const next: WizardResult = {
        html: data.html,
        css: data.css ?? result.css,
        js: data.js ?? result.js,
        id: result.id,
      };
      const afterKey = `${next.html}\n${next.css}\n${next.js}`;
      if (afterKey === beforeKey) {
        onBalanceRefresh();
        pushAssistant(
          "Модель ничего не изменила в коде. Сформулируй правку конкретнее: «сделай кнопки зелёными», «убери блок отзывов».",
          true
        );
        return;
      }

      setResult(next);
      setPreviewHtml(
        buildPreviewHtml({
          html: next.html,
          css: next.css,
          js: next.js,
        })
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
      pushAssistant("Правку применил — смотри превью справа.", true);
      // Обновить уже опубликованный сайт
      try {
        await fetch("/api/publish/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            siteId: next.id,
            html: next.html,
            css: next.css,
            js: next.js,
            title: brief.topic,
          }),
        });
      } catch {
        /* нет публикации */
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка правки";
      setError(msg);
      pushAssistant(`Не удалось править: ${msg}`, true);
    } finally {
      setEditing(false);
    }
  }

  async function sendChat(text: string) {
    const message = text.trim();
    if (!message || chatLoading || editing) return;

    // После сборки: правка → edit-site; болтовня → чат
    if (result) {
      if (looksLikeSiteEdit(message)) {
        await applySiteEdit(message);
        return;
      }
      // fall through to chat below (with result still set)
    }

    setError("");
    setBubbles((prev) => [
      ...prev,
      { id: uid(), kind: "text", role: "user", content: message },
    ]);
    setInput("");

    const isFirstTopic = !brief.topic || brief.topic.length < 3;
    const nextBrief = { ...brief };

    if (isFirstTopic && !result) {
      nextBrief.topic = message;
      nextBrief.nicheId = detectNicheFromTopic(message);
      const city = extractCityFromTopic(message);
      if (city && !nextBrief.city) nextBrief.city = city;
      nextBrief.seoFocus = joinSeoPhrases(suggestSeoPhrases(nextBrief));
      setBrief(nextBrief);
      ensureScriptMenus(nextBrief);
      return;
    }

    nextBrief.notes = [nextBrief.notes, message].filter(Boolean).join("\n");
    if (!nextBrief.nicheId) {
      nextBrief.nicheId = detectNicheFromTopic(
        `${nextBrief.topic}\n${message}`
      );
    }
    setBrief(nextBrief);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Войдите в аккаунт");
      return;
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
    setShowCustomPicker(false);
    setBubbles((prev) => [
      ...prev,
      {
        id: uid(),
        kind: "text",
        role: "user",
        content: `Палитра: ${pal.label}`,
      },
    ]);
    ensureScriptMenus(next);
  }

  function confirmCustomPalette() {
    if (brief.paletteId) return;
    const next = {
      ...brief,
      paletteId: "custom",
      colors: [...customColors],
    };
    setBrief(next);
    setShowCustomPicker(false);
    setBubbles((prev) => [
      ...prev,
      {
        id: uid(),
        kind: "text",
        role: "user",
        content: "Палитра: Своя",
      },
    ]);
    ensureScriptMenus(next);
  }

  function confirmDetails() {
    if (brief.companyName.trim().length < 2) {
      pushAssistant("Укажи название компании или бренда.", true);
      return;
    }
    const phrases = parseSeoPhrases(brief.seoFocus);
    const seo =
      phrases.length > 0
        ? joinSeoPhrases(phrases)
        : joinSeoPhrases(suggestSeoPhrases(brief));
    const next = {
      ...brief,
      seoFocus: seo,
      detailsConfirmed: true,
    };
    setBrief(next);
    setBubbles((prev) => [
      ...prev,
      {
        id: uid(),
        kind: "text",
        role: "user",
        content: [
          `Компания: ${brief.companyName.trim()}`,
          brief.city.trim() ? `Город: ${brief.city.trim()}` : null,
          brief.phone.trim() ? `Тел: ${brief.phone.trim()}` : null,
          seo ? `Запросы: ${seo}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    ]);
    ensureScriptMenus(next);
  }

  function confirmAssets() {
    const next = { ...brief, assetsConfirmed: true };
    setBrief(next);
    const bits = [
      brief.logoUrl ? "логотип" : null,
      brief.referenceUrls.length
        ? `референсы (${brief.referenceUrls.length})`
        : null,
      brief.tzFileName ? `ТЗ: ${brief.tzFileName}` : null,
    ].filter(Boolean);
    setBubbles((prev) => [
      ...prev,
      {
        id: uid(),
        kind: "text",
        role: "user",
        content: bits.length
          ? `Материалы: ${bits.join(", ")}`
          : "Без референса и ТЗ — ок",
      },
    ]);
    ensureScriptMenus(next);
  }

  async function uploadWizardFiles(
    kind: "reference" | "logo" | "tz",
    files: FileList | null
  ) {
    if (!files?.length) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Войдите в аккаунт");
      return;
    }
    setUploadingKind(kind);
    setError("");
    try {
      if (kind === "tz") {
        const file = files[0];
        const isText =
          file.type.startsWith("text/") ||
          /\.(txt|md|markdown|csv)$/i.test(file.name);
        if (isText) {
          const text = await file.text();
          setBrief((prev) => ({
            ...prev,
            tzText: text.slice(0, 8000),
            tzFileName: file.name,
          }));
          return;
        }
      }

      const form = new FormData();
      form.append("kind", kind === "logo" ? "logo" : "files");
      Array.from(files).forEach((f) => {
        form.append("files", f, f.name);
        form.append("file", f, f.name);
      });
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
      const urls: string[] = data.urls ?? (data.url ? [data.url] : []);
      if (kind === "logo") {
        setBrief((prev) => ({ ...prev, logoUrl: urls[0] ?? null }));
      } else if (kind === "reference") {
        setBrief((prev) => ({
          ...prev,
          referenceUrls: [...prev.referenceUrls, ...urls].slice(0, 6),
        }));
      } else {
        setBrief((prev) => ({
          ...prev,
          tzFileName: files[0]?.name ?? "ТЗ",
          tzText: prev.tzText || `Файл ТЗ загружен: ${urls[0] ?? ""}`,
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploadingKind(null);
    }
  }

  function toggleVoice() {
    if (listening) {
      try {
        speechRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    const w = window as Window & {
      SpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        start: () => void;
        stop: () => void;
        onresult: ((ev: {
          resultIndex: number;
          results: ArrayLike<{
            0?: { transcript?: string };
            isFinal: boolean;
          }>;
        }) => void) | null;
        onerror: ((ev: { error: string }) => void) | null;
        onend: (() => void) | null;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        start: () => void;
        stop: () => void;
        onresult: ((ev: {
          resultIndex: number;
          results: ArrayLike<{
            0?: { transcript?: string };
            isFinal: boolean;
          }>;
        }) => void) | null;
        onerror: ((ev: { error: string }) => void) | null;
        onend: (() => void) | null;
      };
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Голос — только в Chrome или Edge");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = true;
    speechRef.current = recognition;
    setListening(true);
    let committed = input;
    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      if (finalText) {
        committed = committed.trim()
          ? `${committed.trim()} ${finalText.trim()}`
          : finalText.trim();
        setInput(committed);
      } else if (interim) {
        setInput(committed ? `${committed} ${interim}` : interim);
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      const finalMsg = committed.trim();
      if (finalMsg && resultRef.current) {
        setInput(finalMsg);
        window.setTimeout(() => {
          void sendChat(finalMsg);
        }, 60);
      }
    };
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
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
      {
        id: uid(),
        kind: "text",
        role: "assistant",
        content:
          tier === "premium"
            ? "Премиум выбран. Бриф готов — жми «Собрать сайт», превью справа."
            : "Простой лендинг. Бриф готов — жми «Собрать сайт», превью справа.",
        animate: true,
      },
    ]);
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
        "Сайт собран. Справа превью — скажи или напиши правку («кнопки зелёные»), добавь картинки или жми «Опубликовать».",
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

  async function addImages(count: number) {
    if (!result || imagesLoading) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Войдите в аккаунт");
      return;
    }
    const n = Math.min(8, Math.max(1, count));
    setImagePickerOpen(false);
    setImagesLoading(true);
    setError("");
    try {
      const niche =
        (brief.nicheId ? getTemplateById(brief.nicheId)?.name : null) ??
        detectNicheFromTopic(brief.topic);
      const prompts = imagePromptsFromBrief(brief.topic, niche, n);
      const urls: string[] = [];
      for (const prompt of prompts) {
        const url = await generateOneImage(accessToken, prompt);
        if (url) urls.push(url);
      }
      if (!urls.length) {
        pushAssistant(
          "Картинки не удалось получить — токены за них не должны были списаться повторно.",
          true
        );
        return;
      }
      const { html, injected } = injectSiteImagesDetailed(result.html, urls);
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
      try {
        await fetch("/api/publish/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            siteId: next.id,
            html: next.html,
            css: next.css,
            js: next.js,
            title: brief.topic,
          }),
        });
      } catch {
        /* нет публикации */
      }
      pushAssistant(
        injected > 0
          ? `Добавил ${urls.length} из ${n} картинок (вставлено в блоки: ${injected}). Смотри превью.`
          : `Сгенерировал ${urls.length} картинки, но не нашёл куда вставить. Напиши «добавь фото в карточки».`,
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

  function openImagePicker() {
    if (!result || imagesLoading || editing) return;
    const info = countImageSlots(result.html);
    setImagePickCount(Math.min(info.slots, 4));
    setImagePickerOpen(true);
  }

  function resetWizard() {
    setBrief(emptyWizardBrief());
    setResult(null);
    setPreviewHtml("");
    setError("");
    setShowPreviewPane(false);
    setShowCustomPicker(false);
    setBubbles([]);
    try {
      localStorage.removeItem(WIZARD_STORAGE_KEY);
    } catch {
      /* ignore */
    }
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
          <div className="absolute -left-16 top-8 h-48 w-48 rounded-full bg-violet-600/[0.07] blur-3xl" />
        </div>

        <div className="relative z-[1] flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-400/20">
              <Wand2 className="h-5 w-5 text-violet-200" />
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
            title="Сбросить мастер и начать новый сайт"
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Заново
          </button>
        </div>

        <div
          className={`relative z-[1] flex-1 overflow-y-auto px-5 py-5 ${
            isFreshStart ? "flex flex-col justify-center" : ""
          }`}
        >
          <div
            className={`mx-auto w-full space-y-4 ${
              showPreviewPane ? "max-w-xl" : "max-w-3xl"
            }`}
          >
            {isFreshStart ? (
              <div className="mb-4 w-full animate-[wcFadeIn_0.5s_ease] px-1 py-2 sm:py-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                  С чего начать
                </p>
                <h2 className="mt-4 font-display text-3xl tracking-tight text-zinc-50 sm:text-4xl">
                  Опиши бизнес одной фразой
                </h2>
                <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-zinc-400">
                  Например: магазин мебели, стоматология, кафе.
                </p>
                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    "магазин мебели",
                    "стоматология",
                    "кафе",
                    "IT-стартап",
                  ].map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      onClick={() => void sendChat(hint)}
                      className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3.5 text-[14px] text-zinc-200 transition hover:border-violet-400/35 hover:bg-violet-500/10"
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
                const customSelected = brief.paletteId === "custom";
                const palA =
                  WIZARD_PALETTES.find((p) => p.id === abA) ?? WIZARD_PALETTES[0];
                const palB =
                  WIZARD_PALETTES.find((p) => p.id === abB) ?? WIZARD_PALETTES[1];
                const locked = Boolean(brief.paletteId);
                return (
                  <div
                    key={b.id}
                    className="w-full max-w-3xl animate-[wcFadeIn_0.4s_ease] rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-5 sm:p-6"
                  >
                    <p className="mb-1 text-[15px] font-medium text-zinc-100">
                      {b.title}
                    </p>
                    <p className="mb-4 text-[13px] text-zinc-500">
                      A/B сравнение — выбери сторону или любую из списка ниже
                    </p>

                    <div className="mb-5 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            Вариант A
                          </span>
                          <select
                            disabled={locked}
                            value={abA}
                            onChange={(e) => setAbA(e.target.value)}
                            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[12px] text-zinc-200"
                          >
                            {WIZARD_PALETTES.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <PaletteMock
                          colors={palA.colors}
                          label={palA.label}
                          disabled={locked}
                          active={brief.paletteId === palA.id}
                          onPick={() => pickPalette(palA.id)}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                            Вариант B
                          </span>
                          <select
                            disabled={locked}
                            value={abB}
                            onChange={(e) => setAbB(e.target.value)}
                            className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[12px] text-zinc-200"
                          >
                            {WIZARD_PALETTES.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <PaletteMock
                          colors={palB.colors}
                          label={palB.label}
                          disabled={locked}
                          active={brief.paletteId === palB.id}
                          onPick={() => pickPalette(palB.id)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {WIZARD_PALETTES.map((p) => {
                        const selected = brief.paletteId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={locked}
                            onClick={() => pickPalette(p.id)}
                            className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition ${
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
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => setShowCustomPicker(true)}
                        className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition duration-300 ${
                          customSelected || showCustomPicker
                            ? "border-violet-400/50 bg-violet-500/15"
                            : "border-dashed border-white/20 bg-black/25 hover:border-white/35"
                        } disabled:opacity-50`}
                      >
                        <span className="flex -space-x-2">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-white/30 bg-white/[0.03] text-zinc-400"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </span>
                          ))}
                        </span>
                        <span className="text-[14px] text-zinc-200">Свой</span>
                      </button>
                    </div>
                    {showCustomPicker && !brief.paletteId ? (
                      <div className="wc-expand-in mt-4 rounded-2xl border border-white/10 bg-[#0a0b12] p-4">
                        <p className="mb-3 text-[13px] text-zinc-400">
                          Три цвета: акцент, светлый, тёмный
                        </p>
                        <div className="flex flex-wrap items-center gap-5">
                          {customColors.map((c, i) => (
                            <label
                              key={i}
                              className="flex flex-col items-center gap-2 text-[12px] text-zinc-400"
                            >
                              <span
                                className="wc-color-swatch"
                                style={{ background: c }}
                              >
                                <input
                                  type="color"
                                  value={c}
                                  onChange={(e) => {
                                    const next = [...customColors] as [
                                      string,
                                      string,
                                      string,
                                    ];
                                    next[i] = e.target.value;
                                    setCustomColors(next);
                                  }}
                                  aria-label={
                                    i === 0
                                      ? "Акцент"
                                      : i === 1
                                        ? "Светлый"
                                        : "Тёмный"
                                  }
                                />
                              </span>
                              {i === 0
                                ? "Акцент"
                                : i === 1
                                  ? "Светлый"
                                  : "Тёмный"}
                            </label>
                          ))}
                          <button
                            type="button"
                            onClick={confirmCustomPalette}
                            className="rounded-xl bg-violet-500/25 px-4 py-2.5 text-[13px] font-medium text-violet-100 ring-1 ring-violet-400/30 transition hover:bg-violet-500/35"
                          >
                            Применить
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (b.step === "details") {
                const locked = brief.detailsConfirmed;
                const phrases = parseSeoPhrases(brief.seoFocus);

                const commitSeoDraft = () => {
                  const t = seoDraft.replace(/[—–]/g, "-").trim();
                  if (!t) return;
                  setBrief((prev) => {
                    const list = parseSeoPhrases(prev.seoFocus);
                    if (list.some((x) => x.toLowerCase() === t.toLowerCase())) {
                      return prev;
                    }
                    return {
                      ...prev,
                      seoFocus: joinSeoPhrases([...list, t]),
                    };
                  });
                  setSeoDraft("");
                };

                return (
                  <div
                    key={b.id}
                    className="wc-expand-in w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                  >
                    <p className="mb-1 text-[15px] font-medium text-zinc-100">
                      {b.title}
                    </p>
                    <p className="mb-4 text-[13px] leading-relaxed text-zinc-500">
                      Как назвать компанию и куда звонить клиентам.
                    </p>
                    <div className="space-y-3">
                      <input
                        value={brief.companyName}
                        disabled={locked}
                        onChange={(e) =>
                          setBrief((prev) => ({
                            ...prev,
                            companyName: e.target.value,
                          }))
                        }
                        placeholder="Название компании *"
                        className="wc-input w-full py-2.5 text-[14px] disabled:opacity-50"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={brief.city}
                          disabled={locked}
                          onChange={(e) =>
                            setBrief((prev) => ({
                              ...prev,
                              city: e.target.value,
                            }))
                          }
                          placeholder="Город (если нужен)"
                          className="wc-input w-full py-2.5 text-[14px] disabled:opacity-50"
                        />
                        <input
                          value={brief.phone}
                          disabled={locked}
                          onChange={(e) =>
                            setBrief((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="Телефон"
                          className="wc-input w-full py-2.5 text-[14px] disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12px] text-zinc-500">
                          Фразы для поиска (можно править, добавлять и удалять)
                        </label>
                        <ul className="space-y-2">
                          {phrases.map((phrase, idx) => (
                            <li
                              key={`${idx}-${phrase.slice(0, 24)}`}
                              className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2"
                            >
                              <Check
                                className="h-4 w-4 shrink-0 text-emerald-400"
                                aria-hidden
                              />
                              {seoEditingIdx === idx && !locked ? (
                                <input
                                  value={seoEditText}
                                  autoFocus
                                  onChange={(e) =>
                                    setSeoEditText(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const t = seoEditText
                                        .replace(/[—–]/g, "-")
                                        .trim();
                                      if (!t) return;
                                      setBrief((prev) => {
                                        const list = parseSeoPhrases(
                                          prev.seoFocus
                                        );
                                        list[idx] = t;
                                        return {
                                          ...prev,
                                          seoFocus: joinSeoPhrases(list),
                                        };
                                      });
                                      setSeoEditingIdx(null);
                                    }
                                    if (e.key === "Escape") {
                                      setSeoEditingIdx(null);
                                    }
                                  }}
                                  className="wc-input min-w-0 flex-1 py-1.5 text-[13px]"
                                />
                              ) : (
                                <button
                                  type="button"
                                  disabled={locked}
                                  onClick={() => {
                                    if (locked) return;
                                    setSeoEditingIdx(idx);
                                    setSeoEditText(phrase);
                                  }}
                                  className="min-w-0 flex-1 truncate text-left text-[13px] text-zinc-200 disabled:opacity-60"
                                  title="Нажми, чтобы редактировать"
                                >
                                  {phrase}
                                </button>
                              )}
                              {!locked ? (
                                <button
                                  type="button"
                                  title="Удалить"
                                  onClick={() =>
                                    setBrief((prev) => {
                                      const list = parseSeoPhrases(
                                        prev.seoFocus
                                      );
                                      list.splice(idx, 1);
                                      return {
                                        ...prev,
                                        seoFocus: joinSeoPhrases(list),
                                      };
                                    })
                                  }
                                  className="rounded-lg p-1 text-zinc-500 transition hover:bg-white/5 hover:text-rose-300"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        {!locked ? (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              value={seoDraft}
                              onChange={(e) => setSeoDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commitSeoDraft();
                                }
                              }}
                              placeholder="Ещё фраза…"
                              className="wc-input min-w-0 flex-1 py-2 text-[13px]"
                            />
                            <button
                              type="button"
                              title="Подтвердить фразу"
                              onClick={commitSeoDraft}
                              className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 p-2 text-emerald-200 transition hover:bg-emerald-500/25"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Добавить ещё"
                              onClick={() => {
                                if (seoDraft.trim()) commitSeoDraft();
                                else {
                                  const el =
                                    document.activeElement as HTMLElement | null;
                                  el?.blur?.();
                                }
                              }}
                              className="rounded-xl border border-white/12 bg-white/[0.04] p-2 text-zinc-300 transition hover:border-violet-400/35 hover:bg-violet-500/10"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {!locked ? (
                      <button
                        type="button"
                        onClick={confirmDetails}
                        className="mt-4 rounded-xl bg-violet-500/25 px-4 py-2.5 text-[13px] font-medium text-violet-100 ring-1 ring-violet-400/30 transition hover:bg-violet-500/35"
                      >
                        Дальше
                      </button>
                    ) : null}
                  </div>
                );
              }

              if (b.step === "assets") {
                const locked = brief.assetsConfirmed;
                return (
                  <div
                    key={b.id}
                    className="wc-expand-in w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                  >
                    <p className="mb-1 text-[15px] font-medium text-zinc-100">
                      {b.title}
                    </p>
                    <p className="mb-4 text-[13px] leading-relaxed text-zinc-500">
                      Можно пропустить. Если есть — сайт будет ближе к вашему
                      стилю.
                    </p>
                    <div className="space-y-2.5">
                      <input
                        ref={refInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          void uploadWizardFiles("reference", e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept={LOGO_ACCEPT}
                        className="hidden"
                        onChange={(e) => {
                          void uploadWizardFiles("logo", e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <input
                        ref={tzInputRef}
                        type="file"
                        accept=".txt,.md,.pdf,.doc,.docx,text/plain,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          void uploadWizardFiles("tz", e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        disabled={locked || uploadingKind === "reference"}
                        onClick={() => refInputRef.current?.click()}
                        className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-left text-[13px] text-zinc-200 transition hover:border-white/25 disabled:opacity-50"
                      >
                        <span>Референс (картинки сайта)</span>
                        <span className="text-zinc-500">
                          {uploadingKind === "reference"
                            ? "…"
                            : brief.referenceUrls.length
                              ? `${brief.referenceUrls.length} файл.`
                              : "+"}
                        </span>
                      </button>
                      {brief.referenceUrls.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {brief.referenceUrls.map((url) => (
                            <div
                              key={url}
                              className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/40"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt="Референс"
                                className="h-full w-full object-cover"
                              />
                              {!locked ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setBrief((prev) => ({
                                      ...prev,
                                      referenceUrls: prev.referenceUrls.filter(
                                        (u) => u !== url
                                      ),
                                    }))
                                  }
                                  className="absolute right-1 top-1 rounded-md bg-black/70 px-1.5 text-[11px] text-zinc-200"
                                >
                                  ×
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        disabled={locked || uploadingKind === "logo"}
                        onClick={() => logoInputRef.current?.click()}
                        className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-left text-[13px] text-zinc-200 transition hover:border-white/25 disabled:opacity-50"
                      >
                        <span>Логотип</span>
                        <span className="text-zinc-500">
                          {uploadingKind === "logo"
                            ? "…"
                            : brief.logoUrl
                              ? "загружен"
                              : "+"}
                        </span>
                      </button>
                      {brief.logoUrl ? (
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={brief.logoUrl}
                            alt="Логотип"
                            className="h-12 w-12 rounded-lg object-contain bg-white/5"
                          />
                          <span className="truncate text-[12px] text-zinc-400">
                            {brief.logoUrl.split("/").pop()}
                          </span>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        disabled={locked || uploadingKind === "tz"}
                        onClick={() => tzInputRef.current?.click()}
                        className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-left text-[13px] text-zinc-200 transition hover:border-white/25 disabled:opacity-50"
                      >
                        <span>Файл ТЗ</span>
                        <span className="text-zinc-500">
                          {uploadingKind === "tz"
                            ? "…"
                            : brief.tzFileName
                              ? brief.tzFileName
                              : "+"}
                        </span>
                      </button>
                    </div>
                    {!locked ? (
                      <button
                        type="button"
                        onClick={confirmAssets}
                        className="mt-4 rounded-xl bg-violet-500/25 px-4 py-2.5 text-[13px] font-medium text-violet-100 ring-1 ring-violet-400/30 transition hover:bg-violet-500/35"
                      >
                        {brief.logoUrl ||
                        brief.referenceUrls.length ||
                        brief.tzFileName
                          ? "Дальше"
                          : "Пропустить"}
                      </button>
                    ) : null}
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

              if (b.step !== "tier") return null;

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

            {chatLoading || editing ? (
              <div className="inline-flex items-center gap-2 text-[13px] text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {editing ? "Правлю сайт…" : "Печатаю…"}
              </div>
            ) : null}

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
                <>
                  <button
                    type="button"
                    disabled={imagesLoading || editing}
                    onClick={() => openImagePicker()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-4 py-2.5 text-[13px] text-zinc-200 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    {imagesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                    Картинки
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/15 px-4 py-2.5 text-[13px] text-violet-100 transition hover:bg-violet-500/25"
                  >
                    <Rocket className="h-4 w-4" />
                    Опубликовать
                  </button>
                </>
              ) : null}
            </div>
          )}
          {imagePickerOpen && result ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              {(() => {
                const info = countImageSlots(result.html);
                const max = info.slots;
                const cost = imageCost * imagePickCount;
                return (
                  <>
                    <p className="text-[13px] text-zinc-300">
                      На сайте примерно{" "}
                      <span className="text-zinc-100">{max}</span> мест под
                      фото
                      {info.emptyCards
                        ? ` (карточек без фото: ${info.emptyCards})`
                        : ""}
                      . Сколько сгенерировать?
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setImagePickCount(n)}
                          className={`min-w-9 rounded-lg px-2.5 py-1.5 text-[13px] ${
                            imagePickCount === n
                              ? "bg-violet-500/30 text-violet-100 ring-1 ring-violet-400/40"
                              : "bg-black/30 text-zinc-400 hover:bg-white/5"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={imagesLoading}
                        onClick={() => void addImages(imagePickCount)}
                        className="wc-btn wc-btn-primary px-3 py-2 text-[13px] disabled:opacity-50"
                      >
                        Сгенерировать {imagePickCount} (−{cost} ток.)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImagePickerOpen(false)}
                        className="rounded-xl px-3 py-2 text-[13px] text-zinc-500 hover:text-zinc-300"
                      >
                        Отмена
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : null}
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
                result
                  ? "Правка голосом или текстом: «кнопки зелёные»…"
                  : brief.topic
                    ? "Уточнение…"
                    : "Напиши тему сайта…"
              }
              className="wc-input flex-1 py-3 text-[14px]"
              disabled={chatLoading || editing}
            />
            <button
              type="button"
              onClick={toggleVoice}
              title="Голосовой ввод"
              className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 ${
                listening ? "wc-mic-recording" : ""
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              type="submit"
              disabled={chatLoading || editing || !input.trim()}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {showPreviewPane ? (
        <div className="flex min-h-[320px] flex-1 flex-col bg-black/25">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5 sm:px-5">
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-0.5">
              {(
                [
                  { id: "phone" as const, Icon: Smartphone, label: "Телефон" },
                  { id: "tablet" as const, Icon: Tablet, label: "Планшет" },
                  { id: "desktop" as const, Icon: Monitor, label: "ПК" },
                ] as const
              ).map(({ id, Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => setPreviewDevice(id)}
                  className={`rounded-lg p-2 transition ${
                    previewDevice === id
                      ? "bg-violet-500/25 text-violet-100"
                      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Полный экран"
                onClick={() => {
                  const el = previewStageRef.current;
                  if (!el) return;
                  if (document.fullscreenElement) {
                    void document.exitFullscreen();
                  } else {
                    void el.requestFullscreen?.();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-zinc-300 transition hover:bg-white/5"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">На весь экран</span>
              </button>
              {result ? (
                <button
                  type="button"
                  onClick={() => setPublishOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/15 px-2.5 py-1.5 text-[12px] text-violet-100 transition hover:bg-violet-500/25"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  Опубликовать
                </button>
              ) : null}
            </div>
          </div>
          <div
            ref={previewStageRef}
            className="wc-preview-stage min-h-0 flex-1 bg-[#07080d] p-3 sm:p-4"
          >
            {building || editing ? (
              building ? (
                <BuildLoader />
              ) : (
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0a0b10] text-[14px] text-zinc-400">
                  <Loader2 className="mb-3 h-6 w-6 animate-spin text-violet-300" />
                  Применяю правку…
                </div>
              )
            ) : previewHtml ? (
              <div
                className="wc-preview-shell mx-auto h-full min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/40"
                data-device={previewDevice}
                style={{
                  width:
                    PREVIEW_DEVICE_WIDTH[previewDevice] != null
                      ? `${PREVIEW_DEVICE_WIDTH[previewDevice]}px`
                      : "100%",
                  maxWidth: "100%",
                }}
              >
                <iframe
                  title="wizard-preview"
                  srcDoc={previewHtml}
                  className="h-full min-h-[420px] w-full border-0 bg-white"
                />
              </div>
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-[14px] text-zinc-600">
                Превью появится после сборки
              </div>
            )}
          </div>
        </div>
      ) : null}

      {result ? (
        <PublishModal
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          getAccessToken={getAccessToken}
          site={{
            id: result.id,
            html: result.html,
            css: result.css,
            js: result.js,
            title: brief.companyName.trim() || brief.topic,
          }}
        />
      ) : null}
    </div>
  );
}
