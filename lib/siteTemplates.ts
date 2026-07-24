export type SiteTemplate = {
  id: string;
  name: string;
  category: string;
  /** Ключевые слова для матча ниши */
  keywords: string[];
  html: string;
  css: string;
  js: string;
};

function buildLanding(opts: {
  brand: string;
  headline: string;
  sub: string;
  cta: string;
  services: [string, string, string];
  accent: string;
}): { html: string; css: string; js: string } {
  const [s1, s2, s3] = opts.services;
  const html = `<header class="nav"><div class="wrap brand">${opts.brand}</div><a class="btn" href="#form">${opts.cta}</a></header>
<section class="hero"><div class="wrap"><h1>${opts.headline}</h1><p>${opts.sub}</p><a class="btn" href="#form">${opts.cta}</a></div></section>
<section class="services" id="services"><div class="wrap"><h2>Услуги</h2><div class="grid"><article><h3>${s1}</h3><p>Краткое описание услуги для клиентов.</p></article><article><h3>${s2}</h3><p>Краткое описание услуги для клиентов.</p></article><article><h3>${s3}</h3><p>Краткое описание услуги для клиентов.</p></article></div></div></section>
<section class="reviews"><div class="wrap"><h2>Отзывы</h2><blockquote>«Отличный сервис, всё быстро и по делу.» — Анна</blockquote></div></section>
<section class="form" id="form"><div class="wrap"><h2>Оставить заявку</h2><form method="post" data-mailto="info@example.com"><input name="name" placeholder="Имя" required /><input name="phone" placeholder="Телефон" required /><textarea name="message" placeholder="Сообщение"></textarea><button type="submit">${opts.cta}</button></form></div></section>
<footer class="footer"><div class="wrap"><p>${opts.brand} · контакты на сайте</p></div></footer>`;

  const css = `:root{--accent:${opts.accent};--bg:#0b0f19;--text:#f4f6fb;--muted:#a7b0c0}
*{box-sizing:border-box}body{margin:0;font-family:Manrope,system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
.wrap{width:min(1100px,92%);margin:0 auto}.nav{display:flex;justify-content:space-between;align-items:center;padding:1rem 0;position:sticky;top:0;backdrop-filter:blur(8px);background:rgba(11,15,25,.8)}
.brand{font-weight:700;letter-spacing:.02em}.btn,button{display:inline-block;background:var(--accent);color:#fff;border:0;border-radius:999px;padding:.75rem 1.2rem;text-decoration:none;font-weight:600;cursor:pointer}
.hero{padding:5rem 0 4rem;background:radial-gradient(circle at 20% 20%,color-mix(in srgb,var(--accent) 35%,transparent),transparent 45%)}
.hero h1{font-size:clamp(2rem,5vw,3.4rem);margin:0 0 .8rem}.hero p{max-width:36rem;color:var(--muted)}
.services,.reviews,.form{padding:3.5rem 0}.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
article,blockquote,form{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:1rem;padding:1.2rem}
form{display:grid;gap:.75rem}input,textarea{width:100%;padding:.8rem 1rem;border-radius:.7rem;border:1px solid rgba(255,255,255,.12);background:#121826;color:var(--text)}
.footer{padding:2rem 0;border-top:1px solid rgba(255,255,255,.08);color:var(--muted);font-size:.9rem}
@media(max-width:640px){.hero{padding:3rem 0}}`;

  const js = `document.querySelectorAll('a[href^="#"]').forEach((a)=>a.addEventListener('click',(e)=>{const id=a.getAttribute('href');const el=id&&document.querySelector(id);if(!el)return;e.preventDefault();el.scrollIntoView({behavior:'smooth'});}));`;

  return { html, css, js };
}

