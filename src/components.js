import gsap from "gsap";

// ── Reusable article components ──────────────────────────────────────────────

export function articleIndex(idx) {
  return `<div class="article-index"><span class="idx-slash"></span><span class="idx-num">${String(idx + 1).padStart(2, "0")}</span><span class="idx-slash"></span></div>`;
}

export function articleTitle(title) {
  return `<h2 class="article-title">${title}</h2>`;
}

export function articleSubtitle(subtitle) {
  if (!subtitle) return "";
  const words = subtitle.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return `<p class="article-subtitle"><span class="sub-col">${subtitle}</span></p>`;
  }
  const half = Math.ceil(words.length / 2);
  const col1 = words.slice(0, half).join(" ");
  const col2 = words.slice(half).join(" ");
  return `<p class="article-subtitle"><span class="sub-col">${col1}</span><span class="sub-col">${col2}</span></p>`;
}

export function articleDescription(desc) {
  if (!desc) return "";
  return `<p class="article-desc">${desc}</p>`;
}

export function articleTags(tags) {
  if (!tags || !tags.length) return "";
  return `<div class="article-tags">${tags.map((t) => `<span class="info-tag">${t}</span>`).join("")}</div>`;
}

export function articleSpecs(specs) {
  if (!specs || !Object.keys(specs).length) return "";
  const rows = Object.entries(specs)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("");
  return `
    <div class="article-specs">
      <div class="specs-title">SPECIFICATIONS</div>
      <table class="specs-table"><tbody>${rows}</tbody></table>
    </div>`;
}

export function articleStack(stack) {
  if (!stack || !stack.length) return "";
  const chips = stack.map((s) => `<span class="stack-chip">${s}</span>`).join("");
  return `
    <div class="article-stack">
      <div class="stack-title">TECH STACK</div>
      <div class="stack-grid">${chips}</div>
    </div>`;
}

export function articleLinks(linkLive, linkSource, liveLabel = "LIVE DEMO", sourceLabel = "SOURCE CODE") {
  if (!linkLive && !linkSource) return "";
  return `
    <div class="article-links">
      ${linkLive ? `<a href="${linkLive}" class="info-link" target="_blank"><span class="link-arrow">&rarr;</span> ${liveLabel}</a>` : ""}
      ${linkSource ? `<a href="${linkSource}" class="info-link" target="_blank"><span class="link-arrow">&rarr;</span> ${sourceLabel}</a>` : ""}
    </div>`;
}

export function articleLines(lines) {
  if (!lines || !lines.items || !lines.items.length) return "";
  const rows = lines.items
    .map((it) => {
      if (typeof it === "string") {
        return `<li class="line-item">${it}</li>`;
      }
      return `<li class="line-item"><span class="line-key">${it.k}</span><span class="line-val">${it.v}</span></li>`;
    })
    .join("");
  const title = lines.title ? `<div class="lines-title">${lines.title}</div>` : "";
  return `
    <div class="article-lines">
      ${title}
      <ul class="lines-list">${rows}</ul>
    </div>`;
}

// ── HUD + Chart2D: canvas (circle+smoke) + SVG overlay (animated paths) ─────
const hudPlayFns = new Map();

export function articleHud(color, uid = "0") {
  return `
    <div class="article-hud" id="hud-${uid}">
      <canvas id="hud-canvas-${uid}" class="hud-canvas" width="1500" height="1001"></canvas>
      <div class="hud-svg-layer" id="hud-svg-${uid}"></div>
    </div>`;
}

function parseColorToRgb(color) {
  const tmp = document.createElement("div");
  tmp.style.color = color;
  document.body.appendChild(tmp);
  const computed = getComputedStyle(tmp).color;
  document.body.removeChild(tmp);
  return computed.match(/\d+/g).map(Number);
}

