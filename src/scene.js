import * as THREE from 'three';
import { ARENA_RADIUS } from './config.js';

export let scene, camera, renderer;

export function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a1a);
  scene.fog = new THREE.FogExp2(0x0a0a1a, 0.006);

  // Isometric orthographic camera
  const viewSize = ARENA_RADIUS * 1.2;
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(
    -viewSize * aspect, viewSize * aspect,
    viewSize, -viewSize,
    0.1, 200
  );

  const d = 60;
  camera.position.set(d, d, d);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  document.body.prepend(renderer.domElement);

  // Ambient light - cool blue tint
  const ambient = new THREE.AmbientLight(0xaabbdd, 0.9);
  scene.add(ambient);

  // Main directional light with warm tint
  const directional = new THREE.DirectionalLight(0xffeedd, 1.2);
  directional.position.set(20, 30, 20);
  directional.castShadow = true;
  directional.shadow.mapSize.set(2048, 2048);
  directional.shadow.camera.near = 0.5;
  directional.shadow.camera.far = 150;
  directional.shadow.camera.left = -35;
  directional.shadow.camera.right = 35;
  directional.shadow.camera.top = 35;
  directional.shadow.camera.bottom = -35;
  directional.shadow.bias = -0.001;
  scene.add(directional);

  // Subtle fill light from opposite side
  const fill = new THREE.DirectionalLight(0x6688cc, 0.5);
  fill.position.set(-15, 10, -15);
  scene.add(fill);

  // Point light at center (red glow from death zone)
  const centerGlow = new THREE.PointLight(0xff2200, 0.6, 12, 2);
  centerGlow.position.set(0, -0.5, 0);
  scene.add(centerGlow);

  // Resize handler
  window.addEventListener('resize', () => {
    const a = window.innerWidth / window.innerHeight;
    camera.left = -viewSize * a;
    camera.right = viewSize * a;
    camera.top = viewSize;
    camera.bottom = -viewSize;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
