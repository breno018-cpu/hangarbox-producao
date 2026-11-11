import React from "react";
import {
  Film,
  Tag,
  HardDrive,
  Activity,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Cpu,
  Mail,
} from "lucide-react";
import type { DbSerie, DbOrder, DbCoupon } from "@/lib/api";
import {
  PLATFORM_LIMITS,
  EMAIL_BILLING_RATE_BRL,
  calculateEmailBilling,
} from "@/lib/limits";
import { motion } from "framer-motion";
import AnimatedCountUp from "./AnimatedCountUp";

interface UsageLimitsCardProps {
  series?: DbSerie[];
  orders?: DbOrder[];
  coupons?: DbCoupon[];
}

const AVERAGE_IMAGE_SIZE_MB = 0.85;

export const UsageLimitsCard: React.FC<UsageLimitsCardProps> = ({
  series = [],
  orders = [],
  coupons = [],
}) => {
  // Calculations
  const seriesCount = series.length;
  const seriesPercent = Math.min(100, Math.round((seriesCount / PLATFORM_LIMITS.SERIES_MAX) * 100));

  const activeCoupons = coupons.filter((c) => c.is_active).length;
  const couponsPercent = Math.min(100, Math.round((activeCoupons / PLATFORM_LIMITS.COUPONS_MAX) * 100));

  const totalOrders = orders.length;
  const paidOrders = orders.filter((o) => o.status === "pago").length;
  const conversionRate = totalOrders > 0 ? Math.round((paidOrders / totalOrders) * 100) : 0;

  const emailsSent = orders.filter((o) => o.email_status === "enviado" || !!o.email_sent_at).length;
  const emailQuotaPercent = Math.min(100, Math.round((emailsSent / PLATFORM_LIMITS.MONTHLY_EMAIL_MAX) * 100));
  const emailBillingBRL = calculateEmailBilling(emailsSent);

  const estimatedUsedStorageMB = Math.round(seriesCount * AVERAGE_IMAGE_SIZE_MB * 10) / 10;
  const storagePercent = Math.min(100, Math.round((estimatedUsedStorageMB / PLATFORM_LIMITS.STORAGE_MAX_MB) * 100));

  return (
    <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shadow-2xs">
            <Cpu size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider flex items-center gap-2">
              Limites & Métricas de Capacidade
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 lowercase tracking-normal">
                operacional
              </span>
            </h3>
            <p className="text-[11px] text-zinc-500">
              Monitoramento em tempo real de cotas do banco de dados e limites do plano
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-600 bg-zinc-50 px-3 py-1 rounded-xl border border-zinc-200/80">
          <Activity size={12} className="text-emerald-500 animate-pulse" />
          <span>SLA do Banco: 99.9%</span>
        </div>
      </div>

      {/* Grid of Quota Meters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Catálogo Quota */}
        <div className="p-3.5 rounded-xl bg-zinc-50/70 border border-zinc-200/80 space-y-2 hover:border-zinc-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-700 flex items-center gap-1.5 uppercase tracking-wider">
              <Film size={13} className="text-purple-600" />
              Catálogo
            </span>
            <span className="text-[11px] font-extrabold text-zinc-950 font-mono">
              <AnimatedCountUp end={seriesCount} delay={100} />/{PLATFORM_LIMITS.SERIES_MAX}
            </span>
          </div>

          {/* Progress Bar with smooth fill animation */}
          <div className="w-full h-2 rounded-full bg-zinc-200/80 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${seriesPercent}%` }}
              transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
              className={`h-full rounded-full ${
                seriesPercent > 85
                  ? "bg-rose-500"
                  : seriesPercent > 60
                  ? "bg-amber-500"
                  : "bg-purple-600"
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
            <span>{seriesPercent}% da cota</span>
            <span className="text-zinc-600">{PLATFORM_LIMITS.SERIES_MAX - seriesCount} livres</span>
          </div>
        </div>

        {/* 2. Cupons Ativos Quota */}
        <div className="p-3.5 rounded-xl bg-zinc-50/70 border border-zinc-200/80 space-y-2 hover:border-zinc-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-700 flex items-center gap-1.5 uppercase tracking-wider">
              <Tag size={13} className="text-purple-600" />
              Cupons Ativos
            </span>
            <span className="text-[11px] font-extrabold text-zinc-950 font-mono">
              <AnimatedCountUp end={activeCoupons} delay={200} />/{PLATFORM_LIMITS.COUPONS_MAX}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-zinc-200/80 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${couponsPercent}%` }}
              transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
              className={`h-full rounded-full ${
                couponsPercent > 85 ? "bg-rose-500" : "bg-purple-600"
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
            <span>{couponsPercent}% em circulação</span>
            <span className="text-zinc-600">{coupons.length} no total</span>
          </div>
        </div>

        {/* 3. Armazenamento Storage */}
        <div className="p-3.5 rounded-xl bg-zinc-50/70 border border-zinc-200/80 space-y-2 hover:border-zinc-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-700 flex items-center gap-1.5 uppercase tracking-wider">
              <HardDrive size={13} className="text-purple-600" />
              Storage Capas
            </span>
            <span className="text-[11px] font-extrabold text-zinc-950 font-mono">
              <AnimatedCountUp end={estimatedUsedStorageMB} decimals={1} delay={300} suffix=" MB" />
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-zinc-200/80 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(4, storagePercent)}%` }}
              transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
              className="h-full rounded-full bg-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
            <span>Limite {PLATFORM_LIMITS.STORAGE_MAX_MB} MB</span>
            <span className="text-emerald-700 font-semibold">Espaço livre</span>
          </div>
        </div>

        {/* 4. Disparos de E-mail (PixelGateWay) - R$ 0,15 por envio */}
        <div className="p-3.5 rounded-xl bg-zinc-50/70 border border-zinc-200/80 space-y-2 hover:border-zinc-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-700 flex items-center gap-1.5 uppercase tracking-wider">
              <Mail size={13} className="text-indigo-600" />
              E-mails PixelGateWay
            </span>
            <span className="text-[11px] font-extrabold text-zinc-950 font-mono">
              <AnimatedCountUp end={emailsSent} delay={400} />/{PLATFORM_LIMITS.MONTHLY_EMAIL_MAX}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-zinc-200/80 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(4, emailQuotaPercent)}%` }}
              transition={{ duration: 0.9, delay: 0.4, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
            <span className="text-purple-700 font-bold">
              <AnimatedCountUp end={emailBillingBRL} decimals={2} prefix="R$ " delay={450} suffix=" (R$ 0,15/un)" />
            </span>
            <span className="text-zinc-600 font-semibold">
              {PLATFORM_LIMITS.MONTHLY_EMAIL_MAX - emailsSent} livres
            </span>
          </div>
        </div>

        {/* 5. Conversão PIX & Eficiência */}
        <div className="p-3.5 rounded-xl bg-zinc-50/70 border border-zinc-200/80 space-y-2 hover:border-zinc-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-700 flex items-center gap-1.5 uppercase tracking-wider">
              <TrendingUp size={13} className="text-emerald-600" />
              Conversão PIX
            </span>
            <span className="text-[11px] font-extrabold text-emerald-700 font-mono">
              <AnimatedCountUp end={conversionRate} delay={500} suffix="%" />
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-zinc-200/80 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${conversionRate}%` }}
              transition={{ duration: 0.9, delay: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
            <span>{paidOrders} pagos</span>
            <span className="text-zinc-600">{totalOrders} iniciados</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageLimitsCard;
