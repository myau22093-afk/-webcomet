"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { CodeBlock } from "@/components/CodeBlock";
import { WcSelect } from "@/components/WcSelect";
import { SiteWizard } from "@/components/wizard/SiteWizard";
import { HostingOffer } from "@/components/HostingOffer";
import {
  PublishModal,
  PublishSuccessBanner,
} from "@/components/PublishModal";
import { shortSiteTitle } from "@/lib/siteTitle";
import {
  Archive,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  FileUp,
  History,
  ImageIcon,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  ChevronDown,
  ChevronUp,
  Rocket,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Wand2,
  X,
  Phone,
  Plus,
} from "lucide-react";
import {
  IconGear,
  IconHost,
  IconPro,
  IconTariffs,
  IconWizard,
} from "@/components/icons/WcIcons";
import { getSupabase } from "@/lib/supabaseClient";
import {
  buildPreviewHtml,
  type GenerationItem,
} from "@/lib/sitePreview";
import { hasSavedContacts, parseSocials } from "@/lib/contacts";
import { SITE_STYLES, type SiteStyleId } from "@/lib/siteStyles";
import {
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_SITE_MODEL_ID,
  getModelById,
  getModelsByType,
  type ProviderId,
} from "@/lib/models";
import {
  DEFAULT_BRAND_COLORS,
  LOGO_ACCEPT,
  MAX_BRAND_COLORS,
  PREVIEW_DEVICE_WIDTH,
  SITE_SECTION_OPTIONS,
  defaultSections,
  isValidHexColor,
  normalizeBrandColors,
  normalizeHexColor,
  parseBrandColors,
  validateLogoFile,
  type PreviewDevice,
  type SiteSectionId,
} from "@/lib/brand";
import {
  TOKEN_PACKAGES,
  formatTokens,
  getTokenCost,
} from "@/lib/tokenConfig";
import { estimateSiteTokenCharge } from "@/lib/costOptimization";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: {
    resultIndex: number;
    results: ArrayLike<{
      isFinal: boolean;
      0: { transcript: string };
    }>;
  }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type WorkMode = "wizard" | "site" | "image" | "chat" | "settings";
type CodeTab = "html" | "css" | "js";
type MainTab = "preview" | "code" | "compare";
type ImageHistoryItem = {
  id: string;
  prompt: string;
  url: string;
  model?: string;
  createdAt: string;
};

type ProviderStatusItem = {
  id: ProviderId;
  label: string;
  configured: boolean;
  ok: boolean;
};

type ChatHistoryItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  conversationId: string;
};

type ChatConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

type ChatMessage = { role: "user" | "assistant"; content: string };

function sortChatItems<T extends { role: string; createdAt: string; id?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (ta !== tb) return ta - tb;
    if (a.role !== b.role) return a.role === "user" ? -1 : 1;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}

function mapChatRow(row: {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  conversation_id?: string | null;
}): ChatHistoryItem {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    conversationId: row.conversation_id ?? row.id,
  };
}

