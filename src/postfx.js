import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export function createPostFX(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.floor(window.innerWidth / 2.5), Math.floor(window.innerHeight / 2.5)),
    0.2, 0.49, 0.47
  );
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  function initGUI(gui) {
    const f = gui.addFolder("Bloom");
    f.close();
    const cfg = { intensity: 0.2, threshold: 0.47, radius: 0.49 };
    f.add(cfg, "intensity", 0, 5, 0.05).onChange((v) => bloomPass.strength = v);
    f.add(cfg, "threshold", 0, 1, 0.01).onChange((v) => bloomPass.threshold = v);
    f.add(cfg, "radius", 0, 2, 0.01).onChange((v) => bloomPass.radius = v);
  }

  function render() {
    composer.render();
  }

  function renderToTarget(cameraOverride) {
    if (cameraOverride) {
      composer.passes[0].camera = cameraOverride;
    }
    const savedRTS = composer.renderToScreen;
    composer.renderToScreen = false;
    composer.render();
    composer.renderToScreen = savedRTS;
    if (cameraOverride) {
      composer.passes[0].camera = camera;
    }
    return composer.readBuffer;
  }

  function resize(w, h) {
    bloomPass.setSize(Math.floor(w / 2.5), Math.floor(h / 2.5));
    composer.setSize(w, h);
  }

  return { initGUI, render, renderToTarget, resize, composer, getConfig: () => ({
    bloomIntensity: bloomPass.strength,
    bloomThreshold: bloomPass.threshold,
    bloomRadius: bloomPass.radius,
  }) };
}
