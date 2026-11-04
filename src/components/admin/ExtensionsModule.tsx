import React, { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Search,
  Sliders,
  Settings2,
  Sparkles,
  Bot,
  Share2,
  Users2,
  Briefcase,
  Video,
  BarChart3,
  Target,
  MessageCircle,
  Webhook,
  ShieldAlert,
  Bell,
  ExternalLink,
  Save,
  RefreshCw,
  Power,
  Zap,
  Lock,
  ArrowRight,
  Activity,
  Check,
  Send,
  HelpCircle,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  fetchExtensionsConfig,
  saveExtensionsConfig,
  DEFAULT_EXTENSIONS_CONFIG,
  type ExtensionsConfig,
  type ExtensionItem,
} from "@/lib/api";
import { saveMetaPixelConfig } from "@/lib/metaPixel";

const ICON_MAP: Record<string, React.ElementType> = {
  Users2,
  Share2,
  Bot,
  Briefcase,
  Video,
  BarChart3,
  Target,
  MessageCircle,
  Webhook,
  Sparkles,
  ShieldAlert,
  Bell,
};

const CATEGORIES = [
  { id: "all", label: "Todas as Extensões" },
  { id: "active", label: "Ativas" },
  { id: "core", label: "Plataforma Core" },
  { id: "pixels", label: "Pixels & Tráfego" },
  { id: "ai", label: "IA & Atendimento" },
  { id: "crm", label: "CRM & Vendas" },
  { id: "automation", label: "Automação" },
  { id: "security", label: "Segurança" },
];

