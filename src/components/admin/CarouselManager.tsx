import { useState, useEffect } from "react";
import {
  Plus, Trash2, Edit, Save, X, Eye, EyeOff,
  ArrowUp, ArrowDown, Layers, Palette, Filter,
  Trophy
} from "lucide-react";
import TopWatchedModal from "./TopWatchedModal";
import { Button } from "@/components/ui/button";
import {
  fetchCarouselSections, createCarouselSection, updateCarouselSection, deleteCarouselSection,
  saveGenreColors,
  type DbCarouselSection, type DbSerie,
} from "@/lib/api";
import { useGenreColors, DEFAULT_COLORS } from "@/hooks/useGenreColors";
import { toast } from "sonner";
import { PLATFORM_LIMITS } from "@/lib/limits";

interface CarouselManagerProps {
  sections: DbCarouselSection[];
  setSections: React.Dispatch<React.SetStateAction<DbCarouselSection[]>>;
  allSeries: DbSerie[];
}

const SECTION_TYPES = [
  { value: "category", label: "Por Categoria", desc: "Filtra séries por categoria" },
  { value: "recent", label: "Recentes", desc: "Séries mais recentes" },
  { value: "popular", label: "Populares", desc: "Ordenado por vendas" },
  { value: "top_rated", label: "Mais Avaliadas", desc: "Ordenado por rating" },
  { value: "all", label: "Todas", desc: "Todas as séries" },
];

const SORT_OPTIONS = [
  { value: "posicao", label: "Posição" },
  { value: "vendas_count", label: "Vendas" },
  { value: "data_adicao", label: "Data Adição" },
  { value: "rating", label: "Rating" },
  { value: "preco", label: "Preço" },
  { value: "titulo", label: "Título" },
];

const emptySection: Omit<DbCarouselSection, "id" | "created_at" | "updated_at"> = {
  title: "",
  section_type: "category",
  filter_category: "",
  sort_by: "posicao",
  sort_order: "asc",
  max_items: 20,
  is_visible: true,
  posicao: 0,
  show_rank: false,
  layout_mode: "vertical",
};

type SubTab = "sections" | "colors";

