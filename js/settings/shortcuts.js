import { state } from "../state.js";

const DEFAULT_SHORTCUTS = {
  closeModal: {
    key: "Escape",
    ctrl: false,
    shift: false,
    alt: false,
    description: "모달/팝업 닫기",
  },
};

const AVAILABLE_ACTIONS = [
  { id: "toggleSidebar", name: "사이드바 열기/닫기", icon: "☰" },
  { id: "openSearch", name: "검색창 열기", icon: "🔍" },
  { id: "openSettings", name: "설정 열기", icon: "⚙️" },
  { id: "toggleRouteMode", name: "경로 모드 전환", icon: "🛣️" },
  { id: "zoomIn", name: "확대", icon: "🔎" },
  { id: "zoomOut", name: "축소", icon: "🔍" },
  { id: "resetZoom", name: "기본 줌", icon: "🎯" },
  { id: "closeModal", name: "모달/팝업 닫기", icon: "✕" },
  { id: "toggleTheme", name: "테마 전환", icon: "🌓" },
  { id: "focusMap", name: "지도에 포커스", icon: "🗺️" },
  { id: "none", name: "할당 해제", icon: "−" },
];

const KEYBOARD_LAYOUT = [
  [
    { key: "Escape", label: "ESC", width: 1.5 },
    { key: "1", label: "1", width: 1 },
    { key: "2", label: "2", width: 1 },
    { key: "3", label: "3", width: 1 },
    { key: "4", label: "4", width: 1 },
    { key: "5", label: "5", width: 1 },
    { key: "6", label: "6", width: 1 },
    { key: "7", label: "7", width: 1 },
    { key: "8", label: "8", width: 1 },
    { key: "9", label: "9", width: 1 },
    { key: "0", label: "0", width: 1 },
    { key: "-", label: "-", width: 1 },
    { key: "=", label: "+", width: 1 },
    { key: "Backspace", label: "⌫", width: 1.5 },
  ],
  [
    { key: "Tab", label: "TAB", width: 1.5 },
    { key: "Q", label: "Q", width: 1 },
    { key: "W", label: "W", width: 1 },
    { key: "E", label: "E", width: 1 },
    { key: "R", label: "R", width: 1 },
    { key: "T", label: "T", width: 1 },
    { key: "Y", label: "Y", width: 1 },
    { key: "U", label: "U", width: 1 },
    { key: "I", label: "I", width: 1 },
    { key: "O", label: "O", width: 1 },
    { key: "P", label: "P", width: 1 },
    { key: "[", label: "[", width: 1 },
    { key: "]", label: "]", width: 1 },
    { key: "\\", label: "\\", width: 1.5 },
  ],
  [
    { key: "CapsLock", label: "CAPS", width: 1.75, disabled: true },
    { key: "A", label: "A", width: 1 },
    { key: "S", label: "S", width: 1 },
    { key: "D", label: "D", width: 1 },
    { key: "F", label: "F", width: 1 },
    { key: "G", label: "G", width: 1 },
    { key: "H", label: "H", width: 1 },
    { key: "J", label: "J", width: 1 },
    { key: "K", label: "K", width: 1 },
    { key: "L", label: "L", width: 1 },
    { key: ";", label: ";", width: 1 },
    { key: "'", label: "'", width: 1 },
    { key: "Enter", label: "ENTER", width: 2.25 },
  ],
  [
    { key: "Shift", label: "SHIFT", width: 2.25, modifier: true },
    { key: "Z", label: "Z", width: 1 },
    { key: "X", label: "X", width: 1 },
    { key: "C", label: "C", width: 1 },
    { key: "V", label: "V", width: 1 },
    { key: "B", label: "B", width: 1 },
    { key: "N", label: "N", width: 1 },
    { key: "M", label: "M", width: 1 },
    { key: ",", label: ",", width: 1 },
    { key: ".", label: ".", width: 1 },
    { key: "/", label: "/", width: 1 },
    { key: "ShiftRight", label: "SHIFT", width: 2.75, modifier: true },
  ],
  [
    { key: "Control", label: "CTRL", width: 1.5, modifier: true },
    { key: "Meta", label: "WIN", width: 1.25, disabled: true },
    { key: "Alt", label: "ALT", width: 1.25, modifier: true },
    { key: " ", label: "SPACE", width: 6.25 },
    { key: "AltRight", label: "ALT", width: 1.25, modifier: true },
    { key: "MetaRight", label: "WIN", width: 1.25, disabled: true },
    { key: "ContextMenu", label: "MENU", width: 1.25, disabled: true },
    { key: "ControlRight", label: "CTRL", width: 1.5, modifier: true },
  ],
];

