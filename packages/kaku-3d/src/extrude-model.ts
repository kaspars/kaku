import * as THREE from 'three';
import type { ExtrudeOptions } from './types.js';
import { loadFont, glyphToShapes } from './font-shapes.js';

/** Target size for the character model in scene units */
const TARGET_SIZE = 100;

/**
 * Create an extruded 3D model from a character using an OpenType font.
 * Returns a Group centered at origin, scaled to TARGET_SIZE.
 */
export async function extrudeCharacter(
  char: string,
  fontUrl: string,
  options: ExtrudeOptions = {},
): Promise<THREE.Group> {
  const {
    depth = 10,
    bevel = true,
    bevelThickness = 1,
    bevelSize = 0.5,
    color = 0x333333,
  } = options;

  const font = await loadFont(fontUrl);
  const shapes = glyphToShapes(font, char);

  if (shapes.length === 0) {
    throw new Error(`No shapes extracted for "${char}"`);
  }

  // Extrusion settings
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth,
    bevelEnabled: bevel,
    bevelThickness: bevel ? bevelThickness : 0,
    bevelSize: bevel ? bevelSize : 0,
    bevelSegments: bevel ? 3 : 0,
  };

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.1,
  });

  const group = new THREE.Group();

  for (const shape of shapes) {
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Center the group
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);

  // Scale to target size
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y);
  const scale = TARGET_SIZE / maxDim;
  group.scale.setScalar(scale);

  // Wrap in outer group so transforms are clean
  const wrapper = new THREE.Group();
  wrapper.add(group);

  return wrapper;
}
