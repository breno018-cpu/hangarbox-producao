import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Star, TrendingUp, Clock, Filter, X, ChevronUp, ChevronDown,
  Flame, Medal, Crown, Award, DollarSign, BarChart3, Tv
} from "lucide-react";
import { Serie } from "@/data/series";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";

interface RankingPageProps {
  allSeries: Serie[];
  onClose: () => void;
  onSelect: (serie: Serie) => void;
}

type SortField = "vendas_count" | "rating" | "preco" | "data_adicao" | "temporadas" | "faturamento";
type SortDir = "asc" | "desc";

interface RankingFilters {
  genres: string[];
  minRating: number;
  minSeasons: number;
  sortField: SortField;
  sortDir: SortDir;
}

const DEFAULT_RANKING_FILTERS: RankingFilters = {
  genres: [],
  minRating: 0,
  minSeasons: 0,
  sortField: "vendas_count",
  sortDir: "desc",
};

const SORT_OPTIONS: { value: SortField; label: string; icon: typeof TrendingUp }[] = [
  { value: "vendas_count", label: "Vendas", icon: TrendingUp },
  { value: "faturamento", label: "Faturamento", icon: DollarSign },
  { value: "rating", label: "Avaliação", icon: Star },
  { value: "preco", label: "Preço", icon: Award },
  { value: "data_adicao", label: "Data", icon: Clock },
  { value: "temporadas", label: "Temporadas", icon: Tv },
];

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Crown size={22} className="text-[hsl(42_100%_55%)] drop-shadow-[0_0_8px_hsl(42_100%_55%/0.5)]" />;
  if (rank === 2) return <Medal size={20} className="text-[hsl(0_0%_75%)] drop-shadow-[0_0_6px_hsl(0_0%_75%/0.4)]" />;
  if (rank === 3) return <Medal size={20} className="text-[hsl(25_70%_50%)] drop-shadow-[0_0_6px_hsl(25_70%_50%/0.4)]" />;
  return null;
};

const getRankBg = (rank: number) => {
  if (rank === 1) return "bg-[hsl(42_100%_55%/0.06)] border-[hsl(42_100%_55%/0.15)] hover:border-[hsl(42_100%_55%/0.3)]";
  if (rank === 2) return "bg-[hsl(0_0%_75%/0.04)] border-[hsl(0_0%_75%/0.12)] hover:border-[hsl(0_0%_75%/0.25)]";
  if (rank === 3) return "bg-[hsl(25_70%_50%/0.04)] border-[hsl(25_70%_50%/0.12)] hover:border-[hsl(25_70%_50%/0.25)]";
  return "bg-card/60 border-border/30 hover:border-primary/30";
};

