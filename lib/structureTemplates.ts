/**
 * Layout-скелеты для Мастера (Простой):
 * Fable-качество структуры → дешёвая модель только адаптирует тексты/цвета/нишу.
 */

export type StructureLayout = {
  id: string;
  label: string;
  /** Кратко: чем отличается каркас */
  description: string;
  html: string;
  css: string;
  js: string;
};

function cssVarsBase(extra = ""): string {
  return `:root{--accent:#6c3bf4;--bg:#0b0f19;--text:#f4f4f8;--muted:#a1a1aa;--card:#12161f;--radius:1rem;--font:Manrope,system-ui,sans-serif}${extra}
*{box-sizing:border-box}body{margin:0;font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.55}
a{color:inherit;text-decoration:none}.wrap{width:min(1120px,92%);margin:0 auto}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:.85rem 1.35rem;border-radius:999px;background:var(--accent);color:#fff;font-weight:600;border:0;cursor:pointer}
.btn-ghost{background:transparent;border:1px solid rgba(255,255,255,.18)}
.nav{display:flex;align-items:center;justify-content:space-between;padding:1.1rem 0}
.brand{font-weight:800;letter-spacing:-.03em}
.section{padding:4.5rem 0}.section h2{font-size:clamp(1.6rem,3vw,2.2rem);margin:0 0 1rem;letter-spacing:-.03em}
.muted{color:var(--muted)}.grid-3{display:grid;gap:1rem;grid-template-columns:repeat(3,minmax(0,1fr))}
@media(max-width:800px){.grid-3{grid-template-columns:1fr}.hero-split{grid-template-columns:1fr!important}}
.card{background:var(--card);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius);padding:1.25rem}
.card img,.media img{width:100%;display:block;border-radius:calc(var(--radius) - 4px);aspect-ratio:16/10;object-fit:cover;background:rgba(255,255,255,.04)}
footer{border-top:1px solid rgba(255,255,255,.08);padding:2rem 0;color:var(--muted);font-size:.9rem}`;
}

/** 1: текст слева, медиа справа */
const LAYOUT_SPLIT: StructureLayout = {
  id: "hero-split",
  label: "Hero split",
  description: "Текст слева, картинка справа; услуги сеткой",
  html: `<header class="nav wrap"><div class="brand">Brand</div><a class="btn" href="#form">Связаться</a></header>
<section class="hero section"><div class="wrap hero-split" style="display:grid;grid-template-columns:1.05fr .95fr;gap:2rem;align-items:center">
<div><p class="eyebrow muted">Ниша · Гео</p><h1>Сильный заголовок под услугу</h1><p class="muted lead">Короткое УТП: кому помогаете и чем отличаетесь.</p>
<div class="cta-row" style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1.25rem"><a class="btn" href="#form">Оставить заявку</a><a class="btn btn-ghost" href="#services">Смотреть услуги</a></div></div>
<div class="media" data-wc-slot="hero"></div>
</div></section>
<section class="section" id="services"><div class="wrap"><h2>Услуги</h2><div class="grid-3">
<article class="card" data-wc-slot="image"><h3>Услуга 1</h3><p class="muted">Краткое описание.</p></article>
<article class="card" data-wc-slot="image"><h3>Услуга 2</h3><p class="muted">Краткое описание.</p></article>
<article class="card" data-wc-slot="image"><h3>Услуга 3</h3><p class="muted">Краткое описание.</p></article>
</div></div></section>
<section class="section" id="form"><div class="wrap" style="max-width:560px"><h2>Заявка</h2><p class="muted">Перезвоним быстро.</p>
<form onsubmit="event.preventDefault();alert('Заявка отправлена');"><input required placeholder="Имя" style="width:100%;margin:.5rem 0;padding:.8rem;border-radius:.75rem;border:1px solid rgba(255,255,255,.12);background:#0a0d14;color:inherit"/><input required placeholder="Телефон" style="width:100%;margin:.5rem 0;padding:.8rem;border-radius:.75rem;border:1px solid rgba(255,255,255,.12);background:#0a0d14;color:inherit"/><button class="btn" type="submit">Отправить</button></form></div></section>
<footer><div class="wrap">Brand · контакты</div></footer>`,
  css: cssVarsBase(`
h1{font-size:clamp(2rem,4.5vw,3.2rem);line-height:1.08;margin:.35rem 0 1rem;letter-spacing:-.04em}
.lead{font-size:1.05rem;max-width:36rem}.eyebrow{font-size:.75rem;text-transform:uppercase;letter-spacing:.12em;margin:0}
`),
  js: `document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const id=a.getAttribute('href');const el=id&&document.querySelector(id);if(el){e.preventDefault();el.scrollIntoView({behavior:'smooth'})}}));`,
};

