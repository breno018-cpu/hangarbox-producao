import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowLeft, Loader2, KeyRound, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import { DitherField, DEFAULT_BRIDGE_SRC } from "@/components/admin/dither/DitherField";
import { ProgressiveBlurEdge } from "@/components/admin/dither/ProgressiveBlurEdge";
import { PixelLoomEmblem, PixelLoomFullLogo } from "@/components/admin/PixelLoomLogo";
import AdminTransitionOverlay from "@/components/admin/AdminTransitionOverlay";


const loginSchema = z.object({
  email: z.string().min(1, "O e-mail é obrigatório"),
  password: z.string().min(1, "A senha é obrigatória"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const scope = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [artReady, setArtReady] = useState(false);
  const [isExitingToSite, setIsExitingToSite] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);

  const handleArtReady = useCallback(() => {
    setArtReady(true);
  }, []);

  useEffect(() => {
    const fallback = window.setTimeout(() => setArtReady(true), 900);
    return () => window.clearTimeout(fallback);
  }, []);

  // GSAP Entrance Timeline
  useGSAP(
    () => {
      const root = scope.current;
      if (!root || !artReady) return;

      const ctx = gsap.context(() => {
        gsap.set(".oasis-dither", { scale: 1.05, autoAlpha: 0, transformOrigin: "50% 85%" });
        gsap.set(".oasis-edge", { autoAlpha: 0 });
        gsap.set(".oasis-top-bar", { autoAlpha: 0, y: -12 });
        gsap.set(".oasis-login-card", { autoAlpha: 0, y: 20, scale: 0.98 });

        gsap
          .timeline({ defaults: { ease: "power3.out" } })
          .to(".oasis-dither", { scale: 1, autoAlpha: 1, duration: 1.2, ease: "power2.out" }, 0.1)
          .to(".oasis-edge", { autoAlpha: 1, duration: 0.8, stagger: 0.08 }, 0.15)
          .to(".oasis-top-bar", { autoAlpha: 1, y: 0, duration: 0.6 }, 0.25)
          .to(".oasis-login-card", { autoAlpha: 1, y: 0, scale: 1, duration: 0.75, ease: "back.out(1.4)" }, 0.35);
      }, root);

      return () => ctx.revert();
    },
    { scope, dependencies: [artReady] },
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Automatically wipe any legacy pixelloom email cached in localStorage
  useEffect(() => {
    const stored = localStorage.getItem("hb_admin_email");
    if (stored && stored.includes("pixelloom.com")) {
      localStorage.removeItem("hb_admin_email");
    }
  }, []);

    const handleSendRecovery = async (targetEmail: string) => {
    const em = targetEmail.trim();
    if (!em || !em.includes("@")) {
      toast.error("Informe um e-mail válido para receber o link de recuperação.");
      return;
    }
    setIsSendingRecovery(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: window.location.origin + "/admin",
      });
      if (error) throw error;
      toast.success("Link de recuperação enviado para " + em + "! Abra seu e-mail para cadastrar uma nova senha.");
      setShowForgotModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar e-mail de recuperação.");
    } finally {
      setIsSendingRecovery(false);
    }
  };

  const handleSendMagicLink = async (targetEmail: string) => {
    const em = targetEmail.trim();
    if (!em || !em.includes("@")) {
      toast.error("Informe um e-mail válido para receber o link de acesso.");
      return;
    }
    setIsSendingMagicLink(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: em,
        options: {
          emailRedirectTo: window.location.origin + "/admin",
        },
      });
      if (error) throw error;
      toast.success("Link de acesso sem senha enviado para " + em + "! Basta clicar no e-mail para entrar.");
      setShowForgotModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar link de acesso.");
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    try {
      const email = data.email.trim();
      const password = data.password;

      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.warn("Falha no login Supabase:", authError);
        let msg = "Erro ao autenticar. Verifique suas credenciais.";
        if (authError.message.toLowerCase().includes("invalid login credentials")) {
          msg = "E-mail ou senha incorretos. Verifique suas credenciais ou use 'Esqueceu a senha?' abaixo.";
        } else if (authError.message.toLowerCase().includes("email not confirmed")) {
          msg = "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
        } else if (authError.message.toLowerCase().includes("too many requests")) {
          msg = "Muitas tentativas consecutivas. Aguarde 60 segundos antes de tentar novamente.";
        } else {
          msg = authError.message;
        }
        toast.error(msg);
        return;
      }

      // 2. Verify admin role on verified user
      if (authData?.user) {
        const userId = authData.user.id;
        let isAdmin = false;

        const { data: rpcRole, error: rpcError } = await supabase.rpc("has_role", {
          _user_id: userId,
          _role: "admin",
        });

        if (!rpcError && rpcRole === true) {
          isAdmin = true;
        } else {
          const { data: roleRow, error: roleError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();

          if (!roleError && roleRow) {
            isAdmin = true;
          }
        }

        const isOwner = authData.user.email?.toLowerCase() === "laurentinobreno08@gmail.com";

        if (isAdmin || isOwner) {
          sessionStorage.setItem("admin_auth_cached_role", "admin");
          localStorage.setItem("hb_admin_session", "admin");
          localStorage.setItem("hb_admin_email", authData.user.email || email);
          toast.success("Autenticação autorizada! Bem-vindo ao painel HangarBox.");
          const from = (location.state as any)?.from?.pathname || "/admin";
          navigate(from, { replace: true });
          return;
        } else {
          toast.error("Acesso restrito. Este usuário não possui privilégios de administrador.");
          await supabase.auth.signOut();
          return;
        }
      }
    } catch (err: any) {
      console.error("Login unexpected error:", err);
      toast.error(err?.message || "Erro inesperado ao realizar login.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSite = useCallback(() => {
    setIsExitingToSite(true);
    setTimeout(() => {
      navigate("/");
    }, 700);
  }, [navigate]);

  return (
    <div
      ref={scope}
      className="relative min-h-screen w-full overflow-hidden bg-white text-zinc-950 font-sans antialiased selection:bg-purple-500/20 selection:text-purple-900 flex flex-col justify-between"
    >
      {/* Cinematic Dark-to-Light Portal Transition (Showrunner to Admin) */}
      <AdminTransitionOverlay
        isActive={true}
        mode={isExitingToSite ? "exit-dark" : "enter-light"}
        label={isExitingToSite ? "Retornando ao Catálogo" : "Painel Administrativo"}
        sublabel={isExitingToSite ? "Alternando de volta para a loja..." : "Transição do Showrunner para o Painel Seguro..."}
      />

      {/* 1. Interactive Dither Field Canvas Background */}
      <div className="oasis-dither absolute inset-0 z-0">
        <DitherField
          src={DEFAULT_BRIDGE_SRC}
          cellSize={3}
          disturbRadius={80}
          className="z-0"
          onReady={handleArtReady}
        />
      </div>

      {/* 2. Progressive White Blur Edges */}
      <ProgressiveBlurEdge
        edge="top"
        className="h-[min(55vh,28rem)] sm:h-[min(50vh,30rem)] lg:h-[min(45vh,32rem)]"
      />
      <ProgressiveBlurEdge
        edge="bottom"
        className="h-[min(25vh,11rem)] sm:h-[min(20vh,10rem)] lg:h-[min(18vh,9rem)]"
      />

      {/* 3. Top Navigation Bar */}
      <header className="oasis-top-bar relative z-20 w-full">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-6 py-6 sm:px-10 sm:py-7">
          {/* Back to site pill with smooth exit transition */}
          <button
            type="button"
            onClick={handleBackToSite}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-zinc-800 bg-white/90 hover:bg-white border border-zinc-200/90 shadow-xs backdrop-blur-md transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft size={13} className="text-zinc-600" />
            <span>Voltar ao Site</span>
          </button>

          {/* PixelLoom Brand Pill */}
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/90 border border-zinc-200/90 shadow-xs backdrop-blur-md">
            <PixelLoomFullLogo className="h-5 w-auto" />
          </div>
        </div>
      </header>

      {/* 4. Central Floating Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6">
        <div className="oasis-login-card w-full max-w-[420px]">
          <div className="relative rounded-3xl bg-white/95 backdrop-blur-2xl border border-zinc-200/90 p-8 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.12)] text-center overflow-hidden">
            {/* Top crimson accent line */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600" />

            {/* Emblem Icon in Black Box */}
            <div className="w-14 h-14 bg-[#09090b] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md border border-zinc-800">
              <PixelLoomEmblem inverted className="w-7 h-7" />
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-2xl font-black tracking-tight text-zinc-950 mb-1">
              Painel Pixel<span className="text-[#E31C25]">Loom</span>
            </h1>
            <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-zinc-500 mb-6">
              ACESSO ADMINISTRATIVO RESTRITO
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
              <div>
                <label className="text-[10px] font-bold text-zinc-800 uppercase tracking-wider block mb-1.5">
                  E-MAIL ADMINISTRATIVO
                </label>
                <Input
                  {...register("email")}
                  type="email"
                  disabled={isLoading}
                  placeholder="laurentinobreno08@gmail.com"
                  className="bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 h-11 rounded-xl text-xs font-medium focus-visible:ring-purple-500/20 focus-visible:border-purple-600 shadow-2xs"
                />
                {errors.email && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-zinc-800 uppercase tracking-wider block">
                    SENHA
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const currentEmail = (document.querySelector('input[type="email"]') as HTMLInputElement)?.value || "";
                      setForgotEmail(currentEmail || "laurentinobreno08@gmail.com");
                      setShowForgotModal(true);
                    }}
                    className="text-[10px] text-purple-700 hover:text-purple-900 font-semibold cursor-pointer hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <Input
                  {...register("password")}
                  type="password"
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 h-11 rounded-xl text-xs font-medium focus-visible:ring-purple-500/20 focus-visible:border-purple-600 shadow-2xs"
                />
                {errors.password && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-[#7B3FE4] via-[#6C2BD9] to-[#5B21B6] hover:opacity-95 text-white font-bold rounded-xl shadow-lg shadow-purple-600/25 text-xs transition-all active:scale-[0.99] border-0 mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={15} className="animate-spin text-white" />
                    <span>Autenticando...</span>
                  </span>
                ) : (
                  "Acessar Painel"
                )}
              </Button>

              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center pt-2">
                  <div className="w-full border-t border-zinc-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white/95 px-2 text-zinc-400 font-semibold tracking-wider">
                    OU ACESSE SEM SENHA
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isSendingMagicLink}
                onClick={() => {
                  const currentEmail = (document.querySelector('input[type="email"]') as HTMLInputElement)?.value || "";
                  if (!currentEmail || !currentEmail.includes("@")) {
                    toast.error("Preencha o campo de e-mail acima para receber o link de acesso.");
                    return;
                  }
                  handleSendMagicLink(currentEmail);
                }}
                className="w-full h-10 border border-zinc-200 hover:border-purple-300 hover:bg-purple-50/50 text-zinc-700 hover:text-purple-700 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSendingMagicLink ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} className="text-purple-600" />
                )}
                <span>Receber Link de Acesso por E-mail</span>
              </button>
            </form>

            {/* Modal de Recuperação de Senha */}
            {showForgotModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 p-6 shadow-2xl space-y-4 text-left relative animate-in fade-in zoom-in-95 duration-150">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  >
                    <X size={18} />
                  </button>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                      <KeyRound size={18} className="text-purple-600" />
                      Recuperar Senha Admin
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Enviaremos um link de redefinição de senha para o e-mail cadastrado.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-700 uppercase">
                      E-mail do Administrador
                    </label>
                    <Input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="laurentinobreno08@gmail.com"
                      className="h-10 text-xs bg-zinc-50 border-zinc-200"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 h-9 text-xs rounded-xl"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      disabled={isSendingRecovery}
                      onClick={() => handleSendRecovery(forgotEmail)}
                      className="flex-1 h-9 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold"
                    >
                      {isSendingRecovery ? (
                        <Loader2 size={13} className="animate-spin text-white" />
                      ) : (
                        "Enviar Link"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 5. Bottom empty space to allow natural footer/edge breathing */}
      <footer className="relative z-10 w-full py-4 text-center">
        {/* Subtle breathing room */}
      </footer>
    </div>
  );
};

export default AdminLogin;
