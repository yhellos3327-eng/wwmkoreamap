// @ts-check
/// <reference path="../types.d.ts" />
import { state, setState } from "../state.js";
import { storage } from "../storage.js";

export const AI_MODELS = {
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
    { value: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
    { value: "gemini-2.5-pro", label: "Gemini 2 Pro" },
  ],
  openai: [
    { value: "gpt-5", label: "GPT-5" },
    { value: "gpt-5-mini", label: "GPT-5 mini" },
    { value: "gpt-5-nano", label: "GPT-5 nano" },
    { value: "gpt-5.2-pro", label: "GPT-5.2 pro" },
    { value: "gpt-5.2", label: "GPT 5.2" },
  ],
  claude: [
    { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    { value: "claude-opus-4-5-20251101", label: "Claude Opus 4.5" },
  ],
  deepl: [
    { value: "default", label: "DeepL 번역" },
  ],
};

export const updateModelOptions = (provider) => {
  const apiModelSelect = document.getElementById("api-model-select");
  if (!apiModelSelect) return;

  apiModelSelect.innerHTML = "";
  const models = AI_MODELS[provider] || [];
  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.value;
    option.textContent = model.label;
    apiModelSelect.appendChild(option);
  });
};

export const updateApiKeyInput = (provider) => {
  const apiKeyInput = /** @type {HTMLInputElement} */ (
    document.getElementById("api-key-input")
  );
  if (!apiKeyInput) return;

  let key = "";
  let placeholder = "";
  if (provider === "gemini") {
    key = state.savedGeminiKey || state.savedApiKey;
    placeholder = "Google Gemini API Key 입력";
  } else if (provider === "openai") {
    key = state.savedOpenAIKey;
    placeholder = "OpenAI API Key 입력 (sk-...)";
  } else if (provider === "claude") {
    key = state.savedClaudeKey;
    placeholder = "Anthropic API Key 입력 (sk-ant-...)";
  } else if (provider === "deepl") {
    key = state.savedDeepLKey;
    placeholder = "DeepL API Key 입력";
  }
  apiKeyInput.value = key || "";
  apiKeyInput.placeholder = placeholder;
};

export const saveAISettings = () => {
  const apiProviderSelect = /** @type {HTMLSelectElement} */ (
    document.getElementById("api-provider-select")
  );
  const apiKeyInput = /** @type {HTMLInputElement} */ (
    document.getElementById("api-key-input")
  );
  const apiModelSelect = /** @type {HTMLSelectElement} */ (
    document.getElementById("api-model-select")
  );

  if (apiProviderSelect) {
    const provider = apiProviderSelect.value;
    setState("savedAIProvider", provider);
    localStorage.setItem("wwm_ai_provider", provider);

    if (apiKeyInput) {
      const newKey = apiKeyInput.value.trim();
      if (provider === "gemini") {
        setState("savedGeminiKey", newKey);
        setState("savedApiKey", newKey);
        storage.setApiKey("wwm_api_key", newKey);
      } else if (provider === "openai") {
        setState("savedOpenAIKey", newKey);
        storage.setApiKey("wwm_openai_key", newKey);
      } else if (provider === "claude") {
        setState("savedClaudeKey", newKey);
        storage.setApiKey("wwm_claude_key", newKey);
      } else if (provider === "deepl") {
        setState("savedDeepLKey", newKey);
        storage.setApiKey("wwm_deepl_key", newKey);
      }
    }
  } else if (apiKeyInput) {
    const newKey = apiKeyInput.value.trim();
    setState("savedApiKey", newKey);
    storage.setApiKey("wwm_api_key", newKey);
  }

  if (apiModelSelect) {
    const newModel = apiModelSelect.value;
    setState("savedApiModel", newModel);
    localStorage.setItem("wwm_api_model", newModel);
  }
};

export const initAISettings = () => {
  const apiProviderSelect = /** @type {HTMLSelectElement} */ (
    document.getElementById("api-provider-select")
  );
  const apiModelSelect = /** @type {HTMLSelectElement} */ (
    document.getElementById("api-model-select")
  );
  const apiKeyInput = /** @type {HTMLInputElement} */ (
    document.getElementById("api-key-input")
  );

  if (apiProviderSelect) {
    apiProviderSelect.addEventListener("change", (e) => {
      const provider = /** @type {HTMLSelectElement} */ (e.target).value;
      updateModelOptions(provider);
      updateApiKeyInput(provider);
    });
  }

  return {
    loadValues: () => {
      if (apiProviderSelect) {
        apiProviderSelect.value = state.savedAIProvider;
        updateModelOptions(state.savedAIProvider);
        updateApiKeyInput(state.savedAIProvider);
      }
      if (apiModelSelect) apiModelSelect.value = state.savedApiModel;
      if (apiKeyInput && !apiProviderSelect)
        apiKeyInput.value = state.savedApiKey;
    },
  };
};
