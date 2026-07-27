/** Демо-витрина главной: ниши → старт Мастера с готовым topic */

export type LandingDemo = {
  id: string;
  nicheId: string;
  title: string;
  niche: string;
  topic: string;
  brand: string;
  headline: string;
  /** CSS accent for mini-preview */
  accent: string;
  /** Page background tone */
  surface: string;
  /** Muted text */
  muted: string;
  tag: string;
};

export const LANDING_DEMOS: LandingDemo[] = [
  {
    id: "cafe",
    nicheId: "cafe",
    title: "Daily Cup",
    niche: "Кофейня",
    topic: "Сайт для кофейни Daily Cup: меню, атмосфера, бронирование столика",
    brand: "Daily Cup",
    headline: "Кофе и тишина утра",
    accent: "#c2410c",
    surface: "#1a120e",
    muted: "#c4a484",
    tag: "Еда",
  },
  {
    id: "dentistry",
    nicheId: "dentistry",
    title: "Smile Clinic",
    niche: "Стоматология",
    topic: "Сайт стоматологии Smile Clinic: лечение, имплантация, запись онлайн",
    brand: "Smile Clinic",
    headline: "Улыбка без стресса",
    accent: "#0d9488",
    surface: "#0c1414",
    muted: "#8fb9b4",
    tag: "Медицина",
  },
  {
    id: "law",
    nicheId: "law",
    title: "Правовой Альянс",
    niche: "Юрист",
    topic: "Сайт юридической фирмы: консультации, договоры, представительство",
    brand: "Альянс",
    headline: "Защита без сюрпризов",
    accent: "#94a3b8",
    surface: "#0e1118",
    muted: "#9aa3b2",
    tag: "Услуги",
  },
  {
    id: "fitness",
    nicheId: "fitness",
    title: "Pulse Gym",
    niche: "Фитнес",
    topic: "Сайт фитнес-клуба Pulse Gym: тренировки, абонементы, запись",
    brand: "Pulse",
    headline: "Сильнее каждый день",
    accent: "#e11d48",
    surface: "#140a0e",
    muted: "#c48a96",
    tag: "Спорт",
  },
  {
    id: "beauty",
    nicheId: "beauty",
    title: "Aura Beauty",
    niche: "Салон",
    topic: "Сайт салона красоты Aura: стрижки, уход, маникюр, онлайн-запись",
    brand: "Aura",
    headline: "Красота по делу",
    accent: "#db2777",
    surface: "#160a12",
    muted: "#c995b0",
    tag: "Красота",
  },
  {
    id: "restaurant",
    nicheId: "restaurant",
    title: "Nord Kitchen",
    niche: "Ресторан",
    topic: "Сайт ресторана Nord Kitchen: меню, банкеты, бронь столика",
    brand: "Nord",
    headline: "Вечер без спешки",
    accent: "#ea580c",
    surface: "#15100c",
    muted: "#c4a078",
    tag: "Еда",
  },
  {
    id: "furniture",
    nicheId: "furniture",
    title: "Home Soft",
    niche: "Мебель",
    topic: "Сайт мебельного магазина Home Soft: каталог, материалы, расчёт",
    brand: "Home Soft",
    headline: "Дом под вас",
    accent: "#0284c7",
    surface: "#0a1218",
    muted: "#8ab0c4",
    tag: "Магазин",
  },
  {
    id: "ecommerce",
    nicheId: "ecommerce",
    title: "Market One",
    niche: "Магазин",
    topic: "Интернет-магазин Market One: каталог, доставка, поддержка",
    brand: "Market",
    headline: "Покупка за клик",
    accent: "#059669",
    surface: "#0a1412",
    muted: "#86b8a8",
    tag: "Shop",
  },
];

export const WIZARD_SEED_KEY = "wc_wizard_seed_v1";

export type WizardSeed = {
  topic: string;
  nicheId: string;
  demoId?: string;
};

export function writeWizardSeed(seed: WizardSeed) {
  try {
    localStorage.setItem(WIZARD_SEED_KEY, JSON.stringify(seed));
  } catch {
    /* ignore */
  }
}

export function readWizardSeed(): WizardSeed | null {
  try {
    const raw = localStorage.getItem(WIZARD_SEED_KEY);
    if (!raw) return null;
    localStorage.removeItem(WIZARD_SEED_KEY);
    const data = JSON.parse(raw) as WizardSeed;
    if (!data?.topic || data.topic.trim().length < 3) return null;
    return data;
  } catch {
    return null;
  }
}
