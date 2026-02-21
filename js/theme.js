// @ts-check

/** @type {string} */
export const THEME_KEY = "wwm_theme";

/**
 * 테마 시스템을 초기화합니다.
 */
export const initTheme = async () => {
  try {
    const { primaryDb } = await import("./storage/db.js");
    const savedTheme = (await primaryDb.get(THEME_KEY)) || "system";
    applyTheme(savedTheme);

    // 시스템 테마 변경 시 테마 확인 (비동기 콜백 처리)
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        primaryDb.get(THEME_KEY)
          .then((current) => {
            if (current === "system") {
              applyTheme("system");
            }
          })
          .catch((err) => {
            console.warn("Failed to check theme on system change:", err);
          });
      });
  } catch (e) {
    console.error("Failed to initialize theme:", e);
    // 시스템 테마로 폴백
    applyTheme("system");
  }
};

/**
 * 문서에 테마를 적용합니다.
 * @param {string} theme - 적용할 테마 ('light', 'dark', 또는 'system').
 */
export const applyTheme = (theme) => {
  let effectiveTheme = theme;
  if (theme === "system") {
    effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  document.documentElement.setAttribute("data-theme", effectiveTheme);

  import("./storage/db.js").then(async ({ primaryDb }) => {
    try {
      const result = await primaryDb.set(THEME_KEY, theme);
      if (result && result.success) {
        const saved = await primaryDb.get(THEME_KEY);
        if (saved !== theme) {
          console.error("Theme save verification failed", { expected: theme, actual: saved });
        }
      } else {
        console.error("Failed to save theme", result);
      }
    } catch (e) {
      console.error("Error saving theme", e);
    }
  }).catch((importErr) => {
    console.error(`Failed to import storage for saving theme (${theme}):`, importErr);
  });

  if (/** @type {any} */ (window).setState) {
    /** @type {any} */ (window).setState("currentTheme", theme);
  }
};

/**
 * 현재 테마 설정을 가져옵니다.
 * @returns {Promise<string>} 현재 테마.
 */
export const getTheme = async () => {
  const { primaryDb } = await import("./storage/db.js");
  return (await primaryDb.get(THEME_KEY)) || "system";
};
