import * as THREE from "three";

const GRADIENT_VERTEX_SHADER = `
varying vec3 vWorldPosition;
varying vec3 vNormal;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const GRADIENT_FRAGMENT_SHADER = `
uniform vec3 uColorTop;
uniform vec3 uColorMid;
uniform vec3 uColorBottom;
uniform float uRange;
uniform float uDistortion;
uniform float uBlend;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vec3 dir = normalize(vWorldPosition);
  float y = dir.y * 0.5 + 0.5;

  float n1 = sin(dir.x * 3.0 + dir.z * 2.0) * 0.5
           + sin(dir.y * 4.0 - dir.x * 1.5) * 0.3
           + sin(dir.z * 2.5 + dir.y * 3.0) * 0.2;
  float n2 = sin(dir.x * 6.0 - dir.z * 4.0) * 0.3
           + sin(dir.y * 5.0 + dir.z * 3.0) * 0.2
           + cos(dir.x * 3.0 + dir.y * 2.0) * 0.15;
  float distorted = y + (n1 + n2 * 0.5) * uDistortion;

  float edge = uRange * 0.01;
  float b = uBlend * 0.01;

  float t1 = smoothstep(edge - b, edge + b, distorted);
  float t2 = smoothstep(edge + 0.5 - b, edge + 0.5 + b, distorted);

  vec3 col = mix(uColorBottom, uColorMid, t1);
  col = mix(col, uColorTop, t2);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function preRenderGradientTextures(renderer, projects, defaults) {
  const geometry = new THREE.SphereGeometry(50, 64, 64);
  const material = new THREE.ShaderMaterial({
    vertexShader: GRADIENT_VERTEX_SHADER,
    fragmentShader: GRADIENT_FRAGMENT_SHADER,
    uniforms: {
      uColorTop: { value: new THREE.Color() },
      uColorMid: { value: new THREE.Color() },
      uColorBottom: { value: new THREE.Color() },
      uRange: { value: defaults.range },
      uDistortion: { value: defaults.distortion },
      uBlend: { value: defaults.blend },
    },
    side: THREE.BackSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const tmpScene = new THREE.Scene();
  tmpScene.add(mesh);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const textures = [];
  for (const project of projects) {
    const env = project.env || {};
    material.uniforms.uColorTop.value.set(env.colorTop || defaults.colorTop);
    material.uniforms.uColorMid.value.set(env.colorMid || defaults.colorMid);
    material.uniforms.uColorBottom.value.set(env.colorBottom || defaults.colorBottom);
    material.uniforms.uRange.value = env.range ?? defaults.range;
    material.uniforms.uDistortion.value = env.distortion ?? defaults.distortion;
    material.uniforms.uBlend.value = env.blend ?? defaults.blend;

    const rt = pmrem.fromScene(tmpScene, 0, 0.1, 100);
    textures.push(rt.texture);
  }

  pmrem.dispose();
  geometry.dispose();
  material.dispose();

  return textures;
}

export function createTextureEnvironment(scene, textures) {
  let currentIndex = 0;

  function setProject(index) {
    if (index < 0 || index >= textures.length) return;
    currentIndex = index;
    scene.background = textures[index];
    scene.environment = textures[index];
    scene.backgroundBlurriness = 0;
    scene.backgroundIntensity = 1;
    scene.environmentIntensity = 1;
  }

  setProject(0);

  return {
    setProject,
    getCurrentIndex: () => currentIndex,
    getCurrentTexture: () => textures[currentIndex] || null,
    dispose() {
      scene.background = null;
      scene.environment = null;
    },
  };
}

export function createGradientEnvironment(scene, renderer, cfg, onEnvChange) {

  const geometry = new THREE.SphereGeometry(50, 64, 64);
  const material = new THREE.ShaderMaterial({
    vertexShader: GRADIENT_VERTEX_SHADER,
    fragmentShader: GRADIENT_FRAGMENT_SHADER,
    uniforms: {
      uColorTop: { value: new THREE.Color(cfg.colorTop) },
      uColorMid: { value: new THREE.Color(cfg.colorMid) },
      uColorBottom: { value: new THREE.Color(cfg.colorBottom) },
      uRange: { value: cfg.range },
      uDistortion: { value: cfg.distortion },
      uBlend: { value: cfg.blend },
    },
    side: THREE.BackSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  let envMapRT = null;
  let _dirty = false;
  let _rafId = 0;

  function updateEnvMap() {
    if (envMapRT) {
      envMapRT.dispose();
    }
    envMapRT = pmrem.fromScene(mesh, 0, 0.1, 100);
    scene.environment = envMapRT.texture;
    scene.background = envMapRT.texture;
    scene.backgroundBlurriness = 0;
    scene.backgroundIntensity = 1;
    scene.environmentIntensity = 1;
    _dirty = false;
    if (onEnvChange) onEnvChange(envMapRT.texture);
  }

  function scheduleUpdate() {
    if (_dirty) return;
    _dirty = true;
    _rafId = requestAnimationFrame(() => {
      updateEnvMap();
    });
  }

  updateEnvMap();

  return {
    mesh,
    material,
    getTexture: () => (envMapRT ? envMapRT.texture : null),
    update(newCfg) {
      if (newCfg.colorTop !== undefined) material.uniforms.uColorTop.value.set(newCfg.colorTop);
      if (newCfg.colorMid !== undefined) material.uniforms.uColorMid.value.set(newCfg.colorMid);
      if (newCfg.colorBottom !== undefined) material.uniforms.uColorBottom.value.set(newCfg.colorBottom);
      if (newCfg.range !== undefined) material.uniforms.uRange.value = newCfg.range;
      if (newCfg.distortion !== undefined) material.uniforms.uDistortion.value = newCfg.distortion;
      if (newCfg.blend !== undefined) material.uniforms.uBlend.value = newCfg.blend;
      scheduleUpdate();
    },
    dispose() {
      if (_rafId) cancelAnimationFrame(_rafId);
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      if (envMapRT) envMapRT.dispose();
      pmrem.dispose();
    },
  };
}
