import * as THREE from 'three';
import opentype from 'opentype.js';

let cachedFont: opentype.Font | null = null;
let cachedFontUrl: string | null = null;

/**
 * Load an OpenType font from a URL. Caches the last loaded font.
 */
export async function loadFont(url: string): Promise<opentype.Font> {
  if (cachedFont && cachedFontUrl === url) return cachedFont;

  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const font = opentype.parse(buffer);

  cachedFont = font;
  cachedFontUrl = url;
  return font;
}

/**
 * Convert an opentype.js glyph to Three.js Shapes.
 * Flips Y in the path commands directly (OpenType Y-down → Three.js Y-up).
 */
export function glyphToShapes(
  font: opentype.Font,
  char: string,
  fontSize: number = 100,
): THREE.Shape[] {
  const glyph = font.charToGlyph(char);
  if (!glyph || glyph.index === 0) {
    throw new Error(`Character "${char}" not found in font`);
  }

  // Get path commands at the desired font size
  const path = glyph.getPath(0, 0, fontSize);

  // Convert opentype path commands to Three.js ShapePath,
  // negating Y to flip from screen coords to Three.js coords.
  const shapePath = new THREE.ShapePath();

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case 'M':
        shapePath.moveTo(cmd.x, -cmd.y);
        break;
      case 'L':
        shapePath.lineTo(cmd.x, -cmd.y);
        break;
      case 'C':
        shapePath.bezierCurveTo(cmd.x1, -cmd.y1, cmd.x2, -cmd.y2, cmd.x, -cmd.y);
        break;
      case 'Q':
        shapePath.quadraticCurveTo(cmd.x1, -cmd.y1, cmd.x, -cmd.y);
        break;
      case 'Z':
        shapePath.currentPath?.closePath();
        break;
    }
  }

  // After Y-flip, OpenType CW solid contours become CCW.
  // isCCW=true tells toShapes that CCW = solid shape, CW = hole.
  return shapePath.toShapes(true);
}