const formatCurrency = (value: number) => {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}K`;
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
};

const RankingPage = ({ allSeries, onClose, onSelect }: RankingPageProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<RankingFilters>(DEFAULT_RANKING_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const allGenres = useMemo(() => {
    const set = new Set<string>();
    allSeries.forEach((s) => s.categoria.forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [allSeries]);

  const rankedSeries = useMemo(() => {
    let result = [...allSeries];

    if (filters.genres.length > 0) {
      result = result.filter((s) => s.categoria.some((c) => filters.genres.includes(c)));
    }
    if (filters.minRating > 0) {
      result = result.filter((s) => s.rating >= filters.minRating);
    }
    if (filters.minSeasons > 0) {
      result = result.filter((s) => s.temporadas >= filters.minSeasons);
    }

    result.sort((a, b) => {
      const field = filters.sortField;

      if (field === "faturamento") {
        const aRev = a.vendas_count * a.preco;
        const bRev = b.vendas_count * b.preco;
        return filters.sortDir === "desc" ? bRev - aRev : aRev - bRev;
      }

      if (field === "data_adicao") {
        const aTime = new Date(a.data_adicao).getTime();
        const bTime = new Date(b.data_adicao).getTime();
        return filters.sortDir === "desc" ? bTime - aTime : aTime - bTime;
      }

      const aVal = a[field as keyof Serie] as number;
      const bVal = b[field as keyof Serie] as number;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return filters.sortDir === "desc" ? bVal - aVal : aVal - bVal;
      }
      return 0;
    });

    return result;
  }, [allSeries, filters]);

  // Stats
  const stats = useMemo(() => {
    const totalVendas = rankedSeries.reduce((s, r) => s + r.vendas_count, 0);
    const totalFaturamento = rankedSeries.reduce((s, r) => s + r.vendas_count * r.preco, 0);
    const avgRating = rankedSeries.length ? rankedSeries.reduce((s, r) => s + r.rating, 0) / rankedSeries.length : 0;
    return { totalVendas, totalFaturamento, avgRating };
  }, [rankedSeries]);

  const toggleGenre = useCallback((g: string) => {
    setFilters((f) => ({
      ...f,
      genres: f.genres.includes(g) ? f.genres.filter((x) => x !== g) : [...f.genres, g],
    }));
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    setFilters((f) => ({
      ...f,
      sortField: field,
      sortDir: f.sortField === field ? (f.sortDir === "desc" ? "asc" : "desc") : "desc",
    }));
  }, []);

  const hasActiveFilters = filters.genres.length > 0 || filters.minRating > 0 || filters.minSeasons > 0;

  return (
    <motion.div
      className="fixed inset-0 z-[55] bg-background overflow-hidden flex flex-col"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/40 bg-background/90 backdrop-blur-xl pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="px-4 md:px-12 lg:px-16 py-3 md:py-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                <Trophy size={isMobile ? 18 : 22} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-3xl font-display font-extrabold text-foreground tracking-tight leading-none">Ranking</h1>
                <p className="text-[11px] md:text-xs font-body text-muted-foreground mt-0.5 truncate">
                  {rankedSeries.length} séries classificadas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-body font-medium border transition-all ${
                  hasActiveFilters
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/70 border-border/40 text-foreground/70"
                }`}
              >
                <Filter size={13} />
                {isMobile ? "" : "Filtros"}
                {hasActiveFilters && (
                  <span className="bg-background/25 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {(filters.genres.length > 0 ? 1 : 0) + (filters.minRating > 0 ? 1 : 0) + (filters.minSeasons > 0 ? 1 : 0)}
                  </span>
                )}
              </motion.button>
              <button
                onClick={onClose}
                className="hidden sm:inline-flex items-center px-3.5 h-9 rounded-full text-xs font-body font-medium border bg-secondary/70 border-border/40 text-foreground/70 hover:text-foreground transition-colors"
              >
                Início
              </button>
              <button
                onClick={() => { onClose(); navigate("/packs"); }}
                className="hidden sm:inline-flex items-center px-3.5 h-9 rounded-full text-xs font-body font-medium border bg-secondary/70 border-border/40 text-primary hover:bg-primary/10 transition-colors"
              >
                Planos
              </button>
              <button
                onClick={onClose}
                aria-label="Fechar ranking"
                className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide pb-0.5">
            <div className="flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/30">
              <BarChart3 size={12} className="text-primary" />
              <span className="text-[11px] font-body text-muted-foreground">
                <span className="text-foreground font-semibold">{stats.totalVendas.toLocaleString()}</span> vendas
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/30">
              <DollarSign size={12} className="text-primary" />
              <span className="text-[11px] font-body text-muted-foreground">
                <span className="text-foreground font-semibold">{formatCurrency(stats.totalFaturamento)}</span> faturado
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/30">
              <Star size={12} className="text-star-filled fill-star-filled" />
              <span className="text-[11px] font-body text-muted-foreground">
                <span className="text-foreground font-semibold">{stats.avgRating.toFixed(1)}</span> média
              </span>
            </div>
          </div>

          {/* Sort bar */}
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto scrollbar-hide pb-1">
            {SORT_OPTIONS.map(({ value, label, icon: Icon }) => {
              const isActive = filters.sortField === value;
              return (
                <button
                  key={value}
                  onClick={() => toggleSort(value)}
                  className={`flex items-center gap-1 px-3.5 py-2 rounded-full text-[11px] font-body font-medium border whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 border-border/30 text-foreground/60 hover:text-foreground"
                  }`}
                >
                  <Icon size={11} />
                  {label}
                  {isActive && (
                    filters.sortDir === "desc" ? <ChevronDown size={11} /> : <ChevronUp size={11} />
                  )}
                </button>
              );
            })}
          </div>
        </div>


        {/* Filters panel */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-t border-border/30"
            >
              <div className="px-4 md:px-12 lg:px-16 py-4 space-y-4">
                {/* Genres */}
                <div>
                  <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-2">Gêneros</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allGenres.map((g) => (
                      <button
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-body border transition-all ${
                          filters.genres.includes(g)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary/50 border-border/30 text-foreground/60 hover:text-foreground"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-2">Avaliação mínima</p>
                  <div className="flex gap-1.5">
                    {[0, 3, 3.5, 4, 4.5].map((r) => (
                      <button
                        key={r}
                        onClick={() => setFilters((f) => ({ ...f, minRating: f.minRating === r ? 0 : r }))}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-body border transition-all ${
                          filters.minRating === r && r > 0
                            ? "bg-[hsl(42_100%_55%/0.15)] border-[hsl(42_100%_55%/0.3)] text-[hsl(42_100%_55%)]"
                            : "bg-secondary/50 border-border/30 text-foreground/60"
                        }`}
                      >
                        <Star size={9} className={filters.minRating === r && r > 0 ? "fill-[hsl(42_100%_55%)]" : ""} />
                        {r === 0 ? "Todos" : `${r}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min Seasons */}
                <div>
                  <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-2">Temporadas mínimas</p>
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3, 4].map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilters((f) => ({ ...f, minSeasons: f.minSeasons === t ? 0 : t }))}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-body border transition-all ${
                          filters.minSeasons === t && t > 0
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary/50 border-border/30 text-foreground/60"
                        }`}
                      >
                        {t === 0 ? "Todas" : `${t}+`}
                      </button>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={() => setFilters(DEFAULT_RANKING_FILTERS)}
                    className="text-[11px] font-body text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ranking list */}
      <div className="flex-1 overflow-y-auto">
        {/* Top 3 podium on desktop */}
        {!isMobile && rankedSeries.length >= 3 && (
          <div className="px-12 lg:px-16 pt-6 pb-2">
            <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[1, 0, 2].map((podiumIdx) => {
                const serie = rankedSeries[podiumIdx];
                if (!serie) return null;
                const rank = podiumIdx + 1;
                const isFirst = rank === 1;
                return (
                  <motion.button
                    key={serie.id}
                    onClick={() => onSelect(serie)}
                    className={`flex flex-col items-center p-4 rounded-3xl border transition-all hover:scale-[1.02] ${getRankBg(rank)} ${isFirst ? "order-2 -mt-2" : rank === 2 ? "order-1 mt-4" : "order-3 mt-4"}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: podiumIdx * 0.1, duration: 0.4 }}
                  >
                    <div className="mb-2">{getRankIcon(rank)}</div>
                    <img
                      src={serie.capa_url}
                      alt={serie.titulo}
                      className={`${isFirst ? "w-24 h-32" : "w-20 h-27"} aspect-[3/4] object-cover object-top rounded-xl shadow-lg mb-3`}
                      loading="lazy"
                    />
                    <h3 className="text-sm font-body font-semibold text-foreground truncate max-w-full">{serie.titulo}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Star size={10} className="text-[hsl(42_100%_55%)] fill-[hsl(42_100%_55%)]" />
                      <span className="text-xs font-body text-foreground/50">{serie.rating}</span>
                    </div>
                    <p className="text-xs font-body text-muted-foreground mt-1">
                      {serie.vendas_count.toLocaleString()} vendas
                    </p>
                    <p className="text-sm font-display font-bold text-primary mt-1">
                      {formatCurrency(serie.vendas_count * serie.preco)}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-4 md:px-12 lg:px-16 py-3 md:py-4 space-y-1.5 md:space-y-2">
          {rankedSeries.length === 0 ? (
            <div className="text-center py-20">
              <Trophy size={40} className="text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-body text-muted-foreground">Nenhuma série encontrada com esses filtros</p>
              <button
                onClick={() => setFilters(DEFAULT_RANKING_FILTERS)}
                className="text-xs font-body text-primary mt-2 hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            rankedSeries.map((serie, idx) => {
              const rank = idx + 1;
              // Skip top 3 on desktop (shown in podium)
              if (!isMobile && rank <= 3) return null;
              const revenue = serie.vendas_count * serie.preco;

              return (
                <motion.button
                  key={serie.id}
                  onClick={() => onSelect(serie)}
                  className={`w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl border transition-all active:scale-[0.995] ${getRankBg(rank)}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min((idx - (isMobile ? 0 : 3)) * 0.03, 0.5), duration: 0.3 }}
                  whileHover={{ x: 4 }}
                >
                  {/* Rank number */}
                  <div className="flex-shrink-0 w-7 md:w-10 text-center">
                    {getRankIcon(rank) || (
                      <span className={`text-base md:text-xl font-display ${rank <= 10 ? "text-foreground/60" : "text-foreground/25"}`}>
                        {rank}
                      </span>
                    )}
                  </div>

                  {/* Cover */}
                  <img
                    src={serie.capa_url}
                    alt={serie.titulo}
                    className="w-12 h-16 md:w-14 md:h-18.5 aspect-[3/4] object-cover object-top rounded-xl flex-shrink-0"
                    loading="lazy"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm md:text-base font-body font-semibold text-foreground truncate">
                        {serie.titulo}
                      </h3>
                      {rank <= 5 && (
                        <Flame size={12} className="text-primary flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={isMobile ? 8 : 10}
                            className={star <= Math.round(serie.rating) ? "text-[hsl(42_100%_55%)] fill-[hsl(42_100%_55%)]" : "text-muted-foreground/15"}
                          />
                        ))}
                        <span className="text-[10px] md:text-xs font-body text-foreground/40 ml-0.5">{serie.rating}</span>
                      </div>
                      <span className="text-[10px] md:text-xs font-body text-muted-foreground">
                        {serie.vendas_count.toLocaleString()} vendas
                      </span>
                      <span className="text-[10px] md:text-xs font-body text-muted-foreground hidden sm:inline">
                        {serie.temporadas}T
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {serie.categoria.slice(0, isMobile ? 2 : 4).map((cat) => (
                        <span key={cat} className="text-[8px] md:text-[10px] font-body px-1.5 py-0.5 rounded bg-secondary/50 text-foreground/30">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stats column */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm md:text-base font-display font-bold text-foreground">
                      R$ {serie.preco.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-[9px] md:text-[10px] font-body text-muted-foreground">
                      {formatCurrency(revenue)}
                    </p>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RankingPage;