function groupChatConversations(items: ChatHistoryItem[]): ChatConversation[] {
  const byId = new Map<string, ChatHistoryItem[]>();
  for (const item of items) {
    const key = item.conversationId || item.id;
    const list = byId.get(key) ?? [];
    list.push(item);
    byId.set(key, list);
  }

  const conversations: ChatConversation[] = [];
  for (const [id, rows] of byId) {
    const sorted = sortChatItems(rows);
    const firstUser = sorted.find((m) => m.role === "user");
    const last = sorted[sorted.length - 1];
    conversations.push({
      id,
      title: firstUser?.content?.trim() || "Чат",
      updatedAt: last?.createdAt ?? firstUser?.createdAt ?? new Date().toISOString(),
      messages: sorted.map((m) => ({ role: m.role, content: m.content })),
    });
  }

  return conversations.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

type UsageStatus = {
  remaining: number;
  remainingImages: number;
  remainingChat: number;
  limit: number;
  imageLimit: number;
  chatLimit: number;
  used: number;
  imageUsed: number;
  chatUsed: number;
  tierLabel: string;
  isUnlimited: boolean;
  tokenBalance: number;
  totalTokensUsed: number;
};

export default function DashboardPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const designInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const addColorInputRef = useRef<HTMLInputElement>(null);
  const generateFormRef = useRef<HTMLFormElement>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<{
    email?: string;
    access_token?: string;
  } | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode>("wizard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState<UsageStatus>({
    remaining: 100,
    remainingImages: 100,
    remainingChat: 100,
    limit: 0,
    imageLimit: 0,
    chatLimit: 0,
    used: 0,
    imageUsed: 0,
    chatUsed: 0,
    tierLabel: "Tokens",
    isUnlimited: false,
    tokenBalance: 100,
    totalTokensUsed: 0,
  });
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [sitePanelOpen, setSitePanelOpen] = useState(true);

  // Site mode
  const [prompt, setPrompt] = useState("");
  const [customRequirements, setCustomRequirements] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [designImage, setDesignImage] = useState("");
  const [uploadingDesign, setUploadingDesign] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<GenerationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>("preview");
  const [codeTab, setCodeTab] = useState<CodeTab>("html");
  const [copied, setCopied] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [showHostingNudge, setShowHostingNudge] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishLiveSlug, setPublishLiveSlug] = useState<string | null>(null);
  const [exportingHtml, setExportingHtml] = useState(false);
  const [previewSrcDoc, setPreviewSrcDoc] = useState("");
  const [previewFrameKey, setPreviewFrameKey] = useState(0);
  const [qualityMode, setQualityMode] = useState<"fast" | "quality">("quality");
  const [siteModelId, setSiteModelId] = useState(DEFAULT_SITE_MODEL_ID);
  const [siteStyle, setSiteStyle] = useState<SiteStyleId>("minimalism");
  const [isEditMode, setIsEditMode] = useState(false);
  const [liveEditPrompt, setLiveEditPrompt] = useState("");
  const [liveEditing, setLiveEditing] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [lastModelLabel, setLastModelLabel] = useState("");
  const [lastModelReason, setLastModelReason] = useState("");
  const [lastProviderLabel, setLastProviderLabel] = useState("");
  const [lastCached, setLastCached] = useState(false);
  const [brandLogo, setBrandLogo] = useState("");
  const [brandColors, setBrandColors] = useState<string[]>([
    ...DEFAULT_BRAND_COLORS,
  ]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [selectedSections, setSelectedSections] =
    useState<SiteSectionId[]>(defaultSections);
  const [expressMode, setExpressMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [dictationDraft, setDictationDraft] = useState("");

  // Image mode
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL_ID);
  const [imageLoading, setImageLoading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);

  // Chat mode
  const [chatInput, setChatInput] = useState("");
  const [chatModelId, setChatModelId] = useState(DEFAULT_CHAT_MODEL_ID);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const [providerStatus, setProviderStatus] = useState<ProviderStatusItem[]>([]);
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSocials, setContactSocials] = useState<string[]>([""]);
  const [showContacts, setShowContacts] = useState(true);
  const [useContactsOnGenerate, setUseContactsOnGenerate] = useState(true);
  const [savingContacts, setSavingContacts] = useState(false);
  const [contactsSavedHint, setContactsSavedHint] = useState("");

  const activeItem = useMemo(
    () => history.find((item) => item.id === activeId) ?? null,
    [history, activeId]
  );

  const livePreviewHtml = useMemo(() => {
    if (!activeItem) return "";
    if (activeItem.html || activeItem.css || activeItem.js) {
      return buildPreviewHtml({
        html: activeItem.html,
        css: activeItem.css,
        js: activeItem.js,
      });
    }
    return activeItem.previewHtml || "";
  }, [
    activeItem?.id,
    activeItem?.previewHtml,
    activeItem?.html,
    activeItem?.css,
    activeItem?.js,
  ]);

  useEffect(() => {
    if (!livePreviewHtml) {
      setPreviewSrcDoc("");
      return;
    }
    const timer = window.setTimeout(() => {
      setPreviewSrcDoc(livePreviewHtml);
      setPreviewFrameKey((k) => k + 1);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [livePreviewHtml]);

  const siteHistoryGroups = useMemo(() => {
    const map = new Map<string, GenerationItem[]>();
    for (const item of history) {
      const key = item.rootPrompt || item.prompt;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([rootPrompt, items]) => ({
      rootPrompt,
      items: [...items].sort((a, b) => b.version - a.version),
    }));
  }, [history]);

  const chatConversations = useMemo(
    () => groupChatConversations(chatHistory),
    [chatHistory]
  );

  const codeValue = useMemo(() => {
    if (!activeItem) return "";
    if (codeTab === "css") return activeItem.css;
    if (codeTab === "js") return activeItem.js;
    return activeItem.html;
  }, [activeItem, codeTab]);

  async function getFreshAccessToken(): Promise<string | null> {
    const supabase = getSupabase();
    const { data: first } = await supabase.auth.getSession();

    if (first.session?.access_token) {
      const expiresAt = first.session.expires_at ?? 0;
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt - now > 60) {
        setUser({
          email: first.session.user.email,
          access_token: first.session.access_token,
        });
        return first.session.access_token;
      }
    }

    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session?.access_token) {
      console.error("session refresh error:", error);
      return null;
    }

    setUser({
      email: refreshed.session.user.email,
      access_token: refreshed.session.access_token,
    });
    return refreshed.session.access_token;
  }

  async function loadStatus(accessToken: string) {
    const res = await fetch("/api/user/status", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) return;

    setStatus({
      remaining: Math.max(0, data.token_balance ?? data.remaining ?? 0),
      remainingImages: Math.max(0, data.token_balance ?? data.remainingImages ?? 0),
      remainingChat: Math.max(0, data.token_balance ?? data.remainingChat ?? 0),
      limit: 0,
      imageLimit: 0,
      chatLimit: 0,
      used: data.total_tokens_used ?? 0,
      imageUsed: data.total_tokens_used ?? 0,
      chatUsed: data.total_tokens_used ?? 0,
      tierLabel: data.tierLabel ?? "Tokens",
      isUnlimited: false,
      tokenBalance: Math.max(0, data.token_balance ?? data.remaining ?? 0),
      totalTokensUsed: data.total_tokens_used ?? 0,
    });

    if (typeof data.phone === "string") setContactPhone(data.phone);
    if (typeof data.email === "string" && data.email) {
      setContactEmail(data.email);
    }
    if (data.socials != null) {
      const list = parseSocials(data.socials);
      setContactSocials(list.length > 0 ? list : [""]);
    }
    if (typeof data.show_contacts === "boolean") {
      setShowContacts(data.show_contacts);
    }

    if (typeof data.brand_logo === "string" && data.brand_logo) {
      setBrandLogo(data.brand_logo);
      try {
        localStorage.setItem("wc_brand_logo", data.brand_logo);
      } catch {
        /* ignore */
      }
    }
    if (data.brand_colors != null) {
      const colors = parseBrandColors(data.brand_colors);
      setBrandColors(colors);
      try {
        localStorage.setItem("wc_brand_colors", JSON.stringify(colors));
      } catch {
        /* ignore */
      }
    }
  }

  function loadLocalSitePrefs() {
    try {
      const useC = localStorage.getItem("wc_use_contacts");
      if (useC === "0") setUseContactsOnGenerate(false);
      if (useC === "1") setUseContactsOnGenerate(true);
    } catch {
      /* ignore */
    }
    try {
      const logo = localStorage.getItem("wc_brand_logo");
      if (logo) setBrandLogo(logo);
      const colorsRaw = localStorage.getItem("wc_brand_colors");
      if (colorsRaw) setBrandColors(parseBrandColors(JSON.parse(colorsRaw)));
      const sectionsRaw = localStorage.getItem("wc_sections");
      if (sectionsRaw) {
        const parsed = JSON.parse(sectionsRaw) as string[];
        if (Array.isArray(parsed) && parsed.length) {
          setSelectedSections(
            parsed.filter((id): id is SiteSectionId =>
              SITE_SECTION_OPTIONS.some((s) => s.id === id)
            )
          );
        }
      }
      const express = localStorage.getItem("wc_express");
      if (express === "1") setExpressMode(true);
      const device = localStorage.getItem("wc_preview_device") as PreviewDevice | null;
      if (device === "phone" || device === "tablet" || device === "desktop") {
        setPreviewDevice(device);
      }
    } catch {
      /* ignore */
    }
  }

  async function persistBrandSettings(
    accessToken: string,
    next: { logo?: string; colors?: string[] }
  ) {
    const logo = next.logo ?? brandLogo;
    const colors = next.colors ?? brandColors;
    try {
      localStorage.setItem("wc_brand_logo", logo);
      localStorage.setItem("wc_brand_colors", JSON.stringify(colors));
    } catch {
      /* ignore */
    }
    setSavingBrand(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          brand_logo: logo || null,
          brand_colors: colors,
        }),
      });
    } catch (error) {
      console.error("persist brand:", error);
    } finally {
      setSavingBrand(false);
    }
  }

  async function loadHistories(accessToken: string) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    try {
      const [sitesRes, imagesRes, chatsRes] = await Promise.all([
        fetch("/api/history/sites", { headers }),
        fetch("/api/history/images", { headers }),
        fetch("/api/history/chats", { headers }),
      ]);

      if (sitesRes.ok) {
        const data = await sitesRes.json();
        const items: GenerationItem[] = (data.items ?? []).map(
          (row: {
            id: string;
            prompt: string;
            html?: string;
            css?: string;
            js?: string;
            created_at: string;
            version?: number;
            root_prompt?: string;
          }) => {
            const html = row.html ?? "";
            const css = row.css ?? "";
            const js = row.js ?? "";
            return {
              id: row.id,
              prompt: row.prompt,
              rootPrompt: row.root_prompt || row.prompt,
              version: row.version ?? 1,
              customRequirements: "",
              images: [],
              html,
              css,
              js,
              previewHtml: html
                ? buildPreviewHtml({ html, css, js })
                : "",
              createdAt: row.created_at,
            };
          }
        );
        setHistory(items);
        const firstId = items[0]?.id;
        if (firstId) {
          setActiveId((prev) => prev ?? firstId);
          void ensureSiteLoaded(accessToken, firstId);
        }
      }

      if (imagesRes.ok) {
        const data = await imagesRes.json();
        const items: ImageHistoryItem[] = (data.items ?? []).map(
          (row: {
            id: string;
            prompt: string;
            image_url: string;
            model?: string;
            created_at: string;
          }) => ({
            id: row.id,
            prompt: row.prompt,
            url: row.image_url,
            model: row.model,
            createdAt: row.created_at,
          })
        );
        setImageHistory(items);
        if (items[0] && !generatedImageUrl) setGeneratedImageUrl(items[0].url);
      }

      if (chatsRes.ok) {
        const data = await chatsRes.json();
        const items: ChatHistoryItem[] = (data.items ?? []).map(
          (row: {
            id: string;
            role: "user" | "assistant";
            content: string;
            created_at: string;
            conversation_id?: string | null;
          }) => mapChatRow(row)
        );
        setChatHistory(items);
      }
    } catch (error) {
      console.error("loadHistories error:", error);
    }
  }

  async function ensureSiteLoaded(accessToken: string, siteId: string) {
    try {
      const res = await fetch(
        `/api/history/${encodeURIComponent(siteId)}?type=sites`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const row = data.item as {
        id: string;
        prompt: string;
        html: string;
        css?: string;
        js?: string;
        created_at: string;
        version?: number;
        root_prompt?: string;
      } | null;
      if (!row) return;

      const html = row.html ?? "";
      const css = row.css ?? "";
      const js = row.js ?? "";
      setHistory((prev) => {
        const idx = prev.findIndex((item) => item.id === siteId);
        const current = idx >= 0 ? prev[idx] : null;
        if (current?.html && current.previewHtml) return prev;

        const mapped: GenerationItem = {
          id: row.id,
          prompt: row.prompt,
          rootPrompt: row.root_prompt || row.prompt,
          version: row.version ?? 1,
          customRequirements: "",
          images: [],
          html,
          css,
          js,
          previewHtml: buildPreviewHtml({ html, css, js }),
          createdAt: row.created_at,
        };
        if (idx === -1) return [mapped, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...mapped };
        return next;
      });
    } catch (error) {
      console.error("ensureSiteLoaded error:", error);
    }
  }

  async function deleteHistoryRecord(
    type: "sites" | "images" | "chats",
    id: string
  ) {
    // Сразу убираем из UI, потом подтверждаем на сервере
    const prevHistory = history;
    const prevImageHistory = imageHistory;
    const prevChatHistory = chatHistory;
    const prevActiveId = activeId;
    const prevGeneratedImageUrl = generatedImageUrl;
    const prevChatMessages = chatMessages;
    const prevActiveConversationId = activeConversationId;

    if (type === "sites") {
      const next = history.filter((item) => item.id !== id);
      setHistory(next);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
    } else if (type === "images") {
      const removed = imageHistory.find((item) => item.id === id);
      const next = imageHistory.filter((item) => item.id !== id);
      setImageHistory(next);
      if (removed && generatedImageUrl === removed.url) {
        setGeneratedImageUrl(next[0]?.url ?? "");
      }
    } else {
      const next = chatHistory.filter((item) => item.conversationId !== id);
      setChatHistory(next);
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setChatMessages([]);
      }
    }

    try {
      const accessToken = await getFreshAccessToken();
      if (!accessToken) {
        throw new Error("Сессия истекла");
      }

      const res = await fetch(`/api/history/${encodeURIComponent(id)}?type=${type}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error ?? "Не удалось удалить");
      }

      if (type === "chats" && Array.isArray(data.deletedIds)) {
        const deletedIds = new Set<string>(data.deletedIds);
        setChatHistory((prev) => prev.filter((item) => !deletedIds.has(item.id)));
      }
    } catch (error) {
      setHistory(prevHistory);
      setImageHistory(prevImageHistory);
      setChatHistory(prevChatHistory);
      setActiveId(prevActiveId);
      setGeneratedImageUrl(prevGeneratedImageUrl);
      setChatMessages(prevChatMessages);
      setActiveConversationId(prevActiveConversationId);
      alert(error instanceof Error ? error.message : "Не удалось удалить");
    }
  }

  useEffect(() => {
    loadLocalSitePrefs();
    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setSpeechSupported(
      Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
    );

    const supabase = getSupabase();

    getFreshAccessToken().then(async (token) => {
      if (!token) return;
      await Promise.all([
        loadStatus(token),
        loadHistories(token),
        (async () => {
          try {
            const res = await fetch("/api/providers/status", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok && Array.isArray(data.providers)) {
              setProviderStatus(data.providers);
            }
          } catch (error) {
            console.error("providers status:", error);
          }
        })(),
      ]);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        return;
      }
      setUser({
        email: session.user.email,
        access_token: session.access_token,
      });
    });

    return () => {
      subscription.unsubscribe();
      try {
        speechRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setSidebarOpen(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    if (activeItem) setSitePanelOpen(false);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeItem) setIsEditMode(false);
  }, [activeItem]);

  useEffect(() => {
    if (isEditMode) setSiteModelId("gpt-5.6-luna");
  }, [isEditMode]);

  useEffect(() => {
    if (mainTab === "compare" && activeItem && !activeItem.designImage) {
      setMainTab("preview");
    }
  }, [activeItem, mainTab]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ошибка загрузки");
      setImages((prev) => [...prev, ...data.urls]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleUploadDesign(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      alert("Нужен файл изображения (скриншот)");
      return;
    }

    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }

    setUploadingDesign(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ошибка загрузки");
      const url = data.urls?.[0];
      if (!url) throw new Error("Нет URL скриншота");
      setDesignImage(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка загрузки скриншота");
    } finally {
      setUploadingDesign(false);
      if (designInputRef.current) designInputRef.current.value = "";
    }
  }

  async function handleUploadLogo(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const validationError = validateLogoFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("kind", "logo");
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ошибка загрузки логотипа");
      const url = (data.url as string | undefined) ?? data.urls?.[0];
      if (!url) throw new Error("Нет URL логотипа");
      setBrandLogo(url);
      await persistBrandSettings(accessToken, { logo: url });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка загрузки логотипа");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleBrandColorChange(index: number, value: string) {
    const next = [...brandColors];
    next[index] = value;
    setBrandColors(next);
    if (!isValidHexColor(value)) return;
    const normalized = normalizeBrandColors(next);
    setBrandColors(normalized);
    const accessToken = await getFreshAccessToken();
    if (!accessToken) return;
    await persistBrandSettings(accessToken, { colors: normalized });
  }

  async function addBrandColor(value: string) {
    if (brandColors.length >= MAX_BRAND_COLORS) return;
    if (!isValidHexColor(value)) return;
    const hex = normalizeHexColor(value, value);
    const normalized = normalizeBrandColors([...brandColors, hex]);
    setBrandColors(normalized);
    const accessToken = await getFreshAccessToken();
    if (!accessToken) return;
    await persistBrandSettings(accessToken, { colors: normalized });
  }

  async function removeBrandColor(index: number) {
    if (brandColors.length <= 1) return;
    const normalized = normalizeBrandColors(
      brandColors.filter((_, i) => i !== index)
    );
    setBrandColors(normalized);
    const accessToken = await getFreshAccessToken();
    if (!accessToken) return;
    await persistBrandSettings(accessToken, { colors: normalized });
  }

  function toggleSection(id: SiteSectionId) {
    setSelectedSections((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      const ordered = SITE_SECTION_OPTIONS.map((s) => s.id).filter((item) =>
        next.includes(item)
      );
      try {
        localStorage.setItem("wc_sections", JSON.stringify(ordered));
      } catch {
        /* ignore */
      }
      return ordered;
    });
  }

  function setPreviewDevicePersistent(device: PreviewDevice) {
    setPreviewDevice(device);
    try {
      localStorage.setItem("wc_preview_device", device);
    } catch {
      /* ignore */
    }
  }

  function setExpressModePersistent(on: boolean) {
    setExpressMode(on);
    try {
      localStorage.setItem("wc_express", on ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function setUseContactsPersistent(on: boolean) {
    setUseContactsOnGenerate(on);
    try {
      localStorage.setItem("wc_use_contacts", on ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function stopDictation() {
    try {
      speechRef.current?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
  }

  function startDictation() {
    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      alert(
        "Голосовой ввод не поддерживается в этом браузере. Откройте Chrome или Edge."
      );
      return;
    }

    try {
      speechRef.current?.stop();
    } catch {
      /* ignore */
    }

    const recognition = new Ctor();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = true;
    speechRef.current = recognition;
    setDictationDraft("");
    setIsListening(true);

    let committed = prompt;
    const shouldAutoSubmit = expressMode || Boolean(designImage);

    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      if (finalText) {
        const base = committed.trim();
        committed = base ? `${base} ${finalText.trim()}` : finalText.trim();
        setPrompt(committed);
        setDictationDraft("");
      } else {
        setDictationDraft(interim);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "not-allowed") {
        alert(
          "Нет доступа к микрофону. Разрешите микрофон в настройках браузера."
        );
      } else if (event.error !== "aborted") {
        alert("Не удалось распознать речь. Попробуйте ещё раз.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setDictationDraft("");
      if (committed.trim() || shouldAutoSubmit) {
        window.setTimeout(() => {
          generateFormRef.current?.requestSubmit();
        }, 80);
      }
    };

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      alert("Не удалось запустить диктовку");
    }
  }

  async function handleGenerateSite(event: React.FormEvent) {
    event.preventDefault();
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }
    if (!prompt.trim() && !designImage && !expressMode) {
      alert(
        isEditMode
          ? "Опишите, что изменить"
          : "Введите описание сайта, включите Экспресс или загрузите референс"
      );
      return;
    }
    if (
      useContactsOnGenerate &&
      showContacts &&
      !contactsReady &&
      !isEditMode
    ) {
      const goSettings = window.confirm(
        "Контакты ещё не сохранены. Открыть настройки, чтобы заполнить телефон, email и соцсети?\n\n«Отмена» — сгенерировать с примерными контактами."
      );
      if (goSettings) {
        setWorkMode("settings");
        return;
      }
    }
    const promptLen = prompt.trim().length + customRequirements.trim().length;
    if (promptLen > 8000) {
      alert(
        `Слишком длинный текст: ${promptLen} символов. Максимум 8000 для описания + «Твои пожелания».`
      );
      return;
    }
    if (isEditMode && !activeItem) {
      alert("Сначала выберите сайт в истории для правки");
      return;
    }
    if (selectedSections.length === 0 && !isEditMode) {
      alert("Выберите хотя бы одну секцию");
      return;
    }

    const invalidColor = brandColors.find((c) => !isValidHexColor(c));
    if (invalidColor && !isEditMode) {
      alert(`Неверный HEX-цвет: ${invalidColor}`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/generate-site", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          prompt:
            prompt.trim() ||
            (expressMode
              ? "Придумай и создай законченный современный лендинг"
              : "Сверстай сайт по скриншоту"),
          customRequirements: customRequirements.trim(),
          images,
          hasImages: images.length > 0,
          qualityMode: expressMode ? "quality" : qualityMode,
          modelId: expressMode ? DEFAULT_SITE_MODEL_ID : siteModelId,
          style: siteStyle,
          designImage: designImage || undefined,
          isEdit: isEditMode,
          brandLogo: brandLogo || undefined,
          brandColors: normalizeBrandColors(brandColors),
          sections: selectedSections,
          expressMode: expressMode && !isEditMode,
          useContacts: useContactsOnGenerate && showContacts,
          ...(isEditMode && activeItem
            ? {
                existingHtml: activeItem.html,
                existingCss: activeItem.css,
                existingJs: activeItem.js,
              }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error(data.error ?? "Ошибка генерации, попробуйте ещё раз");
      }
      if (!data.html?.trim()) {
        throw new Error("Ошибка генерации, попробуйте ещё раз");
      }

      setLastModelLabel(data.modelLabel ?? "");
      setLastModelReason(data.modelReason ?? "");
      setLastProviderLabel(data.providerLabel ?? data.provider ?? "");
      setLastCached(Boolean(data.cached));

      const rootPrompt =
        prompt.trim() ||
        (expressMode
          ? "Экспресс-сайт"
          : designImage
            ? `Скриншот: ${designImage}`
            : "Сайт");
      const item: GenerationItem = {
        id: data.id ?? crypto.randomUUID(),
        prompt: rootPrompt,
        rootPrompt,
        version: 1,
        customRequirements: customRequirements.trim(),
        images: [...images],
        designImage: designImage || data.designImage || undefined,
        html: data.html,
        css: data.css ?? "",
        js: data.js ?? "",
        previewHtml: buildPreviewHtml({
          html: data.html,
          css: data.css,
          js: data.js,
        }),
        createdAt: data.created_at ?? new Date().toISOString(),
      };
      setHistory((prev) => [item, ...prev.filter((x) => x.id !== item.id)]);
      setActiveId(item.id);
      setMainTab(designImage ? "compare" : "preview");
      await loadStatus(accessToken);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка генерации");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLiveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!activeItem) return;
    const editPrompt = liveEditPrompt.trim();
    if (!editPrompt) {
      alert("Напишите, что изменить (например: сделай все кнопки зелёными)");
      return;
    }

    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }

    setLiveEditing(true);
    try {
      const response = await fetch("/api/edit-site", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          html: activeItem.html,
          css: activeItem.css,
          js: activeItem.js,
          editPrompt,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ошибка правки");
      if (!data.html) throw new Error("Нет html в ответе");

      setLastModelLabel(data.modelLabel ?? "");
      setLastModelReason(data.modelReason ?? "");
      setLastCached(false);

      setHistory((prev) =>
        prev.map((item) =>
          item.id === activeItem.id
            ? {
                ...item,
                html: data.html,
                css: data.css ?? "",
                js: data.js ?? "",
                previewHtml: buildPreviewHtml({
                  html: data.html,
                  css: data.css,
                  js: data.js,
                }),
              }
            : item
        )
      );
      setLiveEditPrompt("");
      setMainTab("preview");
      await loadStatus(accessToken);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка правки");
    } finally {
      setLiveEditing(false);
    }
  }

  async function handleSaveVersion() {
    if (!activeItem) return;
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }

    setSavingVersion(true);
    try {
      const response = await fetch("/api/save-site-version", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          html: activeItem.html,
          css: activeItem.css,
          js: activeItem.js,
          rootPrompt: activeItem.rootPrompt || activeItem.prompt,
          note: liveEditPrompt.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить");

      const item: GenerationItem = {
        id: data.id,
        prompt: data.prompt,
        rootPrompt: data.root_prompt || activeItem.rootPrompt,
        version: data.version ?? 2,
        customRequirements: activeItem.customRequirements,
        images: activeItem.images,
        html: data.html,
        css: data.css ?? "",
        js: data.js ?? "",
        previewHtml: buildPreviewHtml({
          html: data.html,
          css: data.css,
          js: data.js,
        }),
        createdAt: data.created_at ?? new Date().toISOString(),
      };
      setHistory((prev) => [item, ...prev.filter((x) => x.id !== item.id)]);
      setActiveId(item.id);
      alert(`Версия ${item.version} сохранена`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setSavingVersion(false);
    }
  }

  async function handleGenerateImage(event: React.FormEvent) {
    event.preventDefault();
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }
    if (!imagePrompt.trim()) {
      alert("Введите описание изображения");
      return;
    }

    setImageLoading(true);
    setImageError("");
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          prompt: imagePrompt.trim(),
          model: imageModel,
          modelId: imageModel,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ошибка генерации изображения");
      if (!data.url) throw new Error("Нет URL изображения");

      setGeneratedImageUrl(data.url);
      setImageError("");
      setLastModelLabel(data.modelLabel ?? imageModel);
      setLastProviderLabel(data.providerLabel ?? data.provider ?? "");
      setLastModelReason(
        data.usedFallback ? "" : ""
      );
      setImageHistory((prev) => [
        {
          id: data.id ?? crypto.randomUUID(),
          prompt: imagePrompt.trim(),
          url: data.url,
          model: data.model,
          createdAt: data.created_at ?? new Date().toISOString(),
        },
        ...prev.filter((x) => x.id !== data.id),
      ]);
      await loadStatus(accessToken);
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Ошибка генерации изображения"
      );
    } finally {
      setImageLoading(false);
    }
  }

  async function handleSendChat(event: React.FormEvent) {
    event.preventDefault();
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    const conversationId = activeConversationId ?? crypto.randomUUID();
    if (!activeConversationId) setActiveConversationId(conversationId);

    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: userMessage,
          history: chatMessages,
          modelId: chatModelId,
          conversationId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ошибка чата");

      const reply = data.response ?? data.reply ?? "";
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply },
      ]);

      setLastModelLabel(data.modelLabel ?? "");
      setLastModelReason(data.modelReason ?? "");
      setLastProviderLabel(data.providerLabel ?? data.provider ?? "");
      setLastCached(false);

      const resolvedConversationId =
        (typeof data.conversationId === "string" && data.conversationId) ||
        conversationId;
      setActiveConversationId(resolvedConversationId);

      if (Array.isArray(data.saved) && data.saved.length > 0) {
        const mapped: ChatHistoryItem[] = data.saved.map(
          (row: {
            id: string;
            role: "user" | "assistant";
            content: string;
            created_at: string;
            conversation_id?: string | null;
          }) =>
            mapChatRow({
              ...row,
              conversation_id: row.conversation_id ?? resolvedConversationId,
            })
        );
        setChatHistory((prev) => {
          const withoutDup = prev.filter(
            (item) => !mapped.some((m) => m.id === item.id)
          );
          return [...mapped, ...withoutDup];
        });
      } else {
        const token = accessToken;
        const headers = { Authorization: `Bearer ${token}` };
        const chatsRes = await fetch("/api/history/chats", { headers });
        if (chatsRes.ok) {
          const chatData = await chatsRes.json();
          const items: ChatHistoryItem[] = (chatData.items ?? []).map(
            (row: {
              id: string;
              role: "user" | "assistant";
              content: string;
              created_at: string;
              conversation_id?: string | null;
            }) => mapChatRow(row)
          );
          setChatHistory(items);
        }
      }
      await loadStatus(accessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка чата";
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Ошибка: ${message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleCopy() {
    if (!codeValue) return;
    await navigator.clipboard.writeText(codeValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function buildExportPayload(format: "zip" | "html") {
    if (!activeItem) return null;
    const title =
      activeItem.rootPrompt?.trim().slice(0, 80) ||
      activeItem.prompt?.trim().slice(0, 80) ||
      "Сайт";
    return {
      html: activeItem.html,
      css: activeItem.css,
      js: activeItem.js,
      title,
      description: activeItem.customRequirements?.trim().slice(0, 160) || title,
      formEmail: contactEmail.trim() || undefined,
      format,
    };
  }

  async function handleDownload() {
    if (!activeItem) return;
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }

    const payload = buildExportPayload("html");
    if (!payload) return;

    setExportingHtml(true);
    try {
      const res = await fetch("/api/export-zip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Не удалось скачать HTML"
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "index.html";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка скачивания HTML");
    } finally {
      setExportingHtml(false);
    }
  }

  async function handleDownloadZip() {
    if (!activeItem) return;
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }

    const payload = buildExportPayload("zip");
    if (!payload) return;

    setExportingZip(true);
    try {
      const res = await fetch("/api/export-zip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Не удалось создать ZIP"
        );
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "webcomet-site.zip";
      link.click();
      URL.revokeObjectURL(url);
      setShowHostingNudge(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка экспорта ZIP");
    } finally {
      setExportingZip(false);
    }
  }

  async function handleLogout() {
    await getSupabase().auth.signOut();
    window.location.href = "/login";
  }

  async function handleSaveContacts() {
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }
    setSavingContacts(true);
    setContactsSavedHint("");
    try {
      const res = await fetch("/api/user/update-contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          phone: contactPhone.trim(),
          email: contactEmail.trim(),
          socials: contactSocials.map((s) => s.trim()).filter(Boolean),
          show_contacts: showContacts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Не удалось сохранить");

      const saved = data.contacts ?? data;
      if (typeof saved.phone === "string") setContactPhone(saved.phone);
      if (typeof saved.email === "string") setContactEmail(saved.email);
      if (saved.socials != null) {
        const list = parseSocials(saved.socials);
        setContactSocials(list.length > 0 ? list : [""]);
      }
      if (typeof saved.show_contacts === "boolean") {
        setShowContacts(saved.show_contacts);
      }
      if (typeof data.token_balance === "number") {
        setStatus((prev) => ({
          ...prev,
          tokenBalance: Math.max(0, data.token_balance),
          totalTokensUsed: data.total_tokens_used ?? prev.totalTokensUsed,
        }));
      }
      setContactsSavedHint("Контакты сохранены");
      setTimeout(() => setContactsSavedHint(""), 2500);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setSavingContacts(false);
    }
  }

  const contactsPreview = useMemo(() => {
    return {
      phone: contactPhone.trim(),
      email: contactEmail.trim(),
      socials: contactSocials.map((s) => s.trim()).filter(Boolean),
      show_contacts: showContacts,
    };
  }, [contactPhone, contactEmail, contactSocials, showContacts]);

  const contactsReady = hasSavedContacts(contactsPreview);

  async function handlePurchasePackage(packageId: string) {
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      alert("Сессия истекла. Войдите снова.");
      window.location.href = "/login";
      return;
    }
    setPurchasingId(packageId);
    try {
      const res = await fetch("/api/purchase-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка покупки");
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl as string;
        return;
      }
      throw new Error("Нет ссылки на оплату");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Ошибка покупки");
    } finally {
      setPurchasingId(null);
    }
  }

  const siteChargePreview = estimateSiteTokenCharge({
    prompt: prompt || (expressMode ? "экспресс лендинг" : ""),
    customRequirements,
    isEdit: isEditMode,
    modelId: siteModelId,
    forceVision: Boolean(designImage) && !isEditMode,
    expressMode: expressMode && !isEditMode,
  });
  const siteTokenCost = siteChargePreview.tokens;
  const imageTokenCost = getTokenCost(imageModel);
  const chatTokenCost = getTokenCost(chatModelId);
  const activeTokenCost =
    workMode === "site"
      ? siteTokenCost
      : workMode === "wizard"
        ? getTokenCost("gpt-5.6-sol")
        : workMode === "image"
          ? imageTokenCost
          : chatTokenCost;
  const balanceAfterRequest = Math.max(
    0,
    status.tokenBalance - activeTokenCost
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokens = params.get("tokens");
    const publish = params.get("publish");
    if (tokens === "credited" || tokens === "success" || tokens === "already") {
      void (async () => {
        const t = await getFreshAccessToken();
        if (t) await loadStatus(t);
      })();
      if (tokens === "credited" || tokens === "success") {
        const amount = params.get("amount");
        alert(
          amount
            ? `Зачислено ${amount} токенов`
            : "Токены успешно зачислены"
        );
      }
      window.history.replaceState({}, "", "/dashboard");
    }
    if (publish === "live" || publish === "success") {
      const slug = params.get("slug");
      if (slug) setPublishLiveSlug(slug);
      setWorkMode("site");
      window.history.replaceState({}, "", "/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wc-atmosphere flex h-dvh overflow-hidden text-zinc-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Закрыть меню"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0"
        } fixed inset-y-0 left-0 z-40 w-72 shrink-0 overflow-hidden border-r border-white/10 glass-panel transition-all duration-300 md:static ${
          sidebarOpen ? "md:w-72" : "md:w-0"
        }`}
      >
        <div className="flex h-full w-72 flex-col">
          <div className="border-b border-white/10 px-4 py-3">
            <BrandLogo size="sm" />
          </div>

          <div className="space-y-1 p-3">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
              Дашборд
            </p>
            {(
              [
                { id: "wizard" as const, label: "Мастер", icon: IconWizard },
                { id: "site" as const, label: "Редактор", icon: IconPro },
                { id: "settings" as const, label: "Настройки", icon: IconGear },
              ] as const
            ).map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setWorkMode(mode.id);
                    if (typeof window !== "undefined" && window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`wc-nav-item ${
                    workMode === mode.id ? "wc-nav-item-active" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {mode.label}
                </button>
              );
            })}
            <Link href="/hosting" className="wc-nav-item mt-1">
              <IconHost className="h-5 w-5" />
              Хостинг
            </Link>
            <Link href="/pricing" className="wc-nav-item mt-1">
              <IconTariffs className="h-5 w-5" />
              Тарифы
            </Link>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {workMode === "settings" ? (
              <>
                <Settings className="h-3.5 w-3.5" />
                Профиль
              </>
            ) : (
              <>
                <History className="h-3.5 w-3.5" />
                История
              </>
            )}
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
            {workMode === "settings" && (
              <div className="mx-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-400">
                <p className="font-medium text-zinc-200">Контакты</p>
                <p className="mt-1.5 leading-relaxed">
                  Телефон, email и соцсети подставляются в футер и секцию
                  «Контакты» на генерируемых сайтах.
                </p>
                {contactsReady ? (
                  <p className="mt-2 text-violet-300">
                    {contactsPreview.phone || "—"}
                    {contactsPreview.email
                      ? ` · ${contactsPreview.email}`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-2 text-amber-300/90">Ещё не заполнены</p>
                )}
              </div>
            )}
            {(workMode === "site" || workMode === "wizard") &&
              (siteHistoryGroups.length === 0 ? (
                <p className="px-3 py-4 text-[13px] text-zinc-500">
                  Пока нет сайтов
                </p>
              ) : (
                siteHistoryGroups.map((group) => {
                  const title = shortSiteTitle(group.rootPrompt);
                  return (
                    <div key={group.rootPrompt} className="mb-0.5">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className={`group flex items-start gap-1 rounded-xl ${
                            activeId === item.id
                              ? "bg-wc-purple/20 text-white"
                              : "text-zinc-400 hover:bg-white/5"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveId(item.id);
                              setMainTab("preview");
                              if (workMode === "wizard") setWorkMode("site");
                              void getFreshAccessToken().then((token) => {
                                if (token) void ensureSiteLoaded(token, item.id);
                              });
                            }}
                            className="min-w-0 flex-1 px-3 py-2.5 text-left"
                          >
                            <p className="truncate text-[13px] leading-snug text-zinc-200">
                              {group.items.length > 1 ? (
                                <span className="mr-1.5 text-[11px] text-violet-300/90">
                                  v{item.version}
                                </span>
                              ) : null}
                              {title}
                            </p>
                            <p className="mt-1 text-[11px] text-zinc-600">
                              {new Date(item.createdAt).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </button>
                          <button
                            type="button"
                            title="Удалить"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteHistoryRecord("sites", item.id);
                            }}
                            className="mr-2 mt-2 rounded-lg p-1.5 text-zinc-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })
              ))}

            {workMode === "image" &&
              (imageHistory.length === 0 ? (
                <p className="px-3 py-4 text-sm text-zinc-500">Пока нет картинок</p>
              ) : (
                imageHistory.map((item) => (
                  <div
                    key={item.id}
                    className={`group flex items-start gap-1 rounded-xl ${
                      generatedImageUrl === item.url
                        ? "bg-wc-purple/20 text-white"
                        : "text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setGeneratedImageUrl(item.url)}
                      className="min-w-0 flex-1 px-3 py-3 text-left text-sm"
                    >
                      <p className="line-clamp-2">{item.prompt}</p>
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {new Date(item.createdAt).toLocaleString("ru-RU")}
                      </p>
                    </button>
                    <button
                      type="button"
                      title="Удалить"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteHistoryRecord("images", item.id);
                      }}
                      className="mr-2 mt-3 rounded-lg p-1.5 text-zinc-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              ))}

            {workMode === "chat" &&
              (chatConversations.length === 0 ? (
                <p className="px-3 py-4 text-sm text-zinc-500">Пока нет чатов</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveConversationId(null);
                      setChatMessages([]);
                    }}
                    className="mb-1 w-full rounded-xl px-3 py-2 text-left text-xs text-violet-300 hover:bg-white/5"
                  >
                    + Новый чат
                  </button>
                  {chatConversations.map((item) => (
                    <div
                      key={item.id}
                      className={`group flex items-start gap-1 rounded-xl ${
                        activeConversationId === item.id
                          ? "bg-wc-purple/20 text-white"
                          : "text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveConversationId(item.id);
                          setChatMessages(item.messages);
                        }}
                        className="min-w-0 flex-1 px-3 py-3 text-left text-sm"
                      >
                        <p className="line-clamp-2">{item.title}</p>
                        <p className="mt-1 text-[10px] text-zinc-600">
                          {item.messages.length} сообщ. ·{" "}
                          {new Date(item.updatedAt).toLocaleString("ru-RU")}
                        </p>
                      </button>
                      <button
                        type="button"
                        title="Удалить чат"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteHistoryRecord("chats", item.id);
                        }}
                        className="mr-2 mt-3 rounded-lg p-1.5 text-zinc-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              ))}
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-wc-purple to-wc-pink text-sm font-semibold text-white">
                {(user?.email?.[0] ?? "U").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-200">
                  {user?.email ?? "Загрузка..."}
                </p>
                {status.tierLabel ? (
                  <p className="text-[11px] text-zinc-500">{status.tierLabel}</p>
                ) : null}
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Баланс токенов
              </p>
              <p className="mt-2 text-sm text-zinc-200">
                {formatTokens(status.tokenBalance)} ток.
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Потрачено всего: {formatTokens(status.totalTokensUsed)}
              </p>
              <button
                type="button"
                onClick={() => setTopUpOpen(true)}
                className="mt-3 inline-flex text-xs font-medium text-violet-300 hover:text-violet-200"
              >
                Пополнить →
              </button>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="wc-btn wc-btn-ghost mt-3 w-full py-2 text-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              Выйти
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center border-b border-white/10 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="wc-btn wc-btn-ghost gap-2 px-3 py-2 text-xs"
            aria-label="Меню"
          >
            <Menu className="h-4 w-4" />
            <span className="hidden sm:inline">{sidebarOpen ? "Скрыть" : "Меню"}</span>
          </button>
        </header>

        {workMode === "wizard" && (
          <SiteWizard
            getAccessToken={getFreshAccessToken}
            useContacts={useContactsOnGenerate && showContacts}
            onBalanceRefresh={() => {
              void (async () => {
                const t = await getFreshAccessToken();
                if (t) await loadStatus(t);
              })();
            }}
            onSiteReady={(site) => {
              const item: GenerationItem = {
                id: site.id,
                prompt: site.prompt,
                rootPrompt: site.prompt,
                version: 1,
                customRequirements: "",
                images: [],
                html: site.html,
                css: site.css,
                js: site.js,
                previewHtml: buildPreviewHtml({
                  html: site.html,
                  css: site.css,
                  js: site.js,
                }),
                createdAt: site.createdAt,
              };
              setHistory((prev) => [
                item,
                ...prev.filter((x) => x.id !== item.id),
              ]);
              // Превью остаётся в Мастере
              setActiveId(item.id);
            }}
          />
        )}

        {workMode === "site" && (
          <>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
              <div className="flex rounded-lg border border-white/10 p-0.5">
                <button
                  type="button"
                  onClick={() => setMainTab("preview")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
                    mainTab === "preview"
                      ? "bg-white/10 text-white"
                      : "text-zinc-400"
                  }`}
                >
                  <Eye className="h-4 w-4" /> Preview
                </button>
                {activeItem?.designImage && (
                  <button
                    type="button"
                    onClick={() => setMainTab("compare")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
                      mainTab === "compare"
                        ? "bg-white/10 text-white"
                        : "text-zinc-400"
                    }`}
                  >
                    <ImageIcon className="h-4 w-4" /> Сравнение
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMainTab("code")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
                    mainTab === "code" ? "bg-white/10 text-white" : "text-zinc-400"
                  }`}
                >
                  <Code2 className="h-4 w-4" /> Code
                </button>
              </div>
              {activeItem && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveVersion()}
                    disabled={savingVersion || liveEditing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300 disabled:opacity-50"
                  >
                    {savingVersion ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Сохранить версию
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Скопировано" : "Скопировать"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownload()}
                    disabled={exportingHtml}
                    className="wc-btn wc-btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    {exportingHtml ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {exportingHtml ? "Собираем…" : "Скачать HTML"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadZip()}
                    disabled={exportingZip}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/15 px-3 py-1.5 text-sm text-violet-100 disabled:opacity-50"
                    title="Для заливки на Рег.ру / Beget: index.html + styles.css + script.js + assets/"
                  >
                    {exportingZip ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                    {exportingZip ? "Собираем ZIP…" : "Скачать ZIP"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-sm text-emerald-100"
                    title="Опубликовать на поддомене webcomet.ru"
                  >
                    <Rocket className="h-4 w-4" />
                    Опубликовать
                  </button>
                </div>
              )}
            </div>

            {publishLiveSlug ? (
              <PublishSuccessBanner
                slug={publishLiveSlug}
                onClose={() => setPublishLiveSlug(null)}
              />
            ) : null}

            {showHostingNudge && activeItem ? (
              <div className="border-b border-white/10 px-4 py-3">
                <HostingOffer compact />
              </div>
            ) : null}

            <div className="relative flex min-h-0 flex-1 flex-col">
              {isLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-400">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                  <p className="text-sm">Генерируем сайт...</p>
                </div>
              ) : !activeItem ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <Wand2 className="h-8 w-8 text-violet-300" />
                  <h2 className="text-xl font-semibold">Создайте сайт</h2>
                  <p className="max-w-md text-sm text-zinc-400">
                    Опишите идею, добавьте пожелания и файлы — Claude соберёт HTML/CSS/JS.
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative min-h-0 flex-1">
                    {liveEditing && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 glass-card px-4 py-3 text-sm text-zinc-200">
                          <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                          Применяем правку...
                        </div>
                      </div>
                    )}
                    {mainTab === "preview" ? (
                      <div className="flex h-full flex-col">
                        <div className="wc-preview-stage min-h-0 flex-1 p-3 sm:p-4">
                          <div
                            className="wc-preview-shell"
                            data-device={previewDevice}
                            style={{
                              width:
                                PREVIEW_DEVICE_WIDTH[previewDevice] != null
                                  ? `${PREVIEW_DEVICE_WIDTH[previewDevice]}px`
                                  : "100%",
                            }}
                          >
                            {previewSrcDoc ? (
                              <iframe
                                key={`preview-${previewFrameKey}`}
                                title="preview"
                                srcDoc={previewSrcDoc}
                                className="wc-preview-frame h-full w-full border-0 bg-white"
                                sandbox="allow-scripts allow-modals allow-forms"
                              />
                            ) : (
                              <div className="flex h-full min-h-[240px] items-center justify-center gap-2 text-sm text-zinc-400">
                                <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                                Загрузка превью…
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-3 py-2">
                          {(
                            [
                              {
                                id: "phone" as const,
                                label: "Телефон",
                                Icon: Smartphone,
                              },
                              {
                                id: "tablet" as const,
                                label: "Планшет",
                                Icon: Tablet,
                              },
                              {
                                id: "desktop" as const,
                                label: "Десктоп",
                                Icon: Monitor,
                              },
                            ] as const
                          ).map(({ id, label, Icon }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setPreviewDevicePersistent(id)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
                                previewDevice === id
                                  ? "border-violet-500/40 bg-violet-500/15 text-violet-100"
                                  : "border-white/10 text-zinc-400 hover:bg-white/5"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : mainTab === "compare" && activeItem.designImage ? (
                      <div className="grid h-full min-h-0 grid-cols-1 gap-0 lg:grid-cols-2">
                        <div className="flex min-h-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
                          <div className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wide text-zinc-500">
                            Исходный скриншот
                          </div>
                          <div className="min-h-0 flex-1 overflow-auto bg-[#111827] p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={activeItem.designImage}
                              alt="Design screenshot"
                              className="mx-auto max-h-full w-auto max-w-full rounded-lg object-contain"
                            />
                          </div>
                        </div>
                        <div className="flex min-h-0 flex-col">
                          <div className="border-b border-white/10 px-3 py-2 text-xs uppercase tracking-wide text-zinc-500">
                            Сгенерированный сайт
                          </div>
                          <iframe
                            key={`compare-${previewFrameKey}`}
                            title="compare-preview"
                            srcDoc={previewSrcDoc || activeItem.previewHtml}
                            className="min-h-0 flex-1 w-full border-0 bg-white"
                            sandbox="allow-scripts allow-modals allow-forms"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full flex-col">
                        <div className="flex gap-1 border-b border-white/10 px-3 py-2">
                          {(["html", "css", "js"] as CodeTab[]).map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setCodeTab(tab)}
                              className={`rounded-md px-3 py-1 text-xs uppercase ${
                                codeTab === tab
                                  ? "bg-white/10 text-white"
                                  : "text-zinc-500"
                              }`}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto">
                          <CodeBlock
                            language={codeTab === "js" ? "javascript" : codeTab}
                            code={codeValue || " "}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={handleLiveEdit}
                    className="border-t border-white/10 glass-panel px-4 py-3"
                  >
                    <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        value={liveEditPrompt}
                        onChange={(e) => setLiveEditPrompt(e.target.value)}
                        placeholder='Правка: например «сделай все кнопки зелёными»'
                        disabled={liveEditing}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 glass-card px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600"
                      />
                      <button
                        type="submit"
                        disabled={liveEditing || !liveEditPrompt.trim()}
                        className="wc-btn wc-btn-primary shrink-0 px-4 py-2.5 text-sm disabled:opacity-50"
                      >
                        {liveEditing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                        Применить
                      </button>
                    </div>
                    <p className="mx-auto mt-1.5 max-w-4xl text-[11px] text-zinc-600">
                      GPT-5.4 mini · 1 генерация · текущая v{activeItem.version}
                    </p>
                  </form>
                </>
              )}
            </div>

            <form
              ref={generateFormRef}
              onSubmit={handleGenerateSite}
              className="shrink-0 border-t border-white/10 glass-panel"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-1.5">
                <button
                  type="button"
                  onClick={() => setSitePanelOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                >
                  {sitePanelOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                  {sitePanelOpen ? "Свернуть" : "Настройки генерации"}
                </button>
                {!sitePanelOpen && (
                  <button
                    type="submit"
                    title={`−${siteTokenCost} ток. · останется ~${formatTokens(balanceAfterRequest)}`}
                    disabled={
                      isLoading ||
                      uploading ||
                      uploadingDesign ||
                      uploadingLogo ||
                      isListening ||
                      (siteTokenCost > 0 &&
                        status.tokenBalance < siteTokenCost)
                    }
                    className="wc-btn wc-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isEditMode ? "Применить" : "Сгенерировать"}
                  </button>
                )}
              </div>

              {sitePanelOpen && (
              <div className="border-t border-white/5 px-3 pb-2.5 pt-2 xl:px-4">
                <p className="mb-2 text-[11px] text-zinc-500">
                  Режим редактора: ручной промпт и выбор модели (включая Claude
                  Fable). Для обычной сборки удобнее вкладка «Мастер».
                </p>
                {/* Одна строка контролов */}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <WcSelect
                    value={siteModelId}
                    disabled={expressMode && !isEditMode}
                    title="Модель"
                    onChange={(id) => {
                      setSiteModelId(id);
                      setQualityMode(
                        id === "gpt-5.6-luna" ? "fast" : "quality"
                      );
                    }}
                    options={getModelsByType("site").map((m) => ({
                      value: m.id,
                      label: `${m.name} — ${getTokenCost(m.id)} ток.${
                        m.description ? ` · ${m.description}` : ""
                      }`,
                    }))}
                  />
                  <WcSelect
                    value={siteStyle}
                    disabled={isEditMode}
                    title="Стиль дизайна"
                    onChange={(id) => setSiteStyle(id as SiteStyleId)}
                    options={SITE_STYLES.map((style) => ({
                      value: style.id,
                      label: style.label,
                    }))}
                  />
                  <button
                    type="button"
                    role="switch"
                    aria-checked={expressMode}
                    disabled={isEditMode}
                    onClick={() => setExpressModePersistent(!expressMode)}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-300 disabled:opacity-50"
                    title="Экспресс: ИИ сам придумает название, тексты и структуру"
                  >
                    <span
                      className="wc-toggle"
                      data-on={expressMode ? "true" : "false"}
                    >
                      <span className="wc-toggle-knob" />
                    </span>
                    Экспресс
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useContactsOnGenerate}
                    disabled={isEditMode || !showContacts}
                    onClick={() => {
                      if (!contactsReady) {
                        const go = window.confirm(
                          "Сначала сохраните контакты в Настройках. Открыть?"
                        );
                        if (go) setWorkMode("settings");
                        return;
                      }
                      setUseContactsPersistent(!useContactsOnGenerate);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-300 disabled:opacity-50"
                    title={
                      !showContacts
                        ? "В настройках отключено «Показывать контакты»"
                        : "Подставить ваши телефон, email и соцсети на сайт"
                    }
                  >
                    <span
                      className="wc-toggle"
                      data-on={
                        useContactsOnGenerate && showContacts
                          ? "true"
                          : "false"
                      }
                    >
                      <span className="wc-toggle-knob" />
                    </span>
                    Мои контакты
                  </button>
                  {!isEditMode && (
                    <>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept={LOGO_ACCEPT}
                        className="hidden"
                        onChange={(e) => handleUploadLogo(e.target.files)}
                      />
                      <button
                        type="button"
                        disabled={uploadingLogo}
                        onClick={() => logoInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-300 disabled:opacity-50"
                        title="Загрузить логотип"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5" />
                        )}
                        Логотип
                      </button>
                      {brandLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brandLogo}
                          alt=""
                          className="h-6 w-auto rounded border border-white/10 object-contain"
                        />
                      ) : null}
                    </>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={isEditMode}
                      disabled={!activeItem}
                      onChange={(e) => setIsEditMode(e.target.checked)}
                      className="rounded border-white/20"
                    />
                    Правка
                  </label>
                  {lastCached && (
                    <span className="ml-auto text-[10px] text-zinc-600">
                      готово быстро
                    </span>
                  )}
                </div>
                {workMode === "site" && siteChargePreview.tokens > 0 ? (
                  <p className="mb-2 text-[11px] text-zinc-500">
                    Списание: ≈{siteChargePreview.tokens} ток.
                  </p>
                ) : null}

                {/* Три колонки: текст | бренд/секции | референс */}
                <div className="grid gap-2.5 lg:grid-cols-12 lg:items-stretch">
                  <div className="flex flex-col gap-1.5 lg:col-span-5">
                    <textarea
                      value={
                        isListening && dictationDraft
                          ? `${prompt}${prompt ? " " : ""}${dictationDraft}`
                          : prompt
                      }
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={2}
                      disabled={isListening}
                      placeholder={
                        expressMode
                          ? "Экспресс: можно оставить пустым"
                          : designImage
                            ? "Опционально: тема сайта"
                            : isEditMode
                              ? "Что изменить..."
                              : "Опиши сайт..."
                      }
                      className="wc-input min-h-[44px] flex-1 resize-none text-sm disabled:opacity-70"
                    />
                    {isListening && (
                      <p className="text-[11px] text-rose-300">
                        Слушаю… говорите в микрофон
                      </p>
                    )}
                    <textarea
                      value={customRequirements}
                      onChange={(e) => setCustomRequirements(e.target.value)}
                      rows={2}
                      placeholder="Твои пожелания — текст без сокращений…"
                      className="wc-input min-h-[44px] flex-1 resize-none text-sm"
                    />
                    <p className="text-[10px] text-zinc-600">
                      {customRequirements.length + prompt.length}/8000
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 lg:col-span-3">
                    {!isEditMode && (
                      <>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
                          <p className="mb-1.5 text-[11px] font-medium text-zinc-300">
                            Цвета сайта
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {brandColors.map((color, index) => {
                              const safe = isValidHexColor(color)
                                ? normalizeHexColor(color, color)
                                : DEFAULT_BRAND_COLORS[
                                    Math.min(
                                      index,
                                      DEFAULT_BRAND_COLORS.length - 1
                                    )
                                  ];
                              return (
                                <div
                                  key={`brand-color-${index}`}
                                  className="group relative"
                                >
                                  <label
                                    className="relative block h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-white/25 shadow-sm ring-offset-1 ring-offset-[#0b0f19] focus-within:ring-2 focus-within:ring-violet-400/50"
                                    style={{ backgroundColor: safe }}
                                    title={`${safe} — клик сменить цвет`}
                                  >
                                    <input
                                      type="color"
                                      value={safe}
                                      onChange={(e) =>
                                        void handleBrandColorChange(
                                          index,
                                          e.target.value
                                        )
                                      }
                                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                    />
                                  </label>
                                  {brandColors.length > 1 ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void removeBrandColor(index)
                                      }
                                      className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-900 text-[9px] text-zinc-300 ring-1 ring-white/20 group-hover:flex"
                                      title="Убрать цвет"
                                      aria-label="Убрать цвет"
                                    >
                                      ×
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
                            {brandColors.length < MAX_BRAND_COLORS ? (
                              <>
                                <input
                                  ref={addColorInputRef}
                                  type="color"
                                  defaultValue="#6c3bf4"
                                  className="sr-only"
                                  tabIndex={-1}
                                  onChange={(e) => {
                                    void addBrandColor(e.target.value);
                                    e.target.value = "#6c3bf4";
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    addColorInputRef.current?.click()
                                  }
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-white/30 bg-transparent text-zinc-400 transition hover:border-violet-400/50 hover:text-violet-200"
                                  title="Добавить цвет"
                                  aria-label="Добавить цвет"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {SITE_SECTION_OPTIONS.map((section) => {
                            const checked = selectedSections.includes(
                              section.id
                            );
                            return (
                              <label
                                key={section.id}
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] transition ${
                                  checked
                                    ? "border-violet-500/40 bg-violet-500/15 text-violet-100"
                                    : "border-white/10 text-zinc-400"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleSection(section.id)}
                                  className="rounded border-white/20"
                                />
                                {section.label}
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 lg:col-span-4">
                    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-violet-500/20 bg-violet-500/5 p-2">
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-violet-200">
                            Референс (скриншот)
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            Только дизайн, текст со скрина не копируется
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            disabled={uploadingDesign || isEditMode}
                            onClick={() => designInputRef.current?.click()}
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-200 disabled:opacity-50"
                          >
                            {uploadingDesign ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ImageIcon className="h-3 w-3" />
                            )}
                            {designImage ? "Заменить" : "Выбрать"}
                          </button>
                          {designImage ? (
                            <button
                              type="button"
                              onClick={() => setDesignImage("")}
                              className="text-[10px] text-zinc-500 hover:text-zinc-300"
                            >
                              убрать
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {designImage ? (
                        <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30 p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={designImage}
                            alt="Референсный дизайн"
                            className="mx-auto max-h-20 w-auto object-contain"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={uploadingDesign || isEditMode}
                          onClick={() => designInputRef.current?.click()}
                          className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-violet-500/25 py-4 text-[11px] text-zinc-500 hover:border-violet-500/40 hover:text-zinc-400 disabled:opacity-50"
                        >
                          Нажмите, чтобы выбрать скриншот
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={(e) => handleUpload(e.target.files)}
                    />
                    <input
                      ref={designInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadDesign(e.target.files)}
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300"
                    >
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileUp className="h-3.5 w-3.5" />
                      )}
                      Файлы
                    </button>
                    {speechSupported ? (
                      <button
                        type="button"
                        onClick={() =>
                          isListening ? stopDictation() : startDictation()
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 ${
                          isListening ? "wc-mic-recording" : "bg-white/5"
                        }`}
                      >
                        {isListening ? (
                          <MicOff className="h-3.5 w-3.5" />
                        ) : (
                          <Mic className="h-3.5 w-3.5" />
                        )}
                        {isListening ? "Стоп" : "Диктовать"}
                      </button>
                    ) : null}
                    {images.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {images.slice(0, 5).map((url) => (
                          <div
                            key={url}
                            className="relative h-7 w-7 overflow-hidden rounded border border-white/10"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setImages((prev) =>
                                  prev.filter((i) => i !== url)
                                )
                              }
                              className="absolute right-0 top-0 rounded bg-black/70 p-0.5"
                            >
                              <X className="h-2 w-2" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setImages([])}
                          className="text-[10px] text-zinc-500 hover:text-zinc-300"
                        >
                          очистить
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    title={`−${siteTokenCost} ток. · останется ~${formatTokens(balanceAfterRequest)}`}
                    disabled={
                      isLoading ||
                      uploading ||
                      uploadingDesign ||
                      uploadingLogo ||
                      isListening ||
                      (siteTokenCost > 0 &&
                        status.tokenBalance < siteTokenCost)
                    }
                    className="wc-btn wc-btn-primary px-5 py-2 text-sm disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isEditMode ? "Применить правки" : "Сгенерировать"}
                  </button>
                </div>
              </div>
              )}
            </form>
          </>
        )}

        {workMode === "image" && (
          <>
            <div className="relative min-h-0 flex-1 p-6">
              {imageLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-400">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                  <p className="text-sm">Рисуем изображение...</p>
                </div>
              ) : generatedImageUrl ? (
                <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={generatedImageUrl}
                    alt="Сгенерированное изображение"
                    className="max-h-[70vh] w-auto rounded-2xl border border-white/10 object-contain"
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.style.display = "none";
                      const fallback = el.nextElementSibling;
                      if (fallback instanceof HTMLElement) {
                        fallback.hidden = false;
                      }
                    }}
                  />
                  <div
                    hidden
                    className="flex max-w-md flex-col items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-6 py-8 text-center"
                  >
                    <ImageIcon className="h-8 w-8 text-amber-200" />
                    <p className="text-sm font-medium text-amber-100">
                      Картинка недоступна
                    </p>
                    <p className="text-xs leading-relaxed text-amber-100/80">
                      Файл больше недоступен. Сгенерируйте изображение заново.
                    </p>
                  </div>
                  <a
                    href={generatedImageUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10"
                  >
                    Открыть / скачать
                  </a>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <ImageIcon className="h-8 w-8 text-violet-300" />
                  <h2 className="text-xl font-semibold">Генерация изображений</h2>
                  <p className="max-w-md text-sm text-zinc-400">
                    Опишите картинку — выберите модель и нажмите «Сгенерировать»
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={handleGenerateImage} className="border-t border-white/10 glass-panel p-4">
              <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 glass-card p-4">
                {imageError && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    <p className="font-medium text-amber-200">Запрос отклонён</p>
                    <p className="mt-1 leading-relaxed text-amber-100/90">{imageError}</p>
                    <button
                      type="button"
                      onClick={() => setImageError("")}
                      className="mt-2 text-xs text-amber-300/80 underline hover:text-amber-200"
                    >
                      Закрыть
                    </button>
                  </div>
                )}
                <textarea
                  value={imagePrompt}
                  onChange={(e) => {
                    setImagePrompt(e.target.value);
                    if (imageError) setImageError("");
                  }}
                  rows={3}
                  placeholder="Опиши изображение..."
                  className="wc-input min-h-[72px] resize-none text-sm"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <WcSelect
                      value={imageModel}
                      onChange={setImageModel}
                      title="Модель картинки"
                      options={getModelsByType("image").map((m) => ({
                        value: m.id,
                        label: `${m.name} — ${getTokenCost(m.id)} ток.`,
                      }))}
                    />
                    <span className="text-xs text-violet-300">
                      {imageTokenCost} ток. за картинку
                    </span>
                  </div>
                  <button
                    type="submit"
                    title={`После запроса останется ~${formatTokens(Math.max(0, status.tokenBalance - imageTokenCost))} токенов (−${imageTokenCost})`}
                    disabled={
                      imageLoading || status.tokenBalance < imageTokenCost
                    }
                    className="wc-btn wc-btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
                  >
                    {imageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    Сгенерировать
                  </button>
                </div>
              </div>
            </form>
          </>
        )}

        {workMode === "chat" && (
          <>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-6">
              {chatMessages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-zinc-400">
                  <MessageSquare className="h-8 w-8 text-violet-300" />
                  <p className="text-sm">Спросите про сайт, текст, дизайн или промпт</p>
                </div>
              )}
              {chatMessages.map((msg, index) => (
                <div
                  key={`${msg.role}-${index}`}
                  className={`mx-auto max-w-3xl rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "ml-auto bg-wc-purple/20 text-white"
                      : "mr-auto bg-white/5 text-zinc-200"
                  }`}
                >
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">
                    {msg.role === "user" ? "Вы" : "WebComet"}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
              {chatLoading && (
                <div className="mx-auto flex max-w-3xl items-center gap-2 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Думаю...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChat} className="border-t border-white/10 glass-panel p-4">
              {lastModelLabel && workMode === "chat" && (
                <p className="mx-auto mb-2 max-w-3xl text-[11px] text-zinc-500">
                  Последний ответ: {lastModelLabel}
                </p>
              )}
              <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-white/10 glass-card p-2 sm:flex-row sm:items-center">
                <WcSelect
                  value={chatModelId}
                  onChange={setChatModelId}
                  title="Модель чата"
                  className="sm:max-w-[260px]"
                  options={getModelsByType("chat").map((m) => ({
                    value: m.id,
                    label: `${m.name} — ${getTokenCost(m.id)} ток.`,
                  }))}
                />
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Напишите сообщение..."
                  className="wc-input min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm shadow-none"
                />
                <button
                  type="submit"
                  title={`После сообщения останется ~${formatTokens(Math.max(0, status.tokenBalance - chatTokenCost))} токенов (−${chatTokenCost})`}
                  disabled={
                    chatLoading ||
                    !chatInput.trim() ||
                    status.tokenBalance < chatTokenCost
                  }
                  className="wc-btn wc-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Отправить
                </button>
              </div>
            </form>
          </>
        )}

        {workMode === "settings" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-lg">
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-white">Настройки</h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Контакты для автоматической подстановки на генерируемые сайты
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSaveContacts();
                }}
                className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div>
                  <h2 className="mb-3 text-sm font-medium text-zinc-200">
                    Контакты
                  </h2>
                  <label className="mb-3 block">
                    <span className="mb-1.5 block text-xs text-zinc-500">
                      Телефон
                    </span>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+7 (999) 123-45-67"
                      className="wc-input w-full text-sm"
                    />
                  </label>
                  <label className="mb-3 block">
                    <span className="mb-1.5 block text-xs text-zinc-500">
                      Email
                    </span>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="info@example.com"
                      className="wc-input w-full text-sm"
                    />
                  </label>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Соцсети</span>
                      <button
                        type="button"
                        onClick={() =>
                          setContactSocials((prev) => [...prev, ""])
                        }
                        className="text-[11px] text-violet-300 hover:text-violet-200"
                      >
                        + ссылка
                      </button>
                    </div>
                    <div className="space-y-2">
                      {contactSocials.map((link, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="url"
                            value={link}
                            onChange={(e) => {
                              const value = e.target.value;
                              setContactSocials((prev) =>
                                prev.map((item, i) =>
                                  i === index ? value : item
                                )
                              );
                            }}
                            placeholder="https://t.me/..."
                            className="wc-input min-w-0 flex-1 text-sm"
                          />
                          {contactSocials.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setContactSocials((prev) =>
                                  prev.filter((_, i) => i !== index)
                                )
                              }
                              className="rounded-lg p-2 text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                              aria-label="Удалить ссылку"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={showContacts}
                    onChange={(e) => setShowContacts(e.target.checked)}
                    className="mt-0.5 rounded border-white/20"
                  />
                  <span>
                    <span className="block text-sm text-zinc-200">
                      Показывать контакты на генерируемых сайтах
                    </span>
                    <span className="mt-0.5 block text-[11px] text-zinc-500">
                      Если выключено — на сайтах будут примерные контакты
                    </span>
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingContacts}
                    className="wc-btn wc-btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
                  >
                    {savingContacts ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Сохранить
                  </button>
                  {contactsSavedHint && (
                    <span className="text-xs text-emerald-400">
                      {contactsSavedHint}
                    </span>
                  )}
                </div>
              </form>

                <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
                  При генерации включите «Мои контакты». Email из настроек
                  используется и для заявок с формы (откроется письмо). Для
                  хостинга скачивайте ZIP — там готовый index.html, стили,
                  скрипты и папка assets с картинками.
                </p>
            </div>
          </div>
        )}
      </div>

      {topUpOpen && (
        <div className="wc-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="wc-modal-solid wc-expand-in w-full max-w-lg p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  Пополнить токены
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Сейчас: {formatTokens(status.tokenBalance)} ток.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTopUpOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {TOKEN_PACKAGES.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  disabled={Boolean(purchasingId)}
                  onClick={() => void handlePurchasePackage(pack.id)}
                  className="rounded-2xl border border-white/10 bg-[#12131c] p-4 text-left transition duration-200 hover:border-violet-400/40 hover:bg-[#161826] disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-zinc-100">
                    {pack.label}
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-white">
                    {formatTokens(pack.tokens)}
                    <span className="ml-1 text-sm font-normal text-zinc-500">
                      ток.
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {pack.price.toLocaleString("ru-RU")} ₽
                    {purchasingId === pack.id ? " · открываем…" : ""}
                  </p>
                </button>
              ))}
            </div>
            <p className="mt-5 text-[12px] leading-relaxed text-zinc-500">
              Оплата картой. Токены появятся на балансе после успешного платежа.
            </p>
          </div>
        </div>
      )}

      {publishOpen && activeItem ? (
        <PublishModal
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          getAccessToken={getFreshAccessToken}
          site={{
            id: activeItem.id,
            html: activeItem.html,
            css: activeItem.css,
            js: activeItem.js,
            title: shortSiteTitle(activeItem.prompt),
          }}
        />
      ) : null}
    </div>
  );
}
