import { useUiStore, type Theme } from "../../store/ui";

const THEMES: Array<{
  value: Theme;
  label: string;
  description: string;
  preview: string;
}> = [
  {
    value: "dark",
    label: "🌙 Dark",
    description: "Deep navy — default",
    preview: "bg-slate-900 border-slate-700",
  },
  {
    value: "light",
    label: "☀️ Light",
    description: "Clean white",
    preview: "bg-white border-slate-300",
  },
  {
    value: "high-contrast",
    label: "🔳 High Contrast",
    description: "WCAG AAA, easy on eyes",
    preview: "bg-black border-white",
  },
  {
    value: "midnight",
    label: "🌊 Midnight",
    description: "Deep blue-black",
    preview: "bg-[#070d1a] border-[#1e3a5f]",
  },
];

export function ThemePicker() {
  const { theme, setTheme } = useUiStore();
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
        Theme
      </p>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all
              ${
                theme === t.value
                  ? "border-blue-500"
                  : "border-slate-700 hover:border-slate-500"
              }`}
          >
            <div className={`w-8 h-8 rounded border ${t.preview} shrink-0`} />
            <div>
              <p className="text-sm font-medium text-slate-200">{t.label}</p>
              <p className="text-xs text-slate-500">{t.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