let activeShortcuts = {};
let shortcutsEnabled = true;
let selectedModifiers = { ctrl: false, shift: false, alt: false };
let selectedKey = null;
let pendingActionId = null;
let keyboardModalVisible = false;

export const loadShortcuts = () => {
  try {
    const saved = localStorage.getItem("keyboardShortcuts");
    if (saved) {
      activeShortcuts = { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) };
    } else {
      activeShortcuts = { ...DEFAULT_SHORTCUTS };
    }

    const enabledSetting = localStorage.getItem("shortcutsEnabled");
    shortcutsEnabled = enabledSetting !== "false";
  } catch (error) {
    console.error("단축키 설정 로드 실패:", error);
    activeShortcuts = { ...DEFAULT_SHORTCUTS };
  }
};

export const saveShortcuts = () => {
  try {
    localStorage.setItem("keyboardShortcuts", JSON.stringify(activeShortcuts));
    localStorage.setItem("shortcutsEnabled", String(shortcutsEnabled));
  } catch (error) {
    console.error("단축키 설정 저장 실패:", error);
  }
};

const findActionForKey = (key, ctrl, shift, alt) => {
  for (const [actionId, shortcut] of Object.entries(activeShortcuts)) {
    if (
      shortcut.key.toLowerCase() === key.toLowerCase() &&
      shortcut.ctrl === ctrl &&
      shortcut.shift === shift &&
      shortcut.alt === alt
    ) {
      return actionId;
    }
  }
  return null;
};

const assignActionToKey = (actionId, key, ctrl, shift, alt) => {
  const existingAction = findActionForKey(key, ctrl, shift, alt);
  if (existingAction && existingAction !== actionId) {
    delete activeShortcuts[existingAction];
  }

  if (actionId !== "none") {
    const action = AVAILABLE_ACTIONS.find((a) => a.id === actionId);
    activeShortcuts[actionId] = {
      key: key,
      ctrl: ctrl,
      shift: shift,
      alt: alt,
      description: action ? action.name : actionId,
    };
  }

  saveShortcuts();
  updateKeyboardDisplay();
  renderShortcutSettings();
};

export const resetShortcuts = () => {
  activeShortcuts = { ...DEFAULT_SHORTCUTS };
  saveShortcuts();
  updateKeyboardDisplay();
  renderShortcutSettings();
};

export const formatShortcut = (shortcut) => {
  const parts = [];
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");

  let keyDisplay = shortcut.key;
  const keyMap = {
    Escape: "Esc",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    " ": "Space",
    "=": "+",
    "-": "-",
  };
  keyDisplay = keyMap[shortcut.key] || shortcut.key.toUpperCase();
  parts.push(keyDisplay);

  return parts.join(" + ");
};

const matchesShortcut = (event, shortcut) => {
  const keyMatches =
    event.key.toLowerCase() === shortcut.key.toLowerCase() ||
    event.code.replace("Key", "").toLowerCase() ===
      shortcut.key.toLowerCase() ||
    event.code.replace("Digit", "").toLowerCase() ===
      shortcut.key.toLowerCase();

  return (
    keyMatches &&
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt
  );
};

