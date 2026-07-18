export type UserContacts = {
  phone: string;
  email: string;
  socials: string[];
  show_contacts: boolean;
};

export function parseSocials(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, 20);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  return [];
}

export function normalizeContacts(input: {
  phone?: unknown;
  email?: unknown;
  socials?: unknown;
  show_contacts?: unknown;
}): UserContacts {
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  return {
    phone,
    email,
    socials: parseSocials(input.socials),
    show_contacts: input.show_contacts !== false,
  };
}

export function hasSavedContacts(contacts: UserContacts): boolean {
  return Boolean(
    contacts.phone || contacts.email || contacts.socials.length > 0
  );
}

/** Блок для system/user prompt генерации сайта */
export function buildContactsPromptBlock(contacts: UserContacts): string {
  if (contacts.show_contacts && hasSavedContacts(contacts)) {
    const socials =
      contacts.socials.length > 0
        ? contacts.socials.join(", ")
        : "нет";
    return `Контакты для сайта: телефон: ${contacts.phone || "нет"}, email: ${contacts.email || "нет"}, соцсети: ${socials}.
Вставь их в соответствующие места: телефон сделай кликабельным для звонка (tel:+...), email — ссылкой для письма (mailto:...), соцсети — иконками-ссылками.
Расположи контакты в футере и/или в секции «Контакты».`;
  }

  return `Вставь пример контактов-заглушек: телефон +7 (999) 123-45-67 (tel:+79991234567), email info@example.com (mailto:info@example.com), соцсети (VK, TG) — заглушки-ссылки.
Расположи их в футере и/или в секции «Контакты».`;
}

export function toTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return "tel:+79991234567";
  return digits.startsWith("+") ? `tel:${digits}` : `tel:+${digits}`;
}
