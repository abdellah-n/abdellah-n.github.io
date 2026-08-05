import * as THREE from "three";
import gsap from "gsap";
import { createShieldMaterial } from "./orbShader.js";
import { PROJECTS } from "./projects.js";
import { SLIDER_POVS } from "./povs.js";
import { isMobile } from "./mobile.js";

const UNIT_LABELS = PROJECTS.map((p) => p.label);

export function createProjectSlider(scene, camera, renderer, shieldMesh, controls) {
  const group = new THREE.Group();
  const copies = [];
  const allUnits = [];
  let activeIndex = 0;
  let onUnitChangeCb = null;
  let onScrollCompleteCb = null;
  let scrollCooldown = false;
  let scrollEnabled = false;

  const timelineCfg = {
    cameraDuration: 2.6,
    cameraDelay: 0,
    cameraSpeed: 1,
    slideDuration: 2.6,
    slideDelay: 0,
    slideSpeed: 1,
  };

  const geo = new THREE.SphereGeometry(1.8, 64, 64);
  const glassGeo = new THREE.SphereGeometry(1.75, 64, 64);

  const circleCfg = {
    radius: 18,
    centerX: 18.5,
    centerY: 2.4,
    centerZ: 0,
    axisX: 0,
    axisY: 1,
    axisZ: 0,
    scale: 1,
    scrollIndex: 2,
  };

  let scrollIndex = 2;
  let ambientSpeed = 0;
  let scrollVersion = 0;
  let needsOffsetSnap = false;

  // ── Hoisted working vectors (zero GC) ──
  const _center = new THREE.Vector3();
  const _normal = new THREE.Vector3();
  const _upV = new THREE.Vector3();
  const _uV = new THREE.Vector3();
  const _vV = new THREE.Vector3();
  const _posResult = new THREE.Vector3();

  function getPositionFromAngle(angle) {
    const R = circleCfg.radius * circleCfg.scale;
    _center.set(circleCfg.centerX, circleCfg.centerY, circleCfg.centerZ);
    _normal.set(circleCfg.axisX, circleCfg.axisY, circleCfg.axisZ).normalize();
    _upV.set(0, 1, 0);
    if (Math.abs(_normal.dot(_upV)) > 0.99) _upV.set(1, 0, 0);
    _uV.crossVectors(_normal, _upV).normalize();
    _vV.crossVectors(_normal, _uV).normalize();
    _posResult.copy(_center);
    _posResult.addScaledVector(_uV, R * Math.cos(angle));
    _posResult.addScaledVector(_vV, R * Math.sin(angle));
    return _posResult;
  }

  function getAngleOffset() {
    return -scrollIndex * (Math.PI * 2 / allUnits.length);
  }

  function getShieldAngle(index) {
    return (index / allUnits.length) * Math.PI * 2;
  }

  function getCirclePosition(index) {
    return getPositionFromAngle(getShieldAngle(index) + getAngleOffset());
  }

  function positionAllShieldsOnCircle() {
    for (let i = 0; i < allUnits.length; i++) {
      const angle = getShieldAngle(i) + getAngleOffset();
      allUnits[i].userData.circleAngle = angle;
      const pos = getPositionFromAngle(angle);
      allUnits[i].position.copy(pos);
      allUnits[i].userData.baseX = pos.x;
      allUnits[i].userData.baseY = pos.y;
      allUnits[i].userData.baseZ = pos.z;
    }
  }

  function getOffsetIndex() {
    const offset = allUnits.length / 4;
    return ((Math.round(scrollIndex) + offset) % allUnits.length + allUnits.length) % allUnits.length;
  }

  // First project uses the original shield mesh
  const firstProject = PROJECTS[0];
  if (firstProject.fresnelStrength !== undefined) shieldMesh.material.uniforms.uFresnelStrength.value = firstProject.fresnelStrength;
  shieldMesh.userData.colorKey = firstProject.id;
  shieldMesh.userData.index = 0;
  shieldMesh.userData.slideEase = "power4.out";
  allUnits.push(shieldMesh);

  const sharedGlassMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.15,
    metalness: 0.9,
    envMapIntensity: 2.0,
    side: THREE.FrontSide,
    transparent: true,
    opacity: 0.6,
  });

  // Remaining projects are copies
  for (let i = 1; i < PROJECTS.length; i++) {
    const project = PROJECTS[i];
    const mat = createShieldMaterial();
    mat.uniforms.uColor.value.set(project.color);
    mat.uniforms.uNoiseEdgeColor.value.set(project.color);
    if (project.fresnelStrength !== undefined) mat.uniforms.uFresnelStrength.value = project.fresnelStrength;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 2.3, 0);
    mesh.userData.colorKey = project.id;
    mesh.userData.index = i;
    mesh.userData.slideEase = "power4.out";
    scene.add(mesh);

    // inner glass sphere (shared material & geometry)
    const glassMesh = new THREE.Mesh(glassGeo, sharedGlassMat);
    glassMesh.position.y = -0.02;
    glassMesh.renderOrder = 2;
    mesh.add(glassMesh);

    copies.push(mesh);
    allUnits.push(mesh);
  }

  positionAllShieldsOnCircle();

  // Click to target a shield
  let pointerDown = false;
  const downPos = new THREE.Vector2();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

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

    const hits = raycaster.intersectObjects(allUnits);
    if (hits.length > 0) {
      const idx = hits[0].object.userData.index;
      if (idx !== undefined && idx !== activeIndex) {
        scrollToIndex(idx);
      }
    }
  });

  function handleScroll(dir) {
    if (needsOffsetSnap) {
      needsOffsetSnap = false;
      const g = getOffsetIndex();
      const offset = allUnits.length / 4;
      scrollIndex = (g - offset + allUnits.length) % allUnits.length;
      circleCfg.scrollIndex = scrollIndex;
      positionAllShieldsOnCircle();
    }
    scrollIndex += dir; circleCfg.scrollIndex = scrollIndex;
    scrollVersion++;
    const ver = scrollVersion;
    const slideDur = timelineCfg.slideDuration / timelineCfg.slideSpeed;
    const delay = timelineCfg.slideDelay;
    const next = getOffsetIndex();

    for (let i = 0; i < allUnits.length; i++) {
      const s = allUnits[i];
      const targetAngle = getShieldAngle(i) + getAngleOffset();
      const data = { angle: s.userData.circleAngle };
      const isTarget = (i === next);
      let scrollFired = false;
      const startAngle = s.userData.circleAngle;
      gsap.to(data, {
        angle: targetAngle, duration: slideDur, delay,
        ease: s.userData.slideEase || "power4.out",
        overwrite: "auto",
        onUpdate: function () {
          if (ver !== scrollVersion) return;
          const pos = getPositionFromAngle(data.angle);
          s.position.copy(pos);
          s.userData.baseX = pos.x;
          s.userData.baseY = pos.y;
          s.userData.baseZ = pos.z;
          if (isTarget && !scrollFired && onScrollCompleteCb) {
            const totalDiff = Math.abs(targetAngle - startAngle);
            if (totalDiff > 0.001) {
              const progress = Math.abs(data.angle - startAngle) / totalDiff;
              if (progress >= 0.9) {
                scrollFired = true;
                onScrollCompleteCb(next);
              }
            }
          }
        },
        onComplete: () => {
          if (ver !== scrollVersion) return;
          const p = getPositionFromAngle(targetAngle);
          s.position.copy(p);
          s.userData.baseX = p.x;
          s.userData.baseY = p.y;
          s.userData.baseZ = p.z;
        },
      });
      s.userData.circleAngle = targetAngle;
    }

    if (next !== activeIndex) {
      setActiveShield(next);
    }
  }

  window.addEventListener("wheel", (e) => {
    if (!scrollEnabled || scrollCooldown) return;
    scrollCooldown = true;
    setTimeout(() => { scrollCooldown = false; }, 150);
    handleScroll(e.deltaY > 0 ? 1 : -1);
  });

  function setActiveShield(index) {
    activeIndex = index;
    animateCameraToShield(index);
    if (onUnitChangeCb) onUnitChangeCb(index);
  }

  function scrollToIndex(index) {
    const N = allUnits.length;
    const offset = N / 4;
    const targetScroll = ((index - offset) % N + N) % N;
    let delta = ((targetScroll - Math.round(scrollIndex)) % N + N) % N;
    if (delta > N / 2) delta -= N;
    if (delta === 0) {
      setActiveShield(index);
      return;
    }

    scrollIndex += delta;
    circleCfg.scrollIndex = scrollIndex;
    scrollVersion++;
    const ver = scrollVersion;
    const slideDur = timelineCfg.slideDuration / timelineCfg.slideSpeed;
    const delay = timelineCfg.slideDelay;

    for (let i = 0; i < allUnits.length; i++) {
      const s = allUnits[i];
      const targetAngle = getShieldAngle(i) + getAngleOffset();
      const data = { angle: s.userData.circleAngle };
      gsap.to(data, {
        angle: targetAngle, duration: slideDur, delay,
        ease: s.userData.slideEase || "power4.out",
        overwrite: "auto",
        onUpdate: function () {
          if (ver !== scrollVersion) return;
          const pos = getPositionFromAngle(data.angle);
          s.position.copy(pos);
          s.userData.baseX = pos.x;
          s.userData.baseY = pos.y;
          s.userData.baseZ = pos.z;
        },
        onComplete: () => {
          if (ver !== scrollVersion) return;
          const p = getPositionFromAngle(targetAngle);
          s.position.copy(p);
          s.userData.baseX = p.x;
          s.userData.baseY = p.y;
          s.userData.baseZ = p.z;
        },
      });
      s.userData.circleAngle = targetAngle;
    }

    setActiveShield(index);
  }

  function animateCameraToShield(index) {
    const project = PROJECTS[index];
    if (!project) return;
    const pov = isMobile() ? "mobile-pov" : (project.pov || "pov3");
    const cam = SLIDER_POVS[pov] || project;
    const camDur = timelineCfg.cameraDuration / timelineCfg.cameraSpeed;

    if (cam.fov !== undefined && cam.fov !== camera.fov) {
      gsap.to(camera, {
        fov: cam.fov, duration: camDur, delay: timelineCfg.cameraDelay,
        ease: "power3.inOut", overwrite: "auto",
        onUpdate: () => camera.updateProjectionMatrix(),
      });
    }

    gsap.to(camera.position, {
      x: cam.cameraPosition.x, y: cam.cameraPosition.y, z: cam.cameraPosition.z,
      duration: camDur, delay: timelineCfg.cameraDelay,
      ease: "power3.inOut", overwrite: "auto",
    });
    gsap.to(controls.target, {
      x: cam.controlsTarget.x, y: cam.controlsTarget.y, z: cam.controlsTarget.z,
      duration: camDur, delay: timelineCfg.cameraDelay,
      ease: "power3.inOut", overwrite: "auto",
    });
  }

  function addCircleControls(parentFolder) {
    const circleFolder = parentFolder.addFolder("Circle Path");
    circleFolder.close();
    const apply = () => positionAllShieldsOnCircle();
    circleFolder.add(circleCfg, "radius", 3, 30, 0.5).onChange(apply);
    circleFolder.add(circleCfg, "centerX", -20, 20, 0.5).onChange(apply);
    circleFolder.add(circleCfg, "centerY", -10, 15, 0.5).onChange(apply);
    circleFolder.add(circleCfg, "centerZ", -40, 10, 0.5).onChange(apply);
    circleFolder.add(circleCfg, "scale", 0.1, 3, 0.05).onChange(apply);
    const axisFolder = circleFolder.addFolder("Axis (normal)");
    axisFolder.add(circleCfg, "axisX", -1, 1, 0.05).onChange(apply);
    axisFolder.add(circleCfg, "axisY", -1, 1, 0.05).onChange(apply);
    axisFolder.add(circleCfg, "axisZ", -1, 1, 0.05).onChange(apply);
    circleFolder.add(circleCfg, "scrollIndex", 0, allUnits.length, 0.01).name("Scroll Index").onChange((v) => {
      ambientSpeed = 0;
      scrollIndex = v; scrollVersion++;
      positionAllShieldsOnCircle();
    });
  }

  function addCopyControls(parentFolder) {
    const EASE_OPTIONS = [
      "power1.out", "power2.out", "power3.out", "power4.out",
      "power1.inOut", "power2.inOut", "power3.inOut", "power4.inOut",
      "back.out(1.7)", "elastic.out(1,0.5)", "bounce.out",
      "circ.out", "expo.out", "sine.out", "linear",
    ];
    const EASE_KEYS = UNIT_LABELS;
    const cfg = {
      copy: EASE_KEYS[0],
      slideEase: allUnits[0].userData.slideEase,
    };
    parentFolder.add(cfg, "copy", EASE_KEYS).onChange((label) => {
      const idx = EASE_KEYS.indexOf(label);
      if (idx === -1) return;
      cfg.slideEase = allUnits[idx].userData.slideEase;
      parentFolder.controllers.forEach((c) => {
        if (c.property === "slideEase") c.updateDisplay();
      });
    });
    parentFolder.add(cfg, "slideEase", EASE_OPTIONS).onChange((v) => {
      const idx = EASE_KEYS.indexOf(cfg.copy);
      if (idx === -1) return;
      allUnits[idx].userData.slideEase = v;
    });
  }

  function setAmbientSpeed(speed) {
    ambientSpeed = speed;
  }

  const _fwd = new THREE.Vector3();
  const _toShield = new THREE.Vector3();
  let raysGroup = null;

  function setRaysGroup(rg) { raysGroup = rg; }

  function updateVisibility() {
    for (let i = 0; i < allUnits.length; i++) {
      if (!allUnits[i].visible) allUnits[i].visible = true;
    }
    if (raysGroup) {
      if (!raysGroup.userData.explicitlyHidden) {
        raysGroup.visible = allUnits[0].visible;
      }
    }
  }

  function update(time) {
    if (ambientSpeed !== 0) {
      scrollIndex += ambientSpeed * time; circleCfg.scrollIndex = scrollIndex;
      for (let i = 0; i < allUnits.length; i++) {
        const angle = getShieldAngle(i) + getAngleOffset();
        const pos = getPositionFromAngle(angle);
        allUnits[i].position.copy(pos);
        allUnits[i].userData.baseX = pos.x;
        allUnits[i].userData.baseY = pos.y;
        allUnits[i].userData.baseZ = pos.z;
      }
    }
    for (const c of copies) {
      c.material.uniforms.uTime.value += time;
    }
    updateVisibility();
  }

  function setScrollEnabled(v) {
    scrollEnabled = v;
    controls.enableZoom = !v;
    controls.enableRotate = !v;
  }

  function syncMaterialsFrom(sourceMat) {
    const fields = [
      "uFlowScale", "uFlowSpeed", "uFlowIntensity",
      "uHexScale", "uHexOpacity", "uShowHex", "uEdgeWidth",
      "uFresnelPower", "uOpacity", "uFadeStart",
      "uFlashSpeed", "uFlashIntensity",
      "uHitRingSpeed", "uHitRingWidth", "uHitMaxRadius", "uHitImpactRadius",
      "uHitDuration", "uHitIntensity",
      "uNoiseScale", "uNoiseEdgeSmoothness",
    ];
    const src = sourceMat.uniforms;
    for (const s of allUnits) {
      if (s.material === sourceMat) continue;
      const dst = s.material.uniforms;
      for (const f of fields) {
        if (src[f]) dst[f].value = src[f].value;
      }
    }
  }

  function getActiveIndex() { return activeIndex; }
  function getScrollIndex() { return scrollIndex; }
  function setScrollIndex(v) { scrollIndex = v; circleCfg.scrollIndex = v; }
  function setActiveShieldExternal(index, animateCircle = true) {
    if (animateCircle) scrollToIndex(index);
    else setActiveShield(index);
  }
  function setNeedsOffsetSnap(v) { needsOffsetSnap = v; }

  return {
    group, update, setScrollEnabled, addCircleControls, addCopyControls, syncMaterialsFrom,
    allUnits, animateCameraToShield, getActiveIndex, getScrollIndex, setScrollIndex,
    setActiveShieldExternal, handleScroll, setNeedsOffsetSnap, setRaysGroup,
    setOnUnitChange: (cb) => { onUnitChangeCb = cb; },
    setOnScrollComplete: (cb) => { onScrollCompleteCb = cb; },
    setAmbientSpeed, timelineCfg, positionAllShieldsOnCircle,
    circleCfg, getPositionFromAngle, getShieldAngle, getAngleOffset,
    getConfig: () => ({
      scrollEnabled,
      activeIndex,
      scrollIndex,
      timeline: { ...timelineCfg },
      circle: { ...circleCfg },
      copies: allUnits.map((m) => ({
        slideEase: m.userData.slideEase,
      })),
    }),
  };
}
