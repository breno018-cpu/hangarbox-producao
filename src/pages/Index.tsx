import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Sparkles, Sun, Moon, Heart } from "lucide-react";
import Logo from "@/components/Logo";
import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import SeriesRow from "@/components/SeriesRow";
import SeriesDetailModal from "@/components/SeriesDetailModal";
import CheckoutModal from "@/components/CheckoutModal";
import CartPage from "@/components/CartPage";
import AgeVerificationModal from "@/components/AgeVerificationModal";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import EvoraAIChatFloat from "@/components/EvoraAIChatFloat";
import FullCatalogSection from "@/components/FullCatalogSection";
import FiltersBar, { Filters, DEFAULT_FILTERS, applyFilters } from "@/components/FiltersBar";
import RankingPage from "@/components/RankingPage";
import FooterModal from "@/components/FooterModal";
import { seriesData, Serie } from "@/data/series";
import { useCart } from "@/contexts/CartContext";
import { trackSearch } from "@/lib/metaPixel";
import { stripEmojis } from "@/lib/utils";
import { type DbCoupon, type NavTab, DEFAULT_NAV_TABS, fetchVisibleCarouselSections, fetchNavTabs, fetchActiveSeries, fetchTopWatchedConfig, type TopWatchedConfig, DEFAULT_TOP_WATCHED_CONFIG, type DbCarouselSection, type DbSerie } from "@/lib/api";

const dbSerieToSerie = (db: DbSerie): Serie => ({
  id: db.id,
  titulo: stripEmojis(db.titulo),
  resumo: stripEmojis(db.resumo),
  capa_url: db.capa_url,
  fundo_url: db.fundo_url,
  categoria: db.categoria,
  vendas_count: db.vendas_count,
  data_adicao: db.data_adicao,
  is_hero: db.is_hero,
  preco: Number(db.preco),
  rating: Number(db.rating),
  elenco: db.elenco,
  temporadas: db.temporadas,
  status: db.status as "ativo" | "inativo",
  posicao: db.posicao,
  is_adult: db.is_adult,
});

const getGreetingInfo = () => {
  const h = new Date().getHours();
  if (h < 6) return { text: "Boa madrugada", Icon: Moon };
  if (h < 12) return { text: "Bom dia", Icon: Sun };
  if (h < 18) return { text: "Boa tarde", Icon: Sun };
  return { text: "Boa noite", Icon: Sparkles };
};

