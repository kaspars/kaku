import * as THREE from 'three';

export interface FirstPersonControls {
  /** Call each frame with delta time in seconds */
  update(delta: number): void;
  /** Clean up event listeners */
  dispose(): void;
}

interface ControlKeys {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

/**
 * First-person controls: arrow keys to move/turn, mouse for looking.
 * Click the canvas to capture the pointer (pointer lock).
 */
export function createFirstPersonControls(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  options: {
    eyeHeight?: number;
    moveSpeed?: number;
    turnSpeed?: number;
    mouseSensitivity?: number;
  } = {},
): FirstPersonControls {
  const eyeHeight = options.eyeHeight ?? 60;
  const moveSpeed = options.moveSpeed ?? 150;
  const turnSpeed = options.turnSpeed ?? 2;
  const mouseSensitivity = options.mouseSensitivity ?? 0.002;

  // Euler angles for camera rotation
  let yaw = 0;
  let pitch = 0;

  const keys: ControlKeys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };

  // Initialize yaw from camera's current facing direction.
  // In Euler 'YXZ', yaw=0 means facing -Z (Three.js default).
  // atan2(-dir.x, -dir.z) gives 0 when facing -Z.
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  yaw = Math.atan2(-dir.x, -dir.z);

  const direction = new THREE.Vector3();

  function onKeyDown(e: KeyboardEvent) {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        keys.forward = true;
        e.preventDefault();
        break;
      case 'ArrowDown':
      case 'KeyS':
        keys.backward = true;
        e.preventDefault();
        break;
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = true;
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'KeyD':
        keys.right = true;
        e.preventDefault();
        break;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        keys.forward = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        keys.backward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        keys.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        keys.right = false;
        break;
    }
  }

  function onMouseMove(e: MouseEvent) {
    if (document.pointerLockElement !== domElement) return;

    yaw -= e.movementX * mouseSensitivity;
    pitch -= e.movementY * mouseSensitivity;
    pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
  }

  function onClick() {
    if (document.pointerLockElement !== domElement) {
      domElement.requestPointerLock();
    }
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  domElement.addEventListener('click', onClick);

  return {
    update(delta: number) {
      // Turn with arrow keys when pointer is not locked
      if (document.pointerLockElement !== domElement) {
        if (keys.left) yaw += turnSpeed * delta;
        if (keys.right) yaw -= turnSpeed * delta;
      }

      // Apply rotation
      const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
      camera.quaternion.setFromEuler(euler);

      // Move forward/backward along facing direction (XZ plane only)
      direction.set(0, 0, 0);

      if (keys.forward) {
        direction.z -= 1;
      }
      if (keys.backward) {
        direction.z += 1;
      }

      // When pointer is locked, left/right strafe instead of turn
      if (document.pointerLockElement === domElement) {
        if (keys.left) direction.x -= 1;
        if (keys.right) direction.x += 1;
      }

      if (direction.lengthSq() > 0) {
        direction.normalize();
        direction.applyQuaternion(camera.quaternion);

        // Only move on XZ plane
        camera.position.x += direction.x * moveSpeed * delta;
        camera.position.z += direction.z * moveSpeed * delta;
      }

      // Lock Y to eye height
      camera.position.y = eyeHeight;
    },

    dispose() {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      domElement.removeEventListener('click', onClick);
    },
  };
}
