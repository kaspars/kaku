// Main API
export { Kaku } from './core/kaku.js';
export type { KakuOptions } from './core/kaku.js';
export { KakuDiagram } from './core/kaku-diagram.js';
export type { KakuDiagramOptions } from './core/kaku-diagram.js';

// Providers
export { KanjiVGProvider } from './providers/kanjivg-provider.js';
export type { KanjiVGProviderOptions } from './providers/kanjivg-provider.js';
export { AnimCJKProvider } from './providers/animcjk-provider.js';
export type { AnimCJKProviderOptions, AnimCJKLanguage } from './providers/animcjk-provider.js';

// Renderers
export { SvgRenderer } from './renderer/svg-renderer.js';
export type { SvgRendererOptions } from './renderer/svg-renderer.js';
export { AnimCJKRenderer } from './renderer/animcjk-renderer.js';
export type { AnimCJKRendererOptions } from './renderer/animcjk-renderer.js';
export { createStrokePath } from './renderer/stroke-path.js';
export type { StrokePathOptions } from './renderer/stroke-path.js';

// Animator
export { StrokeAnimator } from './animator/stroke-animator.js';

// Types
export type {
  CharacterData,
  Stroke,
  StrokeMetadata,
  DataProvider,
  ProviderResult,
  Renderer,
  RenderedStroke,
  RenderOptions,
  Animator,
  AnimatorOptions,
  AnimationState,
  AnimationEvent,
  AnimationEventType,
  AnimationEventHandler,
  StrokeEffect,
} from './types/index.js';

// Utilities
export { toHex, getCodePoints } from './utils/unicode.js';
export {
  createSvgElement,
  createSvg,
  createPath,
  createLine,
  createGroup,
} from './utils/svg.js';
