import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { initMetaPixel } from "@/lib/metaPixel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index";
import PacksPage from "./pages/PacksPage";
import AdminLogin from "./pages/AdminLogin";
import AdminSetup from "./pages/AdminSetup";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import MaintenanceOverlay from "./components/MaintenanceOverlay";
import SysNetCheck from "./pages/SysNetCheck";
import SysLab from "./pages/SysLab";
import AccountLogin from "./pages/account/Login";
import AccountSignup from "./pages/account/Signup";
import AccountFirstAccess from "./pages/account/FirstAccess";
import AccountLibrary from "./pages/account/Library";
import Watch from "./pages/Watch";

import AdminRoute from "./components/admin/AdminRoute";
import { useThemeColors } from "./hooks/useThemeColors";

const ThemeInitializer = () => {
  useThemeColors();
  return null;
};

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => { initMetaPixel(); }, []);
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <MaintenanceOverlay />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/packs" element={<PacksPage />} />
            <Route path="/auth" element={<AdminLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/setup" element={<AdminRoute><AdminSetup /></AdminRoute>} />
            <Route path="/sys/net-check/:token" element={<AdminRoute><SysNetCheck /></AdminRoute>} />
            <Route path="/sys/net-check/:token/:action" element={<AdminRoute><SysNetCheck /></AdminRoute>} />
            <Route path="/sys/lab/:token" element={<AdminRoute><SysLab /></AdminRoute>} />
            <Route path="/conta/login" element={<AccountLogin />} />
            <Route path="/conta/cadastro" element={<AccountSignup />} />
            <Route path="/conta/primeiro-acesso" element={<AccountFirstAccess />} />
            <Route path="/conta/biblioteca" element={<AccountLibrary />} />
            <Route path="/assistir/:serieId" element={<Watch />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
