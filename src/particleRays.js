import * as THREE from "three";

// ── Hoisted working vectors (zero GC) ──
const _yAxis = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);
const _mat4 = new THREE.Matrix4();

const rayVertex = `
attribute float aLife;
attribute float aMaxLife;
attribute float aBaseLength;
attribute float aIntensity;
attribute float aColorVariant;
attribute vec3 aDirection;

uniform float uGlobalTime;
uniform vec3 uBaseColor;

varying vec2 vUv;
varying float vIntensity;
varying vec3 vColor;

#define PI 3.141592653589793

void main() {
  vUv = uv;

  float lifeRatio = clamp(aLife / aMaxLife, 0.0, 1.0);
  float scaleY = aBaseLength * sin(lifeRatio * PI);

  // Reconstruct per-instance transform
  vec3 dir = normalize(aDirection);
  vec3 up = vec3(0.0, 1.0, 0.0);
  // Build rotation from Y-axis to direction
  vec3 axis = cross(up, dir);
  float axisLen = length(axis);
  float cosA = dot(up, dir);

  mat3 rotMat;
  if (axisLen < 0.0001) {
    // Direction is nearly aligned with Y — identity or 180° flip
    rotMat = (cosA > 0.0) ? mat3(1.0) : mat3(-1.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 0.0, 1.0);
  } else {
    axis /= axisLen;
    float s = axisLen;  // sin(angle) = |cross|
    float c = cosA;     // cos(angle) = dot
    float t = 1.0 - c;
    rotMat = mat3(
      t * axis.x * axis.x + c,       t * axis.x * axis.y - s * axis.z, t * axis.x * axis.z + s * axis.y,
      t * axis.x * axis.y + s * axis.z, t * axis.y * axis.y + c,       t * axis.y * axis.z - s * axis.x,
      t * axis.x * axis.z - s * axis.y, t * axis.y * axis.z + s * axis.x, t * axis.z * axis.z + c
    );
  }

  // Scale position.y by scaleY, then rotate, then translate along direction
  vec3 scaledPos = vec3(position.x, position.y * scaleY, position.z);
  vec3 rotatedPos = rotMat * scaledPos;
  vec3 offset = dir * scaleY * 0.5;
  vec3 finalPos = rotatedPos + offset;

  vIntensity = aIntensity;
  vColor = uBaseColor * aColorVariant;

  vec4 mvPos = modelViewMatrix * vec4(finalPos, 1.0);
  gl_Position = projectionMatrix * mvPos;
}
`;

const rayFragment = `
uniform float uGlobalTime;
varying vec2 vUv;
varying float vIntensity;
varying vec3 vColor;

vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.,0.,1.,1.);
  vec4 Pf = fract(P.xyxy) - vec4(0.,0.,1.,1.);
  Pi = mod(Pi, 289.);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1./41.)) * 2. - 1.;
  vec4 gy = abs(gx) - .5;
  vec4 tx = floor(gx + .5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = 1.79284291400159 - .85373472095314 * vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = Pf.xy * Pf.xy * Pf.xy * (Pf.xy * (Pf.xy * 6. - 15.) + 10.);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

void main() {
  float noise = cnoise(vec2(vUv.y * 3.0, uGlobalTime * 0.5));
  noise = pow(noise, 2.0);
  float pulse = sin((vUv.y - uGlobalTime * 0.2) * 20.0) * 0.5 + 0.5;
  pulse = pow(pulse, 3.0);
  float energy = max(noise, pulse) * vIntensity;
  float fade = 1.0 - pow(vUv.y, 2.0);
  energy *= fade;
  vec3 finalColor = vColor * energy;
  gl_FragColor = vec4(finalColor, energy * 0.5);
}
`;

