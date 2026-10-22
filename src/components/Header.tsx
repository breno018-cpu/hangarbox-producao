import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Search, X, ShoppingCart, Trash2, Trophy, ArrowRight, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/Logo";
import { getIcon } from "@/lib/iconMap";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { type NavTab, DEFAULT_NAV_TABS, fetchNavTabs } from "@/lib/api";
import { toast } from "sonner";

const injectSpecialTabs = (tabs: NavTab[]): NavTab[] => {
  let result = [...tabs];
  if (!result.some((t) => t.label === "Planos" || t.label === "Combos" || t.label === "Packs")) {
    result = [...result, { label: "Planos", filterCategory: "", isExclusive: false, icon: "gift" }];
  }
  if (!result.some((t) => t.label === "Ranking")) {
    result = [...result, { label: "Ranking", filterCategory: "", isExclusive: false, icon: "trophy" }];
  }
  return result;
};

interface HeaderProps {
  onSearch?: (q: string) => void;
  onOpenCart?: () => void;
  onCheckout?: () => void;
  onCategoryChange?: (category: string, tab: NavTab) => void;
  activeTabLabel?: string;
  /** Highlights a special tab ("Planos" | "Ranking") and disables regular tab highlight */
  activeSpecial?: string | null;
}

const Header = memo(({ onSearch, onOpenCart, onCheckout, onCategoryChange, activeTabLabel, activeSpecial }: HeaderProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cartHover, setCartHover] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [tabs, setTabs] = useState<NavTab[]>(injectSpecialTabs(DEFAULT_NAV_TABS));
  const cartTimeout = useRef<ReturnType<typeof setTimeout>>();
  const { items, totalItems, totalPrice, removeFromCart } = useCart();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetchNavTabs().then((t) => setTabs(injectSpecialTabs(t))).catch(() => {});
  }, []);

  // Sync activeIdx when parent changes the active tab
  useEffect(() => {
    if (activeTabLabel) {
      const idx = tabs.findIndex((t) => t.label === activeTabLabel);
      if (idx >= 0 && idx !== activeIdx) setActiveIdx(idx);
    }
  }, [activeTabLabel, tabs]);

  const handleLogoClick = useCallback(() => {
    clickCount.current += 1;
    clearTimeout(clickTimer.current);

    if (clickCount.current === 2) {
      toast.info("Clique mais 1 vez para acessar o Painel Admin", { duration: 1500 });
    }

    if (clickCount.current >= 3) {
      clickCount.current = 0;
      toast.info("Acessando Painel Administrativo...", { duration: 2000 });
      navigate("/admin");
      return;
    }

    clickTimer.current = setTimeout(() => {
      clickCount.current = 0;
    }, 2500);
  }, [navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        toast.info("Iniciando transição para o Portal Administrativo...", { duration: 2500 });
        navigate("/admin");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 60);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCartEnter = useCallback(() => { clearTimeout(cartTimeout.current); setCartHover(true); }, []);
  const handleCartLeave = useCallback(() => { cartTimeout.current = setTimeout(() => setCartHover(false), 300); }, []);

  const handleTabClick = useCallback((idx: number) => {
    const tab = tabs[idx];
    const isSpecial = tab.label === "Ranking" || tab.label === "Packs" || tab.label === "Combos" || tab.label === "Planos";
    if (isSpecial) {
      onCategoryChange?.(tab.label, tab);
      return;
    }
    setActiveIdx(idx);
    onCategoryChange?.(tab.label, tab);
  }, [tabs, onCategoryChange]);

  const searchBox = (
    <div className="flex items-center bg-secondary rounded-full overflow-hidden">
      <Search size={15} className="ml-3.5 text-foreground/45 flex-shrink-0" />
      <input
        type="text"
        placeholder="Buscar séries..."
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); onSearch?.(e.target.value); }}
        className="bg-transparent px-2.5 py-2.5 text-sm font-body font-medium text-foreground outline-none flex-1 placeholder:text-muted-foreground/60 min-w-0"
      />
      {searchQuery && (
        <button
          onClick={() => { setSearchQuery(""); onSearch?.(""); }}
          className="p-1.5 mr-1.5 text-foreground/50 hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );

  return (
    <>

      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 bg-background/95 backdrop-blur-xl ${
          scrolled
            ? "border-b border-border/8 shadow-[0_4px_30px_hsl(0_0%_0%/0.3)]"
            : ""
        }`}
      >
        {/* Top bar: Logo + Search + Cart */}
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 md:py-3.5">
          <div className="flex items-center justify-between gap-3">
          <button onClick={handleLogoClick} className="select-none flex-shrink-0">
            <Logo size={isMobile ? "sm" : "md"} />
          </button>

          {/* Search - desktop inline */}
          <div className="hidden md:block md:flex-1 md:mx-6 md:max-w-md">
            {searchBox}
          </div>

          {/* Cart with interactive mouse hover animation & preview */}
          <div className="relative flex-shrink-0" onMouseEnter={handleCartEnter} onMouseLeave={handleCartLeave}>
            <motion.button
              onClick={onOpenCart}
              whileHover={{ scale: 1.14 }}
              whileTap={{ scale: 0.92 }}
              aria-label="Abrir carrinho"
              className="p-2 md:p-2.5 text-foreground/70 hover:text-white transition-colors duration-200 relative rounded-xl hover:bg-white/5 cursor-pointer"
            >
              <ShoppingCart size={18} className="transition-transform group-hover:rotate-6" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-mono font-black rounded-full flex items-center justify-center min-w-[18px] h-[18px] shadow-md border border-[#0a0a0c] animate-scale-in">
                  {totalItems}
                </span>
              )}
            </motion.button>

            <AnimatePresence>
              {cartHover && !isMobile && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 top-full mt-2.5 w-80 sm:w-88 bg-[#121118]/95 backdrop-blur-2xl border border-rose-900/40 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 overflow-hidden"
                  onMouseEnter={handleCartEnter}
                  onMouseLeave={handleCartLeave}
                >
                  {items.length === 0 ? (
                    <div className="p-6 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-primary shadow-inner">
                        <ShoppingCart size={22} />
                      </div>
                      <h4 className="text-sm font-display font-bold text-white mb-1">
                        Seu Carrinho está Vazio
                      </h4>
                      <p className="text-xs text-zinc-400 font-body mb-4 leading-relaxed">
                        Passe o mouse sobre os títulos do catálogo e garanta seu acesso vitalício com 1 clique!
                      </p>
                      <button
                        onClick={() => {
                          setCartHover(false);
                          const el = document.getElementById("catalogo-completo");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary/90 hover:bg-primary border border-primary/40 transition-all active:scale-95 cursor-pointer shadow-sm"
                      >
                        <span>Explorar Catálogo</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-white/10">
                        <div className="flex items-center gap-1.5">
                          <ShoppingBag size={14} className="text-primary" />
                          <h4 className="text-xs font-display font-bold text-white tracking-wider">SEU CARRINHO</h4>
                        </div>
                        <span className="text-[11px] font-mono font-semibold bg-primary/20 text-rose-300 border border-primary/30 px-2 py-0.5 rounded-full">
                          {totalItems} {totalItems === 1 ? "item" : "itens"}
                        </span>
                      </div>

                      {/* List */}
                      <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin py-3">
                        {items.map((item) => (
                          <motion.div
                            key={item.serie.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
                          >
                            <img
                              src={item.serie.capa_url}
                              alt=""
                              className="w-10 h-14 object-cover rounded-lg flex-shrink-0 shadow-sm"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-body font-bold text-white truncate group-hover:text-primary transition-colors">
                                {item.serie.titulo}
                              </p>
                              <p className="text-[11px] font-mono font-black text-red-500 mt-0.5">
                                R$ {item.serie.preco.toFixed(2).replace(".", ",")}
                              </p>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.serie.id)}
                              title="Remover"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-70 group-hover:opacity-100 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </motion.div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="border-t border-white/10 pt-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-body text-zinc-400">Total:</span>
                          <span className="text-base font-mono font-black text-red-500">
                            R$ {totalPrice.toFixed(2).replace(".", ",")}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setCartHover(false); onOpenCart?.(); }}
                            className="flex-1 text-xs border-white/10 text-zinc-300 hover:bg-white/10 rounded-xl h-9"
                          >
                            Ver Completo
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => { setCartHover(false); onCheckout?.(); }}
                            className="flex-1 text-xs font-bold bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:brightness-110 text-white rounded-xl h-9 shadow-md"
                          >
                            Finalizar Compra
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          </div>

          {/* Search - mobile full width row (collapses on scroll to free screen space) */}
          <div className={`md:hidden overflow-hidden transition-all duration-300 ${scrolled ? "max-h-0 opacity-0 mt-0" : "max-h-16 opacity-100 mt-2"}`}>{searchBox}</div>

        </div>


        {/* Navigation tabs — ReelShort style: bold text + underline */}
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12">
          <nav className="flex items-center gap-4 md:gap-8 pb-3 overflow-x-auto scrollbar-hide">
            {tabs.map((tab, idx) => {
              const isSpecial = tab.label === "Ranking" || tab.label === "Packs" || tab.label === "Combos" || tab.label === "Planos";
              const isSpecialActive = !!activeSpecial && (
                tab.label === activeSpecial ||
                (activeSpecial === "Planos" && (tab.label === "Packs" || tab.label === "Combos"))
              );
              const isActive = isSpecialActive || (!isSpecial && !activeSpecial && activeIdx === idx);
              return (
                <button
                  key={tab.label}
                  onClick={() => handleTabClick(idx)}
                  className={`relative pb-1.5 text-[15px] md:text-base font-body transition-colors duration-200 whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? `${isSpecialActive ? "text-primary" : "text-foreground"} font-semibold nav-underline`
                      : isSpecial
                        ? "text-primary font-semibold"
                        : "text-foreground/45 font-medium hover:text-foreground/80"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

      </header>
    </>
  );
});

Header.displayName = "Header";

export default Header;
