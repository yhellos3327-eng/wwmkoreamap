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
        (entries) => {
          entries.forEach((entry) => {
            const img = /** @type {HTMLImageElement} */ (entry.target);
            const isGif = img.dataset.src?.toLowerCase().endsWith(".gif") ||
              img.src.toLowerCase().endsWith(".gif");

            if (entry.isIntersecting) {
              const src = img.dataset.src || img.dataset.lazySrc;
              if (src) {
                if (img.src !== src) {
                  img.src = src;
                }
                img.classList.add("loaded");
              }
              // If not a GIF, we can stop observing after initial load
              if (!isGif) {
                this.observer?.unobserve(img);
              }
            } else {
              // Optimization: Clear GIF src when out of view to stop animation/CPU usage
              if (isGif && img.src) {
                // Store current src in data-lazy-src before clearing
                if (!img.dataset.lazySrc) {
                  img.dataset.lazySrc = img.src;
                }
                img.src = ""; // Stop the GIF
              }
            }
          });
        },
        {
          rootMargin: "200px 0px", // Larger margin for smoother experience
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
      // If it's a GIF, ensure we have the src stored
      if (element.tagName === "IMG") {
        const img = /** @type {HTMLImageElement} */ (element);
        if (img.src && !img.dataset.src) {
          const isGif = img.src.toLowerCase().endsWith(".gif");
          if (isGif) {
            img.dataset.lazySrc = img.src;
          }
        }
      }
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
    elements.forEach((el) => this.observe(/** @type {HTMLElement} */(el)));
  }
}

export const lazyLoader = new LazyLoader();
