import { useState, useEffect, useMemo } from "react";
import {
  Trophy, Sparkles, ArrowUp, ArrowDown, Plus, Trash2,
  RefreshCw, Check, Search, X, Eye, EyeOff, Film, HelpCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  fetchTopWatchedConfig,
  saveTopWatchedConfig,
  type TopWatchedConfig,
  type DbSerie,
} from "@/lib/api";

interface TopWatchedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allSeries: DbSerie[];
  onSaved?: () => void;
}

export default function TopWatchedModal({
  open,
  onOpenChange,
  allSeries,
  onSaved,
}: TopWatchedModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("Top 10 Mais Assistidos & Destaques");
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [isVisible, setIsVisible] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Picker submodal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  // Load config on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchTopWatchedConfig()
      .then((cfg) => {
        setTitle(cfg.title || "Top 10 Mais Assistidos & Destaques");
        setMode(cfg.mode || "manual");
        setIsVisible(cfg.is_visible !== false);
        // If series_ids is empty, pre-populate with top by sales or active series
        if (cfg.series_ids && cfg.series_ids.length > 0) {
          setSelectedIds(cfg.series_ids);
        } else {
          const autoTop = [...allSeries]
            .filter((s) => s.status === "ativo")
            .sort((a, b) => (b.vendas_count || 0) - (a.vendas_count || 0))
            .slice(0, 10)
            .map((s) => s.id);
          setSelectedIds(autoTop);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar configuração do Top 10:", err);
      })
      .finally(() => setLoading(false));
  }, [open, allSeries]);

  const seriesMap = useMemo(() => {
    return new Map(allSeries.map((s) => [s.id, s]));
  }, [allSeries]);

  // Selected series objects in order
  const rankedSeries = useMemo(() => {
    return selectedIds
      .map((id) => seriesMap.get(id))
      .filter((s): s is DbSerie => Boolean(s));
  }, [selectedIds, seriesMap]);

  // Filtered series for picker
  const availableSeries = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return allSeries.filter((s) => {
      if (s.status !== "ativo") return false;
      if (!q) return true;
      const matchTitle = s.titulo.toLowerCase().includes(q);
      const matchCat = (s.categoria || []).some((c) => c.toLowerCase().includes(q));
      return matchTitle || matchCat;
    });
  }, [allSeries, pickerSearch]);

  // Reorder functions
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setSelectedIds((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= selectedIds.length - 1) return;
    setSelectedIds((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleRemove = (index: number) => {
    setSelectedIds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenPickerForAdd = () => {
    setReplacingIndex(null);
    setPickerSearch("");
    setPickerOpen(true);
  };

  const handleOpenPickerForReplace = (index: number) => {
    setReplacingIndex(index);
    setPickerSearch("");
    setPickerOpen(true);
  };

  const handleSelectSerie = (serieId: string) => {
    if (replacingIndex !== null) {
      setSelectedIds((prev) => {
        const copy = [...prev];
        copy[replacingIndex] = serieId;
        return copy;
      });
    } else {
      if (!selectedIds.includes(serieId)) {
        setSelectedIds((prev) => [...prev, serieId]);
      } else {
        toast.info("Esta série já está no ranking.");
      }
    }
    setPickerOpen(false);
  };

  const handleFillTopSales = () => {
    const autoTop = [...allSeries]
      .filter((s) => s.status === "ativo")
      .sort((a, b) => (b.vendas_count || 0) - (a.vendas_count || 0))
      .slice(0, 10)
      .map((s) => s.id);
    setSelectedIds(autoTop);
    toast.success("Preenchido com as 10 obras mais vendidas!");
  };

  const handleClear = () => {
    setSelectedIds([]);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const config: TopWatchedConfig = {
        title: title.trim() || "Top 10 Mais Assistidos & Destaques",
        mode,
        series_ids: selectedIds,
        is_visible: isVisible,
      };
      await saveTopWatchedConfig(config);
      toast.success("Séries mais assistidas atualizadas com sucesso!");
      if (onSaved) onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao salvar Top 10:", err);
      toast.error(err.message || "Erro ao salvar alterações no Top 10");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white text-slate-900 border-slate-200">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Trophy size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>Alterar Séries Mais Assistidas</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                    TOP 10 LOJA
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Personalize quais séries aparecem no carrossel de destaque do topo e defina a ordem exata das posições (1º ao 10º).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* General Settings */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Título da Seção na Loja
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Top 10 Mais Assistidos & Destaques"
                    className="bg-white border-slate-200 text-slate-900 text-xs rounded-xl h-9"
                  />
                </div>
                <div className="flex items-center justify-between pt-5 px-1">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">
                      Exibir Seção na Loja
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Mostrar carrossel de ranking na página inicial
                    </span>
                  </div>
                  <Switch checked={isVisible} onCheckedChange={setIsVisible} />
                </div>
              </div>

              {/* Mode Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Modo de Ordenação
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("manual")}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      mode === "manual"
                        ? "bg-amber-50/80 border-amber-300 text-amber-950 shadow-xs ring-1 ring-amber-400/50"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center ${
                      mode === "manual" ? "border-amber-600 bg-amber-600" : "border-slate-400"
                    }`}>
                      {mode === "manual" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-600" />
                        Manual / Personalizado (Recomendado)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Você escolhe a dedo cada série e define as posições de 1º a 10º.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("auto")}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      mode === "auto"
                        ? "bg-rose-50/80 border-rose-300 text-rose-950 shadow-xs ring-1 ring-rose-400/50"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center ${
                      mode === "auto" ? "border-rose-600 bg-rose-600" : "border-slate-400"
                    }`}>
                      {mode === "auto" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <RefreshCw size={13} className="text-rose-600" />
                        Automático por Vendas
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Ordena automaticamente pelas séries com maior número de compras.
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Manual List Section */}
            {mode === "manual" && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Ordem das Séries no Top 10</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                        {rankedSeries.length} selecionada(s)
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Use as setas para subir/descer a posição da série no ranking.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleFillTopSales}
                      className="h-8 text-xs font-medium border-slate-200 hover:bg-slate-100 gap-1.5 rounded-xl"
                      title="Preenche com as obras que têm mais vendas registradas"
                    >
                      <Sparkles size={13} className="text-amber-500" />
                      Preencher com Top Vendas
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClear}
                      className="h-8 text-xs font-medium text-rose-600 border-rose-200 hover:bg-rose-50 gap-1.5 rounded-xl"
                    >
                      <Trash2 size={13} />
                      Limpar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleOpenPickerForAdd}
                      className="h-8 text-xs font-bold bg-[#E31C25] hover:bg-[#B8151D] text-white gap-1.5 rounded-xl shadow-xs"
                    >
                      <Plus size={14} />
                      Adicionar Série
                    </Button>
                  </div>
                </div>

                {/* Ranked Items */}
                {rankedSeries.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">Nenhuma série no Top 10</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      Clique em "Adicionar Série" ou "Preencher com Top Vendas" para montar seu ranking de mais assistidas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rankedSeries.map((serie, index) => {
                      const rankNum = index + 1;
                      const isGold = rankNum === 1;
                      const isSilver = rankNum === 2;
                      const isBronze = rankNum === 3;

                      return (
                        <div
                          key={serie.id}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                            isGold
                              ? "bg-amber-50/60 border-amber-200/90 shadow-2xs"
                              : isSilver
                              ? "bg-slate-50/80 border-slate-200"
                              : isBronze
                              ? "bg-amber-50/30 border-amber-100"
                              : "bg-white border-slate-200/80"
                          }`}
                        >
                          {/* Rank Badge */}
                          <div
                            className={`w-8 h-8 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs ${
                              isGold
                                ? "bg-amber-500 text-white ring-2 ring-amber-300"
                                : isSilver
                                ? "bg-slate-400 text-white"
                                : isBronze
                                ? "bg-amber-700 text-white"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            #{rankNum}
                          </div>

                          {/* Thumbnail */}
                          <div className="w-10 h-14 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-200/60">
                            {serie.capa_url ? (
                              <img
                                src={serie.capa_url}
                                alt={serie.titulo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <Film size={16} />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-bold text-slate-900 truncate">
                              {serie.titulo}
                            </h5>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] text-slate-500">
                                R$ {serie.preco.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400">•</span>
                              <span className="text-[10px] text-slate-500">
                                {serie.vendas_count || 0} vendas
                              </span>
                              {serie.categoria && serie.categoria[0] && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded font-medium">
                                  {serie.categoria[0]}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === 0}
                              onClick={() => handleMoveUp(index)}
                              className="h-7 w-7 text-slate-500 hover:text-slate-900 disabled:opacity-20"
                              title="Subir posição"
                            >
                              <ArrowUp size={14} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === rankedSeries.length - 1}
                              onClick={() => handleMoveDown(index)}
                              className="h-7 w-7 text-slate-500 hover:text-slate-900 disabled:opacity-20"
                              title="Descer posição"
                            >
                              <ArrowDown size={14} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenPickerForReplace(index)}
                              className="h-7 w-7 text-slate-500 hover:text-amber-600"
                              title="Trocar esta série por outra"
                            >
                              <RefreshCw size={13} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemove(index)}
                              className="h-7 w-7 text-slate-400 hover:text-rose-600"
                              title="Remover do Top 10"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between gap-2 sm:justify-between">
            <span className="text-[11px] text-slate-500">
              {mode === "manual"
                ? `${rankedSeries.length} obras posicionadas no Top 10`
                : "Ordenação dinâmica por vendas ativada"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-9 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-9 text-xs font-bold bg-[#E31C25] hover:bg-[#B8151D] text-white rounded-xl shadow-xs px-5"
              >
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Series Picker Submodal */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0 overflow-hidden bg-white text-slate-900 border-slate-200">
          <DialogHeader className="p-4 border-b border-slate-100">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>
                {replacingIndex !== null
                  ? `Trocar Série da Posição #${replacingIndex + 1}`
                  : "Selecionar Série para o Top 10"}
              </span>
            </DialogTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <Input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Buscar por título ou gênero..."
                className="pl-8 text-xs bg-slate-50 border-slate-200 rounded-xl h-9"
                autoFocus
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[50vh]">
            {availableSeries.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhuma série encontrada.
              </div>
            ) : (
              availableSeries.map((s) => {
                const isAlreadyInRank = selectedIds.includes(s.id);
                const rankIndex = selectedIds.indexOf(s.id);

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSerie(s.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all ${
                      isAlreadyInRank && replacingIndex === null
                        ? "bg-slate-100 opacity-60 hover:opacity-100"
                        : "hover:bg-slate-50 border border-transparent hover:border-slate-200"
                    }`}
                  >
                    <div className="w-9 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-200/60">
                      {s.capa_url ? (
                        <img
                          src={s.capa_url}
                          alt={s.titulo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Film size={14} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {s.titulo}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500">
                          R$ {s.preco.toFixed(2)}
                        </span>
                        {isAlreadyInRank && (
                          <span className="text-[9px] font-extrabold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">
                            #{rankIndex + 1} no Top
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-slate-400">
                      {isAlreadyInRank && replacingIndex === null ? (
                        <Check size={16} className="text-emerald-600" />
                      ) : (
                        <Plus size={16} className="text-slate-400 hover:text-slate-700" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
