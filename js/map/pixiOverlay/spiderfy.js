import { ICON_SIZE } from "./config.js";
import { createSpriteForItem, addSpriteToDataMap } from "./spriteFactory.js";


let spiderfiedClusterId = null;
let spiderfyContainer = null; 
let animationFrameId = null;
let spiderElements = [];
let currentCenterLatLng = null;

export const getSpiderfiedClusterId = () => spiderfiedClusterId;
export const getSpiderfyContainer = () => spiderfyContainer;

export const clearSpiderfy = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (spiderfyContainer) {
    if (spiderfyContainer.parent) {
      spiderfyContainer.parent.removeChild(spiderfyContainer);
    }
    spiderfyContainer.destroy({ children: true });
    spiderfyContainer = null;
  }
  spiderfiedClusterId = null;
  spiderElements = [];
  currentCenterLatLng = null;
};

export const updateSpiderfyPositions = (utils) => {
  if (!spiderfyContainer || !currentCenterLatLng || animationFrameId) return;

  const project = utils.latLngToLayerPoint;
  const scale = utils.getScale();
  const centerPoint = project(currentCenterLatLng);

  
  const count = spiderElements.length;
  const pixelLegLength = 40 + Math.min(count * 2, 100);
  const legLength = pixelLegLength / scale;

  
  const legsGraphics = spiderfyContainer.children.find(
    (c) => c instanceof PIXI.Graphics,
  );
  if (legsGraphics) {
    legsGraphics.clear();
    legsGraphics.lineStyle(2 / scale, 0x888888, 0.8);

    spiderElements.forEach((elem) => {
      const x = centerPoint.x + legLength * Math.cos(elem.angle);
      const y = centerPoint.y + legLength * Math.sin(elem.angle);

      elem.sprite.x = x;
      elem.sprite.y = y;

      
      if (utils.layerPointToLatLng) {
        const latLng = utils.layerPointToLatLng({ x, y });
        elem.sprite.markerData.lat = latLng.lat;
        elem.sprite.markerData.lng = latLng.lng;
      }

      
      const targetSize = ICON_SIZE / scale;
      elem.sprite.width = targetSize;
      elem.sprite.height = targetSize;

      legsGraphics.moveTo(centerPoint.x, centerPoint.y);
      legsGraphics.lineTo(x, y);
    });
  }
};

export const spiderfyCluster = (
  clusterId,
  centerLatLng,
  markers,
  pixiContainer,
  utils,
) => {
  clearSpiderfy(); 

  spiderfiedClusterId = clusterId;
  currentCenterLatLng = centerLatLng;

  spiderfyContainer = new PIXI.Container();
  spiderfyContainer.sortableChildren = true;
  
  spiderfyContainer.zIndex = 9999;

  pixiContainer.addChild(spiderfyContainer);

  const project = utils.latLngToLayerPoint;
  const scale = utils.getScale();
  const centerPoint = project(centerLatLng);
  const count = markers.length;

  
  const circleStartAngle = 0;
  
  const pixelLegLength = 40 + Math.min(count * 2, 100);

  
  const legLength = pixelLegLength / scale;
  const angleStep = (Math.PI * 2) / count;

  
  const legsGraphics = new PIXI.Graphics();
  spiderfyContainer.addChild(legsGraphics);

  
  spiderElements = [];

  markers.forEach((marker, index) => {
    const angle = circleStartAngle + index * angleStep;

    
    const item = marker.properties.item;
    const sprite = createSpriteForItem(item);

    if (sprite) {
      const targetSize = ICON_SIZE / scale;
      sprite.width = targetSize;
      sprite.height = targetSize;

      
      sprite.markerData = {
        ...sprite.markerData,
        isSpiderfied: true,
        originalLat: marker.geometry.coordinates[1],
        originalLng: marker.geometry.coordinates[0],
      };

      
      sprite.filters = [];

      
      sprite.x = centerPoint.x;
      sprite.y = centerPoint.y;

      spiderfyContainer.addChild(sprite);

      spiderElements.push({
        sprite,
        angle,
        
      });
    }
  });

  
  let start = null;
  const duration = 250; 

  const animate = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    
    const ease = 1 - Math.pow(1 - progress, 3);

    
    const currentProject = utils.latLngToLayerPoint;
    const currentScale = utils.getScale();
    const currentCenter = currentProject(currentCenterLatLng);
    const currentLegLength = (pixelLegLength / currentScale) * ease;

    legsGraphics.clear();
    legsGraphics.lineStyle(2 / currentScale, 0x888888, 0.8);

    spiderElements.forEach((elem) => {
      const x = currentCenter.x + currentLegLength * Math.cos(elem.angle);
      const y = currentCenter.y + currentLegLength * Math.sin(elem.angle);

      elem.sprite.x = x;
      elem.sprite.y = y;

      
      if (utils.layerPointToLatLng) {
        const latLng = utils.layerPointToLatLng({ x, y });
        elem.sprite.markerData.lat = latLng.lat;
        elem.sprite.markerData.lng = latLng.lng;
      }

      
      const targetSize = ICON_SIZE / currentScale;
      elem.sprite.width = targetSize;
      elem.sprite.height = targetSize;

      legsGraphics.moveTo(currentCenter.x, currentCenter.y);
      legsGraphics.lineTo(x, y);
    });

    utils.getRenderer().render(pixiContainer);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      animationFrameId = null;
    }
  };

  animationFrameId = requestAnimationFrame(animate);
};
