import * as THREE from "three";
import gsap from "gsap";
import { INTRO_POVS } from "./povs.js";
import { PROJECTS } from "./projects.js";
import { isMobile } from "./mobile.js";

const INTRO_SETTINGS = {
  introPov: "povIntro3",
  preloaderFadeMs: 2000,
  titleFadeInDuration: 2,
  titleFadeInDelay: 1.5,
  titleFadeOutDuration: 0.5,
  titleFadeOutOffset: 0.5,
  camZoomOffset: 1.5,
  baseSpeed: 13.8,
  decelDurationMultiplier: 2,
  gridCellSize: 8,
  gridSectionSize: 11,
  gridFadeDistance: 14,
  gridLines: "Both",
  portalVisible: false,
  useUniformColor: true,
  uniformColor: "#D9D9D9",
  uniformFresnelStrength: 1.0,
  camJump: {
    position: { x: 25.437253424453065, y: 45.90473119271373, z: 43.8308317833848 },
    target: { x: -3.7806267950793058, y: 0.6219036874602836, z: 6.707912890116738 },
  },
};

const INTRO_TITLE = "Creative Developer";
const INTRO_SUBTITLES = [
  "WebGL · Three.js · Interactive Experiences",
  "Crafting Digital Experiences with Code",
  "Where Design Meets Technology",
  "Building the Future of the Web",
  "Shaping Pixels into Experiences",
];

function getIntroCfg(N, circleCfg) {
  const scale = Math.max(0.4, N * 0.05);
  const R = 18 * scale;
  const cx = 0.5 + R;
  return { scale, R, cx, cy: circleCfg ? circleCfg.centerY : 2.4, cz: 0 };
}

const _introPosVec = new THREE.Vector3();
const _offsetPosVec = new THREE.Vector3();

function posFromCircle(angle, cfg, out = _introPosVec) {
  const { R, cx, cy, cz } = cfg;
  out.set(cx - R * Math.sin(angle), cy, cz - R * Math.cos(angle));
  return out;
}

