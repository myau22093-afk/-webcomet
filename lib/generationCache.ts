import { createAdminClient } from "@/lib/supabaseAdmin";
import { SITE_TEMPLATES, type SiteTemplate } from "@/lib/siteTemplates";

export type CachedGeneration = {
  id: string;
  prompt_hash: string;
  html: string;
  css: string;
  js: string;
  model_used: string | null;
  created_at: string;
};

export async function findCachedGeneration(
  promptHash: string
): Promise<CachedGeneration | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("cache_generations")
      .select("*")
      .eq("prompt_hash", promptHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // таблица ещё не создана — тихо пропускаем
      if (!/does not exist|relation|42P01/i.test(error.message ?? "")) {
        console.error("findCachedGeneration error:", error);
      }
      return null;
    }
    return (data as CachedGeneration | null) ?? null;
  } catch (error) {
    console.error("findCachedGeneration fatal:", error);
    return null;
  }
}

export async function saveCachedGeneration(input: {
  promptHash: string;
  html: string;
  css: string;
  js: string;
  modelUsed: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("cache_generations").upsert(
      {
        prompt_hash: input.promptHash,
        html: input.html,
        css: input.css,
        js: input.js,
        model_used: input.modelUsed,
        created_at: new Date().toISOString(),
      },
      { onConflict: "prompt_hash" }
    );
    if (error && !/does not exist|relation|42P01/i.test(error.message ?? "")) {
      console.error("saveCachedGeneration error:", error);
    }
  } catch (error) {
    console.error("saveCachedGeneration fatal:", error);
  }
}

export async function ensureTemplatesSeeded(): Promise<void> {
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("templates")
      .select("id", { count: "exact", head: true });
    if (error) return;
    if ((count ?? 0) > 0) return;

    const rows = SITE_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      html: t.html,
      css: t.css,
      js: t.js,
    }));
    const { error: insertError } = await admin.from("templates").upsert(rows);
    if (insertError) {
      console.error("ensureTemplatesSeeded error:", insertError);
    }
  } catch {
    /* optional */
  }
}

export async function loadTemplateFromDb(
  id: string
): Promise<SiteTemplate | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      category: data.category,
      keywords: [],
      html: data.html,
      css: data.css,
      js: data.js,
    };
  } catch {
    return null;
  }
}
