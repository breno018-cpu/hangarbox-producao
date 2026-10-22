import { useState, useCallback, useMemo, useEffect } from "react";
import { trackViewContent } from "@/lib/metaPixel";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Play, ShoppingCart, Check, Clock, Users, TrendingUp, Flame, MessageCircle } from "lucide-react";
import { Serie } from "@/data/series";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { getReviewsForSerie, getBuyerCount, isTopSeller } from "@/data/socialProof";
import { useIsMobile } from "@/hooks/use-mobile";

interface SeriesDetailModalProps {
  serie: Serie;
  onClose: () => void;
  onBuy: (serie: Serie) => void;
}

const backdrop = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const desktopModal = {
  hidden: { opacity: 0, scale: 0.95, y: 30 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, damping: 25, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.2 } },
};

const mobileModal = {
  hidden: { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, damping: 30, stiffness: 300 } },
  exit: { opacity: 0, y: "100%", transition: { duration: 0.25 } },
};

const SeriesDetailModal = ({ serie, onClose, onBuy }: SeriesDetailModalProps) => {
  const { addToCart, isInCart } = useCart();
  const inCart = isInCart(serie.id);
  const reviews = useMemo(() => getReviewsForSerie(serie.id), [serie.id]);
  const recentBuyers = useMemo(() => getBuyerCount(serie.id), [serie.id]);
  const topSeller = isTopSeller(serie.id);
  const isMobile = useIsMobile();

  // Meta Pixel: ViewContent
  useEffect(() => {
    trackViewContent({
      content_name: serie.titulo,
      content_ids: [serie.id],
      content_type: "product",
      value: serie.preco,
    });
  }, [serie.id, serie.titulo, serie.preco]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
        <motion.div
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        />

        <motion.div
          className="relative w-full max-w-2xl max-h-[92vh] md:max-h-[88vh] overflow-hidden rounded-t-2xl md:rounded-2xl bg-card border border-border/15 shadow-elevated md:mx-4"
          variants={isMobile ? mobileModal : desktopModal}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Drag handle on mobile */}
          {isMobile && (
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>
          )}

          <div className="relative h-36 md:h-60 overflow-hidden">
            <img src={serie.fundo_url} alt="" className="w-full h-full object-cover" decoding="async" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-card/50 via-transparent to-transparent" />
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 md:w-9 md:h-9 rounded-full bg-background/50 backdrop-blur-sm flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-background/70 transition-colors duration-200">
              <X size={14} />
            </button>
          </div>

          <div className="px-4 md:px-8 pb-5 md:pb-8 -mt-10 md:-mt-14 relative overflow-y-auto max-h-[calc(92vh-9rem)] md:max-h-[calc(88vh-15rem)]">
            <motion.h2
              className="text-2xl md:text-4xl font-display text-foreground tracking-wide mb-2 md:mb-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              {serie.titulo}
            </motion.h2>

            <motion.div
              className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4 flex-wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={isMobile ? 12 : 14} className={star <= Math.round(serie.rating) ? "text-star-filled fill-star-filled" : "text-muted-foreground/30"} />
                ))}
                <span className="text-xs md:text-sm font-body text-foreground/60 ml-1">{serie.rating}</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span className="text-xs md:text-sm font-body text-muted-foreground flex items-center gap-1">
                <Clock size={11} />{serie.temporadas}T
              </span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span className="text-xs md:text-sm font-body text-muted-foreground flex items-center gap-1">
                <Users size={11} />{serie.vendas_count.toLocaleString()}
              </span>
            </motion.div>

            <div className="flex flex-wrap gap-1.5 md:gap-2 mb-3 md:mb-4">
              {serie.categoria.map((cat, i) => (
                <motion.span
                  key={cat}
                  className="text-[10px] md:text-xs font-body px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-secondary text-secondary-foreground"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                >
                  {cat}
                </motion.span>
              ))}
            </div>

            <p className="text-xs md:text-sm font-body text-foreground/55 leading-relaxed mb-3 md:mb-4">{serie.resumo}</p>

            <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4 flex-wrap">
              {topSeller && (
                <span className="flex items-center gap-1 text-[10px] md:text-xs font-body font-semibold text-primary bg-primary/10 px-2 md:px-3 py-1 md:py-1.5 rounded-full">
                  <Flame size={11} /> Mais Popular
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] md:text-xs font-body text-accent">
                <TrendingUp size={11} /> {recentBuyers} compraram hoje
              </span>
            </div>

            {/* Guarantee checkmarks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-300">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check size={14} className="text-emerald-400 flex-shrink-0" />
                <span className="text-zinc-200">Acesso Vitalício (Sem mensalidades)</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check size={14} className="text-emerald-400 flex-shrink-0" />
                <span className="text-zinc-200">Assista no Celular, Smart TV ou PC</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check size={14} className="text-emerald-400 flex-shrink-0" />
                <span className="text-zinc-200">Episódios Completos em Alta Resolução</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check size={14} className="text-emerald-400 flex-shrink-0" />
                <span className="text-zinc-200">Entrega Automática e Imediata</span>
              </div>
            </div>

            {/* Reviews */}
            <div className="mb-4 md:mb-5">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle size={12} className="text-primary" />
                <span className="text-[10px] md:text-xs font-body font-bold text-foreground/80 uppercase tracking-wider">
                  Avaliações de Clientes Verificados
                </span>
              </div>
              <div className="space-y-2">
                {reviews.map((review, i) => (
                  <motion.div
                    key={i}
                    className="p-2.5 md:p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary/20 text-rose-300 flex items-center justify-center text-[10px] font-bold">
                          {review.name[0]}
                        </div>
                        <span className="text-[11px] font-semibold text-zinc-200">{review.name}</span>
                        <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.2 rounded-full font-bold">
                          Compra verificada
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={10} className={s <= review.rating ? "text-amber-400 fill-amber-400" : "text-zinc-700"} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{review.text}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Purchase box */}
            <motion.div
              className="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 via-zinc-900/80 to-zinc-900/90 border border-rose-500/30 shadow-xl"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                    Acesso Completo & Vitalício
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Liberação instantânea após o pagamento via PIX
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-black text-red-500 font-mono font-black tracking-tight">
                    R$ {Number(serie.preco || 6).toFixed(2).replace(".", ",")}
                  </div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">
                    Sem mensalidade
                  </span>
                </div>
              </div>

              <div className="flex gap-2 sm:gap-3">
                <Button
                  onClick={() => onBuy(serie)}
                  size={isMobile ? "sm" : "default"}
                  className="flex-1 bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:brightness-110 text-white font-bold rounded-xl h-12 shadow-lg transition-all text-xs sm:text-sm uppercase tracking-wide gap-2"
                >
                  <Play size={15} fill="currentColor" />
                  <span>Garantir Acesso</span>
                </Button>

                <Button
                  variant="outline"
                  size={isMobile ? "sm" : "default"}
                  onClick={() => addToCart(serie)}
                  disabled={inCart}
                  className={`rounded-xl h-12 px-4 transition-all border ${
                    inCart
                      ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
                      : "border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 bg-zinc-950"
                  }`}
                >
                  {inCart ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                      <Check size={16} /> No Carrinho
                    </span>
                  ) : (
                    <ShoppingCart size={16} />
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SeriesDetailModal;
