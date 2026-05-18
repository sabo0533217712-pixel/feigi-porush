import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/**
 * Theme initialization
 * Ensures consistent colors across Vercel / production
 */
function initTheme() {
  const root = document.documentElement;

  // בדיקת theme מהדפדפן / localStorage (אם קיים)
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    root.classList.add("dark");
  } else if (savedTheme === "light") {
    root.classList.remove("dark");
  } else {
    // ברירת מחדל: לפי מערכת ההפעלה
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

// מפעיל theme לפני רינדור React
initTheme();

createRoot(document.getElementById("root")!).render(
  <App />
);