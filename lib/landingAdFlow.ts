/** Временный сценарий лендинга для съёмки рекламы. */
export const LANDING_AD_FLOW_ENABLED = true;

export const LANDING_CHAT_STORAGE_KEY = LANDING_AD_FLOW_ENABLED
  ? "wc-landing-chat-ad-v1"
  : "wc-landing-chat-v1";

/** Ниши для рекламного шага — стоматология первой. */
export const AD_NICHE_IDS = [
  "dentistry",
  "beauty",
  "cafe",
  "restaurant",
  "law",
  "fitness",
  "furniture",
  "ecommerce",
] as const;
