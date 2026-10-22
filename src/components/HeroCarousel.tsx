import { useState, useEffect, useCallback, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Info, Star, Check } from "lucide-react";
import { Serie } from "@/data/series";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface HeroCarouselProps {
  series: Serie[];
  onDetails: (serie: Serie) => void;
  onBuy: (serie: Serie) => void;
}

const INTERVAL = 4500;

const contentVariants = {
  enter: { opacity: 0, y: 30 },
  center: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const, staggerChildren: 0.08 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

const childVariants = {
  enter: { opacity: 0, y: 15 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const HeroCarousel = memo(({ series, onDetails, onBuy }: HeroCarouselProps) => {
  const [current, setCurrent] = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  const isTransitioning = useRef(false);
  const isMobile = useIsMobile();
  const touchStart = useRef<number>(0);

  const goTo = useCallback((index: number) => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;
    setCurrent(index);
    setProgressKey((k) => k + 1);
    setTimeout(() => { isTransitioning.current = false; }, 700);
  }, []);

  const nextSlide = useCallback(() => goTo((current + 1) % series.length), [current, series.length, goTo]);
  const prevSlide = useCallback(() => goTo((current - 1 + series.length) % series.length), [current, series.length, goTo]);

  useEffect(() => { setCurrent(0); }, [series]);

  useEffect(() => {
    if (series.length <= 1) return;
    const timer = setTimeout(nextSlide, INTERVAL);
    return () => clearTimeout(timer);
  }, [current, nextSlide, series.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? nextSlide() : prevSlide();
    }
  }, [nextSlide, prevSlide]);

  if (series.length === 0) return null;
  const safeCurrent = current >= series.length ? 0 : current;
  const s = series[safeCurrent];

  return (
    <div
      className="relative h-[86svh] md:h-[94vh] min-h-[520px] md:min-h-[620px] w-full overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background images with crossfade */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={s.id}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          <img src={s.fundo_url} alt="" className="w-full h-full object-cover" loading="eager" decoding="async" />
        </motion.div>
      </AnimatePresence>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/50" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent max-w-4xl" />
      <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-background/90 to-transparent" />

      {/* Content — Left aligned with unified container max-w-[1440px] */}
      <div className="absolute inset-0 z-10 flex items-end pb-12 sm:pb-16 md:pb-20">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={s.id}
              className="max-w-3xl flex flex-col items-start text-left"
              variants={contentVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {/* Title */}
              <motion.h1
                variants={childVariants}
                className="text-2xl sm:text-4xl md:text-5xl lg:text-[54px] font-display font-black text-white uppercase tracking-tight leading-[1.08] line-clamp-2 md:line-clamp-3"
                style={{ textShadow: "0 4px 20px rgba(0,0,0,0.8)" }}
              >
                {s.titulo}
              </motion.h1>

              {/* Badges line: Star rating, Year, Dublado/Audio, Full Episodes */}
              <motion.div
                variants={childVariants}
                className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 sm:mt-4 text-xs sm:text-sm font-body font-semibold"
              >
                <div className="flex items-center gap-1 text-amber-400">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <span className="font-bold">{s.rating ? Number(s.rating).toFixed(1) : "5.0"}</span>
                </div>

                <span className="text-zinc-300 font-medium">2026</span>

                <span className="bg-black/60 border border-white/20 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                  DUBLADO
                </span>

                <span className="text-red-500 flex items-center gap-1 font-bold text-xs sm:text-sm">
                  <Check size={14} className="text-red-500 stroke-[3]" /> Episódios Completos
                </span>
              </motion.div>

              {/* Synopsis / description */}
              <motion.p
                variants={childVariants}
                className="mt-3 text-xs sm:text-sm md:text-base text-zinc-300 font-body max-w-2xl line-clamp-2 leading-relaxed"
                style={{ textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}
              >
                {s.resumo || "Acesso vitalício aos episódios completos em alta resolução. Assista agora no seu smartphone, tablet, smart TV ou computador."}
              </motion.p>

              {/* Price & CTA Row */}
              <motion.div
                variants={childVariants}
                className="flex flex-wrap items-center gap-3 sm:gap-5 mt-5 sm:mt-6"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-red-500 font-mono tracking-tight">
                    R$ {Number(s.preco || 6).toFixed(2)}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    ACESSO VITALÍCIO
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <Button
                    onClick={() => onBuy(s)}
                    className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 text-white font-display font-black text-xs sm:text-sm uppercase tracking-wider px-6 sm:px-8 h-11 sm:h-12 rounded-xl shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    GARANTIR ACESSO
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => onDetails(s)}
                    className="border-white/20 bg-black/40 hover:bg-black/60 text-white font-body font-semibold text-xs sm:text-sm px-4 sm:px-5 h-11 sm:h-12 rounded-xl backdrop-blur-md transition-all gap-1.5"
                  >
                    <Info size={15} />
                    <span>Detalhes</span>
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Nav arrows on sides */}
      <button
        onClick={prevSlide}
        aria-label="Slide anterior"
        className="absolute left-3 sm:left-6 md:left-8 top-1/2 -translate-y-1/2 w-10 h-10 md:w-11 md:h-11 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white transition-all z-20 shadow-xl"
      >
        <ChevronLeft size={20} />
      </button>

      <button
        onClick={nextSlide}
        aria-label="Próximo slide"
        className="absolute right-3 sm:right-6 md:right-8 top-1/2 -translate-y-1/2 w-10 h-10 md:w-11 md:h-11 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white transition-all z-20 shadow-xl"
      >
        <ChevronRight size={20} />
      </button>

      {/* Slide indicators - centered horizontal dashes */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {series.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Ir para slide ${i + 1}`}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === current ? "32px" : "16px",
              backgroundColor: i === current ? "#ffffff" : "rgba(255,255,255,0.3)",
            }}
          />
        ))}
      </div>
    </div>
  );
});


HeroCarousel.displayName = "HeroCarousel";

export default HeroCarousel;
