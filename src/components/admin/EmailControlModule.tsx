import React, { useState, useMemo } from "react";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  Search,
  Download,
  RotateCw,
  ExternalLink,
  Copy,
  Check,
  Eye,
  ShieldCheck,
  Sparkles,
  Inbox,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { DbOrder } from "@/lib/api";
import { resendOrderEmail, sendTestAdminEmail } from "@/lib/api";
import {
  PLATFORM_LIMITS,
  canSendEmail,
  EMAIL_BILLING_RATE_BRL,
  calculateEmailBilling,
  calculateOrderNet,
} from "@/lib/limits";
import { AnimatedCountUp } from "./AnimatedCountUp";

interface EmailControlModuleProps {
  orders: DbOrder[];
  onRefreshOrders?: () => void;
}

const formatBRL = (value: number) => {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDateBR = (isoString?: string | null) => {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
};

export const EmailControlModule: React.FC<EmailControlModuleProps> = ({
  orders,
  onRefreshOrders,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");

  // Selected Order for Email Preview Modal
  const [previewOrder, setPreviewOrder] = useState<DbOrder | null>(null);

  // Reenviar email loading state map
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Test Email Modal
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  // Batch Resend Since 18/10 Modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchMode, setBatchMode] = useState<"pending" | "all">("pending");
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentEmail?: string }>({ current: 0, total: 0 });
  const [batchLogs, setBatchLogs] = useState<{ id: string; email: string; success: boolean; message: string }[]>([]);

  // Copied link state
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Filtered orders list
  // Vendas desde 18/10/2026
  const ordersSince18 = useMemo(() => {
    return orders.filter((o) => {
      if (o.status !== "pago") return false;
      const d = o.created_at || o.updated_at;
      if (!d) return false;
      return d >= "2026-10-18T00:00:00" || d.includes("2026-10-18") || d.includes("2026-10-19") || d.includes("2026-10-20") || d.includes("2026-10-21") || d.includes("2026-10-22");
    });
  }, [orders]);

  const pendingSince18 = useMemo(() => {
    return ordersSince18.filter((o) => !o.email_sent_at || o.email_status !== "enviado");
  }, [ordersSince18]);

  const batchTargetOrders = batchMode === "pending" ? pendingSince18 : ordersSince18;

  const handleStartBatchResend = async () => {
    if (batchTargetOrders.length === 0) {
      toast.info("Nenhum pedido selecionado para reenvio.");
      return;
    }

    setIsBatchRunning(true);
    setBatchLogs([]);
    setBatchProgress({ current: 0, total: batchTargetOrders.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < batchTargetOrders.length; i++) {
      const order = batchTargetOrders[i];
      setBatchProgress({
        current: i + 1,
        total: batchTargetOrders.length,
        currentEmail: order.user_email,
      });

      try {
        await resendOrderEmail(order.id, order);
        successCount++;
        setBatchLogs((prev) => [
          ...prev,
          {
            id: order.id,
            email: order.user_email,
            success: true,
            message: "Enviado com sucesso via noreply@hangarboxx.com.br",
          },
        ]);
      } catch (err: any) {
        failCount++;
        setBatchLogs((prev) => [
          ...prev,
          {
            id: order.id,
            email: order.user_email,
            success: false,
            message: err?.message || "Falha no envio",
          },
        ]);
      }

      await new Promise((r) => setTimeout(r, 600));
    }

    setIsBatchRunning(false);
    if (successCount > 0) {
      toast.success(`${successCount} e-mail(s) de confirmação reenviado(s) com sucesso!`);
      if (onRefreshOrders) onRefreshOrders();
    }
    if (failCount > 0) {
      toast.error(`${failCount} e-mail(s) apresentaram instabilidade no envio.`);
    }
  };

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    return orders.filter((o) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        o.id.toLowerCase().includes(q) ||
        o.user_email.toLowerCase().includes(q) ||
        (o.user_name || "").toLowerCase().includes(q) ||
        JSON.stringify(o.items || "").toLowerCase().includes(q);

      // Email status logic
      const isSent = o.email_status === "enviado" || !!o.email_sent_at;
      const isFailed = o.email_status === "falhou";
      const isPending = !isSent && !isFailed;

      let matchStatus = true;
      if (statusFilter === "enviado") matchStatus = isSent;
      else if (statusFilter === "pendente") matchStatus = isPending;
      else if (statusFilter === "falhou") matchStatus = isFailed;

      // Period filter
      let matchPeriod = true;
      if (periodFilter === "today") {
        matchPeriod = (o.email_sent_at || o.created_at).startsWith(todayStr);
      } else if (periodFilter === "month") {
        matchPeriod = (o.email_sent_at || o.created_at).startsWith(currentMonth);
      }

      return matchSearch && matchStatus && matchPeriod;
    });
  }, [orders, search, statusFilter, periodFilter]);

  // Comprehensive Metrics Calculation
  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const todayStr = now.toISOString().slice(0, 10);

    const paidOrders = orders.filter((o) => o.status === "pago");
    const sentOrders = orders.filter(
      (o) => o.email_status === "enviado" || !!o.email_sent_at
    );
    const failedOrders = orders.filter((o) => o.email_status === "falhou");
    const pendingPaidOrders = paidOrders.filter(
      (o) => !o.email_sent_at && o.email_status !== "enviado"
    );

    const monthSentOrders = sentOrders.filter((o) =>
      (o.email_sent_at || o.created_at).startsWith(currentMonth)
    );
    const todaySentOrders = sentOrders.filter((o) =>
      (o.email_sent_at || o.created_at).startsWith(todayStr)
    );

    // Sums in BRL
    const totalDeliveredValue = sentOrders.reduce(
      (acc, o) => acc + Number(o.total || 0),
      0
    );
    const totalPendingValue = pendingPaidOrders.reduce(
      (acc, o) => acc + Number(o.total || 0),
      0
    );
    const averageEmailValue =
      sentOrders.length > 0 ? totalDeliveredValue / sentOrders.length : 0;

    // Delivery rate %
    const deliveryRate =
      paidOrders.length > 0
        ? ((sentOrders.length / paidOrders.length) * 100).toFixed(1)
        : "100";

    // Email Billing (R$ 0,15 per email sent)
    const totalEmailCost = calculateEmailBilling(sentOrders.length);
    const monthEmailCost = calculateEmailBilling(monthSentOrders.length);
    const todayEmailCost = calculateEmailBilling(todaySentOrders.length);

    // Net revenue delivered (Gross minus email costs)
    const netDeliveredRevenue = Math.max(0, totalDeliveredValue - totalEmailCost);

    // PixelGateWay Monthly Quota
    const monthlyLimit = PLATFORM_LIMITS.MONTHLY_EMAIL_MAX;
    const quotaUsedPercent = Math.min(
      100,
      (sentOrders.length / monthlyLimit) * 100
    );

    return {
      sentCount: sentOrders.length,
      paidCount: paidOrders.length,
      failedCount: failedOrders.length,
      pendingCount: pendingPaidOrders.length,
      monthSentCount: monthSentOrders.length,
      todaySentCount: todaySentOrders.length,
      totalDeliveredValue,
      totalPendingValue,
      averageEmailValue,
      deliveryRate,
      totalEmailCost,
      monthEmailCost,
      todayEmailCost,
      netDeliveredRevenue,
      monthlyLimit,
      quotaUsedPercent,
    };
  }, [orders]);

  const handleResend = async (order: DbOrder) => {
    const check = canSendEmail(metrics.sentCount);
    if (!check.allowed) {
      toast.error(check.message);
      return;
    }

    setResendingId(order.id);
    try {
      await resendOrderEmail(order.id);
      toast.success(`E-mail com os links reenviado para ${order.user_email}!`);
      if (onRefreshOrders) onRefreshOrders();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao reenviar e-mail de acesso.");
    } finally {
      setResendingId(null);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailRecipient || !testEmailRecipient.includes("@")) {
      toast.error("Por favor, insira um e-mail válido para o teste.");
      return;
    }

    const check = canSendEmail(metrics.sentCount);
    if (!check.allowed) {
      toast.error(check.message);
      return;
    }

    setSendingTest(true);
    try {
      const res = await sendTestAdminEmail(testEmailRecipient.trim());
      if (res.success) {
        toast.success(res.message);
        setIsTestModalOpen(false);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao disparar e-mail de teste.");
    } finally {
      setSendingTest(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(text);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }

    const headers = [
      "ID Pedido",
      "Cliente",
      "Email Destinatário",
      "Valor Bruto (R$)",
      "Tarifa Envio Email (R$)",
      "Valor Líquido Pedido (R$)",
      "Status Pagamento",
      "Status Envio Email",
      "Data Envio Email",
      "Data Criação Pedido",
      "Produtos Entregues",
    ];

    const rows = filteredOrders.map((o) => {
      const isSent = o.email_status === "enviado" || !!o.email_sent_at;
      const statusLabel = isSent
        ? "Enviado"
        : o.email_status === "falhou"
        ? "Falhou"
        : "Pendente";
      const itemsList = Array.isArray(o.items)
        ? o.items.map((i: any) => `${i.titulo || "Série"} (${i.link_acesso || ""})`).join(" | ")
        : "";
      const emailFee = isSent ? EMAIL_BILLING_RATE_BRL : 0;
      const netVal = calculateOrderNet(Number(o.total || 0), isSent);

      return [
        o.id,
        `"${o.user_name || "Cliente"}"`,
        `"${o.user_email}"`,
        Number(o.total || 0).toFixed(2),
        emailFee.toFixed(2),
        netVal.toFixed(2),
        o.status,
        statusLabel,
        `"${formatDateBR(o.email_sent_at)}"`,
        `"${formatDateBR(o.created_at)}"`,
        `"${itemsList.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `disparos_email_hangarbox_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Relatório de e-mails exportado com sucesso!");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Quota Exhaustion Alert if reached */}
      {metrics.sentCount >= PLATFORM_LIMITS.MONTHLY_EMAIL_MAX && (
        <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-medium shadow-xs">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <span>
            <strong>Cota Mensal de E-mails Atingida ({PLATFORM_LIMITS.MONTHLY_EMAIL_MAX}/{PLATFORM_LIMITS.MONTHLY_EMAIL_MAX}):</strong> O limite mensal do PixelGateWay para este ciclo foi atingido. Novos disparos automáticos e manuais foram bloqueados temporariamente.
          </span>
        </div>
      )}

      {/* Pending Since 18/10 Alert Banner */}
      {pendingSince18.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-500">
                Atenção: {pendingSince18.length} {pendingSince18.length === 1 ? "venda paga" : "vendas pagas"} desde 18/10 com e-mail pendente ou não confirmado!
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Clique no botão ao lado para encaminhar os links de acesso automaticamente para os clientes via noreply@hangarboxx.com.br.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setBatchMode("pending");
              setIsBatchModalOpen(true);
            }}
            className="h-8 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-3.5 rounded-xl shrink-0 gap-1.5 shadow-xs"
          >
            <RotateCw size={13} />
            <span>Reenviar Agora ({pendingSince18.length})</span>
          </Button>
        </div>
      )}

      {/* 1. Header Banner & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-zinc-200/90 p-5 rounded-2xl shadow-xs">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2 tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-700">
              <Mail size={18} />
            </div>
            <span>Controle de Mensagens & E-mails Transacionais</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
              PixelGateWay Ativo
            </span>
          </h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            Monitore em tempo real o fluxo completo de mensagens enviadas, valores financeiros liberados por e-mail, taxas de entrega e reenvio de links de acesso.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold rounded-xl gap-1.5 shadow-xs"
          >
            <Download size={13} className="text-zinc-500" />
            <span className="hidden sm:inline">Exportar Relatório</span>
          </Button>

          {/* Batch Resend Since 18/10 */}
          <Button
            size="sm"
            onClick={() => setIsBatchModalOpen(true)}
            className="h-9 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 text-white text-xs font-bold px-3.5 gap-1.5 rounded-xl shadow-xs transition-all relative"
          >
            <RotateCw size={13} className={isBatchRunning ? "animate-spin" : ""} />
            <span>Reenviar Vendas (Desde 18/10)</span>
            {pendingSince18.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white text-red-700 text-[10px] font-black rounded-full leading-none">
                {pendingSince18.length}
              </span>
            )}
          </Button>

          {/* Test Email Button */}
          <Button
            size="sm"
            onClick={() => setIsTestModalOpen(true)}
            className="h-9 bg-gradient-to-r from-[#7B3FE4] via-[#6C2BD9] to-[#5B21B6] hover:brightness-110 text-white text-xs font-bold px-3.5 gap-1.5 rounded-xl shadow-xs transition-all"
          >
            <Send size={13} />
            <span>Disparo de Teste</span>
          </Button>
        </div>
      </div>

      {/* 2. Metrics Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Total Delivered Emails */}
        <div className="rounded-2xl bg-white border border-zinc-200/90 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                E-mails Entregues
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={15} />
              </div>
            </div>
            <div className="text-2xl font-black text-zinc-950 tracking-tight">
              <AnimatedCountUp end={metrics.sentCount} delay={0} />
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-emerald-700 font-bold">
              <AnimatedCountUp end={metrics.deliveryRate} delay={100} suffix="% de eficácia" />
            </span>
            <span className="text-zinc-400">{metrics.todaySentCount} hoje</span>
          </div>
        </div>

        {/* Metric 2: Email Billing (R$ 0,15 per email sent) */}
        <div className="rounded-2xl bg-white border border-purple-200/80 bg-purple-50/20 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
                Cobrança de E-mails
              </span>
              <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-200">
                R$ 0,15 / un
              </span>
            </div>
            <div className="text-2xl font-black text-purple-900 tracking-tight">
              <AnimatedCountUp end={metrics.totalEmailCost} decimals={2} prefix="R$ " delay={150} />
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-purple-100 flex items-center justify-between text-[11px]">
            <span className="text-purple-700 font-bold">
              <AnimatedCountUp end={metrics.monthEmailCost} decimals={2} prefix="R$ " delay={250} suffix=" no mês" />
            </span>
            <span className="text-purple-600 font-medium">{metrics.sentCount} faturados</span>
          </div>
        </div>

        {/* Metric 3: Gross Delivered Value */}
        <div className="rounded-2xl bg-white border border-zinc-200/90 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Faturamento Bruto
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <DollarSign size={15} />
              </div>
            </div>
            <div className="text-2xl font-black text-zinc-950 tracking-tight">
              <AnimatedCountUp end={metrics.totalDeliveredValue} decimals={2} prefix="R$ " delay={300} />
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-zinc-600 font-semibold">
              {metrics.sentCount} pedidos pagos
            </span>
            <span className="text-zinc-400">Total bruto</span>
          </div>
        </div>

        {/* Metric 4: Net Delivered Revenue (Minus R$ 0.15 email fee) */}
        <div className="rounded-2xl bg-white border border-zinc-200/90 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Receita Líquida Real
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <TrendingUp size={15} />
              </div>
            </div>
            <div className="text-2xl font-black text-blue-900 tracking-tight">
              <AnimatedCountUp end={metrics.netDeliveredRevenue} decimals={2} prefix="R$ " delay={450} />
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-blue-700 font-bold">Líquido de envios</span>
            <span className="text-zinc-400">- R$ 0,15/e-mail</span>
          </div>
        </div>

        {/* Metric 5: Pending or Failed */}
        <div className="rounded-2xl bg-white border border-zinc-200/90 p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Aguardando / Falhas
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <AlertTriangle size={15} />
              </div>
            </div>
            <div className="text-2xl font-black text-zinc-950 tracking-tight">
              <AnimatedCountUp end={metrics.pendingCount + metrics.failedCount} delay={600} />
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
            <span className="text-amber-700 font-bold">
              <AnimatedCountUp end={metrics.totalPendingValue} decimals={2} prefix="R$ " delay={650} />
            </span>
            <span className="text-zinc-400">Em risco</span>
          </div>
        </div>
      </div>

      {/* 3. Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-zinc-200/90 p-3 rounded-2xl shadow-xs">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por e-mail, nome do cliente, título da série ou ID..."
            className="pl-8 h-9 text-xs bg-zinc-50 border-zinc-200 focus:bg-white text-zinc-800 rounded-xl placeholder:text-zinc-400"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-700 font-medium outline-none focus:border-purple-500"
          >
            <option value="all">Todos os Status</option>
            <option value="enviado">Entregues com Sucesso</option>
            <option value="pendente">Aguardando Envio</option>
            <option value="falhou">Falhas no Disparo</option>
          </select>

          {/* Period filter */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="h-9 px-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-700 font-medium outline-none focus:border-purple-500"
          >
            <option value="all">Todo o Período</option>
            <option value="today">Apenas Hoje</option>
            <option value="month">Este Mês</option>
          </select>
        </div>
      </div>

      {/* 4. Detailed Emails Table */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-700">
            <thead className="bg-zinc-50 text-[11px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3.5">Data / Hora</th>
                <th className="px-4 py-3.5">Destinatário</th>
                <th className="px-4 py-3.5">Pedido PIX</th>
                <th className="px-4 py-3.5">Conteúdos Entregues</th>
                <th className="px-4 py-3.5">Valor Bruto</th>
                <th className="px-4 py-3.5">Tarifa Envio</th>
                <th className="px-4 py-3.5">Líquido Real</th>
                <th className="px-4 py-3.5">Status E-mail</th>
                <th className="px-4 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-zinc-400 font-medium"
                  >
                    Nenhum disparo de e-mail localizado para os filtros informados.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => {
                  const isSent = o.email_status === "enviado" || !!o.email_sent_at;
                  const isFailed = o.email_status === "falhou";
                  const isPending = !isSent && !isFailed;
                  const items = Array.isArray(o.items) ? o.items : [];
                  const orderTotal = Number(o.total || 0);
                  const netTotal = calculateOrderNet(orderTotal, isSent);

                  return (
                    <tr
                      key={o.id}
                      className="hover:bg-zinc-50/70 transition-colors group"
                    >
                      {/* Date & Time */}
                      <td className="px-4 py-4 whitespace-nowrap text-zinc-600 font-mono text-[11px]">
                        <div>{formatDateBR(o.email_sent_at || o.created_at)}</div>
                        <span className="text-[10px] text-zinc-400">
                          {o.email_sent_at ? "Enviado" : "Pedido criado"}
                        </span>
                      </td>

                      {/* Recipient */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 line-clamp-1">
                            {o.user_name || "Cliente"}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[11px] text-zinc-500 font-mono truncate max-w-[150px]">
                              {o.user_email}
                            </span>
                            <button
                              onClick={() => handleCopy(o.user_email)}
                              className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded transition-colors"
                              title="Copiar e-mail"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Pix Order */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-zinc-800 font-bold bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] border border-zinc-200">
                            #{o.id.slice(0, 8)}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              o.status === "pago"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {o.status === "pago" ? "Pago" : "Pendente"}
                          </Badge>
                        </div>
                      </td>

                      {/* Purchased Items */}
                      <td className="px-4 py-4">
                        <div className="space-y-1 max-w-[200px]">
                          {items.length === 0 ? (
                            <span className="text-zinc-400 text-[11px] italic">
                              Sem itens
                            </span>
                          ) : (
                            items.slice(0, 2).map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 text-[11px] text-zinc-800"
                              >
                                <span className="font-medium truncate max-w-[130px]">
                                  {item.titulo || "Série"}
                                </span>
                                {item.link_acesso && (
                                  <button
                                    onClick={() => handleCopy(item.link_acesso)}
                                    className="text-purple-600 hover:text-purple-700 hover:underline flex items-center gap-0.5 text-[10px]"
                                    title="Copiar link de acesso da série"
                                  >
                                    <Copy size={10} />
                                    <span>Link</span>
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                          {items.length > 2 && (
                            <span className="text-[10px] text-zinc-400 block">
                              +{items.length - 2} outros títulos
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Gross Total */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-bold text-zinc-900 text-xs">
                          R$ {formatBRL(orderTotal)}
                        </span>
                      </td>

                      {/* Email Fee (R$ 0,15) */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {isSent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                            - R$ 0,15
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400 font-mono">
                            R$ 0,00
                          </span>
                        )}
                      </td>

                      {/* Net Total */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-black text-xs text-blue-900">
                          R$ {formatBRL(netTotal)}
                        </span>
                      </td>

                      {/* Email Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {isSent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} />
                            <span>Entregue</span>
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle size={12} />
                            <span>Falhou</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={12} />
                            <span>Aguardando</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Preview Email */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewOrder(o)}
                            className="h-8 w-8 p-0 text-zinc-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Visualizar E-mail enviado"
                          >
                            <Eye size={14} />
                          </Button>

                          {/* Reenviar Email */}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={resendingId === o.id}
                            onClick={() => handleResend(o)}
                            className="h-8 w-8 p-0 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Reenviar E-mail de Acesso"
                          >
                            <RotateCw
                              size={14}
                              className={resendingId === o.id ? "animate-spin text-purple-600" : ""}
                            />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Modal: Visual Preview of the Sent Email */}
      <Dialog
        open={!!previewOrder}
        onOpenChange={(open) => !open && setPreviewOrder(null)}
      >
        <DialogContent className="bg-white border-zinc-200 text-zinc-900 max-w-lg rounded-3xl shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-zinc-950 text-white flex flex-row items-center justify-between border-b border-zinc-800">
            <div>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <Mail size={16} className="text-purple-400" />
                <span>Visualização do E-mail Transacional</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                Layout exato entregue na caixa de entrada de {previewOrder?.user_email}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg text-[10px] text-zinc-300 font-mono">
              <span>#{previewOrder?.id.slice(0, 8)}</span>
            </div>
          </DialogHeader>

          {previewOrder && (
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Header inside Email */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Assunto do E-mail:
                  </div>
                  <div className="text-xs font-bold text-zinc-900 mt-0.5">
                    Acesso Liberado! Sua compra na HangarBox foi confirmada 🎬
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 block">Status</span>
                  <span className="text-[11px] font-bold text-emerald-600">
                    {previewOrder.email_sent_at ? "Entregue" : "Aguardando"}
                  </span>
                </div>
              </div>

              {/* Email Body Simulation with Cinema-Grade Styling */}
              <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                {/* Header */}
                <div className="bg-[#09090b] p-5 text-white flex items-center justify-between border-b-2 border-purple-600">
                  <div>
                    <div className="text-lg font-black tracking-tight">
                      Hangar<span className="text-purple-500">Box</span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      Streaming & Catálogo Exclusivo
                    </div>
                  </div>
                  <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                    <span className="text-emerald-400">●</span> PIX APROVADO
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Hero Greeting */}
                  <div>
                    <h4 className="text-base font-extrabold text-zinc-900 tracking-tight">
                      Pagamento Aprovado com Sucesso!
                    </h4>
                    <p className="text-xs text-zinc-600 leading-relaxed mt-1">
                      Olá, <strong>{previewOrder.user_name || "Cliente"}</strong>! Seu pagamento foi identificado instantaneamente e o seu acesso vitalício está 100% liberado abaixo:
                    </p>
                  </div>

                  {/* 1. Official Receipt Details */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs space-y-2">
                    <div className="font-bold text-zinc-800 text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span>📋</span> Dados Oficiais da Compra
                    </div>
                    <div className="flex justify-between text-zinc-600">
                      <span>Número do Pedido:</span>
                      <span className="font-mono font-bold text-purple-700">
                        #HB-{previewOrder.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-600">
                      <span>Data de Confirmação:</span>
                      <span className="font-semibold text-zinc-800">
                        {formatDateBR(previewOrder.created_at)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-600 gap-2">
                      <span className="shrink-0">E-mail do Titular:</span>
                      <span className="font-semibold text-zinc-800 text-right break-all">
                        {previewOrder.user_email}
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-600">
                      <span>Tipo de Acesso:</span>
                      <span className="font-bold text-emerald-600">
                        Vitalício • Sem Mensalidades
                      </span>
                    </div>
                    <div className="pt-2 border-t border-dashed border-zinc-200 flex justify-between font-bold text-zinc-900">
                      <span>Total Pago:</span>
                      <span className="text-purple-700 text-sm font-black">
                        R$ {formatBRL(Number(previewOrder.total || 0))}
                      </span>
                    </div>
                  </div>

                  {/* 2. Items Purchased & Access Links */}
                  <div className="space-y-3">
                    <div className="font-bold text-xs text-zinc-800 flex items-center gap-1.5">
                      <span>🎬</span> Títulos Liberados para Assistir
                    </div>

                    {Array.isArray(previewOrder.items) &&
                      previewOrder.items.map((it: any, i: number) => (
                        <div
                          key={i}
                          className="bg-white border-2 border-zinc-200/90 rounded-xl p-4 space-y-3 shadow-xs"
                        >
                          <div>
                            <span className="text-[10px] font-bold text-purple-600 tracking-wider uppercase block">
                              Episódios Completos • 1080p Full HD
                            </span>
                            <div className="font-bold text-sm text-zinc-900">
                              {it.titulo || "Série"}
                            </div>
                            <div className="text-xs font-semibold text-zinc-500 mt-0.5">
                              Valor: R$ {formatBRL(Number(it.preco || 0))}
                            </div>
                          </div>

                          {it.link_acesso ? (
                            <a
                              href={it.link_acesso}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-gradient-to-r from-[#7B3FE4] via-[#6C2BD9] to-[#5B21B6] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs hover:brightness-110 transition-all flex items-center justify-center gap-2"
                            >
                              <span>▶ ASSISTIR AGORA (MEGA / DRIVE)</span>
                              <ExternalLink size={13} />
                            </a>
                          ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-700">
                              Link de acesso em indexação
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                  {/* 3. Quick Guide: How to Watch */}
                  <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-4 text-xs space-y-2">
                    <div className="font-bold text-purple-900 flex items-center gap-1.5">
                      <span>💡</span> Como Assistir em Qualquer Dispositivo
                    </div>
                    <div className="text-purple-950/80 space-y-1.5 text-[11px] leading-relaxed">
                      <div>
                        <strong>📺 Na Smart TV:</strong> Espelhe pelo celular ou abra o link direto no navegador da TV.
                      </div>
                      <div>
                        <strong>📱 No Celular / Tablet:</strong> Assista online pelo navegador ou baixe no app do Mega/Drive para ver offline.
                      </div>
                      <div>
                        <strong>💻 No Computador:</strong> Assista em tela cheia com alta velocidade de carregamento.
                      </div>
                    </div>
                  </div>

                  {/* 4. VIP Loyalty Coupon */}
                  <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl p-4 text-center space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      🎁 PRESENTE PARA SUA PRÓXIMA HISTÓRIA
                    </span>
                    <div className="text-xs font-bold text-amber-950">
                      Ganhe 15% de Desconto na Próxima Compra!
                    </div>
                    <div className="inline-block bg-white border border-amber-400 font-mono font-black text-amber-800 text-xs px-4 py-1.5 rounded-lg shadow-2xs mt-1">
                      CLIENTEVIP
                    </div>
                  </div>

                  {/* 5. Related Series Recommendations */}
                  <div className="space-y-2 pt-1">
                    <div className="font-bold text-xs text-zinc-800 flex items-center gap-1.5">
                      <span>🍿</span> Outras Séries que Você Vai Amar
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            🔥 Mais Vendido
                          </span>
                          <div className="font-bold text-zinc-900 mt-1">
                            O Quarterback Perdido
                          </div>
                          <div className="text-emerald-700 font-bold text-[11px]">
                            R$ 24,90
                          </div>
                        </div>
                        <a
                          href="/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] bg-zinc-900 text-white px-2.5 py-1.5 rounded-lg font-bold"
                        >
                          Ver Série
                        </a>
                      </div>

                      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <span className="text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                            ⭐ 4.9/5
                          </span>
                          <div className="font-bold text-zinc-900 mt-1">
                            Prefiro Morrer a Te Amar
                          </div>
                          <div className="text-emerald-700 font-bold text-[11px]">
                            R$ 19,90
                          </div>
                        </div>
                        <a
                          href="/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] bg-zinc-900 text-white px-2.5 py-1.5 rounded-lg font-bold"
                        >
                          Ver Série
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* 6. Accounting Breakdown for Admin */}
                  <div className="pt-3 border-t border-zinc-200 space-y-2 bg-zinc-50/80 -mx-6 -mb-6 p-4 rounded-b-2xl">
                    <div className="flex items-center justify-between text-xs text-zinc-600">
                      <span>Valor Bruto Recebido:</span>
                      <span className="font-semibold text-zinc-900">
                        R$ {formatBRL(Number(previewOrder.total || 0))}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        Tarifa Envio E-mail (Resend API):
                      </span>
                      <span className="font-semibold text-purple-700">
                        {previewOrder.email_status === "enviado" || previewOrder.email_sent_at
                          ? "- R$ 0,15"
                          : "R$ 0,00 (não cobrado)"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-dashed border-zinc-200 flex items-center justify-between text-xs font-bold text-zinc-900">
                      <span>Receita Líquida Real do Pedido:</span>
                      <span className="text-sm font-black text-emerald-700">
                        R${" "}
                        {formatBRL(
                          calculateOrderNet(
                            Number(previewOrder.total || 0),
                            previewOrder.email_status === "enviado" || !!previewOrder.email_sent_at
                          )
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-4 bg-zinc-50 border-t border-zinc-200 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOrder(null)}
              className="border-zinc-200 text-zinc-700 rounded-xl"
            >
              Fechar Visualização
            </Button>
            {previewOrder && (
              <Button
                size="sm"
                disabled={resendingId === previewOrder.id}
                onClick={() => handleResend(previewOrder)}
                className="bg-gradient-to-r from-[#7B3FE4] via-[#6C2BD9] to-[#5B21B6] hover:brightness-110 text-white rounded-xl gap-1.5 shadow-xs font-bold text-xs"
              >
                <RotateCw
                  size={13}
                  className={resendingId === previewOrder.id ? "animate-spin" : ""}
                />
                <span>Reenviar Agora</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Batch Resend Since 18/10 */}
      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent className="bg-[#09090b] border-zinc-800 text-zinc-100 max-w-xl rounded-3xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                <RotateCw size={16} className={isBatchRunning ? "animate-spin" : ""} />
              </div>
              <span>Reenvio de E-mails — Vendas Desde 18/10</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 mt-1">
              Encaminhe em lote os e-mails de confirmação de compra e links de acesso das séries usando o remetente oficial verificado <strong>noreply@hangarboxx.com.br</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Mode Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl">
              <button
                type="button"
                disabled={isBatchRunning}
                onClick={() => setBatchMode("pending")}
                className={`py-2 px-3 rounded-xl font-bold text-xs transition-all ${
                  batchMode === "pending"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Apenas Pendentes ({pendingSince18.length})
              </button>
              <button
                type="button"
                disabled={isBatchRunning}
                onClick={() => setBatchMode("all")}
                className={`py-2 px-3 rounded-xl font-bold text-xs transition-all ${
                  batchMode === "all"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Todos desde 18/10 ({ordersSince18.length})
              </button>
            </div>

            {/* Progress bar if running */}
            {isBatchRunning && (
              <div className="space-y-2 p-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-semibold flex items-center gap-2">
                    <RotateCw size={13} className="animate-spin text-red-500" />
                    Enviando {batchProgress.current} de {batchProgress.total}...
                  </span>
                  <span className="text-red-400 font-bold">
                    {Math.round((batchProgress.current / (batchProgress.total || 1)) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-300"
                    style={{
                      width: `${(batchProgress.current / (batchProgress.total || 1)) * 100}%`,
                    }}
                  />
                </div>
                {batchProgress.currentEmail && (
                  <p className="text-[11px] text-zinc-400 truncate">
                    Destino: <strong className="text-zinc-200">{batchProgress.currentEmail}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Orders list preview */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Pedidos selecionados ({batchTargetOrders.length})
              </span>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {batchTargetOrders.length === 0 ? (
                  <div className="p-4 text-center text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
                    Nenhum pedido encontrado para o critério selecionado.
                  </div>
                ) : (
                  batchTargetOrders.map((ord) => {
                    const log = batchLogs.find((l) => l.id === ord.id);
                    return (
                      <div
                        key={ord.id}
                        className="flex items-center justify-between p-2.5 bg-zinc-900 border border-zinc-800/80 rounded-xl text-xs"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-200 truncate">{ord.user_name || "Cliente"}</span>
                            <span className="text-[10px] text-zinc-400">#{ord.id.slice(0, 8)}</span>
                          </div>
                          <span className="text-[11px] text-zinc-400 truncate block">{ord.user_email}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-semibold text-emerald-400 text-xs">
                            R$ {Number(ord.total || 0).toFixed(2)}
                          </span>
                          {log ? (
                            log.success ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                                ✓ Enviado
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px]">
                                Falhou
                              </Badge>
                            )
                          ) : ord.email_status === "enviado" ? (
                            <Badge className="bg-zinc-800 text-zinc-400 text-[10px]">Já enviado</Badge>
                          ) : (
                            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                              Pendente
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isBatchRunning}
              onClick={() => setIsBatchModalOpen(false)}
              className="border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-800 rounded-xl"
            >
              Fechar
            </Button>
            <Button
              size="sm"
              disabled={isBatchRunning || batchTargetOrders.length === 0}
              onClick={handleStartBatchResend}
              className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 text-white rounded-xl gap-1.5 shadow-xs font-bold text-xs"
            >
              <RotateCw size={13} className={isBatchRunning ? "animate-spin" : ""} />
              <span>
                {isBatchRunning
                  ? "Processando Disparo..."
                  : `Disparar E-mails (${batchTargetOrders.length})`}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Modal: Sandbox / Test Email Dispatch */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="bg-white border-zinc-200 text-zinc-900 max-w-sm rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Send size={16} className="text-purple-600" />
              <span>Disparo de Teste (HangarBox)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 mt-1">
              Envie um e-mail transacional de teste com o template oficial da HangarBox para validar a entrega em tempo real.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <label className="text-zinc-700 font-bold block">
              E-mail de Destino
            </label>
            <Input
              value={testEmailRecipient}
              onChange={(e) => setTestEmailRecipient(e.target.value)}
              placeholder="seu-email@gmail.com"
              className="bg-zinc-50 border-zinc-200 text-xs rounded-xl h-10 text-zinc-900 focus:bg-white"
            />
            <span className="text-[10px] text-zinc-400 block">
              O e-mail será disparado imediatamente através do remetente configurado.
            </span>
          </div>

          <DialogFooter className="mt-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTestModalOpen(false)}
              className="border-zinc-200 text-zinc-700 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={sendingTest}
              onClick={handleSendTestEmail}
              className="bg-gradient-to-r from-[#7B3FE4] via-[#6C2BD9] to-[#5B21B6] hover:brightness-110 text-white rounded-xl gap-1.5 shadow-xs font-bold text-xs"
            >
              <Send size={13} />
              <span>{sendingTest ? "Enviando..." : "Confirmar Disparo"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailControlModule;