export function createIntro(camera, controls, projectSlider, model, grid) {
  let titleEl = null;
  let running = false;
  let animRaf = null;

  // ── Portal timing config ──
  const _introTiming = {
    portalVisibleFromStart: INTRO_SETTINGS.portalVisible,
  };

  function initTitle() {
    titleEl = document.createElement("div");
    titleEl.id = "intro-overlay";
    Object.assign(titleEl.style, {
      position: "fixed", top: "0", left: "0", width: "100%", height: "100%",
      display: "flex", flexDirection: "column", justifyContent: "center",
      paddingLeft: "6vw", zIndex: "100", pointerEvents: "none", opacity: "0",
    });

    const h1 = document.createElement("h1");
    h1.id = "intro-title";
    h1.textContent = INTRO_TITLE;
    Object.assign(h1.style, {
      fontFamily: "'Orbitron', monospace", fontSize: "clamp(2rem, 5vw, 4rem)",
      fontWeight: "900", color: "#fff", letterSpacing: "0.08em",
      textShadow: "0 0 60px rgba(0,229,255,0.3), 0 0 120px rgba(0,0,0,0.5)",
      margin: "0",
    });

    const subtitle = document.createElement("p");
    subtitle.id = "intro-subtitle";
    subtitle.textContent = INTRO_SUBTITLES[Math.floor(Math.random() * INTRO_SUBTITLES.length)];
    Object.assign(subtitle.style, {
      fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(0.7rem, 1.2vw, 1rem)",
      fontWeight: "300", color: "rgba(224,232,240,0.5)", letterSpacing: "0.2em",
      textTransform: "uppercase", marginTop: "1rem",
    });

    titleEl.appendChild(h1);
    titleEl.appendChild(subtitle);
    document.body.appendChild(titleEl);
  }

  function start(onIntroComplete) {
    if (running) return;
    running = true;
    initTitle();

    // Immediately hide shields at gate position (off-screen) before preloader fade
    const units = projectSlider.allUnits;
    const N = units.length;
    const introCfg = getIntroCfg(N, projectSlider.circleCfg);
    const offsetAngle = Math.acos(0);
    const offsetPos = posFromCircle(offsetAngle, introCfg, _offsetPosVec);
    for (let i = 0; i < N; i++) {
      units[i].position.set(offsetPos.x, offsetPos.y, 50);
      units[i].userData.circleAngle = offsetAngle;
    }

    // Show canvas first
    const canvasContainer = document.getElementById("canvas-container");
    if (canvasContainer) canvasContainer.style.display = "block";

    // Hide loading after a frame so canvas has rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const loadingEl = document.getElementById("loading");
        if (loadingEl) loadingEl.classList.add("hidden");
      });
    });

    // Show top bar during intro
    const topBar = document.getElementById("top-bar");
    if (topBar) topBar.style.display = "";

    const articlesContainer = document.getElementById("articles-container");
    const scrollHint = document.getElementById("scroll-hint");
    if (articlesContainer) articlesContainer.style.display = "none";
    if (scrollHint) scrollHint.style.display = "none";

    if (model && model.setVisible) model.setVisible(false, 0);

    // Grid: use slider defaults from start
    const sliderGridCfg = { cellSize: INTRO_SETTINGS.gridCellSize, sectionSize: INTRO_SETTINGS.gridSectionSize };
    if (grid && grid.gridMat) {
      grid.setLines(INTRO_SETTINGS.gridLines);
      grid.gridMat.uniforms.uCellSize.value = sliderGridCfg.cellSize;
      grid.gridMat.uniforms.uSectionSize.value = sliderGridCfg.sectionSize;
      grid.gridMat.uniforms.uFadeDistance.value = INTRO_SETTINGS.gridFadeDistance;
    }

    // Start intro animation immediately (concurrent with transition reveal)
    _startAnimation(onIntroComplete);
  }

  function _startAnimation(onIntroComplete) {
    const units = projectSlider.allUnits;
    const N = units.length;
    const introCfg = getIntroCfg(N, projectSlider.circleCfg);
    const R = introCfg.R;

    const offsetAngle = Math.acos(0);
    const offsetPos = posFromCircle(offsetAngle, introCfg, _offsetPosVec);

    // Set all shields to uniform color during intro (if enabled)
    if (INTRO_SETTINGS.useUniformColor) {
      const introColor = new THREE.Color(INTRO_SETTINGS.uniformColor);
      for (let i = 0; i < N; i++) {
        units[i].material.uniforms.uColor.value.copy(introColor);
        units[i].material.uniforms.uNoiseEdgeColor.value.copy(introColor);
      }
    }

    // Set all shields to uniform fresnel strength during intro
    const savedFresnel = [];
    for (let i = 0; i < N; i++) {
      savedFresnel.push(units[i].material.uniforms.uFresnelStrength.value);
      units[i].material.uniforms.uFresnelStrength.value = INTRO_SETTINGS.uniformFresnelStrength;
    }

    // Place all shields at gate, z=50 (off-screen)
    for (let i = 0; i < N; i++) {
      gsap.set(units[i].position, { x: offsetPos.x, y: offsetPos.y, z: 50 });
      units[i].userData.circleAngle = offsetAngle;
    }

    // Camera to intro POV (mobile uses a fixed intro pov, distinct from the slider's mobile-pov)
    const mobileIntroPov = INTRO_POVS["povIntroMobile"];
    const introPov = isMobile() ? mobileIntroPov : INTRO_POVS[INTRO_SETTINGS.introPov];
    gsap.set(camera.position, {
      x: introPov.cameraPosition.x, y: introPov.cameraPosition.y, z: introPov.cameraPosition.z,
      //duration: 1.5, ease: "power2.out",
    });
    gsap.to(controls.target, {
      x: introPov.controlsTarget.x, y: introPov.controlsTarget.y, z: introPov.controlsTarget.z,
      duration: 1.5, ease: "power4.Out",
    });
    if (introPov.fov !== undefined) {
      gsap.to(camera, {
        fov: introPov.fov, duration: 1.5, ease: "power2.out",
        onUpdate: () => camera.updateProjectionMatrix(),
      });
    }

    // Title fade in
    gsap.to(titleEl, { opacity: 1, duration: INTRO_SETTINGS.titleFadeInDuration, ease: "power2.out", delay: INTRO_SETTINGS.titleFadeInDelay });

    // ── Rotation parameters ──
    const baseSpeed = INTRO_SETTINGS.baseSpeed;
    const baseAngVel = -(baseSpeed / R);
    const lineDur = 50 / baseSpeed;
    const slotAngle = (2 * Math.PI) / N;
    const stagger = Math.abs(slotAngle / baseAngVel);

    // One rotation duration
    const rot1Dur = (2 * Math.PI) / Math.abs(baseAngVel);

    // ── Single animation loop: staggered rotation → deceleration ──
    const rot1End = lineDur + rot1Dur;                // when shield[0] finishes first rotation
    const decelDist = baseAngVel * rot1Dur;           // one more rotation worth of angle
    const decelDur = INTRO_SETTINGS.decelDurationMultiplier * rot1Dur;                     // deceleration duration (constant decel from v0 to 0)
    const totalDur = rot1End + decelDur;              // total animation duration

    // Camera jump — smooth move to target position over full intro duration
    const jump = isMobile()
      ? { position: mobileIntroPov.cameraPosition, target: mobileIntroPov.controlsTarget }
      : INTRO_SETTINGS.camJump;
    gsap.to(camera.position, {
      x: jump.position.x, y: jump.position.y, z: jump.position.z,
      duration: totalDur, ease: "power2.inOut",
    });
    gsap.to(controls.target, {
      x: jump.target.x, y: jump.target.y, z: jump.target.z,
      duration: totalDur, ease: "power2.inOut",
    });

    let animStart = null;
    let camZoomFired = false;

    // Camera zoom starts this many seconds before intro ends — overlap
    // with the deceleration phase so the transition feels continuous
    const camZoomOffset = INTRO_SETTINGS.camZoomOffset;
    const camZoomTime = Math.max(0, totalDur - camZoomOffset);

    function animTick(now) {
      if (!animStart) animStart = now;
      const elapsed = (now - animStart) / 1000;

      // Fire camera zoom once, during the intro (before finishIntro)
      if (!camZoomFired && elapsed >= camZoomTime ) {
        camZoomFired = true;
        projectSlider.setActiveShieldExternal(0, false);
      }

      const decelT = Math.min((elapsed - rot1End) / decelDur, 1);
      const leaderAngle =
        elapsed < rot1End
          ? offsetAngle + baseAngVel * (elapsed - lineDur)
          : offsetAngle + baseAngVel * rot1Dur + decelDist * (2 * decelT - decelT * decelT);

      for (let j = 0; j < N; j++) {
        const s = units[j];
        const startAt = j * stagger;

        if (elapsed < startAt) {
          s.position.z = 50;
        } else if (elapsed < startAt + lineDur) {
          const flyT = (elapsed - startAt) / lineDur;
          s.position.z = 50 + (offsetPos.z - 50) * flyT;
        } else {
          s.position.z = offsetPos.z;
        }

        let a;
        if (elapsed < startAt + lineDur) {
          a = offsetAngle;
        } else if (elapsed < rot1End) {
          const shieldElapsed = elapsed - startAt - lineDur;
          a = offsetAngle + baseAngVel * shieldElapsed;
        } else {
          a = leaderAngle + j * slotAngle;
        }

        const pos = posFromCircle(a, introCfg);
        s.position.x = pos.x;
        s.position.y = pos.y;
        if (elapsed >= startAt + lineDur) s.position.z = pos.z;
        s.userData.baseX = pos.x;
        s.userData.baseY = pos.y;
        s.userData.baseZ = pos.z;
        s.userData.circleAngle = a;
      }

      if (elapsed < totalDur) {
        animRaf = requestAnimationFrame(animTick);
      } else {
        finishIntro();
      }
    }
    animRaf = requestAnimationFrame(animTick);

    // Intro title fades out before the end
    gsap.to(titleEl, { opacity: 0, duration: INTRO_SETTINGS.titleFadeOutDuration, ease: "power2.in", delay: totalDur - INTRO_SETTINGS.titleFadeOutOffset });

    function finishIntro() {
      if (!running) return;
      running = false;

      // Remove intro overlay
      if (titleEl && titleEl.parentNode) titleEl.parentNode.removeChild(titleEl);

      // Restore original shield colors from projects (if uniform color was applied)
      if (INTRO_SETTINGS.useUniformColor) {
        for (let i = 0; i < units.length; i++) {
          const color = PROJECTS[i]?.color || "#FF2525";
          units[i].material.uniforms.uColor.value.set(color);
          units[i].material.uniforms.uNoiseEdgeColor.value.set(color);
        }
      }

      // Restore per-project fresnel strength
      for (let i = 0; i < units.length; i++) {
        units[i].material.uniforms.uFresnelStrength.value = savedFresnel[i];
      }

      // Set full circle config (slider defaults)
      Object.assign(projectSlider.circleCfg, {
        scale: 1,
        centerX: 18.5,
        centerY: projectSlider.circleCfg.centerY,
        centerZ: 0,
      });

      // Calculate scrollIndex so project 0 (red) is at the gate
      // getGateIndex = (scrollIndex + N/4) % N, so for gate=0: scrollIndex = N - N/4
      const N = projectSlider.allUnits.length;
      const offset = Math.round(N / 4);
      const scrollIdx = (N - offset) % N;
      projectSlider.setScrollIndex(scrollIdx);
      projectSlider.positionAllShieldsOnCircle();

      if (model && model.setVisible) model.setVisible(true);

      // Show project UI (re-query since these are in start()'s scope)
      const _articlesContainer = document.getElementById("articles-container");
      const _scrollHint = document.getElementById("scroll-hint");
      if (_articlesContainer) _articlesContainer.style.display = "flex";
      if (_scrollHint) _scrollHint.style.display = "flex";
      const navDots = document.getElementById("nav-dots");
      if (navDots) navDots.style.display = "";

      // Camera zoom already triggered from animTick — no duplicate call here

      // Enable scroll
      projectSlider.setScrollEnabled(true);

      if (onIntroComplete) onIntroComplete();
    }
  }

  function skip() {
    if (animRaf) cancelAnimationFrame(animRaf);
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
    if (titleEl && titleEl.parentNode) titleEl.parentNode.removeChild(titleEl);
    running = false;
  }

  function destroy() {
    skip();
    if (titleEl && titleEl.parentNode) titleEl.parentNode.removeChild(titleEl);
  }

  return { start, skip, destroy, introTiming: _introTiming };
}
