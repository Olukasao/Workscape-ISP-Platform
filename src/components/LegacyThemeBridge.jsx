import { useMemo } from "react";
import ThemeContext from "../legacy/utils/ThemeContext";
import { usePreferences } from "../stores/workspace";
export default function LegacyThemeBridge({ children }) {
  const { theme, setTheme } = usePreferences();
  const value = useMemo(
    () => ({
      theme: theme === "light" ? "claro" : "escuro",
      isLightTheme: theme === "light",
      isWorldCupTheme: false,
      setTheme: (t) => setTheme(t === "claro" ? "light" : "dark"),
      toggleTheme: () => setTheme(theme === "light" ? "dark" : "light"),
      toggleWorldCup: () => {},
    }),
    [theme, setTheme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
