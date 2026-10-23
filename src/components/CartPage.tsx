import { useState } from "react";
import { Trash2, ShoppingCart, ArrowLeft, Tag, X, Check, Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { validateCoupon, calculateDiscount, type DbCoupon } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";

interface CartPageProps {
  onClose: () => void;
  onCheckout: (coupon?: DbCoupon, discount?: number) => void;
}

const CartPage = ({ onClose, onCheckout }: CartPageProps) => {
  const { items, totalPrice, removeFromCart, clearCart } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<DbCoupon | null>(null);
  const [couponError, setCouponError] = useState("");
  const [validating, setValidating] = useState(false);
  const isMobile = useIsMobile();

  const discount = appliedCoupon ? calculateDiscount(appliedCoupon, totalPrice) : 0;
  const finalPrice = totalPrice - discount;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError("");
    setValidating(true);
    const result = await validateCoupon(couponCode, totalPrice);
    setValidating(false);

    if (result.valid && result.coupon) {
      setAppliedCoupon(result.coupon);
      setCouponError("");
    } else {
      setCouponError(result.error || "Cupom inválido");
      setAppliedCoupon(null);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  return (
    <div className="fixed inset-0 z-[55] bg-background/95 backdrop-blur-xl animate-fade-in overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={onClose} className="p-1.5 md:p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <ArrowLeft size={isMobile ? 16 : 18} />
            </button>
            <div>
              <h2 className="text-xl md:text-3xl font-display text-foreground tracking-wide">MEU CARRINHO</h2>
              <p className="text-[10px] md:text-xs font-body text-muted-foreground mt-0.5">
                {items.length} {items.length === 1 ? "item" : "itens"}
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <button onClick={clearCart} className="text-[10px] md:text-xs font-body text-muted-foreground hover:text-destructive transition-colors">
              Limpar
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 md:py-20 animate-fade-in">
            <ShoppingCart size={isMobile ? 32 : 40} className="text-muted-foreground/30 mx-auto mb-3 md:mb-4" />
            <p className="text-base md:text-lg font-display text-foreground mb-1">Carrinho vazio</p>
            <p className="text-xs md:text-sm font-body text-muted-foreground mb-4 md:mb-5">Explore nosso catálogo!</p>
            <Button onClick={onClose} size={isMobile ? "sm" : "default"} className="bg-primary hover:bg-primary/90 text-primary-foreground font-body rounded-lg px-5 md:px-6">
              Explorar séries
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
              {items.map((item, idx) => (
                <div
                  key={item.serie.id}
                  className="flex items-center gap-3 p-3 md:p-4 bg-card border border-border/10 rounded-xl group animate-fade-in"
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  <img src={item.serie.capa_url} alt={item.serie.titulo} className="w-12 h-16 md:w-14 md:h-18.5 aspect-[3/4] object-cover object-top rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-body font-semibold text-foreground text-sm md:text-base truncate">{item.serie.titulo}</h4>
                    <p className="text-[10px] md:text-xs font-body text-muted-foreground mt-0.5 line-clamp-1">{item.serie.resumo}</p>
                  </div>
                  <p className="text-sm md:text-lg font-display font-black text-red-500 whitespace-nowrap">R$ {item.serie.preco.toFixed(2).replace(".", ",")}</p>
                  <button
                    onClick={() => removeFromCart(item.serie.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Trash2 size={isMobile ? 14 : 16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Coupon Section */}
            <div className="bg-card border border-border/10 rounded-xl p-3 md:p-4 mb-3 md:mb-4">
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <Tag size={isMobile ? 12 : 14} className="text-accent" />
                <span className="text-[10px] md:text-xs font-body font-semibold text-foreground uppercase tracking-wider">Cupom</span>
              </div>

              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-success/10 border border-success/20 rounded-lg px-3 md:px-4 py-2.5 md:py-3">
                  <div className="flex items-center gap-2">
                    <Check size={12} className="text-success" />
                    <span className="text-xs md:text-sm font-body font-bold text-success">{appliedCoupon.code}</span>
                    <span className="text-[10px] md:text-xs font-body text-success/70">
                      {appliedCoupon.discount_type === "percentage"
                        ? `${appliedCoupon.discount_value}% OFF`
                        : `- R$ ${Number(appliedCoupon.discount_value).toFixed(2).replace(".", ",")}`}
                    </span>
                  </div>
                  <button onClick={handleRemoveCoupon} className="p-1 text-success/50 hover:text-success transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                    placeholder="Código do cupom"
                    className="flex-1 bg-secondary/50 border border-border/20 rounded-lg px-3 py-2 md:py-2.5 text-xs md:text-sm font-body font-mono text-foreground uppercase outline-none focus:border-accent/50 transition-colors min-w-0"
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                  />
                  <Button
                    onClick={handleApplyCoupon}
                    disabled={validating || !couponCode.trim()}
                    size={isMobile ? "sm" : "default"}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground font-body rounded-lg px-4 md:px-5"
                  >
                    {validating ? <Loader2 size={14} className="animate-spin" /> : "Aplicar"}
                  </Button>
                </div>
              )}
              {couponError && (
                <p className="text-[10px] md:text-xs font-body text-destructive mt-2 animate-fade-in">{couponError}</p>
              )}
            </div>

            {/* Summary */}
            <div className="bg-card border border-border/10 rounded-xl p-4 md:p-6">
              <div className="space-y-2 md:space-y-3 mb-4 md:mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs md:text-sm font-body text-muted-foreground">Subtotal</span>
                  <span className="text-xs md:text-sm font-body text-foreground">R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between animate-fade-in">
                    <span className="text-xs md:text-sm font-body text-success">Desconto</span>
                    <span className="text-xs md:text-sm font-body text-success">- R$ {discount.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                <div className="border-t border-border/10 pt-2 md:pt-3 flex items-center justify-between">
                  <span className="text-xs md:text-sm font-body font-semibold text-foreground">Total</span>
                  <span className="text-xl md:text-2xl font-display font-black text-red-500">R$ {finalPrice.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
              <Button
                onClick={() => onCheckout(appliedCoupon || undefined, discount)}
                className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 text-white font-body font-bold py-5 md:py-6 rounded-xl transition-all hover:scale-[1.01] text-xs md:text-sm shadow-lg cursor-pointer"
              >
                GARANTIR ACESSO
              </Button>
              <p className="text-center text-[9px] md:text-[10px] font-body text-muted-foreground/50 mt-2 md:mt-3">
                Pagamento seguro • Acesso imediato
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CartPage;
