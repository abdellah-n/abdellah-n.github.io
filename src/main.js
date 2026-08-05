import gsap from "gsap";
import * as THREE from "three";
import { createCore } from "./core.js";
import { getGUI } from "./gui.js";
import { createGradientEnvironment, preRenderGradientTextures, createTextureEnvironment } from "./environment.js";
import { createOrb } from "./orb.js";
import { createGrid } from "./grid.js";
import { createPostFX } from "./postfx.js";

import { createProjectSlider } from "./projectSlider.js";
import { createLanding } from "./landing.js";
import { loadModelExport } from "./gltfLoader.js";
import { PROJECTS, INFOS } from "./projects.js";
import { createSliderPagination } from "./sliderPagination.js";
import { articleFull, triggerHud } from "./components.js";
import { createShieldCounter } from "./statsCounter.js";
import { createRealismEffects } from "./realism.js";
import { createScrollController } from "./scrollController.js";
import { isMobile } from "./mobile.js";

function updateUIColors(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const root = document.documentElement;
  root.style.setProperty("--cyan", hex);
  root.style.setProperty("--cyan-dim", `rgba(${r}, ${g}, ${b}, 0.15)`);
  root.style.setProperty("--cyan-glow", `rgba(${r}, ${g}, ${b}, 0.4)`);
}

// Build nav dots
const navDots = document.getElementById("nav-dots");
PROJECTS.forEach((_, i) => {
  const dot = document.createElement("div");
  dot.className = "nav-dot" + (i === 0 ? " active" : "");
  dot.dataset.index = i;
  dot.addEventListener("click", () => {
    projectSlider.setActiveShieldExternal(i);
    if (orb.particleRays) {
      const m = projectSlider.allUnits[i];
      if (m) orb.particleRays.setTarget(m, m.material);
    }
  });
  navDots.appendChild(dot);
});

const INFOS_COUNT = INFOS.length;
const articles = document.querySelectorAll(".project-article");

function populateArticle(slot) {
  const info = INFOS[slot];
  if (!info) return;
  articles[slot].innerHTML = articleFull(slot, info);
}

for (let i = 0; i < INFOS_COUNT; i++) {
  populateArticle(i);
}

// ─── Preloader Progress ───
const loaderPct = document.querySelector(".loader-pct");
const loaderFill = document.querySelector(".loader-bar-fill");
let loadProgress = 0;
const loadInterval = setInterval(() => {
  loadProgress += Math.random() * 12 + 3;
  if (loadProgress > 95) loadProgress = 95;
  if (loaderPct) loaderPct.textContent = Math.floor(loadProgress) + "%";
  if (loaderFill) loaderFill.style.width = loadProgress + "%";
}, 200);

function finishLoader() {
  clearInterval(loadInterval);
  if (loaderPct) loaderPct.textContent = "100%";
  if (loaderFill) loaderFill.style.width = "100%";
}

// ─── HUD Info Updater ───
(function initHudInfo() {
  if (isMobile()) return;
  const elTime = document.getElementById("hinfo-time");
  const elDate = document.getElementById("hinfo-date");
  const elLoc  = document.getElementById("hinfo-loc");
  if (!elTime) return;

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const city = tz ? tz.split("/").pop().replace(/_/g, " ") : "";

  let locText = city;
  try {
    const lang = navigator.language || "";
    const region = lang.split("-")[1];
    if (region) locText = city + " · " + region.toUpperCase();
  } catch(_) {}
  if (elLoc) elLoc.textContent = ":: " + locText;

  function tick() {
    const now = new Date();
    if (elTime) elTime.textContent = now.toLocaleTimeString("en-GB", { hour12: false }) + " UTC" + (now.getTimezoneOffset() <= 0 ? "+" : "-") + String(Math.abs(now.getTimezoneOffset() / 60)).padStart(2, "0");
    if (elDate) elDate.textContent = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  }
  tick();
  setInterval(tick, 1000);
})();

