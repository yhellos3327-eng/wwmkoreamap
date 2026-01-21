// @ts-check
/**
 * @typedef {Object} VirtualScrollerConfig
 * @property {HTMLElement} element
 * @property {HTMLElement} [scrollContainer]
 * @property {function(any, number): HTMLElement} renderItem
 * @property {number} [itemHeight]
 * @property {number} [columns]
 * @property {any[]} [items]
 * @property {number} [buffer]
 */

export class VirtualScroller {
  /**
   * @param {VirtualScrollerConfig} config
   */
  constructor(config) {
    this.element = config.element;
    this.scrollContainer = config.scrollContainer || this.element;
    this.renderItem = config.renderItem;
    this.itemHeight = config.itemHeight || 60;
    this.columns = config.columns || 1;
    this.items = config.items || [];
    this.buffer = config.buffer || 5;

    /** @type {boolean} */
    this.ticking = false;
    /** @type {number} */
    this.lastStart = -1;
    /** @type {number} */
    this.lastEnd = -1;
    /** @type {HTMLElement} */
    this.spacer = document.createElement("div");
    /** @type {HTMLElement} */
    this.content = document.createElement("div");

    this.initDOM();
    this.bindEvents();

    if (this.items.length > 0) {
      this.setItems(this.items);
    }
  }

  initDOM() {
    if (getComputedStyle(this.element).position === "static") {
      this.element.style.position = "relative";
    }

    this.spacer = document.createElement("div");
    this.spacer.className = "virtual-spacer";
    this.spacer.style.opacity = "0";
    this.spacer.style.pointerEvents = "none";
    this.spacer.style.width = "1px";

    this.content = document.createElement("div");
    this.content.className = "virtual-content";
    this.content.style.position = "absolute";
    this.content.style.top = "0";
    this.content.style.left = "0";
    this.content.style.width = "100%";

    this.element.innerHTML = "";
    this.element.appendChild(this.spacer);
    this.element.appendChild(this.content);
  }

  bindEvents() {
    this.scrollContainer.addEventListener("scroll", this.onScroll.bind(this), {
      passive: true,
    });
  }

  onScroll() {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.render();
      this.ticking = false;
    });
  }

  setItems(items) {
    this.items = items;
    const rows = Math.ceil(items.length / this.columns);
    this.spacer.style.height = `${rows * this.itemHeight}px`;
    this.render(true);
  }

  render(force = false) {
    let scrollTop = this.scrollContainer.scrollTop;

    if (this.scrollContainer !== this.element) {
      let offset = 0;
      let el = this.element;

      while (el && el !== this.scrollContainer) {
        offset += el.offsetTop;
        el = /** @type {HTMLElement} */ (el.offsetParent);
      }
      scrollTop = Math.max(0, this.scrollContainer.scrollTop - offset);
    }

    const viewportHeight = this.scrollContainer.clientHeight;

    const startRow = Math.floor(scrollTop / this.itemHeight);
    const endRow = Math.ceil((scrollTop + viewportHeight) / this.itemHeight);

    const bufferedStartRow = Math.max(0, startRow - this.buffer);
    const bufferedEndRow = Math.min(
      Math.ceil(this.items.length / this.columns),
      endRow + this.buffer,
    );

    const start = bufferedStartRow * this.columns;
    const end = Math.min(this.items.length, bufferedEndRow * this.columns);

    if (!force && this.lastStart === start && this.lastEnd === end) {
      return;
    }
    this.lastStart = start;
    this.lastEnd = end;

    this.content.style.transform = `translateY(${bufferedStartRow * this.itemHeight}px)`;

    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const item = this.items[i];
      const el = this.renderItem(item, i);
      fragment.appendChild(el);
    }

    this.content.innerHTML = "";
    this.content.appendChild(fragment);
  }

  destroy() {
    this.scrollContainer.removeEventListener(
      "scroll",
      this.onScroll.bind(this),
    );
    this.element.innerHTML = "";
  }
}
