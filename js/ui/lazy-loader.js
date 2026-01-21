// @ts-check
export class LazyLoader {
  constructor() {
    /** @type {IntersectionObserver|null} */
    this.observer = null;
    this.init();
  }

  init() {
    if ("IntersectionObserver" in window) {
      this.observer = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = /** @type {HTMLImageElement} */ (entry.target);
              const src = img.dataset.src;

              if (src) {
                const tempImg = new Image();
                tempImg.onload = () => {
                  img.src = src;
                  img.classList.add("loaded");
                  img.removeAttribute("data-src");
                };
                tempImg.src = src;
              }

              observer.unobserve(img);
            }
          });
        },
        {
          rootMargin: "100px 0px",
          threshold: 0.01,
        },
      );
    }
  }

  /**
   * @param {HTMLElement} element
   */
  observe(element) {
    if (this.observer) {
      this.observer.observe(element);
    } else {
      const src = element.dataset.src;
      if (src) /** @type {HTMLImageElement} */ (element).src = src;
    }
  }

  /**
   * @param {string} [selector]
   * @param {Document|HTMLElement} [context]
   */
  observeAll(selector = ".lazy-load", context = document) {
    const elements = context.querySelectorAll(selector);
    elements.forEach((el) => this.observe(/** @type {HTMLElement} */ (el)));
  }
}

export const lazyLoader = new LazyLoader();