function updateUI(idx) {
  const infoSlot = idx % INFOS_COUNT;
  const color = "#FFFFFF";

  articles.forEach((a, i) => {
    a.classList.toggle("active", i === infoSlot);
    if (i === infoSlot) {
      a.style.setProperty("--article-color", color);
    }
  });

  // Trigger HUD animation when info slot with HUD becomes active
  const info = INFOS[infoSlot];
  if (info && info.hud) {
    const texteras = [
      info.hud_textera_1 || null,
      info.hud_textera_2 || null,
      info.hud_textera_3 || null,
      info.hud_textera_4 || null,
    ];
    triggerHud(
      `hud-${infoSlot}`,
      info.chart2d ? info.chart2d.color : "#00e5ff",
      texteras
    );
  }

  navDots.querySelectorAll(".nav-dot").forEach((d, i) => {
    d.classList.toggle("active", i === idx);
  });
}

// Bootstrap
const core = createCore(document.getElementById("canvas-container"));
const gui = getGUI();

// Cam folder (global)
const camFolder = gui.addFolder("Camera");
camFolder.close();
const camCfg = { autoRotate: false, autoRotateSpeed: 0.2 };
camFolder.add(camCfg, "autoRotate").onChange((v) => core.controls.autoRotate = v);
camFolder.add(camCfg, "autoRotateSpeed", 0.01, 5, 0.01).onChange((v) => core.controls.autoRotateSpeed = v);
const camSave = {
  saveCam: () => {
    const p = core.camera.position;
    const t = core.controls.target;
    const json = JSON.stringify({
      cameraPosition: { x: p.x, y: p.y, z: p.z },
      controlsTarget: { x: t.x, y: t.y, z: t.z },
    }, null, 2);
    navigator.clipboard.writeText(json).then(
      () => console.log("Camera config copied"),
      () => { console.log("=== CAMERA ===\n" + json); }
    );
  }
};
camFolder.add(camSave, "saveCam");

// Mouse parallax effect
const mouseTarget = new THREE.Vector2();
document.addEventListener("mousemove", (e) => {
  mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseTarget.y = -(e.clientY / window.innerHeight) * 2 + 1;
  if (statsCounter) statsCounter.onMouseMove(mouseTarget.x, mouseTarget.y);
});
const mouseCfg = { enabled: true, strength: 0.3 };
const mouseOffset = new THREE.Vector2();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _off = new THREE.Vector3();
const _prevOff = new THREE.Vector3();
camFolder.add(mouseCfg, "enabled");
camFolder.add(mouseCfg, "strength", 0, 1, 0.05);

// Environment mode
const envCfg = {
  mode: "Gradient Textures",
  colorTop: "#a23f87",
  colorMid: "#3a3a7e",
  colorBottom: "#261230",
  range: 60,
  distortion: 0.22,
  blend: 60,
};

let gradientEnv = null;
let envTextures = null;
let envFadeActive = false;
let envFadeTargetIdx = 0;
let envFadeTargetEnvMapIntensity = 0.5;
let statsCounter = null;
let scrollCtrl = null;
let gridRef = null;

function syncGridEnv() {
  if (!gridRef || !gradientEnv) return;
  const tex = gradientEnv.getCurrentTexture ? gradientEnv.getCurrentTexture() : (gradientEnv.getTexture ? gradientEnv.getTexture() : null);
  if (tex) gridRef.setEnvMap(tex);
}

function applyEnvironment() {
  if (gradientEnv) {
    gradientEnv.dispose();
    gradientEnv = null;
  }
  if (envCfg.mode === "Gradient Textures") {
    if (envTextures) {
      gradientEnv = createTextureEnvironment(core.scene, envTextures);
    }
  } else if (envCfg.mode === "Live Gradient") {
    gradientEnv = createGradientEnvironment(core.scene, core.renderer, envCfg, syncGridEnv);
  }
  updateEnvGUIVisibility();
  syncGridEnv();
}

