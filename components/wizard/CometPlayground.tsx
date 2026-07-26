"use client";

import { useEffect, useRef, useState } from "react";

type Pos = { x: number; y: number };

function randomPos(prev?: Pos): Pos {
  let x = 10 + Math.random() * 80;
  let y = 12 + Math.random() * 70;
  if (prev) {
    for (let i = 0; i < 6; i++) {
      const dx = x - prev.x;
      const dy = y - prev.y;
      if (dx * dx + dy * dy > 400) break;
      x = 10 + Math.random() * 80;
      y = 12 + Math.random() * 70;
    }
  }
  return { x, y };
}

/** Мини-игра «поймай комету», пока идёт сборка */
export function CometPlayground({ fill = false }: { fill?: boolean }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [pos, setPos] = useState<Pos>(() => randomPos());
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const [flash, setFlash] = useState(false);
  const [missFlash, setMissFlash] = useState(false);
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

  function onMiss() {
    setMissFlash(true);
    window.setTimeout(() => setMissFlash(false), 180);
  }

  return (
    <div
      className={`flex w-full flex-col ${fill ? "min-h-0 flex-1" : "mt-8 max-w-md"}`}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between text-[13px] text-zinc-500">
        <span>Поймай комету, пока ждёшь</span>
        <span className="font-medium text-violet-200">★ {score}</span>
      </div>
      <div
        ref={areaRef}
        onMouseMove={onMove}
        onClick={onMiss}
        className={`relative min-h-[180px] cursor-crosshair overflow-hidden rounded-2xl border border-white/10 bg-[#07080d] ${
          fill ? "flex-1" : "h-44"
        } ${flash ? "ring-1 ring-violet-400/50" : ""} ${
          missFlash ? "ring-1 ring-rose-400/30" : ""
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
          className="absolute z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-sky-400 text-lg shadow-lg shadow-violet-500/30 transition-[left,top,transform] duration-300 ease-out hover:scale-110"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          aria-label="Комета"
        >
          ✦
        </button>
        <p className="pointer-events-none absolute bottom-2 left-0 right-0 z-0 text-center text-[11px] text-zinc-600">
          Кликай только по комете
        </p>
      </div>
    </div>
  );
}
