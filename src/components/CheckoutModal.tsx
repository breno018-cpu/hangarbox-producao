import { useState, useEffect, useRef, useCallback } from "react";
import { trackInitiateCheckout, trackPurchase } from "@/lib/metaPixel";
import { X, Copy, Check, QrCode, ShieldCheck, Lock, Tag, ExternalLink, Download, Loader2, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { Serie } from "@/data/series";
import { Button } from "@/components/ui/button";
import { type DbCoupon, type DbOrder, createOrder, createMPPixPayment, checkOrderPaymentStatus, fetchSeriesAccessLinks, resendOrderEmail } from "@/lib/api";

interface CheckoutModalProps {
  items: { serie: Serie }[];
  totalPrice: number;
  onClose: () => void;
  onSuccess: () => void;
  appliedCoupon?: DbCoupon;
  discount?: number;
}

interface PixPaymentData {
  payment_id: string;
  status: string;
  qr_code: string;
  qr_code_base64: string;
  expires_at: string | null;
}

const CheckoutModal = ({ items, totalPrice, onClose, onSuccess, appliedCoupon, discount = 0 }: CheckoutModalProps) => {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [unlockedLinks, setUnlockedLinks] = useState<Record<string, string>>({});
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [emailError, setEmailError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pixPayment, setPixPayment] = useState<PixPaymentData | null>(null);
  const [pixExpired, setPixExpired] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [autoCheckCount, setAutoCheckCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const finalPrice = Math.max(totalPrice - discount, 0);

  // Load access links ONLY after payment is confirmed
  useEffect(() => {
    if (!confirmed) return;
    fetchSeriesAccessLinks(items.map((i) => i.serie.id))
      .then((map) => {
        const links: Record<string, string> = {};
        for (const [id, val] of Object.entries(map)) {
          links[id] = val.link_acesso;
        }
        setUnlockedLinks(links);
      })
      .catch(() => {});
  }, [confirmed, items]);

  // Meta Pixel: InitiateCheckout
  useEffect(() => {
    trackInitiateCheckout({
      content_ids: items.map((i) => i.serie.id),
      num_items: items.length,
      value: finalPrice,
    });
  }, []); // fire once on mount

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Auto-poll payment status every 5s once PIX is generated
  useEffect(() => {
    if (!orderId || !customerEmail || confirmed || pixExpired) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    const poll = async () => {
      try {
        const status = await checkOrderPaymentStatus({ order_id: orderId, user_email: customerEmail });
        setAutoCheckCount((c) => c + 1);
        if (status.approved) {
          setConfirmed(true);
          setPaymentNotice("");
          setPaymentError("");
          const orderSnapshot: DbOrder = {
            id: orderId,
            user_email: customerEmail.trim().toLowerCase(),
            user_name: customerName || customerEmail.split("@")[0],
            items: items.map((i) => ({
              id: i.serie.id,
              titulo: i.serie.titulo,
              preco: i.serie.preco,
            })),
            total: finalPrice,
            status: "pago",
            payment_method: "pix",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          resendOrderEmail(orderId, orderSnapshot).catch((e) => console.warn("Email auto-dispatch:", e));
          trackPurchase({
            content_ids: items.map((i) => i.serie.id),
            content_type: "product",
            num_items: items.length,
            value: finalPrice,
          });
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // silent
      }
    };

    // Poll every 7s to prevent hitting Mercado Pago search rate limits
    pollRef.current = setInterval(poll, 7000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orderId, customerEmail, confirmed, pixExpired]);

  // Countdown timer for PIX expiration
  useEffect(() => {
    if (!pixPayment?.expires_at || confirmed) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    const updateCountdown = () => {
      const exp = new Date(pixPayment.expires_at!).getTime();
      const now = Date.now();
      const diff = exp - now;
      if (diff <= 0) {
        setPixExpired(true);
        setCountdown("Expirado");
        if (countdownRef.current) clearInterval(countdownRef.current);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h > 0 ? `${h}h ` : ""}${m.toString().padStart(2, "0")}min ${s.toString().padStart(2, "0")}s`);
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [pixPayment?.expires_at, confirmed]);

  const handleRegeneratePixCode = async () => {
    setPixExpired(false);
    setPixPayment(null);
    setOrderId(null);
    setPaymentNotice("");
    setPaymentError("");
    setCountdown("");
    setAutoCheckCount(0);
  };

  const handleCopy = () => {
    if (!pixPayment?.qr_code) return;
    navigator.clipboard.writeText(pixPayment.qr_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleConfirmPayment = async () => {
    if (!customerEmail || !validateEmail(customerEmail)) {
      setEmailError("Informe um e-mail válido");
      return;
    }

    setEmailError("");
    setPaymentError("");

    try {
      if (!orderId) {
        setConfirming(true);

        const order = await createOrder({
          user_email: customerEmail.trim().toLowerCase(),
          user_name: customerName || customerEmail.split("@")[0],
          items: items.map((i) => ({
            id: i.serie.id,
            titulo: i.serie.titulo,
            preco: i.serie.preco,
          })),
          total: finalPrice,
          payment_method: "pix",
        });

        const pix = await createMPPixPayment({
          order_id: order.id,
          amount: finalPrice,
          description: items.map((i) => i.serie.titulo).join(" | "),
          payer: {
            name: customerName || customerEmail.split("@")[0],
            email: customerEmail,
          },
        });

        setOrderId(order.id);
        setPixPayment(pix);
        setPaymentNotice("QR Code PIX gerado! Verificação automática ativada — aguardando pagamento...");
        return;
      }

      setCheckingPayment(true);
      setPaymentError("");

      const status = await checkOrderPaymentStatus({
        order_id: orderId,
        user_email: customerEmail,
      });

      if (status.approved) {
        setConfirmed(true);
        setPaymentNotice("");
        setPaymentError("");
        const orderSnapshot: DbOrder = {
          id: orderId,
          user_email: customerEmail.trim().toLowerCase(),
          user_name: customerName || customerEmail.split("@")[0],
          items: items.map((i) => ({
            id: i.serie.id,
            titulo: i.serie.titulo,
            preco: i.serie.preco,
          })),
          total: finalPrice,
          status: "pago",
          payment_method: "pix",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        resendOrderEmail(orderId, orderSnapshot).catch((e) => console.warn("Email auto-dispatch:", e));
        trackPurchase({
          content_ids: items.map((i) => i.serie.id),
          content_type: "product",
          num_items: items.length,
          value: finalPrice,
        });
        return;
      }

      setPaymentNotice("Pagamento em processamento. Assim que o banco confirmar a transferência, seu acesso é liberado automaticamente!");
    } catch (err: any) {
      console.warn("Payment flow check status:", err);
      if (err?.message && !err.message.includes("verificar") && !err.message.includes("Falha")) {
        setPaymentError(err.message);
      } else {
        setPaymentNotice("Aguardando confirmação bancária... Pode levar alguns segundos após a transferência.");
      }
    } finally {
      setConfirming(false);
      setCheckingPayment(false);
    }
  };

  const handleClose = () => {
    if (confirmed) {
      onSuccess();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" onClick={handleClose} />

      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border/20 rounded-2xl shadow-elevated animate-scale-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lock size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-display text-foreground tracking-wide">
                  {confirmed ? "COMPRA CONFIRMADA" : "CHECKOUT"}
                </h3>
                <p className="text-[11px] font-body text-success flex items-center gap-1">
                  <ShieldCheck size={11} /> Pagamento seguro
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <X size={16} />
            </button>
          </div>

          {confirmed ? (
            <div className="animate-fade-in">
              <div className="text-center py-6">
                <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-5">
                  <ShieldCheck size={40} className="text-success" />
                </div>
                <h4 className="text-2xl font-display text-foreground mb-2">OBRIGADO!</h4>
                <p className="text-sm font-body text-muted-foreground mb-6">
                  Pagamento aprovado com sucesso. Seus acessos estão disponíveis abaixo.
                </p>
              </div>

              {/* Access Links */}
              <div className="bg-secondary/30 border border-border/20 rounded-xl p-4 mb-4">
                <h5 className="text-sm font-display text-foreground tracking-wide mb-3 flex items-center gap-2">
                  <Download size={16} className="text-primary" />
                  SEUS ACESSOS
                </h5>
                <div className="space-y-3">
                  {items.map((item) => {
                    const linkAcesso = unlockedLinks[item.serie.id] || "";
                    return (
                      <div key={item.serie.id} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border/10">
                        <img src={item.serie.capa_url} alt="" className="w-11 h-14.5 aspect-[3/4] object-cover object-top rounded flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body font-medium text-foreground truncate">{item.serie.titulo}</p>
                          {linkAcesso ? (
                            <a href={linkAcesso} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-body text-primary hover:text-primary/80 flex items-center gap-1 mt-1 transition-colors">
                              <ExternalLink size={12} /> Acessar conteúdo
                            </a>
                          ) : (
                            <p className="text-[10px] font-body text-muted-foreground mt-1">Acesso enviado por e-mail</p>
                          )}
                        </div>
                        {linkAcesso && (
                          <Button size="sm" variant="outline" onClick={() => window.open(linkAcesso, "_blank")}
                            className="shrink-0 text-xs border-primary/30 text-primary hover:bg-primary/10">
                            Abrir
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>


              <Button onClick={handleClose} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-body font-semibold rounded-lg py-5">
                Fechar
              </Button>
            </div>
          ) : (
            <>
              {/* Items */}
              <div className="space-y-2.5 mb-4">
                {items.map((item) => (
                  <div key={item.serie.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                    <img src={item.serie.capa_url} alt={item.serie.titulo} className="w-12 h-16 aspect-[3/4] object-cover object-top rounded flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body font-medium text-foreground truncate">{item.serie.titulo}</p>
                      <p className="text-xs font-body text-muted-foreground">Acesso vitalício</p>
                    </div>
                    <span className="text-sm font-display text-foreground">R${item.serie.preco.toFixed(0)}</span>
                  </div>
                ))}
              </div>

              {/* Coupon applied */}
              {appliedCoupon && discount > 0 && (
                <div className="flex items-center justify-between bg-success/10 border border-success/20 rounded-lg px-4 py-2.5 mb-4 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Tag size={12} className="text-success" />
                    <span className="text-xs font-body font-bold text-success">{appliedCoupon.code}</span>
                  </div>
                  <span className="text-xs font-body text-success">- R$ {discount.toFixed(2).replace(".", ",")}</span>
                </div>
              )}

              {/* Total */}
              <div className="p-4 bg-secondary/30 rounded-lg mb-5">
                {discount > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-body text-muted-foreground">Subtotal</span>
                    <span className="text-sm font-body text-muted-foreground line-through">R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-body text-muted-foreground">Total</span>
                  <span className="text-2xl font-display font-black text-red-500">R$ {finalPrice.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>

              {/* Customer info */}
              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-[10px] font-body text-muted-foreground mb-1 block uppercase tracking-wider">Seu Nome</label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome completo"
                    className="w-full bg-secondary/30 border border-border/20 rounded-lg px-3 py-2.5 text-sm font-body text-foreground outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-body text-muted-foreground mb-1 block uppercase tracking-wider">Seu E-mail *</label>
                  <input type="email" value={customerEmail}
                    readOnly={Boolean(orderId)}
                    onChange={(e) => {
                      if (orderId) return;
                      setCustomerEmail(e.target.value);
                      setEmailError("");
                    }}
                    placeholder="email@exemplo.com"
                    className={`w-full bg-secondary/30 border rounded-lg px-3 py-2.5 text-sm font-body text-foreground outline-none transition-colors ${
                      emailError
                        ? "border-destructive/50 focus:border-destructive"
                        : "border-border/20 focus:border-primary/50"
                    }`} />
                  {orderId && <p className="text-[10px] font-body text-muted-foreground mt-1">E-mail bloqueado para garantir validação segura do pagamento.</p>}
                  {emailError && <p className="text-[10px] font-body text-destructive mt-1">{emailError}</p>}
                </div>
              </div>

              {/* PIX */}
              <div className="animate-fade-in mb-5">
                <div className="text-center mb-5">
                  <p className="text-xs font-body text-muted-foreground mb-3">Escaneie o QR Code PIX com seu banco</p>
                  <div className="w-44 h-44 mx-auto bg-card border border-border/20 rounded-xl flex items-center justify-center overflow-hidden">
                    {pixPayment?.qr_code_base64 ? (
                      <img
                        src={`data:image/png;base64,${pixPayment.qr_code_base64}`}
                        alt="QR Code PIX para pagamento"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <QrCode size={56} />
                        <p className="text-[10px] font-body">Clique em gerar QR Code PIX</p>
                      </div>
                    )}
                  </div>
                  {pixPayment?.expires_at && (
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <Clock size={11} className={pixExpired ? "text-destructive" : "text-primary"} />
                      <p className={`text-[10px] font-body font-semibold ${pixExpired ? "text-destructive" : "text-primary"}`}>
                        {pixExpired ? "PIX Expirado" : countdown}
                      </p>
                    </div>
                  )}
                  {pixExpired && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegeneratePixCode}
                      className="mt-3 text-xs border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <RefreshCw size={12} /> Gerar novo QR Code
                    </Button>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-body text-muted-foreground mb-1.5 block uppercase tracking-wider">PIX Copia e Cola</label>
                  <div className="flex items-center gap-2 bg-secondary/30 rounded-lg p-2.5">
                    <input
                      readOnly
                      value={pixPayment?.qr_code || ""}
                      placeholder="Gere o QR Code para obter o código PIX"
                      className="flex-1 bg-transparent text-xs font-body text-foreground/70 outline-none truncate"
                    />
                    <Button
                      size="sm"
                      onClick={handleCopy}
                      disabled={!pixPayment?.qr_code}
                      className={`px-4 text-xs rounded-md transition-colors ${
                        copied ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                    </Button>
                  </div>
                </div>
              </div>

              {paymentNotice && (
                <div className="flex items-start gap-2 bg-secondary/40 border border-border/20 rounded-lg px-3 py-2 mb-3">
                  <ShieldCheck size={14} className="text-primary mt-0.5" />
                  <div>
                    <p className="text-[11px] font-body text-muted-foreground">{paymentNotice}</p>
                    {orderId && !confirmed && !pixExpired && autoCheckCount > 0 && (
                      <p className="text-[9px] font-body text-muted-foreground/60 mt-1">
                        Verificação automática #{autoCheckCount} • próxima em 5s
                      </p>
                    )}
                  </div>
                </div>
              )}

              {paymentError && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 mb-3">
                  <AlertCircle size={14} className="text-destructive mt-0.5" />
                  <p className="text-[11px] font-body text-destructive">{paymentError}</p>
                </div>
              )}

              <Button onClick={pixExpired ? handleRegeneratePixCode : handleConfirmPayment} disabled={confirming || checkingPayment}
                className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:brightness-110 text-white font-body font-bold rounded-xl py-6 transition-all shadow-lg cursor-pointer">
                {confirming || checkingPayment ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {confirming ? "Gerando QR Code PIX..." : "Verificando pagamento..."}
                  </span>
                ) : (
                  <>
                    {pixExpired ? (
                      <><RefreshCw size={18} /> Gerar novo QR Code PIX</>
                    ) : orderId ? (
                      <><ShieldCheck size={18} /> Já paguei — Verificar pagamento</>
                    ) : (
                      <><QrCode size={18} /> GARANTIR ACESSO VIA PIX</>
                    )}
                  </>
                )}
              </Button>
              <p className="text-[10px] font-body text-muted-foreground/50 text-center mt-3">
                Dados protegidos com criptografia de ponta a ponta.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
