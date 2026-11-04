import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Send,
  AlertTriangle,
  Lock,
  Save,
  CheckCircle2,
  Navigation,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Shield,
  Loader2,
  Boxes,
} from "lucide-react";
import ExtensionsModule from "./ExtensionsModule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMaintenanceMode,
  saveMaintenanceMode,
  fetchNavTabs,
  saveNavTabs,
  DEFAULT_NAV_TABS,
  type NavTab,
} from "@/lib/api";

interface WhatsAppConfig {
  apiUrl: string;
  apiKey: string;
  sessionName: string;
  autoNotifyPurchase: boolean;
}

export const SettingsModule: React.FC = () => {
  // WhatsApp Gateway state
  const [waConfig, setWaConfig] = useState<WhatsAppConfig>({
    apiUrl: "",
    apiKey: "",
    sessionName: "default",
    autoNotifyPurchase: false,
  });
  const [savingWa, setSavingWa] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [sendingTestWa, setSendingTestWa] = useState(false);

  // Maintenance mode state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  // Change password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Nav tabs state
  const [navTabs, setNavTabs] = useState<NavTab[]>(DEFAULT_NAV_TABS);
  const [savingTabs, setSavingTabs] = useState(false);
  const [subTab, setSubTab] = useState<"extensions" | "whatsapp" | "navigation" | "security">("extensions");

  useEffect(() => {
    // Load WhatsApp settings
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "whatsapp_gateway")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") {
          setWaConfig(data.value as unknown as WhatsAppConfig);
        }
      });

    // Load maintenance settings
    fetchMaintenanceMode().then((cfg) => {
      setMaintenanceEnabled(cfg.enabled || false);
      setMaintenanceMessage(cfg.message || "Estamos em manutenção para melhorias. Voltamos em breve!");
    });

    // Load nav tabs
    fetchNavTabs().then((tabs) => setNavTabs(tabs));
  }, []);

  const handleSaveWhatsApp = async () => {
    setSavingWa(true);
    try {
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", "whatsapp_gateway")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("site_settings")
          .update({ value: waConfig as any })
          .eq("key", "whatsapp_gateway");
      } else {
        await supabase
          .from("site_settings")
          .insert({ key: "whatsapp_gateway", value: waConfig as any });
      }

      toast.success("Configurações do WhatsApp salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar dados do WhatsApp.");
    } finally {
      setSavingWa(false);
    }
  };

  const handleSendTestWhatsApp = async () => {
    const cleanPhone = testPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Informe um número de telefone com DDD válido.");
      return;
    }

    if (!waConfig.apiUrl) {
      toast.error("Configure a URL do Gateway do WhatsApp antes de testar.");
      return;
    }

    setSendingTestWa(true);
    try {
      const payload = {
        number: cleanPhone,
        message:
          "🎬 *Hangar Box — Teste de Notificação*\n\nSeu pedido foi confirmado! Este é um teste da automação de mensagens via WhatsApp.",
      };

      const res = await fetch(waConfig.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(waConfig.apiKey ? { Authorization: `Bearer ${waConfig.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Servidor respondeu com status ${res.status}`);
      }

      toast.success("Mensagem de teste enviada com sucesso!");
      setTestPhone("");
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar mensagem de teste.");
    } finally {
      setSendingTestWa(false);
    }
  };

  const handleSaveMaintenance = async () => {
    setSavingMaintenance(true);
    try {
      await saveMaintenanceMode({
        enabled: maintenanceEnabled,
        message: maintenanceMessage,
      });
      toast.success(
        maintenanceEnabled
          ? "Modo Manutenção ATIVADO para visitantes comuns."
          : "Modo Manutenção DESATIVADO. Loja aberta ao público."
      );
    } catch {
      toast.error("Erro ao alterar modo manutenção.");
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setChangingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar senha.");
    } finally {
      setChangingPass(false);
    }
  };

  const handleSaveNavTabs = async () => {
    setSavingTabs(true);
    try {
      await saveNavTabs(navTabs);
      toast.success("Abas de navegação do site atualizadas!");
    } catch {
      toast.error("Erro ao salvar abas.");
    } finally {
      setSavingTabs(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl">
      {/* Sub-navigation Header */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 border border-slate-200/80 rounded-2xl w-max max-w-full overflow-x-auto scrollbar-none shadow-xs">
        <button
          type="button"
          onClick={() => setSubTab("extensions")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all ${
            subTab === "extensions"
              ? "bg-zinc-950 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Boxes size={15} />
          <span>Extensões & Apps</span>
          <span className="text-[9px] bg-rose-500 text-white font-extrabold px-1.5 py-0.2 rounded-full">
            HUB
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("whatsapp")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all ${
            subTab === "whatsapp"
              ? "bg-zinc-950 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <MessageSquare size={15} />
          <span>WhatsApp Gateway</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("navigation")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all ${
            subTab === "navigation"
              ? "bg-zinc-950 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Navigation size={15} />
          <span>Abas de Navegação</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("security")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight transition-all ${
            subTab === "security"
              ? "bg-zinc-950 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
          }`}
        >
          <Shield size={15} />
          <span>Segurança & Manutenção</span>
        </button>
      </div>

      {/* Subtab 1: Extensões & Apps */}
      {subTab === "extensions" && <ExtensionsModule />}

      {/* Subtab 2: WhatsApp Gateway */}
      {subTab === "whatsapp" && (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <MessageSquare size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Gateway de Mensagens WhatsApp
            </h3>
            <p className="text-xs text-slate-500">
              Notifique clientes instantaneamente após a aprovação do Pix com o link de acesso.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-700 font-medium block mb-1">
              URL da API do Gateway
            </label>
            <Input
              value={waConfig.apiUrl}
              onChange={(e) => setWaConfig({ ...waConfig, apiUrl: e.target.value.trim() })}
              placeholder="https://api.seugateway.com/send-message"
              className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white rounded-xl h-10 text-xs"
            />
          </div>

          <div>
            <label className="text-slate-700 font-medium block mb-1">
              API Key / Bearer Token
            </label>
            <Input
              type="password"
              value={waConfig.apiKey}
              onChange={(e) => setWaConfig({ ...waConfig, apiKey: e.target.value.trim() })}
              placeholder="••••••••••••••••"
              className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white rounded-xl h-10 text-xs"
            />
          </div>

          <div>
            <label className="text-slate-700 font-medium block mb-1">
              Nome da Sessão / Device
            </label>
            <Input
              value={waConfig.sessionName}
              onChange={(e) => setWaConfig({ ...waConfig, sessionName: e.target.value })}
              placeholder="default"
              className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white rounded-xl h-10 text-xs"
            />
          </div>

          <div className="flex items-center gap-3 pt-6">
            <Switch
              checked={waConfig.autoNotifyPurchase}
              onCheckedChange={(checked) =>
                setWaConfig({ ...waConfig, autoNotifyPurchase: checked })
              }
            />
            <span className="text-xs text-slate-700 font-medium">
              Disparar confirmação automática ao aprovar pedido
            </span>
          </div>
        </div>

        <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
          <Button
            disabled={savingWa}
            onClick={handleSaveWhatsApp}
            className="bg-gradient-to-r from-[#7B3FE4] via-[#6C2BD9] to-[#5B21B6] hover:brightness-110 text-white font-bold rounded-xl text-xs h-9 gap-1.5 shadow-xs transition-all"
          >
            <Save size={14} />
            <span>{savingWa ? "Salvando..." : "Salvar Configuração"}</span>
          </Button>

          {/* Test area */}
          <div className="flex items-center gap-2">
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="DDD + Número (ex: 11999999999)"
              className="w-48 bg-slate-50 border-slate-200 text-slate-900 focus:bg-white text-xs rounded-xl h-9"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={sendingTestWa}
              onClick={handleSendTestWhatsApp}
              className="border-slate-200 bg-white hover:bg-emerald-50 text-emerald-700 border text-xs h-9 gap-1 rounded-xl shadow-xs"
            >
              <Send size={13} />
              <span>{sendingTestWa ? "Enviando..." : "Testar Disparo"}</span>
            </Button>
          </div>
        </div>
      </div>
    )}

      {/* Subtab 4 part A: Global Maintenance Mode */}
      {subTab === "security" && (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Modo Manutenção</h3>
              <p className="text-xs text-slate-500">
                Bloqueia a vitrine para compradores comuns enquanto você realiza atualizações. Administradores continuam acessando normalmente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={maintenanceEnabled}
              onCheckedChange={setMaintenanceEnabled}
            />
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                maintenanceEnabled
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {maintenanceEnabled ? "ATIVO" : "INATIVO"}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <label className="text-slate-700 font-medium block">
            Mensagem exibida para os visitantes
          </label>
          <Input
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            placeholder="Estamos atualizando nosso catálogo. Voltamos em alguns minutos!"
            className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white rounded-xl h-10 text-xs"
          />
        </div>

        <Button
          disabled={savingMaintenance}
          onClick={handleSaveMaintenance}
          className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs h-9 gap-1.5 shadow-sm"
        >
          <Save size={14} />
          <span>{savingMaintenance ? "Salvando..." : "Salvar Modo Manutenção"}</span>
        </Button>
      </div>
    )}

      {/* Subtab 3: Navigation Tabs Manager */}
      {subTab === "navigation" && (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
            <Navigation size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Abas do Menu Principal</h3>
            <p className="text-xs text-slate-500">
              Personalize os botões e categorias do topo da loja virtual.
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          {navTabs.map((tab, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl shadow-2xs"
            >
              <Input
                value={tab.label}
                onChange={(e) => {
                  const copy = [...navTabs];
                  copy[idx].label = e.target.value;
                  setNavTabs(copy);
                }}
                placeholder="Rótulo da Aba"
                className="w-32 bg-white border-slate-200 text-slate-900 rounded-lg h-8 text-xs font-medium"
              />
              <Input
                value={tab.filterCategory}
                onChange={(e) => {
                  const copy = [...navTabs];
                  copy[idx].filterCategory = e.target.value;
                  setNavTabs(copy);
                }}
                placeholder="Categoria (vazio = Todas)"
                className="flex-1 bg-white border-slate-200 text-slate-900 rounded-lg h-8 text-xs"
              />
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={idx === 0}
                  onClick={() => {
                    const copy = [...navTabs];
                    [copy[idx], copy[idx - 1]] = [copy[idx - 1], copy[idx]];
                    setNavTabs(copy);
                  }}
                  className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60"
                >
                  <ArrowUp size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={idx === navTabs.length - 1}
                  onClick={() => {
                    const copy = [...navTabs];
                    [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
                    setNavTabs(copy);
                  }}
                  className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60"
                >
                  <ArrowDown size={13} />
                </Button>
                {idx > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNavTabs(navTabs.filter((_, i) => i !== idx))}
                    className="h-8 w-8 p-0 text-rose-600 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 size={13} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setNavTabs([
                ...navTabs,
                { label: "Nova Aba", filterCategory: "", isExclusive: false },
              ])
            }
            className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs h-9 shadow-xs"
          >
            <Plus size={14} className="mr-1" />
            Adicionar Aba
          </Button>

          <Button
            disabled={savingTabs}
            onClick={handleSaveNavTabs}
            className="bg-gradient-to-r from-[#7B3FE4] via-[#6C2BD9] to-[#5B21B6] hover:brightness-110 text-white font-bold rounded-xl text-xs h-9 gap-1.5 shadow-xs transition-all"
          >
            <Save size={14} />
            <span>{savingTabs ? "Salvando..." : "Salvar Abas"}</span>
          </Button>
        </div>
      </div>
    )}

      {/* Subtab 4 part B: Security & Password Change */}
      {subTab === "security" && (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <Lock size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Segurança da Conta Administrativa</h3>
            <p className="text-xs text-slate-500">
              Altere a senha de acesso da sua conta de administrador.
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md text-xs">
          <div>
            <label className="text-slate-700 font-medium block mb-1">
              Nova Senha (mínimo 6 caracteres)
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white rounded-xl h-10 text-xs"
            />
          </div>

          <div>
            <label className="text-slate-700 font-medium block mb-1">
              Confirme a Nova Senha
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="bg-slate-50 border-slate-200 text-slate-900 focus:bg-white rounded-xl h-10 text-xs"
            />
          </div>

          <Button
            type="submit"
            disabled={changingPass}
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs h-9 gap-1.5 shadow-sm"
          >
            {changingPass ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Shield size={14} />
            )}
            <span>{changingPass ? "Atualizando..." : "Atualizar Senha"}</span>
          </Button>
        </form>
        </div>
      )}
    </div>
  );
};

export default SettingsModule;
