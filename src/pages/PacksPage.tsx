import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Package, ShoppingCart, Star, Tag, Heart, Flame } from "lucide-react";
import Header from "@/components/Header";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import CheckoutModal from "@/components/CheckoutModal";
import SeriesDetailModal from "@/components/SeriesDetailModal";
import { useCart } from "@/contexts/CartContext";
import CartPage from "@/components/CartPage";
import { fetchActivePacks, fetchActiveSeries, type DbPack, type DbSerie, type DbCoupon } from "@/lib/api";
import { Serie } from "@/data/series";
import { Button } from "@/components/ui/button";
import { stripEmojis } from "@/lib/utils";

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

const PacksPage = () => {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<DbPack[]>([]);
  const [allSeries, setAllSeries] = useState<Serie[]>([]);
  const [selectedPack, setSelectedPack] = useState<DbPack | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutItems, setCheckoutItems] = useState<{ serie: Serie }[]>([]);
  const [checkoutTotal, setCheckoutTotal] = useState(0);
  const [checkoutCoupon, setCheckoutCoupon] = useState<DbCoupon | undefined>();
  const [checkoutDiscount, setCheckoutDiscount] = useState(0);
  const { items, totalPrice, clearCart, addToCart } = useCart();

  useEffect(() => {
    Promise.all([fetchActivePacks(), fetchActiveSeries()]).then(([packsData, seriesData]) => {
      setPacks(packsData);
      setAllSeries(seriesData.map(dbSerieToSerie));
    }).catch(() => {});
  }, []);

  const getPackSeries = (pack: DbPack): Serie[] => {
    return pack.series_ids.map((id) => allSeries.find((s) => s.id === id)).filter(Boolean) as Serie[];
  };

  const handleBuyPack = (pack: DbPack) => {
    const packSeries = getPackSeries(pack);
    // Pass actual series with link_acesso so checkout shows all access links
    const packItems = packSeries.map((s) => ({ serie: s }));
    if (packItems.length === 0) {
      // Fallback: create a placeholder
      const packAsSerie: Serie = {
        id: `pack-${pack.id}`, titulo: pack.titulo, resumo: pack.descricao,
        capa_url: pack.capa_url, fundo_url: "", categoria: ["Pack"],
        vendas_count: 0, data_adicao: pack.created_at, is_hero: false,
        preco: Number(pack.preco_pack), rating: 5, elenco: [],
        temporadas: 1, status: "ativo", posicao: pack.posicao,
      };
      packItems.push({ serie: packAsSerie });
    }
    setCheckoutItems(packItems);
    setCheckoutTotal(Number(pack.preco_pack));
    setCheckoutCoupon(undefined);
    setCheckoutDiscount(0);
    setCheckoutOpen(true);
  };

  const handleCartCheckout = (coupon?: DbCoupon, discount?: number) => {
    setCartOpen(false);
    setCheckoutItems(items);
    setCheckoutTotal(totalPrice);
    setCheckoutCoupon(coupon);
    setCheckoutDiscount(discount || 0);
    setCheckoutOpen(true);
  };

  const handlePaymentSuccess = () => {
    setTimeout(() => { setCheckoutOpen(false); clearCart(); }, 500);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header activeSpecial="Planos" onOpenCart={() => setCartOpen(true)} onCheckout={handleCartCheckout} onCategoryChange={(_label, tab) => {
        if (tab.label === "Packs" || tab.label === "Combos" || tab.label === "Planos") return; // Already on packs
        if (tab.label === "Ranking") {
          navigate("/?view=ranking");
          return;
        }
        // Navigate back to home with the selected tab as a query param
        const slug = tab.filterCategory || tab.label;
        navigate(slug && slug !== "Início" ? `/?tab=${encodeURIComponent(slug)}` : "/");
      }} />

      {/* Hero */}
      <div className="relative pt-32 md:pt-36 pb-8 md:pb-12 px-4 md:px-12 lg:px-16 overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-primary/15 blur-[120px]" />
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-primary/10 border border-primary/25 rounded-full mb-5">
            <Package size={14} className="text-primary" />
            <span className="text-[10px] md:text-xs font-body font-semibold text-primary uppercase tracking-[0.14em]">Planos & Combos</span>
          </div>
          <h1 className="font-display font-extrabold text-foreground tracking-tight leading-[1.05] mb-3 text-[clamp(2rem,8vw,3.5rem)]">
            Planos <span className="text-primary">especiais</span>
          </h1>
          <p className="text-[13px] md:text-base font-body text-muted-foreground max-w-md md:max-w-lg mx-auto">
            Economize comprando pacotes de séries selecionadas com descontos exclusivos.
          </p>
        </div>
      </div>

      {/* Packs Grid */}
      <div className="px-4 md:px-12 lg:px-16 pb-16">
        <div className="max-w-6xl mx-auto">
          {packs.length === 0 ? (
            <div className="text-center py-20">
              <Package size={48} className="text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-base font-body text-muted-foreground">Nenhum plano disponível no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {packs.map((pack) => {
                const packSeries = getPackSeries(pack);
                const discount = pack.preco_original > 0
                  ? Math.round(((Number(pack.preco_original) - Number(pack.preco_pack)) / Number(pack.preco_original)) * 100)
                  : 0;

                return (
                  <div
                    key={pack.id}
                    className="bg-card/70 border border-border/40 rounded-3xl overflow-hidden hover:border-primary/40 transition-all duration-300 group flex flex-col"
                  >
                    {/* Cover */}
                    <div className="relative aspect-[16/10] overflow-hidden">
                      {pack.capa_url ? (
                        <img src={pack.capa_url} alt={pack.titulo} loading="lazy" className="w-full aspect-[3/4] object-cover object-top md:group-hover:scale-[1.03] transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center">
                          <Package size={44} className="text-primary/40" />
                        </div>
                      )}
                      {pack.posicao === 1 && (
                        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-[#F59E0B] text-zinc-950 font-display font-black text-[10px] px-2.5 py-0.5 rounded-md shadow-md uppercase tracking-wider">
                          <Flame size={11} className="fill-current text-zinc-950" /> Mais Popular
                        </div>
                      )}
                      {discount > 0 && (
                        <div className="absolute top-3 right-3 z-10 px-3 py-1 bg-primary text-primary-foreground text-[11px] font-body font-bold rounded-full shadow-lg">
                          -{discount}%
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="p-4 md:p-5 flex flex-col flex-1 -mt-6 relative">
                      <h3 className="text-base md:text-lg font-display font-bold text-foreground leading-snug mb-1.5 line-clamp-1">{pack.titulo}</h3>
                      <p className="text-xs font-body text-muted-foreground mb-4 line-clamp-2">{pack.descricao}</p>

                      {/* Series in pack */}
                      <div className="space-y-2 mb-4">
                        <p className="text-[10px] font-body text-muted-foreground/70 uppercase tracking-[0.12em]">
                          {packSeries.length} séries incluídas
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {packSeries.slice(0, 4).map((s) => (
                            <div key={s.id} className="flex items-center gap-1.5 bg-secondary/60 rounded-full pl-1 pr-2.5 py-1">
                              {s.capa_url && <img src={s.capa_url} alt="" loading="lazy" className="w-5 h-5 object-cover rounded-full" />}
                              <span className="text-[10px] font-body text-foreground/80 truncate max-w-[80px]">{s.titulo}</span>
                            </div>
                          ))}
                          {packSeries.length > 4 && (
                            <span className="text-[10px] font-body text-primary px-2 py-1">+{packSeries.length - 4} mais</span>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="flex items-end justify-between mb-4 mt-auto">
                        <div>
                          {pack.preco_original > 0 && (
                            <p className="text-[11px] font-body text-muted-foreground line-through">
                              R$ {Number(pack.preco_original).toFixed(2).replace(".", ",")}
                            </p>
                          )}
                          <p className="text-2xl font-display font-extrabold text-foreground">
                            R$ {Number(pack.preco_pack).toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-star-filled">
                          <Star size={12} fill="currentColor" />
                          <span className="text-[11px] font-body font-semibold">Plano</span>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleBuyPack(pack)}
                        className="w-full h-11 bg-gradient-to-r from-red-600 via-rose-600 to-rose-700 hover:brightness-110 text-white font-bold rounded-xl text-xs sm:text-sm uppercase tracking-wide gap-2 cursor-pointer shadow-md"
                      >
                        <ShoppingCart size={16} />
                        Garantir Acesso
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>


      {/* Footer */}
      <footer className="px-4 md:px-12 lg:px-16 py-10 border-t border-border/10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <h4 className="text-2xl font-display text-foreground/80 tracking-[0.12em] mb-1 flex items-center justify-center md:justify-start gap-1">
              HANGAR <Heart size={16} className="text-primary fill-primary mx-0.5" /> BOX
            </h4>
            <p className="text-xs font-body text-muted-foreground/50">Séries, livros e conteúdos exclusivos para você.</p>
          </div>
          <div className="flex gap-6 text-xs font-body text-muted-foreground/40">
            <a href="/" className="hover:text-foreground/60 transition-colors">Início</a>
          </div>
        </div>
        <p className="text-center text-[10px] font-body text-muted-foreground/30 mt-6 flex items-center justify-center gap-1">
          © 2026 Hangar <Heart size={11} className="text-primary fill-primary mx-0.5" /> Box. Todos os direitos reservados.
        </p>
        <p className="text-center text-[10px] font-body text-muted-foreground/40 mt-2">Desenvolvido por <span className="text-primary/70 font-semibold">PixelLoom</span></p>
      </footer>

      {cartOpen && <CartPage onClose={() => setCartOpen(false)} onCheckout={handleCartCheckout} />}
      {checkoutOpen && checkoutItems.length > 0 && (
        <CheckoutModal
          items={checkoutItems}
          totalPrice={checkoutTotal}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handlePaymentSuccess}
          appliedCoupon={checkoutCoupon}
          discount={checkoutDiscount}
        />
      )}
      <WhatsAppFloat />
    </div>
  );
};

export default PacksPage;
