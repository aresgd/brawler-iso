import * as THREE from 'three';

// Tracks which keys are currently pressed
export const keys = {};

// Mouse state
export const mouse = { x: 0, y: 0 };
export const mouseWorld = new THREE.Vector3(); // world-space position on arena plane
const _raycaster = new THREE.Raycaster();
const _mouseNDC = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0 plane

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// Mouse buttons
export const mouseButtons = { left: false, right: false };
const prevMouseButtons = { left: false, right: false };

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouseButtons.left = true;
  if (e.button === 2) mouseButtons.right = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseButtons.left = false;
  if (e.button === 2) mouseButtons.right = false;
});

// Prevent right-click context menu from interfering with gameplay
window.addEventListener('contextmenu', (e) => e.preventDefault());

export function isMouseJustPressed(button) {
  return mouseButtons[button] && !prevMouseButtons[button];
}

export function updateMouseWorld(camera) {
  _mouseNDC.x = (mouse.x / window.innerWidth) * 2 - 1;
  _mouseNDC.y = -(mouse.y / window.innerHeight) * 2 + 1;
  _raycaster.setFromCamera(_mouseNDC, camera);
  _raycaster.ray.intersectPlane(_plane, mouseWorld);
}

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Numpad1', 'Numpad2', 'Numpad3',
]);

window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// Returns a normalized {x, z} movement vector for a player based on their key bindings.
// The input is rotated -45 degrees to map screen-space directions to isometric world-space.
export function getMovementVector(bindings) {
  let x = 0;
  let z = 0;

  if (keys[bindings.up]) z -= 1;
  if (keys[bindings.down]) z += 1;
  if (keys[bindings.left]) x -= 1;
  if (keys[bindings.right]) x += 1;

  // Normalize
  const len = Math.sqrt(x * x + z * z);
  if (len > 0) {
    x /= len;
    z /= len;
  }

  // Rotate -45 degrees for isometric mapping
  const angle = -Math.PI / 4;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos - z * sin,
    z: x * sin + z * cos,
  };
}

// Returns true only on the frame the key is first pressed
const prevKeys = {};
export function isKeyJustPressed(code) {
  const justPressed = keys[code] && !prevKeys[code];
  return justPressed;
}

export function updateInputState() {
  for (const code of GAME_KEYS) {
    prevKeys[code] = !!keys[code];
  }
  prevMouseButtons.left = mouseButtons.left;
  prevMouseButtons.right = mouseButtons.right;
}
