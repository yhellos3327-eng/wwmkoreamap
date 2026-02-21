// @ts-check
/**
 * Chrome 내장 번역 API (Translator API & Language Detector API).
 * 내장 AI 번역 지원을 위해 Chrome 138+가 필요합니다.
 *
 * GenAILocalFoundationalModelSettings 정책에 의해 관리됩니다.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Translator
 * @see https://developer.mozilla.org/en-US/docs/Web/API/LanguageDetector
 * @module chromeTranslator
 */

let translatorInstance = null;
let languageDetectorInstance = null;

/**
 * Chrome 내장 Translator API 지원 여부 확인
 * @returns {boolean}
 */
export const isChromeTranslatorSupported = () => {
  return (
    typeof Translator !== "undefined" && typeof Translator.create === "function"
  );
};

/**
 * Chrome 내장 Language Detector API 지원 여부 확인
 * @returns {boolean}
 */
export const isLanguageDetectorSupported = () => {
  return (
    typeof LanguageDetector !== "undefined" &&
    typeof LanguageDetector.create === "function"
  );
};

/**
 * 전체 Chrome 내장 번역 기능 지원 여부
 * @returns {boolean}
 */
export const isChromeBuiltinTranslationSupported = () => {
  return isChromeTranslatorSupported() && isLanguageDetectorSupported();
};

/**
 * Translator 가용성 확인
 * @param {string} sourceLanguage - 소스 언어 코드 (예: 'zh', 'en')
 * @param {string} targetLanguage - 대상 언어 코드 (예: 'ko')
 * @returns {Promise<string>} - 'available', 'downloadable', 'unavailable' 중 하나
 */
export const checkTranslatorAvailability = async (
  sourceLanguage = "zh",
  targetLanguage = "ko",
) => {
  if (!isChromeTranslatorSupported()) {
    return "unsupported";
  }

  try {
    const availability = await Translator.availability({
      sourceLanguage,
      targetLanguage,
    });
    return availability;
  } catch (error) {
    console.error("Translator availability check failed:", error);
    return "error";
  }
};

/**
 * Language Detector 가용성 확인
 * @returns {Promise<string>}
 */
export const checkLanguageDetectorAvailability = async () => {
  if (!isLanguageDetectorSupported()) {
    return "unsupported";
  }

  try {
    const availability = await LanguageDetector.availability();
    return availability;
  } catch (error) {
    console.error("LanguageDetector availability check failed:", error);
    return "error";
  }
};

/**
 * Translator 인스턴스 생성 (캐시됨)
 * @param {string} sourceLanguage
 * @param {string} targetLanguage
 * @param {Function} onProgress - 다운로드 진행률 콜백 (선택)
 * @returns {Promise<Translator>}
 */
export const getTranslator = async (
  sourceLanguage = "zh",
  targetLanguage = "ko",
  onProgress = null,
) => {
  if (
    translatorInstance &&
    translatorInstance.sourceLanguage === sourceLanguage &&
    translatorInstance.targetLanguage === targetLanguage
  ) {
    return translatorInstance;
  }

  if (translatorInstance) {
    try {
      translatorInstance.destroy();
    } catch (e) {
      console.warn("Failed to destroy previous translator:", e);
    }
  }

  if (!isChromeTranslatorSupported()) {
    throw new Error(
      "Chrome 내장 Translator API가 지원되지 않습니다. Chrome 138 이상이 필요합니다.",
    );
  }

  const options = {
    sourceLanguage,
    targetLanguage,
  };

  if (onProgress && typeof onProgress === "function") {
    options.monitor = (monitor) => {
      monitor.addEventListener("downloadprogress", (e) => {
        onProgress(e.loaded, e.total);
      });
    };
  }

  translatorInstance = await Translator.create(options);
  return translatorInstance;
};

/**
 * Language Detector 인스턴스 생성 (캐시됨)
 * @param {Function} onProgress - 다운로드 진행률 콜백 (선택)
 * @returns {Promise<LanguageDetector>}
 */
export const getLanguageDetector = async (onProgress = null) => {
  if (languageDetectorInstance) {
    return languageDetectorInstance;
  }

  if (!isLanguageDetectorSupported()) {
    throw new Error("Chrome 내장 Language Detector API가 지원되지 않습니다.");
  }

  const options = {
    expectedInputLanguages: ["zh", "zh-Hans", "zh-Hant", "en", "ko", "ja"],
  };

  if (onProgress && typeof onProgress === "function") {
    options.monitor = (monitor) => {
      monitor.addEventListener("downloadprogress", (e) => {
        onProgress(e.loaded, e.total);
      });
    };
  }

  languageDetectorInstance = await LanguageDetector.create(options);
  return languageDetectorInstance;
};

/**
 * 텍스트 언어 감지
 * @param {string} text - 감지할 텍스트
 * @returns {Promise<{language: string, confidence: number}[]>}
 */
export const detectLanguage = async (text) => {
  if (!text || text.trim().length < 3) {
    return [{ detectedLanguage: "unknown", confidence: 0 }];
  }

  try {
    const detector = await getLanguageDetector();
    const results = await detector.detect(text);
    return results;
  } catch (error) {
    console.error("Language detection failed:", error);
    return [{ detectedLanguage: "unknown", confidence: 0 }];
  }
};

/**
 * 텍스트에 한국어가 포함되어 있는지 확인
 * @param {string} text
 * @returns {boolean}
 */
