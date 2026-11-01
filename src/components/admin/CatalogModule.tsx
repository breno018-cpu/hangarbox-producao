import React, { useState, useMemo, useRef } from "react";
import {
  Film,
  Plus,
  Search,
  Edit,
  Trash2,
  Star,
  Upload,
  X,
  Save,
  Check,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Tv,
  Layers,
  Link as LinkIcon,
  Video,
  Eye,
  SlidersHorizontal,
  AlertTriangle,
  Trophy,
} from "lucide-react";
import TopWatchedModal from "./TopWatchedModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { DbSerie } from "@/lib/api";
import { uploadSeriesImage } from "@/lib/api";
import { PLATFORM_LIMITS, canCreateSerie, validateImageUpload } from "@/lib/limits";
import { AnimatedCountUp } from "./AnimatedCountUp";

interface CatalogModuleProps {
  series: DbSerie[];
  onSaveSerie: (serie: Partial<DbSerie>) => Promise<void>;
  onDeleteSerie: (id: string) => Promise<void>;
  isLoading?: boolean;
}

const formatBRL = (value: number) => {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseBRL = (raw: string): number => {
  const cleaned = raw.replace(/[^\d]/g, "");
  return parseInt(cleaned || "0", 10) / 100;
};

// Interactive Star Rating component in Light Theme
const InteractiveStarRating: React.FC<{
  rating: number;
  onChange: (rating: number) => void;
}> = ({ rating, onChange }) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = (hoverRating !== null ? hoverRating : rating) >= star;
        return (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
            onClick={() => onChange(star)}
            className="p-1 hover:scale-110 transition-transform focus:outline-none"
          >
            <Star
              size={18}
              className={
                active
                  ? "text-amber-500 fill-amber-500"
                  : "text-slate-300 hover:text-slate-400"
              }
            />
          </button>
        );
      })}
      <span className="text-xs font-semibold text-slate-700 ml-2">
        {rating > 0 ? `${rating.toFixed(1)} / 5.0` : "Sem nota"}
      </span>
    </div>
  );
};

