import React, { useState, useEffect, useRef } from "react";
import { Bot, X, Send, Sparkles, MessageCircle, Film, ShieldCheck, Zap } from "lucide-react";
import { fetchExtensionsConfig, fetchActiveSeries, type DbSerie } from "@/lib/api";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
  recommendations?: { id: string; titulo: string; preco: number; capa_url?: string }[];
}

export const EvoraAIChatFloat: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [botName, setBotName] = useState("Évora IA");
  const [greeting, setGreeting] = useState("Olá! Sou a Évora, atendente virtual da HangarBox. Como posso te ajudar a escolher uma série hoje?");
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [seriesCatalog, setSeriesCatalog] = useState<DbSerie[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if extension is active
  useEffect(() => {
    fetchExtensionsConfig()
      .then((cfg) => {
        const evora = cfg.extensions?.pixel_evora;
        if (evora && evora.enabled && evora.settings?.show_floating_widget !== false) {
          setEnabled(true);
          if (evora.settings?.bot_name) setBotName(evora.settings.bot_name);
          if (evora.settings?.greeting_message) setGreeting(evora.settings.greeting_message);
        }
      })
      .catch(() => {});

    fetchActiveSeries()
      .then((series) => setSeriesCatalog(series))
      .catch(() => {});
  }, []);

  // Initialize greeting when opening
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          sender: "bot",
          text: greeting,
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [isOpen, messages.length, greeting]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  if (!enabled) return null;

  const handleSend = async (userText: string) => {
    const text = userText.trim();
    if (!text) return;

    const userMsg: Message = {
      id: String(Date.now()),
      sender: "user",
      text,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    // Simulate smart AI response based on catalog & customer intent
    setTimeout(() => {
      const lower = text.toLowerCase();
      let reply = "";
      let recs: { id: string; titulo: string; preco: number; capa_url?: string }[] | undefined;

      if (lower.includes("pix") || lower.includes("pagar") || lower.includes("pagamento") || lower.includes("cartão")) {
        reply = "O pagamento é feito via PIX automático com confirmação imediata! Assim que o banco aprova a transferência, o link de acesso ao Google Drive / pCloud é liberado na hora na sua tela e também enviado para o seu e-mail.";
      } else if (lower.includes("romance") || lower.includes("amor") || lower.includes("casal")) {
        const matches = seriesCatalog
          .filter((s) => (s.categoria || []).some((c) => c.toLowerCase().includes("romance")))
          .slice(0, 3);
        if (matches.length > 0) {
          reply = "Tenho ótimas séries de romance para você maratonar hoje! Olha essas recomendações especiais:";
          recs = matches.map((m) => ({ id: m.id, titulo: m.titulo, preco: m.preco, capa_url: m.capa_url }));
        } else {
          reply = "Temos romances emocionantes dublados no catálogo! Você pode filtrar pela categoria Romance no topo do site.";
        }
      } else if (lower.includes("dublado") || lower.includes("dublada") || lower.includes("áudio") || lower.includes("português")) {
        const matches = seriesCatalog
          .filter((s) => s.titulo.toLowerCase().includes("dublado") || s.titulo.toLowerCase().includes("dublada"))
          .slice(0, 3);
        reply = "A maioria das nossas obras conta com dublagem completa em português brasileiro de alta definição! Dê uma olhada nestas:";
        recs = matches.map((m) => ({ id: m.id, titulo: m.titulo, preco: m.preco, capa_url: m.capa_url }));
      } else if (lower.includes("mais assistid") || lower.includes("populares") || lower.includes("top 10") || lower.includes("recomenda")) {
        const matches = [...seriesCatalog]
          .sort((a, b) => (b.vendas_count || 0) - (a.vendas_count || 0))
          .slice(0, 3);
        reply = "Aqui estão as obras mais assistidas e queridinhas da nossa comunidade:";
        recs = matches.map((m) => ({ id: m.id, titulo: m.titulo, preco: m.preco, capa_url: m.capa_url }));
      } else if (lower.includes("como assistir") || lower.includes("assistir") || lower.includes("onde")) {
        reply = "Você pode assistir online diretamente no nosso player integrado no navegador ou baixar todos os episódios completos em alta qualidade pelo Google Drive / pCloud!";
      } else {
        reply = `Entendi! Como atendente inteligente da HangarBox, estou aqui para te ajudar. Você pode clicar em qualquer série para ver os detalhes, sinopse e comprar com liberação Pix em menos de 1 minuto!`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "bot",
          text: reply,
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          recommendations: recs,
        },
      ]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <div className="fixed bottom-24 right-5 z-40">
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:brightness-110 text-white px-4 py-3 rounded-full shadow-xl shadow-rose-600/30 transition-all duration-300 hover:scale-105"
          aria-label="Falar com a atendente de IA Évora"
        >
          <div className="relative">
            <Bot size={20} className="animate-bounce" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-rose-600 rounded-full animate-pulse" />
          </div>
          <div className="text-left hidden sm:block">
            <span className="text-[11px] font-extrabold uppercase tracking-wider block leading-tight">
              {botName}
            </span>
            <span className="text-[9px] text-white/80 block leading-tight">
              Atendente IA Online
            </span>
          </div>
        </button>
      )}

      {/* Floating Chat Box */}
      {isOpen && (
        <div className="w-[340px] sm:w-[380px] h-[480px] bg-zinc-950 text-white rounded-3xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-rose-950/80 via-zinc-900 to-zinc-900 border-b border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-rose-500/25">
                <Bot size={20} />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-zinc-950 rounded-full" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold tracking-tight flex items-center gap-1.5">
                  <span>{botName}</span>
                  <span className="text-[9px] font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded border border-rose-500/30">
                    IA 24/7
                  </span>
                </h4>
                <p className="text-[10px] text-zinc-400">Atendente e Suporte Inteligente</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs scrollbar-thin">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-xs ${
                    m.sender === "user"
                      ? "bg-[#E31C25] text-white rounded-tr-xs"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-xs"
                  }`}
                >
                  <p>{m.text}</p>

                  {/* Recommendations Cards */}
                  {m.recommendations && m.recommendations.length > 0 && (
                    <div className="mt-2.5 space-y-1.5 pt-2 border-t border-zinc-800">
                      {m.recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className="flex items-center gap-2 p-1.5 bg-zinc-950/80 rounded-xl border border-zinc-800"
                        >
                          {rec.capa_url && (
                            <img
                              src={rec.capa_url}
                              alt={rec.titulo}
                              className="w-8 h-10 object-cover rounded-md shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-bold text-white block truncate">
                              {rec.titulo}
                            </span>
                            <span className="text-[10px] text-rose-400 font-bold">
                              R$ {rec.preco.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-zinc-500 mt-1 px-1">{m.time}</span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 p-3 bg-zinc-900 border border-zinc-800 rounded-2xl max-w-[80px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse delay-200" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions */}
          <div className="px-3 py-1.5 bg-zinc-900/60 border-t border-zinc-800/50 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => handleSend("Quais são as séries mais assistidas?")}
              className="text-[10px] whitespace-nowrap bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-full transition-colors shrink-0"
            >
              🔥 Mais Assistidas
            </button>
            <button
              onClick={() => handleSend("Como funciona o pagamento Pix?")}
              className="text-[10px] whitespace-nowrap bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-full transition-colors shrink-0"
            >
              💳 Liberação Pix
            </button>
            <button
              onClick={() => handleSend("Tem séries dubladas?")}
              className="text-[10px] whitespace-nowrap bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-full transition-colors shrink-0"
            >
              🎬 Séries Dubladas
            </button>
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend(inputValue);
              }}
              placeholder="Digite sua dúvida para a Évora..."
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-rose-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => handleSend(inputValue)}
              className="w-8 h-8 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white flex items-center justify-center hover:brightness-110 shrink-0 shadow-sm transition-all"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvoraAIChatFloat;