export default function CarouselManager({ sections, setSections, allSeries }: CarouselManagerProps) {
  const [editSection, setEditSection] = useState<Partial<DbCarouselSection> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>("sections");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [topWatchedModalOpen, setTopWatchedModalOpen] = useState(false);

  // Genre colors
  const { colors: genreColors } = useGenreColors();
  const [editGenreColors, setEditGenreColors] = useState<Record<string, string>>({});
  const [savingColors, setSavingColors] = useState(false);

  useEffect(() => { setEditGenreColors({ ...DEFAULT_COLORS, ...genreColors }); }, [genreColors]);

  // Get unique categories from series data
  const allSeriesCategories = Array.from(new Set(allSeries.flatMap((s) => s.categoria))).sort();
  const allCategories = Array.from(new Set(
    sections.map((s) => s.filter_category).filter(Boolean) as string[]
  ));

  // Filtered sections
  const filteredSections = genreFilter === "all"
    ? sections
    : sections.filter((s) => s.filter_category === genreFilter);

  const handleNew = () => {
    if (sections.length >= PLATFORM_LIMITS.CAROUSELS_MAX) {
      toast.error(`Limite máximo de ${PLATFORM_LIMITS.CAROUSELS_MAX} carrosséis atingido. Exclua uma seção para criar outra.`);
      return;
    }
    setEditSection({
      ...emptySection,
      posicao: sections.length + 1,
      filter_category: genreFilter !== "all" ? genreFilter : "",
    });
    setShowForm(true);
  };

  const handleEdit = (s: DbCarouselSection) => {
    setEditSection({ ...s });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta seção de carrossel?")) return;
    try {
      await deleteCarouselSection(id);
      setSections((p) => p.filter((s) => s.id !== id));
      toast.success("Seção excluída");
    } catch { toast.error("Erro ao excluir"); }
  };

  const handleSave = async () => {
    if (!editSection?.title) { toast.error("Título obrigatório"); return; }

    if (!editSection.id && sections.length >= PLATFORM_LIMITS.CAROUSELS_MAX) {
      toast.error(`Limite máximo de ${PLATFORM_LIMITS.CAROUSELS_MAX} carrosséis atingido.`);
      return;
    }

    setSaving(true);
    try {
      if (editSection.id) {
        const u = await updateCarouselSection(editSection.id, editSection);
        setSections((p) => p.map((s) => s.id === u.id ? u : s));
        toast.success("Atualizado");
      } else {
        const { id, created_at, updated_at, ...rest } = editSection as any;
        const c = await createCarouselSection(rest);
        setSections((p) => [...p, c].sort((a, b) => a.posicao - b.posicao));
        toast.success("Criado");
      }
      setShowForm(false);
      setEditSection(null);
    } catch (e: any) { toast.error(e?.message || "Erro"); }
    setSaving(false);
  };

  const handleToggleVisibility = async (s: DbCarouselSection) => {
    try {
      const u = await updateCarouselSection(s.id, { is_visible: !s.is_visible });
      setSections((p) => p.map((x) => x.id === u.id ? u : x));
      toast.success(u.is_visible ? "Visível" : "Oculto");
    } catch { toast.error("Erro"); }
  };

  const handleMove = async (s: DbCarouselSection, direction: "up" | "down") => {
    const sorted = [...filteredSections].sort((a, b) => a.posicao - b.posicao);
    const idx = sorted.findIndex((x) => x.id === s.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    try {
      const [u1, u2] = await Promise.all([
        updateCarouselSection(s.id, { posicao: other.posicao }),
        updateCarouselSection(other.id, { posicao: s.posicao }),
      ]);
      setSections((p) => {
        const next = p.map((x) => x.id === u1.id ? u1 : x.id === u2.id ? u2 : x);
        return next.sort((a, b) => a.posicao - b.posicao);
      });
    } catch { toast.error("Erro ao reordenar"); }
  };

  const handleSaveGenreColors = async () => {
    setSavingColors(true);
    try { await saveGenreColors(editGenreColors); toast.success("Cores salvas!"); } catch { toast.error("Erro ao salvar cores"); }
    setSavingColors(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="pb-6 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Carrosséis da Loja</h2>
            <p className="text-xs text-slate-500">{sections.length} seções configuradas</p>
          </div>
          {subTab === "sections" && (
            <Button
              onClick={handleNew}
              className="bg-gradient-to-r from-[#7B3FE4] via-[#6C2BD9] to-[#5B21B6] hover:brightness-110 text-white font-bold rounded-xl text-xs h-9 gap-1.5 shadow-xs transition-all"
            >
              <Plus size={15} />
              <span>Nova Seção</span>
              <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full ml-1">
                {sections.length}/{PLATFORM_LIMITS.CAROUSELS_MAX}
              </span>
            </Button>
          )}
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-max border border-slate-200">
          <button
            onClick={() => setSubTab("sections")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === "sections" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers size={14} /> Seções
          </button>
          <button
            onClick={() => setSubTab("colors")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === "colors" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Palette size={14} /> Cores de Brilho
          </button>
        </div>
      </div>

      {/* ===== SECTIONS SUB-TAB ===== */}
      {subTab === "sections" && (
        <>
          {/* Genre filter chips */}
          {allCategories.length > 0 && (
            <div className="pt-4 flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-slate-400" />
              <button
                onClick={() => setGenreFilter("all")}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  genreFilter === "all" ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                Todas
              </button>
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setGenreFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                    genreFilter === cat ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                onClick={() => setGenreFilter("__none__")}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                  genreFilter === "__none__" ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                Sem Categoria
              </button>
            </div>
          )}

          {/* Spotlight Card: Top 10 Mais Assistidos & Destaques */}
          <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20 shrink-0">
                <Trophy size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Top 10 Mais Assistidos & Destaques</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full border border-amber-200">
                    DESTAQUE PRINCIPAL DA LOJA
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Esta é a fileira principal com ranking (#1 ao #10). Escolha quais obras aparecem e sua ordem exata.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => setTopWatchedModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold gap-1.5 rounded-xl shadow-xs shrink-0"
            >
              <Trophy size={14} />
              Alterar Mais Assistidas (Top 10)
            </Button>
          </div>

          <div className="pt-4 space-y-3">
            {filteredSections.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center">
                <Layers size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">
                  {genreFilter !== "all" ? `Nenhuma seção para "${genreFilter === "__none__" ? "Sem Categoria" : genreFilter}"` : "Nenhuma seção de carrossel"}
                </p>
                <Button onClick={handleNew} variant="outline" className="mt-4 text-xs border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs">
                  <Plus size={14} className="mr-1" /> Criar seção
                </Button>
              </div>
            ) : (
              filteredSections.map((s, idx) => (
                <div
                  key={s.id}
                  className={`bg-white border rounded-xl p-4 transition-all shadow-xs ${
                    s.is_visible ? "border-slate-200" : "border-slate-200/60 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => handleMove(s, "up")} disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 transition-colors">
                        <ArrowUp size={14} />
                      </button>
                      <button onClick={() => handleMove(s, "down")} disabled={idx === filteredSections.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 transition-colors">
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-bold text-sm">
                      {s.posicao}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">{s.title}</h4>
                        {s.show_rank && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded">RANK</span>
                        )}
                        {(s.show_rank || s.title.toUpperCase().includes("MAIS ASSISTIDAS")) && (
                          <button
                            type="button"
                            onClick={() => setTopWatchedModalOpen(true)}
                            className="text-[10px] font-bold px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-colors flex items-center gap-1 shadow-2xs"
                          >
                            <Trophy size={10} />
                            Definir Séries
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-[11px] text-slate-500">
                          {SECTION_TYPES.find((t) => t.value === s.section_type)?.label || s.section_type}
                        </span>
                        {s.filter_category && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded font-medium">
                            {s.filter_category}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {SORT_OPTIONS.find((o) => o.value === s.sort_by)?.label} ({s.sort_order === "asc" ? "↑" : "↓"})
                        </span>
                        <span className="text-[10px] text-slate-400">
                          máx {s.max_items}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          (s as any).layout_mode === "horizontal" ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-slate-100 border-slate-200 text-slate-600"
                        }`}>
                          {(s as any).layout_mode === "horizontal" ? "↔ HORIZONTAL" : "📐 VERTICAL"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button onClick={() => handleToggleVisibility(s)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 transition-colors">
                        {s.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button onClick={() => handleEdit(s)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 transition-colors">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(s.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ===== COLORS SUB-TAB ===== */}
      {subTab === "colors" && (
        <div className="pt-4 max-w-3xl">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Palette size={16} className="text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900">Cores de Brilho por Gênero</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">Configure a cor do brilho que aparece ao passar o mouse nas séries, de acordo com o gênero.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.keys(editGenreColors).map((genre) => (
                <div key={genre} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <div className="w-6 h-6 rounded-full border border-slate-300 flex-shrink-0" style={{ background: `hsl(${editGenreColors[genre]})` }} />
                  <span className="text-xs font-semibold text-slate-800 flex-1">{genre}</span>
                  <input type="text" value={editGenreColors[genre]} onChange={(e) => setEditGenreColors({ ...editGenreColors, [genre]: e.target.value })}
                    className="w-32 bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-900 outline-none focus:border-rose-500" placeholder="H S% L%" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <Button onClick={handleSaveGenreColors} disabled={savingColors} className="bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-xl h-9 gap-1.5 shadow-sm">
                {savingColors ? "Salvando..." : <><Save size={14} /> Salvar Cores</>}
              </Button>
              <p className="text-[10px] text-slate-400">Formato: H S% L% (ex: 200 100% 55%)</p>
            </div>
          </div>
        </div>
      )}

      {/* Section Form Modal */}
      {showForm && editSection && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in text-slate-900">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editSection.id ? "Editar Seção" : "Nova Seção"}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-800 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-medium block mb-1">Título do Carrossel</label>
                <input type="text" value={editSection.title || ""} onChange={(e) => setEditSection({ ...editSection, title: e.target.value })}
                  placeholder="Ex: Em Alta, Novidades, Ação..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500 transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Tipo da Seção</label>
                  <select value={editSection.section_type || "category"} onChange={(e) => setEditSection({ ...editSection, section_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500">
                    {SECTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {SECTION_TYPES.find((t) => t.value === editSection.section_type)?.desc}
                  </p>
                </div>

                {editSection.section_type === "category" && (
                  <div>
                    <label className="text-slate-700 font-medium block mb-1">Categoria</label>
                    <select value={editSection.filter_category || ""} onChange={(e) => setEditSection({ ...editSection, filter_category: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500">
                      <option value="">Nenhuma (todas)</option>
                      {allSeriesCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Categorias extraídas do catálogo</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Ordenar por</label>
                  <select value={editSection.sort_by || "posicao"} onChange={(e) => setEditSection({ ...editSection, sort_by: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500">
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Direção</label>
                  <select value={editSection.sort_order || "asc"} onChange={(e) => setEditSection({ ...editSection, sort_order: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500">
                    <option value="asc">Crescente ↑</option>
                    <option value="desc">Decrescente ↓</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Máx. Itens</label>
                  <input type="number" min={1} max={50} value={editSection.max_items || 20} onChange={(e) => setEditSection({ ...editSection, max_items: parseInt(e.target.value) || 20 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500 transition-colors" />
                </div>
                <div>
                  <label className="text-slate-700 font-medium block mb-1">Posição</label>
                  <input type="number" min={0} value={editSection.posicao || 0} onChange={(e) => setEditSection({ ...editSection, posicao: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-rose-500 transition-colors" />
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editSection.is_visible ?? true} onChange={(e) => setEditSection({ ...editSection, is_visible: e.target.checked })} className="accent-rose-600 rounded" />
                  <span className="text-xs font-medium text-slate-800">Visível</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editSection.show_rank ?? false} onChange={(e) => setEditSection({ ...editSection, show_rank: e.target.checked })} className="accent-rose-600 rounded" />
                  <span className="text-xs font-medium text-slate-800">Mostrar ranking</span>
                </label>
              </div>

              <div>
                <label className="text-slate-700 font-medium block mb-1">Layout de Exibição</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditSection({ ...editSection, layout_mode: "vertical" })}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      (editSection.layout_mode || "vertical") === "vertical"
                        ? "bg-rose-50 border-rose-300 text-rose-700 shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    📐 Grid Vertical
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditSection({ ...editSection, layout_mode: "horizontal" })}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      editSection.layout_mode === "horizontal"
                        ? "bg-rose-50 border-rose-300 text-rose-700 shadow-2xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ↔️ Rolagem Horizontal
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <Button onClick={handleSave} disabled={saving} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl h-10 shadow-sm">
                  {saving ? "Salvando..." : <><Save size={15} /> Salvar Alterações</>}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)} className="border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl text-xs h-10">
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <TopWatchedModal
        open={topWatchedModalOpen}
        onOpenChange={setTopWatchedModalOpen}
        allSeries={allSeries}
      />
    </div>
  );
}
