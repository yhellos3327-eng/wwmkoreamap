/**
 * URL 기반 모듈 임포트를 위한 타입 선언
 * TypeScript/JS-Check가 URL 임포트를 인식할 수 있게 합니다.
 */

declare module "https://esm.run/fuse.js@7.1.0" {
  const Fuse: any;
  export default Fuse;
}

declare module "https://esm.run/lodash-es@4.17.22" {
  export const debounce: any;
}

declare module "https://esm.run/zustand@4.5.0/vanilla" {
  export const createStore: any;
}

declare module "https://esm.run/papaparse@5.4.1" {
  const Papa: any;
  export default Papa;
}

declare module "https://esm.run/es-hangul@2.3.0" {
  export const josa: (word: string, type: string) => string;
}

declare module "https://esm.run/point-in-polygon@1.1.0" {
  const pointInPolygon: (point: number[], vs: number[][]) => boolean;
  export default pointInPolygon;
}

declare module "https://esm.run/axios@1.12.0" {
  const axios: any;
  export default axios;
}

declare module "https://esm.run/@mlc-ai/web-llm@0.2.78" {
  export const WebWorkerMLCEngineHandler: any;
  export const CreateWebWorkerMLCEngine: any;
  export const CreateMLCEngine: any;
  export const prebuiltAppConfig: any;
  export const hasModelInCache: any;
}

declare module "https://esm.run/marked@12.0.0" {
  export const marked: any;
}

declare namespace L {
  export type Layer = any;
  export type Polygon = any;
  export type Map = any;
  export type Control = any;
  export type LatLng = any;
  export type LatLngBounds = any;
  export type DomEvent = any;
  export type Marker = any;
  export type Icon = any;
  export type DivIcon = any;
  export type LayerGroup = any;
  export type FeatureGroup = any;
  export type GeoJSON = any;
  export type Popup = any;
  export type Tooltip = any;
  export type TileLayer = any;
  export type ImageOverlay = any;
  export type VideoOverlay = any;
  export type SVG = any;
  export type Canvas = any;
  export const pixiOverlay: any;
}

declare const L: any;
declare const PIXI: any;
declare const Supercluster: any;

declare module "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js" {
  export const collection: any;
  export const query: any;
  export const where: any;
  export const orderBy: any;
  export const limit: any;
  export const getDocs: any;
  export const getDoc: any;
  export const addDoc: any;
  export const deleteDoc: any;
  export const doc: any;
  export const serverTimestamp: any;
  export const Timestamp: any;
}

declare module "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js" {
  export const onAuthStateChanged: any;
  export const signInWithEmailAndPassword: any;
  export const signOut: any;
}

// WebGPU API Types
interface GPUAdapter {
  readonly features: Set<string>;
  readonly info: { isFallbackAdapter?: boolean };
  requestDevice(descriptor?: {
    requiredFeatures?: string[];
  }): Promise<GPUDevice>;
}

interface GPUDevice {
  destroy(): void;
}

interface GPU {
  requestAdapter(options?: {
    powerPreference?: string;
  }): Promise<GPUAdapter | null>;
}

interface Navigator {
  gpu?: GPU;
}

// Chrome Built-in AI APIs (experimental)
declare const Translator: any;
declare const LanguageDetector: any;

// Window extensions for debugging
interface Window {
  state: any;
  setState: any;
  dispatch: any;
  subscribe: any;
  findItem: any;
  finditem: any;
  jumpToId: any;
  memoryManager: any;
  dev: any;
  PIXI: any;
}
