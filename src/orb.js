import * as THREE from "three";
import { createShieldMaterial } from "./orbShader.js";
import { createEnergyRays } from "./particleRays.js";

export function createOrb(scene, camera, renderer) {
  const mat = createShieldMaterial();
  const geo = new THREE.SphereGeometry(1.8, 64, 64);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 2.3, 0);
  scene.add(mesh);

  // Inner glass sphere — MeshStandardMaterial black glossy
  const glassGeo = new THREE.SphereGeometry(1.75, 32, 32);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.15,
    metalness: 0.9,
    envMapIntensity: 2.0,
    side: THREE.FrontSide,
    transparent: true,
    opacity: 0.6,
  });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.position.y = -0.02;
  glassMesh.renderOrder = 2;
  mesh.add(glassMesh);

  // Hit state
  const MAX_HITS = 6;
  const hit = {
    idx: 0,
    positions: Array.from({ length: MAX_HITS }, () => new THREE.Vector3(0, 1.8, 0)),
    times: new Array(MAX_HITS).fill(-999),
  };

  // Click detection
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown = false;
  const downPos = new THREE.Vector2();

  renderer.domElement.addEventListener("pointerdown", (e) => {
    pointerDown = true;
    downPos.set(e.clientX, e.clientY);
  });

  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!pointerDown) return;
    pointerDown = false;
    const dx = e.clientX - downPos.x;
    const dy = e.clientY - downPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) return;

    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObject(mesh);
    if (hits.length > 0) {
      const idx = hit.idx % MAX_HITS;
      hit.idx++;
      const localPt = mesh.worldToLocal(hits[0].point.clone());
      mat.uniforms.uHitPos.value[idx].copy(localPt);
      mat.uniforms.uHitTime.value[idx] = mat.uniforms.uTime.value;
    }
  });

  // Lighting
  const ambient = new THREE.AmbientLight(0x404060, 1.0);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(5, 15, 8);
  dirLight.castShadow = false;
  dirLight.shadow.mapSize.set(1024, 1024);
  // scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
  fillLight.position.set(-3, 5, -5);
  scene.add(fillLight);

  const cfg = {
    color: "#ff5c5c",
    scale: 1,
    glowIntensity: 4,
    hexScale: 4.6, hexOpacity: 0.26, showHex: false, edgeWidth: 0.25,
    fresnelPower: 0.5, fresnelStrength: 1.6, opacity: 0.92, fadeStart: -1,
    flashSpeed: 0.6, flashIntensity: 0.11,
    flowScale: 9.2, flowSpeed: 2.21, flowIntensity: 2,
    hitRingSpeed: 4.4, hitRingWidth: 0.5, hitDuration: 1.6, hitIntensity: 4.1,
    hitMaxRadius: 3.14, hitImpactRadius: 0.8,
    noiseScale: 1.3, noiseEdgeSmoothness: 0.5,
    glassColor: "#000000", glassRoughness: 0.15, glassMetalness: 0.9, glassOpacity: 0.6,
    rotX: 0,
    rotSpeed: 0,
  };

  function update(delta) {
    mat.uniforms.uTime.value += delta;
    mesh.rotation.x += cfg.rotSpeed * delta;
    particleRays.update(delta);
  }

  const particleRays = createEnergyRays(scene, mesh, mat);

  // ── Hoisted working vectors for triggerHits (zero GC) ──
  const _hitOffset = new THREE.Vector3();
  const _hitPos = new THREE.Vector3();

  function triggerHit(shieldMesh, worldPos) {
    if (!shieldMesh || !shieldMesh.material || !shieldMesh.material.uniforms) return;
    const u = shieldMesh.material.uniforms;
    if (!u.uHitPos || !u.uHitTime) return;
    const hitIdx = (u._portalHitIdx = ((u._portalHitIdx || 0) + 1) % 6);
    const localPt = shieldMesh.worldToLocal(worldPos.clone());
    u.uHitPos.value[hitIdx].copy(localPt);
    u.uHitTime.value[hitIdx] = u.uTime.value;
  }

  function triggerHits(shieldMesh, count, interval) {
    if (!shieldMesh) return;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        if (!shieldMesh.material || !shieldMesh.material.uniforms) return;
        _hitOffset.set(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5
        );
        _hitPos.copy(shieldMesh.position).add(_hitOffset);
        triggerHit(shieldMesh, _hitPos);
      }, i * interval);
    }
  }

  function initGUI(gui) {
    const f = gui.addFolder("Object");
    orbExports.guiFolder = f;
    f.close();
    const u = mat.uniforms;
    f.addColor(cfg, "color").onChange((v) => {
      u.uColor.value.set(v);
      u.uNoiseEdgeColor.value.set(v);
      particleRays.syncColor();
    });
    f.add(cfg, "scale", 0.1, 5, 0.05).onChange((v) => { mesh.scale.setScalar(v); });
    f.add(cfg, "hexScale", 0.5, 10, 0.1).onChange((v) => u.uHexScale.value = v);
    f.add(cfg, "hexOpacity", 0, 1, 0.01).onChange((v) => u.uHexOpacity.value = v);
    f.add(cfg, "showHex").onChange((v) => u.uShowHex.value = v ? 1 : 0);
    f.add(cfg, "edgeWidth", 0.01, 0.5, 0.01).onChange((v) => u.uEdgeWidth.value = v);
    f.add(cfg, "fresnelPower", 0.5, 5, 0.1).onChange((v) => u.uFresnelPower.value = v);
    f.add(cfg, "fresnelStrength", 0, 5, 0.1).onChange((v) => u.uFresnelStrength.value = v);
    f.add(cfg, "opacity", 0, 1, 0.01).onChange((v) => u.uOpacity.value = v);
    f.add(cfg, "fadeStart", -1, 1, 0.05).onChange((v) => u.uFadeStart.value = v);
    f.add(cfg, "noiseScale", 0.5, 10, 0.1).name("Noise Scale").onChange((v) => u.uNoiseScale.value = v);
    f.add(cfg, "noiseEdgeSmoothness", 0, 1, 0.05).name("Edge Smoothness").onChange((v) => u.uNoiseEdgeSmoothness.value = v);
    f.add(cfg, "glowIntensity", 0, 2, 0.05).name("Grid Glow").onChange((v) => { mesh.userData.glowIntensity = v; });
    const hitFolder = f.addFolder("Impact");
    hitFolder.close();
    hitFolder.add(cfg, "hitRingSpeed", 0.1, 10, 0.05).name("Ring Speed").onChange((v) => u.uHitRingSpeed.value = v);
    hitFolder.add(cfg, "hitRingWidth", 0.01, 2, 0.01).name("Ring Width").onChange((v) => u.uHitRingWidth.value = v);
    hitFolder.add(cfg, "hitMaxRadius", 0.2, 6.28, 0.05).name("Max Radius").onChange((v) => u.uHitMaxRadius.value = v);
    hitFolder.add(cfg, "hitDuration", 0.5, 6, 0.05).onChange((v) => u.uHitDuration.value = v);
    hitFolder.add(cfg, "hitIntensity", 0, 10, 0.1).onChange((v) => u.uHitIntensity.value = v);
    hitFolder.add(cfg, "hitImpactRadius", 0.1, 3, 0.05).name("Impact Radius").onChange((v) => u.uHitImpactRadius.value = v);
    const flowFolder = f.addFolder("Flow Noise");
    flowFolder.close();
    flowFolder.add(cfg, "flowScale", 0.1, 8, 0.1).onChange((v) => u.uFlowScale.value = v);
    flowFolder.add(cfg, "flowSpeed", 0, 5, 0.01).onChange((v) => u.uFlowSpeed.value = v);
    flowFolder.add(cfg, "flowIntensity", 0, 10, 0.1).onChange((v) => u.uFlowIntensity.value = v);
    const rotFolder = f.addFolder("Rotation");
    rotFolder.close();
    rotFolder.add(cfg, "rotX", -Math.PI, Math.PI, 0.01).name("Angle X").onChange((v) => mesh.rotation.x = v);
    rotFolder.add(cfg, "rotSpeed", -5, 5, 0.05).name("Auto Speed");
    particleRays.initGUI(f);
    mesh.scale.setScalar(cfg.scale);
    mesh.userData.glowIntensity = cfg.glowIntensity;

    const glassFolder = f.addFolder("Glass");
    glassFolder.close();
    glassFolder.addColor(cfg, "glassColor").name("Color").onChange((v) => { glassMat.color.set(v); });
    glassFolder.add(cfg, "glassRoughness", 0, 1, 0.01).name("Roughness").onChange((v) => { glassMat.roughness = v; });
    glassFolder.add(cfg, "glassMetalness", 0, 1, 0.01).name("Metalness").onChange((v) => { glassMat.metalness = v; });
    glassFolder.add(cfg, "glassOpacity", 0, 1, 0.01).name("Opacity").onChange((v) => { glassMat.opacity = v; });
  }

  const orbExports = { mesh, glassMesh, glassMat, update, initGUI, guiFolder: null, particleRays, cfg, triggerHit, triggerHits, getConfig: () => {
    const u = mat.uniforms;
    return {
      color: "#" + u.uColor.value.getHexString(),
      scale: cfg.scale,
      hexScale: u.uHexScale.value,
      edgeWidth: u.uEdgeWidth.value,
      fresnelPower: u.uFresnelPower.value,
      fresnelStrength: u.uFresnelStrength.value,
      opacity: u.uOpacity.value,
      fadeStart: u.uFadeStart.value,
      glowIntensity: cfg.glowIntensity,
      flashSpeed: u.uFlashSpeed.value,
      flashIntensity: u.uFlashIntensity.value,
      hexOpacity: u.uHexOpacity.value,
      showHex: u.uShowHex.value === 1,
      noiseScale: u.uNoiseScale.value,
      noiseEdgeSmoothness: u.uNoiseEdgeSmoothness.value,
      flowScale: u.uFlowScale.value,
      flowSpeed: u.uFlowSpeed.value,
      flowIntensity: u.uFlowIntensity.value,
      hitRingSpeed: u.uHitRingSpeed.value,
      hitRingWidth: u.uHitRingWidth.value,
      hitMaxRadius: u.uHitMaxRadius.value,
      hitImpactRadius: u.uHitImpactRadius.value,
      hitDuration: u.uHitDuration.value,
      hitIntensity: u.uHitIntensity.value,
      rotX: cfg.rotX,
      rotSpeed: cfg.rotSpeed,
    };
  } };

  return orbExports;
}
