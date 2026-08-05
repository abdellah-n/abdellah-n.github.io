import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { isMobile } from "./mobile.js";

// ═══════════════════════════════════════════════════════════
// Tier 1 realism effects — cheap GPU-driven, all toggleable
//  1. Dust motes (THREE.Points, additive, GPU drift)
//  2. Chromatic Aberration (smoke-driven fullscreen pass)
// ═══════════════════════════════════════════════════════════

// ── Soft round sprite for dust ──────────────────────────────
function createDustSprite() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0.12)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

const DUST_VERTEX = `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uScale;
  attribute vec3 aSeed;
  varying float vTwinkle;
  void main() {
    vec3 p = position * uScale;
    float t = uTime;
    float ph = aSeed.x;
    float sp = aSeed.y;

    float ang = t * (0.04 + sp * 0.05) + ph * 0.7;
    float ca = cos(ang);
    float sa = sin(ang);
    float x = p.x, z = p.z;
    p.x = ca * x - sa * z;
    p.z = sa * x + ca * z;

    p.x += sin(t * sp + ph) * 0.6;
    p.y += cos(t * sp * 0.8 + ph * 2.0) * 0.5 + sin(t * sp * 0.25 + ph * 3.0) * 1.6;
    p.z += sin(t * sp * 0.6 + ph * 3.0) * 0.6;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aSeed.z * uPixelRatio / -mv.z;
    vTwinkle = 0.55 + 0.45 * sin(t * (0.8 + sp * 0.4) + ph * 6.2831);
  }
`;

const DUST_FRAGMENT = `
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying float vTwinkle;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    float a = tex.a * vTwinkle * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(0.9, 0.95, 1.0, a);
  }
`;

function createDust(scene) {
  const count = 90;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const cx = 0.5, cy = 2.0, cz = 0.0;
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = cx + (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = cy + (Math.random() - 0.5) * 40;
    positions[i * 3 + 2] = cz + (Math.random() - 0.5) * 60;
    seeds[i * 3 + 0] = Math.random() * Math.PI * 2;
    seeds[i * 3 + 1] = 0.15 + Math.random() * 0.35;
    seeds[i * 3 + 2] = 0.5 + Math.random() * 1.2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 30 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uMap: { value: createDustSprite() },
      uOpacity: { value: 1.0 },
      uScale: { value: 0.3 },
    },
    vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = !isMobile();
  scene.add(points);

  return {
    update(time) {
      if (points.visible) mat.uniforms.uTime.value += time;
    },
    setVisible(v) {
      points.visible = v;
    },
    setOpacity(v) {
      mat.uniforms.uOpacity.value = v;
    },
    setVolumeScale(v) {
      mat.uniforms.uScale.value = v;
    },
    isVisible() {
      return points.visible;
    },
  };
}

