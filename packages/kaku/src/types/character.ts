/**
 * Normalized character data format
 */
export interface CharacterData {
  /** The character itself */
  character: string;
  /** Unicode code points for the character */
  codePoints: number[];
  /** SVG viewBox as [minX, minY, width, height] */
  viewBox: [number, number, number, number];
  /** Array of strokes in drawing order */
  strokes: Stroke[];
  /** Data source identifier */
  source: string;
  /** Raw SVG content from the provider (for native rendering) */
  rawSvg?: string;
}

/**
 * Single stroke information
 */
export interface Stroke {
  /** SVG path "d" attribute */
  pathData: string;
  /** Stroke metadata */
  metadata: StrokeMetadata;
}

/**
 * Metadata for a stroke
 */
export interface StrokeMetadata {
  /** Stroke index (0-based) */
  index: number;
  /** Stroke type (e.g., "㇐" for horizontal) */
  type?: string;
  /** Original ID from source data */
  sourceId?: string;
}
