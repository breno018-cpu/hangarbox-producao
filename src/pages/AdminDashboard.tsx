import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  Film,
  Tag,
  BarChart3,
  Settings,
  Layers,
  Sparkles,
  Mail,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
import {
  fetchSeries,
  createSerie,
  updateSerie,
  deleteSerie,
  fetchOrders,
  updateOrderStatus,
  fetchCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  fetchCarouselSections,
  type DbSerie,
  type DbOrder,
  type DbCoupon,
  type DbCarouselSection,
} from "@/lib/api";
import AdminHeader from "@/components/admin/AdminHeader";
import SalesModule from "@/components/admin/SalesModule";
import CatalogModule from "@/components/admin/CatalogModule";
import CouponsModule from "@/components/admin/CouponsModule";
import EmailControlModule from "@/components/admin/EmailControlModule";
import MarketingModule from "@/components/admin/MarketingModule";
import SettingsModule from "@/components/admin/SettingsModule";
import ThemeColorsModule from "@/components/admin/ThemeColorsModule";
import CarouselManager from "@/components/admin/CarouselManager";
import UsageLimitsCard from "@/components/admin/UsageLimitsCard";

export const AdminDashboard: React.FC = () => {
  const { user, signOut } = useAdmin();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("sales");

  // 1. Query: Orders
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["admin_orders"],
    queryFn: fetchOrders,
    staleTime: 1000 * 30, // 30s
  });

  // 2. Query: Series
  const { data: series = [], isLoading: loadingSeries } = useQuery({
    queryKey: ["admin_series"],
    queryFn: fetchSeries,
    staleTime: 1000 * 60, // 1m
  });

  // 3. Query: Coupons
  const { data: coupons = [], isLoading: loadingCoupons } = useQuery({
    queryKey: ["admin_coupons"],
    queryFn: fetchCoupons,
    staleTime: 1000 * 60,
  });

  // 4. Query: Carousel Sections
  const { data: carousels = [], isLoading: loadingCarousels } = useQuery({
    queryKey: ["admin_carousels"],
    queryFn: fetchCarouselSections,
    staleTime: 1000 * 60,
  });

  // Mutations
  const orderStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_orders"] });
    },
  });

  const saveSerieMutation = useMutation({
    mutationFn: async (item: Partial<DbSerie>) => {
      if (item.id) {
        return updateSerie(item.id, item);
      } else {
        const { id, created_at, updated_at, ...rest } = item as any;
        return createSerie(rest);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_series"] });
    },
  });

  const deleteSerieMutation = useMutation({
    mutationFn: (id: string) => deleteSerie(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_series"] });
    },
  });

  const saveCouponMutation = useMutation({
    mutationFn: async (item: Partial<DbCoupon>) => {
      if (item.id) {
        return updateCoupon(item.id, item);
      } else {
        const { id, created_at, updated_at, used_count, ...rest } = item as any;
        return createCoupon(rest);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_coupons"] });
    },
  });

  const deleteCouponMutation = useMutation({
    mutationFn: (id: string) => deleteCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_coupons"] });
    },
  });

  const toggleCouponMutation = useMutation({
    mutationFn: (c: DbCoupon) => updateCoupon(c.id, { is_active: !c.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_coupons"] });
    },
  });

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    await orderStatusMutation.mutateAsync({ id: orderId, status: newStatus });
  };

  const handleSaveSerie = async (serie: Partial<DbSerie>) => {
    await saveSerieMutation.mutateAsync(serie);
  };

  const handleDeleteSerie = async (id: string) => {
    await deleteSerieMutation.mutateAsync(id);
  };

  const handleSaveCoupon = async (coupon: Partial<DbCoupon>) => {
    await saveCouponMutation.mutateAsync(coupon);
  };

  const handleDeleteCoupon = async (id: string) => {
    await deleteCouponMutation.mutateAsync(id);
  };

  const handleToggleCoupon = async (coupon: DbCoupon) => {
    await toggleCouponMutation.mutateAsync(coupon);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-rose-500/20 selection:text-rose-900">
      {/* Fixed Admin Header in White */}
      <AdminHeader userEmail={user?.email} onLogout={signOut} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Real-time Usage Limits & Platform Health */}
        <UsageLimitsCard series={series} orders={orders} coupons={coupons} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Navigation Bar / Tabs Header in PixelLoom Style */}
          <div className="border-b border-zinc-200/80 pb-4 overflow-x-auto scrollbar-none">
            <TabsList className="bg-zinc-100/90 border border-zinc-200/80 p-1.5 rounded-2xl h-12 flex w-max gap-1.5 shadow-xs">
              <TabsTrigger
                value="sales"
                className="gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight data-[state=active]:bg-zinc-950 data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-600 transition-all hover:text-zinc-950"
              >
                <TrendingUp size={15} />
                <span>Vendas & Finanças</span>
                {orders.filter((o) => o.status === "pendente").length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </TabsTrigger>

              <TabsTrigger
                value="catalog"
                className="gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight data-[state=active]:bg-zinc-950 data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-600 transition-all hover:text-zinc-950"
              >
                <Film size={15} />
                <span>Catálogo</span>
                <span className="text-[10px] bg-zinc-200/80 text-zinc-700 px-1.5 py-0.5 rounded-full border border-zinc-300/60 font-semibold group-data-[state=active]:bg-zinc-800 group-data-[state=active]:text-zinc-200">
                  {series.length}
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="coupons"
                className="gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight data-[state=active]:bg-zinc-950 data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-600 transition-all hover:text-zinc-950"
              >
                <Tag size={15} />
                <span>Cupons</span>
                {coupons.length > 0 && (
                  <span className="text-[10px] bg-zinc-200/80 text-zinc-700 px-1.5 py-0.5 rounded-full border border-zinc-300/60 font-semibold">
                    {coupons.length}
                  </span>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="emails"
                className="gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight data-[state=active]:bg-zinc-950 data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-600 transition-all hover:text-zinc-950"
              >
                <Mail size={15} />
                <span>Disparos de E-mail</span>
                <span className="text-[10px] bg-zinc-200/80 text-zinc-700 px-1.5 py-0.5 rounded-full border border-zinc-300/60 font-semibold">
                  {orders.filter((o) => o.email_status === "enviado" || !!o.email_sent_at).length}
                </span>
                {orders.some((o) => o.status === "pago" && !o.email_sent_at && o.email_status !== "enviado") && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </TabsTrigger>

              <TabsTrigger
                value="carousels"
                className="gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight data-[state=active]:bg-zinc-950 data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-600 transition-all hover:text-zinc-950"
              >
                <Layers size={15} />
                <span>Carrosséis</span>
              </TabsTrigger>

              <TabsTrigger
                value="marketing"
                className="gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight data-[state=active]:bg-zinc-950 data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-600 transition-all hover:text-zinc-950"
              >
                <BarChart3 size={15} />
                <span>Marketing & Tráfego</span>
              </TabsTrigger>

              <TabsTrigger
                value="settings"
                className="gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight data-[state=active]:bg-zinc-950 data-[state=active]:text-white data-[state=active]:shadow-sm text-zinc-600 transition-all hover:text-zinc-950"
              >
                <Settings size={15} />
                <span>Configurações</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Module 1: Sales & Finances */}
          <TabsContent value="sales" className="m-0 focus-visible:outline-none">
            <SalesModule
              orders={orders}
              onUpdateStatus={handleUpdateOrderStatus}
              isLoading={loadingOrders}
            />
          </TabsContent>

          {/* Module 2: Catalog Management */}
          <TabsContent value="catalog" className="m-0 focus-visible:outline-none">
            <CatalogModule
              series={series}
              onSaveSerie={handleSaveSerie}
              onDeleteSerie={handleDeleteSerie}
              isLoading={loadingSeries}
            />
          </TabsContent>

          {/* Module 3: Coupons */}
          <TabsContent value="coupons" className="m-0 focus-visible:outline-none">
            <CouponsModule
              coupons={coupons}
              onSaveCoupon={handleSaveCoupon}
              onDeleteCoupon={handleDeleteCoupon}
              onToggleCoupon={handleToggleCoupon}
            />
          </TabsContent>

          {/* Module: Transactional Emails & Values Control */}
          <TabsContent value="emails" className="m-0 focus-visible:outline-none">
            <EmailControlModule
              orders={orders}
              onRefreshOrders={() => {
                queryClient.invalidateQueries({ queryKey: ["admin_orders"] });
              }}
            />
          </TabsContent>

          {/* Module: Carousels Manager */}
          <TabsContent value="carousels" className="m-0 focus-visible:outline-none">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <CarouselManager
                sections={carousels}
                setSections={() => {
                  queryClient.invalidateQueries({ queryKey: ["admin_carousels"] });
                }}
                allSeries={series}
              />
            </div>
          </TabsContent>

          {/* Module 4: Marketing & Leads */}
          <TabsContent value="marketing" className="m-0 focus-visible:outline-none">
            <MarketingModule orders={orders} />
          </TabsContent>

          {/* Module 5: Settings & WhatsApp */}
          <TabsContent value="settings" className="m-0 focus-visible:outline-none">
            <SettingsModule />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