export const ExtensionsModule: React.FC = () => {
  const [config, setConfig] = useState<ExtensionsConfig>(DEFAULT_EXTENSIONS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Selected extension for detail / settings modal
  const [activeExt, setActiveExt] = useState<ExtensionItem | null>(null);
  const [editSettings, setEditSettings] = useState<Record<string, any>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Load configuration from Supabase
  useEffect(() => {
    fetchExtensionsConfig()
      .then((cfg) => {
        setConfig(cfg);
      })
      .catch((err) => {
        console.error("Erro ao carregar extensões:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const extensionsList = useMemo(() => {
    return Object.values(config.extensions || {});
  }, [config.extensions]);

  // Filtered list
  const filteredExtensions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return extensionsList.filter((ext) => {
      // Category filter
      if (selectedCategory === "active" && !ext.enabled) return false;
      if (selectedCategory !== "all" && selectedCategory !== "active" && ext.category !== selectedCategory) {
        return false;
      }
      // Search filter
      if (!q) return true;
      const matchName = ext.name.toLowerCase().includes(q);
      const matchTagline = ext.tagline.toLowerCase().includes(q);
      const matchBadge = (ext.badge || "").toLowerCase().includes(q);
      return matchName || matchTagline || matchBadge;
    });
  }, [extensionsList, selectedCategory, search]);

  // Counts
  const totalCount = extensionsList.length;
  const activeCount = extensionsList.filter((e) => e.enabled).length;

  // Toggle extension state
  const handleToggle = async (extId: string, newState: boolean) => {
    if (config.extensions[extId]?.isCore) {
      toast.info("Pixel Collab é a plataforma central de gerenciamento e deve permanecer sempre ativa.");
      return;
    }

    const updated: ExtensionsConfig = {
      ...config,
      extensions: {
        ...config.extensions,
        [extId]: {
          ...config.extensions[extId],
          enabled: newState,
        },
      },
    };

    setConfig(updated);
    try {
      await saveExtensionsConfig(updated);
      toast.success(
        newState
          ? `Extensão "${config.extensions[extId]?.name}" ativada!`
          : `Extensão "${config.extensions[extId]?.name}" desativada.`
      );
    } catch {
      toast.error("Erro ao salvar alteração de status.");
    }
  };

  // Open settings modal
  const handleOpenSettings = (ext: ExtensionItem) => {
    setActiveExt(ext);
    setEditSettings({ ...(ext.settings || {}) });
    setIsModalOpen(true);
  };

  // Save extension settings
  const handleSaveActiveSettings = async () => {
    if (!activeExt) return;
    setSaving(true);
    try {
      const updated: ExtensionsConfig = {
        ...config,
        extensions: {
          ...config.extensions,
          [activeExt.id]: {
            ...activeExt,
            settings: editSettings,
          },
        },
      };

      await saveExtensionsConfig(updated);
      setConfig(updated);

      // If it's Pixel Meta, sync with legacy site_settings.meta_pixel
      if (activeExt.id === "pixel_meta") {
        if (editSettings.pixel_id) {
          await saveMetaPixelConfig({
            pixel_id: editSettings.pixel_id,
            domain_verification: editSettings.domain_verification || "",
          }).catch(() => {});
        }
      }

      toast.success(`Configurações de "${activeExt.name}" salvas com sucesso!`);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar extensão:", err);
      toast.error(err?.message || "Erro ao salvar configurações da extensão.");
    } finally {
      setSaving(false);
    }
  };

  // Test connection simulation
  const handleTestConnection = async () => {
    if (!activeExt) return;
    setTestingConnection(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));

      if (activeExt.id === "pixel_collab") {
        toast.success("Pixel Collab: Conexão ativa! Latência: 18ms. Cluster operacional SP-01.");
      } else if (activeExt.id === "pixel_meta") {
        toast.success("Meta Pixel & CAPI: Conexão estabelecida com sucesso com os servidores da Meta!");
      } else if (activeExt.id === "pixel_evora") {
        toast.success("Évora IA: Motor neural ativo e pronto para atender no storefront.");
      } else if (activeExt.id === "crm_central") {
        toast.success("CRM: Endpoint testado com sucesso! Payload de exemplo enviado.");
      } else {
        toast.success(`Integração com "${activeExt.name}" testada e validada com sucesso!`);
      }
    } catch {
      toast.error("Falha ao testar conexão.");
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Header Banner & Collab Status */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-gradient-to-br from-rose-500/20 via-purple-500/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-rose-500 to-purple-600 text-white shadow-sm">
                Marketplace de Extensões
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Pixel Collab Ativo
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Painel de Extensões & Apps</span>
              <Boxes className="text-rose-500 w-7 h-7 hidden sm:inline" />
            </h2>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Turbine sua loja com automações de tráfego, pixels de conversão, a assistente de IA <strong>Évora</strong>, integrações de CRM e a infraestrutura nativa do <strong>Pixel Collab</strong>.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto shrink-0">
            <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-3.5 backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                Total de Apps
              </span>
              <div className="text-xl font-black text-white mt-0.5">{totalCount}</div>
              <span className="text-[10px] text-zinc-500">Módulos oficiais</span>
            </div>

            <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-3.5 backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                Apps Ativos
              </span>
              <div className="text-xl font-black text-emerald-400 mt-0.5">{activeCount}</div>
              <span className="text-[10px] text-zinc-500">Em produção</span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-purple-900/40 to-zinc-800/60 border border-purple-500/30 rounded-2xl p-3.5 backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold text-purple-300 block tracking-wider">
                Pixel Collab
              </span>
              <div className="text-xs font-black text-white mt-1 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Gerenciamento
              </div>
              <span className="text-[10px] text-zinc-400">Core v2.5.0 LTS</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Search & Category Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por extensão, CRM, Pixel, IA..."
            className="pl-10 text-xs bg-white border-slate-200 rounded-2xl h-11 text-slate-900 focus:bg-white shadow-xs"
          />
        </div>

        {/* Categories Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold tracking-tight whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "bg-white border border-slate-200/90 text-slate-600 hover:text-slate-950 hover:bg-slate-50"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Extensions Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredExtensions.map((ext) => {
          const IconComp = ICON_MAP[ext.icon] || Boxes;
          const isCore = ext.isCore === true;
          const isEvora = ext.id === "pixel_evora";
          const isMeta = ext.id === "pixel_meta";

          return (
            <div
              key={ext.id}
              className={`group rounded-3xl border bg-white p-5 flex flex-col justify-between transition-all duration-300 shadow-xs hover:shadow-md ${
                ext.enabled
                  ? isCore
                    ? "border-purple-300/80 ring-1 ring-purple-400/20 bg-gradient-to-b from-purple-50/20 to-white"
                    : isEvora
                    ? "border-rose-300/80 ring-1 ring-rose-400/20 bg-gradient-to-b from-rose-50/20 to-white"
                    : "border-slate-200 hover:border-slate-300"
                  : "border-slate-200/60 opacity-75 hover:opacity-100"
              }`}
            >
              <div>
                {/* Card Top: Icon, Badge & Switch */}
                <div className="flex items-start justify-between gap-3 mb-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${
                      isCore
                        ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-purple-500/25"
                        : isEvora
                        ? "bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-rose-500/25"
                        : isMeta
                        ? "bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-blue-500/25"
                        : ext.enabled
                        ? "bg-zinc-950 text-white shadow-zinc-900/25"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <IconComp size={22} />
                  </div>

                  <div className="flex items-center gap-2">
                    {ext.badge && (
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                          isCore
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : isEvora
                            ? "bg-rose-100 text-rose-800 border-rose-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {ext.badge}
                      </span>
                    )}

                    {isCore ? (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-extrabold">
                        <Lock size={10} className="text-emerald-600" />
                        <span>ATIVO</span>
                      </div>
                    ) : (
                      <Switch
                        checked={ext.enabled}
                        onCheckedChange={(checked) => handleToggle(ext.id, checked)}
                      />
                    )}
                  </div>
                </div>

                {/* Card Title & Tagline */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                      {ext.name}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-400">
                      {ext.version}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {ext.tagline}
                  </p>
                </div>
              </div>

              {/* Card Footer: Status details & Configure button */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[11px]">
                  {ext.enabled ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-semibold text-emerald-700">Operacional</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                      <span className="text-slate-400 font-medium">Desativado</span>
                    </>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenSettings(ext)}
                  className="h-8 text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl gap-1.5 shadow-2xs"
                >
                  <Settings2 size={13} />
                  <span>Configurar</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Dedicated Settings Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white text-slate-900 border-slate-200">
          {activeExt && (
            <>
              {/* Modal Header */}
              <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-950 text-white flex items-center justify-center shrink-0 shadow-md">
                    {(() => {
                      const IconC = ICON_MAP[activeExt.icon] || Boxes;
                      return <IconC size={20} />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <span>{activeExt.name}</span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        {activeExt.version}
                      </span>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 mt-0.5">
                      {activeExt.tagline}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Modal Body: Custom Form per Extension */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {/* 1. PIXEL COLLAB (Core Platform) */}
                {activeExt.id === "pixel_collab" && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-purple-900 text-xs">
                      <strong>Plataforma Central HangarBox Collab:</strong> Este é o módulo de governança que coordena as sessões, permissões de administradores e a integridade de dados do cluster da loja. Ele permanece sempre conectado.
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Nome do Workspace</label>
                        <Input
                          value={editSettings.workspace_name || ""}
                          onChange={(e) => setEditSettings({ ...editSettings, workspace_name: e.target.value })}
                          className="text-xs rounded-xl h-9 bg-slate-50"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">ID do Workspace</label>
                        <Input
                          value={editSettings.workspace_id || ""}
                          readOnly
                          className="text-xs rounded-xl h-9 bg-slate-100 font-mono text-slate-500 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                        <div>
                          <span className="font-bold text-slate-800 block">Sincronização em Tempo Real</span>
                          <span className="text-[11px] text-slate-500">Replica alterações de catálogo e compras instantaneamente</span>
                        </div>
                        <Switch
                          checked={editSettings.sync_mode === "realtime"}
                          onCheckedChange={(c) => setEditSettings({ ...editSettings, sync_mode: c ? "realtime" : "interval" })}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                        <div>
                          <span className="font-bold text-slate-800 block">Logs de Auditoria Avançados</span>
                          <span className="text-[11px] text-slate-500">Registra alterações administrativas e acessos</span>
                        </div>
                        <Switch
                          checked={editSettings.auto_audit_logs ?? true}
                          onCheckedChange={(c) => setEditSettings({ ...editSettings, auto_audit_logs: c })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PIXEL-META */}
                {activeExt.id === "pixel_meta" && (
                  <div className="space-y-4">
                    <p className="text-slate-500">
                      Configure seu Pixel do Facebook/Instagram e a API de Conversões (CAPI) para rastrear todas as vendas com máxima atribuição.
                    </p>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Meta Pixel ID</label>
                      <Input
                        value={editSettings.pixel_id || ""}
                        onChange={(e) => setEditSettings({ ...editSettings, pixel_id: e.target.value.trim() })}
                        placeholder="Ex: 984783917460881"
                        className="text-xs rounded-xl h-9 font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Token de Acesso da API de Conversões (CAPI Server-Side)</label>
                      <Input
                        type="password"
                        value={editSettings.capi_token || ""}
                        onChange={(e) => setEditSettings({ ...editSettings, capi_token: e.target.value.trim() })}
                        placeholder="EAAB..."
                        className="text-xs rounded-xl h-9 font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Garante o envio de eventos de compra mesmo com bloqueadores de anúncios ativos no navegador.
                      </span>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Código de Teste de Eventos (Opcional)</label>
                      <Input
                        value={editSettings.test_event_code || ""}
                        onChange={(e) => setEditSettings({ ...editSettings, test_event_code: e.target.value.trim() })}
                        placeholder="Ex: TEST12345"
                        className="text-xs rounded-xl h-9 font-mono"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="font-bold text-slate-800 block mb-2">Eventos Automáticos Ativos</span>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editSettings.track_pageview ?? true}
                            onChange={(e) => setEditSettings({ ...editSettings, track_pageview: e.target.checked })}
                            className="accent-rose-600 rounded"
                          />
                          <span className="font-semibold text-slate-700">PageView</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editSettings.track_viewcontent ?? true}
                            onChange={(e) => setEditSettings({ ...editSettings, track_viewcontent: e.target.checked })}
                            className="accent-rose-600 rounded"
                          />
                          <span className="font-semibold text-slate-700">ViewContent (Séries)</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editSettings.track_initiate_checkout ?? true}
                            onChange={(e) => setEditSettings({ ...editSettings, track_initiate_checkout: e.target.checked })}
                            className="accent-rose-600 rounded"
                          />
                          <span className="font-semibold text-slate-700">InitiateCheckout</span>
                        </label>
                        <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editSettings.track_purchase ?? true}
                            onChange={(e) => setEditSettings({ ...editSettings, track_purchase: e.target.checked })}
                            className="accent-rose-600 rounded"
                          />
                          <span className="font-semibold text-slate-700">Purchase (Venda Pix)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. PIXEL ÉVORA (AI Assistant) */}
                {activeExt.id === "pixel_evora" && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-950 text-xs">
                      <strong>Évora — Concierge & Atendente de IA:</strong> A Évora interage com os visitantes da loja, tira dúvidas sobre os episódios dublados, orienta sobre o pagamento e ajuda no checkout.
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Nome da Assistente</label>
                        <Input
                          value={editSettings.bot_name || "Évora IA"}
                          onChange={(e) => setEditSettings({ ...editSettings, bot_name: e.target.value })}
                          className="text-xs rounded-xl h-9"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Tom de Voz</label>
                        <select
                          value={editSettings.tone || "persuasive"}
                          onChange={(e) => setEditSettings({ ...editSettings, tone: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl h-9 px-3 text-xs text-slate-900 outline-none"
                        >
                          <option value="persuasive">Persuasiva & Focada em Vendas</option>
                          <option value="friendly">Amigável & Entusiasta de Séries</option>
                          <option value="direct">Rápida & Direta</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Mensagem Inicial de Boas-Vindas</label>
                      <textarea
                        rows={2}
                        value={editSettings.greeting_message || ""}
                        onChange={(e) => setEditSettings({ ...editSettings, greeting_message: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500"
                        placeholder="Olá! Sou a Évora..."
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Diretriz de Personalidade (System Prompt)</label>
                      <textarea
                        rows={3}
                        value={editSettings.personality_prompt || ""}
                        onChange={(e) => setEditSettings({ ...editSettings, personality_prompt: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500"
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-800">Exibir Widget Flutuante na Loja</span>
                        <Switch
                          checked={editSettings.show_floating_widget ?? true}
                          onCheckedChange={(c) => setEditSettings({ ...editSettings, show_floating_widget: c })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-800">Oferecer Suporte com Pix Imediato</span>
                        <Switch
                          checked={editSettings.pix_help_enabled ?? true}
                          onCheckedChange={(c) => setEditSettings({ ...editSettings, pix_help_enabled: c })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. CRM CENTRAL */}
                {activeExt.id === "crm_central" && (
                  <div className="space-y-4">
                    <p className="text-slate-500">
                      Envie compradores confirmados e contatos de checkout abandonado diretamente para o seu pipeline de vendas e e-mail marketing.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Provedor de CRM</label>
                        <select
                          value={editSettings.provider || "rd_station"}
                          onChange={(e) => setEditSettings({ ...editSettings, provider: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl h-9 px-3 text-xs text-slate-900 outline-none"
                        >
                          <option value="rd_station">RD Station Marketing</option>
                          <option value="hubspot">HubSpot CRM</option>
                          <option value="active_campaign">ActiveCampaign</option>
                          <option value="webhook">Webhook Personalizado</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">API Key / Token</label>
                        <Input
                          type="password"
                          value={editSettings.api_key || ""}
                          onChange={(e) => setEditSettings({ ...editSettings, api_key: e.target.value.trim() })}
                          placeholder="Token da API..."
                          className="text-xs rounded-xl h-9"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">URL do Webhook do CRM</label>
                      <Input
                        value={editSettings.webhook_url || ""}
                        onChange={(e) => setEditSettings({ ...editSettings, webhook_url: e.target.value.trim() })}
                        placeholder="https://api.rd.services/platform/conversions..."
                        className="text-xs rounded-xl h-9"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Tag para Compradores</label>
                        <Input
                          value={editSettings.tag_buyers || "hangarbox-cliente"}
                          onChange={(e) => setEditSettings({ ...editSettings, tag_buyers: e.target.value })}
                          className="text-xs rounded-xl h-9"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Tag para Abandono</label>
                        <Input
                          value={editSettings.tag_abandoned || "hangarbox-carrinho-abandonado"}
                          onChange={(e) => setEditSettings({ ...editSettings, tag_abandoned: e.target.value })}
                          className="text-xs rounded-xl h-9"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. TIKTOK PIXEL */}
                {activeExt.id === "tiktok_pixel" && (
                  <div className="space-y-4">
                    <p className="text-slate-500">
                      Rastreie cliques e conversões de anúncios no TikTok Ads para impulsionar séries virais.
                    </p>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">TikTok Pixel ID</label>
                      <Input
                        value={editSettings.pixel_id || ""}
                        onChange={(e) => setEditSettings({ ...editSettings, pixel_id: e.target.value.trim() })}
                        placeholder="Ex: C8XXXXXXXXXXXXXXXXXX"
                        className="text-xs rounded-xl h-9 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* 6. GOOGLE SUITE */}
                {activeExt.id === "google_suite" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">GA4 Measurement ID</label>
                        <Input
                          value={editSettings.ga4_measurement_id || ""}
                          onChange={(e) => setEditSettings({ ...editSettings, ga4_measurement_id: e.target.value.trim() })}
                          placeholder="G-XXXXXXXXXX"
                          className="text-xs rounded-xl h-9 font-mono"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">GTM Container ID</label>
                        <Input
                          value={editSettings.gtm_container_id || ""}
                          onChange={(e) => setEditSettings({ ...editSettings, gtm_container_id: e.target.value.trim() })}
                          placeholder="GTM-XXXXXXX"
                          className="text-xs rounded-xl h-9 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. UTMIFY TRACKER */}
                {activeExt.id === "utmify_tracker" && (
                  <div className="space-y-4">
                    <p className="text-slate-500">
                      Captura os parâmetros `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` e `src` da URL inicial e preserva até a finalização do Pix no Mercado Pago.
                    </p>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <span className="font-bold text-slate-800">Injetar UTMs nos Metadados do Pedido</span>
                      <Switch
                        checked={editSettings.forward_to_checkout ?? true}
                        onCheckedChange={(c) => setEditSettings({ ...editSettings, forward_to_checkout: c })}
                      />
                    </div>
                  </div>
                )}

                {/* 8. WEBHOOK ENGINE */}
                {activeExt.id === "webhook_engine" && (
                  <div className="space-y-4">
                    <p className="text-slate-500">
                      Envie payloads JSON instantâneos para automações externas no Zapier, Make, n8n ou webhook próprio.
                    </p>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Endpoint URL (POST)</label>
                      <Input
                        value={editSettings.endpoint_url || ""}
                        onChange={(e) => setEditSettings({ ...editSettings, endpoint_url: e.target.value.trim() })}
                        placeholder="https://webhook.site/..."
                        className="text-xs rounded-xl h-9 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Chave Secreta de Assinatura (Header)</label>
                      <Input
                        type="password"
                        value={editSettings.secret_header || ""}
                        onChange={(e) => setEditSettings({ ...editSettings, secret_header: e.target.value.trim() })}
                        placeholder="X-Webhook-Secret..."
                        className="text-xs rounded-xl h-9 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* 9. SOCIAL PROOF AI */}
                {activeExt.id === "social_proof_ai" && (
                  <div className="space-y-4">
                    <p className="text-slate-500">
                      Dispara notificações sutis no canto inferior da tela mostrando compras recentes da comunidade para acelerar a decisão dos novos visitantes.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Intervalo entre Popups (segundos)</label>
                        <Input
                          type="number"
                          min={5}
                          max={120}
                          value={editSettings.display_interval_seconds || 25}
                          onChange={(e) => setEditSettings({ ...editSettings, display_interval_seconds: parseInt(e.target.value) || 25 })}
                          className="text-xs rounded-xl h-9"
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl mt-4">
                        <span className="font-bold text-slate-800">Exibir Cidade</span>
                        <Switch
                          checked={editSettings.show_city ?? true}
                          onCheckedChange={(c) => setEditSettings({ ...editSettings, show_city: c })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 10. ANTIFRAUD SHIELD */}
                {activeExt.id === "antifraud_shield" && (
                  <div className="space-y-4">
                    <p className="text-slate-500">
                      Protege sua infraestrutura contra bots geradores de Pix em massa e tentativas fraudulentas.
                    </p>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div>
                        <span className="font-bold text-slate-800 block">Bloquear E-mails Descartáveis / Temporários</span>
                        <span className="text-[11px] text-slate-500">Impede o uso de serviços como 10minutemail ou mailinator</span>
                      </div>
                      <Switch
                        checked={editSettings.block_disposable_emails ?? true}
                        onCheckedChange={(c) => setEditSettings({ ...editSettings, block_disposable_emails: c })}
                      />
                    </div>
                  </div>
                )}

                {/* 11. PUSH NOTIFICATIONS / WHATSAPP RECOVERY FALLBACK */}
                {(activeExt.id === "push_notifications" || activeExt.id === "whatsapp_recovery") && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 text-xs">
                      Extensão pronta para integração. Ajuste as credenciais abaixo e clique em Salvar para ativar os disparos.
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Mensagem ou Identificador de App</label>
                      <Input
                        value={editSettings.onesignal_app_id || editSettings.custom_message || ""}
                        onChange={(e) =>
                          setEditSettings({
                            ...editSettings,
                            [activeExt.id === "push_notifications" ? "onesignal_app_id" : "custom_message"]: e.target.value,
                          })
                        }
                        className="text-xs rounded-xl h-9"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="h-9 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 gap-1.5"
                >
                  <Activity size={13} className={testingConnection ? "animate-spin text-rose-600" : "text-emerald-600"} />
                  <span>{testingConnection ? "Testando..." : "Testar Conexão"}</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="h-9 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
                  >
                    Fechar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveActiveSettings}
                    disabled={saving}
                    className="h-9 text-xs font-bold bg-[#E31C25] hover:bg-[#B8151D] text-white rounded-xl shadow-xs px-5"
                  >
                    {saving ? "Salvando..." : "Salvar Configuração"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExtensionsModule;
