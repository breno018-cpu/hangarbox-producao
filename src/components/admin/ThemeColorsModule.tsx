import React, { useState } from "react";
import {
  Palette,
  Check,
  RotateCcw,
  Sparkles,
  Save,
  Flame,
  Star,
  Play,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  useThemeColors,
  THEME_PRESETS,
  DEFAULT_THEME_COLORS,
  ThemeColors,
} from "@/hooks/useThemeColors";

export const ThemeColorsModule: React.FC = () => {
  const { colors, saveColors, resetToDefault, saving } = useThemeColors();
  const [currentColors, setCurrentColors] = useState<ThemeColors>(colors);
  const [activePreset, setActivePreset] = useState<string>("HangarBox Red (Padrão)");

  React.useEffect(() => {
    setCurrentColors(colors);
  }, [colors]);

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const updated = { ...currentColors, [key]: value };
    setCurrentColors(updated);
    // Aplicação imediata no DOM para feedback instantâneo
    import("@/hooks/useThemeColors").then((m) => m.applyThemeToDom(updated));
  };

  const handleApplyPreset = (presetName: string, presetColors: ThemeColors) => {
    setActivePreset(presetName);
    setCurrentColors(presetColors);
    import("@/hooks/useThemeColors").then((m) => m.applyThemeToDom(presetColors));
    toast.info(`Paleta ${presetName} selecionada. Clique em Salvar para fixar.`);
  };

  const handleSave = async () => {
    const ok = await saveColors(currentColors);
    if (ok) {
      toast.success("Cores do sistema salvas com sucesso para todos os usuários!");
    } else {
      toast.error("Falha ao salvar cores.");
    }
  };

  const handleReset = async () => {
    await resetToDefault();
    setCurrentColors(DEFAULT_THEME_COLORS);
    setActivePreset("HangarBox Red (Padrão)");
    toast.success("Cores restauradas para o padrão Vermelho & Preto da HangarBox.");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Guia Didático */}
      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 flex items-start sm:items-center gap-3 shadow-xs">
        <div className="p-2 bg-rose-500 text-white rounded-xl flex-shrink-0">
          <Palette className="h-5 w-5" />
        </div>
        <div className="text-xs leading-relaxed">
          <strong>Personalização de Cores do Sistema:</strong> Escolha uma das paletas de 1 clique ou defina as cores exatas de cada elemento do site. As alterações refletem imediatamente na página inicial, catálogo e checkout.
        </div>
      </div>

      {/* Grid de Paletas Rápidas */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-rose-600" />
            <h3 className="font-extrabold text-sm text-zinc-900">Paletas Pré-definidas com 1 Clique</h3>
          </div>
          <span className="text-[11px] text-zinc-500 font-semibold">Selecione para aplicar</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {THEME_PRESETS.map((preset) => {
            const isSelected = activePreset === preset.name;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleApplyPreset(preset.name, preset.colors)}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  isSelected
                    ? "border-rose-500 bg-rose-50/50 shadow-xs ring-2 ring-rose-500/20"
                    : "border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base">{preset.icon}</span>
                  <div className="flex gap-1">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: preset.colors.primary }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                      style={{ backgroundColor: preset.colors.price }}
                    />
                  </div>
                </div>
                <div className="font-bold text-xs text-zinc-900 line-clamp-1">{preset.name}</div>
                {isSelected && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-600 font-extrabold">
                    <Check className="h-3 w-3" /> Selecionado
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Principal: Seletores + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel de Seletores de Cor */}
        <div className="lg:col-span-8 bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-zinc-900">Configuração Manual de Cores</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Ajuste os valores hexadecimais ou use o seletor visual nativo.</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs border-zinc-200 text-zinc-700 hover:bg-zinc-100 gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Padrão Vermelho
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5 shadow-sm"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar Cores"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Primária */}
            <div className="p-3.5 rounded-xl border border-zinc-100 bg-zinc-50/60 space-y-2">
              <Label className="text-xs font-bold text-zinc-800 flex items-center justify-between">
                <span>Cor Primária (Botões e Destaques)</span>
                <span className="font-mono text-[11px] text-zinc-500">{currentColors.primary}</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentColors.primary}
                  onChange={(e) => handleColorChange("primary", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-zinc-300 p-0.5 cursor-pointer bg-white"
                />
                <Input
                  type="text"
                  value={currentColors.primary}
                  onChange={(e) => handleColorChange("primary", e.target.value)}
                  className="font-mono text-xs uppercase bg-white border-zinc-200"
                />
              </div>
            </div>

            {/* Hover */}
            <div className="p-3.5 rounded-xl border border-zinc-100 bg-zinc-50/60 space-y-2">
              <Label className="text-xs font-bold text-zinc-800 flex items-center justify-between">
                <span>Cor Secundária / Hover</span>
                <span className="font-mono text-[11px] text-zinc-500">{currentColors.primaryHover}</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentColors.primaryHover}
                  onChange={(e) => handleColorChange("primaryHover", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-zinc-300 p-0.5 cursor-pointer bg-white"
                />
                <Input
                  type="text"
                  value={currentColors.primaryHover}
                  onChange={(e) => handleColorChange("primaryHover", e.target.value)}
                  className="font-mono text-xs uppercase bg-white border-zinc-200"
                />
              </div>
            </div>

            {/* Preços */}
            <div className="p-3.5 rounded-xl border border-zinc-100 bg-zinc-50/60 space-y-2">
              <Label className="text-xs font-bold text-zinc-800 flex items-center justify-between">
                <span>Cor dos Valores e Preços (R$)</span>
                <span className="font-mono text-[11px] text-zinc-500">{currentColors.price}</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentColors.price}
                  onChange={(e) => handleColorChange("price", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-zinc-300 p-0.5 cursor-pointer bg-white"
                />
                <Input
                  type="text"
                  value={currentColors.price}
                  onChange={(e) => handleColorChange("price", e.target.value)}
                  className="font-mono text-xs uppercase bg-white border-zinc-200"
                />
              </div>
            </div>

            {/* Top 10 Accent */}
            <div className="p-3.5 rounded-xl border border-zinc-100 bg-zinc-50/60 space-y-2">
              <Label className="text-xs font-bold text-zinc-800 flex items-center justify-between">
                <span>Destaque Seção Top 10</span>
                <span className="font-mono text-[11px] text-zinc-500">{currentColors.top10Accent}</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentColors.top10Accent}
                  onChange={(e) => handleColorChange("top10Accent", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-zinc-300 p-0.5 cursor-pointer bg-white"
                />
                <Input
                  type="text"
                  value={currentColors.top10Accent}
                  onChange={(e) => handleColorChange("top10Accent", e.target.value)}
                  className="font-mono text-xs uppercase bg-white border-zinc-200"
                />
              </div>
            </div>

            {/* Fundo do Site */}
            <div className="p-3.5 rounded-xl border border-zinc-100 bg-zinc-50/60 space-y-2">
              <Label className="text-xs font-bold text-zinc-800 flex items-center justify-between">
                <span>Fundo Principal do Site</span>
                <span className="font-mono text-[11px] text-zinc-500">{currentColors.background}</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentColors.background}
                  onChange={(e) => handleColorChange("background", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-zinc-300 p-0.5 cursor-pointer bg-white"
                />
                <Input
                  type="text"
                  value={currentColors.background}
                  onChange={(e) => handleColorChange("background", e.target.value)}
                  className="font-mono text-xs uppercase bg-white border-zinc-200"
                />
              </div>
            </div>

            {/* Fundo dos Cards */}
            <div className="p-3.5 rounded-xl border border-zinc-100 bg-zinc-50/60 space-y-2">
              <Label className="text-xs font-bold text-zinc-800 flex items-center justify-between">
                <span>Fundo dos Cards & Modais</span>
                <span className="font-mono text-[11px] text-zinc-500">{currentColors.cardBackground}</span>
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentColors.cardBackground}
                  onChange={(e) => handleColorChange("cardBackground", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-zinc-300 p-0.5 cursor-pointer bg-white"
                />
                <Input
                  type="text"
                  value={currentColors.cardBackground}
                  onChange={(e) => handleColorChange("cardBackground", e.target.value)}
                  className="font-mono text-xs uppercase bg-white border-zinc-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Preview Ao Vivo
            </span>
            <span className="text-[10px] text-zinc-500">Atualiza em tempo real</span>
          </div>

          <div
            className="rounded-2xl p-4 border transition-all duration-300 relative overflow-hidden shadow-xl"
            style={{
              backgroundColor: currentColors.background,
              borderColor: currentColors.cardBorder,
              color: currentColors.textPrimary,
            }}
          >
            {/* Mock Top 10 Card */}
            <div
              className="rounded-xl p-3 border relative overflow-hidden"
              style={{
                backgroundColor: currentColors.cardBackground,
                borderColor: currentColors.cardBorder,
              }}
            >
              {/* Badge Top 1 */}
              <div
                className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider mb-2 text-white shadow-xs"
                style={{
                  background: `linear-gradient(to right, ${currentColors.primary}, ${currentColors.primaryHover})`,
                }}
              >
                <Flame size={11} className="fill-white" />
                TOP 1
              </div>

              {/* Poster mockup */}
              <div
                className="w-full aspect-[2/3] rounded-lg overflow-hidden border mb-3 relative flex items-center justify-center text-center p-3"
                style={{
                  borderColor: currentColors.cardBorder,
                  background: `linear-gradient(135deg, ${currentColors.cardBackground} 0%, ${currentColors.primary}33 100%)`,
                }}
              >
                <span className="text-xs font-extrabold tracking-tight" style={{ color: currentColors.textPrimary }}>
                  Capa da Série (Exemplo)
                </span>
              </div>

              <div className="font-bold text-xs truncate mb-1" style={{ color: currentColors.textPrimary }}>
                O Segredo do Quarterback
              </div>

              <div className="flex items-baseline justify-between mb-3">
                <span className="text-base font-black font-mono" style={{ color: currentColors.price }}>
                  R$ 19,90
                </span>
                <span className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                  <Star size={10} className="fill-amber-400" /> 4.9
                </span>
              </div>

              <button
                type="button"
                className="w-full py-2.5 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${currentColors.primary}, ${currentColors.primaryHover})`,
                }}
              >
                <Play size={11} fill="currentColor" />
                GARANTIR ACESSO
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeColorsModule;
