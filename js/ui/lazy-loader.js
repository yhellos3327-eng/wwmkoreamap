export class LazyLoader {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const src = img.dataset.src;

                        if (src) {
                            const tempImg = new Image();
                            tempImg.onload = () => {
                                img.src = src;
                                img.classList.add('loaded');
                                img.removeAttribute('data-src');
                                
                                
                            };
                            tempImg.src = src;
                        }

                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: '100px 0px',
                threshold: 0.01
            });
        }
    }

    observe(element) {
        if (this.observer) {
            this.observer.observe(element);
        } else {
            const src = element.dataset.src;
            if (src) element.src = src;
        }
    }

    observeAll(selector = '.lazy-load', context = document) {
        const elements = context.querySelectorAll(selector);
        elements.forEach(el => this.observe(el));
    }
}

export const lazyLoader = new LazyLoader();
