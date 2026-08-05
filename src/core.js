import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createCore(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const dprSettings = { dpr: Math.min(window.devicePixelRatio, 2) };

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    22,
    window.innerWidth / window.innerHeight,
    0.1,
    2000,
  );
  camera.position.set(4.099707240057938, 64.98832205324518, 14.960268074160156);
  scene.add(camera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableRotate = false;
  controls.enableZoom = false;
  controls.minDistance = 3;
  controls.maxDistance = 100;
  controls.minPolarAngle = THREE.MathUtils.degToRad(10);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
  controls.target.set(
    -3.8481688371939167,
    0.542985955445206,
    6.838735174151172,
  ); //(-3.8481688371939167, 0.542985955445206, 6.838735174151172);
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.2;

  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  return { renderer, scene, camera, controls, dprSettings };
}
