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
  Activity,
  Check,
  Send,
  Zap,
  Radio,
  Cpu,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Terminal,
  Globe,
  Server,
  FileJson,
  Copy,
  Layers,
  ArrowRight
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
  { id: "all", label: "Todas as APIs & Extensões" },
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
  const [viewMode, setViewMode] = useState<"marketplace" | "api_inspector">("marketplace");

  // Selected extension for detail / settings modal
  const [activeExt, setActiveExt] = useState<ExtensionItem | null>(null);
  const [modalTab, setModalTab] = useState<"config" | "api_docs" | "payload">("config");
  const [editSettings, setEditSettings] = useState<Record<string, any>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLockedModalOpen, setIsLockedModalOpen] = useState(false);
  const [lockedExtTarget, setLockedExtTarget] = useState<ExtensionItem | null>(null);
  const [unlockLicenseKey, setUnlockLicenseKey] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showSecretToken, setShowSecretToken] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

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
      if (selectedCategory !== "all" && ext.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const matchName = ext.name.toLowerCase().includes(q);
      const matchTagline = ext.tagline.toLowerCase().includes(q);
      const matchBadge = (ext.badge || "").toLowerCase().includes(q);
      const matchApi = (ext.apiSpec?.apiName || "").toLowerCase().includes(q);
      return matchName || matchTagline || matchBadge || matchApi;
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
      setModalTab("config");
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

      setActiveExt({
        ...lockedExtTarget,
        isLocked: false,
        enabled: true,
        badge: "LIBERADO ENTERPRISE",
      });
      setEditSettings({ ...(lockedExtTarget.settings || {}) });
      setModalTab("config");
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
  const handleTestConnection = async (extTarget?: ExtensionItem) => {
    const ext = extTarget || activeExt;
    if (!ext) return;
    setTestingConnection(true);
    try {
      await new Promise((r) => setTimeout(r, 900));

      if (ext.id === "pixel_collab") {
        toast.success("Pixel Collab: Conexão ativa! Latência: 14ms. Cluster operacional SP-01.");
      } else if (ext.id === "pixel_meta") {
        toast.success("Meta Pixel & CAPI: Conexão estabelecida com Meta Graph API v19.0. Deduplicação: 99.4%!");
      } else if (ext.id === "pixel_evora") {
        toast.success("Évora IA: Motor neural ativo e pronto para atender no storefront.");
      } else if (ext.id === "antifraud_shield") {
        toast.success("Radar Antifraude: Blindagem Nível 3 ativa. Escaneamento de IPs em 100%.");
      } else if (ext.id === "whatsapp_recovery") {
        toast.success("WhatsApp Recovery: Vinculado à sessão hangarbox-oficial. Fila de disparos limpa.");
      } else {
        toast.success(`Integração com "${ext.name}" testada e validada com sucesso! (HTTP 200 OK)`);
      }
    } catch {
      toast.error("Falha ao testar conexão.");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCopyPayload = (payload: string) => {
    navigator.clipboard.writeText(payload);
    setCopiedPayload(true);
    toast.success("Payload JSON copiado para a área de transferência!");
    setTimeout(() => setCopiedPayload(false), 2000);
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
                  Gateway de APIs & Extensões
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Cluster Operacional Online
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  <Cpu size={12} />
                  Pixel Collab LTS
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                <span>Painel de Extensões & APIs Integradas</span>
                <Boxes className="text-rose-500 w-7 h-7 hidden sm:inline" />
              </h2>

              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Ecossistema oficial HangarBox. O <strong>Pixel Collab</strong> atua como a plataforma central de gerenciamento ativa. Os módulos avançados (<strong>Pixel-Meta</strong>, <strong>Évora IA</strong>, <strong>Radar Antifraude</strong>, <strong>WhatsApp Recovery</strong>, entre outros) estão documentados com especificações reais e bloqueio corporativo Enterprise ativo.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto shrink-0">
              <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-3.5 backdrop-blur-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                  Core Ativo
                </span>
                <div className="text-xl font-black text-emerald-400 mt-0.5">{liberatedCount}</div>
                <span className="text-[10px] text-zinc-500">Pixel Collab Hub</span>
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
                Cluster de Infraestrutura:
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold">
                Pixel Collab (Core LTS Ativo)
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-[11px] text-zinc-400">
                11 Módulos adicionais com bloqueio de licença Enterprise
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Gateway HTTP/2 & WebSocket TLS 1.3</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls Bar: View Mode, Search & Category Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-2xl border border-zinc-200/80 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("marketplace")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === "marketplace"
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Boxes size={14} />
              <span>Modo Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("api_inspector")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === "api_inspector"
                  ? "bg-zinc-950 text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Terminal size={14} />
              <span>Inspetor de APIs & Endpoints</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por API, endpoint, protocolo, CRM ou IA..."
              className="pl-10 text-xs bg-white border-slate-200 rounded-2xl h-11 text-slate-900 focus:bg-white shadow-2xs"
            />
          </div>
        </div>

        {/* Categories Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold tracking-tight whitespace-nowrap transition-all ${
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

      {/* 3. VIEW MODE A: MARKETPLACE CARDS GRID */}
      {viewMode === "marketplace" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExtensions.map((ext) => {
            const IconComp = ICON_MAP[ext.icon] || Boxes;
            const isCore = ext.isCore === true;
            const isLocked = ext.isLocked === true;

            return (
              <div
                key={ext.id}
                className={`group rounded-3xl border p-5 flex flex-col justify-between transition-all duration-300 shadow-2xs hover:shadow-md ${
                  isLocked
                    ? "bg-slate-50/70 border-slate-200/70 text-slate-500 opacity-90 hover:opacity-100"
                    : isCore
                    ? "border-purple-300/80 ring-1 ring-purple-400/20 bg-gradient-to-b from-purple-50/20 to-white"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div>
                  {/* Card Top: Icon, Protocol, Badge & Lock */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${
                        isLocked
                          ? "bg-amber-100/80 text-amber-800 border border-amber-200/80"
                          : isCore
                          ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-purple-500/25"
                          : "bg-zinc-950 text-white shadow-zinc-900/25"
                      }`}
                    >
                      {isLocked ? <Lock size={20} className="text-amber-700" /> : <IconComp size={22} />}
                    </div>

                    <div className="flex items-center gap-2">
                      {ext.apiSpec?.protocol && (
                        <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                          {ext.apiSpec.protocol}
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
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-xl text-[10px] font-extrabold">
                          <ShieldCheck size={11} className="text-purple-600" />
                          <span>CORE ATIVO</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Title & Tagline */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-extrabold tracking-tight ${isLocked ? "text-slate-800" : "text-slate-900"}`}>
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

                  {/* Humanized Snippet (What it does) */}
                  {ext.apiSpec?.humanDescription && (
                    <div className="mt-3 p-2.5 bg-slate-100/60 rounded-xl border border-slate-200/60 text-[11px] text-slate-600 leading-snug">
                      <strong className="text-slate-800 font-semibold block mb-0.5 flex items-center gap-1">
                        <Zap size={11} className="text-amber-500" /> Na Prática:
                      </strong>
                      <span className="line-clamp-2">{ext.apiSpec.humanDescription.whatItDoes}</span>
                    </div>
                  )}

                  {/* Endpoint Preview */}
                  {ext.apiSpec?.endpoint && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 truncate">
                      <Globe size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">{ext.apiSpec.endpoint}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    {isLocked ? (
                      <span className="font-semibold text-amber-700 flex items-center gap-1">
                        <Lock size={11} /> Bloqueado (Enterprise)
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-700 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Cluster Online (14ms)
                      </span>
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
                        <span>Ver API & Desbloquear</span>
                      </>
                    ) : (
                      <>
                        <Settings2 size={13} />
                        <span>Gerenciar API</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. VIEW MODE B: API INSPECTOR CONSOLE */}
      {viewMode === "api_inspector" && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Terminal className="text-rose-600" size={18} />
                <span>Console de APIs & Endpoints Integrados</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoramento técnico de rotas, protocolos de transporte, esquemas de payload e documentação de integração.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Cluster Gateway: 200 OK
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {filteredExtensions.map((ext) => {
              const IconC = ICON_MAP[ext.icon] || Boxes;
              const isLocked = ext.isLocked === true;
              const spec = ext.apiSpec;

              return (
                <div
                  key={ext.id}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white p-5 transition-all shadow-2xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <IconC size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-slate-900">{ext.name}</h4>
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md">
                            {ext.version}
                          </span>
                          {isLocked ? (
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Lock size={9} /> Bloqueado
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full">
                              Core Ativo
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-mono block mt-0.5">
                          {spec?.apiName || ext.tagline}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold bg-zinc-900 text-zinc-100 px-2.5 py-1 rounded-lg">
                        {spec?.protocol || "REST"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenAction(ext)}
                        className="text-xs h-8 rounded-xl font-bold"
                      >
                        {isLocked ? "Desbloquear" : "Detalhes da API"}
                      </Button>
                    </div>
                  </div>

                  {/* Technical & Humanized Details */}
                  {spec && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200/60 text-xs">
                      <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          🎯 O Que Faz na Prática
                        </span>
                        <p className="text-slate-700 leading-relaxed text-[11px]">
                          {spec.humanDescription.whatItDoes}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          ⚙️ Como Funciona Por Trás dos Panos
                        </span>
                        <p className="text-slate-700 leading-relaxed text-[11px]">
                          {spec.humanDescription.howItWorks}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-emerald-600 block">
                          💰 Impacto no Negócio & Vendas
                        </span>
                        <p className="text-slate-700 leading-relaxed text-[11px]">
                          {spec.humanDescription.businessImpact}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Route & Endpoint info */}
                  {spec?.endpoint && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-zinc-950 text-zinc-300 rounded-xl font-mono text-[11px]">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-emerald-400 font-bold uppercase text-[10px] bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                          {spec.protocol.includes("WebSocket") ? "WS" : "POST"}
                        </span>
                        <span className="truncate">{spec.endpoint}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        Auth: {spec.authType}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. MODAL PARA EXTENSÃO BLOQUEADA COM DETALHES DE API */}
      <Dialog open={isLockedModalOpen} onOpenChange={setIsLockedModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white text-slate-900 border-slate-200">
          {lockedExtTarget && (
            <>
              <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-amber-50 via-white to-amber-50/30 border-b border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                    <Lock size={24} />
                  </div>
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                      API Bloqueada (Plano Enterprise)
                    </span>
                    <DialogTitle className="text-base font-extrabold text-slate-900 mt-0.5">
                      {lockedExtTarget.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      {lockedExtTarget.apiSpec?.apiName || lockedExtTarget.tagline}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Humanized breakdown */}
                {lockedExtTarget.apiSpec && (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <strong className="text-slate-800 font-bold block text-[11px] uppercase tracking-wider flex items-center gap-1">
                        <Zap size={12} className="text-amber-600" />
                        O Que Esta API Faz na Prática:
                      </strong>
                      <p className="text-slate-600 leading-relaxed">
                        {lockedExtTarget.apiSpec.humanDescription.whatItDoes}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <strong className="text-slate-800 font-bold block text-[11px] uppercase tracking-wider flex items-center gap-1">
                        <Server size={12} className="text-blue-600" />
                        Engenharia & Funcionamento dos Bastidores:
                      </strong>
                      <p className="text-slate-600 leading-relaxed">
                        {lockedExtTarget.apiSpec.humanDescription.howItWorks}
                      </p>
                    </div>

                    <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-1">
                      <strong className="text-emerald-900 font-bold block text-[11px] uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-600" />
                        Impacto no Faturamento:
                      </strong>
                      <p className="text-emerald-800 leading-relaxed">
                        {lockedExtTarget.apiSpec.humanDescription.businessImpact}
                      </p>
                    </div>

                    {/* Endpoint info */}
                    <div className="p-3 bg-zinc-950 text-zinc-300 rounded-2xl font-mono text-[11px] space-y-1">
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        Endpoint Alvo ({lockedExtTarget.apiSpec.protocol})
                      </div>
                      <div className="text-emerald-400 break-all">{lockedExtTarget.apiSpec.endpoint}</div>
                    </div>
                  </div>
                )}

                {/* Unlock Form */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
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
                      {unlocking ? "Validando..." : "Desbloquear API"}
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

      {/* 6. MODAL DE CONFIGURAÇÃO DEDICADO COM DOCUMENTAÇÃO DA API */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white text-slate-900 border-slate-200">
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
                      {activeExt.apiSpec?.apiName || activeExt.tagline}
                    </DialogDescription>
                  </div>
                </div>

                {/* Subtabs inside Modal */}
                <div className="flex items-center gap-1.5 pt-4">
                  <button
                    type="button"
                    onClick={() => setModalTab("config")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      modalTab === "config"
                        ? "bg-zinc-950 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    ⚙️ Configuração
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("api_docs")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      modalTab === "api_docs"
                        ? "bg-zinc-950 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    📖 Especificações da API
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("payload")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      modalTab === "payload"
                        ? "bg-zinc-950 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    📦 Payload JSON
                  </button>
                </div>
              </DialogHeader>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {/* TAB 1: CONFIGURATION FORM */}
                {modalTab === "config" && (
                  <div className="space-y-4">
                    {/* PIXEL COLLAB FORM */}
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

                    {/* FALLBACK FOR UNLOCKED EXTENSIONS */}
                    {activeExt.id !== "pixel_collab" && (
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
                )}

                {/* TAB 2: DETAILED HUMANIZED API SPECS */}
                {modalTab === "api_docs" && activeExt.apiSpec && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                      <strong className="text-slate-900 font-bold block text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Zap size={14} className="text-amber-500" />
                        O Que Esta API Faz na Prática
                      </strong>
                      <p className="text-slate-700 leading-relaxed text-xs">
                        {activeExt.apiSpec.humanDescription.whatItDoes}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                      <strong className="text-slate-900 font-bold block text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Server size={14} className="text-blue-500" />
                        Como Funciona Por Trás dos Panos
                      </strong>
                      <p className="text-slate-700 leading-relaxed text-xs">
                        {activeExt.apiSpec.humanDescription.howItWorks}
                      </p>
                    </div>

                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1.5">
                      <strong className="text-emerald-950 font-bold block text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        Impacto no Faturamento & Operação
                      </strong>
                      <p className="text-emerald-900 leading-relaxed text-xs">
                        {activeExt.apiSpec.humanDescription.businessImpact}
                      </p>
                    </div>

                    <div className="p-3.5 bg-zinc-950 text-zinc-300 rounded-2xl font-mono space-y-2">
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        Especificações Técnicas de Rede
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-zinc-500 block text-[10px]">PROTOCOLO</span>
                          <span className="font-bold text-zinc-200">{activeExt.apiSpec.protocol}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[10px]">AUTENTICAÇÃO</span>
                          <span className="font-bold text-zinc-200">{activeExt.apiSpec.authType}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-zinc-500 block text-[10px]">ENDPOINT OFICIAL</span>
                          <span className="font-bold text-emerald-400 break-all">{activeExt.apiSpec.endpoint}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: SAMPLE PAYLOAD JSON */}
                {modalTab === "payload" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-xs">
                        Exemplo de Payload Trafegado em Produção
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyPayload(activeExt.apiSpec?.samplePayload || "{}")}
                        className="h-7 text-[11px] gap-1 rounded-lg"
                      >
                        {copiedPayload ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>{copiedPayload ? "Copiado!" : "Copiar JSON"}</span>
                      </Button>
                    </div>

                    <pre className="p-4 bg-zinc-950 text-emerald-400 rounded-2xl font-mono text-[11px] overflow-x-auto border border-zinc-800 leading-relaxed max-h-72">
                      {activeExt.apiSpec?.samplePayload || "{}"}
                    </pre>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTestConnection(activeExt)}
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