export function createEnergyRays(scene, shieldMesh, shieldMaterial) {
  const group = new THREE.Group();
  scene.add(group);

  const cfg = {
    enabled: true,
    rayCount: 12,
    rayRadius: 0.068,
    baseRayLength: 0.5,
    baseIntensity: 3.5,
    intensityVariance: 1.5,
    speed: 2.6,
  };

  // Per-ray CPU state arrays
  let lifes = null;
  let maxLifes = null;
  let baseLengths = null;
  let intensities = null;
  let colorVariants = null;
  let directions = null; // flat Float32Array (x,y,z per ray)

  // GPU instance attributes
  let lifeAttr = null;
  let maxLifeAttr = null;
  let baseLengthAttr = null;
  let intensityAttr = null;
  let colorVariantAttr = null;
  let directionAttr = null;

  let instancedMesh = null;
  let geometry = null;
  let material = null;
  let globalTime = 0;

  function initRayData(count) {
    lifes = new Float32Array(count);
    maxLifes = new Float32Array(count);
    baseLengths = new Float32Array(count);
    intensities = new Float32Array(count);
    colorVariants = new Float32Array(count);
    directions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      lifes[i] = Math.random() * 5.0;
      maxLifes[i] = THREE.MathUtils.randFloat(4.0, 7.0);
      baseLengths[i] = cfg.baseRayLength * THREE.MathUtils.randFloat(0.8, 1.2);
      intensities[i] = cfg.baseIntensity + Math.random() * cfg.intensityVariance;
      colorVariants[i] = Math.random() > 0.5 ? 0.7 : 1.3;

      _dir.randomDirection();
      directions[i * 3] = _dir.x;
      directions[i * 3 + 1] = _dir.y;
      directions[i * 3 + 2] = _dir.z;
    }
  }

  function buildRays() {
    // Clean up old
    if (instancedMesh) {
      group.remove(instancedMesh);
      instancedMesh.dispose();
    }
    if (geometry) geometry.dispose();
    if (material) material.dispose();

    const count = cfg.rayCount;
    initRayData(count);

    geometry = new THREE.CylinderGeometry(cfg.rayRadius, cfg.rayRadius, 1, 8, 20);

    // Create instance attributes
    lifeAttr = new THREE.InstancedBufferAttribute(lifes, 1);
    maxLifeAttr = new THREE.InstancedBufferAttribute(maxLifes, 1);
    baseLengthAttr = new THREE.InstancedBufferAttribute(baseLengths, 1);
    intensityAttr = new THREE.InstancedBufferAttribute(intensities, 1);
    colorVariantAttr = new THREE.InstancedBufferAttribute(colorVariants, 1);
    directionAttr = new THREE.InstancedBufferAttribute(directions, 3);

    geometry.setAttribute('aLife', lifeAttr);
    geometry.setAttribute('aMaxLife', maxLifeAttr);
    geometry.setAttribute('aBaseLength', baseLengthAttr);
    geometry.setAttribute('aIntensity', intensityAttr);
    geometry.setAttribute('aColorVariant', colorVariantAttr);
    geometry.setAttribute('aDirection', directionAttr);

    const shieldColor = shieldMaterial.uniforms.uColor.value;

    material = new THREE.ShaderMaterial({
      uniforms: {
        uGlobalTime: { value: 0 },
        uBaseColor: { value: new THREE.Color(shieldColor.r, shieldColor.g, shieldColor.b) },
      },
      vertexShader: rayVertex,
      fragmentShader: rayFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.frustumCulled = false;

    // Set all instance matrices to identity (transforms are done in shader)
    const identity = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      instancedMesh.setMatrixAt(i, identity);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;

    group.add(instancedMesh);
  }

  function update(delta) {
    if (!cfg.enabled || !instancedMesh) return;

    const shieldPos = shieldMesh.position;
    group.position.copy(shieldPos);

    globalTime += delta * cfg.speed;
    material.uniforms.uGlobalTime.value = globalTime;

    const count = cfg.rayCount;
    let needsDirUpdate = false;

    for (let i = 0; i < count; i++) {
      lifes[i] += delta;

      if (lifes[i] >= maxLifes[i]) {
        // Respawn — no allocations
        lifes[i] = 0;
        maxLifes[i] = THREE.MathUtils.randFloat(4.0, 7.0);
        baseLengths[i] = cfg.baseRayLength * THREE.MathUtils.randFloat(0.7, 1.3);

        _dir.randomDirection();
        directions[i * 3] = _dir.x;
        directions[i * 3 + 1] = _dir.y;
        directions[i * 3 + 2] = _dir.z;
        needsDirUpdate = true;
      }
    }

    lifeAttr.needsUpdate = true;
    if (needsDirUpdate) {
      directionAttr.needsUpdate = true;
      maxLifeAttr.needsUpdate = true;
      baseLengthAttr.needsUpdate = true;
    }
  }

  function syncColor() {
    const shieldColor = shieldMaterial.uniforms.uColor.value;
    material.uniforms.uBaseColor.value.set(shieldColor.r, shieldColor.g, shieldColor.b);

    // Regenerate color variants
    const count = cfg.rayCount;
    for (let i = 0; i < count; i++) {
      colorVariants[i] = Math.random() > 0.5 ? 0.7 : 1.3;
    }
    colorVariantAttr.needsUpdate = true;
  }

  function initGUI(parentFolder) {
    const f = parentFolder.addFolder("Energy Rays");
    f.close();

    f.add(cfg, "enabled").name("Enable Rays");
    f.add(cfg, "rayCount", 5, 200, 1).name("Ray Count").onFinishChange(() => buildRays());
    f.add(cfg, "rayRadius", 0.001, 0.1, 0.001).name("Ray Radius").onFinishChange(() => buildRays());
    f.add(cfg, "baseRayLength", 0.5, 15, 0.1).name("Ray Length");
    f.add(cfg, "baseIntensity", 0.5, 10, 0.1).name("Intensity");
    f.add(cfg, "intensityVariance", 0, 5, 0.1).name("Intensity Variance");
    f.add(cfg, "speed", 0.1, 3, 0.05).name("Speed");
    f.add({ sync: syncColor }, "sync").name("Sync Shield Color");
  }

  function setVisible(v) {
    group.visible = v;
    group.userData.explicitlyHidden = !v;
  }

  function setTarget(newMesh, newMaterial) {
    shieldMesh = newMesh;
    shieldMaterial = newMaterial;
    syncColor();
  }

  let _pendingMesh = null;
  let _pendingMaterial = null;

  function setPendingTarget(newMesh, newMaterial) {
    _pendingMesh = newMesh;
    _pendingMaterial = newMaterial;
  }

  function commitPendingTarget() {
    if (_pendingMesh) {
      setTarget(_pendingMesh, _pendingMaterial);
      _pendingMesh = null;
      _pendingMaterial = null;
    }
  }

  buildRays();

  return { group, update, syncColor, setVisible, setTarget, setPendingTarget, commitPendingTarget, initGUI, cfg };
}