/** 2: full-bleed hero, текст по центру */
const LAYOUT_CENTER: StructureLayout = {
  id: "hero-center",
  label: "Hero center",
  description: "Фон на весь hero, текст по центру",
  html: `<header class="nav wrap"><div class="brand">Brand</div><a class="btn" href="#form">Запись</a></header>
<section class="hero-full" data-wc-slot="hero"><div class="wrap hero-inner"><p class="eyebrow">Ниша</p><h1>Заголовок по центру</h1><p class="muted lead">Одно предложение ценности.</p><a class="btn" href="#form">Начать</a></div></section>
<section class="section" id="services"><div class="wrap"><h2>Что внутри</h2><div class="grid-3">
<article class="card"><h3>Блок 1</h3><p class="muted">Текст.</p></article>
<article class="card"><h3>Блок 2</h3><p class="muted">Текст.</p></article>
<article class="card"><h3>Блок 3</h3><p class="muted">Текст.</p></article>
</div></div></section>
<section class="section" id="form"><div class="wrap" style="text-align:center;max-width:520px;margin:0 auto"><h2>Связаться</h2><form onsubmit="event.preventDefault();alert('Ок');"><input required placeholder="Телефон" style="width:100%;margin:1rem 0;padding:.85rem;border-radius:.75rem;border:1px solid rgba(255,255,255,.12);background:#0a0d14;color:inherit"/><button class="btn" type="submit">Жду звонка</button></form></div></section>
<footer><div class="wrap">Brand</div></footer>`,
  css: cssVarsBase(`
.hero-full{min-height:78vh;display:grid;place-items:center;text-align:center;background:radial-gradient(ellipse at 50% 30%,color-mix(in srgb,var(--accent) 35%,transparent),transparent 55%),var(--bg);padding:4rem 0}
.hero-inner h1{font-size:clamp(2.2rem,5vw,3.6rem);margin:.4rem 0 1rem;letter-spacing:-.045em}
.lead{max-width:34rem;margin:0 auto 1.4rem}
.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:.72rem;color:var(--muted)}
`),
  js: `document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const id=a.getAttribute('href');const el=id&&document.querySelector(id);if(el){e.preventDefault();el.scrollIntoView({behavior:'smooth'})}}));`,
};

/** 3: плотный SaaS / карточки сверху */
const LAYOUT_STACK: StructureLayout = {
  id: "stack-cards",
  label: "Stack cards",
  description: "Узкий hero + широкие карточки услуг",
  html: `<header class="nav wrap"><div class="brand">Brand</div><div style="display:flex;gap:.5rem"><a class="btn btn-ghost" href="#services">Услуги</a><a class="btn" href="#form">Демо</a></div></header>
<section class="section"><div class="wrap" style="max-width:720px"><h1>Продуктовый заголовок</h1><p class="muted lead">Для B2B / студий / сервисов.</p><a class="btn" href="#form">Попробовать</a></div></section>
<section class="section" id="services"><div class="wrap"><div class="stack">
<article class="card wide" data-wc-slot="image"><h3>Модуль A</h3><p class="muted">Описание модуля.</p></article>
<article class="card wide" data-wc-slot="image"><h3>Модуль B</h3><p class="muted">Описание модуля.</p></article>
<article class="card wide" data-wc-slot="image"><h3>Модуль C</h3><p class="muted">Описание модуля.</p></article>
</div></div></section>
<section class="section" id="form"><div class="wrap"><h2>Заявка</h2><form onsubmit="event.preventDefault();alert('Спасибо');" style="display:flex;gap:.5rem;flex-wrap:wrap"><input required placeholder="Email" style="flex:1;min-width:200px;padding:.8rem;border-radius:.75rem;border:1px solid rgba(255,255,255,.12);background:#0a0d14;color:inherit"/><button class="btn" type="submit">Отправить</button></form></div></section>
<footer><div class="wrap">Brand</div></footer>`,
  css: cssVarsBase(`
h1{font-size:clamp(2rem,4vw,3rem);letter-spacing:-.04em;margin:0 0 .75rem}
.lead{margin:0 0 1.25rem;max-width:36rem}.stack{display:grid;gap:1rem}.card.wide{display:grid;gap:1rem}
@media(min-width:800px){.card.wide{grid-template-columns:1.1fr .9fr;align-items:center}}
`),
  js: "",
};

