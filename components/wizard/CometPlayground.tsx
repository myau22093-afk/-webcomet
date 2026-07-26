"use client";

import { useEffect, useRef, useState } from "react";

type Pos = { x: number; y: number };

function randomPos(prev?: Pos): Pos {
  // Почти вся площадь поля (с учётом кнопки ~40px)
  let x = 8 + Math.random() * 84;
  let y = 10 + Math.random() * 70;
  if (prev) {
    for (let i = 0; i < 6; i++) {
      const dx = x - prev.x;
      const dy = y - prev.y;
      if (dx * dx + dy * dy > 400) break; // минимум ~20% диагонали
      x = 8 + Math.random() * 84;
      y = 10 + Math.random() * 70;
    }
  }
  return { x, y };
}

/** Мини-игра «поймай комету», пока идёт сборка */
export function CometPlayground() {
  const areaRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [pos, setPos] = useState<Pos>(() => randomPos());
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const [flash, setFlash] = useState(false);
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => {
    const id = window.setInterval(() => {
      setPos(randomPos(posRef.current));
    }, 1100);
    return () => window.clearInterval(id);
  }, []);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCursor({ x, y });
  }

  function catchComet() {
    setScore((s) => s + 1);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 200);
    setPos(randomPos(posRef.current));
  }

  return (
    <div className="mt-8 w-full max-w-md">
      <div className="mb-2 flex items-center justify-between text-[13px] text-zinc-500">
        <span>Поймай комету, пока ждёшь</span>
        <span className="font-medium text-violet-200">★ {score}</span>
      </div>
      <div
        ref={areaRef}
        onMouseMove={onMove}
        onClick={catchComet}
        className={`relative h-44 cursor-crosshair overflow-hidden rounded-2xl border border-white/10 bg-[#07080d] ${
          flash ? "ring-1 ring-violet-400/50" : ""
        }`}
      >
        <div
          className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-xl transition-transform duration-100"
          style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            catchComet();
          }}
          className="absolute z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-sky-400 text-lg shadow-lg shadow-violet-500/30 transition-[left,top,transform] duration-300 ease-out hover:scale-110"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          aria-label="Комета"
        >
          ✦
        </button>
        <p className="pointer-events-none absolute bottom-2 left-0 right-0 z-0 text-center text-[11px] text-zinc-600">
          Кликай по комете · курсор подсвечивает след
        </p>
      </div>
    </div>
  );
}
