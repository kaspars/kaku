export interface ExtrudeOptions {
  /** Extrusion depth in scene units (default: 10) */
  depth?: number;
  /** Bevel enabled (default: true) */
  bevel?: boolean;
  /** Bevel thickness (default: 1) */
  bevelThickness?: number;
  /** Bevel size (default: 0.5) */
  bevelSize?: number;
  /** Material color for the character (default: 0x333333) */
  color?: number;
}

export interface SceneOptions {
  /** Container element to render into */
  container: HTMLElement;
  /** Ground plane size (default: 2000) */
  groundSize?: number;
  /** Grid divisions (default: 40) */
  gridDivisions?: number;
  /** Sky color (default: 0x87CEEB) */
  skyColor?: number;
  /** Ground color (default: 0x556B2F) */
  groundColor?: number;
  /** Camera eye height in scene units (default: 60) */
  eyeHeight?: number;
  /** Initial camera distance from origin (default: 200) */
  cameraDistance?: number;
  /** Movement speed in units/second (default: 150) */
  moveSpeed?: number;
  /** Turn speed in radians/second (default: 2) */
  turnSpeed?: number;
  /** Mouse sensitivity (default: 0.002) */
  mouseSensitivity?: number;
}
