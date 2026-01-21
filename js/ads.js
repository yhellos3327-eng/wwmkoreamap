// @ts-check
/**
 * @fileoverview Ads module - handles ad display and rotation.
 * @module ads
 */

/**
 * @typedef {Object} AdConfig
 * @property {string} type - Ad type identifier.
 * @property {number} weight - Selection weight (higher = more likely).
 * @property {(container: HTMLElement) => void} render - Render function.
 */

/**
 * Initializes the ad system and displays rotating ads.
 */
export function initAds() {
  const adContainer = /** @type {HTMLElement|null} */ (
    document.querySelector(".ad-container")
  );
  if (!adContainer) return;

  /** @type {AdConfig[]} */
  const ads = [
    {
      type: "google",
      weight: 0,
      render: (container) => {
        container.innerHTML = "";
        const script = document.createElement("script");
        script.async = true;
        script.src =
          "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6903444943515445";
        script.crossOrigin = "anonymous";
        container.appendChild(script);
      },
    },
    {
      type: "coffee",
      weight: 80,
      render: (container) => {
        const el = document.createElement("div");
        el.className = "ad-placeholder";
        el.style.background = "#ffffff";
        el.style.border = "none";
        el.style.cursor = "pointer";
        el.style.position = "relative";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.overflow = "hidden";

        const img = document.createElement("img");
        img.src = "image/coffee2.png";
        img.style.width = "120%";

        el.appendChild(img);
        el.onclick = () =>
          window.open("https://buymeacoffee.com/wwmmap", "_blank");
        container.innerHTML = "";
        container.appendChild(el);
      },
    },
    {
      type: "wwmtips",
      weight: 50,
      render: (container) => {
        const el = document.createElement("div");
        el.className = "ad-placeholder";
        el.style.background = "#1d1e22";
        el.style.border = "none";
        el.style.cursor = "pointer";
        el.style.position = "relative";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.overflow = "hidden";

        const img = document.createElement("img");
        img.src = "image/wwmtips.png";

        el.appendChild(img);
        el.onclick = () => window.open("https://wwm.tips/", "_blank");
        container.innerHTML = "";
        container.appendChild(el);
      },
    },
    {
      type: "public",
      weight: 0,
      render: (container) => {
        const el = createAdElement(
          "공익 광고 캠페인",
          "수익 미발생",
          "#2ecc71",
          "#ffffff",
        );
        container.innerHTML = "";
        container.appendChild(el);
      },
    },
    {
      type: "alliance",
      weight: 0,
      render: (container) => {
        const el = createAdElement(
          "자체 광고",
          "수익 미발생",
          "#3498db",
          "#ffffff",
        );
        container.innerHTML = "";
        container.appendChild(el);
      },
    },
  ];

  /**
   * Shows a random ad based on weights.
   */
  function showRandomAd() {
    const totalWeight = ads.reduce((sum, ad) => sum + ad.weight, 0);
    if (totalWeight === 0) return;

    let random = Math.random() * totalWeight;
    let selectedAd = ads[0];

    for (const ad of ads) {
      if (random < ad.weight) {
        selectedAd = ad;
        break;
      }
      random -= ad.weight;
    }

    selectedAd.render(adContainer);
  }

  showRandomAd();
  setInterval(showRandomAd, 30000);
}

/**
 * Creates an ad placeholder element.
 * @param {string} title - Ad title.
 * @param {string} badgeText - Badge text.
 * @param {string} bgStyle - Background color or gradient.
 * @param {string} textColor - Text color.
 * @returns {HTMLDivElement} The ad element.
 */
function createAdElement(title, badgeText, bgStyle, textColor) {
  const div = document.createElement("div");
  div.className = "ad-placeholder";

  if (bgStyle.includes("gradient")) {
    div.style.background = bgStyle;
  } else {
    div.style.backgroundColor = bgStyle;
  }

  div.style.color = textColor;
  div.style.border = "none";
  div.style.cursor = "pointer";

  div.innerHTML = `
        <span class="ad-title" style="z-index: 1;">${title}</span>
        <span class="ad-badge" style="z-index: 1;">${badgeText}</span>
    `;

  return div;
}
