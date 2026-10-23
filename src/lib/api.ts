import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_LIMITS, validateImageUpload } from "@/lib/limits";
import { stripEmojis } from "@/lib/utils";

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
  if (error) throw error;
  return data as unknown as DbSerie;
}

export async function updateSerie(id: string, updates: Partial<DbSerie>): Promise<DbSerie> {
  const payload = {
    ...updates,
    ...(updates.titulo !== undefined ? { titulo: stripEmojis(updates.titulo) } : {}),
    ...(updates.resumo !== undefined ? { resumo: stripEmojis(updates.resumo) } : {}),
  };
  const { data, error } = await supabase.from("series").update(payload as any).eq("id", id).select().single();
  if (error) throw error;
  return data as unknown as DbSerie;
}

export async function deleteSerie(id: string): Promise<void> {
  const { error } = await supabase.from("series").delete().eq("id", id);
  if (error) throw error;
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
    body: JSON.stringify(params),
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
  description: string;
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
    body: JSON.stringify(params),
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

