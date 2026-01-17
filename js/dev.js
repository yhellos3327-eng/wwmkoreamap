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

    
    let isRegionMode = false;
    let currentPolygon = null;
    let polygonHandles = [];
    let regionEditorUI = null;

    
    const createRegionEditorUI = () => {
        if (document.getElementById('region-editor-ui')) return;

        const container = document.createElement('div');
        container.id = 'region-editor-ui';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            padding: 10px;
            border-radius: 8px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 5px;
            color: white;
            border: 1px solid var(--accent);
            width: 200px;
        `;

        container.innerHTML = `
            <h4 style="margin: 0 0 5px 0; color: var(--accent); text-align: center;">Region Editor</h4>
            <button id="btn-toggle-region-mode" style="padding: 5px; cursor: pointer;">Start Region Mode</button>
            <div id="region-controls" style="display: none; flex-direction: column; gap: 5px;">
                <button id="btn-new-polygon" style="padding: 5px; cursor: pointer;">New Polygon</button>
                <button id="btn-finish-polygon" style="padding: 5px; cursor: pointer;">Finish Drawing</button>
                <button id="btn-clear-polygon" style="padding: 5px; cursor: pointer; background: #d32f2f; color: white; border: none;">Clear</button>
                <button id="btn-export-region" style="padding: 5px; cursor: pointer; background: #388e3c; color: white; border: none;">Export JSON</button>
                <div style="font-size: 12px; color: #aaa; margin-top: 5px;">
                    Left Click: Add Point<br>
                    Drag Handle: Move Point<br>
                    Right Click Handle: Delete Point
                </div>
            </div>
        `;

        document.body.appendChild(container);
        regionEditorUI = container;

        document.getElementById('btn-toggle-region-mode').onclick = toggleRegionMode;
        document.getElementById('btn-new-polygon').onclick = startNewPolygon;
        document.getElementById('btn-finish-polygon').onclick = finishPolygon;
        document.getElementById('btn-clear-polygon').onclick = clearPolygon;
        document.getElementById('btn-export-region').onclick = exportRegionJSON;
    };

    const toggleRegionMode = () => {
        isRegionMode = !isRegionMode;
        const btn = document.getElementById('btn-toggle-region-mode');
        const controls = document.getElementById('region-controls');

        if (isRegionMode) {
            btn.textContent = "Exit Region Mode";
            btn.style.background = "var(--accent)";
            btn.style.color = "black";
            controls.style.display = 'flex';
            
        } else {
            btn.textContent = "Start Region Mode";
            btn.style.background = "";
            btn.style.color = "";
            controls.style.display = 'none';
            clearPolygon();
        }
    };

    const startNewPolygon = () => {
        clearPolygon();
        currentPolygon = L.polygon([], { color: 'red', weight: 2 }).addTo(state.map);
    };

    const finishPolygon = () => {
        if (currentPolygon) {
            currentPolygon.setStyle({ color: 'blue' });
        }
    };

    const clearPolygon = () => {
        if (currentPolygon) {
            state.map.removeLayer(currentPolygon);
            currentPolygon = null;
        }
        polygonHandles.forEach(h => state.map.removeLayer(h));
        polygonHandles = [];
    };

    const updatePolygonShape = () => {
        if (!currentPolygon) return;
        const latlngs = polygonHandles.map(h => h.getLatLng());
        currentPolygon.setLatLngs(latlngs);
    };

    const addPolygonPoint = (latlng) => {
        if (!currentPolygon) startNewPolygon();

        const handle = L.marker(latlng, {
            draggable: true,
            icon: L.divIcon({
                className: 'region-handle',
                html: '<div style="width: 10px; height: 10px; background: white; border: 2px solid red; border-radius: 50%;"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            })
        }).addTo(state.map);

        handle.on('drag', updatePolygonShape);
        handle.on('contextmenu', () => {
            state.map.removeLayer(handle);
            polygonHandles = polygonHandles.filter(h => h !== handle);
            updatePolygonShape();
        });

        polygonHandles.push(handle);
        updatePolygonShape();
    };

    const exportRegionJSON = () => {
        if (!currentPolygon) {
            alert("No polygon to export!");
            return;
        }

        const latlngs = currentPolygon.getLatLngs()[0]; 
        
        const coordinates = latlngs.map(ll => [
            String(ll.lng),
            String(ll.lat)
        ]);

        
        if (coordinates.length > 0) {
            coordinates.push(coordinates[0]);
        }

        const center = currentPolygon.getBounds().getCenter();

        const json = {
            mapId: 3003, 
            title: "New Region",
            zoom: 12,
            latitude: String(center.lat),
            longitude: String(center.lng),
            coordinates: coordinates,
            id: Date.now(), 
            map_id: 3003
        };

        console.log(JSON.stringify(json, null, 4));
        
        
        navigator.clipboard.writeText(JSON.stringify(json, null, 4)).then(() => {
            alert("Region JSON copied to clipboard! (Check console for full output)");
        });
    };

    
    createRegionEditorUI();

    

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
        if (isRegionMode) return; 

        const marker = e.target;
        marker.closePopup();

        const item = Array.from(state.allMarkers.values()).find(m => m.marker === marker);
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
        if (!state.allMarkers || state.allMarkers.size === 0) return;
        state.allMarkers.forEach((m) => {
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
        if (e.key === 'Escape') {
            if (editingItem) {
                editingItem = null;
                console.log("Edit mode cancelled");
                alert("편집 모드가 취소되었습니다.");
                const elName = document.getElementById('dev-name');
                if (elName) elName.value = "";
                const elDesc = document.getElementById('dev-desc');
                if (elDesc) elDesc.value = "";
                if (categorySelect) categorySelect.value = "";
            }
        }
    });

    state.map.on('click', (e) => {
        if (!state.isDevMode) return;

        if (isRegionMode) {
            addPolygonPoint(e.latlng);
            return;
        }

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
