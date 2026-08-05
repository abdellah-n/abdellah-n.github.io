import * as THREE from "three";
import gsap from "gsap";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
RectAreaLightUniformsLib.init();


const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/libs/draco/");

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const MODELS = {
  "sci-fi_portal_gateway.glb": {
    label: "Gateway (GLB)",
    url: "/gltf/sci-fi_portal_gateway.glb",
    hasAnimations: false,
  },
  "portal_sci-fi/scene.gltf": {
    label: "Sci-Fi Gate (GLTF)",
    url: "/gltf/portal_sci-fi/scene.gltf",
    hasAnimations: true,
  },
};

export function loadModelExport(scene, url, opts = {}) {
  const position = opts.position || new THREE.Vector3(0.5, 2, 0);
  const onLoaded = opts.onLoaded || null;
  const _scene = scene;

  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);

  const cfg = {
    model: "portal_sci-fi/scene.gltf",
    scaleX: 1, scaleY: 1, scaleZ: 1,
    offsetX: 0.5, offsetY: -2.3, offsetZ: 0,
    rotY: 3.14,
    lightIntensity: 2,
    lightColor: "#ff5c5c",
    lightDistance: 30,
    envMapIntensity: 0.5,
    rectLightIntensity: 1.5,
    rectLightColor: "#ff5c5c",
    rectLightPosX: -5, rectLightPosY: 15, rectLightPosZ: 0,
    rectLightTargetX: 0.5, rectLightTargetY: 2, rectLightTargetZ: 0,
    rectLightWidth: 20, rectLightHeight: 20,
    visible: true,
    animSpeed: 1,
    animPlay: false,
    animMaxDuration: 4,
  };

  const light = new THREE.PointLight(new THREE.Color(cfg.lightColor), cfg.lightIntensity, cfg.lightDistance);
  light.castShadow = false;
  group.add(light);

  const light2 = new THREE.PointLight(new THREE.Color(cfg.lightColor), cfg.lightIntensity * 0.5, cfg.lightDistance * 1.5);
  group.add(light2);

  const rectlight = new THREE.RectAreaLight(new THREE.Color(cfg.rectLightColor), cfg.rectLightIntensity, cfg.rectLightWidth, cfg.rectLightHeight);
  rectlight.position.set(cfg.rectLightPosX, cfg.rectLightPosY, cfg.rectLightPosZ);
  rectlight.lookAt(cfg.rectLightTargetX, cfg.rectLightTargetY, cfg.rectLightTargetZ);
  rectlight.castShadow = false;
  group.add(rectlight);

  function applyRectLightTransform() {
    rectlight.position.set(cfg.rectLightPosX, cfg.rectLightPosY, cfg.rectLightPosZ);
    rectlight.lookAt(cfg.rectLightTargetX, cfg.rectLightTargetY, cfg.rectLightTargetZ);
    rectlight.width = cfg.rectLightWidth;
    rectlight.height = cfg.rectLightHeight;
  }

  let model = null;
  let mixer = null;
  let animations = [];
  let actions = [];
  let currentTime = 0;
  let bloomMeshes = [];
  let bloomOriginalColors = [];
  const bloomCfg = { dynamic: true, primaryColor: "#ff5c5c", secondaryColor: "#ff8800", intensityPrimary: 1, intensitySecondary: 1, grayBrightness: 0.8, grayContrast: 2.95 };
  let bloomOriginalTextures = [];

  function toGrayscale(texture, brightness, contrast) {
    if (!texture || !texture.image) return texture;
    const b = brightness || 1;
    const c = contrast || 1;
    const img = texture.image;
    const w = img.width || img.naturalWidth || 512;
    const h = img.height || img.naturalHeight || 512;

    // Try canvas drawImage first (works for PNG/JPEG)
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    let imageData = null;
    try {
      ctx.drawImage(img, 0, 0, w, h);
      imageData = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      // drawImage failed (WebP/ImageBitmap) — skip grayscale
      return texture;
    }
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      let gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      gray = ((gray / 255 - 0.5) * c + 0.5) * 255 * b;
      gray = Math.max(0, Math.min(255, gray));
      d[i] = d[i + 1] = d[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);
    const newTex = new THREE.CanvasTexture(canvas);
    newTex.wrapS = texture.wrapS;
    newTex.wrapT = texture.wrapT;
    newTex.repeat.copy(texture.repeat);
    return newTex;
  }

  const clonedMeshes = new Set();

  function applyEnvMap(value) {
    cfg.envMapIntensity = value;
    if (!model) return;
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        if ("envMap" in child.material) child.material.envMap = _scene.environment;
        if ("envMapIntensity" in child.material) child.material.envMapIntensity = value;
        child.material.needsUpdate = true;
      }
    });
  }

  function applyGrayscale() {
    bloomMeshes.forEach((m, i) => {
      if (!m.material || !bloomOriginalTextures[i]) return;
      if (m.name !== "Gsf_mat2-001_low001_Material_mat2_0" && m.name !== "Gsf_mat2-027_low001_Material_mat2_0") return;
      if (!clonedMeshes.has(m)) {
        m.material = m.material.clone();
        clonedMeshes.add(m);
      }
      m.material.emissiveMap = toGrayscale(bloomOriginalTextures[i], bloomCfg.grayBrightness, bloomCfg.grayContrast);
      m.material.needsUpdate = true;
    });
  }

  function loadModel(modelKey) {
    const modelInfo = MODELS[modelKey];
    if (!modelInfo) return;

    if (model) {
      group.remove(model);
      model.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
      model = null;
    }

    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }
    animations = [];
    actions = [];

    gltfLoader.load(modelInfo.url, (gltf) => {
      model = gltf.scene;
      animations = gltf.animations;

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = true;
          _portalMeshes.push(child);
          if (child.material && "envMapIntensity" in child.material) {
            child.material.envMapIntensity = cfg.envMapIntensity;
          }
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of mats) {
            if (!mat) continue;
            mat.transparent = false;
            mat.depthWrite = true;
          }
          const matName = child.material?.name || "";
          if (matName.includes("Material_mat2") || matName.includes("Material_mat1")) {
            bloomMeshes.push(child);
            bloomOriginalColors.push(child.material.emissive.clone());
            bloomOriginalTextures.push(child.material.emissiveMap);
            if (child.material.emissiveMap && (child.name === "Gsf_mat2-001_low001_Material_mat2_0" || child.name === "Gsf_mat2-027_low001_Material_mat2_0")) {
              // child.material = child.material.clone();
              // clonedMeshes.add(child);
              child.material.emissiveMap = toGrayscale(bloomOriginalTextures[bloomOriginalTextures.length - 1], bloomCfg.grayBrightness, bloomCfg.grayContrast);
              child.material.needsUpdate = true;
            }
          }
        }
      });

      applyEnvMap(cfg.envMapIntensity);

      if (animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        animations.forEach((clip) => {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = true;
          if (cfg.animPlay) action.play();
          actions.push(action);
        });
        mixer.timeScale = cfg.animSpeed;
      }

      group.add(model);
      applyTransform();
      _applyDissolve(cfg.visible ? 1 : 0);
      if (onLoaded) onLoaded();
      if (onLoadedCb) onLoadedCb();
    }, undefined, (err) => {
      console.error("Failed to load portal model:", err);
    });
  }

  let onEnterCb = null;
  let onLoadedCb = null;
  let animTimer = null;
  let _mixerActive = false;

  function triggerEnter() {
    if (onEnterCb) onEnterCb();
    if (mixer && actions.length > 0) {
      _mixerActive = true;
      actions.forEach((a) => {
        a.reset();
        a.play();
      });
      if (animTimer) clearTimeout(animTimer);
      animTimer = setTimeout(() => {
        actions.forEach((a) => a.stop());
        _mixerActive = false;
        animTimer = null;
      }, cfg.animMaxDuration * 1000);
    }
  }

  let _portalMeshes = [];
  let _fadeTween = null;
  let _dissolveValue = 0;

  function _applyDissolve(value) {
    _dissolveValue = value;
    const invisible = value <= 0;
    const done = value >= 1;
    group.visible = !invisible;
    for (const m of _portalMeshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!mat) continue;
        if (invisible) {
          mat.transparent = true;
          mat.opacity = 0;
        } else if (done) {
          mat.transparent = false;
          mat.opacity = 1.0;
          mat.depthWrite = true;
        } else {
          mat.transparent = true;
          mat.opacity = value;
          mat.depthWrite = true;
        }
      }
    }
    light.intensity = value * cfg.lightIntensity;
    light2.intensity = value * cfg.lightIntensity * 0.5;
    rectlight.intensity = value * cfg.rectLightIntensity;
  }

  function setVisible(v, duration) {
    cfg.visible = v;
    if (_fadeTween) { _fadeTween.kill(); _fadeTween = null; }
    const target = v ? 1 : 0;
    if (_dissolveValue === target || duration === 0) {
      _dissolveValue = target;
      _applyDissolve(target);
      return;
    }
    const dur = duration !== undefined ? duration : 0.8;
    const tween = { value: _dissolveValue };
    _fadeTween = gsap.to(tween, {
      value: target,
      duration: dur,
      ease: "power2.inOut",
      onUpdate: () => _applyDissolve(tween.value),
      onComplete: () => { _fadeTween = null; _applyDissolve(target); },
    });
  }

  function applyTransform() {
    group.scale.set(cfg.scaleX, cfg.scaleY, cfg.scaleZ);
    group.position.set(
      position.x + cfg.offsetX,
      position.y + cfg.offsetY,
      position.z + cfg.offsetZ
    );
    group.rotation.y = cfg.rotY;
  }

  function initGUI(gui) {
    const f = gui.addFolder("Model");
    f.close();

    const modelNames = Object.keys(MODELS);
    f.add(cfg, "model", modelNames).name("Model").onChange((v) => loadModel(v));

    f.add(cfg, "visible").name("Visible").onChange((v) => setVisible(v));
    f.add(cfg, "scaleX", 0.1, 10, 0.05).name("Scale X").onChange(applyTransform);
    f.add(cfg, "scaleY", 0.1, 10, 0.05).name("Scale Y").onChange(applyTransform);
    f.add(cfg, "scaleZ", 0.1, 10, 0.05).name("Scale Z").onChange(applyTransform);
    f.add(cfg, "offsetX", -10, 10, 0.1).name("Offset X").onChange(applyTransform);
    f.add(cfg, "offsetY", -10, 10, 0.1).name("Offset Y").onChange(applyTransform);
    f.add(cfg, "offsetZ", -10, 10, 0.1).name("Offset Z").onChange(applyTransform);
    f.add(cfg, "rotY", 0, Math.PI * 2, 0.01).name("Rotation Y").onChange(applyTransform);

    const lightFolder = f.addFolder("Lights");
    lightFolder.close();
    lightFolder.add(cfg, "lightIntensity", 0, 50, 0.5).name("Intensity").onChange((v) => {
      light.intensity = v;
      light2.intensity = v * 0.5;
      light2.intensity = (v);
    });
    lightFolder.addColor(cfg, "lightColor").name("Color").onChange((v) => {
      light.color.set(v);
      light2.color.set(v);
    });
    lightFolder.add(cfg, "lightDistance", 1, 100, 0.5).name("Distance").onChange((v) => {
      light.distance = v;
      light2.distance = v * 1.5;
    });
    lightFolder.add(cfg, "rectLightIntensity", 0, 50, 0.5).name("Rect Intensity").onChange((v) => {
      rectlight.intensity = v;
    });
    lightFolder.addColor(cfg, "rectLightColor").name("Rect Color").onChange((v) => {
      rectlight.color.set(v);
    });
    lightFolder.add(cfg, "envMapIntensity", 0, 5, 0.05).name("Env Intensity").onChange((v) => {
      applyEnvMap(v);
    });

    const animFolder = f.addFolder("Animation");
    animFolder.close();
    animFolder.add(cfg, "animPlay").name("Play").onChange((v) => {
      if (!mixer) return;
      if (v) {
        actions.forEach((a) => { a.reset(); a.play(); });
        if (animTimer) clearTimeout(animTimer);
        animTimer = setTimeout(() => {
          actions.forEach((a) => a.stop());
          cfg.animPlay = false;
          animTimer = null;
        }, cfg.animMaxDuration * 1000);
      } else {
        actions.forEach((a) => a.stop());
        if (animTimer) { clearTimeout(animTimer); animTimer = null; }
      }
    });
    animFolder.add(cfg, "animSpeed", 0, 5, 0.05).name("Speed").onChange((v) => {
      if (mixer) mixer.timeScale = v;
    });
    animFolder.add(cfg, "animMaxDuration", 1, 10, 0.5).name("Max Duration (s)");

    const bloomFolder = f.addFolder("Bloom Colors");
    bloomFolder.close();
    bloomFolder.add(bloomCfg, "dynamic").name("Dynamic Colors").onChange((v) => {
      if (!v) restoreBloomColors();
    });
    bloomFolder.addColor(bloomCfg, "primaryColor").name("Primary (Frame)").onChange(() => {
      if (bloomCfg.dynamic) setBloomColors(bloomCfg.primaryColor, bloomCfg.secondaryColor, bloomCfg.intensityPrimary, bloomCfg.intensitySecondary);
    });
    bloomFolder.addColor(bloomCfg, "secondaryColor").name("Secondary (Detail)").onChange(() => {
      if (bloomCfg.dynamic) setBloomColors(bloomCfg.primaryColor, bloomCfg.secondaryColor, bloomCfg.intensityPrimary, bloomCfg.intensitySecondary);
    });
    bloomFolder.add(bloomCfg, "intensityPrimary", 0.5, 5, 0.1).name("Intensity Primary").onChange(() => {
      if (bloomCfg.dynamic) setBloomColors(bloomCfg.primaryColor, bloomCfg.secondaryColor, bloomCfg.intensityPrimary, bloomCfg.intensitySecondary);
    });
    bloomFolder.add(bloomCfg, "intensitySecondary", 0.5, 5, 0.1).name("Intensity Secondary").onChange(() => {
      if (bloomCfg.dynamic) setBloomColors(bloomCfg.primaryColor, bloomCfg.secondaryColor, bloomCfg.intensityPrimary, bloomCfg.intensitySecondary);
    });
    bloomFolder.add(bloomCfg, "grayBrightness", 0.2, 3, 0.05).name("Gray Brightness").onChange(() => {
      applyGrayscale();
      if (bloomCfg.dynamic) setBloomColors(bloomCfg.primaryColor, bloomCfg.secondaryColor, bloomCfg.intensityPrimary, bloomCfg.intensitySecondary);
    });
    bloomFolder.add(bloomCfg, "grayContrast", 0.2, 3, 0.05).name("Gray Contrast").onChange(() => {
      applyGrayscale();
      if (bloomCfg.dynamic) setBloomColors(bloomCfg.primaryColor, bloomCfg.secondaryColor, bloomCfg.intensityPrimary, bloomCfg.intensitySecondary);
    });

    f.add({ enter: triggerEnter }, "enter").name("Play");
  }

  function update(color, delta) {
    if (color) {
      light.color.set(color);
      light2.color.set(color);
      rectlight.color.set(cfg.rectLightColor);
      cfg.lightColor = "#" + light.color.getHexString();
    }

    if (mixer && _mixerActive) {
      mixer.update(delta);
    }
  }

  function setRectLightColor(color) {
    if (!color) return;
    cfg.rectLightColor = color;
    rectlight.color.set(color);
  }

  function setBloomColors(primary, secondary, intensityPrimary, intensitySecondary) {
    if (!bloomCfg.dynamic) return;
    const c1 = new THREE.Color(primary).multiplyScalar(intensityPrimary || 1);
    const c2 = new THREE.Color(secondary).multiplyScalar(intensitySecondary || 1);
    bloomMeshes.forEach((m) => {
      if (!m.material) return;
      const n = m.material.name || "";
      if (n.includes("Material_mat2")) {
        m.material.emissive.copy(c1);
      } else if (n.includes("Material_mat1")) {
        m.material.emissive.copy(c2);
      }
    });
  }

  function restoreBloomColors() {
    bloomMeshes.forEach((m, i) => {
      if (m.material) m.material.emissive.copy(bloomOriginalColors[i]);
    });
  }

  function getConfig() {
    return { ...cfg };
  }

  function dispose() {
    scene.remove(group);
    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }
    if (model) {
      model.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    }
    light.dispose();
    light2.dispose();
    rectlight.dispose();
    dracoLoader.dispose();
  }

  loadModel(cfg.model);
  applyTransform();

  return {
    group, model: () => model, light, light2, rectlight, initGUI, getConfig, update, dispose,
    triggerEnter, setOnEnter: (cb) => { onEnterCb = cb; },
    setOnLoaded: (cb) => { onLoadedCb = cb; },
    setBloomColors, restoreBloomColors, bloomCfg, applyEnvMap, setVisible,
    setRectLightColor, applyRectLightTransform,
  };
}
