"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Send,
  Sparkles,
  ImageIcon,
  RotateCcw,
} from "lucide-react";
import { buildPreviewHtml } from "@/lib/sitePreview";
import { getTokenCost } from "@/lib/tokenConfig";
import {
  WIZARD_PALETTES,
  WIZARD_SITE_MODEL_ID,
  WIZARD_IMAGE_MODEL_ID,
  buildWizardSitePrompt,
  emptyWizardBrief,
  isBriefReady,
  nextScriptedStep,
  nicheOptions,
  sectionOptions,
  type WizardBrief,
} from "@/lib/wizardBrief";
import type { SiteSectionId } from "@/lib/brand";
import {
  imagePromptsFromBrief,
  injectSiteImages,
} from "@/lib/injectSiteImages";

type ChatBubble =
  | { id: string; kind: "text"; role: "user" | "assistant"; content: string }
  | {
      id: string;
      kind: "choice";
      step: "palette" | "sections" | "niche";
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
        "Привет! Я помогу собрать сайт. Напиши, для какого бизнеса или темы нужен лендинг — например «стоматология в Казани» или «кофейня».",
    },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [result, setResult] = useState<WizardResult | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const siteCost = getTokenCost(WIZARD_SITE_MODEL_ID);
  const imageCost = getTokenCost(WIZARD_IMAGE_MODEL_ID);
  const ready = isBriefReady(brief);
  const scriptStep = nextScriptedStep(brief);

  const briefSummary = useMemo(() => {
    const parts = [
      brief.topic ? `Тема: ${brief.topic}` : null,
      brief.paletteId ? `Палитра: ${brief.paletteId}` : null,
      brief.sections.length
        ? `Секции: ${brief.sections.join(", ")}`
        : null,
      brief.nicheId ? `Ниша: ${brief.nicheId}` : null,
      brief.notes ? `Заметки: ${brief.notes}` : null,
    ];
    return parts.filter(Boolean).join("\n");
  }, [brief]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, building, result]);

  function pushAssistant(content: string) {
    setBubbles((prev) => [
      ...prev,
      { id: uid(), kind: "text", role: "assistant", content },
    ]);
  }

  function pushChoice(step: "palette" | "sections" | "niche", title: string) {
    setBubbles((prev) => {
      if (prev.some((b) => b.kind === "choice" && b.step === step)) return prev;
      return [...prev, { id: uid(), kind: "choice", step, title }];
    });
  }

  function ensureScriptMenus(next: WizardBrief) {
    const step = nextScriptedStep(next);
    if (step === "palette") {
      pushChoice("palette", "Какая цветовая палитра?");
    } else if (step === "sections") {
      pushChoice("sections", "Какие блоки нужны на сайте?");
    } else if (step === "ready") {
      pushChoice("niche", "Какой шаблон / ниша ближе? (можно пропустить)");
      setBubbles((prev) => {
        if (
          prev.some(
            (b) =>
              b.kind === "text" &&
              b.role === "assistant" &&
              b.content.includes("Бриф готов")
          )
        ) {
          return prev;
        }
        return [
          ...prev,
          {
            id: uid(),
            kind: "text",
            role: "assistant",
            content:
              "Бриф готов. Можно собрать сайт — справа появится превью.",
          },
        ];
      });
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
      setBrief(nextBrief);
    } else {
      nextBrief.notes = [nextBrief.notes, message].filter(Boolean).join("\n");
      setBrief(nextBrief);
    }

    setChatLoading(true);
    try {
      const history = bubbles
        .filter((b): b is Extract<ChatBubble, { kind: "text" }> => b.kind === "text")
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
      pushAssistant(data.response ?? data.reply ?? "Ок");
      onBalanceRefresh();
      ensureScriptMenus(nextBrief);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка чата";
      setError(msg);
      pushAssistant(`Не удалось ответить: ${msg}`);
    } finally {
      setChatLoading(false);
    }
  }

  function pickPalette(id: string) {
    const pal = WIZARD_PALETTES.find((p) => p.id === id);
    if (!pal) return;
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
    pushAssistant(`Отлично, берём палитру «${pal.label}».`);
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
      pushAssistant("Выбери хотя бы два блока.");
      return;
    }
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
    pushAssistant("Структуру зафиксировал.");
    ensureScriptMenus(brief);
  }

  function pickNiche(id: string) {
    const niche = nicheOptions().find((n) => n.id === id);
    if (!niche) return;
    const next = { ...brief, nicheId: id };
    setBrief(next);
    setBubbles((prev) => [
      ...prev,
      {
        id: uid(),
        kind: "text",
        role: "user",
        content: `Шаблон: ${niche.label}`,
      },
    ]);
    pushAssistant(`Ниша «${niche.label}» — хороший старт. Можно собирать сайт.`);
  }

  async function buildSite() {
    if (!ready || building) return;
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Войдите в аккаунт");
      return;
    }
    setBuilding(true);
    setError("");
    try {
      const built = buildWizardSitePrompt(brief);
      const res = await fetch("/api/generate-site", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          prompt: built.prompt,
          customRequirements: built.customRequirements,
          brandColors: built.brandColors,
          sections: built.sections,
          modelId: WIZARD_SITE_MODEL_ID,
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
        prompt: built.prompt,
        html: site.html,
        css: site.css,
        js: site.js,
        createdAt: data.created_at ?? new Date().toISOString(),
      });
      onBalanceRefresh();
      pushAssistant("Сайт собран. Можешь добавить картинки кнопкой ниже.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка генерации";
      setError(msg);
      pushAssistant(`Не удалось собрать сайт: ${msg}`);
    } finally {
      setBuilding(false);
    }
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
      const niche = nicheOptions().find((n) => n.id === brief.nicheId);
      const prompts = imagePromptsFromBrief(brief.topic, niche?.label);
      const urls: string[] = [];
      for (const prompt of prompts) {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            prompt,
            modelId: WIZARD_IMAGE_MODEL_ID,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Ошибка картинки");
        const url = data.url ?? data.imageUrl;
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
          : "Картинки не удалось получить."
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка картинок";
      setError(msg);
      pushAssistant(`Картинки: ${msg}`);
    } finally {
      setImagesLoading(false);
    }
  }

  function resetWizard() {
    setBrief(emptyWizardBrief());
    setResult(null);
    setPreviewHtml("");
    setError("");
    setBubbles([
      {
        id: uid(),
        kind: "text",
        role: "assistant",
        content:
          "Начнём заново. Для какого бизнеса или темы делаем сайт?",
      },
    ]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 w-full flex-col border-white/10 lg:w-[42%] lg:border-r">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <div>
            <p className="text-sm font-medium text-zinc-100">Мастер сайта</p>
            <p className="text-[11px] text-zinc-500">
              Чат + выборы · сборка ≈{siteCost} ток.
            </p>
          </div>
          <button
            type="button"
            onClick={resetWizard}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/5"
          >
            <RotateCcw className="h-3 w-3" />
            Сначала
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {bubbles.map((b) => {
            if (b.kind === "text") {
              return (
                <div
                  key={b.id}
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    b.role === "user"
                      ? "ml-auto bg-violet-500/25 text-violet-50"
                      : "bg-white/5 text-zinc-200"
                  }`}
                >
                  {b.content}
                </div>
              );
            }

            if (b.step === "palette") {
              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-white/10 bg-black/25 p-3"
                >
                  <p className="mb-2 text-xs font-medium text-zinc-300">
                    {b.title}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {WIZARD_PALETTES.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={Boolean(brief.paletteId)}
                        onClick={() => pickPalette(p.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-2.5 py-1.5 text-[11px] text-zinc-200 hover:border-violet-400/50 disabled:opacity-40"
                      >
                        <span className="flex gap-0.5">
                          {p.colors.map((c) => (
                            <span
                              key={c}
                              className="h-3 w-3 rounded-full border border-white/20"
                              style={{ background: c }}
                            />
                          ))}
                        </span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            if (b.step === "sections") {
              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-white/10 bg-black/25 p-3"
                >
                  <p className="mb-2 text-xs font-medium text-zinc-300">
                    {b.title}
                  </p>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {sectionOptions().map((s) => {
                      const on = brief.sections.includes(s.id as SiteSectionId);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            toggleSection(s.id as SiteSectionId)
                          }
                          className={`rounded-full border px-2.5 py-1 text-[11px] ${
                            on
                              ? "border-violet-400/50 bg-violet-500/20 text-violet-100"
                              : "border-white/15 text-zinc-400"
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={confirmSections}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] text-zinc-100 hover:bg-white/15"
                  >
                    Дальше
                  </button>
                </div>
              );
            }

            return (
              <div
                key={b.id}
                className="rounded-2xl border border-white/10 bg-black/25 p-3"
              >
                <p className="mb-2 text-xs font-medium text-zinc-300">
                  {b.title}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {nicheOptions().map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      disabled={Boolean(brief.nicheId)}
                      onClick={() => pickNiche(n.id)}
                      className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-violet-400/50 disabled:opacity-40"
                    >
                      {n.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={Boolean(brief.nicheId)}
                    onClick={() => {
                      setBubbles((prev) => [
                        ...prev,
                        {
                          id: uid(),
                          kind: "text",
                          role: "user",
                          content: "Без шаблона ниши",
                        },
                      ]);
                      pushAssistant("Ок, соберём без готовой ниши.");
                    }}
                    className="rounded-full border border-dashed border-white/20 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-violet-400/40"
                  >
                    Пропустить
                  </button>
                </div>
              </div>
            );
          })}
          {(chatLoading || building || imagesLoading) && (
            <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {building
                ? "Собираю сайт…"
                : imagesLoading
                  ? "Генерирую картинки…"
                  : "Печатаю…"}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error ? (
          <p className="px-4 text-[11px] text-rose-300">{error}</p>
        ) : null}

        <div className="space-y-2 border-t border-white/10 p-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!ready || building}
              onClick={() => void buildSite()}
              className="wc-btn wc-btn-primary px-3 py-2 text-xs disabled:opacity-50"
            >
              {building ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Собрать сайт (−{siteCost})
            </button>
            {result ? (
              <button
                type="button"
                disabled={imagesLoading}
                onClick={() => void addImages()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-50"
              >
                {imagesLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                Добавить картинки (−{imageCost * 3})
              </button>
            ) : null}
          </div>
          {!ready && scriptStep ? (
            <p className="text-[10px] text-zinc-600">
              Ещё нужно:{" "}
              {scriptStep === "topic"
                ? "тема"
                : scriptStep === "palette"
                  ? "палитра"
                  : scriptStep === "sections"
                    ? "блоки"
                    : scriptStep === "niche"
                      ? "ниша"
                      : "готово"}
            </p>
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
              placeholder="Напиши тему или уточнение…"
              className="wc-input flex-1 text-sm"
              disabled={chatLoading}
            />
            <button
              type="submit"
              disabled={chatLoading || !input.trim()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-200 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <div className="flex min-h-[320px] flex-1 flex-col bg-black/20">
        <div className="border-b border-white/10 px-4 py-2 text-xs text-zinc-500">
          Превью
        </div>
        <div className="min-h-0 flex-1 p-3">
          {previewHtml ? (
            <iframe
              title="wizard-preview"
              srcDoc={previewHtml}
              className="h-full min-h-[420px] w-full rounded-xl border border-white/10 bg-white"
            />
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-zinc-600">
              Здесь появится сайт после «Собрать сайт»
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