// Env folder in GUI
const envFolder = gui.addFolder("Environment");
envFolder.close();
envFolder.add(envCfg, "mode", ["Gradient Textures", "Live Gradient"]).onChange(() => applyEnvironment());
const envColorTopCtrl = envFolder.addColor(envCfg, "colorTop").name("Color Top").onChange(() => {
  if (gradientEnv && gradientEnv.update) gradientEnv.update({ colorTop: envCfg.colorTop });
});
const envColorMidCtrl = envFolder.addColor(envCfg, "colorMid").name("Color Mid").onChange(() => {
  if (gradientEnv && gradientEnv.update) gradientEnv.update({ colorMid: envCfg.colorMid });
});
const envColorBottomCtrl = envFolder.addColor(envCfg, "colorBottom").name("Color Bottom").onChange(() => {
  if (gradientEnv && gradientEnv.update) gradientEnv.update({ colorBottom: envCfg.colorBottom });
});
const envRangeCtrl = envFolder.add(envCfg, "range", 0, 100, 1).name("Range %").onChange(() => {
  if (gradientEnv && gradientEnv.update) gradientEnv.update({ range: envCfg.range });
});
const envDistortionCtrl = envFolder.add(envCfg, "distortion", 0, 2, 0.01).name("Distortion").onChange(() => {
  if (gradientEnv && gradientEnv.update) gradientEnv.update({ distortion: envCfg.distortion });
});
const envBlendCtrl = envFolder.add(envCfg, "blend", 1, 100, 1).name("Blend %").onChange(() => {
  if (gradientEnv && gradientEnv.update) gradientEnv.update({ blend: envCfg.blend });
});

const envGUIControls = [envColorTopCtrl, envColorMidCtrl, envColorBottomCtrl, envRangeCtrl, envDistortionCtrl, envBlendCtrl];

function updateEnvGUIVisibility() {
  const show = envCfg.mode === "Live Gradient";
  envGUIControls.forEach((c) => { c.domElement.style.display = show ? "" : "none"; });
}

// Load environment based on default mode, then build scene
function initEnvironment() {
  try {
    envTextures = preRenderGradientTextures(core.renderer, PROJECTS, envCfg);
  } catch (e) {
    console.warn("Pre-render failed, falling back to Live Gradient:", e);
    envCfg.mode = "Live Gradient";
  }

  if (envCfg.mode === "Gradient Textures" && envTextures) {
    gradientEnv = createTextureEnvironment(core.scene, envTextures);
  } else if (envCfg.mode === "Live Gradient") {
    gradientEnv = createGradientEnvironment(core.scene, core.renderer, envCfg, syncGridEnv);
  }
  updateEnvGUIVisibility();
  syncGridEnv();
  buildScene();
}

