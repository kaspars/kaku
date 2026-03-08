import * as THREE from 'three';
import type { SceneOptions } from './types.js';
import { createFirstPersonControls, type FirstPersonControls } from './controls.js';

export interface Kaku3DScene {
  /** The Three.js scene */
  scene: THREE.Scene;
  /** The camera */
  camera: THREE.PerspectiveCamera;
  /** The WebGL renderer */
  renderer: THREE.WebGLRenderer;
  /** First-person controls */
  controls: FirstPersonControls;
  /** Add a model to the scene at a position */
  addModel(model: THREE.Group, position?: THREE.Vector3): void;
  /** Remove all character models */
  clearModels(): void;
  /** Start the render loop */
  start(): void;
  /** Stop the render loop */
  stop(): void;
  /** Dispose all resources */
  dispose(): void;
}

/**
 * Create a 3D scene with ground, grid, lighting, and first-person controls.
 */
export function createScene(options: SceneOptions): Kaku3DScene {
  const {
    container,
    groundSize = 2000,
    gridDivisions = 40,
    skyColor = 0x87ceeb,
    groundColor = 0x556b2f,
    eyeHeight = 60,
    cameraDistance = 200,
    moveSpeed,
    turnSpeed,
    mouseSensitivity,
  } = options;

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(skyColor, 500, 2000);

  // Camera
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;
  const camera = new THREE.PerspectiveCamera(60, width / height, 1, 5000);
  camera.position.set(0, eyeHeight, cameraDistance);
  camera.lookAt(0, eyeHeight * 0.6, 0);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Ground plane
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: groundColor,
    roughness: 0.9,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid helper for movement reference
  const grid = new THREE.GridHelper(groundSize, gridDivisions, 0x444444, 0x666666);
  grid.position.y = 0.1; // Slightly above ground to avoid z-fighting
  (grid.material as THREE.Material).opacity = 0.3;
  (grid.material as THREE.Material).transparent = true;
  scene.add(grid);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0xb1e1ff, 0xb97a20, 0.5);
  scene.add(hemisphereLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(100, 200, 100);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 10;
  directionalLight.shadow.camera.far = 600;
  directionalLight.shadow.camera.left = -200;
  directionalLight.shadow.camera.right = 200;
  directionalLight.shadow.camera.top = 200;
  directionalLight.shadow.camera.bottom = -200;
  scene.add(directionalLight);

  // Controls
  const controls = createFirstPersonControls(camera, renderer.domElement, {
    eyeHeight,
    moveSpeed,
    turnSpeed,
    mouseSensitivity,
  });

  // Model tracking
  const models: THREE.Group[] = [];

  // Render loop
  const clock = new THREE.Clock();
  let animationId: number | null = null;

  function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    controls.update(delta);
    renderer.render(scene, camera);
  }

  // Resize handler
  function onResize() {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return {
    scene,
    camera,
    renderer,
    controls,

    addModel(model: THREE.Group, position?: THREE.Vector3) {
      if (position) {
        model.position.copy(position);
      }
      scene.add(model);
      models.push(model);
    },

    clearModels() {
      for (const model of models) {
        scene.remove(model);
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
      models.length = 0;
    },

    start() {
      if (animationId !== null) return;
      clock.start();
      animate();
    },

    stop() {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      clock.stop();
    },

    dispose() {
      this.stop();
      this.clearModels();
      controls.dispose();
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    },
  };
}