// ── Procedural smoke texture (fbm value noise, repeating, 128x128 bilinear) ──
function createSmokeTexture(size = 128) {
  const N = 32;
  const lattice = new Float32Array(N * N);
  for (let i = 0; i < lattice.length; i++) lattice[i] = Math.random();

  const at = (ix, iy) => lattice[((iy % N + N) % N) * N + ((ix % N + N) % N)];
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function valueNoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const v00 = at(x0, y0), v10 = at(x0 + 1, y0);
    const v01 = at(x0, y0 + 1), v11 = at(x0 + 1, y0 + 1);
    return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
  }
  function fbm(x, y) {
    let sum = 0, amp = 1, f = 1, norm = 0;
    for (let o = 0; o < 3; o++) {
      sum += valueNoise(x * f, y * f) * amp;
      norm += amp;
      amp *= 0.55;
      f *= 2.1;
    }
    return sum / norm;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const r = fbm(u * 4, v * 4);
      const g = fbm(u * 4 + 0.31, v * 4 + 0.17);
      const b = fbm(u * 4 + 0.47, v * 4 + 0.53);
      const i = (y * size + x) * 4;
      d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

const SMOKE_TEXTURE = createSmokeTexture();

// ── Chromatic Aberration Shader (smoke distortion) ──
const CAShader = {
  uniforms: {
    tDiffuse: { value: null },
    uNoise: { value: null },
    uTime: { value: 0 },
    uCAStrength: { value: 0.0025 },
    uCAScale: { value: 4.0 },
    uCASpeed: { value: 0.5 },
    uCADebug: { value: 0.0 },
    uCAEnabled: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D uNoise;
    uniform float uTime;
    uniform float uCAStrength;
    uniform float uCAScale;
    uniform float uCASpeed;
    uniform float uCADebug;
    uniform float uCAEnabled;

    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec4 color;

      if (uCAEnabled > 0.5) {
        float t = uTime * uCASpeed;
        float smoke = texture2D(uNoise, uv * uCAScale + vec2(0.0, t)).r;
        smoke = clamp((smoke - 0.5) * 2.5 + 0.5, 0.0, 1.0);

        if (uCADebug > 0.5) {
          gl_FragColor = vec4(vec3(smoke), 1.0);
          return;
        }

        float amount = smoke * uCAStrength;
        if (amount > 0.00001) {
          vec2 up = vec2(0.0, amount);
          color.r = texture2D(tDiffuse, clamp(uv + up, 0.0, 1.0)).r;
          color.g = texture2D(tDiffuse, uv).g;
          color.b = texture2D(tDiffuse, clamp(uv - up, 0.0, 1.0)).b;
          color.a = texture2D(tDiffuse, uv).a;
        } else {
          color = texture2D(tDiffuse, uv);
        }
      } else {
        color = texture2D(tDiffuse, uv);
      }

      gl_FragColor = color;
    }
  `,
};

function insertBefore(composer, pass, Type) {
  const idx = composer.passes.findIndex((p) => p instanceof Type);
  if (idx === -1) {
    composer.addPass(pass);
  } else {
    composer.passes.splice(idx, 0, pass);
  }
}

export function createRealismEffects(scene, composer, gui) {
  const dust = createDust(scene);

  const caPass = new ShaderPass(CAShader);
  caPass.material.uniforms.uNoise.value = SMOKE_TEXTURE;
  caPass.enabled = !isMobile();

  insertBefore(composer, caPass, OutputPass);

  // ── GUI: Realism Effects ──
  const f = gui.addFolder("Realism Effects");
  f.close();
  const u = caPass.material.uniforms;
  const cfg = {
    dust: dust.isVisible(),
    ca: u.uCAEnabled.value > 0.5,
    dustOpacity: 1.0,
    dustVolumeScale: 0.3,
    caStrength: u.uCAStrength.value,
    caSpeed: u.uCASpeed.value,
    caScale: u.uCAScale.value,
    caDebug: false,
  };
  f.add(cfg, "dust").name("Dust Motes").onChange((v) => dust.setVisible(v));
  f.add(cfg, "ca").name("Chromatic Aberration").onChange((v) => { u.uCAEnabled.value = v ? 1 : 0; });
  f.add(cfg, "dustOpacity", 0, 1, 0.01).name("Dust Opacity").onChange((v) => { dust.setOpacity(v); });
  f.add(cfg, "dustVolumeScale", 0.2, 5, 0.1).name("Dust Volume").onChange((v) => { dust.setVolumeScale(v); });
  f.add(cfg, "caStrength", 0, 0.0025, 0.00005).name("CA Strength").onChange((v) => { u.uCAStrength.value = v; });
  f.add(cfg, "caSpeed", 0, 2, 0.01).name("CA Speed").onChange((v) => { u.uCASpeed.value = v; });
  f.add(cfg, "caScale", 0.5, 8, 0.1).name("CA Scale").onChange((v) => { u.uCAScale.value = v; });
  f.add(cfg, "caDebug").name("Show Smoke Texture").onChange((v) => { u.uCADebug.value = v ? 1 : 0; });

  return {
    update(time) {
      dust.update(time);
      if (caPass.enabled) {
        u.uTime.value += time;
      }
    },
  };
}
