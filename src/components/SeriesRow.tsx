import { useState, useEffect, memo, useCallback, useRef } from "react";
import { Star, Play, ShoppingCart, Check, Flame, ChevronDown, ChevronUp, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { Serie } from "@/data/series";
import { useFadeIn } from "@/hooks/useFadeIn";
import { useCart } from "@/contexts/CartContext";
import { isTopSeller } from "@/data/socialProof";
import { useGenreColors } from "@/hooks/useGenreColors";
import { useIsMobile } from "@/hooks/use-mobile";


interface SeriesRowProps {
  title: string;
  series: Serie[];
  onSelect: (serie: Serie) => void;
  onBuy?: (serie: Serie) => void;
  showRank?: boolean;
  layoutMode?: "horizontal" | "vertical";
}

// Memoized individual card to prevent re-renders of the entire grid
export const SeriesCard = memo(({
  serie, idx, showRank, layoutMode, isMobile, glowHSL, onSelect, onBuy,
}: {
  serie: Serie; idx: number; showRank: boolean; layoutMode: string;
  isMobile: boolean; glowHSL: string;
  onSelect: (s: Serie) => void; onBuy?: (s: Serie) => void;
}) => {
  const { addToCart, isInCart } = useCart();
  const inCart = isInCart(serie.id);
  const topSeller = isTopSeller(serie.id);
  const isDublado = Array.isArray(serie.categoria) && serie.categoria.some((c) => c.toLowerCase().includes("dublad"));
  const isLegendado = Array.isArray(serie.categoria) && serie.categoria.some((c) => c.toLowerCase().includes("legend"));

  return (
    <div
      className={`relative group transition-transform duration-300 hover:-translate-y-1.5 ${layoutMode === "horizontal" ? "w-full" : ""}`}
    >
      {/* Top Left: Rank badge (Top 10) or Top Seller */}
      {showRank && idx < 10 ? (
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-display font-black text-[11px] px-2.5 py-0.5 rounded-md shadow-md uppercase tracking-wider group-hover:scale-105 transition-transform">
          <Flame size={12} className="fill-white text-white" />
          <span>TOP {idx + 1}</span>
        </div>
      ) : topSeller ? (
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1 bg-primary text-white text-[10px] font-body font-bold px-2 py-0.5 rounded-md shadow-sm group-hover:scale-105 transition-transform">
          <Flame size={isMobile ? 9 : 11} /> Mais Popular
        </div>
      ) : null}

      {/* Top Right: Audio / Dublado Badge */}
      <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1">
        {isDublado ? (
          <span className="bg-black/80 border border-white/25 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider backdrop-blur-xs shadow-xs">
            Dublado
          </span>
        ) : isLegendado ? (
          <span className="bg-black/80 border border-white/25 text-zinc-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider backdrop-blur-xs shadow-xs">
            Legendado
          </span>
        ) : null}
      </div>

      {/* Poster Image Container with hover zoom & glow */}
      <button
        onClick={() => onSelect(serie)}
        className="relative w-full overflow-hidden rounded-2xl border border-white/10 transition-all duration-300 md:group-hover:scale-[1.03] group-hover:border-primary/70 shadow-md group-hover:shadow-[0_12px_36px_hsl(var(--primary)/0.35)] block cursor-pointer"
      >
        <img
          src={serie.capa_url}
          alt={serie.titulo}
          className="w-full aspect-[3/4] object-cover object-top md:object-center transition-transform duration-500 md:group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />

        {/* Lightweight Pure CSS Hover Glow matching brand color */}
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: "radial-gradient(circle at 50% 35%, hsl(var(--primary) / 0.3), rgba(245, 158, 11, 0.1), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />

        {/* Gradient shadow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)`,
          }}
        />

        {/* Hover preview pill */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
          <span className="bg-white/20 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/30 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <Play size={11} fill="currentColor" /> Ver Detalhes
          </span>
        </div>
      </button>

      {/* Always visible info + buttons below the card */}
      <div className="mt-2.5 px-0.5 space-y-1.5">
        <p className="text-[13px] md:text-sm font-body font-bold text-foreground leading-snug line-clamp-2 min-h-[2.4em] group-hover:text-primary transition-colors">
          {serie.titulo}
        </p>

        {/* Price & Rating line */}
        <div className="flex items-baseline justify-between pt-0.5">
          <div className="flex items-baseline gap-1">
            <span className="text-[14px] sm:text-[15px] font-mono font-black text-red-500 font-black">
              R$ {Number(serie.preco || 6).toFixed(2).replace(".", ",")}
            </span>
            <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-tight">
              vitalício
            </span>
          </div>

          <div className="flex items-center gap-0.5 text-[11px] font-bold text-amber-400">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            <span>{Number(serie.rating || 5).toFixed(1)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            onClick={() => onBuy?.(serie)}
            className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2.5 h-8 sm:h-8.5 bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:brightness-110 text-white text-[11px] sm:text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
          >
            <Play size={11} fill="currentColor" />
            <span>Garantir Acesso</span>
          </button>

          <button
            onClick={() => { if (!inCart) addToCart(serie); }}
            disabled={inCart}
            aria-label={inCart ? "No carrinho" : "Adicionar ao carrinho"}
            className={`flex items-center justify-center w-8 sm:w-8.5 h-8 sm:h-8.5 flex-shrink-0 rounded-xl transition-all border cursor-pointer hover:scale-105 active:scale-95 ${
              inCart
                ? "bg-rose-500/20 border-emerald-500/40 text-red-500 font-black"
                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-700"
            }`}
          >
            {inCart ? <Check size={13} /> : <ShoppingCart size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
});

SeriesCard.displayName = "SeriesCard";

// List row: thumbnail on the left, info on the right (ReelShort style)
const SeriesListItem = memo(({
  serie, idx, showRank, onSelect, onBuy,
}: {
  serie: Serie; idx: number; showRank: boolean;
  onSelect: (s: Serie) => void; onBuy?: (s: Serie) => void;
}) => {
  const { addToCart, isInCart } = useCart();
  const inCart = isInCart(serie.id);
  const topSeller = isTopSeller(serie.id);
  const genre = serie.categoria?.[0];

  return (
    <div className="flex gap-3 md:gap-4 group">
      <button
        onClick={() => onSelect(serie)}
        className="relative flex-shrink-0 w-[104px] md:w-[128px] overflow-hidden rounded-lg"
      >
        <img
          src={serie.capa_url}
          alt={serie.titulo}
          className="w-full aspect-[3/4] object-cover object-top md:object-center transition-transform duration-300 md:group-hover:scale-[1.04]"
          loading="lazy"
          decoding="async"
        />
        {showRank && idx < 10 && (
          <span className="absolute left-1 top-1 text-[26px] font-display leading-[0.8] select-none pointer-events-none"
            style={{
              color: "hsl(var(--background) / 0.55)",
              WebkitTextStroke: "1.5px hsl(var(--primary) / 0.75)",
              fontWeight: 900,
              letterSpacing: "-0.08em",
            }}
          >
            {idx + 1}
          </span>
        )}
        {topSeller && (
          <div className="absolute top-0 left-0 flex items-center gap-0.5 bg-accent text-accent-foreground text-[9px] font-body font-bold px-2 py-0.5 rounded-br-lg rounded-tl-lg">
            <Flame size={9} /> Mais Popular
          </div>
        )}
      </button>

      <div className="flex-1 min-w-0 flex flex-col">
        <button onClick={() => onSelect(serie)} className="text-left">
          <p className="text-[15px] md:text-base font-body font-bold text-foreground leading-snug line-clamp-2">{serie.titulo}</p>
        </button>
        {genre && <p className="text-xs md:text-sm text-muted-foreground mt-1">{genre}</p>}
        <p className="text-xs md:text-sm text-muted-foreground/80 mt-1.5 leading-relaxed line-clamp-2 md:line-clamp-3">{serie.resumo}</p>

        <div className="mt-auto pt-2.5 flex items-center gap-2">
          <span className="text-sm md:text-[15px] font-body font-black text-red-500">R$ {serie.preco.toFixed(2).replace(".", ",")}</span>
          <button
            onClick={() => onBuy?.(serie)}
            className="ml-auto flex items-center justify-center gap-1 px-3.5 h-8 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 text-white text-[11px] md:text-xs font-body font-bold rounded-full transition-colors"
          >
            <Play size={11} fill="currentColor" /> Garantir Acesso
          </button>
          <button
            onClick={() => { if (!inCart) addToCart(serie); }}
            disabled={inCart}
            aria-label={inCart ? "No carrinho" : "Adicionar ao carrinho"}
            className={`flex items-center justify-center w-8 h-8 flex-shrink-0 rounded-full transition-colors ${
              inCart ? "bg-success/15 text-success" : "bg-secondary text-foreground/70 hover:bg-secondary/70"
            }`}
          >
            {inCart ? <Check size={13} /> : <ShoppingCart size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
});

SeriesListItem.displayName = "SeriesListItem";





interface Top10CarouselProps {
  series: Serie[];
  isMobile: boolean;
  getGlowColor: (cat?: string[]) => string;
  onSelect: (s: Serie) => void;
  onBuy?: (s: Serie) => void;
}

const Top10Carousel = ({ series, isMobile, getGlowColor, onSelect, onBuy }: Top10CarouselProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInteracting = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollBy = (offset: number) => {
    if (!containerRef.current) return;
    containerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleTouchStart = () => {
    isInteracting.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };

  const handleTouchEnd = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      isInteracting.current = false;
    }, 3500);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const interval = setInterval(() => {
      if (isInteracting.current || document.hidden) return;
      const cardWidth = isMobile ? 180 : 220;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isMobile]);

  return (
    <div className="relative group/carousel">
      <button
        type="button"
        onClick={() => { handleTouchStart(); scrollBy(isMobile ? -180 : -220); handleTouchEnd(); }}
        aria-label="Anterior"
        className="absolute -left-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-black/80 border border-rose-500/30 text-white flex items-center justify-center hover:bg-rose-600 transition-all shadow-lg opacity-80 hover:opacity-100 cursor-pointer"
      >
        <ChevronLeft size={16} />
      </button>

      <button
        type="button"
        onClick={() => { handleTouchStart(); scrollBy(isMobile ? 180 : 220); handleTouchEnd(); }}
        aria-label="Próximo"
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-black/80 border border-rose-500/30 text-white flex items-center justify-center hover:bg-rose-600 transition-all shadow-lg opacity-80 hover:opacity-100 cursor-pointer"
      >
        <ChevronRight size={16} />
      </button>

      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={handleTouchStart}
        onMouseLeave={handleTouchEnd}
        className="overflow-x-auto scrollbar-hide -mx-2 px-2 pb-2 snap-x snap-mandatory touch-pan-x overscroll-x-contain"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex gap-4 sm:gap-5 w-max">
          {series.slice(0, 10).map((serie, idx) => (
            <div key={serie.id} className="w-[150px] sm:w-[180px] md:w-[205px] flex-shrink-0 snap-start">
              <SeriesCard
                serie={serie}
                idx={idx}
                showRank={true}
                layoutMode="horizontal"
                isMobile={isMobile}
                glowHSL={getGlowColor(serie.categoria)}
                onSelect={onSelect}
                onBuy={onBuy}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SeriesRow = memo(({ title, series, onSelect, onBuy, showRank = false, layoutMode = "vertical" }: SeriesRowProps) => {
  const fadeRef = useFadeIn();
  const { getGlowColor } = useGenreColors();
  const isMobile = useIsMobile();

  if (series.length === 0) return null;

  // Boxed Top 10 section matching the screenshot
  if (showRank) {
    return (
      <section ref={fadeRef} className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 my-6 sm:my-8 md:my-10 fade-section">
        <div className="rounded-3xl border border-rose-900/40 bg-gradient-to-b from-[#181113]/95 via-[#120e10]/90 to-[#0a0a0a]/80 p-5 sm:p-7 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1 rounded-full mb-2">
                <Flame size={12} className="text-rose-400 fill-rose-400/20" /> RANKING OFICIAL DOS ASSINANTES
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
                Top 10 Mais Assistidos & Destaques
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-body">
                Os títulos em alta com maior audiência e repercussão no Brasil nesta semana
              </p>
            </div>

            <div className="self-start sm:self-auto inline-flex items-center gap-1.5 text-xs font-semibold text-rose-200 bg-rose-950/50 border border-rose-800/50 px-3.5 py-1.5 rounded-xl shadow-xs">
              <Trophy size={13} className="text-rose-300" />
              <span>Atualizado em tempo real</span>
            </div>
          </div>

          {/* Cards carousel */}
          <Top10Carousel
            series={series}
            isMobile={isMobile}
            getGlowColor={getGlowColor}
            onSelect={onSelect}
            onBuy={onBuy}
          />
        </div>
      </section>
    );
  }

  // Standard Series Row with identical container margins
  return (
    <section ref={fadeRef} className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12 mb-8 md:mb-12 fade-section">
      <div className="mb-4 md:mb-5">
        <h3 className="text-xl md:text-2xl font-display font-extrabold text-foreground tracking-tight">{title}</h3>
      </div>

      <div className={layoutMode === "horizontal" ? "overflow-x-auto scrollbar-hide -mx-2 px-2 snap-x snap-mandatory" : ""}>
        <div className={layoutMode === "horizontal"
          ? "flex gap-3 sm:gap-4 w-max pb-1"
          : "grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 lg:gap-x-10"
        }>
          {series.map((serie, idx) => (
            layoutMode === "horizontal" ? (
              <div
                key={serie.id}
                className={isMobile ? "w-[40vw] max-w-[170px] min-w-[140px] flex-shrink-0 snap-start" : "w-[180px] flex-shrink-0"}
              >
                <SeriesCard
                  serie={serie}
                  idx={idx}
                  showRank={showRank}
                  layoutMode={layoutMode}
                  isMobile={isMobile}
                  glowHSL={getGlowColor(serie.categoria)}
                  onSelect={onSelect}
                  onBuy={onBuy}
                />
              </div>
            ) : (
              <div key={serie.id} className="w-full">
                <SeriesListItem
                  serie={serie}
                  idx={idx}
                  showRank={showRank}
                  onSelect={onSelect}
                  onBuy={onBuy}
                />
              </div>
            )
          ))}
        </div>
      </div>
    </section>
  );
});

SeriesRow.displayName = "SeriesRow";

export default SeriesRow;
