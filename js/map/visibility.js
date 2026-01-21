// @ts-check
import { renderMapDataAndMarkers } from "./markers.js";

/**
 * Updates the map visibility by re-rendering markers.
 * @returns {Promise<void>}
 */
export const updateMapVisibility = () => {
  if (document.querySelector(".leaflet-popup")) return Promise.resolve();
  return renderMapDataAndMarkers();
};
