"use client";

const STORAGE_KEY = "saas-apps-theme";

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="header-icon-btn"
      aria-label="Toggle light and dark theme"
      onClick={() => {
        const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent("saas-theme-change", { detail: next }));
      }}
    >
      <span className="sr-only">Toggle theme</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  );
}