/** 4: светлый акцент / editorial */
const LAYOUT_EDITORIAL: StructureLayout = {
  id: "editorial",
  label: "Editorial",
  description: "Крупная типографика, одна колонка + акцентные блоки",
  html: `<header class="nav wrap"><div class="brand">Brand</div><a class="btn" href="#form">Контакт</a></header>
<section class="section"><div class="wrap"><p class="eyebrow muted">Мастерская · Город</p><h1 class="display">Длинный выразительный заголовок в две строки</h1><p class="muted lead">Абзац о подходе и результате для клиента.</p></div></section>
<section class="section"><div class="wrap media" data-wc-slot="hero"></div></section>
<section class="section" id="services"><div class="wrap cols"><div><h2>01 · Услуга</h2><p class="muted">Текст.</p></div><div><h2>02 · Услуга</h2><p class="muted">Текст.</p></div><div><h2>03 · Услуга</h2><p class="muted">Текст.</p></div></div></section>
<section class="section" id="form"><div class="wrap"><h2>Напишите нам</h2><p class="muted phone">+7 …</p><a class="btn" href="#form">Оставить заявку</a></div></section>
<footer><div class="wrap">Brand</div></footer>`,
  css: cssVarsBase(`
:root{--font:Georgia,"Times New Roman",serif}
.display{font-size:clamp(2.4rem,5.5vw,4rem);line-height:1.05;letter-spacing:-.05em;max-width:16ch;margin:.5rem 0 1rem}
.lead{font-size:1.15rem;max-width:38rem}.cols{display:grid;gap:2rem}
@media(min-width:800px){.cols{grid-template-columns:repeat(3,1fr)}}
.eyebrow{letter-spacing:.16em;text-transform:uppercase;font-size:.7rem;font-family:system-ui,sans-serif}
.btn,.brand,.nav a{font-family:system-ui,sans-serif}
`),
  js: "",
};

export const STRUCTURE_LAYOUTS: StructureLayout[] = [
  LAYOUT_SPLIT,
  LAYOUT_CENTER,
  LAYOUT_STACK,
  LAYOUT_EDITORIAL,
];

export function getStructureLayoutById(id: string | null | undefined) {
  if (!id) return null;
  return STRUCTURE_LAYOUTS.find((l) => l.id === id) ?? null;
}

/** Стабильный выбор layout по теме (ротация между клиентами). */
export function pickStructureLayout(seed: string): StructureLayout {
  let h = 0;
  const s = seed.trim() || "default";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return STRUCTURE_LAYOUTS[h % STRUCTURE_LAYOUTS.length];
}

export function buildStructureAdaptPrompt(input: {
  userPrompt: string;
  customRequirements: string;
  layout: StructureLayout;
  brandColors: string[];
  brandLogo: string;
}): string {
  const [accent, light, dark] = [
    input.brandColors[0] ?? "#6c3bf4",
    input.brandColors[1] ?? "#f5f3ff",
    input.brandColors[2] ?? "#0b0f19",
  ];
  return `Адаптируй готовый КАРКАС сайта под запрос клиента.
Сохрани структуру секций, сетку и слоты data-wc-slot="hero"|data-wc-slot="image". Не удаляй эти атрибуты.
Не заменяй слоты цветными заглушками без img — оставь пустой контейнер со слотом, фото вставят позже.
Замени плейсхолдеры на реальные тексты под нишу. Обнови CSS-переменные цветов.
Верни ТОЛЬКО JSON {"html":"...","css":"...","js":"..."}.

Layout: ${input.layout.id} — ${input.layout.description}
Запрос: ${input.userPrompt || "(нет)"}
Пожелания: ${input.customRequirements || "нет"}
Цвета: accent=${accent}, light=${light}, dark=${dark} (проставь в :root --accent/--bg/--text)
Логотип URL: ${input.brandLogo || "нет (оставь текстовый .brand)"}

--- HTML каркаса ---
${input.layout.html}

--- CSS каркаса ---
${input.layout.css}

--- JS каркаса ---
${input.layout.js || "(пусто)"}`;
}