const RAW: Array<{
  id: string;
  name: string;
  category: string;
  keywords: string[];
  brand: string;
  headline: string;
  sub: string;
  cta: string;
  services: [string, string, string];
  accent: string;
}> = [
  {
    id: "dentistry",
    name: "Стоматология",
    category: "medicine",
    keywords: ["стомат", "зуб", "dentist", "клиник"],
    brand: "Smile Clinic",
    headline: "Здоровая улыбка без стресса",
    sub: "Современная стоматология: лечение, имплантация и эстетика.",
    cta: "Записаться",
    services: ["Лечение", "Имплантация", "Отбеливание"],
    accent: "#1aa6a6",
  },
  {
    id: "restaurant",
    name: "Ресторан",
    category: "food",
    keywords: ["ресторан", "кафе", "кухн", "меню", "restaurant"],
    brand: "Nord Kitchen",
    headline: "Вкус, атмосфера и вечер без спешки",
    sub: "Авторская кухня и бронирование столиков онлайн.",
    cta: "Забронировать стол",
    services: ["Меню", "Банкеты", "Доставка"],
    accent: "#c45c26",
  },
  {
    id: "it-startup",
    name: "IT-стартап",
    category: "tech",
    keywords: ["it-", "айти", "стартап", "saas", "startup", "софт", "приложен"],
    brand: "Launchly",
    headline: "Запускайте продукт быстрее",
    sub: "Платформа для команд, которым нужна скорость и прозрачность.",
    cta: "Попробовать",
    services: ["Продукт", "Интеграции", "Аналитика"],
    accent: "#6c3bf4",
  },
  {
    id: "beauty",
    name: "Салон красоты",
    category: "beauty",
    keywords: ["салон", "красот", "парикмах", "маникюр", "beauty", "косметолог"],
    brand: "Aura Beauty",
    headline: "Красота, которая чувствуется",
    sub: "Стрижки, уход и маникюр у мастеров с опытом.",
    cta: "Записаться",
    services: ["Стрижка", "Уход", "Маникюр"],
    accent: "#d4537e",
  },
  {
    id: "law",
    name: "Юридическая фирма",
    category: "legal",
    keywords: ["юрид", "адвокат", "закон", "право", "lawyer", "consult"],
    brand: "Правовой Альянс",
    headline: "Юридическая защита без сюрпризов",
    sub: "Консультации, договоры и представительство в суде.",
    cta: "Получить консультацию",
    services: ["Консультация", "Договоры", "Суды"],
    accent: "#1f4e79",
  },
  {
    id: "education",
    name: "Образовательный центр",
    category: "education",
    keywords: ["образован", "курс", "школ", "обучен", "университет", "репетитор"],
    brand: "Skill Hub",
    headline: "Навыки, которые работают",
    sub: "Практические курсы для взрослых и подростков.",
    cta: "Выбрать курс",
    services: ["Курсы", "Менторство", "Сертификаты"],
    accent: "#2f6fed",
  },
  {
    id: "fitness",
    name: "Фитнес",
    category: "fitness",
    keywords: ["фитнес", "спорт", "тренаж", "йог", "зал", "gym"],
    brand: "Pulse Gym",
    headline: "Сильнее с каждым днём",
    sub: "Персональные тренировки и групповые занятия.",
    cta: "Записаться на тренировку",
    services: ["Персонально", "Группы", "Питание"],
    accent: "#e11d48",
  },
  {
    id: "ecommerce",
    name: "Интернет-магазин",
    category: "shop",
    keywords: ["интернет-магазин", "e-?comm", "онлайн.?магазин", "shop", "каталог товаров"],
    brand: "Market One",
    headline: "Покупка за пару кликов",
    sub: "Каталог, быстрая доставка и понятные условия возврата.",
    cta: "Смотреть каталог",
    services: ["Каталог", "Доставка", "Поддержка"],
    accent: "#0d9488",
  },
  {
    id: "realty",
    name: "Агентство недвижимости",
    category: "realty",
    keywords: ["недвиж", "квартир", "риелтор", "аренд", "новострой", "real.?estate"],
    brand: "HomeLine",
    headline: "Найдите дом без хаоса",
    sub: "Подбор квартир, показы и сопровождение сделки.",
    cta: "Оставить заявку",
    services: ["Продажа", "Аренда", "Ипотека"],
    accent: "#b45309",
  },
  {
    id: "portfolio",
    name: "Портфолио",
    category: "portfolio",
    keywords: ["портфолио", "дизайнер", "фотограф", "фриланс", "portfolio", "креатив"],
    brand: "Studio Nova",
    headline: "Работы, которые говорят сами",
    sub: "Кейсы, услуги и форма для новых проектов.",
    cta: "Обсудить проект",
    services: ["Дизайн", "Брендинг", "Съёмка"],
    accent: "#7c3aed",
  },
];

export const SITE_TEMPLATES: SiteTemplate[] = RAW.map((item) => {
  const built = buildLanding(item);
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    keywords: item.keywords,
    html: built.html,
    css: built.css,
    js: built.js,
  };
});

export function matchSiteTemplate(text: string): SiteTemplate | null {
  const lower = text.toLowerCase();
  for (const template of SITE_TEMPLATES) {
    if (template.keywords.some((kw) => new RegExp(kw, "i").test(lower))) {
      return template;
    }
  }
  return null;
}

export function getTemplateById(id: string): SiteTemplate | null {
  return SITE_TEMPLATES.find((t) => t.id === id) ?? null;
}