function buildScene() {
  const postfx = createPostFX(core.renderer, core.scene, core.camera);
  postfx.initGUI(gui);

  const realism = createRealismEffects(core.scene, postfx.composer, gui);

  // DPR control
  const dprFolder = gui.addFolder("Resolution");
  dprFolder.close();
  dprFolder.add(core.dprSettings, "dpr", 0.25, 3, 0.05).name("Pixel Ratio").onChange((v) => {
    core.renderer.setPixelRatio(v);
    core.camera.aspect = window.innerWidth / window.innerHeight;
    core.camera.updateProjectionMatrix();
    core.renderer.setSize(window.innerWidth, window.innerHeight);
    postfx.resize(window.innerWidth, window.innerHeight);
  });

  const orb = createOrb(core.scene, core.camera, core.renderer);
  orb.initGUI(gui);

  let modelReady = false;
  const model = loadModelExport(core.scene, "/gltf/sci-fi_portal_gateway.glb", {
    position: orb.mesh.position.clone(),
    onLoaded: () => { modelReady = true; },
  });
  model.initGUI(gui);
  model.setOnEnter(() => {
    // Portal enter animation only — shield hits are handled by distance check in render loop
  });

  const grid = createGrid(core.scene, core.camera);
  grid.initGUI(gui);
  gridRef = grid;
  // Wire shield into grid for reflection glow
  grid.setUnitInfo(orb.mesh.position, orb.mesh.material.uniforms.uColor.value);
  grid.setModelPos(model.group.position);
  grid.setSectionColor(new THREE.Color(PROJECTS[0].gridSettings.sectionColor));
  const gs0 = PROJECTS[0].gridSettings;
  grid.gridMat.uniforms.uCellSize.value = gs0.cellSize;
  grid.gridMat.uniforms.uSectionSize.value = gs0.sectionSize;
  grid.gridMat.uniforms.uFadeDistance.value = gs0.fadeDistance;
  grid.gridMat.uniforms.uReflIntensity.value = gs0.reflIntensity;
  grid.gridMat.uniforms.uEnvIntensity.value = gs0.envIntensity;
  grid.gridMat.uniforms.uTexScale.value = gs0.texScale;
  grid.gridMat.uniforms.uTexDistort.value = gs0.texDistort;
  grid.gridMat.uniforms.uShieldGlowIntensity.value = gs0.glow;
  grid.setLines(gs0.lines);
  syncGridEnv();

  // Animate Spot Scale (uFbmScale) linearly: 0.5 → 8 → 0.5 repeating
  const spotTween = { v: 0.5 };
  gsap.timeline({ repeat: -1 })
    .to(spotTween, { v: 8, duration: 10, ease: "none", onUpdate: () => { grid.gridMat.uniforms.uFbmScale.value = spotTween.v; } })
    .to(spotTween, { v: 0.5, duration: 10, ease: "none", onUpdate: () => { grid.gridMat.uniforms.uFbmScale.value = spotTween.v; } });

  const projectSlider = createProjectSlider(core.scene, core.camera, core.renderer, orb.mesh, core.controls);
  projectSlider.addCircleControls(orb.guiFolder);
  projectSlider.addCopyControls(orb.guiFolder);
  projectSlider.setRaysGroup(orb.particleRays.group);

  const pagination = createSliderPagination(document.body, projectSlider, gui);
  pagination.wrapper.style.display = "none";

  statsCounter = null;
  if (!isMobile()) {
    statsCounter = createShieldCounter();
    statsCounter.update(PROJECTS[0].color, 0);
  }

  if (!isMobile()) {
    scrollCtrl = createScrollController(document.getElementById("articles-container"));
  }

  const _origSetScrollEnabled = projectSlider.setScrollEnabled.bind(projectSlider);
  projectSlider.setScrollEnabled = (v) => {
    _origSetScrollEnabled(v);
    if (scrollCtrl) {
      if (v) scrollCtrl.enable(); else scrollCtrl.disable();
    }
  };

  projectSlider.setOnUnitChange((idx) => {
    updateUI(idx);
    pagination.setActive(idx);
    const project = PROJECTS[idx];
    const m = projectSlider.allUnits[idx];

    if (statsCounter) statsCounter.update(project.color, idx);

    // Dynamic UI accent colors
    if (project.color) updateUIColors(project.color);

    // Set pending target for energy rays (scroll = delayed, click = immediate)
    if (orb.particleRays && m) {
      orb.particleRays.setPendingTarget(m, m.material);
    }

    // Animate env — fade for textures, color tween for live gradient
    if (envCfg.mode === "Gradient Textures" && gradientEnv && gradientEnv.setProject) {
      envFadeTargetIdx = idx;
      envFadeTargetEnvMapIntensity = project.envMapIntensity !== undefined ? project.envMapIntensity : 0.5;
      if (!envFadeActive) {
        envFadeActive = true;
        const portalEnvOut = { intensity: model.getConfig().envMapIntensity };
        gsap.to(portalEnvOut, {
          intensity: 0,
          duration: 0.3,
          ease: "power2.in",
          onUpdate: () => { model.applyEnvMap(portalEnvOut.intensity); },
        });
        gsap.to(core.scene, {
          backgroundIntensity: 0,
          duration: 0.6,
          ease: "power2.in",
          onComplete: () => {
            gradientEnv.setProject(envFadeTargetIdx);
            core.scene.environmentIntensity = 0;
            model.applyEnvMap(0);
            syncGridEnv();
            const portalEnvIn = { intensity: 0 };
            gsap.to(portalEnvIn, {
              intensity: envFadeTargetEnvMapIntensity,
              duration: 0.6,
              ease: "power2.out",
              onUpdate: () => { model.applyEnvMap(portalEnvIn.intensity); },
            });
            gsap.to(core.scene, {
              backgroundIntensity: 1,
              environmentIntensity: 1,
              duration: 0.3,
              ease: "power2.out",
              onComplete: () => { envFadeActive = false; },
            });
          },
        });
      }
      envCfg.colorTop = project.env?.colorTop || envCfg.colorTop;
      envCfg.colorMid = project.env?.colorMid || envCfg.colorMid;
      envCfg.colorBottom = project.env?.colorBottom || envCfg.colorBottom;
    } else if (envCfg.mode === "Live Gradient" && gradientEnv && gradientEnv.update && project.env) {
      const envTween = { colorTop: envCfg.colorTop, colorMid: envCfg.colorMid, colorBottom: envCfg.colorBottom };
      gsap.to(envTween, {
        colorTop: project.env.colorTop,
        colorMid: project.env.colorMid,
        colorBottom: project.env.colorBottom,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: () => {
          gradientEnv.update({ colorTop: envTween.colorTop, colorMid: envTween.colorMid, colorBottom: envTween.colorBottom });
        },
        onComplete: () => {
          model.applyEnvMap(project.envMapIntensity !== undefined ? project.envMapIntensity : 0.5);
        },
      });
      envCfg.colorTop = project.env.colorTop;
      envCfg.colorMid = project.env.colorMid;
      envCfg.colorBottom = project.env.colorBottom;
    }

    // Grid — animate all settings from project.gridSettings
    const gs = project.gridSettings;
    gsap.to(grid.gridMat.uniforms.uCellSize, { value: gs.cellSize, duration: 1.5, ease: "power2.inOut" });
    gsap.to(grid.gridMat.uniforms.uSectionSize, { value: gs.sectionSize, duration: 1.5, ease: "power2.inOut" });
    gsap.to(grid.gridMat.uniforms.uFadeDistance, { value: gs.fadeDistance, duration: 1.5, ease: "power2.inOut" });
    gsap.to(grid.gridMat.uniforms.uReflIntensity, { value: gs.reflIntensity, duration: 1.5, ease: "power2.inOut" });
    gsap.to(grid.gridMat.uniforms.uEnvIntensity, { value: gs.envIntensity, duration: 1.5, ease: "power2.inOut" });
    gsap.to(grid.gridMat.uniforms.uTexScale, { value: gs.texScale, duration: 1.5, ease: "power2.inOut" });
    gsap.to(grid.gridMat.uniforms.uTexDistort, { value: gs.texDistort, duration: 1.5, ease: "power2.inOut" });
    gsap.to(grid.gridMat.uniforms.uShieldGlowIntensity, { value: gs.glow, duration: 1.5, ease: "power2.inOut" });
    grid.setLines(gs.lines);
    const targetColor = new THREE.Color(gs.sectionColor);
    gsap.to(grid.gridMat.uniforms.uSectionColor.value, { r: targetColor.r, g: targetColor.g, b: targetColor.b, duration: 1.5, ease: "power2.inOut" });

    // Shield info + portal
    if (m && m.material && m.material.uniforms) {
      const color = m.material.uniforms.uColor.value;
      grid.setUnitInfo(m.position, color, gs.glow);
      model.update(color);
    }

    // Rect light custom color per project
    model.setRectLightColor(project.rectlightColor || project.color);

    // Portal bloom dynamic colors — per-project
    model.bloomCfg.dynamic = project.bloomDynamic !== undefined ? project.bloomDynamic : true;
    model.bloomCfg.primaryColor = project.bloomPrimary || project.color;
    model.bloomCfg.secondaryColor = project.bloomSecondary || project.color;
    model.bloomCfg.intensityPrimary = project.bloomIntensityPrimary || 1;
    model.bloomCfg.intensitySecondary = project.bloomIntensitySecondary || 1;
    if (model.bloomCfg.dynamic) {
      model.setBloomColors(model.bloomCfg.primaryColor, model.bloomCfg.secondaryColor, model.bloomCfg.intensityPrimary, model.bloomCfg.intensitySecondary);
    }
  });
  // Sync main shield flow params to copies at init
  projectSlider.syncMaterialsFrom(orb.mesh.material);

  // Hide energy rays during intro, show on first scroll
  if (orb.particleRays) {
    orb.particleRays.setVisible(false);
  }

  // Landing orchestrates intro → browse
  const landing = createLanding(core.camera, core.controls, projectSlider, model, grid);
  landing.setOnStateChange((state) => {
    if (state === "browse") {
      // Show intro-delayed UI
      document.getElementById('bg-abstract1').style.display = 'block';
      pagination.wrapper.style.display = "";
      // document.getElementById('bg-abstract2').style.display = 'block';
      if (statsCounter) statsCounter.container.style.display = 'block';
      if (orb.particleRays) {
        orb.particleRays.setVisible(true);
        // Sync to the active shield on first show
        const activeIdx = projectSlider.getActiveIndex();
        const activeShield = projectSlider.allUnits[activeIdx];
        if (activeShield) {
          orb.particleRays.setTarget(activeShield, activeShield.material);
        }
      }
    }
  });
  if (modelReady) {
    finishLoader();
    landing.start();
  } else {
    model.setOnLoaded(() => { finishLoader(); landing.start(); });
    // Fallback: start intro after 5s even if GLTF fails
    setTimeout(() => { if (!modelReady) { modelReady = true; finishLoader(); landing.start(); } }, 5000);
  }

  // Energy rays: commit pending target when scroll animation completes
  projectSlider.setOnScrollComplete(() => {
    if (orb.particleRays) orb.particleRays.commitPendingTarget();
  });

  // Free Controls checkbox (disables scroll cycling)
  const freeCfg = { freeControls: false };
  camFolder.add(freeCfg, "freeControls").name("Free Controls").onChange((v) => {
    projectSlider.setScrollEnabled(!v);
  });

  // Camera perspective controls
  const perspCfg = {
    fov: core.camera.fov,
    near: core.camera.near,
    far: core.camera.far,
    minDist: core.controls.minDistance,
    maxDist: core.controls.maxDistance,
  };
  const perspFolder = camFolder.addFolder("Perspective");
  perspFolder.add(perspCfg, "fov", 10, 120, 1).onChange((v) => { core.camera.fov = v; core.camera.updateProjectionMatrix(); });
  perspFolder.add(perspCfg, "near", 0.01, 10, 0.01).onChange((v) => { core.camera.near = v; core.camera.updateProjectionMatrix(); });
  perspFolder.add(perspCfg, "far", 10, 2000, 10).onChange((v) => { core.camera.far = v; core.camera.updateProjectionMatrix(); });
  perspFolder.add(perspCfg, "minDist", 0, 50, 0.5).name("Min Distance").onChange((v) => core.controls.minDistance = v);
  perspFolder.add(perspCfg, "maxDist", 10, 200, 5).name("Max Distance").onChange((v) => core.controls.maxDistance = v);

  // Timeline GUI for scroll animation sync
  const tlFolder = gui.addFolder("Timeline");
  tlFolder.close();
  const tl = projectSlider.timelineCfg;
  tlFolder.add(tl, "cameraDuration", 0.5, 5, 0.05);
  tlFolder.add(tl, "cameraDelay", 0, 2, 0.05);
  tlFolder.add(tl, "cameraSpeed", 0.1, 5, 0.1);
  tlFolder.add(tl, "slideDuration", 0.2, 3, 0.05);
  tlFolder.add(tl, "slideDelay", 0, 3, 0.05);
  tlFolder.add(tl, "slideSpeed", 0.1, 5, 0.1);

  // Copy params button
  const paramsFolder = gui.addFolder("Params");
  paramsFolder.close();
  const copyActions = {
    save: () => {
      const config = {
        environment: { mode: envCfg.mode, colorTop: envCfg.colorTop, colorMid: envCfg.colorMid, colorBottom: envCfg.colorBottom, range: envCfg.range, distortion: envCfg.distortion, blend: envCfg.blend },
        camera: { autoRotate: camCfg.autoRotate, autoRotateSpeed: camCfg.autoRotateSpeed, mouseEnabled: mouseCfg.enabled, mouseStrength: mouseCfg.strength },
        bloom: postfx.getConfig(),
        shield: orb.getConfig(),
        grid: grid.getConfig(),
        portal: model.getConfig(),
        shieldCopies: projectSlider.getConfig(),
      };
      const json = JSON.stringify(config, null, 2);
      navigator.clipboard.writeText(json).then(
        () => console.log("Config copied to clipboard"),
        () => { console.log("=== CONFIG ===\n" + json); }
      );
    }
  };
  paramsFolder.add(copyActions, "save");

  // Resize bloom composer on window resize
  window.addEventListener("resize", () => {
    postfx.resize(window.innerWidth, window.innerHeight);
  });

  // Animation loop
  let prev = performance.now();
  let fpsSmooth = 60;
  let cpuSmooth = 0;
  let statsTimer = 0;
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const time = (now - prev) / 1000;
    prev = now;

    const cpuNow = performance.now();
    orb.update(time);
    projectSlider.update(time);
    model.update(null, time);
    realism.update(time);
    const cpuDelta = performance.now() - cpuNow;

    cpuSmooth += (cpuDelta - cpuSmooth) * 0.1;
    fpsSmooth += (1 / Math.max(time, 0.001) - fpsSmooth) * 0.1;

    statsTimer += time;
    if (statsCounter && statsTimer > 0.25) {
      statsTimer = 0;
      const gpuDelta = core.renderer.info.render.calls;
      statsCounter.setStats(
        cpuSmooth.toFixed(1),
        gpuDelta + ' drw',
        Math.round(fpsSmooth)
      );
    }
    if (statsCounter) statsCounter.tick(time);
    // Sync active shield color + glow to grid (colored emissive light on floor)
    const activeIdx = projectSlider.getActiveIndex();
    const activeShield = projectSlider.allUnits[activeIdx];
    if (activeShield && activeShield.material && activeShield.material.uniforms) {
      grid.setUnitInfo(activeShield.position, activeShield.material.uniforms.uColor.value, activeShield.userData.glowIntensity || 1);
    }

    // Auto-trigger portal hits when ANY shield enters the portal zone (squared dist check)
    if (model.group) {
      const modelPos = model.group.position;
      const enterDistSq = 12.25; // 3.5 * 3.5
      for (const s of projectSlider.allUnits) {
        if (!s) continue;
        const dSq = s.position.distanceToSquared(modelPos);
        if (dSq < enterDistSq && !s.userData.modelEntered) {
          s.userData.modelEntered = true;
          orb.triggerHits(s, 3, 100);
          model.triggerEnter();
        }
        if (dSq >= enterDistSq) {
          s.userData.modelEntered = false;
        }
      }
    }
    core.controls.update();
    // Mouse parallax — bounded, subtract previous offset first
    if (mouseCfg.enabled) {
      core.camera.position.sub(_prevOff);
      core.controls.target.sub(_prevOff);
      const mag = mouseCfg.strength * 0.5;
      mouseOffset.x += (mouseTarget.x * mag - mouseOffset.x) * 0.15;
      mouseOffset.y += (mouseTarget.y * mag - mouseOffset.y) * 0.15;
      core.camera.getWorldDirection(_dir);
      _right.crossVectors(_dir, core.camera.up).normalize();
      _up.crossVectors(_right, _dir).normalize();
      _off.set(0, 0, 0).addScaledVector(_right, mouseOffset.x).addScaledVector(_up, mouseOffset.y);
      core.camera.position.add(_off);
      core.controls.target.add(_off);
      _prevOff.copy(_off);
    } else {
      _prevOff.set(0, 0, 0);
    }
    postfx.render();
  }
  animate();

  // Apply first project's env colors (no UI — intro handles that)
  const firstProject = PROJECTS[0];
  if (envCfg.mode === "Gradient Textures" && gradientEnv && gradientEnv.setProject) {
    gradientEnv.setProject(0);
    syncGridEnv();
  } else if (envCfg.mode === "Live Gradient" && gradientEnv && gradientEnv.update && firstProject.env) {
    gradientEnv.update(firstProject.env);
    envCfg.colorTop = firstProject.env.colorTop;
    envCfg.colorMid = firstProject.env.colorMid;
    envCfg.colorBottom = firstProject.env.colorBottom;
    syncGridEnv();
  }
}

initEnvironment();