const Index = () => {
  const [selectedSerie, setSelectedSerie] = useState<Serie | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [directBuySerie, setDirectBuySerie] = useState<Serie | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<NavTab>(DEFAULT_NAV_TABS[0]);
  const [allTabs, setAllTabs] = useState<NavTab[]>(DEFAULT_NAV_TABS);
  const [checkoutCoupon, setCheckoutCoupon] = useState<DbCoupon | undefined>();
  const [checkoutDiscount, setCheckoutDiscount] = useState(0);
  const [carouselSections, setCarouselSections] = useState<DbCarouselSection[]>([]);
  const [topWatchedConfig, setTopWatchedConfig] = useState<TopWatchedConfig>(DEFAULT_TOP_WATCHED_CONFIG);
  const [allSeries, setAllSeries] = useState<Serie[]>(seriesData);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [footerModal, setFooterModal] = useState<"termos" | "privacidade" | "faq" | null>(null);

  // Age verification state
  const [ageVerifySerie, setAgeVerifySerie] = useState<Serie | null>(null);
  const [ageVerifyForTab, setAgeVerifyForTab] = useState(false);
  const [ageVerifiedIds, setAgeVerifiedIds] = useState<Set<string>>(() => {
    try {
      return sessionStorage.getItem("age_verified") === "true" ? new Set(["__all__"]) : new Set();
    } catch {
      return new Set();
    }
  });
  const [pendingTab, setPendingTab] = useState<NavTab | null>(null);

  const { items, totalPrice, clearCart } = useCart();
  const initialLoadDone = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    Promise.all([
      fetchVisibleCarouselSections(),
      fetchNavTabs(),
      fetchActiveSeries(),
    ]).then(([sections, tabs, dbSeries]) => {
      setCarouselSections(sections);
      const loadedTabs = tabs.length > 0 ? tabs : DEFAULT_NAV_TABS;
      if (tabs.length > 0) setAllTabs(loadedTabs);
      if (dbSeries.length > 0) setAllSeries(dbSeries.map(dbSerieToSerie));

      // Handle ?tab= query parameter for deep linking
      const tabParam = searchParams.get("tab");
      if (tabParam) {
        const matchedTab = loadedTabs.find(
          (t) => t.label.toLowerCase() === tabParam.toLowerCase() ||
                 t.filterCategory?.toLowerCase() === tabParam.toLowerCase()
        );
        if (matchedTab) {
          // For adult tabs, trigger age verification
          if (matchedTab.isExclusive && matchedTab.filterCategory === "Hot" && !ageVerifiedIds.has("__all__")) {
            setPendingTab(matchedTab);
            setAgeVerifyForTab(true);
          } else {
            setActiveTab(matchedTab);
          }
        } else {
          setActiveTab(loadedTabs[0]);
        }
      } else {
        setActiveTab(loadedTabs[0]);
      }
    }).catch(() => {});
  }, []);

  // Deep link / cross-page navigation to the Ranking view (?view=ranking)
  useEffect(() => {
    setRankingOpen(searchParams.get("view") === "ranking");
  }, [searchParams]);

  const exclusiveCategories = useMemo(() => {
    return allTabs.filter((t) => t.isExclusive && t.filterCategory).map((t) => t.filterCategory);
  }, [allTabs]);

  // Is this the "home" tab (no specific category)?
  const isHomeTab = !activeTab.filterCategory?.trim();

  // The base pool of series available for the current tab (excluding search)
  const baseSeriesPool = useMemo(() => {
    let result = allSeries;

    const tabCategory = activeTab.filterCategory?.trim();

    if (activeTab.isExclusive && tabCategory) {
      return result.filter((s) => s.categoria.some((c) => c.toLowerCase() === tabCategory.toLowerCase()));
    }

    if (tabCategory) {
      const matched = result.filter((s) =>
        s.categoria.some((c) => c.toLowerCase() === tabCategory.toLowerCase())
      );
      if (matched.length > 0) {
        return matched.filter((s) => !s.categoria.some((c) => exclusiveCategories.includes(c)));
      }
      // No series match this tab's category — return empty (tab has no content)
      return [];
    }

    // "Início" — show all except exclusive
    return result.filter((s) => !s.categoria.some((c) => exclusiveCategories.includes(c)));
  }, [activeTab, exclusiveCategories, allSeries]);

  // Apply search on top of tab pool
  const tabFilteredSeries = useMemo(() => {
    if (!searchQuery) return baseSeriesPool;
    const q = searchQuery.toLowerCase();
    trackSearch(searchQuery);
    return baseSeriesPool.filter((s) =>
      s.titulo.toLowerCase().includes(q) || s.categoria.some((c) => c.toLowerCase().includes(q))
    );
  }, [baseSeriesPool, searchQuery]);

  // Series with user filters applied (for display)
  const filteredSeries = useMemo(() => {
    return applyFilters(tabFilteredSeries, filters);
  }, [tabFilteredSeries, filters]);

  // For carousel sections: on home tab, use tab pool; on specific tabs, use tab pool
  // Sections with filter_category further narrow within the pool
  const getSeriesForSection = useCallback((section: DbCarouselSection): Serie[] => {
    let base = [...tabFilteredSeries];

    if (section.section_type === "category" && section.filter_category) {
      base = base.filter((s) => s.categoria.some((c) => c.toLowerCase() === section.filter_category!.toLowerCase()));
      if (base.length === 0) return [];
    }

    const sortKey = section.sort_by as keyof Serie;
    base.sort((a, b) => {
      const aVal = a[sortKey]; const bVal = b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") return section.sort_order === "asc" ? aVal - bVal : bVal - aVal;
      if (typeof aVal === "string" && typeof bVal === "string") return section.sort_order === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return 0;
    });

    return applyFilters(base, filters).slice(0, section.max_items);
  }, [tabFilteredSeries, filters]);

  // Dynamic Top 10 (Mais Assistidas) calculation
  const topWatchedSeries = useMemo(() => {
    const base = [...tabFilteredSeries];
    if (
      !topWatchedConfig ||
      topWatchedConfig.mode === "auto" ||
      !topWatchedConfig.series_ids ||
      topWatchedConfig.series_ids.length === 0
    ) {
      return base.sort((a, b) => b.vendas_count - a.vendas_count).slice(0, 10);
    }

    const seriesMap = new Map(allSeries.map((s) => [s.id, s]));
    const manualList: Serie[] = [];
    for (const id of topWatchedConfig.series_ids) {
      const found = seriesMap.get(id);
      if (found) {
        if (isHomeTab || base.some((b) => b.id === found.id)) {
          manualList.push(found);
        }
      }
    }

    if (manualList.length === 0) {
      return base.sort((a, b) => b.vendas_count - a.vendas_count).slice(0, 10);
    }

    return manualList;
  }, [allSeries, tabFilteredSeries, topWatchedConfig, isHomeTab]);

  // Pre-compute section rows — each section shows exactly what admin configured
  const sectionRows = useMemo(() => {
    if (carouselSections.length === 0) return [];
    return carouselSections
      .filter((section) => {
        // On home tab, hide sections whose filter_category belongs to an exclusive tab
        if (isHomeTab && section.filter_category) {
          return !exclusiveCategories.includes(section.filter_category);
        }
        return true;
      })
      .map((section) => {
        const series = getSeriesForSection(section);
        return { section, series };
      });
  }, [carouselSections, getSeriesForSection, isHomeTab, exclusiveCategories]);

  // Build fallback rows (only used when NO carousel sections configured in DB)
  const fallbackRows = useMemo(() => {
    if (carouselSections.length > 0) return null; // DB sections take priority
    if (activeTab.isExclusive && activeTab.filterCategory) return null;

    const base = tabFilteredSeries;
    return {
      destaques: applyFilters(base.filter((s) => s.categoria.includes("Destaques")), filters),
      emAlta: applyFilters([...base].filter((s) => s.categoria.includes("Em Alta")).sort((a, b) => b.vendas_count - a.vendas_count), filters),
      recentes: applyFilters([...base].sort((a, b) => new Date(b.data_adicao).getTime() - new Date(a.data_adicao).getTime()), filters),
      maisPopulares: applyFilters([...base].sort((a, b) => b.vendas_count - a.vendas_count), filters),
      recomendados: applyFilters(base.filter((s) => s.categoria.includes("Recomendados")), filters),
    };
  }, [tabFilteredSeries, carouselSections, activeTab, filters]);

  // Check if we have ANY content to show
  const hasContent = useMemo(() => {
    if (activeTab.isExclusive) return filteredSeries.length > 0;
    if (tabFilteredSeries && tabFilteredSeries.length > 0) return true;
    if (allSeries && allSeries.length > 0) return true;
    if (sectionRows.length > 0) return sectionRows.some(({ series }) => series.length > 0);
    if (fallbackRows) return Object.values(fallbackRows).some((arr) => arr.length > 0);
    return false;
  }, [activeTab, filteredSeries, tabFilteredSeries, allSeries, sectionRows, fallbackRows]);

  const isAdultTab = useCallback((tab: NavTab) => {
    return tab.isExclusive && tab.filterCategory === "Hot";
  }, []);

  const navigate = useNavigate();

  const handleCategoryChange = useCallback((_label: string, tab: NavTab) => {
    if (tab.label === "Ranking") {
      window.scrollTo({ top: 0 });
      setSearchParams({ view: "ranking" }, { replace: true });
      return;
    }
    if (tab.label === "Packs" || tab.label === "Combos" || tab.label === "Planos") {
      setRankingOpen(false);
      navigate("/packs");
      return;
    }
    if (isAdultTab(tab) && !ageVerifiedIds.has("__all__")) {
      setPendingTab(tab);
      setAgeVerifyForTab(true);
      return;
    }
    setRankingOpen(false);
    setFilters(DEFAULT_FILTERS);
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
    // Update URL with tab parameter for shareability
    const tabSlug = tab.filterCategory || tab.label;
    if (tabSlug && tabSlug !== "Início") {
      setSearchParams({ tab: tabSlug }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [isAdultTab, ageVerifiedIds, navigate, setSearchParams]);

  const handleSelectSerie = (serie: Serie) => {
    if (serie.is_adult && !ageVerifiedIds.has("__all__") && !ageVerifiedIds.has(serie.id)) {
      setAgeVerifySerie(serie);
      setAgeVerifyForTab(false);
      return;
    }
    setSelectedSerie(serie);
  };

  const handleAgeVerified = () => {
    setAgeVerifiedIds((prev) => new Set([...prev, "__all__"]));
    sessionStorage.setItem("age_verified", "true");
    if (ageVerifyForTab && pendingTab) {
      setFilters(DEFAULT_FILTERS);
      setActiveTab(pendingTab);
      setPendingTab(null);
      setAgeVerifyForTab(false);
    } else if (ageVerifySerie) {
      setSelectedSerie(ageVerifySerie);
      setAgeVerifySerie(null);
    }
  };

  const handleAgeCancel = () => {
    setAgeVerifySerie(null);
    setAgeVerifyForTab(false);
    setPendingTab(null);
  };

  const handleDirectBuy = (serie: Serie) => { setSelectedSerie(null); setDirectBuySerie(serie); setCheckoutCoupon(undefined); setCheckoutDiscount(0); setCheckoutOpen(true); };
  const handleCartCheckout = (coupon?: DbCoupon, discount?: number) => { setCartOpen(false); setDirectBuySerie(null); setCheckoutCoupon(coupon); setCheckoutDiscount(discount || 0); setCheckoutOpen(true); };
  const handlePaymentSuccess = () => { setTimeout(() => { setCheckoutOpen(false); setDirectBuySerie(null); setCheckoutCoupon(undefined); setCheckoutDiscount(0); clearCart(); }, 500); };

  const checkoutItems = directBuySerie ? [{ serie: directBuySerie }] : items;
  const checkoutTotal = directBuySerie ? directBuySerie.preco : totalPrice;

  const heroSeries = useMemo(() => {
    const nonExclusiveHeroes = allSeries.filter(
      (s) => s.is_hero && !s.categoria.some((c) => exclusiveCategories.includes(c))
    );

    if (activeTab.isExclusive && activeTab.filterCategory) {
      const tabHeroes = allSeries.filter(
        (s) => s.is_hero && s.categoria.includes(activeTab.filterCategory)
      );
      if (tabHeroes.length > 0) return tabHeroes;
      const tabItems = allSeries.filter((s) => s.categoria.includes(activeTab.filterCategory));
      return tabItems.slice(0, 3);
    }

    if (activeTab.filterCategory) {
      const tabHeroes = allSeries.filter(
        (s) =>
          s.is_hero &&
          s.categoria.includes(activeTab.filterCategory) &&
          !s.categoria.some((c) => exclusiveCategories.includes(c))
      );
      if (tabHeroes.length > 0) return tabHeroes;
    }

    return nonExclusiveHeroes;
  }, [allSeries, activeTab, exclusiveCategories]);

  return (
    <div className="min-h-screen bg-background welcome-gradient">
      <Header onSearch={setSearchQuery} onOpenCart={() => setCartOpen(true)} onCheckout={handleCartCheckout} onCategoryChange={handleCategoryChange} activeTabLabel={activeTab.label} activeSpecial={rankingOpen ? "Ranking" : null} />
      <HeroCarousel series={heroSeries} onDetails={handleSelectSerie} onBuy={handleDirectBuy} />

      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 pt-6 md:pt-8 pb-1">
        {(() => {
          const { text, Icon } = getGreetingInfo();
          return (
            <p className="flex items-center gap-1.5 text-xs sm:text-sm md:text-base font-body text-foreground/45">
              <Icon size={14} className="text-rose-400/80 flex-shrink-0" />
              <span>{text} — o que vamos assistir hoje?</span>
            </p>
          );
        })()}
      </div>

      <div className="relative z-10">
        {activeTab.isExclusive && activeTab.filterCategory ? (
          <SeriesRow
            title={activeTab.label}
            series={[...filteredSeries].sort((a, b) => b.vendas_count - a.vendas_count)}
            onSelect={handleSelectSerie}
            onBuy={handleDirectBuy}
            showRank
          />
        ) : (
          <>
            {/* 1. Top 10 Ranking Box (Mais Assistidos & Destaques) */}
            {topWatchedConfig.is_visible && topWatchedSeries.length > 0 && (
              <SeriesRow
                title={topWatchedConfig.title || "Top 10 Mais Assistidos & Destaques"}
                series={topWatchedSeries}
                onSelect={handleSelectSerie}
                onBuy={handleDirectBuy}
                showRank
              />
            )}

            {/* 2. Custom admin carousel sections if configured */}
            {sectionRows
              .filter(({ section }) => {
                const isTopDuplicate =
                  section.title.trim().toUpperCase() === "MAIS ASSISTIDAS" ||
                  (section.show_rank && section.title.toLowerCase().includes("mais assistid"));
                return !isTopDuplicate;
              })
              .map(({ section, series }) => (
                series.length > 0 ? (
                  <SeriesRow
                    key={section.id}
                    title={section.title}
                    series={series}
                    onSelect={handleSelectSerie}
                    onBuy={handleDirectBuy}
                    showRank={section.show_rank || false}
                    layoutMode={(section as any).layout_mode || "horizontal"}
                  />
                ) : null
              ))}

            {/* 3. Catálogo Completo — O último bloco da página antes do footer */}
            <FullCatalogSection
              series={tabFilteredSeries}
              onSelect={handleSelectSerie}
              onBuy={handleDirectBuy}
            />
          </>
        )}
      </div>

      <footer className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 py-8 md:py-12 border-t border-border/10 mt-12">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-4 md:flex-row md:justify-between md:gap-6">
          <div className="text-center md:text-left flex items-center gap-3 flex-col md:flex-row">
            <Logo size="lg" />
            <p className="text-[10px] md:text-xs font-body text-muted-foreground/40 md:ml-2">Doramas, novelas, livros e conteúdos exclusivos.</p>
          </div>
          <div className="flex items-center gap-4 md:gap-6 text-[10px] md:text-xs font-body text-muted-foreground/35">
            <button onClick={() => setFooterModal("termos")} className="hover:text-foreground/50 transition-colors duration-300">Termos</button>
            <button onClick={() => setFooterModal("privacidade")} className="hover:text-foreground/50 transition-colors duration-300">Privacidade</button>
            <button onClick={() => setFooterModal("faq")} className="hover:text-foreground/50 transition-colors duration-300">FAQ</button>
            <button onClick={() => navigate("/admin")} className="hover:text-primary text-muted-foreground/45 transition-colors duration-300">Admin</button>
          </div>
        </div>
        <p className="text-center text-[9px] md:text-[10px] font-body text-muted-foreground/25 mt-4 md:mt-6 flex items-center justify-center gap-1">
          © 2026 Hangar <Heart size={11} className="text-primary fill-primary mx-0.5" /> Box. Todos os direitos reservados.
        </p>
        <p className="text-center text-[9px] md:text-[10px] font-body text-muted-foreground/40 mt-2">Desenvolvido por <span className="text-primary/70 font-semibold">PixelLoom</span></p>
      </footer>

      {selectedSerie && <SeriesDetailModal serie={selectedSerie} onClose={() => setSelectedSerie(null)} onBuy={handleDirectBuy} />}
      {cartOpen && <CartPage onClose={() => setCartOpen(false)} onCheckout={handleCartCheckout} />}
      {checkoutOpen && checkoutItems.length > 0 && (
        <CheckoutModal
          items={checkoutItems}
          totalPrice={checkoutTotal}
          onClose={() => { setCheckoutOpen(false); setDirectBuySerie(null); }}
          onSuccess={handlePaymentSuccess}
          appliedCoupon={checkoutCoupon}
          discount={checkoutDiscount}
        />
      )}
      {(ageVerifySerie || ageVerifyForTab) && (
        <AgeVerificationModal onVerified={handleAgeVerified} onCancel={handleAgeCancel} />
      )}

      <AnimatePresence>
        {rankingOpen && (
          <RankingPage
            allSeries={allSeries}
            onClose={() => { setRankingOpen(false); setSearchParams({}, { replace: true }); }}
            onSelect={(serie) => { setRankingOpen(false); setSearchParams({}, { replace: true }); handleSelectSerie(serie); }}
          />
        )}
      </AnimatePresence>

      {footerModal && <FooterModal type={footerModal} onClose={() => setFooterModal(null)} />}

      <WhatsAppFloat />
      <EvoraAIChatFloat />
    </div>
  );
};

export default Index;
