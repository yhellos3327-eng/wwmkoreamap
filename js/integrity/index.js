// @ts-check
/**
 * Integrity module - exports all integrity check functionality.
 */
import {
  runIntegrityCheck,
  quickValidate,
  clearDataCache,
  SEVERITY,
} from "./runner.js";

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
  ICONS,
} from "./ui.js";

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
  STATUS,
} from "./validator.js";

export { runIntegrityCheck, quickValidate };

export { showResultAlert, showModal, hideModal };

export { SEVERITY, CHECK_STATUS };

export { clearDataCache };

/**
 * Initializes the integrity modal.
 */
export const initIntegrityModal = initIntegrityUI;

/**
 * Closes the integrity modal.
 */
export const closeIntegrityModal = hideModal;

/**
 * Placeholder for result alert modal initialization.
 */
export const initResultAlertModal = () => {};

/** @type {number} */
export const CURRENT_DATA_VERSION = 1;

/**
 * Validator functions collection.
 */
export const validator = {
  validateBackupData,
  validateStructure,
  validateVersion,
  validateCompletedMarkers,
  validateFavorites,
  validateSettings,
  createResult,
  addIssue,
  addCleaned,
};

/**
 * UI functions collection.
 */
export const ui = {
  showModal,
  hideModal,
  resetModal,
  updateStep,
  updateStatus,
  showResult,
  consoleLog,
  showResultAlert,
  initIntegrityUI,
};
