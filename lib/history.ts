import { createAdminClient } from "@/lib/supabaseAdmin";
import { embedUploadsInSite } from "@/lib/siteExport";

export type HistoryKind = "sites" | "images" | "chats";

export type SiteRow = {
  id: string;
  user_id: string;
  prompt: string;
  html: string;
  css: string;
  js: string;
  created_at: string;
  prompt_hash?: string | null;
  version?: number | null;
  root_prompt?: string | null;
};

export type ImageRow = {
  id: string;
  user_id: string;
  prompt: string;
  image_url: string;
  model: string;
  created_at: string;
};

export type ChatRow = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  conversation_id?: string | null;
};

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === "PGRST204" ||
    Boolean(err.message?.includes("Could not find the")) ||
    Boolean(err.message?.includes("column"))
  );
}

export async function getNextSiteVersion(
  userId: string,
  rootPrompt: string
): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sites")
    .select("version")
    .eq("user_id", userId)
    .eq("root_prompt", rootPrompt)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getNextSiteVersion error:", error);
    // если колонки ещё нет — вторая версия по умолчанию
    return 2;
  }
  const current = typeof data?.version === "number" ? data.version : 1;
  return Math.max(2, current + 1);
}

export async function findCachedSite(
  userId: string,
  promptHash: string
): Promise<SiteRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sites")
    .select("*")
    .eq("user_id", userId)
    .eq("prompt_hash", promptHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("findCachedSite error:", error);
    return null;
  }
  return (data as SiteRow | null) ?? null;
}

export async function saveSite(input: {
  userId: string;
  prompt: string;
  html: string;
  css: string;
  js: string;
  promptHash?: string;
  version?: number;
  rootPrompt?: string;
}): Promise<SiteRow | null> {
  const embedded = await embedUploadsInSite({
    html: input.html,
    css: input.css,
    js: input.js,
  });
  if (embedded.missing.length) {
    console.warn("[saveSite] missing uploads (saved without them):", embedded.missing);
  }

  const admin = createAdminClient();
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    prompt: input.prompt,
    html: embedded.html,
    css: embedded.css,
    js: embedded.js,
  };
  if (input.promptHash) payload.prompt_hash = input.promptHash;
  if (typeof input.version === "number") payload.version = input.version;
  if (input.rootPrompt) payload.root_prompt = input.rootPrompt;

  const { data, error } = await admin
    .from("sites")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    // колонок version/root_prompt ещё нет — сохраняем без них
    if (
      input.promptHash ||
      input.rootPrompt ||
      typeof input.version === "number"
    ) {
      const minimal = {
        user_id: input.userId,
        prompt: input.prompt,
        html: embedded.html,
        css: embedded.css,
        js: embedded.js,
        ...(input.promptHash ? { prompt_hash: input.promptHash } : {}),
      };
      const retry = await admin.from("sites").insert(minimal).select("*").single();
      if (!retry.error) return retry.data as SiteRow;
    }
    console.error("saveSite error:", error);
    return null;
  }
  return data as SiteRow;
}

export async function saveImage(input: {
  userId: string;
  prompt: string;
  imageUrl: string;
  model: string;
}): Promise<ImageRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("images")
    .insert({
      user_id: input.userId,
      prompt: input.prompt,
      image_url: input.imageUrl,
      model: input.model,
    })
    .select("*")
    .single();

  if (error) {
    console.error("saveImage error:", error);
    return null;
  }
  return data as ImageRow;
}

export async function saveChatExchange(input: {
  userId: string;
  userMessage: string;
  assistantMessage: string;
  conversationId?: string | null;
}): Promise<ChatRow[]> {
  const admin = createAdminClient();
  const now = Date.now();
  const userAt = new Date(now).toISOString();
  const assistantAt = new Date(now + 1).toISOString();
  const conversationId =
    input.conversationId?.trim() || crypto.randomUUID();

  const baseUser = {
    user_id: input.userId,
    role: "user" as const,
    content: input.userMessage,
    created_at: userAt,
  };
  const baseAssistant = {
    user_id: input.userId,
    role: "assistant" as const,
    content: input.assistantMessage,
    created_at: assistantAt,
  };

  let userInsert = await admin
    .from("chats")
    .insert({ ...baseUser, conversation_id: conversationId })
    .select("*")
    .single();

  if (userInsert.error && isMissingColumnError(userInsert.error)) {
    userInsert = await admin
      .from("chats")
      .insert(baseUser)
      .select("*")
      .single();
  }

  if (userInsert.error) {
    console.error("saveChatExchange user error:", userInsert.error);
    return [];
  }

  let assistantInsert = await admin
    .from("chats")
    .insert({ ...baseAssistant, conversation_id: conversationId })
    .select("*")
    .single();

  if (assistantInsert.error && isMissingColumnError(assistantInsert.error)) {
    assistantInsert = await admin
      .from("chats")
      .insert(baseAssistant)
      .select("*")
      .single();
  }

  if (assistantInsert.error) {
    console.error("saveChatExchange assistant error:", assistantInsert.error);
    const userRow = userInsert.data as ChatRow;
    return [
      {
        ...userRow,
        conversation_id: userRow.conversation_id ?? conversationId,
      },
    ];
  }

  const userRow = userInsert.data as ChatRow;
  const assistantRow = assistantInsert.data as ChatRow;
  return [
    {
      ...userRow,
      conversation_id: userRow.conversation_id ?? conversationId,
    },
    {
      ...assistantRow,
      conversation_id: assistantRow.conversation_id ?? conversationId,
    },
  ];
}

