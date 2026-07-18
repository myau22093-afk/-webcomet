"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type WcSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type WcSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: WcSelectOption[];
  disabled?: boolean;
  title?: string;
  className?: string;
  placeholder?: string;
};

export function WcSelect({
  value,
  onChange,
  options,
  disabled = false,
  title,
  className = "",
  placeholder = "Выберите…",
}: WcSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(
      Math.max(rect.width, 260),
      Math.min(window.innerWidth - 16, 440)
    );
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(360, openUp ? spaceAbove : spaceBelow);
    setMenuStyle({
      position: "fixed",
      zIndex: 200,
      left,
      width,
      maxHeight: Math.max(maxHeight, 140),
      overflowY: "auto",
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });

    requestAnimationFrame(() => {
      const active = menuRef.current?.querySelector(".is-active");
      active?.scrollIntoView({ block: "nearest" });
    });
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll(e: Event) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || rootRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`wc-select ${open ? "wc-select-open" : ""} ${className}`}
      title={title}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="wc-select-trigger"
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className="wc-select-label">{label}</span>
        <ChevronDown className="wc-select-chevron h-3.5 w-3.5 shrink-0" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            className="wc-select-menu"
            style={menuStyle}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    disabled={opt.disabled}
                    className={`wc-select-option ${active ? "is-active" : ""}`}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </div>
  );
}
