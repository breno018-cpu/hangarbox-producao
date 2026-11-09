import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ShieldCheck,
  Mail,
  Lock,
  KeyRound,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  validateEmailSecurity,
  checkPasswordStrength,
  stripSensitiveUrlHash,
  checkRecoveryRateLimit,
  recordRecoveryAttempt,
} from "@/lib/security";

interface PasswordRecoveryPageProps {
  mode?: "request" | "reset";
}

export const PasswordRecoveryPage: React.FC<PasswordRecoveryPageProps> = ({ mode: initialMode = "request" }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"request" | "reset">(initialMode);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [remainingCooldown, setRemainingCooldown] = useState(0);

  // Check rate limit on mount
  useEffect(() => {
    const { throttled, remainingSeconds } = checkRecoveryRateLimit("pwd_reset", 60);
    if (throttled) {
      setRemainingCooldown(remainingSeconds);
    }
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (remainingCooldown <= 0) return;
    const timer = setInterval(() => {
      setRemainingCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [remainingCooldown]);

  // Check if user arrived via recovery link
  useEffect(() => {
    const hasRecoveryHash =
      window.location.hash &&
      (window.location.hash.includes("type=recovery") || window.location.hash.includes("access_token"));

    if (hasRecoveryHash || window.location.pathname.includes("redefinir")) {
      setMode("reset");
      stripSensitiveUrlHash();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        stripSensitiveUrlHash();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Live password strength calculation
  const strength = checkPasswordStrength(newPassword);

  // Request recovery link (Zero Data Leakage / Anti-Enumeration)
  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Rate limiting check
    const { throttled, remainingSeconds } = checkRecoveryRateLimit("pwd_reset", 60);
    if (throttled) {
      toast.error(`Aguarde ${remainingSeconds} segundos antes de solicitar um novo link de recuperação.`);
      return;
    }

    // 2. Strict email validation
    const emailCheck = validateEmailSecurity(email);
    if (!emailCheck.valid) {
      toast.error(emailCheck.error || "Endereço de e-mail inválido.");
      return;
    }

    setIsLoading(true);

    try {
      // 3. Supabase recovery dispatch with secure redirect target
      const redirectTarget = `${window.location.origin}/redefinir-senha`;
      await supabase.auth.resetPasswordForEmail(emailCheck.email, {
        redirectTo: redirectTarget,
      });

      // 4. Record attempt to prevent flood
      recordRecoveryAttempt("pwd_reset");
      setRemainingCooldown(60);
      setSubmitted(true);

      // Anti-enumeration: always display positive confirmation without revealing database existence
      toast.success("Solicitação processada com segurança. Verifique sua caixa de entrada.");
    } catch (err: any) {
      console.warn("Recovery notice:", err);
      // Even in case of silent error, avoid leaking user existence
      setSubmitted(true);
      toast.success("Solicitação processada. Se o e-mail existir, você receberá o link.");
    } finally {
      setIsLoading(false);
    }
  };

  // Set new password
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!strength.valid) {
      toast.error("A nova senha deve atender aos requisitos de segurança.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas digitadas não coincidem.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Senha redefinida com sucesso! Você já está autenticado.");

      // Clean history and hash
      stripSensitiveUrlHash();

      const userEmail = data.user?.email?.toLowerCase() || "";
      if (userEmail.includes("admin") || userEmail === "laurentinobreno08@gmail.com") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/conta/biblioteca", { replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao redefinir senha. O link pode ter expirado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao site
        </Link>

        <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-3xl p-7 sm:p-8 shadow-2xl space-y-6">
          {mode === "request" ? (
            <>
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-600/15 border border-purple-500/25 flex items-center justify-center text-purple-400">
                  <KeyRound className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Recuperar Senha</h1>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                  Insira o e-mail da sua conta para receber um link de acesso com criptografia de ponta a ponta.
                </p>
              </div>

              {submitted ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-left flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-emerald-200">E-mail de verificação despachado</p>
                      <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                        Se este e-mail estiver registrado em nossa plataforma, enviamos um link seguro válido por 30
                        minutos.
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                    Não recebeu? Verifique a pasta de spam ou aguarde o tempo de proteção abaixo para solicitar
                    novamente.
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={remainingCooldown > 0}
                    onClick={() => setSubmitted(false)}
                    className="w-full h-11 border-zinc-700 hover:bg-zinc-800 text-xs font-semibold rounded-xl"
                  >
                    {remainingCooldown > 0 ? (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Aguarde {remainingCooldown}s para reenviar</span>
                      </span>
                    ) : (
                      "Tentar outro e-mail"
                    )}
                  </Button>

                  <div className="text-center pt-2">
                    <Link to="/auth" className="text-xs text-purple-400 hover:underline">
                      Voltar para tela de login
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRequestRecovery} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-zinc-300">Seu E-mail Cadastrado</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <Input
                        type="email"
                        placeholder="exemplo@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-9 h-11 bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-3 text-[11px] text-zinc-400">
                    <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>
                      Proteção Anti-Vazamento: Não divulgamos dados nem a existência de contas neste formulário.
                    </span>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || remainingCooldown > 0}
                    className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/20"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processando solicitação...</span>
                      </span>
                    ) : remainingCooldown > 0 ? (
                      <span className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Aguarde {remainingCooldown}s</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Enviar Link de Recuperação Seguro</span>
                      </span>
                    )}
                  </Button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <Link to="/auth" className="text-zinc-400 hover:text-white">
                      Login Admin
                    </Link>
                    <Link to="/conta/login" className="text-purple-400 hover:underline">
                      Login do Cliente
                    </Link>
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
              {/* Reset Mode: Set new password */}
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-600/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <Lock className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Criar Nova Senha</h1>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                  Defina sua nova credencial de segurança. Ela deve atender aos critérios de entropia abaixo.
                </p>
              </div>

              <form onSubmit={handleSetNewPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-300">Nova Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      type="password"
                      placeholder="Mínimo de 8 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="pl-9 h-11 bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl text-xs"
                    />
                  </div>

                  {/* Password Strength Meter */}
                  {newPassword && (
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
                  <label className="text-[11px] font-semibold text-zinc-300">Confirmar Nova Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pl-9 h-11 bg-zinc-950/80 border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !strength.valid || newPassword !== confirmPassword}
                  className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/20"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando senha segura...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Salvar e Acessar com Segurança</span>
                    </span>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordRecoveryPage;