/** Удаляет весь диалог по conversation_id (или один обмен по id сообщения) */
export async function deleteChatExchange(
  userId: string,
  messageOrConversationId: string
): Promise<string[]> {
  const admin = createAdminClient();

  const byConversation = await admin
    .from("chats")
    .select("id")
    .eq("user_id", userId)
    .eq("conversation_id", messageOrConversationId);

  if (
    !byConversation.error &&
    Array.isArray(byConversation.data) &&
    byConversation.data.length > 0
  ) {
    const ids = byConversation.data.map((row) => row.id as string);
    const { error: delError } = await admin
      .from("chats")
      .delete()
      .eq("user_id", userId)
      .eq("conversation_id", messageOrConversationId);
    if (delError) {
      console.error("deleteChatExchange conversation error:", delError);
      return [];
    }
    return ids;
  }

  if (byConversation.error && !isMissingColumnError(byConversation.error)) {
    console.error("deleteChatExchange lookup error:", byConversation.error);
  }

  const { data: target, error } = await admin
    .from("chats")
    .select("*")
    .eq("id", messageOrConversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !target) {
    console.error("deleteChatExchange find error:", error);
    return [];
  }

  const convId = (target as ChatRow).conversation_id;
  if (convId) {
    const { data: rows } = await admin
      .from("chats")
      .select("id")
      .eq("user_id", userId)
      .eq("conversation_id", convId);
    const ids = (rows ?? []).map((row) => row.id as string);
    if (ids.length > 0) {
      const { error: delError } = await admin
        .from("chats")
        .delete()
        .eq("user_id", userId)
        .eq("conversation_id", convId);
      if (delError) {
        console.error("deleteChatExchange by conv error:", delError);
        return [];
      }
      return ids;
    }
  }

  const ids = [target.id as string];

  if (target.role === "user") {
    const { data: reply } = await admin
      .from("chats")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "assistant")
      .gt("created_at", target.created_at)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (reply?.id) ids.push(reply.id as string);
  }

  const { error: delError } = await admin
    .from("chats")
    .delete()
    .eq("user_id", userId)
    .in("id", ids);

  if (delError) {
    console.error("deleteChatExchange delete error:", delError);
    return [];
  }
  return ids;
}

export async function listSites(userId: string): Promise<SiteRow[]> {
  const admin = createAdminClient();
  // Лёгкий список без html/css/js — иначе дашборд грузит мегабайты сразу
  const light = await admin
    .from("sites")
    .select("id, user_id, prompt, created_at, version, root_prompt, prompt_hash")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!light.error) {
    return ((light.data ?? []) as SiteRow[]).map((row) => ({
      ...row,
      html: "",
      css: "",
      js: "",
    }));
  }

  if (!isMissingColumnError(light.error)) throw light.error;

  const fallback = await admin
    .from("sites")
    .select("id, user_id, prompt, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (fallback.error) throw fallback.error;
  return ((fallback.data ?? []) as SiteRow[]).map((row) => ({
    ...row,
    html: "",
    css: "",
    js: "",
    version: 1,
    root_prompt: row.prompt,
  }));
}

export async function getSiteById(
  userId: string,
  id: string
): Promise<SiteRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sites")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getSiteById error:", error);
    return null;
  }
  return (data as SiteRow | null) ?? null;
}

export async function listImages(userId: string): Promise<ImageRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("images")
    .select("id, user_id, prompt, image_url, model, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) throw error;
  return (data ?? []) as ImageRow[];
}

export async function listChats(userId: string): Promise<ChatRow[]> {
  const admin = createAdminClient();
  const withConv = await admin
    .from("chats")
    .select("id, user_id, role, content, created_at, conversation_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  let rows: ChatRow[];

  if (!withConv.error) {
    rows = (withConv.data ?? []) as ChatRow[];
  } else if (isMissingColumnError(withConv.error)) {
    const { data, error } = await admin
      .from("chats")
      .select("id, user_id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    rows = (data ?? []) as ChatRow[];
  } else {
    throw withConv.error;
  }

  // Дозаполнить conversation_id, если колонки ещё нет или старые null
  const sortedAsc = [...rows].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let lastUserConv: string | null = null;
  const convById = new Map<string, string>();
  for (const row of sortedAsc) {
    if (row.conversation_id) {
      lastUserConv = row.conversation_id;
      convById.set(row.id, row.conversation_id);
      continue;
    }
    if (row.role === "user") {
      lastUserConv = row.id;
      convById.set(row.id, row.id);
    } else if (lastUserConv) {
      convById.set(row.id, lastUserConv);
    } else {
      convById.set(row.id, row.id);
    }
  }

  return rows.map((row) => ({
    ...row,
    conversation_id: convById.get(row.id) ?? row.id,
  }));
}

export async function deleteHistoryItem(
  kind: HistoryKind,
  id: string,
  userId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(kind)
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    console.error("deleteHistoryItem error:", error);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}
