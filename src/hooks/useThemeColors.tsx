import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  price: string;
  top10Accent: string;
  background: string;
  cardBackground: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
}

export const DEFAULT_THEME_COLORS: ThemeColors = {
  primary: "#E31C25",
  primaryHover: "#B91C1C",
  price: "#EF4444",
  top10Accent: "#E31C25",
  background: "#09090b",
  cardBackground: "#141418",
  cardBorder: "#27272a",
  textPrimary: "#ffffff",
  textSecondary: "#a1a1aa",
};

export const THEME_PRESETS: { name: string; icon: string; colors: ThemeColors }[] = [
  {
    name: "HangarBox Red (Padrão)",
    icon: "🔥",
    colors: { ...DEFAULT_THEME_COLORS },
  },
  {
    name: "Cyber Purple",
    icon: "🟣",
    colors: {
      primary: "#9333EA",
      primaryHover: "#7E22CE",
      price: "#A855F7",
      top10Accent: "#9333EA",
      background: "#09070f",
      cardBackground: "#130f24",
      cardBorder: "#2e1065",
      textPrimary: "#ffffff",
      textSecondary: "#c084fc",
    },
  },
  {
    name: "Cinema Gold",
    icon: "👑",
    colors: {
      primary: "#F59E0B",
      primaryHover: "#D97706",
      price: "#FBBF24",
      top10Accent: "#F59E0B",
      background: "#0a0a09",
      cardBackground: "#171612",
      cardBorder: "#453310",
      textPrimary: "#ffffff",
      textSecondary: "#fde68a",
    },
  },
  {
    name: "Ocean Blue",
    icon: "🌊",
    colors: {
      primary: "#2563EB",
      primaryHover: "#1D4ED8",
      price: "#3B82F6",
      top10Accent: "#2563EB",
      background: "#030712",
      cardBackground: "#0b1329",
      cardBorder: "#1e3a8a",
      textPrimary: "#ffffff",
      textSecondary: "#93c5fd",
    },
  },
  {
    name: "Emerald Matrix",
    icon: "🟢",
    colors: {
      primary: "#10B981",
      primaryHover: "#059669",
      price: "#34D399",
      top10Accent: "#10B981",
      background: "#02120a",
      cardBackground: "#062416",
      cardBorder: "#065f46",
      textPrimary: "#ffffff",
      textSecondary: "#a7f3d0",
    },
  },
  {
    name: "OLED Stealth",
    icon: "🖤",
    colors: {
      primary: "#E4E4E7",
      primaryHover: "#A1A1AA",
      price: "#F4F4F5",
      top10Accent: "#FFFFFF",
      background: "#000000",
      cardBackground: "#0a0a0a",
      cardBorder: "#1f1f1f",
      textPrimary: "#ffffff",
      textSecondary: "#71717a",
    },
  },
];

const STORAGE_KEY = "hangarbox_site_theme_colors";
const STYLE_TAG_ID = "hb-dynamic-theme-styles";

export function applyThemeToDom(colors: ThemeColors) {
  if (typeof document === "undefined") return;

  let styleTag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = STYLE_TAG_ID;
    document.head.appendChild(styleTag);
  }

  styleTag.textContent = `
    :root {
      --hb-primary: ${colors.primary};
      --hb-primary-hover: ${colors.primaryHover};
      --hb-price: ${colors.price};
      --hb-top10-accent: ${colors.top10Accent};
      --hb-bg: ${colors.background};
      --hb-card: ${colors.cardBackground};
      --hb-border: ${colors.cardBorder};
      --hb-text: ${colors.textPrimary};
      --hb-text-sec: ${colors.textSecondary};
    }

    body {
      background-color: var(--hb-bg) !important;
      color: var(--hb-text) !important;
    }

    .bg-primary {
      background-color: var(--hb-primary) !important;
    }

    .hover\\:bg-primary\\/90:hover {
      background-color: var(--hb-primary-hover) !important;
    }

    .text-primary {
      color: var(--hb-primary) !important;
    }

    .text-red-500 {
      color: var(--hb-price) !important;
    }
  `;
}

export function useThemeColors() {
  const [colors, setColors] = useState<ThemeColors>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) return { ...DEFAULT_THEME_COLORS, ...JSON.parse(cached) };
      } catch {
        // Fallback
      }
    }
    return DEFAULT_THEME_COLORS;
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    applyThemeToDom(colors);
  }, [colors]);

  useEffect(() => {
    async function loadRemoteSettings() {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "theme_colors")
          .maybeSingle();

        if (!error && data?.value) {
          const remoteParsed = JSON.parse(data.value);
          const merged = { ...DEFAULT_THEME_COLORS, ...remoteParsed };
          setColors(merged);
          applyThemeToDom(merged);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }
      } catch {
        // Ignora erro
      }
    }
    loadRemoteSettings();
  }, []);

  const saveColors = async (newColors: ThemeColors): Promise<boolean> => {
    setSaving(true);
    try {
      setColors(newColors);
      applyThemeToDom(newColors);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newColors));

      try {
        await supabase
          .from("site_settings")
          .upsert({ key: "theme_colors", value: JSON.stringify(newColors) }, { onConflict: "key" });
      } catch {
        // Cache local mantido
      }
      return true;
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    await saveColors(DEFAULT_THEME_COLORS);
  };

  return {
    colors,
    setColors,
    saveColors,
    resetToDefault,
    saving,
  };
}
