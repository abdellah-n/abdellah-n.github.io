import * as THREE from "three";
import { gridVertex, gridFragment } from "./shaders.js";

export function createGrid(scene, camera) {
  const group = new THREE.Group();

  const textureLoader = new THREE.TextureLoader();
  const fbmNoiseTex = textureLoader.load("/textures/compressed/lavatileroughness.jpg");
  fbmNoiseTex.wrapS = fbmNoiseTex.wrapT = THREE.RepeatWrapping;
  const normalMapTex = textureLoader.load("/textures/compressed/lavatilenormal.jpg");
  normalMapTex.wrapS = normalMapTex.wrapT = THREE.RepeatWrapping;
  const lavaAOTex = textureLoader.load("/textures/compressed/lavatileao.jpg");
  lavaAOTex.wrapS = lavaAOTex.wrapT = THREE.RepeatWrapping;
  const lavaRoughTex = fbmNoiseTex; // Shared reference (saves 1 texture upload)

  // Shader-based infinite grid with reflections
  const gridMat = new THREE.ShaderMaterial({
    uniforms: {
      uCellSize: { value: 0.5 },
      uSectionSize: { value: 6.0 },
      uFadeDistance: { value: 7.0 },
      uCellColor: { value: new THREE.Color("#5c5c5c") },
      uSectionColor: { value: new THREE.Color("#ffb35c") },
      uShieldColor: { value: new THREE.Color("#ff5c5c") },
      uShieldWorldPos: { value: new THREE.Vector3(0, 2, 0) },
      uShieldGlowIntensity: { value: 1.0 },
      uPortalWorldPos: { value: new THREE.Vector3(0.5, 2, 0) },
      uReflIntensity: { value: 0.55 },
      uShowX: { value: 1.0 },
      uShowZ: { value: 0 },
      uFbmNoise: { value: fbmNoiseTex },
      uNormalMap: { value: normalMapTex },
      uTexScale: { value: 0.0025 },
      uTexDistort: { value: 0.05 },
      uLavaAO: { value: lavaAOTex },
      uLavaHeight: { value: lavaAOTex },
      uLavaRough: { value: lavaRoughTex },
      uEnvBoxMin: { value: new THREE.Vector3(-30, -0.1, -30) },
      uEnvBoxMax: { value: new THREE.Vector3(30, 35, 30) },
      uEnvBoxCenter: { value: new THREE.Vector3(0, 17, 0) },
      uEnvIntensity: { value: 0.0 },
      uFbmScale: { value: 2.0 },
    },
    vertexShader: gridVertex,
    fragmentShader: gridFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMap: null, // set via setEnvMap() → renderer injects CubeUV defines + binds
  });

  const gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), gridMat);
  gridMesh.rotation.x = -Math.PI / 2;
  gridMesh.position.y = -0.05;
  group.add(gridMesh);

  scene.add(group);

  function setUnitInfo(pos, color, glowIntensity) {
    gridMat.uniforms.uShieldWorldPos.value.copy(pos);
    gridMat.uniforms.uShieldColor.value.set(color);
    if (glowIntensity !== undefined) gridMat.uniforms.uShieldGlowIntensity.value = glowIntensity;
  }

  function setModelPos(pos) {
    gridMat.uniforms.uPortalWorldPos.value.copy(pos);
  }

  function setEnvMap(tex) {
    gridMat.envMap = tex || null;
  }

  function initGUI(gui) {
    const f = gui.addFolder("Grid");
    f.close();
    const cfg = {
      cellSize: 0.5, sectionSize: 6, fadeDistance: 7,
      reflIntensity: 0.55, shieldGlow: 1, envIntensity: 0.3,
      visible: true, lines: "X Only",
      sectionColor: "#ffb35c",
      texScale: 0.01, texDistort: 0.5, fbmScale: 2,
    };
    f.add(cfg, "visible").onChange((v) => { group.visible = v; });
    f.add(cfg, "lines", ["Both", "X Only", "Z Only"]).onChange((v) => {
      gridMat.uniforms.uShowX.value = v === "Both" || v === "X Only" ? 1 : 0;
      gridMat.uniforms.uShowZ.value = v === "Both" || v === "Z Only" ? 1 : 0;
    });
    f.addColor(cfg, "sectionColor").onChange((v) => gridMat.uniforms.uSectionColor.value.set(v));
    f.add(cfg, "cellSize", 0.5, 10, 0.5).onChange((v) => gridMat.uniforms.uCellSize.value = v);
    f.add(cfg, "sectionSize", 1, 30, 1).onChange((v) => gridMat.uniforms.uSectionSize.value = v);
    f.add(cfg, "fadeDistance", 5, 60, 1).onChange((v) => gridMat.uniforms.uFadeDistance.value = v);
    f.add(cfg, "reflIntensity", 0, 1, 0.05).onChange((v) => gridMat.uniforms.uReflIntensity.value = v);
    f.add(cfg, "envIntensity", 0, 2, 0.05).name("Env Reflection").onChange((v) => gridMat.uniforms.uEnvIntensity.value = v);
    f.add(cfg, "texScale", 0.01, 0.2, 0.005).name("Tex Scale").onChange((v) => gridMat.uniforms.uTexScale.value = v);
    f.add(cfg, "texDistort", 0, 0.5, 0.01).name("Tex Distort").onChange((v) => gridMat.uniforms.uTexDistort.value = v);
    f.add(cfg, "fbmScale", 0.5, 8, 0.1).name("Spot Scale").onChange((v) => gridMat.uniforms.uFbmScale.value = v);
  }

  function setLines(mode) {
    gridMat.uniforms.uShowX.value = mode === "Both" || mode === "X Only" ? 1 : 0;
    gridMat.uniforms.uShowZ.value = mode === "Both" || mode === "Z Only" ? 1 : 0;
  }

  return { group, initGUI, setUnitInfo, setModelPos, setLines, gridMat, setEnvMap,
    setSectionColor: (c) => gridMat.uniforms.uSectionColor.value.set(c), getConfig: () => {
    const u = gridMat.uniforms;
    const xOn = u.uShowX.value === 1;
    const zOn = u.uShowZ.value === 1;
    const lines = xOn && zOn ? "Both" : xOn ? "X Only" : "Z Only";
    return {
      cellSize: u.uCellSize.value,
      sectionSize: u.uSectionSize.value,
      fadeDistance: u.uFadeDistance.value,
      cellColor: "#" + u.uCellColor.value.getHexString(),
      sectionColor: "#" + u.uSectionColor.value.getHexString(),
      reflIntensity: u.uReflIntensity.value,
      glow: u.uShieldGlowIntensity.value,
      showX: xOn,
      showZ: zOn,
      visible: group.visible,
      lines,
    };
  } };
}
