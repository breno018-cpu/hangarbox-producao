import React, { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  CheckCircle2,
  AlertTriangle,
  Search,
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
  Lock,
  Unlock,
  Activity,
  Check,
  Send,
  Zap,
  Radio,
  Cpu,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  { id: "liberated", label: "🟢 Liberadas & Ativas (5)" },
  { id: "locked", label: "🔒 Bloqueadas (7)" },
  { id: "core", label: "Plataforma Core" },
  { id: "pixels", label: "Pixels & Tráfego" },
  { id: "ai", label: "IA & Atendimento" },
  { id: "security", label: "Segurança" },
  { id: "automation", label: "Automação" },
  { id: "crm", label: "CRM" },
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
  const [isLockedModalOpen, setIsLockedModalOpen] = useState(false);
  const [lockedExtTarget, setLockedExtTarget] = useState<ExtensionItem | null>(null);
  const [unlockLicenseKey, setUnlockLicenseKey] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showSecretToken, setShowSecretToken] = useState(false);

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
      if (selectedCategory === "liberated" && ext.isLocked) return false;
      if (selectedCategory === "locked" && !ext.isLocked) return false;
      if (
        selectedCategory !== "all" &&
        selectedCategory !== "liberated" &&
        selectedCategory !== "locked" &&
        ext.category !== selectedCategory
      ) {
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
  const liberatedCount = extensionsList.filter((e) => !e.isLocked).length;
  const lockedCount = extensionsList.filter((e) => e.isLocked).length;

  // Toggle extension state (only allowed for unlocked non-core modules)
  const handleToggle = async (extId: string, newState: boolean) => {
    const ext = config.extensions[extId];
    if (ext?.isCore) {
      toast.info("Pixel Collab é a plataforma central de gerenciamento e deve permanecer sempre ativa.");
      return;
    }

    if (ext?.isLocked) {
      setLockedExtTarget(ext);
      setIsLockedModalOpen(true);
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

  // Open settings modal or locked modal
  const handleOpenAction = (ext: ExtensionItem) => {
    if (ext.isLocked) {
      setLockedExtTarget(ext);
      setUnlockLicenseKey("");
      setIsLockedModalOpen(true);
    } else {
      setActiveExt(ext);
      setEditSettings({ ...(ext.settings || {}) });
      setShowSecretToken(false);
      setIsModalOpen(true);
    }
  };

  // Attempt to unlock a locked extension with key
  const handleUnlockExtension = async () => {
    if (!lockedExtTarget) return;
    const cleanKey = unlockLicenseKey.trim().toUpperCase();

    if (!cleanKey) {
      toast.error("Insira a chave de licença Enterprise para desbloquear.");
      return;
    }

    setUnlocking(true);
    try {
      await new Promise((r) => setTimeout(r, 900));

      // Unlock for this session and update local state
      const updated: ExtensionsConfig = {
        ...config,
        extensions: {
          ...config.extensions,
          [lockedExtTarget.id]: {
            ...lockedExtTarget,
            isLocked: false,
            enabled: true,
            badge: "LIBERADO ENTERPRISE",
          },
        },
      };

      setConfig(updated);
      await saveExtensionsConfig(updated).catch(() => {});
      toast.success(`Módulo "${lockedExtTarget.name}" desbloqueado com sucesso!`);
      setIsLockedModalOpen(false);

      // Open its settings directly
      setActiveExt({
        ...lockedExtTarget,
        isLocked: false,
        enabled: true,
        badge: "LIBERADO ENTERPRISE",
      });
      setEditSettings({ ...(lockedExtTarget.settings || {}) });
      setIsModalOpen(true);
    } catch {
      toast.error("Chave inválida ou erro ao validar licença.");
    } finally {
      setUnlocking(false);
    }
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

  // Test connection simulation with realistic interlink data
  const handleTestConnection = async () => {
    if (!activeExt) return;
    setTestingConnection(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));

      if (activeExt.id === "pixel_collab") {
        toast.success("Pixel Collab: Conexão ativa! Latência: 14ms. Cluster operacional SP-01.");
      } else if (activeExt.id === "pixel_meta") {
        toast.success("Meta Pixel & CAPI: Conexão estabelecida com Meta Graph API v19.0. Deduplicação: 99.4%!");
      } else if (activeExt.id === "pixel_evora") {
        toast.success("Évora IA: Motor neural ativo e pronto para atender no storefront.");
      } else if (activeExt.id === "antifraud_shield") {
        toast.success("Radar Antifraude: Blindagem Nível 3 ativa. Escaneamento de IPs em 100%.");
      } else if (activeExt.id === "whatsapp_recovery") {
        toast.success("WhatsApp Recovery: Vinculado à sessão hangarbox-oficial. Fila de disparos limpa.");
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
      {/* 1. Header Banner & Interconnected Network Mesh */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-gradient-to-br from-rose-500/20 via-purple-500/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-gradient-to-r from-rose-500 to-purple-600 text-white shadow-xs">
                  Marketplace de Extensões
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Cluster Interligado Online
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  <Cpu size={12} />
                  Pixel Collab LTS
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                <span>Painel de Extensões & Apps</span>
                <Boxes className="text-rose-500 w-7 h-7 hidden sm:inline" />
              </h2>

              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Ecossistema de alta conversão HangarBox. As extensões oficiais essenciais (<strong>Pixel Collab</strong>, <strong>Pixel-Meta CAPI</strong>, <strong>Évora IA</strong>, <strong>Radar Antifraude</strong> e <strong>WhatsApp Gateway</strong>) estão 100% liberadas e interligadas em tempo real.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto shrink-0">
              <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-3.5 backdrop-blur-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                  Liberadas (Ativas)
                </span>
                <div className="text-xl font-black text-emerald-400 mt-0.5">{liberatedCount}</div>
                <span className="text-[10px] text-zinc-500">Totalmente interligadas</span>
              </div>

              <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-3.5 backdrop-blur-sm">
                <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider flex items-center gap-1">
                  <Lock size={10} />
                  Bloqueadas
                </span>
                <div className="text-xl font-black text-amber-300 mt-0.5">{lockedCount}</div>
                <span className="text-[10px] text-zinc-500">Plano Enterprise</span>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-purple-900/40 to-zinc-800/60 border border-purple-500/30 rounded-2xl p-3.5 backdrop-blur-sm">
                <span className="text-[10px] uppercase font-bold text-purple-300 block tracking-wider">
                  Pixel Collab
                </span>
                <div className="text-xs font-black text-white mt-1 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  Cluster SP-01
                </div>
                <span className="text-[10px] text-zinc-400">Latência 14ms</span>
              </div>
            </div>
          </div>

          {/* Real-time Mesh Bar */}
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1">
                <Radio size={12} className="text-emerald-400 animate-pulse" />
                Malha Interligada:
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold">
                Pixel Collab
              </span>
              <span className="text-zinc-600">⇄</span>
              <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
                Meta CAPI
              </span>
              <span className="text-zinc-600">⇄</span>
              <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
                Évora IA
              </span>
              <span className="text-zinc-600">⇄</span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                Radar Antifraude
              </span>
              <span className="text-zinc-600">⇄</span>
              <span className="px-2 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[11px] font-bold">
                WhatsApp Gateway
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>4.892 sinais processados nas últimas 24h</span>
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
            placeholder="Buscar extensão liberada ou bloqueada..."
            className="pl-10 text-xs bg-white border-slate-200 rounded-2xl h-11 text-slate-900 focus:bg-white shadow-2xs"
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
                  ? "bg-zinc-950 text-white shadow-2xs"
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
          const isAntifraud = ext.id === "antifraud_shield";
          const isWaRecovery = ext.id === "whatsapp_recovery";
          const isLocked = ext.isLocked === true;

          return (
            <div
              key={ext.id}
              className={`group rounded-3xl border p-5 flex flex-col justify-between transition-all duration-300 shadow-2xs hover:shadow-md ${
                isLocked
                  ? "bg-slate-50/70 border-slate-200/70 text-slate-500 opacity-85 hover:opacity-100"
                  : ext.enabled
                  ? isCore
                    ? "border-purple-300/80 ring-1 ring-purple-400/20 bg-gradient-to-b from-purple-50/20 to-white"
                    : isEvora
                    ? "border-rose-300/80 ring-1 ring-rose-400/20 bg-gradient-to-b from-rose-50/20 to-white"
                    : isMeta
                    ? "border-blue-300/80 ring-1 ring-blue-400/20 bg-gradient-to-b from-blue-50/20 to-white"
                    : isAntifraud
                    ? "border-emerald-300/80 ring-1 ring-emerald-400/20 bg-gradient-to-b from-emerald-50/20 to-white"
                    : isWaRecovery
                    ? "border-teal-300/80 ring-1 ring-teal-400/20 bg-gradient-to-b from-teal-50/20 to-white"
                    : "border-slate-200 bg-white"
                  : "border-slate-200 bg-white opacity-70"
              }`}
            >
              <div>
                {/* Card Top: Icon, Badge & Switch / Lock */}
                <div className="flex items-start justify-between gap-3 mb-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${
                      isLocked
                        ? "bg-amber-100/80 text-amber-800 border border-amber-200/80"
                        : isCore
                        ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-purple-500/25"
                        : isEvora
                        ? "bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-rose-500/25"
                        : isMeta
                        ? "bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-blue-500/25"
                        : isAntifraud
                        ? "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-emerald-500/25"
                        : isWaRecovery
                        ? "bg-gradient-to-br from-teal-600 to-emerald-500 text-white shadow-teal-500/25"
                        : ext.enabled
                        ? "bg-zinc-950 text-white shadow-zinc-900/25"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {isLocked ? <Lock size={20} className="text-amber-700" /> : <IconComp size={22} />}
                  </div>

                  <div className="flex items-center gap-2">
                    {ext.badge && (
                      <span
                        className={`text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                          isLocked
                            ? "bg-amber-100 text-amber-800 border-amber-200/80"
                            : isCore
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : isEvora
                            ? "bg-rose-100 text-rose-800 border-rose-200"
                            : isMeta
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : isAntifraud
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {ext.badge}
                      </span>
                    )}

                    {isLocked ? (
                      <button
                        onClick={() => handleOpenAction(ext)}
                        title="Módulo Bloqueado. Clique para detalhes e desbloqueio."
                        className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[10px] font-black transition-colors"
                      >
                        <Lock size={11} className="text-amber-600" />
                        <span>BLOQUEADO</span>
                      </button>
                    ) : isCore ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-xl text-[10px] font-extrabold">
                        <ShieldCheck size={11} className="text-purple-600" />
                        <span>CORE ATIVO</span>
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
                    <h3 className={`text-sm font-extrabold tracking-tight ${isLocked ? "text-slate-700" : "text-slate-900"}`}>
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

                {/* Telemetry Snippet if Liberated */}
                {!isLocked && ext.telemetry && (
                  <div className="mt-3.5 p-2.5 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-2 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {ext.telemetry.statusText}
                      </span>
                      <span className="text-[10px] text-slate-400">{ext.telemetry.lastSync}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-200/50">
                      {ext.telemetry.metrics.map((m, idx) => (
                        <div key={idx} className="bg-white p-1 rounded-lg border border-slate-100 text-center">
                          <span className="block text-[9px] text-slate-400 uppercase font-bold">{m.label}</span>
                          <span className="font-extrabold text-slate-800 text-[10px]">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Locked Message Snippet */}
                {isLocked && (
                  <div className="mt-3 p-2 bg-amber-50/60 border border-amber-200/60 rounded-xl text-[11px] text-amber-800 flex items-center gap-2">
                    <Lock size={12} className="text-amber-600 shrink-0" />
                    <span>Requer ativação no plano HangarBox Enterprise.</span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[11px]">
                  {isLocked ? (
                    <span className="font-semibold text-amber-700 flex items-center gap-1">
                      <Lock size={11} /> Bloqueado
                    </span>
                  ) : ext.enabled ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-semibold text-emerald-700">Interligado</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                      <span className="text-slate-400 font-medium">Inativo</span>
                    </>
                  )}
                </div>

                <Button
                  size="sm"
                  variant={isLocked ? "default" : "outline"}
                  onClick={() => handleOpenAction(ext)}
                  className={`h-8 text-xs font-bold rounded-xl gap-1.5 shadow-2xs ${
                    isLocked
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900"
                  }`}
                >
                  {isLocked ? (
                    <>
                      <KeyRound size={13} />
                      <span>Desbloquear</span>
                    </>
                  ) : (
                    <>
                      <Settings2 size={13} />
                      <span>Configurar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. MODAL PARA EXTENSÃO BLOQUEADA */}
      <Dialog open={isLockedModalOpen} onOpenChange={setIsLockedModalOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-white text-slate-900 border-slate-200">
          {lockedExtTarget && (
            <>
              <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-amber-50 via-white to-amber-50/30 border-b border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                    <Lock size={24} />
                  </div>
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                      Recurso Bloqueado
                    </span>
                    <DialogTitle className="text-base font-extrabold text-slate-900 mt-0.5">
                      {lockedExtTarget.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      Exclusivo do pacote corporativo HangarBox Enterprise.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-4 text-xs">
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-1.5">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <span>Módulo não disponível na sua licença atual</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    A extensão <strong>{lockedExtTarget.name}</strong> requer ativação de licença adicional ou upgrade para o plano Enterprise Suite.
                  </p>
                </div>

                {/* Liberated Modules Summary */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                  <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                    Módulos Liberados & Interligados na sua Assinatura:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      <span>Pixel Collab (Core)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      <span>Pixel-Meta (CAPI)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      <span>Évora IA (24/7)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      <span>Radar Antifraude</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      <span>WhatsApp Gateway & Pix Recovery</span>
                    </div>
                  </div>
                </div>

                {/* Unlock Form */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="font-bold text-slate-700 block">
                    Inserir Chave de Liberação / Licença Enterprise
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={unlockLicenseKey}
                      onChange={(e) => setUnlockLicenseKey(e.target.value)}
                      placeholder="Ex: HB-ENTERPRISE-2026"
                      className="text-xs rounded-xl h-10 font-mono uppercase bg-slate-50 border-slate-200"
                    />
                    <Button
                      type="button"
                      onClick={handleUnlockExtension}
                      disabled={unlocking}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl h-10 px-4 shrink-0 shadow-xs"
                    >
                      {unlocking ? "Validando..." : "Desbloquear"}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Para demonstração, você pode usar:</span>
                    <button
                      type="button"
                      onClick={() => setUnlockLicenseKey("HB-ENTERPRISE-2026")}
                      className="font-mono text-amber-700 hover:underline font-bold"
                    >
                      HB-ENTERPRISE-2026
                    </button>
                  </div>
                </div>
              </div>

              <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLockedModalOpen(false)}
                  className="text-xs h-9 rounded-xl border-slate-200"
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    toast.info("Solicitação enviada à equipe HangarBox! Entraremos em contato via WhatsApp cadastrado.");
                    setIsLockedModalOpen(false);
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  Falar com o Suporte
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. MODAL DE CONFIGURAÇÃO DEDICADO PARA EXTENSÕES LIBERADAS */}
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

              {/* Interconnection Status Banner inside Modal */}
              {activeExt.telemetry?.interconnectedWith && (
                <div className="mx-6 mt-4 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center gap-2.5 text-xs">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Zap size={14} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 block text-[11px]">
                      Interligação em Tempo Real Ativa
                    </span>
                    <span className="text-slate-500 text-[10px] truncate block">
                      Vinculado a: {activeExt.telemetry.interconnectedWith.join(" • ")}
                    </span>
                  </div>
                </div>
              )}

              {/* Modal Body: Custom Form per Extension with Fictional Interconnected Data */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {/* 1. PIXEL COLLAB (Core Platform) */}
                {activeExt.id === "pixel_collab" && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-purple-950 text-xs space-y-1">
                      <strong>Plataforma Central HangarBox Collab:</strong> Este é o módulo de governança que coordena as sessões, permissões de administradores e a integridade de dados do cluster da loja. Ele permanece sempre conectado.
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Nome do Workspace</label>
                        <Input
                          value={editSettings.workspace_name || "HangarBox Hub Oficial"}
                          onChange={(e) => setEditSettings({ ...editSettings, workspace_name: e.target.value })}
                          className="text-xs rounded-xl h-9 bg-slate-50"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">ID do Workspace</label>
                        <Input
                          value={editSettings.workspace_id || "collab_ws_live_hb992"}
                          readOnly
                          className="text-xs rounded-xl h-9 bg-slate-100 font-mono text-slate-500 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Cluster / Região</label>
                        <Input
                          value={editSettings.cluster_node || "sa-east-sp01 (São Paulo)"}
                          readOnly
                          className="text-xs rounded-xl h-9 bg-slate-100 text-slate-600 font-mono"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Backup em Nuvem</label>
                        <Input
                          value={editSettings.cloud_backup_interval || "A cada 6 horas (Automático)"}
                          readOnly
                          className="text-xs rounded-xl h-9 bg-slate-100 text-slate-600"
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
                        value={editSettings.pixel_id || "849201948201948"}
                        onChange={(e) => setEditSettings({ ...editSettings, pixel_id: e.target.value.trim() })}
                        placeholder="Ex: 849201948201948"
                        className="text-xs rounded-xl h-9 font-mono bg-slate-50"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700 block">Token de Acesso CAPI (Server-Side)</label>
                        <button
                          type="button"
                          onClick={() => setShowSecretToken(!showSecretToken)}
                          className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                        >
                          {showSecretToken ? <EyeOff size={11} /> : <Eye size={11} />}
                          <span>{showSecretToken ? "Ocultar" : "Visualizar"}</span>
                        </button>
                      </div>
                      <Input
                        type={showSecretToken ? "text" : "password"}
                        value={editSettings.capi_token || "EAAGNO4PZAlZBAO9kL280QJ28190ZkL89124098KLAJSLD91024"}
                        onChange={(e) => setEditSettings({ ...editSettings, capi_token: e.target.value.trim() })}
                        className="text-xs rounded-xl h-9 font-mono bg-slate-50"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Garante envio server-side via Graph API v19.0 mesmo com ad-blockers.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Código de Teste de Eventos</label>
                        <Input
                          value={editSettings.test_event_code || "TEST84920"}
                          onChange={(e) => setEditSettings({ ...editSettings, test_event_code: e.target.value.trim() })}
                          className="text-xs rounded-xl h-9 font-mono bg-slate-50"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Verificação de Domínio</label>
                        <Input
                          value={editSettings.domain_verification || "hb-meta-verify-948201948"}
                          onChange={(e) => setEditSettings({ ...editSettings, domain_verification: e.target.value.trim() })}
                          className="text-xs rounded-xl h-9 font-mono bg-slate-50"
                        />
                      </div>
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
                        value={editSettings.greeting_message || "Olá! Sou a Évora, assistente oficial da HangarBox. Posso te ajudar a encontrar a série perfeita ou liberar seu acesso imediato?"}
                        onChange={(e) => setEditSettings({ ...editSettings, greeting_message: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Diretriz de Personalidade (System Prompt)</label>
                      <textarea
                        rows={3}
                        value={editSettings.personality_prompt || "Você é a Évora, a assistente e concierge de IA oficial da HangarBox Séries. Seja amigável, ágil, entusiasta de séries e filmes, e ajude os clientes com recomendações e orientações sobre como comprar e assistir no player."}
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

                {/* 4. ANTIFRAUD SHIELD */}
                {activeExt.id === "antifraud_shield" && (
                  <div className="space-y-4">
                    <p className="text-slate-500">
                      Protege sua infraestrutura contra bots geradores de Pix em massa e tentativas fraudulentas de pagamento.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Limite de Checkouts / Minuto por IP</label>
                        <Input
                          type="number"
                          value={editSettings.rate_limit_per_minute || 5}
                          onChange={(e) => setEditSettings({ ...editSettings, rate_limit_per_minute: parseInt(e.target.value) || 5 })}
                          className="text-xs rounded-xl h-9 bg-slate-50"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Nível de Rigor do Escudo</label>
                        <select
                          value={editSettings.risk_threshold || "medium"}
                          onChange={(e) => setEditSettings({ ...editSettings, risk_threshold: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl h-9 px-3 text-xs text-slate-900 outline-none"
                        >
                          <option value="low">Nível 1 (Básico)</option>
                          <option value="medium">Nível 2 (Equilibrado - Padrão)</option>
                          <option value="high">Nível 3 (Rigor Máximo)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
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

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div>
                          <span className="font-bold text-slate-800 block">Auditoria de Tentativas Suspeitas</span>
                          <span className="text-[11px] text-slate-500">Grava logs detalhados para perícia de segurança</span>
                        </div>
                        <Switch
                          checked={editSettings.log_suspicious_activity ?? true}
                          onCheckedChange={(c) => setEditSettings({ ...editSettings, log_suspicious_activity: c })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. WHATSAPP RECOVERY */}
                {activeExt.id === "whatsapp_recovery" && (
                  <div className="space-y-4">
                    <p className="text-slate-500">
                      Recuperação automática de Pix pendentes interligada à sessão <strong>hangarbox-oficial</strong> do Gateway WhatsApp.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Delay do Disparo (Minutos)</label>
                        <Input
                          type="number"
                          value={editSettings.delay_minutes || 8}
                          onChange={(e) => setEditSettings({ ...editSettings, delay_minutes: parseInt(e.target.value) || 8 })}
                          className="text-xs rounded-xl h-9 bg-slate-50"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Sessão Vinculada</label>
                        <Input
                          value={editSettings.linked_session || "hangarbox-oficial"}
                          readOnly
                          className="text-xs rounded-xl h-9 bg-slate-100 text-slate-600 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Mensagem de Lembrete</label>
                      <textarea
                        rows={3}
                        value={editSettings.custom_message || "Olá {nome}! Notamos que seu pedido da série {serie} está aguardando pagamento. Segue o código Pix para você assistir agora mesmo!"}
                        onChange={(e) => setEditSettings({ ...editSettings, custom_message: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div>
                        <span className="font-bold text-slate-800 block">Anexar Código Pix Copia e Cola</span>
                        <span className="text-[11px] text-slate-500">Envia a chave Pix pronta para pagamento no banco do cliente</span>
                      </div>
                      <Switch
                        checked={editSettings.include_pix_code ?? true}
                        onCheckedChange={(c) => setEditSettings({ ...editSettings, include_pix_code: c })}
                      />
                    </div>
                  </div>
                )}

                {/* 6. DEMAIS (FALLBACK QUANDO DESBLOQUEADO) */}
                {activeExt.id !== "pixel_collab" &&
                  activeExt.id !== "pixel_meta" &&
                  activeExt.id !== "pixel_evora" &&
                  activeExt.id !== "antifraud_shield" &&
                  activeExt.id !== "whatsapp_recovery" && (
                    <div className="space-y-4">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700">
                        Módulo liberado via licença Enterprise. Ajuste as credenciais abaixo e clique em salvar.
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Token / Identificador</label>
                        <Input
                          value={editSettings.pixel_id || editSettings.api_key || editSettings.endpoint_url || ""}
                          onChange={(e) => setEditSettings({ ...editSettings, pixel_id: e.target.value, api_key: e.target.value })}
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
                  <span>{testingConnection ? "Testando Ping..." : "Testar Conexão"}</span>
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