export function initHud(containerId, chartColor = "#FFFFFF", texteras = []) { //00e5ff
  const container = document.getElementById(containerId);
  if (!container) return;

  const canvas = container.querySelector(".hud-canvas");
  const svgLayer = container.querySelector(".hud-svg-layer");
  if (!canvas || !svgLayer) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const ORIGIN_X = 368;
  const ORIGIN_Y = 544;
  const cx = ORIGIN_X;
  const cy = ORIGIN_Y;
  const R = 180;

  const rgb = parseColorToRgb(chartColor);

  // Particle state
  let scale = 0;
  let smokeStarted = false;
  const particles = [];
  const PARTICLE_COUNT = 150;

  function spawnParticle() {
    const angle = Math.random() * Math.PI * 2;
    const dist = R + 10 + Math.random() * 60;
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 0.2,
      vy: 0.05 + Math.random() * 0.15,
      life: 1,
      decay: 0.003 + Math.random() * 0.006,
      size: 0.5 + Math.random() * 2.5,
      glow: Math.random() > 0.7,
    };
  }

  function drawParticles() {
    ctx.save();
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      if (p.glow) {
        ctx.shadowColor = chartColor;
        ctx.shadowBlur = 8 + p.life * 6;
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${p.life * 0.7})`;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${p.life * 0.4})`;
      }
      ctx.fill();
    }
    ctx.restore();
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.003;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawCircle(s) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    ctx.shadowColor = chartColor;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.03)`;
    ctx.fill();
    ctx.restore();
  }

  let startTime = performance.now();
  const SCALE_DUR = 800;
  let rafId = null;

  function animateCanvas(now) {
    // Stop rAF if container is removed or article is no longer active
    const article = container.closest(".project-article");
    if (!article || !article.classList.contains("active")) {
      rafId = null;
      return;
    }

    const elapsed = now - startTime;
    const t = Math.min(elapsed / SCALE_DUR, 1);
    scale = 1 - Math.pow(1 - t, 3);
    if (t >= 1 && !smokeStarted) smokeStarted = true;
    if (smokeStarted && particles.length < PARTICLE_COUNT) {
      if (Math.random() < 0.6) particles.push(spawnParticle());
    }
    ctx.clearRect(0, 0, W, H);
    if (smokeStarted) updateParticles();
    drawParticles();
    drawCircle(scale);
    rafId = requestAnimationFrame(animateCanvas);
  }

  rafId = requestAnimationFrame(animateCanvas);

  // Load SVG into overlay layer
  let svgElements = null;

  fetch("/svg/6390477_3285518.svg")
    .then((r) => r.text())
    .then((svgText) => {
      svgLayer.innerHTML = svgText;

      const svg = svgLayer.querySelector("svg");
      if (!svg) return;

      const nocircled = svg.querySelector("#nocircled");
      const circled = svg.querySelector("#circled");
      const lineUses = nocircled ? nocircled.querySelectorAll('#line') : [];
      const textEls = nocircled ? nocircled.querySelectorAll('text') : [];

      // Extract circled children for individual animation (skip origin dot)
      const circledChildren = circled
        ? Array.from(circled.children).filter((el) => el.id !== "origin")
        : [];

      svgElements = {
        svg,
        nocircled,
        circled,
        circledChildren,
        lines: Array.from(lineUses),
        texts: Array.from(textEls),
      };

      gsap.set(svg, { scale: 0.8, opacity: 0 });
      gsap.set(svgElements.texts, { opacity: 0 });
      svgElements.lines.forEach((use) => {
        gsap.set(use, { clipPath: "inset(0 100% 0 0)" });
      });
      const originDot = svg.querySelector("#origin");
      if (originDot) gsap.set(originDot, { opacity: 0 });

      // Populate text fields from textera data
      // SVG text order: [0]=top-right, [1]=bottom-right, [2]=bottom-left, [3]=top-left
      function populateTexts(textBlock, textera) {
        if (!textBlock || !textera) return;
        // Clear all existing tspans
        while (textBlock.firstChild) textBlock.removeChild(textBlock.firstChild);
        // Create 4 new tspans with correct y offsets
        const ao = 25;
        const yOffsets = [0, ao, 2*ao, 3*ao]; // Adjust as needed for spacing
        const lines = [textera.line1, textera.line2, textera.line3, textera.line4];
        for (let i = 0; i < 4; i++) {
          const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
          tspan.setAttribute("x", "0");
          tspan.setAttribute("y", yOffsets[i]);
          tspan.setAttribute("class", "t2");
          tspan.textContent = lines[i] || "";
          textBlock.appendChild(tspan);
        }
      }

      const allTexts = nocircled ? nocircled.querySelectorAll("text") : [];
      // textera[0]→text[3] top-left, textera[1]→text[0] top-right,
      // textera[2]→text[2] bottom-left, textera[3]→text[1] bottom-right
      if (allTexts[3]) populateTexts(allTexts[3], texteras[0]);
      if (allTexts[0]) populateTexts(allTexts[0], texteras[1]);
      if (allTexts[2]) populateTexts(allTexts[2], texteras[2]);
      if (allTexts[1]) populateTexts(allTexts[1], texteras[3]);

      const article = container.closest(".project-article");
      if (article && article.classList.contains("active")) {
        playSvgAnimation(svgElements);
      }
    });

  function playSvgAnimation(elems) {
    if (!elems) return;

    gsap.killTweensOf([elems.svg, ...elems.lines, ...elems.texts, elems.circled, ...elems.circledChildren]);

    gsap.set(elems.svg, { scale: 0.8, opacity: 0 });
    gsap.set(elems.texts, { opacity: 0 });
    gsap.set(elems.lines, { clipPath: "inset(0 100% 0 0)" });
    gsap.set(elems.circled, { rotation: 0, svgOrigin: `${ORIGIN_X} ${ORIGIN_Y}` });
    elems.circledChildren.forEach((el) => {
      gsap.set(el, { rotation: 0 });
    });

    const tl = gsap.timeline();

    tl.to(elems.svg, { scale: 1, opacity: 1, duration: 0.4, ease: "power2.out" });

    // Images wipe reveal (nocircled)
    elems.lines.forEach((use, i) => {
      tl.to(use, { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "power2.inOut" }, `-=${0.3 - i * 0.08}`);
    });

    // Text fade in (nocircled)
    tl.to(elems.texts, { opacity: 1, duration: 0.4, stagger: 0.08, ease: "power1.out" }, "-=0.8");

    // Circled children: individual entrance rotation (some left, some right)
    elems.circledChildren.forEach((el, i) => {
      const dir = (i % 2 === 0) ? 1 : -1;
      const angle = 8 + (i % 4) * 3;
      gsap.set(el, { rotation: dir * angle });
      tl.to(el, {
        rotation: 0,
        duration: 0.6,
        ease: "back.out(1.6)",
      }, 0.3 + i * 0.05);
    });

    // Circled group: entrance spin
    gsap.set(elems.circled, { rotation: -30, svgOrigin: `${ORIGIN_X} ${ORIGIN_Y}` });
    tl.to(elems.circled, {
      rotation: 0,
      duration: 0.8,
      ease: "back.out(1.4)",
    }, 0.2);
    
    // After entrance, continuous slow group rotation
    tl.call(() => {
      elems.circledChildren.forEach((el, i) => {
        const dir = (i % 2 === 0) ? 1 : -1;
        gsap.to(el, {
          rotation: dir * 260,
          svgOrigin: `${ORIGIN_X} ${ORIGIN_Y}`,
          duration: 60,
          repeat: -1,
          ease: "none",
        });
      });
    });
  }

  // Store trigger: replay both canvas particles + SVG animation
  hudPlayFns.set(containerId, () => {
    scale = 0;
    smokeStarted = false;
    particles.length = 0;
    startTime = performance.now();
    if (svgElements) playSvgAnimation(svgElements);
    if (!rafId) {
      rafId = requestAnimationFrame(animateCanvas);
    }
  });
}

export function triggerHud(containerId, chartColor = "#00e5ff", texteras = []) {
  const fn = hudPlayFns.get(containerId);
  if (fn) {
    fn();
  } else {
    initHud(containerId, chartColor, texteras);
    const fn2 = hudPlayFns.get(containerId);
    if (fn2) fn2();
  }
}

// ── Full article builder ────────────────────────────────────────────────────
export function articleFull(idx, project) {
  const header = `
    <div class="article-header">
      ${articleTitle(project.title)}
      <span class="title-slash"></span>
      ${articleSubtitle(project.subtitle)}
      <span class="title-chevron">&gt;</span>
    </div>`;

  const parts = [articleIndex(idx), header];

  if (project.hud) parts.unshift(articleHud(project.chart2d?.color || "#00e5ff", idx));
  if (project.description) parts.push(articleDescription(project.description));
  if (project.tags) parts.push(articleTags(project.tags));
  if (project.specs) parts.push(articleSpecs(project.specs));
  if (project.lines) parts.push(articleLines(project.lines));
  if (project.stack) parts.push(articleStack(project.stack));
  if (project.linkLive || project.linkSource) parts.push(articleLinks(project.linkLive, project.linkSource, project.linkLiveLabel, project.linkSourceLabel));

  return parts.filter(Boolean).join("\n");
}
