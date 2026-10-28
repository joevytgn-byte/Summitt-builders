"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (localStorage.getItem("summit-theme") as "light" | "dark" | null) ?? "light";
    setTheme(stored);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("summit-theme", next);
  }

  return (
    <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title="Toggle theme">
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