export const CatalogModule: React.FC<CatalogModuleProps> = ({
  series,
  onSaveSerie,
  onDeleteSerie,
}) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [topWatchedModalOpen, setTopWatchedModalOpen] = useState(false);

  // Edit / Create Dialog state
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [editItem, setEditItem] = useState<Partial<DbSerie> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Delete confirm dialog
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // All unique categories for filter
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    series.forEach((s) => (s.categoria || []).forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [series]);

  // Filtered series
  const filteredSeries = useMemo(() => {
    return series.filter((s) => {
      const matchSearch =
        s.titulo.toLowerCase().includes(search.toLowerCase()) ||
        (s.resumo || "").toLowerCase().includes(search.toLowerCase());
      const matchCategory =
        categoryFilter === "all" || (s.categoria || []).includes(categoryFilter);
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [series, search, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = series.filter((s) => s.status === "ativo").length;
    const inactive = series.length - active;
    const animeCount = series.filter((s) => (s.categoria || []).includes("Anime")).length;
    const seriesCount = series.length - animeCount;
    return { active, inactive, animeCount, seriesCount };
  }, [series]);

  const handleOpenNew = () => {
    const check = canCreateSerie(series.length);
    if (!check.allowed) {
      toast.error(check.message);
      return;
    }

    setEditItem({
      titulo: "",
      resumo: "",
      capa_url: "",
      fundo_url: "",
      categoria: ["Série"],
      preco: 19.9,
      rating: 5,
      temporadas: 1,
      status: "ativo",
      is_hero: false,
      is_adult: false,
      posicao: series.length + 1,
      link_acesso: "",
      stream_url: "",
    });
    setIsOpenModal(true);
  };

  const handleOpenEdit = (s: DbSerie) => {
    setEditItem({ ...s });
    setIsOpenModal(true);
  };

  const handleToggleAnimeTag = async (s: DbSerie) => {
    const hasAnime = s.categoria.includes("Anime");
    const newCategories = hasAnime
      ? s.categoria.filter((c) => c !== "Anime")
      : [...s.categoria, "Anime"];

    try {
      await onSaveSerie({ id: s.id, categoria: newCategories });
      toast.success(
        hasAnime
          ? `"${s.titulo}" agora categorizado como Série.`
          : `"${s.titulo}" agora categorizado como Anime!`
      );
    } catch {
      toast.error("Erro ao alternar categoria.");
    }
  };

  const handleToggleStatus = async (s: DbSerie) => {
    const newStatus = s.status === "ativo" ? "inativo" : "ativo";
    try {
      await onSaveSerie({ id: s.id, status: newStatus });
      toast.success(newStatus === "ativo" ? "Série ativada!" : "Série desativada.");
    } catch {
      toast.error("Erro ao alterar status.");
    }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict image validation (format and 5 MB cap)
    const validation = validateImageUpload(file);
    if (!validation.valid) {
      toast.error(validation.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingImage(true);
    try {
      const publicUrl = await uploadSeriesImage(file, "capas");
      setEditItem((prev) => (prev ? { ...prev, capa_url: publicUrl } : null));
      toast.success("Capa enviada para o storage!");
    } catch (err: any) {
      toast.error(err?.message || "Erro no upload da imagem.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed || !editItem) return;
    const current = editItem.categoria || [];
    if (!current.includes(trimmed)) {
      setEditItem({ ...editItem, categoria: [...current, trimmed] });
    }
    setNewTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    if (!editItem) return;
    setEditItem({
      ...editItem,
      categoria: (editItem.categoria || []).filter((c) => c !== tag),
    });
  };

  const handleSave = async () => {
    if (!editItem?.titulo?.trim()) {
      toast.error("O título é obrigatório.");
      return;
    }

    // Strictly enforce ceiling when creating a new title
    if (!editItem.id) {
      const check = canCreateSerie(series.length);
      if (!check.allowed) {
        toast.error(check.message);
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSaveSerie(editItem);
      toast.success(editItem.id ? "Item atualizado com sucesso!" : "Novo item adicionado ao catálogo!");
      setIsOpenModal(false);
      setEditItem(null);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar no catálogo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Quota Exhaustion Alert if reached */}
      {series.length >= PLATFORM_LIMITS.SERIES_MAX && (
        <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-medium shadow-xs">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <span>
            <strong>Capacidade Máxima Atingida ({PLATFORM_LIMITS.SERIES_MAX}/{PLATFORM_LIMITS.SERIES_MAX}):</strong> O catálogo atingiu o teto do plano. Para adicionar novas séries ou animes, exclua títulos inativos.
          </span>
        </div>
      )}

      {/* Catalog Quick Stats with sequential CountUp animation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total no Catálogo
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <Film size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            <AnimatedCountUp end={series.length} delay={0} />
            <span className="text-xs font-normal text-slate-400 ml-1.5">/ {PLATFORM_LIMITS.SERIES_MAX} max</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            {allCategories.length} categorias cadastradas
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Títulos Ativos
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Check size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 tracking-tight">
            <AnimatedCountUp end={stats.active} delay={150} />
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            Visíveis na loja pública
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Animes
            </span>
            <div className="w-7 h-7 rounded-lg bg-pink-50 border border-pink-200 flex items-center justify-center text-pink-600">
              <Sparkles size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-pink-700 tracking-tight">
            <AnimatedCountUp end={stats.animeCount} delay={300} />
          </div>
          <div className="text-[11px] text-pink-600 font-medium mt-1">
            {stats.seriesCount} séries regulares
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Inativos / Ocultos
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Eye size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 tracking-tight">
            <AnimatedCountUp end={stats.inactive} delay={450} />
          </div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">
            Pausados para venda
          </div>
        </div>
      </div>

      {/* Control Bar in White */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar série ou anime no catálogo..."
              className="pl-9 h-10 bg-slate-50 border-slate-200 text-sm rounded-xl text-slate-900 placeholder:text-slate-400 focus-visible:ring-rose-500/30"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium outline-none focus:border-rose-500"
          >
            <option value="all">Todas as Categorias</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium outline-none focus:border-rose-500"
          >
            <option value="all">Todos os Status</option>
            <option value="ativo">Apenas Ativos</option>
            <option value="inativo">Apenas Inativos</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === "grid"
                  ? "bg-white text-rose-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Visualização em Grade"
            >
              <Layers size={15} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === "table"
                  ? "bg-white text-rose-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
              title="Visualização em Tabela"
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>

          {/* Mais Assistidas (Top 10) Button */}
          <Button
            type="button"
            onClick={() => setTopWatchedModalOpen(true)}
            className="h-10 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3.5 gap-2 rounded-xl shadow-xs transition-all"
          >
            <Trophy size={16} />
            <span>Mais Assistidas (Top 10)</span>
          </Button>

          {/* Add Item Button */}
          <Button
            onClick={handleOpenNew}
            className="h-10 bg-gradient-to-r from-[#7B3FE4] via-[#6C2BD9] to-[#5B21B6] hover:brightness-110 text-white text-xs font-bold px-4 gap-2 rounded-xl shadow-xs transition-all"
          >
            <Plus size={16} />
            <span>Novo Item</span>
            <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-medium ml-1">
              {series.length}/100
            </span>
          </Button>
        </div>
      </div>

      {/* Grid View in White Theme */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredSeries.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400">
              Nenhuma obra encontrada para os filtros atuais.
            </div>
          ) : (
            filteredSeries.map((s) => {
              const isAnime = (s.categoria || []).includes("Anime");
              return (
                <div
                  key={s.id}
                  className="group relative rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col hover:border-slate-300 hover:shadow-md transition-all duration-300 shadow-xs"
                >
                  {/* Poster Thumbnail */}
                  <div className="relative aspect-[2/3] w-full bg-slate-100 overflow-hidden">
                    {s.capa_url ? (
                      <img
                        src={s.capa_url}
                        alt={s.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <Film size={32} />
                        <span className="text-[10px] mt-1 font-medium">Sem Imagem</span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1.5 py-0.5 border font-semibold shadow-xs ${
                          isAnime
                            ? "bg-purple-600 text-white border-purple-400/40"
                            : "bg-rose-600 text-white border-rose-400/40"
                        }`}
                      >
                        {isAnime ? "Anime" : "Série"}
                      </Badge>

                      <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-slate-200 text-[10px] text-amber-500 font-bold shadow-xs">
                        <Star size={10} className="fill-amber-500 text-amber-500" />
                        {Number(s.rating || 0).toFixed(1)}
                      </div>
                    </div>

                    {/* Status indicator on bottom of poster */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          s.status === "ativo" ? "bg-emerald-400" : "bg-slate-400"
                        }`}
                      />
                      <span className="text-[10px] font-semibold text-white drop-shadow">
                        {s.status === "ativo" ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    {s.is_hero && (
                      <div className="absolute bottom-2 right-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400 text-amber-950 font-bold shadow-xs">
                          Hero
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info & Content */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 line-clamp-1 group-hover:text-rose-600 transition-colors">
                        {s.titulo}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        {s.resumo || "Sem sinopse informada."}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-900">
                        R$ {formatBRL(Number(s.preco || 0))}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Quick toggle anime / serie button */}
                        <button
                          onClick={() => handleToggleAnimeTag(s)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          title={isAnime ? "Alternar para Série" : "Alternar para Anime"}
                        >
                          <Tv size={14} />
                        </button>

                        {/* Edit button */}
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Editar Item"
                        >
                          <Edit size={14} />
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => setDeleteConfirmId(s.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Excluir Item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Table View in White */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Capa & Título</th>
                  <th className="px-5 py-3.5">Categorias</th>
                  <th className="px-5 py-3.5">Preço</th>
                  <th className="px-5 py-3.5">Avaliação</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSeries.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 shadow-xs">
                          {s.capa_url && (
                            <img
                              src={s.capa_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{s.titulo}</p>
                          <p className="text-[11px] text-slate-500 line-clamp-1 max-w-xs">
                            {s.resumo || "—"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(s.categoria || []).map((c, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="bg-slate-100 text-slate-700 text-[10px] border border-slate-200 font-medium"
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-bold text-slate-900 text-xs">
                      R$ {formatBRL(Number(s.preco || 0))}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                        <Star size={13} className="fill-amber-500" />
                        {Number(s.rating || 0).toFixed(1)}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleToggleStatus(s)}
                        className="flex items-center gap-1.5 text-xs transition-colors"
                      >
                        {s.status === "ativo" ? (
                          <>
                            <ToggleRight size={20} className="text-emerald-600" />
                            <span className="text-emerald-700 font-semibold">Ativo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={20} className="text-slate-400" />
                            <span className="text-slate-500 font-medium">Inativo</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAnimeTag(s)}
                          className="h-8 px-2 text-slate-500 hover:text-purple-600 text-xs rounded-lg hover:bg-purple-50"
                        >
                          Anime / Série
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(s)}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(s.id)}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog Modal in White */}
      {isOpenModal && editItem && (
        <Dialog open={isOpenModal} onOpenChange={setIsOpenModal}>
          <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Film size={20} className="text-rose-600" />
                {editItem.id ? "Editar Item do Catálogo" : "Novo Item no Catálogo"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 my-3 text-xs">
              {/* Título & Preço */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-slate-700 font-semibold">Título da Obra *</label>
                  <Input
                    value={editItem.titulo || ""}
                    onChange={(e) =>
                      setEditItem({ ...editItem, titulo: e.target.value })
                    }
                    placeholder="Ex: Stranger Things ou Demon Slayer"
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-10 text-xs focus-visible:ring-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold">Preço (BRL) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-semibold">
                      R$
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatBRL(Number(editItem.preco || 0))}
                      onChange={(e) =>
                        setEditItem({
                          ...editItem,
                          preco: parseBRL(e.target.value),
                        })
                      }
                      className="pl-9 bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-10 text-xs font-bold focus-visible:ring-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* Categorias */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold">Gêneros / Categorias</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl min-h-[42px] items-center">
                  {(editItem.categoria || []).map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-white text-slate-800 border border-slate-200 font-medium shadow-2xs"
                    >
                      {cat}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(cat)}
                        className="hover:text-rose-600"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1 ml-auto">
                    <Input
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Adicionar gênero..."
                      className="h-7 w-32 bg-white border-slate-200 text-xs rounded-lg px-2"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddTag}
                      className="h-7 px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded-lg"
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sinopse Curta */}
              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold">Sinopse Curta (Exibida nos Cards)</label>
                <textarea
                  value={editItem.resumo || ""}
                  onChange={(e) => setEditItem({ ...editItem, resumo: e.target.value })}
                  rows={2}
                  placeholder="Breve resumo da trama..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-rose-500 resize-none"
                />
              </div>

              {/* Metadados: Temporadas, Avaliação StarRating */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold">Avaliação por Estrelas</label>
                  <InteractiveStarRating
                    rating={Number(editItem.rating || 0)}
                    onChange={(r) => setEditItem({ ...editItem, rating: r })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold">Temporadas</label>
                  <Input
                    type="number"
                    min={1}
                    value={editItem.temporadas || 1}
                    onChange={(e) =>
                      setEditItem({
                        ...editItem,
                        temporadas: parseInt(e.target.value) || 1,
                      })
                    }
                    className="bg-white border-slate-200 text-slate-900 rounded-xl h-10 text-xs"
                  />
                </div>
              </div>

              {/* Upload de Capa */}
              <div className="space-y-2">
                <label className="text-slate-700 font-semibold">Capa / Poster (Upload direto no Storage)</label>
                <div className="flex items-center gap-4">
                  {editItem.capa_url && (
                    <div className="relative w-16 h-24 rounded-xl border border-slate-200 overflow-hidden shrink-0 shadow-xs">
                      <img
                        src={editItem.capa_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setEditItem({ ...editItem, capa_url: "" })}
                        className="absolute top-1 right-1 p-0.5 bg-slate-900/80 text-white rounded-full hover:bg-slate-900"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <Input
                      value={editItem.capa_url || ""}
                      onChange={(e) =>
                        setEditItem({ ...editItem, capa_url: e.target.value })
                      }
                      placeholder="URL pública da imagem ou faça upload..."
                      className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-9 text-xs"
                    />

                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadCover}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingImage}
                        onClick={() => fileInputRef.current?.click()}
                        className="border-slate-200 bg-white hover:bg-slate-50 text-xs gap-1.5 rounded-xl h-8 text-slate-700 shadow-xs"
                      >
                        <Upload size={13} />
                        <span>{uploadingImage ? "Enviando..." : "Selecionar Arquivo"}</span>
                      </Button>
                      <span className="text-[10px] text-slate-500">
                        PNG, JPG ou WEBP (máx. 5MB)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Links de Entrega e Player UpCloud */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold flex items-center gap-1">
                    <LinkIcon size={12} className="text-emerald-600" />
                    Link de Acesso / Drive
                  </label>
                  <Input
                    value={editItem.link_acesso || ""}
                    onChange={(e) =>
                      setEditItem({ ...editItem, link_acesso: e.target.value })
                    }
                    placeholder="https://drive.google.com/..."
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-10 text-xs"
                  />
                  <span className="text-[10px] text-slate-500">
                    Liberado ao comprador na confirmação de pagamento.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold flex items-center gap-1">
                    <Video size={12} className="text-purple-600" />
                    URL de Streaming (UpCloud / Embed)
                  </label>
                  <Input
                    value={editItem.stream_url || ""}
                    onChange={(e) =>
                      setEditItem({ ...editItem, stream_url: e.target.value })
                    }
                    placeholder="https://upcloud.biz/embed/..."
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-10 text-xs"
                  />
                  <span className="text-[10px] text-slate-500">
                    Player integrado para assistir no próprio site.
                  </span>
                </div>
              </div>

              {/* Vendas & Posição */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold flex items-center gap-1">
                    <Trophy size={12} className="text-amber-500" />
                    Vendas / Visualizações
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={editItem.vendas_count ?? 0}
                    onChange={(e) =>
                      setEditItem({ ...editItem, vendas_count: parseInt(e.target.value) || 0 })
                    }
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-10 text-xs"
                  />
                  <span className="text-[10px] text-slate-500">
                    Usado no ranking automático e contagem de compras.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold flex items-center gap-1">
                    <Layers size={12} className="text-blue-500" />
                    Posição no Catálogo
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={editItem.posicao ?? 0}
                    onChange={(e) =>
                      setEditItem({ ...editItem, posicao: parseInt(e.target.value) || 0 })
                    }
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl h-10 text-xs"
                  />
                  <span className="text-[10px] text-slate-500">
                    Ordem de ordenação geral quando classificado por posição.
                  </span>
                </div>
              </div>

              {/* Switches: Destaque Hero & Conteúdo Adulto */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editItem.is_hero || false}
                    onCheckedChange={(checked) =>
                      setEditItem({ ...editItem, is_hero: checked })
                    }
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    Destaque no Banner Principal (Hero)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={editItem.is_adult || false}
                    onCheckedChange={(checked) =>
                      setEditItem({ ...editItem, is_adult: checked })
                    }
                  />
                  <span className="text-xs text-slate-700 font-medium">
                    🔞 Conteúdo Restrito (+18)
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpenModal(false)}
                className="border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button
                disabled={isSaving}
                onClick={handleSave}
                className="bg-gradient-to-r from-[#7B3FE4] via-[#6C2BD9] to-[#5B21B6] hover:brightness-110 text-white font-bold text-xs rounded-xl gap-1.5 shadow-xs transition-all"
              >
                <Save size={15} />
                <span>{isSaving ? "Salvando..." : "Salvar no Catálogo"}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog in White */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-sm rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Excluir do Catálogo?
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500 mt-1">
            Esta ação removerá o título e todos os links vinculados a ele. Compradores anteriores ainda poderão ter acesso se você já tiver enviado o link por e-mail.
          </p>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(null)}
              className="border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (deleteConfirmId) {
                  await onDeleteSerie(deleteConfirmId);
                  setDeleteConfirmId(null);
                  toast.success("Item removido com sucesso.");
                }
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-xs"
            >
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <TopWatchedModal
        open={topWatchedModalOpen}
        onOpenChange={setTopWatchedModalOpen}
        allSeries={series}
      />
    </div>
  );
};

export default CatalogModule;
