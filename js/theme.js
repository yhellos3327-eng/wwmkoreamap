// @ts-check

/** @type {string} */
export const THEME_KEY = "wwm_theme";

/**
 * Initializes the theme system.
 */
export const initTheme = () => {
  const savedTheme = localStorage.getItem(THEME_KEY) || "system";
  applyTheme(savedTheme);

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (localStorage.getItem(THEME_KEY) === "system") {
        applyTheme("system");
      }
    });
};

/**
 * Applies a theme to the document.
 * @param {string} theme - The theme to apply ('light', 'dark', or 'system').
 */
export const applyTheme = (theme) => {
  let effectiveTheme = theme;
  if (theme === "system") {
    effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  document.documentElement.setAttribute("data-theme", effectiveTheme);
  localStorage.setItem(THEME_KEY, theme);

  if (/** @type {any} */ (window).setState) {
    /** @type {any} */ (window).setState("currentTheme", theme);
  }
};

/**
 * Gets the current theme setting.
 * @returns {string} The current theme.
 */
export const getTheme = () => {
  return localStorage.getItem(THEME_KEY) || "system";
};
