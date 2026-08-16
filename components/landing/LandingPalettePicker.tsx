"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { WIZARD_PALETTES, type WizardPalette } from "@/lib/wizardBrief";

type Props = {
  selectedId: string | null;
  locked?: boolean;
  onPick: (palette: WizardPalette) => void;
  onPickCustom: (colors: [string, string, string]) => void;
};

function MiniSitePreview({
  colors,
  label,
  active,
}: {
  colors: string[];
  label: string;
  active?: boolean;
}) {
  const accent = colors[0] ?? "#6c3bf4";
  const light = colors[1] ?? "#f5f3ff";
  const dark = colors[2] ?? "#0b0f19";

  return (
    <div
      style={{
        background: dark,
        color: light,
        borderRadius: 14,
        padding: "10px 12px 12px",
        overflow: "hidden",
        boxShadow: active
          ? `inset 0 0 0 1px ${accent}aa, 0 0 22px ${accent}55`
          : "inset 0 0 0 1px rgba(255,255,255,0.07)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          {label}
        </span>
        <span
          style={{
            borderRadius: 999,
            padding: "3px 8px",
            fontSize: 9,
            fontWeight: 700,
            background: accent,
            color: "#fff",
          }}
        >
          CTA
        </span>
      </div>
      <div
        style={{
          borderRadius: 12,
          padding: "12px 11px 12px",
          background: `${accent}2e`,
        }}
      >
        <div
          style={{
            height: 7,
            width: "64%",
            borderRadius: 999,
            background: light,
            opacity: 0.92,
          }}
        />
        <div
          style={{
            height: 5,
            width: "80%",
            marginTop: 7,
            borderRadius: 999,
            background: light,
            opacity: 0.32,
          }}
        />
        <span
          style={{
            display: "inline-block",
            marginTop: 11,
            borderRadius: 8,
            padding: "5px 10px",
            fontSize: 10,
            fontWeight: 700,
            background: accent,
            color: "#fff",
          }}
        >
          Кнопка
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 7,
          marginTop: 10,
        }}
      >
        {[0.38, 0.24, 0.14].map((a, i) => (
          <span
            key={i}
            style={{
              height: 28,
              borderRadius: 7,
              background: `${accent}${Math.round(a * 255)
                .toString(16)
                .padStart(2, "0")}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function LandingPalettePicker({
  selectedId,
  locked = false,
  onPick,
  onPickCustom,
}: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [customColors, setCustomColors] = useState<[string, string, string]>([
    "#7c3aed",
    "#ede9fe",
    "#0b1024",
  ]);

  return (
    <div className="wc-space-pal">
      <p className="wc-space-pal-lead">
        Выбери палитру. Превью покажет, как цвета лягут на сайт
      </p>

      <div className="wc-space-pal-grid">
        {WIZARD_PALETTES.map((p) => {
          const selected = selectedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={locked && !selected}
              onClick={() => onPick(p)}
              className={`wc-space-pal-card ${selected ? "is-selected" : ""}`}
              aria-pressed={selected}
            >
              <MiniSitePreview
                colors={p.colors}
                label={p.label}
                active={selected}
              />
              <span className="wc-space-pal-meta">
                <span className="wc-space-pal-swatches" aria-hidden>
                  {p.colors.map((c) => (
                    <span
                      key={c}
                      className="wc-space-pal-dot"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                <span className="wc-space-pal-name">{p.label}</span>
                {selected ? (
                  <span className="wc-space-pal-badge">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Выбрано
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          disabled={locked && selectedId !== "custom"}
          onClick={() => {
            if (locked) return;
            setShowCustom((v) => !v);
          }}
          className={`wc-space-pal-card wc-space-pal-card-custom ${
            selectedId === "custom" || showCustom ? "is-selected" : ""
          }`}
          aria-pressed={selectedId === "custom"}
        >
          <div className="wc-space-pal-custom-mock">
            <span className="wc-space-pal-custom-plus">
              <Plus className="h-5 w-5" />
            </span>
            <span className="wc-space-pal-custom-title">Свои цвета</span>
            <span className="wc-space-pal-custom-sub">
              Акцент · светлый · тёмный
            </span>
          </div>
          <span className="wc-space-pal-meta">
            <span className="wc-space-pal-name">Свой вариант</span>
            {selectedId === "custom" ? (
              <span className="wc-space-pal-badge">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Выбрано
              </span>
            ) : null}
          </span>
        </button>
      </div>

      {showCustom && !locked ? (
        <div className="wc-space-pal-custom">
          <p className="wc-space-pal-custom-hint">Подбери три цвета</p>
          <div className="wc-space-pal-custom-row">
            {customColors.map((c, i) => (
              <label key={i} className="wc-space-pal-custom-label">
                <span className="wc-color-swatch" style={{ background: c }}>
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
                      i === 0 ? "Акцент" : i === 1 ? "Светлый" : "Тёмный"
                    }
                  />
                </span>
                <span>
                  {i === 0 ? "Акцент" : i === 1 ? "Светлый" : "Тёмный"}
                </span>
              </label>
            ))}
            <button
              type="button"
              className="wc-space-pal-apply"
              onClick={() => {
                onPickCustom(customColors);
                setShowCustom(false);
              }}
            >
              Применить
            </button>
          </div>
          <MiniSitePreview colors={customColors} label="Свой" active />
        </div>
      ) : null}
    </div>
  );
}

/** Печать ответа по буквам */
export function LandingTypewriter({
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
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + 1);
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone?.();
        }
      }
    }, 22);
    return () => window.clearInterval(id);
    // только текст — иначе ререндер родителя сбрасывает печать
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span>
      {shown}
      {shown.length < text.length ? (
        <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-violet-300/90 align-middle" />
      ) : null}
    </span>
  );
}