const executeShortcutAction = async (actionId) => {
  switch (actionId) {
    case "toggleSidebar":
      const { toggleSidebar } = await import("../ui.js");
      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        const isOpen = sidebar.classList.contains("open");
        toggleSidebar(isOpen ? "close" : "open");
      }
      break;

    case "openSearch":
      const sidebarForSearch = document.getElementById("sidebar");
      if (sidebarForSearch && !sidebarForSearch.classList.contains("open")) {
        const { toggleSidebar: openForSearch } = await import("../ui.js");
        openForSearch("open");
      }
      setTimeout(() => {
        const searchInput = document.getElementById("search-input");
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }, 100);
      break;

    case "openSettings":
      const settingsModal = document.getElementById("settings-modal");
      if (settingsModal) {
        settingsModal.classList.toggle("hidden");
      }
      break;

    case "toggleRouteMode":
      const routeToggleBtn = document.getElementById("route-mode-toggle");
      if (routeToggleBtn) {
        routeToggleBtn.click();
      }
      break;

    case "zoomIn":
      if (state.map) {
        state.map.zoomIn();
      }
      break;

    case "zoomOut":
      if (state.map) {
        state.map.zoomOut();
      }
      break;

    case "resetZoom":
      if (state.map) {
        state.map.setZoom(state.map.options.minZoom || 2);
      }
      break;

    case "closeModal":
      // 오류 제보 패널 닫기
      const reportPanel = document.getElementById("report-panel");
      if (reportPanel && reportPanel.classList.contains("open")) {
        reportPanel.classList.remove("open");
        const reportEmbed = document.getElementById("report-embed");
        if (reportEmbed) {
          reportEmbed.setAttribute("data", "");
        }
        break;
      }

      // 아카라이브 패널 닫기
      const arcaPanel = document.getElementById("arca-panel");
      if (arcaPanel && arcaPanel.classList.contains("open")) {
        arcaPanel.classList.remove("open");
        break;
      }

      // 라이트박스 닫기
      const lightbox = document.getElementById("lightbox-modal");
      if (lightbox && !lightbox.classList.contains("hidden")) {
        lightbox.classList.add("hidden");
        break;
      }

      // 비디오 라이트박스 닫기
      const videoLightbox = document.getElementById("video-lightbox");
      if (videoLightbox && !videoLightbox.classList.contains("hidden")) {
        videoLightbox.classList.add("hidden");
        break;
      }

      // 키보드 모달 닫기
      const keyboardModal = document.getElementById("keyboard-shortcut-modal");
      if (keyboardModal && !keyboardModal.classList.contains("hidden")) {
        keyboardModal.classList.add("hidden");
        break;
      }

      // 일반 모달 닫기
      const modals = document.querySelectorAll(".modal-overlay:not(.hidden)");
      if (modals.length > 0) {
        modals[modals.length - 1].classList.add("hidden");
      } else {
        // 맵 팝업 닫기
        if (state.map) {
          state.map.closePopup();
        }
      }
      break;

    case "toggleTheme":
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      break;

    case "focusMap":
      const mapContainer = document.getElementById("map");
      if (mapContainer) {
        mapContainer.focus();
        if (state.map) {
          state.map.invalidateSize();
        }
      }
      break;
  }
};

const handleKeyDown = (event) => {
  if (!shortcutsEnabled) return;
  if (keyboardModalVisible) return;

  const activeElement = document.activeElement;
  const isInputField =
    activeElement &&
    (activeElement.tagName === "INPUT" ||
      activeElement.tagName === "TEXTAREA" ||
      activeElement.isContentEditable);

  for (const [actionId, shortcut] of Object.entries(activeShortcuts)) {
    if (matchesShortcut(event, shortcut)) {
      if (isInputField && actionId !== "closeModal") {
        continue;
      }

      event.preventDefault();
      event.stopPropagation();
      executeShortcutAction(actionId);
      return;
    }
  }
};

const updateKeyboardDisplay = () => {
  const keyboardContainer = document.getElementById("visual-keyboard");
  if (!keyboardContainer) return;

  const keyButtons = keyboardContainer.querySelectorAll(".keyboard-key");
  keyButtons.forEach((btn) => {
    const key = btn.dataset.key;
    if (!key) return;

    const assignedAction = findActionForKey(
      key,
      selectedModifiers.ctrl,
      selectedModifiers.shift,
      selectedModifiers.alt,
    );
    const actionInfo = AVAILABLE_ACTIONS.find((a) => a.id === assignedAction);

    let indicator = btn.querySelector(".key-action-indicator");
    if (assignedAction && actionInfo) {
      if (!indicator) {
        indicator = document.createElement("span");
        indicator.className = "key-action-indicator";
        btn.appendChild(indicator);
      }
      indicator.textContent = actionInfo.icon;
      indicator.title = actionInfo.name;
      btn.classList.add("has-action");
    } else {
      if (indicator) {
        indicator.remove();
      }
      btn.classList.remove("has-action");
    }

    btn.classList.toggle("selected", selectedKey === key);
  });

  updateModifierButtons();
};

