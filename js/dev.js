import { state, setState, subscribe } from './state.js';
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
    let editingItem = null;
    let uploadedImages = [];

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

    const updateOutput = () => {
        const elCategory = document.getElementById('dev-category');
        const catId = elCategory ? elCategory.value : '';

        const elName = document.getElementById('dev-name');
        const elDesc = document.getElementById('dev-desc');
        const elX = document.getElementById('dev-x');
        const elY = document.getElementById('dev-y');

        const name = elName ? (elName.value || "New Item") : "New Item";
        const desc = elDesc ? (elDesc.value || "") : "";
        const x = elX ? elX.value : '';
        const y = elY ? elY.value : '';

        const itemId = editingItem ? editingItem.id : Date.now();

        const newItem = {
            id: itemId,
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
        if (outputArea) {
            outputArea.value = jsonString + ",";
        }
        return jsonString;
    };

    const onMarkerClick = (e) => {
        if (!state.isDevMode) return;

        const marker = e.target;
        marker.closePopup();

        const item = state.allMarkers.find(m => m.marker === marker);
        if (!item) return;

        editingItem = item;
        if (tempMarker) {
            state.map.removeLayer(tempMarker);
            tempMarker = null;
        }

        const originalItem = state.mapData.items.find(i => i.id === item.id);

        const elName = document.getElementById('dev-name');
        const elDesc = document.getElementById('dev-desc');
        const elCategory = document.getElementById('dev-category');
        const elX = document.getElementById('dev-x');
        const elY = document.getElementById('dev-y');

        if (elName) elName.value = originalItem ? originalItem.name : item.originalName;
        if (elDesc) elDesc.value = originalItem ? (originalItem.description || "") : item.desc;
        if (elCategory) elCategory.value = originalItem ? originalItem.category : item.category;
        if (elX) elX.value = item.lat;
        if (elY) elY.value = item.lng;

        if (devModal) devModal.classList.remove('hidden');

        updateOutput();
        console.log(`%cEditing Item: ${item.originalName} (${item.id})`, "color: yellow");
    };

    const attachListeners = () => {
        if (!state.allMarkers) return;
        state.allMarkers.forEach(m => {
            if (m.marker) {
                m.marker.off('click', onMarkerClick);
                m.marker.on('click', onMarkerClick);
            }
        });
    };

    subscribe('allMarkers', () => {
        setTimeout(attachListeners, 500);
    });

    attachListeners();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editingItem) {
            editingItem = null;
            console.log("Edit mode cancelled");
            alert("편집 모드가 취소되었습니다.");
            const elName = document.getElementById('dev-name');
            if (elName) elName.value = "";
            const elDesc = document.getElementById('dev-desc');
            if (elDesc) elDesc.value = "";
            if (categorySelect) categorySelect.value = "";
        }
    });

    state.map.on('click', (e) => {
        if (!state.isDevMode) return;

        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);

        if (editingItem && editingItem.marker) {
            editingItem.marker.setLatLng([lat, lng]);
            editingItem.lat = lat;
            editingItem.lng = lng;

            const elX = document.getElementById('dev-x');
            const elY = document.getElementById('dev-y');
            if (elX) elX.value = lat;
            if (elY) elY.value = lng;

            updateOutput();
        } else {
            if (tempMarker) state.map.removeLayer(tempMarker);

            const emojiIcon = L.divIcon({
                className: '',
                html: '<div style="font-size: 36px; line-height: 1; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); cursor: pointer;">📍</div>',
                iconSize: [36, 36],
                iconAnchor: [18, 36]
            });

            tempMarker = L.marker([lat, lng], { icon: emojiIcon, zIndexOffset: 1000 }).addTo(state.map);

            const elDevX = document.getElementById('dev-x');
            const elDevY = document.getElementById('dev-y');
            const elDevOutput = document.getElementById('dev-output');

            if (elDevX) elDevX.value = lat;
            if (elDevY) elDevY.value = lng;
            if (elDevOutput) elDevOutput.value = '';

            if (categorySelect) categorySelect.value = "";

            if (devModal) devModal.classList.remove('hidden');
        }
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

    const dropZone = document.getElementById('dev-drop-zone');
    const imageInput = document.getElementById('dev-image-input');
    const previewContainer = document.getElementById('dev-image-preview');

    const renderPreviews = () => {
        if (!previewContainer) return;
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
            imageInput.value = '';
        };
    }

    document.addEventListener('paste', (e) => {
        if (document.getElementById('dev-modal').classList.contains('hidden')) return;
        handleFiles(e.clipboardData.files);
    });

    const genBtn = document.getElementById('btn-gen-json');
    if (genBtn) {
        genBtn.onclick = () => {
            const elCategory = document.getElementById('dev-category');
            const catId = elCategory ? elCategory.value : '';
            if (!catId) { alert("카테고리를 선택해주세요!"); return; }

            const jsonString = updateOutput();

            const outputArea = document.getElementById('dev-output');
            if (outputArea) {
                outputArea.select();
                document.execCommand('copy');
                alert("JSON이 복사되었습니다!");
            } else {
                console.log(jsonString);
                alert("JSON 생성됨 (콘솔 확인)");
            }
        };
    }

    const reportBtn = document.getElementById('btn-report-data');
    if (reportBtn) {
        reportBtn.onclick = () => {
            const outputArea = document.getElementById('dev-output');
            if (!outputArea) return;

            const jsonString = outputArea.value;
            if (!jsonString) {
                alert("먼저 JSON을 생성해주세요.");
                return;
            }
            localStorage.setItem('wwm_report_target', jsonString);
            window.open('notice.html#report', '_blank');
        };
    }
};
