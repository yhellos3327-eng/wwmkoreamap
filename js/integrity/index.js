import {
    runIntegrityCheck,
    quickValidate,
    clearDataCache,
    SEVERITY
} from './runner.js';

import {
    showModal,
    hideModal,
    resetModal,
    updateStep,
    updateStatus,
    showResult,
    consoleLog,
    showResultAlert,
    initIntegrityUI,
    CHECK_STATUS,
    ICONS
} from './ui.js';

import {
    validateBackupData,
    validateStructure,
    validateVersion,
    validateCompletedMarkers,
    validateFavorites,
    validateSettings,
    createResult,
    addIssue,
    addCleaned,
    STATUS
} from './validator.js';

export { runIntegrityCheck, quickValidate };

export {
    showResultAlert,
    showModal,
    hideModal
};

export { SEVERITY, CHECK_STATUS };

export { clearDataCache };

export const initIntegrityModal = initIntegrityUI;
export const closeIntegrityModal = hideModal;
export const initResultAlertModal = () => { };

export const validator = {
    validateBackupData,
    validateStructure,
    validateVersion,
    validateCompletedMarkers,
    validateFavorites,
    validateSettings,
    createResult,
    addIssue,
    addCleaned
};

export const ui = {
    showModal,
    hideModal,
    resetModal,
    updateStep,
    updateStatus,
    showResult,
    consoleLog,
    showResultAlert,
    initIntegrityUI
};

export const CURRENT_DATA_VERSION = 1;
