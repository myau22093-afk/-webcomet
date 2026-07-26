import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStandaloneHtml } from "@/lib/siteExport";
import {
  getPublishPackage,
  publishBaseDomain,
  publishPathUrl,
  publishPublicUrl,
  type PublishPackageId,
} from "@/lib/publishConfig";

export type PublishedSiteRow = {
  id: string;
  user_id: string;
  site_id: string | null;
  slug: string;
  title: string | null;
  status: "pending" | "active" | "expired";
  expires_at: string | null;
  package_id: string | null;
  yookassa_payment_id: string | null;
  html: string | null;
  created_at: string;
  updated_at: string;
};

export function hostedDir(slug: string): string {
  return path.join(process.cwd(), "public", "hosted", slug);
}

export function makePublishSlug(): string {
  const n = Math.floor(100 + Math.random() * 900);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `m-${n}${suffix}`.toLowerCase();
}

export function isPublishActive(row: {
  status: string;
  expires_at: string | null;
}): boolean {
  if (row.status !== "active") return false;
  if (!row.expires_at) return false;
  return new Date(row.expires_at).getTime() > Date.now();
}

export async function buildPublishHtml(input: {
  html: string;
  css: string;
  js: string;
  title?: string;
  formEmail?: string;
}): Promise<string> {
  return buildStandaloneHtml({
    html: input.html,
    css: input.css,
    js: input.js,
    title: input.title,
    formEmail: input.formEmail,
  });
}

export async function writeHostedIndex(
  slug: string,
  html: string
): Promise<void> {
  const dir = hostedDir(slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), html, "utf8");
}

export async function reservePublishSlug(
  admin: SupabaseClient,
  userId: string,
  opts: {
    siteId?: string | null;
    title?: string;
    html: string;
    packageId?: string | null;
  }
): Promise<PublishedSiteRow> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = makePublishSlug();
    const { data, error } = await admin
      .from("published_sites")
      .insert({
        user_id: userId,
        site_id: opts.siteId ?? null,
        slug,
        title: opts.title ?? null,
        status: "pending",
        html: opts.html,
        package_id: opts.packageId ?? null,
      })
      .select("*")
      .single();

    if (!error && data) return data as PublishedSiteRow;

    // unique violation — retry
    if (error && !String(error.message || "").toLowerCase().includes("unique")) {
      throw error;
    }
  }
  throw new Error("Не удалось зарезервировать адрес сайта");
}

export async function activatePublish(
  admin: SupabaseClient,
  opts: {
    publishId?: string;
    slug?: string;
    userId: string;
    packageId: PublishPackageId | string;
    paymentId: string;
    amount: number;
  }
): Promise<PublishedSiteRow> {
  const pack = getPublishPackage(opts.packageId);
  if (!pack) throw new Error("Неизвестный тариф публикации");

  let row: PublishedSiteRow | null = null;

  if (opts.publishId) {
    const { data } = await admin
      .from("published_sites")
      .select("*")
      .eq("id", opts.publishId)
      .eq("user_id", opts.userId)
      .maybeSingle();
    row = (data as PublishedSiteRow | null) ?? null;
  } else if (opts.slug) {
    const { data } = await admin
      .from("published_sites")
      .select("*")
      .eq("slug", opts.slug)
      .eq("user_id", opts.userId)
      .maybeSingle();
    row = (data as PublishedSiteRow | null) ?? null;
  }

  if (!row) throw new Error("Черновик публикации не найден");

  // idempotent by payment id
  if (row.yookassa_payment_id === opts.paymentId && row.status === "active") {
    return row;
  }

  const { data: paidAlready } = await admin
    .from("published_sites")
    .select("id")
    .eq("yookassa_payment_id", opts.paymentId)
    .maybeSingle();
  if (paidAlready && paidAlready.id !== row.id) {
    throw new Error("Платёж уже использован");
  }

  const baseDate =
    row.expires_at && new Date(row.expires_at).getTime() > Date.now()
      ? new Date(row.expires_at)
      : new Date();
  const expires = new Date(baseDate);
  expires.setMonth(expires.getMonth() + pack.months);

  const { data: updated, error } = await admin
    .from("published_sites")
    .update({
      status: "active",
      expires_at: expires.toISOString(),
      package_id: pack.id,
      yookassa_payment_id: opts.paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("*")
    .single();

  if (error || !updated) throw error ?? new Error("Не удалось активировать");

  const html = (updated as PublishedSiteRow).html;
  if (html) {
    try {
      await writeHostedIndex((updated as PublishedSiteRow).slug, html);
    } catch (e) {
      console.error("writeHostedIndex failed:", e);
    }
  }

  // ledger (tokens=0) — type purchase already allowed
  try {
    await admin.from("transactions").insert({
      user_id: opts.userId,
      amount: opts.amount,
      tokens: 0,
      type: "purchase",
      description: `Публикация ${pack.label} · ${(updated as PublishedSiteRow).slug}.${publishBaseDomain()}`,
      yookassa_payment_id: opts.paymentId,
    });
  } catch (e) {
    console.error("publish transaction log failed:", e);
  }

  return updated as PublishedSiteRow;
}

export async function getPublishedBySlug(
  admin: SupabaseClient,
  slug: string
): Promise<PublishedSiteRow | null> {
  const { data, error } = await admin
    .from("published_sites")
    .select("*")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (error) {
    console.error("getPublishedBySlug:", error);
    return null;
  }
  return (data as PublishedSiteRow | null) ?? null;
}

export function urlsForSlug(slug: string) {
  return {
    subdomain: publishPublicUrl(slug),
    path: publishPathUrl(slug),
  };
}

/** Обновить HTML активных публикаций после правок в редакторе */
export async function syncPublishedSiteContent(
  admin: SupabaseClient,
  opts: {
    userId: string;
    siteId?: string | null;
    html: string;
    css: string;
    js: string;
    title?: string;
    formEmail?: string;
  }
): Promise<{ updated: number; slugs: string[] }> {
  const standalone = await buildPublishHtml({
    html: opts.html,
    css: opts.css,
    js: opts.js,
    title: opts.title,
    formEmail: opts.formEmail,
  });

  let query = admin
    .from("published_sites")
    .select("id, slug")
    .eq("user_id", opts.userId)
    .eq("status", "active");

  if (opts.siteId) {
    query = query.eq("site_id", opts.siteId);
  }

  const { data: rows, error } = await query;
  if (error) throw error;
  const list = (rows ?? []) as { id: string; slug: string }[];
  if (!list.length && opts.siteId) {
    // fallback: последняя активная публикация пользователя
    const { data: latest } = await admin
      .from("published_sites")
      .select("id, slug")
      .eq("user_id", opts.userId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (latest?.length) list.push(...(latest as { id: string; slug: string }[]));
  }

  const slugs: string[] = [];
  for (const row of list) {
    const { error: upErr } = await admin
      .from("published_sites")
      .update({
        html: standalone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", opts.userId);
    if (upErr) {
      console.error("sync publish update", row.slug, upErr);
      continue;
    }
    try {
      await writeHostedIndex(row.slug, standalone);
    } catch (e) {
      console.error("sync writeHostedIndex", row.slug, e);
    }
    slugs.push(row.slug);
  }

  return { updated: slugs.length, slugs };
}

