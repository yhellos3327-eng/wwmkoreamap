(async () => {
    try {
        const FingerprintJS = await import('https://openfpcdn.io/fingerprintjs/v3');
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        window.visitorId = result.visitorId;

        // Fetch patching disabled due to CORS issues with backend
        /*
        const originalFetch = window.fetch;
        window.fetch = async (url, options = {}) => {
            if (!options) options = {};
            if (!options.headers) options.headers = {};

            if (window.visitorId) {
                if (options.headers instanceof Headers) {
                    options.headers.set('x-fingerprint', window.visitorId);
                } else if (Array.isArray(options.headers)) {
                    options.headers.push(['x-fingerprint', window.visitorId]);
                } else {
                    options.headers['x-fingerprint'] = window.visitorId;
                }
            }

            return originalFetch(url, options);
        };
        */
        console.log("[FP] Security initialized (Header injection disabled)");
    } catch (e) {
        console.warn("[FP] Failed", e);
    }
})();
