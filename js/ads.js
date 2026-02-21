// @ts-check
/**
 * @fileoverview 광고 모듈 - 광고 표시 및 로테이션을 처리합니다.
 * @module ads
 */

/**
 * @typedef {Object} AdConfig
 * @property {string} type - 광고 유형 식별자.
 * @property {number} weight - 선택 가중치 (높을수록 선택될 확률이 높음).
 * @property {(container: HTMLElement) => void} render - 렌더링 함수.
 */

/**
 * 광고 시스템을 초기화하고 다중 광고 컨테이너에 순환 광고를 표시합니다.
 */
export function initAds() {
  const adContainer = /** @type {HTMLElement|null} */ (
    document.querySelector(".ad-container")
  );
  if (!adContainer) return;

  /** @type {string|null} */
  let currentAdType = null;

  /** @type {AdConfig[]} */
  const ads = [
    {
      type: "kakao",
      weight: 100,
      render: (container) => {
        container.innerHTML = "";
        const ins = document.createElement("ins");
        ins.className = "kakao_ad_area";
        ins.style.display = "block";
        ins.setAttribute("data-ad-unit", "DAN-s2pO3hHAlyqBHTmC");
        ins.setAttribute("data-ad-width", "320");
        ins.setAttribute("data-ad-height", "100");
        container.appendChild(ins);

        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = "//t1.daumcdn.net/kas/static/ba.min.js";
        script.async = true;
        container.appendChild(script);
      },
    },
    {
      type: "coffee",
      weight: 0,
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
      weight: 0,
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
      type: "wwmkodiscord",
      weight: 0,
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
        img.src = "image/logo.png";

        el.appendChild(img);
        el.onclick = () => window.open("https://discord.gg/fC2WE5AKuY", "_blank");
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
   * 가중치를 기반으로 랜덤 광고를 표시합니다.
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

    if (selectedAd.type === currentAdType) return;

    currentAdType = selectedAd.type;
    selectedAd.render(adContainer);
  }

  showRandomAd();
  setInterval(showRandomAd, 30000);
}

/**
 * 광고 플레이스홀더 요소를 생성합니다.
 * @param {string} title - 광고 제목.
 * @param {string} badgeText - 배지 텍스트.
 * @param {string} bgStyle - 배경색 또는 그라데이션.
 * @param {string} textColor - 텍스트 색상.
 * @returns {HTMLDivElement} 광고 요소.
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
