export const loadComponent = async (url, containerId) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();

        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                container.outerHTML = html; // Replace the placeholder with the actual component
            } else {
                console.warn(`Container #${containerId} not found for ${url}`);
            }
        } else {
            // For modals, append to body
            const div = document.createElement('div');
            div.innerHTML = html;
            while (div.firstChild) {
                document.body.appendChild(div.firstChild);
            }
        }
    } catch (error) {
        console.error(`Failed to load component: ${url}`, error);
    }
};

export const loadAllComponents = async () => {
    // Sidebar needs a placeholder to maintain order/layout if possible, 
    // but since it's absolute/fixed or flex, we need to be careful.
    // In index.html, sidebar is inside .app-container.

    await Promise.all([
        loadComponent('components/sidebar.html', 'sidebar-placeholder'),
        loadComponent('components/settings-modal.html'),
        loadComponent('components/github-modal.html'),
        loadComponent('components/related-modal.html'),
        loadComponent('components/dev-modal.html'),
        loadComponent('components/lightboxes.html')
    ]);
};
