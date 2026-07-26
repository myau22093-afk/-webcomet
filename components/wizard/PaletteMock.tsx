"use client";

/** Мини-мок лендинга для сравнения палитр A/B */
export function PaletteMock({
  colors,
  label,
  active,
  onPick,
  disabled,
}: {
  colors: string[];
  label: string;
  active?: boolean;
  onPick?: () => void;
  disabled?: boolean;
}) {
  const [accent, light, dark] = [
    colors[0] ?? "#6c3bf4",
    colors[1] ?? "#f5f3ff",
    colors[2] ?? "#0b0f19",
  ];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={`w-full overflow-hidden rounded-2xl border text-left transition duration-300 ${
        active
          ? "border-violet-400/55 ring-1 ring-violet-400/30"
          : "border-white/10 hover:border-white/25"
      } disabled:opacity-50`}
    >
      <div
        className="px-3 pb-3 pt-2.5"
        style={{ background: dark, color: light }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className="text-[10px] font-semibold tracking-wide"
            style={{ color: accent }}
          >
            {label}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-medium"
            style={{ background: accent, color: "#fff" }}
          >
            CTA
          </span>
        </div>
        <div
          className="rounded-xl px-2.5 py-3"
          style={{ background: `${accent}22` }}
        >
          <div
            className="h-2 w-3/5 rounded-full"
            style={{ background: light, width: "62%", opacity: 0.9 }}
          />
          <div
            className="mt-1.5 h-1.5 w-4/5 rounded-full"
            style={{ background: light, width: "78%", opacity: 0.35 }}
          />
          <div
            className="mt-2.5 inline-block rounded-md px-2.5 py-1 text-[9px] font-semibold"
            style={{ background: accent, color: "#fff" }}
          >
            Кнопка
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-7 rounded-md"
              style={{ background: `${accent}${i === 0 ? "55" : "28"}` }}
            />
          ))}
        </div>
      </div>
    </button>
  );
}
