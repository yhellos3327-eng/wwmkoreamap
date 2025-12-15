import { state, setState } from './state.js';
import { t } from './utils.js';

export const enableDevMode = () => {
    if (state.isDevMode) {
        console.log("이미 개발자 모드가 활성화되어 있습니다.");
        return;
    }

    setState('isDevMode', true);
    console.log("%c🔧 개발자 모드가 활성화되었습니다.", "color: #daac71; font-size: 16px; font-weight: bold;");

    const devModal = document.getElementById('dev-modal');
    const categorySelect = document.getElementById('dev-category');
    let tempMarker = null;

    if (categorySelect && state.mapData.categories) {
        categorySelect.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "카테고리 선택...";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        categorySelect.appendChild(defaultOption);
        state.mapData.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = `${t(cat.name)} (${cat.id})`;
            categorySelect.appendChild(option);
        });
    }

    // Map click handler for placing pins
    state.map.on('click', (e) => {
        if (!state.isDevMode) return;

        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);

        if (tempMarker) state.map.removeLayer(tempMarker);

        const emojiIcon = L.divIcon({
            className: '',
            html: '<div style="font-size: 36px; line-height: 1; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); cursor: pointer;">📍</div>',
            iconSize: [36, 36],
            iconAnchor: [18, 36]
        });

        tempMarker = L.marker([lat, lng], { icon: emojiIcon, zIndexOffset: 1000 }).addTo(state.map);

        document.getElementById('dev-x').value = lat;
        document.getElementById('dev-y').value = lng;
        document.getElementById('dev-output').value = '';
        if (categorySelect) categorySelect.value = "";

        devModal.classList.remove('hidden');
    });

    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            if (!tempMarker) return;
            const selectedCatId = e.target.value;
            const selectedCat = state.mapData.categories.find(c => c.id === selectedCatId);

            if (selectedCat && selectedCat.image) {
                const newIcon = L.icon({
                    iconUrl: selectedCat.image,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15],
                    className: 'marker-anim'
                });
                tempMarker.setIcon(newIcon);
            } else {
                const emojiIcon = L.divIcon({
                    className: '',
                    html: '<div style="font-size: 36px; line-height: 1; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));">📍</div>',
                    iconSize: [36, 36],
                    iconAnchor: [18, 36]
                });
                tempMarker.setIcon(emojiIcon);
            }
        });
    }

    // Image handling
    const dropZone = document.getElementById('dev-drop-zone');
    const imageInput = document.getElementById('dev-image-input');
    const previewContainer = document.getElementById('dev-image-preview');
    let uploadedImages = [];

    const handleFiles = (files) => {
        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const src = e.target.result;
                uploadedImages.push(src);
                renderPreviews();
            };
            reader.readAsDataURL(file);
        });
    };

    const renderPreviews = () => {
        previewContainer.innerHTML = '';
        uploadedImages.forEach((src, index) => {
            const div = document.createElement('div');
            div.style.position = 'relative';
            div.style.flexShrink = '0';

            const img = document.createElement('img');
            img.src = src;
            img.style.width = '80px';
            img.style.height = '80px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            img.style.border = '1px solid #555';

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '×';
            removeBtn.style.position = 'absolute';
            removeBtn.style.top = '-5px';
            removeBtn.style.right = '-5px';
            removeBtn.style.background = 'red';
            removeBtn.style.color = 'white';
            removeBtn.style.border = 'none';
            removeBtn.style.borderRadius = '50%';
            removeBtn.style.width = '20px';
            removeBtn.style.height = '20px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.fontSize = '12px';
            removeBtn.style.display = 'flex';
            removeBtn.style.alignItems = 'center';
            removeBtn.style.justifyContent = 'center';

            removeBtn.onclick = (e) => {
                e.stopPropagation();
                uploadedImages.splice(index, 1);
                renderPreviews();
            };

            div.appendChild(img);
            div.appendChild(removeBtn);
            previewContainer.appendChild(div);
        });
    };

    if (dropZone) {
        dropZone.onclick = () => imageInput.click();

        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#daac71';
            dropZone.style.background = 'rgba(218, 172, 113, 0.1)';
        };

        dropZone.ondragleave = (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#555';
            dropZone.style.background = 'transparent';
        };

        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#555';
            dropZone.style.background = 'transparent';
            handleFiles(e.dataTransfer.files);
        };
    }

    if (imageInput) {
        imageInput.onchange = (e) => {
            handleFiles(e.target.files);
            imageInput.value = ''; // Reset to allow selecting same file again
        };
    }

    // Paste handler
    document.addEventListener('paste', (e) => {
        if (document.getElementById('dev-modal').classList.contains('hidden')) return;
        handleFiles(e.clipboardData.files);
    });

    const genBtn = document.getElementById('btn-gen-json');
    if (genBtn) {
        genBtn.onclick = () => {
            const catId = document.getElementById('dev-category').value;
            if (!catId) { alert("카테고리를 선택해주세요!"); return; }

            const name = document.getElementById('dev-name').value || "New Item";
            const desc = document.getElementById('dev-desc').value || "";
            const x = document.getElementById('dev-x').value;
            const y = document.getElementById('dev-y').value;
            const tempId = Date.now();

            const newItem = {
                id: tempId,
                category_id: catId,
                title: name,
                description: desc,
                latitude: x,
                longitude: y,
                regionId: 0,
                images: uploadedImages.length > 0 ? uploadedImages : undefined
            };

            const jsonString = JSON.stringify(newItem, null, 4);
            const outputArea = document.getElementById('dev-output');
            outputArea.value = jsonString + ",";
            outputArea.select();
            document.execCommand('copy');
            alert("JSON이 복사되었습니다!");
        };
    }
};
