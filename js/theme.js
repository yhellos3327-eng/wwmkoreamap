// @ts-check

/** @type {string} */
export const THEME_KEY = "wwm_theme";

/**
 * Initializes the theme system.
 */
export const initTheme = async () => {
  const { primaryDb } = await import("./storage/db.js");
  const savedTheme = (await primaryDb.get(THEME_KEY)) || "system";
  applyTheme(savedTheme);

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", async (e) => {
      const current = await primaryDb.get(THEME_KEY);
      if (current === "system") {
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
  document.documentElement.setAttribute("data-theme", effectiveTheme);

  import("./storage/db.js").then(({ primaryDb }) => {
    primaryDb.set(THEME_KEY, theme).catch(console.warn);
  });

  if (/** @type {any} */ (window).setState) {
    /** @type {any} */ (window).setState("currentTheme", theme);
  }
};

/**
 * Gets the current theme setting.
 * @returns {Promise<string>} The current theme.
 */
export const getTheme = async () => {
  const { primaryDb } = await import("./storage/db.js");
  return (await primaryDb.get(THEME_KEY)) || "system";
};