const containsKorean = (text) => {
  if (!text) return false;
  const koreanRegex = /[\uAC00-\uD7AF\u1100-\u11FF]/;
  return koreanRegex.test(text);
};

/**
 * 텍스트의 한글 비율 계산
 * @param {string} text
 * @returns {number} 0-1 사이 비율
 */
const getKoreanRatio = (text) => {
  if (!text) return 0;
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const totalChars = text.replace(/\s/g, "").length;
  return totalChars > 0 ? koreanChars / totalChars : 0;
};

/**
 * 텍스트 번역
 * @param {string} text - 번역할 텍스트
 * @param {string} sourceLanguage - 소스 언어 코드 (null이면 자동 감지)
 * @param {string} targetLanguage - 대상 언어 코드
 * @param {Function} onProgress - 다운로드 진행률 콜백
 * @returns {Promise<string>}
 */
export const translateText = async (
  text,
  sourceLanguage = null,
  targetLanguage = "ko",
  onProgress = null,
) => {
  if (!text || text.trim().length === 0) {
    return text;
  }

  let detectedSource = sourceLanguage;
  if (!detectedSource) {
    try {
      const detection = await detectLanguage(text);
      if (detection.length > 0 && detection[0].confidence > 0.5) {
        detectedSource = detection[0].detectedLanguage;
      } else {
        detectedSource = "zh";
      }
    } catch (e) {
      console.warn("Language detection failed, using default:", e);
      detectedSource = "zh";
    }
  }

  if (
    detectedSource === targetLanguage ||
    detectedSource === "ko" ||
    detectedSource.startsWith("ko-")
  ) {
    return text;
  }

  try {
    const translator = await getTranslator(
      detectedSource,
      targetLanguage,
      onProgress,
    );
    let translation = await translator.translate(text);
    if (targetLanguage === "ko" && translation && translation.length > 3) {
      const koreanRatio = getKoreanRatio(translation);
      if (koreanRatio < 0.1 && !containsKorean(translation)) {
        console.warn(
          "Translation result appears to be English, re-translating to Korean...",
        );
        console.warn("Original translation:", translation);
        try {
          const enToKoTranslator = await getTranslator("en", "ko", onProgress);
          const reTranslation = await enToKoTranslator.translate(translation);
          if (containsKorean(reTranslation)) {
            console.log("Re-translation successful:", reTranslation);
            translation = reTranslation;
          }
        } catch (reTranslateError) {
          console.warn(
            "Re-translation failed, using original result:",
            reTranslateError,
          );
        }
      }
    }

    return translation;
  } catch (error) {
    console.error("Translation failed:", error);
    throw error;
  }
};

/**
 * 스트리밍 번역 (긴 텍스트용)
 * @param {string} text
 * @param {string} sourceLanguage
 * @param {string} targetLanguage
 * @param {Function} onChunk - 청크별 콜백
 * @returns {Promise<string>}
 */
export const translateTextStreaming = async (
  text,
  sourceLanguage = "zh",
  targetLanguage = "ko",
  onChunk = null,
) => {
  if (!text || text.trim().length === 0) {
    return text;
  }

  const translator = await getTranslator(sourceLanguage, targetLanguage);
  const stream = translator.translateStreaming(text);

  let result = "";
  for await (const chunk of stream) {
    result += chunk;
    if (onChunk && typeof onChunk === "function") {
      onChunk(chunk, result);
    }
  }

  return result;
};

/**
 * 게임 아이템 번역 (name + description)
 * @param {Object} item - 마커 아이템 객체
 * @param {Function} onProgress - 진행률 콜백
 * @returns {Promise<{name: string, description: string}>}
 */
export const translateGameItem = async (item, onProgress = null) => {
  if (!item) {
    throw new Error("번역할 아이템이 없습니다.");
  }

  const results = {
    name: item.name,
    description: item.description,
  };

  if (item.name && item.name.trim()) {
    try {
      const translatedName = await translateText(
        item.name,
        null,
        "ko",
        onProgress,
      );
      results.name = translatedName;
    } catch (e) {
      console.warn("Name translation failed:", e);
    }
  }

  if (item.description && item.description.trim()) {
    try {
      const translatedDesc = await translateText(
        item.description,
        null,
        "ko",
        onProgress,
      );
      results.description = translatedDesc;
    } catch (e) {
      console.warn("Description translation failed:", e);
    }
  }

  return results;
};

/**
 * 리소스 정리
 */
export const cleanup = () => {
  if (translatorInstance) {
    try {
      translatorInstance.destroy();
    } catch (e) {
      console.warn("Translator cleanup error:", e);
    }
    translatorInstance = null;
  }

  if (languageDetectorInstance) {
    try {
      languageDetectorInstance.destroy();
    } catch (e) {
      console.warn("LanguageDetector cleanup error:", e);
    }
    languageDetectorInstance = null;
  }
};

/**
 * 전체 상태 확인 및 초기화
 * @returns {Promise<{supported: boolean, translatorStatus: string, detectorStatus: string}>}
 */
export const checkStatus = async () => {
  const status = {
    supported: isChromeBuiltinTranslationSupported(),
    translatorStatus: "unknown",
    detectorStatus: "unknown",
  };

  if (!status.supported) {
    status.translatorStatus = "unsupported";
    status.detectorStatus = "unsupported";
    return status;
  }

  status.translatorStatus = await checkTranslatorAvailability("zh", "ko");
  status.detectorStatus = await checkLanguageDetectorAvailability();

  return status;
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", cleanup);
}
