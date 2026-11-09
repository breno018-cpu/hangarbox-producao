import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Lock, KeyRound, Loader2, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { checkPasswordStrength, stripSensitiveUrlHash } from "@/lib/security";

export const PasswordRecoveryModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If URL contains recovery hash, strip it from URL bar immediately to prevent token leaks
    if (window.location.hash && (window.location.hash.includes("type=recovery") || window.location.hash.includes("access_token"))) {
      setIsOpen(true);
      stripSensitiveUrlHash();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsOpen(true);
        stripSensitiveUrlHash();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!isOpen) return null;

  const strength = checkPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!strength.valid) {
      toast.error("A nova senha deve atender aos requisitos de segurança (mínimo 8 caracteres e boa entropia).");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas digitadas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success("Nova senha salva com sucesso! Você já está autenticado com segurança.");
      setIsOpen(false);
      stripSensitiveUrlHash();

      // Determine redirect destination
      const email = data.user?.email?.toLowerCase() || "";
      if (email.includes("admin") || email === "laurentinobreno08@gmail.com") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/conta/biblioteca", { replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar senha. O link pode ter expirado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-zinc-100 shadow-2xl relative space-y-5">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute top-5 right-5 text-zinc-500 hover:text-zinc-300 transition"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Redefinir Nova Senha
          </h2>
          <p className="text-xs text-zinc-400 max-w-sm">
            Você acessou através do link seguro do e-mail. Defina sua nova credencial de acesso.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Nova Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                type="password"
                placeholder="Mínimo de 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-9 h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 rounded-xl text-xs"
              />
            </div>

            {/* Password Entropy Meter */}
            {password && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-400">Força da Senha:</span>
                  <span className="font-bold" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden flex gap-1">
                  {[0, 1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className="h-full flex-1 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor: step <= strength.score ? strength.color : "#27272a",
                      }}
                    />
                  ))}
                </div>
                {strength.errors.length > 0 && (
                  <p className="text-[10px] text-amber-400/90 pt-0.5">
                    {strength.errors.join(" • ")}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Confirmar Nova Senha</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="pl-9 h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="flex items-start gap-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-2.5 text-[10px] text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
            <span>Sessões antigas em outros aparelhos serão automaticamente revogadas.</span>
          </div>

          <Button
            type="submit"
            disabled={loading || !strength.valid || password !== confirmPassword}
            className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Atualizando com segurança...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Salvar Nova Senha</span>
              </span>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PasswordRecoveryModal;