const updateModifierButtons = () => {
  const ctrlBtn = document.getElementById("mod-ctrl");
  const shiftBtn = document.getElementById("mod-shift");
  const altBtn = document.getElementById("mod-alt");

  if (ctrlBtn) ctrlBtn.classList.toggle("active", selectedModifiers.ctrl);
  if (shiftBtn) shiftBtn.classList.toggle("active", selectedModifiers.shift);
  if (altBtn) altBtn.classList.toggle("active", selectedModifiers.alt);

  document.querySelectorAll(".keyboard-key[data-modifier]").forEach((key) => {
    const mod = key.dataset.modifier;
    if (mod === "ctrl") key.classList.toggle("active", selectedModifiers.ctrl);
    if (mod === "shift")
      key.classList.toggle("active", selectedModifiers.shift);
    if (mod === "alt") key.classList.toggle("active", selectedModifiers.alt);
  });
};

const renderVisualKeyboard = () => {
  const container = document.getElementById("visual-keyboard");
  if (!container) return;

  container.innerHTML = "";

  KEYBOARD_LAYOUT.forEach((row, rowIndex) => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "keyboard-row";

    row.forEach((keyInfo) => {
      const keyBtn = document.createElement("button");
      keyBtn.className = "keyboard-key";
      keyBtn.dataset.key = keyInfo.key;
      keyBtn.style.flex = `${keyInfo.width}`;

      if (keyInfo.modifier) {
        keyBtn.classList.add("modifier-key");
        if (keyInfo.key === "Control" || keyInfo.key === "ControlRight") {
          keyBtn.dataset.modifier = "ctrl";
        } else if (keyInfo.key === "Shift" || keyInfo.key === "ShiftRight") {
          keyBtn.dataset.modifier = "shift";
        } else if (keyInfo.key === "Alt" || keyInfo.key === "AltRight") {
          keyBtn.dataset.modifier = "alt";
        }
      }

      if (keyInfo.disabled) {
        keyBtn.classList.add("disabled");
        keyBtn.disabled = true;
      }

      const labelSpan = document.createElement("span");
      labelSpan.className = "key-label";
      labelSpan.textContent = keyInfo.label;
      keyBtn.appendChild(labelSpan);

      if (!keyInfo.disabled) {
        keyBtn.addEventListener("click", () => handleKeyClick(keyInfo));
      }

      rowDiv.appendChild(keyBtn);
    });

    container.appendChild(rowDiv);
  });

  updateKeyboardDisplay();
};

const handleKeyClick = (keyInfo) => {
  if (keyInfo.modifier) {
    if (keyInfo.key === "Control" || keyInfo.key === "ControlRight") {
      selectedModifiers.ctrl = !selectedModifiers.ctrl;
    } else if (keyInfo.key === "Shift" || keyInfo.key === "ShiftRight") {
      selectedModifiers.shift = !selectedModifiers.shift;
    } else if (keyInfo.key === "Alt" || keyInfo.key === "AltRight") {
      selectedModifiers.alt = !selectedModifiers.alt;
    }
    updateKeyboardDisplay();
  } else {
    selectedKey = keyInfo.key;
    updateKeyboardDisplay();
    showActionSelector(keyInfo.key);
  }
};

const showActionSelector = (key) => {
  const existingSelector = document.getElementById("action-selector-dropdown");
  if (existingSelector) {
    existingSelector.remove();
  }

  const keyBtn = document.querySelector(`.keyboard-key[data-key="${key}"]`);
  if (!keyBtn) return;

  const currentAction = findActionForKey(
    key,
    selectedModifiers.ctrl,
    selectedModifiers.shift,
    selectedModifiers.alt,
  );

  const dropdown = document.createElement("div");
  dropdown.id = "action-selector-dropdown";
  dropdown.className = "action-selector-dropdown";

  const header = document.createElement("div");
  header.className = "action-selector-header";
  let comboText = "";
  if (selectedModifiers.ctrl) comboText += "Ctrl + ";
  if (selectedModifiers.alt) comboText += "Alt + ";
  if (selectedModifiers.shift) comboText += "Shift + ";
  comboText += key.toUpperCase();
  header.innerHTML = `<span class="combo-label">${comboText}</span>에 기능 할당`;
  dropdown.appendChild(header);

  const list = document.createElement("div");
  list.className = "action-list";

  AVAILABLE_ACTIONS.forEach((action) => {
    const item = document.createElement("button");
    item.className = "action-item";
    if (currentAction === action.id) {
      item.classList.add("selected");
    }
    item.innerHTML = `
            <span class="action-icon">${action.icon}</span>
            <span class="action-name">${action.name}</span>
        `;
    item.addEventListener("click", () => {
      assignActionToKey(
        action.id,
        key,
        selectedModifiers.ctrl,
        selectedModifiers.shift,
        selectedModifiers.alt,
      );
      dropdown.remove();
      selectedKey = null;
      updateKeyboardDisplay();
    });
    list.appendChild(item);
  });

  dropdown.appendChild(list);

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "action-cancel-btn";
  cancelBtn.textContent = "취소";
  cancelBtn.addEventListener("click", () => {
    dropdown.remove();
    selectedKey = null;
    updateKeyboardDisplay();
  });
  dropdown.appendChild(cancelBtn);

  document.getElementById("keyboard-modal-content").appendChild(dropdown);
};

