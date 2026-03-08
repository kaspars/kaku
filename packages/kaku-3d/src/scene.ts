import * as THREE from 'three';
import type { SceneOptions } from './types.js';
import { createFirstPersonControls, type FirstPersonControls, type Obstacle } from './controls.js';
import { createAnimator, type CharacterAnimator, type AnimationEffect } from './animate.js';

export interface Kaku3DScene {
  /** The Three.js scene */
  scene: THREE.Scene;
  /** The camera */
  camera: THREE.PerspectiveCamera;
  /** The WebGL renderer */
  renderer: THREE.WebGLRenderer;
  /** First-person controls */
  controls: FirstPersonControls;
  /** Character animator */
  animator: CharacterAnimator;
  /** Add a model to the scene at a position */
  addModel(model: THREE.Group, position?: THREE.Vector3): void;
  /** Set the animation effect for all models */
  setEffect(effect: AnimationEffect): void;
  /** Get the number of models in the scene */
  getModelCount(): number;
  /** Get the ground half-size */
  getGroundHalfSize(): number;
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
 * Create a brick wall segment as a textured box.
 */
function createWall(
  width: number,
  height: number,
  depth: number,
  position: THREE.Vector3,
  rotationY: number = 0,
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(width, height, depth);

  // Create a simple brick pattern via canvas texture
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Base brick color
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(0, 0, 128, 128);

  // Brick rows
  const brickH = 16;
  const brickW = 32;
  ctx.strokeStyle = '#6B3410';
  ctx.lineWidth = 2;

  for (let row = 0; row < 128 / brickH; row++) {
    const y = row * brickH;
    const offset = (row % 2) * (brickW / 2);
    // Horizontal mortar line
    ctx.fillStyle = '#A0A0A0';
    ctx.fillRect(0, y, 128, 2);
    // Vertical mortar lines
    for (let x = offset; x < 128; x += brickW) {
      ctx.fillRect(x, y, 2, brickH);
    }
    // Slight color variation per brick
    for (let x = offset; x < 128; x += brickW) {
      const shade = 0.85 + Math.random() * 0.3;
      ctx.fillStyle = `rgba(139, 69, 19, ${1 - shade + 0.7})`;
      ctx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 100, height / 100);

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.9,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Create a 3D scene with ground, grid, lighting, boundary walls,
 * and first-person controls with collision detection.
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

  const halfGround = groundSize / 2;
  const wallHeight = 120;
  const wallThickness = 10;

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

  // Grid — more visible with tighter spacing and higher contrast
  const grid = new THREE.GridHelper(groundSize, gridDivisions, 0x3a5a2a, 0x4a6a3a);
  grid.position.y = 0.2;
  const gridMat = grid.material as THREE.Material;
  gridMat.opacity = 0.6;
  gridMat.transparent = true;
  scene.add(grid);

  // Secondary fine grid for close-range movement feedback
  const fineGrid = new THREE.GridHelper(groundSize, gridDivisions * 4, 0x4a6a3a, 0x4a6a3a);
  fineGrid.position.y = 0.15;
  const fineGridMat = fineGrid.material as THREE.Material;
  fineGridMat.opacity = 0.25;
  fineGridMat.transparent = true;
  scene.add(fineGrid);

  // Boundary walls
  const wallY = wallHeight / 2;
  // North wall (-Z)
  scene.add(createWall(groundSize, wallHeight, wallThickness,
    new THREE.Vector3(0, wallY, -halfGround)));
  // South wall (+Z)
  scene.add(createWall(groundSize, wallHeight, wallThickness,
    new THREE.Vector3(0, wallY, halfGround)));
  // West wall (-X)
  scene.add(createWall(groundSize, wallHeight, wallThickness,
    new THREE.Vector3(-halfGround, wallY, 0), Math.PI / 2));
  // East wall (+X)
  scene.add(createWall(groundSize, wallHeight, wallThickness,
    new THREE.Vector3(halfGround, wallY, 0), Math.PI / 2));

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0xb1e1ff, 0xb97a20, 0.5);
  scene.add(hemisphereLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(100, 200, 100);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 4096;
  directionalLight.shadow.mapSize.height = 4096;
  directionalLight.shadow.camera.near = 10;
  directionalLight.shadow.camera.far = 600;
  // Shadow camera covers the full ground area so wandering characters keep shadows
  directionalLight.shadow.camera.left = -halfGround;
  directionalLight.shadow.camera.right = halfGround;
  directionalLight.shadow.camera.top = halfGround;
  directionalLight.shadow.camera.bottom = -halfGround;
  directionalLight.shadow.camera.far = halfGround * 2;
  scene.add(directionalLight);

  // Audio listener on camera for spatial sound
  const audioListener = new THREE.AudioListener();
  camera.add(audioListener);

  // Resume AudioContext on first user click (browser autoplay policy)
  const resumeAudio = () => {
    if (audioListener.context.state === 'suspended') {
      audioListener.context.resume();
    }
  };
  document.addEventListener('click', resumeAudio, { once: false });
  document.addEventListener('keydown', resumeAudio, { once: false });

  // Controls
  const controls = createFirstPersonControls(camera, renderer.domElement, {
    eyeHeight,
    moveSpeed,
    turnSpeed,
    mouseSensitivity,
  });
  controls.setBounds(halfGround);

  // Animator with spatial audio
  const animator = createAnimator({ boundsHalfSize: halfGround });
  animator.setAudioListener(audioListener);
  let currentEffect: AnimationEffect = 'static';

  // Model tracking
  const models: THREE.Group[] = [];

  function updateObstacles() {
    const obs: Obstacle[] = [];
    for (const model of models) {
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      // Use the larger XZ dimension as collision radius
      const radius = Math.max(size.x, size.z) / 2;
      obs.push({
        position: new THREE.Vector2(center.x, center.z),
        radius,
      });
    }
    controls.setObstacles(obs);
  }

  // Render loop
  const clock = new THREE.Clock();
  let animationId: number | null = null;

  function animate() {
    animationId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    controls.update(delta);
    animator.update(delta);
    // Update obstacle positions after animation moves models
    updateObstacles();
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
    animator,

    addModel(model: THREE.Group, position?: THREE.Vector3) {
      if (position) {
        model.position.copy(position);
      }
      scene.add(model);
      models.push(model);
      animator.addModel(model, currentEffect);
      updateObstacles();
    },

    setEffect(effect: AnimationEffect) {
      currentEffect = effect;
      animator.setEffect(effect);
    },

    clearModels() {
      animator.clear();
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
      updateObstacles();
    },

    /** Get the number of models currently in the scene */
    getModelCount() {
      return models.length;
    },

    /** Get the ground half-size for spawn position calculations */
    getGroundHalfSize() {
      return halfGround;
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
      animator.dispose();
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    },
  };
}
