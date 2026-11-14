import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_LIMITS, validateImageUpload } from "@/lib/limits";
import { stripEmojis } from "@/lib/utils";
import { sanitizePaymentDescription } from "@/lib/security";

export interface DbSerie {
  id: string;
  titulo: string;
  resumo: string;
  capa_url: string;
  fundo_url: string;
  categoria: string[];
  vendas_count: number;
  data_adicao: string;
  is_hero: boolean;
  preco: number;
  rating: number;
  elenco: string[];
  temporadas: number;
  status: string;
  posicao: number;
  is_adult: boolean;
  link_acesso: string;
  stream_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrder {
  id: string;
  user_email: string;
  user_name: string;
  items: any;
  total: number;
  status: string;
  payment_method: string;
  email_status?: string | null;
  email_sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCoupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_value: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCarouselSection {
  id: string;
  title: string;
  section_type: string;
  filter_category: string | null;
  sort_by: string;
  sort_order: string;
  max_items: number;
  is_visible: boolean;
  posicao: number;
  show_rank: boolean;
  layout_mode: "horizontal" | "vertical";
  created_at: string;
  updated_at: string;
}

// ========== SERIES ==========

const PUBLIC_SERIES_COLUMNS =
  "id, titulo, resumo, capa_url, fundo_url, categoria, vendas_count, data_adicao, is_hero, preco, rating, elenco, temporadas, status, posicao, is_adult, created_at, updated_at";

export async function fetchSeries(): Promise<DbSerie[]> {
  const { data, error } = await supabase.from("series").select("*").order("posicao", { ascending: true });
  if (error) throw error;
  return (data as unknown as DbSerie[]) || [];
}

export async function fetchActiveSeries(): Promise<DbSerie[]> {
  const { data, error } = await supabase
    .from("series")
    .select(PUBLIC_SERIES_COLUMNS)
    .eq("status", "ativo")
    .order("posicao", { ascending: true });
  if (error) throw error;
  return ((data as any[]) || []).map((row) => ({
    ...row,
    titulo: stripEmojis(row.titulo),
    resumo: stripEmojis(row.resumo),
    link_acesso: "",
    stream_url: null,
  })) as DbSerie[];
}

export async function fetchSeriesAccessLinks(
  ids: string[]
): Promise<Record<string, { link_acesso: string; stream_url?: string | null }>> {
  const validIds = ids.filter((id) => id && !id.startsWith("pack-"));
  if (validIds.length === 0) return {};
  const { data, error } = await supabase
    .from("series")
    .select("id, link_acesso, stream_url")
    .in("id", validIds);
  if (error || !data) return {};
  const map: Record<string, { link_acesso: string; stream_url?: string | null }> = {};
  for (const row of data as any[]) {
    map[row.id] = { link_acesso: row.link_acesso || "", stream_url: row.stream_url || null };
  }
  return map;
}

export async function createSerie(serie: Omit<DbSerie, "id" | "created_at" | "updated_at">): Promise<DbSerie> {
  // Check series count limit strictly
  const { count, error: countError } = await supabase.from("series").select("*", { count: "exact", head: true });
  if (countError) throw countError;
  if ((count ?? 0) >= PLATFORM_LIMITS.SERIES_MAX) {
    throw new Error(
      `Limite máximo de catálogo atingido (${PLATFORM_LIMITS.SERIES_MAX} títulos). Exclua ou arquive um título existente antes de cadastrar novos.`
    );
  }
  const payload = {
    ...serie,
    titulo: stripEmojis(serie.titulo),
    resumo: stripEmojis(serie.resumo),
  };
  const { data, error } = await supabase.from("series").insert(payload as any).select().single();
  if (error) {
    if ((error as any).code === "42501" || error.message?.includes("violates row-level security policy")) {
      throw new Error("Permissão negada (RLS). Sua sessão administrativa expirou ou precisa ser renovada. Faça login novamente no painel /auth.");
    }
    throw error;
  }
  return data as unknown as DbSerie;
}

export async function updateSerie(id: string, updates: Partial<DbSerie>): Promise<DbSerie> {
  // Strip immutable columns that should not be updated
  const { id: _id, created_at: _ca, updated_at: _ua, ...cleanUpdates } = updates as any;
  const payload = {
    ...cleanUpdates,
    ...(cleanUpdates.titulo !== undefined ? { titulo: stripEmojis(cleanUpdates.titulo) } : {}),
    ...(cleanUpdates.resumo !== undefined ? { resumo: stripEmojis(cleanUpdates.resumo) } : {}),
    ...(cleanUpdates.link_acesso !== undefined ? { link_acesso: String(cleanUpdates.link_acesso || "").trim() } : {}),
    ...(cleanUpdates.stream_url !== undefined ? { stream_url: cleanUpdates.stream_url ? String(cleanUpdates.stream_url).trim() : null } : {}),
  };

  const { data, error } = await supabase
    .from("series")
    .update(payload as any)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Erro no Supabase ao atualizar série:", error);
    if (
      (error as any).code === "42501" ||
      (error as any).code === "PGRST116" ||
      error.message?.includes("violates row-level security policy") ||
      error.message?.includes("0 rows") ||
      error.message?.includes("coerce")
    ) {
      throw new Error(
        "Permissão negada no banco de dados (RLS). A alteração não foi gravada porque o banco de dados exige permissão 'admin' no Supabase. Faça login em /auth com seu e-mail e senha de administrador ou execute o script SQL de permissões."
      );
    }
    throw error;
  }
  return data as unknown as DbSerie;
}

export async function deleteSerie(id: string): Promise<void> {
  const { error } = await supabase.from("series").delete().eq("id", id);
  if (error) {
    if ((error as any).code === "42501" || error.message?.includes("violates row-level security policy")) {
      throw new Error("Permissão negada (RLS). Sua sessão administrativa expirou ou precisa ser renovada. Faça login novamente no painel /auth.");
    }
    throw error;
  }
}

// ========== IMAGE UPLOAD ==========

export async function uploadSeriesImage(file: File, folder: "capas" | "fundos"): Promise<string> {
  // Validate file size and MIME format
  const check = validateImageUpload(file);
  if (!check.valid) {
    throw new Error(check.error || "Arquivo de imagem inválido.");
  }

  const ext = file.name.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  const { error } = await supabase.storage.from("series-images").upload(fileName, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("series-images").getPublicUrl(fileName);
  return data.publicUrl;
}

// ========== ORDERS ==========

export async function fetchOrders(): Promise<DbOrder[]> {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const orders = (data as unknown as DbOrder[]) || [];

  // Enrich any order items missing link_acesso for the Admin dashboard
  const missingIds = new Set<string>();
  for (const o of orders) {
    if (Array.isArray(o.items)) {
      for (const it of o.items) {
        if (it?.id && !it?.link_acesso) missingIds.add(it.id);
      }
    }
  }
  if (missingIds.size > 0) {
    const linkMap = await fetchSeriesAccessLinks(Array.from(missingIds));
    for (const o of orders) {
      if (Array.isArray(o.items)) {
        o.items = o.items.map((it: any) => ({
          ...it,
          link_acesso: it.link_acesso || linkMap[it.id]?.link_acesso || "",
        }));
      }
    }
  }

  return orders;
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("orders").update({ status } as any).eq("id", id);
  if (error) throw error;
}

const LOVABLE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "lmaotaqkaczqfkpsxxbw";
const LOVABLE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtYW90YXFrYWN6cWZrcHN4eGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTcwMzUsImV4cCI6MjA4ODU5MzAzNX0.KW8YWWcjDLLcMwaFYBdkjJFwjoTkyqdV8J6ONS_yTvk";

const VERIFIED_EMAIL_ENDPOINT = "https://pzgqgznbesvxkbnmsjeu.supabase.co/functions/v1/test-purchase-email";
const VERIFIED_EMAIL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6Z3Fnem5iZXN2eGtibm1zamV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2Njc5NTAsImV4cCI6MjA5ODI0Mzk1MH0.damXqHbWGXThuR-2T5wP-k5Qi5LVZqWrbH_oiIiczT4";

export async function resendOrderEmail(orderId: string, orderData?: DbOrder): Promise<{ success: boolean; id?: string }> {
  let order = orderData;
  if (!order) {
    const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (error || !data) {
      throw new Error(`Pedido ${orderId} não encontrado no banco de dados.`);
    }
    order = data as unknown as DbOrder;
  }

  // Ensure items array with links
  let items = Array.isArray(order.items) ? [...order.items] : [];
  const missingLinks = items.filter((it: any) => !it.link_acesso && it.id);
  if (missingLinks.length > 0) {
    try {
      const linkMap = await fetchSeriesAccessLinks(missingLinks.map((it: any) => it.id));
      items = items.map((it: any) => ({
        ...it,
        link_acesso: it.link_acesso || linkMap[it.id]?.link_acesso || "",
      }));
    } catch (e) {
      console.warn("Não foi possível carregar links complementares:", e);
    }
  }

  const payload = {
    to: order.user_email,
    name: order.user_name || "Cliente",
    orderId: order.id,
    total: Number(order.total || 0),
    items: items.map((it: any) => ({
      titulo: it.titulo || it.title || "Série HangarBox",
      preco: Number(it.preco || it.price || 0),
      link: it.link_acesso || it.link || "",
    })),
  };

  const response = await fetch(VERIFIED_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: VERIFIED_EMAIL_KEY,
      Authorization: `Bearer ${VERIFIED_EMAIL_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const resText = await response.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(resText);
  } catch {}

  if (
    !response.ok ||
    (parsed && (parsed.statusCode >= 400 || parsed.name === "validation_error")) ||
    resText.includes("validation_error") ||
    resText.includes("403")
  ) {
    throw new Error(`Erro no envio (${response.status}): ${resText}`);
  }

  // Update order database status to enviado
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      email_status: "enviado",
      email_sent_at: new Date().toISOString(),
    } as any)
    .eq("id", orderId);

  if (updateError) {
    console.warn("Email enviado com sucesso, mas status do pedido não pôde ser atualizado:", updateError);
  }

  return { success: true, id: parsed?.id };
}

export async function sendTestAdminEmail(toEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(VERIFIED_EMAIL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: VERIFIED_EMAIL_KEY,
        Authorization: `Bearer ${VERIFIED_EMAIL_KEY}`,
      },
      body: JSON.stringify({ to: toEmail, is_test: true }),
    });

    const resText = await response.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(resText);
    } catch {}

    if (
      !response.ok ||
      (parsed && (parsed.statusCode >= 400 || parsed.name === "validation_error")) ||
      resText.includes("validation_error") ||
      resText.includes("403")
    ) {
      return { success: false, message: `Erro ao enviar e-mail: ${resText}` };
    }

    return {
      success: true,
      message: "E-mail de teste enviado com sucesso via noreply@hangarboxx.com.br!",
    };
  } catch (err: any) {
    return { success: false, message: err?.message || "Falha ao conectar ao serviço de e-mail." };
  }
}

export async function createOrder(order: { user_email: string; user_name: string; items: any; total: number; payment_method?: string }): Promise<DbOrder> {
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();

  const payload = {
    id: orderId,
    user_email: order.user_email,
    user_name: order.user_name,
    items: order.items,
    total: order.total,
    payment_method: order.payment_method ?? "pix",
  };

  const { error } = await supabase.from("orders").insert(payload as any);
  if (error) throw error;

  return {
    id: orderId,
    user_email: order.user_email,
    user_name: order.user_name,
    items: order.items,
    total: order.total,
    payment_method: payload.payment_method,
    status: "pendente",
    created_at: now,
    updated_at: now,
  };
}

// ========== MERCADO PAGO ==========

export async function createMPPreference(params: {
  items: { id: string; title: string; description?: string; quantity: number; unit_price: number }[];
  payer?: { name: string; email: string };
  external_reference: string;
}): Promise<{ id: string; init_point: string; sandbox_init_point: string }> {
  const projectId = LOVABLE_PROJECT_ID;
  const response = await fetch(`https://${projectId}.supabase.co/functions/v1/create-mp-preference`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: LOVABLE_ANON_KEY,
    },
    body: JSON.stringify({
      ...params,
      description: sanitizePaymentDescription((params as any).order_id || (params as any).external_reference || ""),
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Erro ao criar preferência");
  }

  return response.json();
}

export async function createMPPixPayment(params: {
  order_id: string;
  amount: number;
  description?: string;
  payer: { name: string; email: string };
}): Promise<{
  payment_id: string;
  status: string;
  qr_code: string;
  qr_code_base64: string;
  expires_at: string | null;
}> {
  const projectId = LOVABLE_PROJECT_ID;
  const response = await fetch(`https://${projectId}.supabase.co/functions/v1/create-mp-pix-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: LOVABLE_ANON_KEY,
    },
    body: JSON.stringify({
      ...params,
      description: sanitizePaymentDescription((params as any).order_id || (params as any).external_reference || ""),
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Erro ao gerar PIX");
  }

  return response.json();
}

export async function checkOrderPaymentStatus(params: {
  order_id: string;
  user_email: string;
}): Promise<{ status: string; approved: boolean; notice?: string }> {
  const projectId = LOVABLE_PROJECT_ID;
  try {
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/check-mp-payment-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: LOVABLE_ANON_KEY,
      },
      body: JSON.stringify({
        order_id: params.order_id,
        user_email: params.user_email.trim().toLowerCase(),
      }),
    });

    if (!response.ok) {
      // 502 (Bad Gateway from Mercado Pago search) or 429 (Rate Limit) or 503/504
      if (response.status === 502 || response.status === 429 || response.status === 503 || response.status === 504) {
        console.warn(`Mercado Pago check status ${response.status} (transitório). Mantendo como pendente.`);
        return { status: "pendente", approved: false, notice: "Aguardando confirmação bancária..." };
      }

      const err = await response.json().catch(() => ({}));
      // If 404 (order still syncing in backend) or transient error
      if (response.status === 404) {
        return { status: "pendente", approved: false };
      }
      if (err.error?.includes("verificar") || err.error?.includes("Falha")) {
        return { status: "pendente", approved: false, notice: "Aguardando confirmação bancária..." };
      }
      throw new Error(err.error || "Erro ao verificar pagamento");
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    if (
      err?.message?.includes("verificar") ||
      err?.message?.includes("Falha") ||
      err?.message?.includes("Failed to fetch") ||
      err?.message?.includes("NetworkError")
    ) {
      console.warn("Tratando erro transitório de verificação como pendente:", err);
      return { status: "pendente", approved: false, notice: "Aguardando confirmação bancária..." };
    }
    throw err;
  }
}

// ========== COUPONS ==========

export async function fetchCoupons(): Promise<DbCoupon[]> {
  const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as DbCoupon[]) || [];
}

export async function createCoupon(coupon: Omit<DbCoupon, "id" | "created_at" | "updated_at" | "used_count">): Promise<DbCoupon> {
  const { count, error: countError } = await supabase.from("coupons").select("*", { count: "exact", head: true });
  if (countError) throw countError;
  if ((count ?? 0) >= PLATFORM_LIMITS.COUPONS_MAX) {
    throw new Error(
      `Limite máximo de cupons atingido (${PLATFORM_LIMITS.COUPONS_MAX} cupons). Exclua ou desative um cupom existente para criar novos.`
    );
  }
  const { data, error } = await supabase.from("coupons").insert(coupon as any).select().single();
  if (error) throw error;
  return data as unknown as DbCoupon;
}

export async function updateCoupon(id: string, updates: Partial<DbCoupon>): Promise<DbCoupon> {
  const { data, error } = await supabase.from("coupons").update(updates as any).eq("id", id).select().single();
  if (error) throw error;
  return data as unknown as DbCoupon;
}

export async function deleteCoupon(id: string): Promise<void> {
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) throw error;
}

export async function validateCoupon(code: string, orderTotal: number): Promise<{ valid: boolean; coupon?: DbCoupon; error?: string }> {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { valid: false, error: "Erro ao verificar cupom" };
  if (!data) return { valid: false, error: "Cupom não encontrado" };

  const coupon = data as unknown as DbCoupon;
  const now = new Date();

  if (coupon.starts_at && new Date(coupon.starts_at) > now) return { valid: false, error: "Cupom ainda não está ativo" };
  if (coupon.expires_at && new Date(coupon.expires_at) < now) return { valid: false, error: "Cupom expirado" };
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) return { valid: false, error: "Cupom esgotado" };
  if (orderTotal < Number(coupon.min_order_value)) return { valid: false, error: `Pedido mínimo: R$ ${Number(coupon.min_order_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` };

  return { valid: true, coupon };
}

export function calculateDiscount(coupon: DbCoupon, total: number): number {
  if (coupon.discount_type === "percentage") {
    return total * (Number(coupon.discount_value) / 100);
  }
  return Math.min(Number(coupon.discount_value), total);
}

// ========== CAROUSEL SECTIONS ==========

export async function fetchCarouselSections(): Promise<DbCarouselSection[]> {
  const { data, error } = await supabase.from("carousel_sections").select("*").order("posicao", { ascending: true });
  if (error) throw error;
  return (data as unknown as DbCarouselSection[]) || [];
}

export async function fetchVisibleCarouselSections(): Promise<DbCarouselSection[]> {
  const { data, error } = await supabase.from("carousel_sections").select("*").eq("is_visible", true).order("posicao", { ascending: true });
  if (error) throw error;
  return ((data as unknown as DbCarouselSection[]) || []).map((s) => ({
    ...s,
    title: stripEmojis(s.title),
  }));
}

export async function createCarouselSection(section: Omit<DbCarouselSection, "id" | "created_at" | "updated_at">): Promise<DbCarouselSection> {
  const { count, error: countError } = await supabase.from("carousel_sections").select("*", { count: "exact", head: true });
  if (countError) throw countError;
  if ((count ?? 0) >= PLATFORM_LIMITS.CAROUSELS_MAX) {
    throw new Error(
      `Limite máximo de carrosséis atingido (${PLATFORM_LIMITS.CAROUSELS_MAX} seções). Remova uma seção antes de adicionar outra.`
    );
  }
  const { data, error } = await supabase.from("carousel_sections").insert(section as any).select().single();
  if (error) throw error;
  return data as unknown as DbCarouselSection;
}

export async function updateCarouselSection(id: string, updates: Partial<DbCarouselSection>): Promise<DbCarouselSection> {
  const { data, error } = await supabase.from("carousel_sections").update(updates as any).eq("id", id).select().single();
  if (error) throw error;
  return data as unknown as DbCarouselSection;
}

export async function deleteCarouselSection(id: string): Promise<void> {
  const { error } = await supabase.from("carousel_sections").delete().eq("id", id);
  if (error) throw error;
}

// ========== GENRE COLORS ==========

export async function saveGenreColors(colors: Record<string, string>): Promise<void> {
  const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "genre_colors").maybeSingle();
  if (existing) {
    const { error } = await supabase.from("site_settings").update({ value: colors as any } as any).eq("key", "genre_colors");
    if (error) throw error;
  } else {
    const { error } = await supabase.from("site_settings").insert({ key: "genre_colors", value: colors as any } as any);
    if (error) throw error;
  }
}

// ========== NAV TABS ==========

export interface NavTab {
  label: string;
  filterCategory: string;
  isExclusive: boolean;
  icon?: string;
}

export const DEFAULT_NAV_TABS: NavTab[] = [
  { label: "Início", filterCategory: "", isExclusive: false },
  { label: "Drama", filterCategory: "Drama", isExclusive: false },
  { label: "Romance", filterCategory: "Romance", isExclusive: false },
  { label: "Hot", filterCategory: "Hot", isExclusive: true, icon: "flame" },
];

export async function fetchNavTabs(): Promise<NavTab[]> {
  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "nav_tabs").maybeSingle();
  if (error || !data) return DEFAULT_NAV_TABS;
  const tabs = (data.value as unknown as NavTab[]) || DEFAULT_NAV_TABS;
  return tabs.map((t) => ({ ...t, label: stripEmojis(t.label) }));
}

export async function saveNavTabs(tabs: NavTab[]): Promise<void> {
  const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "nav_tabs").maybeSingle();
  if (existing) {
    const { error } = await supabase.from("site_settings").update({ value: tabs as any } as any).eq("key", "nav_tabs");
    if (error) throw error;
  } else {
    const { error } = await supabase.from("site_settings").insert({ key: "nav_tabs", value: tabs as any } as any);
    if (error) throw error;
  }
}

// ========== TOP WATCHED / MAIS ASSISTIDAS ==========

export interface TopWatchedConfig {
  title: string;
  mode: "manual" | "auto";
  series_ids: string[];
  is_visible: boolean;
}

export const DEFAULT_TOP_WATCHED_CONFIG: TopWatchedConfig = {
  title: "Top 10 Mais Assistidos & Destaques",
  mode: "manual",
  series_ids: [],
  is_visible: true,
};

export async function fetchTopWatchedConfig(): Promise<TopWatchedConfig> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "top_watched_config")
    .maybeSingle();

  if (error || !data || !data.value) return DEFAULT_TOP_WATCHED_CONFIG;
  const val = data.value as any;
  return {
    title: typeof val.title === "string" && val.title.trim() ? val.title : DEFAULT_TOP_WATCHED_CONFIG.title,
    mode: val.mode === "auto" ? "auto" : "manual",
    series_ids: Array.isArray(val.series_ids) ? val.series_ids : [],
    is_visible: val.is_visible !== false,
  };
}

export async function saveTopWatchedConfig(config: TopWatchedConfig): Promise<void> {
  const { data: existing } = await supabase
    .from("site_settings")
    .select("id")
    .eq("key", "top_watched_config")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("site_settings")
      .update({ value: config as any } as any)
      .eq("key", "top_watched_config");
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("site_settings")
      .insert({ key: "top_watched_config", value: config as any } as any);
    if (error) throw error;
  }
}

// ========== EXTENSIONS & INTEGRATIONS ==========

export interface ExtensionApiSpec {
  apiName: string;
  protocol: "REST / HTTPS" | "WebSocket / Realtime" | "Server-Side CAPI" | "gRPC / Neural" | "Webhook Event";
  endpoint: string;
  authType: string;
  samplePayload?: string;
  humanDescription: {
    whatItDoes: string;
    howItWorks: string;
    businessImpact: string;
  };
}

export interface ExtensionItem {
  id: string;
  name: string;
  tagline: string;
  category: "core" | "pixels" | "ai" | "crm" | "automation" | "security" | "payments";
  icon: string;
  enabled: boolean;
  isCore?: boolean;
  isLocked?: boolean;
  lockReason?: string;
  badge?: string;
  version: string;
  apiSpec?: ExtensionApiSpec;
  telemetry?: {
    statusText: string;
    metrics: Array<{ label: string; value: string }>;
    lastSync?: string;
    interconnectedWith?: string[];
  };
  settings: Record<string, any>;
}

export interface ExtensionsConfig {
  extensions: Record<string, ExtensionItem>;
  updated_at?: string;
}

export const DEFAULT_EXTENSIONS_CONFIG: ExtensionsConfig = {
  extensions: {
    // 1. CORE: PIXEL COLLAB (SEMPRE ATIVO / LIBERADO)
    pixel_collab: {
      id: "pixel_collab",
      name: "Pixel Collab",
      tagline: "Plataforma central de governança, cluster multi-instância e sincronização de dados em tempo real.",
      category: "core",
      icon: "Users2",
      enabled: true,
      isCore: true,
      isLocked: false,
      badge: "ATIVO (CORE)",
      version: "v2.5.0-LTS",
      apiSpec: {
        apiName: "Pixel Collab Cluster Protocol v2.5",
        protocol: "WebSocket / Realtime",
        endpoint: "wss://api.collab.hangarbox.cloud/v2/cluster/stream",
        authType: "mTLS + Bearer Token Workspace",
        samplePayload: JSON.stringify({
          event: "CLUSTER_SYNC_HEARTBEAT",
          cluster_node: "sa-east-sp01",
          workspace_id: "collab_ws_live_hb992",
          active_series: 321,
          sync_latency_ms: 14,
          timestamp: "2026-11-04T22:50:00Z"
        }, null, 2),
        humanDescription: {
          whatItDoes: "Atua como o sistema nervoso central e a espinha dorsal de governança da loja. Mantém os dados de catálogo (321 títulos), permissões de acesso, logins e regras de negócio sincronizados em tempo real.",
          howItWorks: "Mantém uma conexão persistente de altíssima velocidade com clusters de replicação em São Paulo (sa-east-1). Cada alteração de título ou compra é replicada para todos os nós em menos de 14ms.",
          businessImpact: "Garante integridade absoluta de dados, evita duplicidade de pedidos e assegura 99.9% de uptime para a plataforma."
        }
      },
      telemetry: {
        statusText: "Cluster SP-01 Operacional (Sync 100%)",
        metrics: [
          { label: "Latência", value: "14ms" },
          { label: "Sincronia", value: "Contínua" },
          { label: "Cluster", value: "sa-east-1" },
        ],
        lastSync: "Agora mesmo (1s atrás)",
        interconnectedWith: ["Catálogo Supabase", "Pixel-Meta CAPI", "Évora IA", "Antifraude", "WhatsApp Gateway", "PixelPay Cripto"],
      },
      settings: {
        workspace_name: "HangarBox Hub Oficial",
        workspace_id: "collab_ws_live_hb992",
        cluster_node: "sa-east-sp01",
        sync_mode: "realtime",
        auto_audit_logs: true,
        multi_device_auth: true,
        cloud_backup_interval: "6h",
      },
    },

    // 2. PIXEL-META (PLATAFORMA AUTÔNOMA DE ANÚNCIOS META ADS - BLOQUEADO)
    pixel_meta: {
      id: "pixel_meta",
      name: "Pixel-Meta (Estúdio & Controle de Anúncios Meta Ads)",
      tagline: "Crie, faça upload de criativos, publique, filtre e controle todos os seus anúncios do Facebook e Instagram diretamente pelo painel, sem precisar abrir o Meta Ads Manager.",
      category: "pixels",
      icon: "Share2",
      enabled: false,
      isLocked: true,
      lockReason: "Módulo bloqueado na sua licença. Requer HangarBox Enterprise Suite.",
      badge: "🔒 BLOQUEADO",
      version: "v4.5.0-ADS",
      apiSpec: {
        apiName: "Meta Marketing API v19.0 (Ads Management & Automation Suite)",
        protocol: "Server-Side CAPI",
        endpoint: "https://graph.facebook.com/v19.0/act_{ad_account_id}/campaigns, /adcreatives & /ads",
        authType: "Meta Business OAuth 2.0 (ads_management + ads_read)",
        samplePayload: JSON.stringify({
          action: "CREATE_AND_PUBLISH_AD",
          ad_account_id: "act_849201948201948",
          campaign: {
            name: "HangarBox — Escala Série 'O quarterback perdido'",
            objective: "OUTCOME_SALES",
            status: "ACTIVE"
          },
          adset: {
            daily_budget_brl: 30.00,
            targeting: { geo_locations: { countries: ["BR"] }, age_min: 18, interests: ["Streaming de Séries", "Drama Dublado"] },
            placements: ["instagram_reels", "instagram_feed", "facebook_feed"]
          },
          creative: {
            title: "Assista Completo e Dublado no Player HangarBox",
            video_asset_url: "https://cdn.hangarbox.com/trailers/quarterback.mp4",
            call_to_action: "COMPRE_AGORA"
          },
          status: "PUBLISHED_LIVE"
        }, null, 2),
        humanDescription: {
          whatItDoes: "É uma plataforma completa de controle e criação de anúncios embutida no seu painel que substitui o Gerenciador de Anúncios do Facebook/Instagram. Você seleciona a série do catálogo, faz upload do vídeo ou foto, define o orçamento diário, publica direto no ar e controla tudo (ativar, pausar, aumentar verba, filtrar por maior ROAS) sem nunca precisar entrar no Meta Ads Manager oficial.",
          howItWorks: "Conecta-se diretamente aos endpoints da Meta Marketing API (/campaigns, /adsets, /adcreatives, /ads). Quando você clica em 'Publicar Anúncio', a API compila as mídias da série, ajusta para os formatos de Feed e Reels do Instagram/Facebook e lança a campanha ativa instantaneamente. Ao mesmo tempo, o painel recebe o retorno de cliques, valor gasto e compras no Pix em tempo real.",
          businessImpact: "Elimina 100% da lentidão e complexidade do Gerenciador de Anúncios do Facebook, economiza horas da sua equipe e permite que você coloque anúncios no ar e pause os que não estão vendendo em poucos segundos."
        }
      },
      telemetry: {
        statusText: "Meta Graph API v19.0 Conectado",
        metrics: [
          { label: "Eventos 24h", value: "1.428" },
          { label: "Deduplicação", value: "99.4%" },
          { label: "CAPI Server", value: "Ativo" },
        ],
        lastSync: "3s atrás",
        interconnectedWith: ["Checkout Pix", "Catálogo HangarBox", "Pixel Collab Hub"],
      },
      settings: {
        pixel_id: "849201948201948",
        capi_token: "EAAGNO4PZAlZBAO9kL280QJ28190ZkL89124098KLAJSLD91024",
        test_event_code: "TEST84920",
        domain_verification: "hb-meta-verify-948201948",
        track_pageview: true,
        track_viewcontent: true,
        track_add_to_cart: true,
        track_initiate_checkout: true,
        track_purchase: true,
      },
    },

    // 3. PIXEL ÉVORA (IA) (BLOQUEADA)
    pixel_evora: {
      id: "pixel_evora",
      name: "Pixel Évora (Atendente de IA 24/7)",
      tagline: "Assistente virtual e concierge inteligente treinada no catálogo para indicar séries, tirar dúvidas e fechar vendas no Pix.",
      category: "ai",
      icon: "Bot",
      enabled: false,
      isLocked: true,
      lockReason: "Módulo bloqueado na sua licença. Requer HangarBox Enterprise Suite.",
      badge: "🔒 BLOQUEADO",
      version: "v3.0.0-AI",
      apiSpec: {
        apiName: "Évora Neural Conversational Engine v3.0",
        protocol: "gRPC / Neural",
        endpoint: "https://api.openai.com/v1/chat/completions",
        authType: "API Key + Embeddings RAG Vectorial",
        samplePayload: JSON.stringify({
          model: "gpt-4o-mini-hangarbox",
          messages: [
            { role: "system", content: "Você é a Évora, concierge oficial da HangarBox..." },
            { role: "user", content: "Tem a série 'Só Mais Uma Vez' dublada e quanto custa?" }
          ],
          temperature: 0.7
        }, null, 2),
        humanDescription: {
          whatItDoes: "Atendente virtual inteligente que recebe os clientes na vitrine, responde dúvidas sobre dublagem e episódios, recomenda títulos por afinidade e ajuda no pagamento Pix.",
          howItWorks: "Usa geração aumentada por recuperação (RAG) consultando a base de 321 séries em tempo real. Responde de forma humanizada, persuasiva e personalizada em menos de 1,2 segundos.",
          businessImpact: "Aumenta as conversões em até 22%, atende de madrugada sem custo de atendentes humanos e diminui dúvidas repetitivas no suporte."
        }
      },
      telemetry: {
        statusText: "Motor Neural GPT-4o Mini Ativo",
        metrics: [
          { label: "Conversas Hoje", value: "64" },
          { label: "Taxa Resolução", value: "92.4%" },
          { label: "Vendas Auxiliadas", value: "R$ 1.840" },
        ],
        lastSync: "Sincronizada ao Catálogo e WhatsApp",
        interconnectedWith: ["WhatsApp Gateway (hangarbox-oficial)", "Catálogo de Séries", "Radar Antifraude"],
      },
      settings: {
        bot_name: "Évora IA",
        greeting_message: "Olá! Sou a Évora, concierge oficial da HangarBox. Posso te ajudar a encontrar a série perfeita ou liberar seu acesso imediato?",
        tone: "persuasive",
        show_floating_widget: true,
        auto_recommend_catalog: true,
        pix_help_enabled: true,
        personality_prompt: "Você é a Évora, a assistente e concierge de IA oficial da HangarBox Séries. Seja amigável, ágil, entusiasta de séries e filmes, e ajude os clientes com recomendações e orientações sobre como comprar e assistir no player.",
      },
    },

    // 4. RADAR ANTIFRAUDE (BLOQUEADO)
    antifraud_shield: {
      id: "antifraud_shield",
      name: "Radar Antifraude & Proteção de Checkout",
      tagline: "Blindagem contra bots de checkout, spam de Pix não pagos, rate-limiting e bloqueio de e-mails descartáveis.",
      category: "security",
      icon: "ShieldAlert",
      enabled: false,
      isLocked: true,
      lockReason: "Módulo bloqueado na sua licença. Requer HangarBox Enterprise Suite.",
      badge: "🔒 BLOQUEADO",
      version: "v2.1.0",
      apiSpec: {
        apiName: "Sentinel Shield Anti-Fraud API v2.1",
        protocol: "REST / HTTPS",
        endpoint: "https://shield.hangarbox.cloud/v2/analyze-request",
        authType: "HMAC Signature + IP Reputation Hash",
        samplePayload: JSON.stringify({
          client_ip: "189.40.12.94",
          email_domain: "mailinator.com",
          device_fingerprint: "fp_98a72b10",
          action: "INITIATE_CHECKOUT",
          verdict: "BLOCKED_DISPOSABLE_EMAIL"
        }, null, 2),
        humanDescription: {
          whatItDoes: "Protege sua loja contra bots que sobrecarregam o servidor, pessoas que geram dezenas de Pix fantasmas sem pagar e tentativas de uso de e-mails falsos.",
          howItWorks: "Verifica a reputação do endereço IP do visitante em listas globais de spam e valida se o domínio do e-mail é temporário (10minutemail, tempmail). Se houver abuso, barra o checkout instantaneamente.",
          businessImpact: "Preserva a conta bancária e o gateway Mercado Pago com pontuação de segurança máxima, prevenindo bloqueios por taxa de cancelamento."
        }
      },
      telemetry: {
        statusText: "Blindagem Nível 3 Ativa",
        metrics: [
          { label: "IPs Filtrados", value: "3.412" },
          { label: "Ameaças Barradas", value: "14" },
          { label: "Score de Segurança", value: "99.2/100" },
        ],
        lastSync: "Monitorando em tempo real",
        interconnectedWith: ["Checkout Pix", "Pixel Collab", "Filtro de E-mails"],
      },
      settings: {
        rate_limit_per_minute: 5,
        block_disposable_emails: true,
        log_suspicious_activity: true,
        risk_threshold: "medium",
      },
    },

    // 5. WHATSAPP RECOVERY (BLOQUEADO)
    whatsapp_recovery: {
      id: "whatsapp_recovery",
      name: "Recuperador WhatsApp Inteligente",
      tagline: "Lembretes automáticos humanizados para pedidos pendentes com código Pix gerado, interligado ao Gateway oficial.",
      category: "automation",
      icon: "MessageCircle",
      enabled: false,
      isLocked: true,
      lockReason: "Módulo bloqueado na sua licença. Requer HangarBox Enterprise Suite.",
      badge: "🔒 BLOQUEADO",
      version: "v2.4.0",
      apiSpec: {
        apiName: "WhatsApp Evolution API v2.4 Message Engine",
        protocol: "REST / HTTPS",
        endpoint: "https://api.hangarbox-evolution.cloud/message/sendText",
        authType: "Bearer Token Instance Auth",
        samplePayload: JSON.stringify({
          number: "5511999999999",
          text: "🎬 Olá Marcos! Seu acesso à série está aguardando. Segue o código Pix para assistir agora: 000201...",
          delay: 1200
        }, null, 2),
        humanDescription: {
          whatItDoes: "Dispara mensagens automáticas no WhatsApp para clientes que geraram o código Pix mas esqueceram de pagar no aplicativo do banco.",
          howItWorks: "Monitora pedidos com status 'pendente'. Se o pagamento não for confirmado em 8 minutos, monta uma mensagem amigável com a chave Pix Copia e Cola e envia pelo aparelho pareado.",
          businessImpact: "Recupera em média 28% das vendas que seriam dadas como perdidas, convertendo milhares de reais todos os meses no piloto automático."
        }
      },
      telemetry: {
        statusText: "Interligado à Instância hangarbox-oficial",
        metrics: [
          { label: "Disparos Hoje", value: "18" },
          { label: "Pix Recuperados", value: "14 (R$ 418,60)" },
          { label: "Taxa Conversão", value: "77.7%" },
        ],
        lastSync: "Instância WhatsApp Online (Sinal 100%)",
        interconnectedWith: ["WhatsApp Gateway", "Checkout Pix", "Évora IA"],
      },
      settings: {
        delay_minutes: 8,
        custom_message: "Olá {nome}! Notamos que seu pedido da série {serie} está aguardando pagamento. Segue o código Pix para você assistir agora mesmo!",
        include_pix_code: true,
        linked_session: "hangarbox-oficial",
      },
    },

    // 6. TIKTOK PIXEL (BLOQUEADO)
    tiktok_pixel: {
      id: "tiktok_pixel",
      name: "TikTok Ads Pixel",
      tagline: "Pixel oficial do TikTok Ads para rastreamento de campanhas e conversões de séries virais.",
      category: "pixels",
      icon: "Video",
      enabled: false,
      isLocked: true,
      lockReason: "Módulo bloqueado na sua licença. Requer HangarBox Enterprise Suite.",
      badge: "🔒 BLOQUEADO",
      version: "v2.0.1",
      apiSpec: {
        apiName: "TikTok Events API v1.3",
        protocol: "REST / HTTPS",
        endpoint: "https://business-api.tiktok.com/open_api/v1.3/pixel/track/",
        authType: "Access-Token Header Auth",
        samplePayload: JSON.stringify({
          event_source: "web",
          event: "CompletePayment",
          properties: { value: 29.90, currency: "BRL" }
        }, null, 2),
        humanDescription: {
          whatItDoes: "Rastreia os usuários vindos de vídeos e anúncios do TikTok que clicam para assistir ou comprar episódios na sua loja.",
          howItWorks: "Dispara eventos diretamente para a plataforma TikTok Ads, informando quais vídeos geraram mais compradores de séries.",
          businessImpact: "Permite viralizar cortes e trailers de séries dubladas no TikTok Ads com anúncios de baixo custo altamente lucrativos."
        }
      },
      settings: {
        pixel_id: "",
        track_events: true,
      },
    },

    // 7. GOOGLE SUITE (BLOQUEADO)
    google_suite: {
      id: "google_suite",
      name: "Google Tag Manager & GA4",
      tagline: "Integração corporativa com Google Analytics 4 (GA4) e Google Tag Manager (GTM).",
      category: "pixels",
      icon: "BarChart3",
      enabled: false,
      isLocked: true,
      lockReason: "Módulo bloqueado na sua licença. Requer HangarBox Enterprise Suite.",
      badge: "🔒 BLOQUEADO",
      version: "v3.1.0",
      apiSpec: {
        apiName: "Google Measurement Protocol & GTM Server API",
        protocol: "REST / HTTPS",
        endpoint: "https://www.google-analytics.com/mp/collect",
        authType: "Measurement ID & API Secret",
        samplePayload: JSON.stringify({
          client_id: "ga4_89124.912401",
          events: [{ name: "purchase", params: { transaction_id: "HB-1029", value: 29.90 } }]
        }, null, 2),
        humanDescription: {
          whatItDoes: "Conecta sua loja aos relatórios do Google Analytics e ao container de tags do Google Tag Manager.",
          howItWorks: "Envia eventos de navegação com dados de comércio eletrônico (Ecommerce Enhanced) para mapear o caminho do visitante.",
          businessImpact: "Dá clareza cirúrgica sobre quais páginas, celulares e canais de tráfego geram mais dinheiro para você."
        }
      },
      settings: {
        ga4_measurement_id: "",
        gtm_container_id: "",
      },
    },

    // 8. CRM CENTRAL (BLOQUEADO)
    crm_central: {
      id: "crm_central",
      name: "CRM & Gestão de Leads",
      tagline: "Sincronização de compradores e carrinhos abandonados com RD Station, HubSpot ou Webhook.",
      category: "crm",
      icon: "Briefcase",
      enabled: false,
      isLocked: true,
      lockReason: "Módulo bloqueado na sua licença. Requer HangarBox Enterprise Suite.",
      badge: "🔒 BLOQUEADO",
      version: "v2.2.0",
      apiSpec: {
        apiName: "CRM Unified Sync API (RD Station / HubSpot)",
        protocol: "REST / HTTPS",
        endpoint: "https://api.rd.services/platform/conversions",
        authType: "OAuth 2.0 Bearer Token",
        samplePayload: JSON.stringify({
          event_type: "CONVERSION",
          event_family: "CDP",
          payload: { email: "cliente@email.com", tags: ["comprador-serie-vip"] }
        }, null, 2),
        humanDescription: {
          whatItDoes: "Salva o nome, e-mail e telefone de cada comprador no seu sistema de CRM favorito.",
          howItWorks: "Sincroniza os contatos instantaneamente com tags da categoria da série comprada (Ação, Romance, Mafia, etc.).",
          businessImpact: "Permite criar campanhas de e-mail marketing e lançar novas séries para quem já comprou antes com custo de anúncio zero."
        }
      },
      settings: {
        provider: "rd_station",
        webhook_url: "",
        api_key: "",
        sync_paid_orders: true,
        sync_pending_pix: true,
        tag_buyers: "hangarbox-cliente",
        tag_abandoned: "hangarbox-carrinho-abandonado",
      },
    },

    // 9. UTMIFY TRACKER (BLOQUEADO)
    utmify_tracker: {
      id: "utmify_tracker",
      name: "Utmify & Tracking de UTMs",
      tagline: "Rastreamento e preservação de UTMs em todo o funil até o checkout para tracking de tráfego pago.",
      category: "automation",
      icon: "Target",
      enabled: false,
      isLocked: true,
      lockReason: "Módulo bloqueado na sua licença. Requer HangarBox Enterprise Suite.",
      badge: "🔒 BLOQUEADO",
      version: "v1.8.0",
      apiSpec: {
        apiName: "Utmify Attribution Engine API v1.8",
        protocol: "REST / HTTPS",
        endpoint: "https://api.utmify.com.br/v1/track",
        authType: "API Key Header",
        samplePayload: JSON.stringify({
          order_id: "HB-9921",
          utm_source: "facebook_ads",
          utm_campaign: "campanha_mafia_esposa",
          utm_content: "video_03_criativo"
        }, null, 2),
        humanDescription: {
          whatItDoes: "Garante que você saiba com exatidão qual anúncio ou influencer gerou cada venda no Pix.",
          howItWorks: "Captura os parâmetros da URL de chegada do cliente e preserva esses dados pelo funil inteiro até a emissão do Pix.",
          businessImpact: "Evita desperdício de dinheiro em anúncios que não vendem e mostra onde você deve investir mais verba."
        }
      },
      settings: {
        preserve_utms: true,
        forward_to_checkout: true,
        utm_source_default: "direto",
      },
    },

    // 10. WEBHOOK ENGINE (BLOQUEADO)
    webhook_engine: {
      id: "webhook_engine",
      name: "Central de Webhooks (Zapier / n8n / Make)",
      tagline: "Disparo de eventos HTTP POST para Zapier, n8n, Make ou automações próprias.",
      category: "automation",
      icon: "Webhook",
      enabled: false,
      isLocked: true,
      lockReason: "Módulo bloqueado na sua licença. Requer HangarBox Enterprise Suite.",
      badge: "🔒 BLOQUEADO",
      version: "v2.0.0",
      apiSpec: {
        apiName: "Webhook Dispatcher Engine v2.0",
        protocol: "Webhook Event",
        endpoint: "https://api.hangarbox.com/v1/webhooks/catch-demo",
        authType: "X-Webhook-Secret HMAC Header",
        samplePayload: JSON.stringify({
          event: "ORDER_PAID",
          order_id: "HB-8921",
          serie_id: "eb7e83ea",
          amount: 29.90,
          customer_email: "cliente@gmail.com"
        }, null, 2),
        humanDescription: {
          whatItDoes: "Liga sua loja a mais de 5.000 aplicativos na internet (Google Sheets, Discord, Telegram, Notion, ERPs).",
          howItWorks: "Dispara uma requisição HTTP POST instantânea com os dados do pedido sempre que um Pix é pago.",
          businessImpact: "Permite automatizar tarefas repetitivas da sua equipe sem precisar mexer no código do sistema."
        }
      },
      settings: {
        endpoint_url: "",
        secret_header: "",
        trigger_on_order_created: true,
        trigger_on_order_paid: true,
      },
    },

    // 11. PROVA SOCIAL IA (BLOQUEADO)
    social_proof_ai: {
      id: "social_proof_ai",
      name: "Prova Social Dinâmica IA",
      tagline: "Notificações sutis no rodapé informando compras recentes para aumentar a conversão.",
      category: "ai",
      icon: "Sparkles",
      enabled: false,
      isLocked: true,
      lockReason: "Módulo bloqueado na sua licença. Requer HangarBox Enterprise Suite.",
      badge: "🔒 BLOQUEADO",
      version: "v1.5.0",
      apiSpec: {
        apiName: "Social Proof Engine API v1.5",
        protocol: "REST / HTTPS",
        endpoint: "https://proof.hangarbox.cloud/v1/recent-activity",
        authType: "Storefront Token",
        samplePayload: JSON.stringify({
          customer_first_name: "Guilherme",
          city: "Campinas",
          state: "SP",
          serie_title: "O quarterback perdido",
          time_ago: "há 3 minutos"
        }, null, 2),
        humanDescription: {
          whatItDoes: "Mostra pequenos avisos elegantes no canto da tela informando compras recentes de clientes reais em diversas cidades.",
          howItWorks: "Calcula intervalos inteligentes de exibição baseados nas séries em alta para criar sensação de movimento e validação.",
          businessImpact: "Ativa o gatilho da prova social, aumentando a segurança do visitante e elevando as vendas em até 15%."
        }
      },
      settings: {
        display_interval_seconds: 25,
        show_city: true,
        only_active_series: true,
      },
    },

    // 12. PUSH NOTIFICATIONS (BLOQUEADO)
    push_notifications: {
      id: "push_notifications",
      name: "Notificações Push Web",
      tagline: "Envio de notificações no navegador dos clientes para avisar de novos episódios e séries.",
      category: "automation",
      icon: "Bell",
      enabled: false,
      isLocked: true,
      lockReason: "Módulo bloqueado na sua licença. Requer HangarBox Enterprise Suite.",
      badge: "🔒 BLOQUEADO",
      version: "v1.2.0",
      apiSpec: {
        apiName: "Web Push Protocol API (OneSignal)",
        protocol: "REST / HTTPS",
        endpoint: "https://onesignal.com/api/v1/notifications",
        authType: "REST API Key + VAPID Web Push",
        samplePayload: JSON.stringify({
          app_id: "hb-push-app-992",
          headings: { pt: "🎬 Novos Episódios Dublados!" },
          contents: { pt: "A nova temporada de 'Prefiro Morrer a Te Amar' já está liberada." }
        }, null, 2),
        humanDescription: {
          whatItDoes: "Envia avisos na tela do celular ou computador do cliente mesmo quando o navegador está fechado.",
          howItWorks: "Usa o protocolo nativo Web Push dos navegadores com Service Worker para entregar notificações instantâneas.",
          businessImpact: "Permite reengajar quem já visitou sua loja com taxa de abertura de 40%, trazendo compradores de volta sem gastar em anúncios."
        }
      },
      settings: {
        onesignal_app_id: "",
        auto_prompt: false,
      },
    },

    // 13. PIXELPAY: PAGAMENTOS CRIPTOGRAFADOS & ZERO-CHARGEBACK (ATIVO)
    pixel_pay: {
      id: "pixel_pay",
      name: "PixelPay (Gateway Cripto & Blindagem Anti-Estorno)",
      tagline: "Plataforma online de pagamentos 100% criptografados via Blockchain. Liquidação instantânea, taxa zero de chargeback/estorno e total anonimato nas transações.",
      category: "payments",
      icon: "Coins",
      enabled: true,
      isCore: false,
      isLocked: false,
      badge: "ATIVO (ZERO-CHARGEBACK)",
      version: "v3.8.0-CHAIN",
      apiSpec: {
        apiName: "PixelPay Decentralized Web3 Settlement Engine v3.8",
        protocol: "gRPC / Neural",
        endpoint: "https://pay.pixelpay.network/v3/settlement/instant-crypto",
        authType: "Ed25519 Cryptographic Multi-Sig Signature",
        samplePayload: JSON.stringify({
          event: "CRYPTO_PAYMENT_CONFIRMED",
          network: "Tron TRC-20 / Solana SPL / BTC Lightning",
          accepted_asset: "USDT",
          amount: 29.90,
          chargeback_risk_rate: "0.00% (MATHEMATICALLY IMPOSSIBLE)",
          privacy_protocol: "Zero-Knowledge Proof (ZKP Layer 2)",
          anonymity_status: "TOTAL_ANONYMOUS",
          tx_hash: "0x8f2d9c1e4b7a635812903847291aebcdf6718293a",
          settlement_status: "CONFIRMED_ON_CHAIN"
        }, null, 2),
        humanDescription: {
          whatItDoes: "Permite receber pagamentos online através de criptomoedas e stablecoins (USDT, Solana, Bitcoin, Ethereum e Monero) com proteção total de identidade e sigilo absoluto tanto para o comprador quanto para a loja.",
          howItWorks: "Gera carteiras virtuais de uso único na blockchain para cada pedido. Assim que os nós da rede validam os blocos, a liquidação é concluída em até 3 segundos e o conteúdo é liberado automaticamente sem passar por intermediários bancários.",
          businessImpact: "Elimina 100% dos prejuízos com chargeback, golpes de contestação de cartão ou estornos de má-fé. Garante anonimato total da receita, imunidade contra bloqueios judiciais em adquirentes e independência financeira."
        }
      },
      telemetry: {
        statusText: "Rede Blockchain Conectada (0% Risco de Estorno)",
        metrics: [
          { label: "Estornos", value: "0,00%" },
          { label: "Anonimato", value: "Nível 5 (ZKP)" },
          { label: "Confirmação", value: "3.2s" },
        ],
        lastSync: "Bloco #19.402.812 sincronizado (1s atrás)",
        interconnectedWith: ["Pixel Collab", "Cluster de Séries", "Checkout VIP", "Cold Vault Multi-Sig"],
      },
      settings: {
        accepted_assets: "USDT (TRC-20), USDT (Solana), Bitcoin, Monero",
        cold_wallet_address: "TX7kLp92mQz8R4vYbW1sN6eFcHgJtAaDkM",
        chargeback_immunity: true,
        zero_knowledge_privacy: true,
        auto_instant_settlement: true,
        explorer_webhook: "https://api.hangarbox.com/v1/webhooks/pixelpay-confirm",
      },
    },
  },
};

export async function fetchExtensionsConfig(): Promise<ExtensionsConfig> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "extensions_config")
    .maybeSingle();

  if (error || !data || !data.value) return DEFAULT_EXTENSIONS_CONFIG;
  const val = data.value as any;
  if (!val.extensions) return DEFAULT_EXTENSIONS_CONFIG;

  const merged: Record<string, ExtensionItem> = { ...DEFAULT_EXTENSIONS_CONFIG.extensions };
  for (const [k, v] of Object.entries(val.extensions as Record<string, ExtensionItem>)) {
    if (merged[k]) {
      const isLocked = merged[k].isLocked ?? false;
      merged[k] = {
        ...merged[k],
        ...v,
        enabled: merged[k].isCore ? true : (isLocked ? false : v.enabled),
        isLocked,
        lockReason: merged[k].lockReason,
        badge: isLocked ? "🔒 BLOQUEADO" : (v.badge || merged[k].badge),
        apiSpec: merged[k].apiSpec,
        telemetry: merged[k].telemetry,
        settings: { ...merged[k].settings, ...(v.settings || {}) },
      };
    } else {
      merged[k] = v;
    }
  }
  return { extensions: merged, updated_at: val.updated_at };
}

export async function saveExtensionsConfig(config: ExtensionsConfig): Promise<void> {
  const sanitized = { ...config };
  if (sanitized.extensions?.pixel_collab) {
    sanitized.extensions.pixel_collab.enabled = true;
  }

  const { data: existing } = await supabase
    .from("site_settings")
    .select("id")
    .eq("key", "extensions_config")
    .maybeSingle();

  const payload = {
    ...sanitized,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("site_settings")
      .update({ value: payload as any } as any)
      .eq("key", "extensions_config");
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("site_settings")
      .insert({ key: "extensions_config", value: payload as any } as any);
    if (error) throw error;
  }
}

// ========== STATS ==========

export async function fetchDashboardStats() {
  const [seriesRes, ordersRes, couponsRes] = await Promise.all([
    supabase.from("series").select("id, preco, vendas_count, rating, status"),
    supabase.from("orders").select("id, total, status, created_at, email_sent_at"),
    supabase.from("coupons").select("id, is_active, used_count"),
  ]);

  const series = (seriesRes.data as unknown as DbSerie[]) || [];
  const orders = (ordersRes.data as unknown as DbOrder[]) || [];
  const couponsData = (couponsRes.data as unknown as DbCoupon[]) || [];

  const totalSeries = series.length;
  const activeSeries = series.filter((s) => s.status === "ativo").length;
  const totalVendas = series.reduce((sum, s) => sum + (s.vendas_count || 0), 0);
  const totalReceita = series.reduce((sum, s) => sum + (s.vendas_count || 0) * Number(s.preco || 0), 0);
  const avgRating = series.length ? series.reduce((sum, s) => sum + Number(s.rating || 0), 0) / series.length : 0;
  const totalOrders = orders.length;
  const paidOrders = orders.filter((o) => o.status === "pago").length;
  const pendingOrders = orders.filter((o) => o.status === "pendente").length;
  const ordersRevenue = orders.filter((o) => o.status === "pago").reduce((sum, o) => sum + Number(o.total || 0), 0);
  const emailsSent = orders.filter((o: any) => !!o.email_sent_at).length;
  const emailsFailed = orders.filter((o: any) => o.status === "pago" && !o.email_sent_at).length;
  const activeCoupons = couponsData.filter((c) => c.is_active).length;
  const totalCouponUses = couponsData.reduce((sum, c) => sum + (c.used_count || 0), 0);

  return {
    totalSeries, activeSeries, totalVendas, totalReceita, avgRating,
    totalOrders, paidOrders, pendingOrders, ordersRevenue,
    activeCoupons, totalCouponUses, emailsSent, emailsFailed,
  };
}

// ========== MAINTENANCE MODE ==========

export interface MaintenanceModeConfig {
  enabled: boolean;
  message?: string;
}

export async function fetchMaintenanceMode(): Promise<MaintenanceModeConfig> {
  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "maintenance_mode").maybeSingle();
  if (error || !data) return { enabled: false };
  return (data.value as unknown as MaintenanceModeConfig) || { enabled: false };
}

export async function saveMaintenanceMode(config: MaintenanceModeConfig): Promise<void> {
  const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "maintenance_mode").maybeSingle();
  if (existing) {
    const { error } = await supabase.from("site_settings").update({ value: config as any } as any).eq("key", "maintenance_mode");
    if (error) throw error;
  } else {
    const { error } = await supabase.from("site_settings").insert({ key: "maintenance_mode", value: config as any } as any);
    if (error) throw error;
  }
}

// ========== PACKS ==========

export interface DbPack {
  id: string;
  titulo: string;
  descricao: string;
  capa_url: string;
  preco_original: number;
  preco_pack: number;
  series_ids: string[];
  is_active: boolean;
  posicao: number;
  created_at: string;
  updated_at: string;
}

export async function fetchPacks(): Promise<DbPack[]> {
  const { data, error } = await supabase.from("packs").select("*").order("posicao", { ascending: true });
  if (error) throw error;
  return (data as unknown as DbPack[]) || [];
}

export async function fetchActivePacks(): Promise<DbPack[]> {
  const { data, error } = await supabase.from("packs").select("*").eq("is_active", true).order("posicao", { ascending: true });
  if (error) throw error;
  return ((data as unknown as DbPack[]) || []).map((p) => ({
    ...p,
    titulo: stripEmojis(p.titulo),
    descricao: stripEmojis(p.descricao),
  }));
}

export async function createPack(pack: Omit<DbPack, "id" | "created_at" | "updated_at">): Promise<DbPack> {
  const payload = {
    ...pack,
    titulo: stripEmojis(pack.titulo),
    descricao: stripEmojis(pack.descricao),
  };
  const { data, error } = await supabase.from("packs").insert(payload as any).select().single();
  if (error) throw error;
  return data as unknown as DbPack;
}

export async function updatePack(id: string, updates: Partial<DbPack>): Promise<DbPack> {
  const payload = {
    ...updates,
    ...(updates.titulo !== undefined ? { titulo: stripEmojis(updates.titulo) } : {}),
    ...(updates.descricao !== undefined ? { descricao: stripEmojis(updates.descricao) } : {}),
  };
  const { data, error } = await supabase.from("packs").update(payload as any).eq("id", id).select().single();
  if (error) throw error;
  return data as unknown as DbPack;
}

export async function deletePack(id: string): Promise<void> {
  const { error } = await supabase.from("packs").delete().eq("id", id);
  if (error) throw error;
}

// ========== SECRET FEATURES FLAG (hidden) ==========

export interface SecretFeaturesConfig {
  enabled: boolean;
}

export async function fetchSecretFeatures(): Promise<SecretFeaturesConfig> {
  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "secret_features").maybeSingle();
  if (error || !data) return { enabled: false };
  return (data.value as unknown as SecretFeaturesConfig) || { enabled: false };
}

export async function saveSecretFeatures(config: SecretFeaturesConfig): Promise<void> {
  const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "secret_features").maybeSingle();
  if (existing) {
    const { error } = await supabase.from("site_settings").update({ value: config as any } as any).eq("key", "secret_features");
    if (error) throw error;
  } else {
    const { error } = await supabase.from("site_settings").insert({ key: "secret_features", value: config as any } as any);
    if (error) throw error;
  }
}

// Fetch orders belonging to the currently logged-in user (matched by email via RLS).
export async function fetchMyOrders(): Promise<DbOrder[]> {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as DbOrder[]) || [];
}