export const openKeyboardModal = () => {
  const modal = document.getElementById("keyboard-shortcut-modal");
  if (modal) {
    modal.classList.remove("hidden");
    keyboardModalVisible = true;
    selectedModifiers = { ctrl: false, shift: false, alt: false };
    selectedKey = null;
    renderVisualKeyboard();
  }
};

export const closeKeyboardModal = () => {
  const modal = document.getElementById("keyboard-shortcut-modal");
  if (modal) {
    modal.classList.add("hidden");
    keyboardModalVisible = false;

    const dropdown = document.getElementById("action-selector-dropdown");
    if (dropdown) dropdown.remove();
  }
};

export const renderShortcutSettings = () => {
  const container = document.getElementById("shortcuts-list");
  if (!container) return;

  container.innerHTML = "";

  for (const [id, shortcut] of Object.entries(activeShortcuts)) {
    const item = document.createElement("div");
    item.className = "shortcut-item";
    item.dataset.shortcutId = id;

    item.innerHTML = `
            <span class="shortcut-description">${shortcut.description}</span>
            <div class="shortcut-key-container">
                <span class="shortcut-key-binding">${formatShortcut(shortcut)}</span>
            </div>
        `;

    container.appendChild(item);
  }
};

export const setShortcutsEnabled = (enabled) => {
  shortcutsEnabled = enabled;
  saveShortcuts();
};

export const initShortcuts = () => {
  loadShortcuts();

  document.addEventListener("keydown", handleKeyDown, true);

  const toggleBtn = document.getElementById("toggle-shortcuts");
  if (toggleBtn) {
    toggleBtn.checked = shortcutsEnabled;
    toggleBtn.addEventListener("change", (e) => {
      setShortcutsEnabled(e.target.checked);
    });
  }

  const resetBtn = document.getElementById("btn-reset-shortcuts");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (confirm("모든 단축키를 기본값으로 초기화하시겠습니까?")) {
        resetShortcuts();
      }
    });
  }

  const openKeyboardBtn = document.getElementById("btn-open-keyboard");
  if (openKeyboardBtn) {
    openKeyboardBtn.addEventListener("click", openKeyboardModal);
  }

  const closeKeyboardBtn = document.getElementById("close-keyboard-modal");
  if (closeKeyboardBtn) {
    closeKeyboardBtn.addEventListener("click", closeKeyboardModal);
  }

  const keyboardModal = document.getElementById("keyboard-shortcut-modal");
  if (keyboardModal) {
    keyboardModal.addEventListener("click", (e) => {
      if (e.target === keyboardModal) {
        closeKeyboardModal();
      }
    });
  }

  const modCtrl = document.getElementById("mod-ctrl");
  const modShift = document.getElementById("mod-shift");
  const modAlt = document.getElementById("mod-alt");

  if (modCtrl) {
    modCtrl.addEventListener("click", () => {
      selectedModifiers.ctrl = !selectedModifiers.ctrl;
      updateKeyboardDisplay();
    });
  }
  if (modShift) {
    modShift.addEventListener("click", () => {
      selectedModifiers.shift = !selectedModifiers.shift;
      updateKeyboardDisplay();
    });
  }
  if (modAlt) {
    modAlt.addEventListener("click", () => {
      selectedModifiers.alt = !selectedModifiers.alt;
      updateKeyboardDisplay();
    });
  }

  renderShortcutSettings();
};

export { activeShortcuts, shortcutsEnabled };
