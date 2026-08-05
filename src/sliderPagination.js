import gsap from "gsap";
import { PROJECTS } from "./projects.js";
import { isMobile } from "./mobile.js";

function drawSlash(ctx, w, h, skewDeg, color, alpha) {
  const cw = parseFloat(ctx.canvas.style.width);
  const ch = parseFloat(ctx.canvas.style.height);
  ctx.clearRect(0, 0, cw, ch);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;

  const dx = h * Math.tan((skewDeg * Math.PI) / 180);
  const ox = (cw - w) / 2;
  const oy = (ch - h - dx) / 2;

  ctx.beginPath();
  ctx.moveTo(ox, oy + dx);
  ctx.lineTo(ox + w, oy);
  ctx.lineTo(ox + w, oy + h);
  ctx.lineTo(ox, oy + h + dx);
  ctx.closePath();
  ctx.fill();
}

function sizeCanvas(canvas, slashW, slashH, skewDeg) {
  const dpr = window.devicePixelRatio || 1;
  const maxDx = slashH * Math.tan((skewDeg * Math.PI) / 180);
  const w = slashW;
  const h = slashH + maxDx;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function createSliderPagination(container, projectSlider, gui) {
  const NUM = PROJECTS.length;

  const cfg = {
    slashWidth: 25,
    activeWidth: 40,
    height: 10,
    activeHeight: 14,
    skew: 65,
    gap: 0,
    overlap: -5,
    defaultAlpha: 0.35,
    hoverAlpha: 0.65,
    activeAlpha: 1.0,
    bloom: 20,
    activeBloom: 60,
    hoverBloom: 60,
    animDuration: 0.8,
  };

  const wrapper = document.createElement("div");
  wrapper.className = "pagination-wrapper";
  wrapper.style.gap = cfg.gap + "px";
  container.appendChild(wrapper);

  const DESKTOP_CFG = {
    slashWidth: cfg.slashWidth, activeWidth: cfg.activeWidth,
    height: cfg.height, activeHeight: cfg.activeHeight,
    overlap: cfg.overlap, gap: cfg.gap,
  };
  const MOBILE_CFG = {
    slashWidth: 20, activeWidth: 28,
    height: 4, activeHeight: 8,
    overlap: 0, gap: 2,
  };

  function applyDeviceMode() {
    const m = isMobile();
    const c = m ? MOBILE_CFG : DESKTOP_CFG;
    cfg.slashWidth = c.slashWidth;
    cfg.activeWidth = c.activeWidth;
    cfg.height = c.height;
    cfg.activeHeight = c.activeHeight;
    cfg.overlap = c.overlap;
    cfg.gap = c.gap;
    wrapper.style.gap = cfg.gap + "px";
    applyOverlap();
    items.forEach((it) => {
      const w = it.isActive ? cfg.activeWidth : cfg.slashWidth;
      const h = it.isActive ? cfg.activeHeight : cfg.height;
      sizeCanvas(it.canvas, w, h, cfg.skew);
      it.width = w;
      it.height = h;
      it.alpha = it.isActive ? cfg.activeAlpha : cfg.defaultAlpha;
      const col = it.isActive ? it.color : "#ffffff";
      drawSlash(it.ctx, it.width, it.height, cfg.skew, col, it.alpha);
      it.wrap.style.padding = m ? "12px 6px" : "0";
    });
  }

  function applyOverlap() {
    items.forEach((it) => {
      it.wrap.style.marginTop = cfg.overlap + "px";
    });
  }

  const items = [];

  for (let i = 0; i < NUM; i++) {
    const project = PROJECTS[i];
    const color = project.color || "#ffffff";

    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      overflow: "visible",
      lineHeight: "0",
      cursor: "pointer",
      touchAction: "manipulation",
    });

    const canvas = document.createElement("canvas");
    const ctx = sizeCanvas(canvas, cfg.slashWidth, cfg.height, cfg.skew);

    const item = {
      canvas,
      wrap,
      ctx,
      color,
      index: i,
      width: cfg.slashWidth,
      height: cfg.height,
      alpha: cfg.defaultAlpha,
      isActive: false,
      _tween: null,
    };

    drawSlash(ctx, item.width, item.height, cfg.skew, "#ffffff", item.alpha);

    wrap.addEventListener("mouseenter", () => {
      if (item.isActive) return;
      gsap.killTweensOf(item);
      gsap.to(item, {
        alpha: cfg.hoverAlpha,
        duration: 0.2,
        onUpdate: () => drawSlash(item.ctx, item.width, item.height, cfg.skew, item.color, item.alpha),
      });
      drawSlash(ctx, item.width, cfg.height, cfg.skew, item.color, cfg.hoverAlpha);
      wrap.style.filter = `drop-shadow(0 0 ${cfg.hoverBloom}px ${item.color})`;
    });

    wrap.addEventListener("mouseleave", () => {
      if (item.isActive) return;
      gsap.killTweensOf(item);
      gsap.to(item, {
        alpha: cfg.defaultAlpha,
        duration: 0.2,
        onUpdate: () => drawSlash(item.ctx, item.width, item.height, cfg.skew, "#ffffff", item.alpha),
      });
      drawSlash(ctx, item.width, cfg.height, cfg.skew, "#ffffff", cfg.defaultAlpha);
      wrap.style.filter = "none";
    });

    wrap.addEventListener("click", () => {
      projectSlider.setActiveShieldExternal(item.index);
    });

    wrap.appendChild(canvas);
    wrapper.appendChild(wrap);
    items.push(item);
  }

  applyDeviceMode();

  if (isMobile()) setActive(0);

  function showWindow(index) {
    items.forEach((item, k) => {
      item.wrap.style.display = "";
      item.index = k;
      item.color = PROJECTS[k].color || "#ffffff";
    });
  }

  function setActive(index) {
    showWindow(index);
    items.forEach((item) => {
      const wantActive = item.index === index;

      if (item._tween) { item._tween.kill(); item._tween = null; }

      const fromW = item.width;
      const fromH = item.height;
      const fromA = item.alpha;
      const toW = wantActive ? cfg.activeWidth : cfg.slashWidth;
      const toH = wantActive ? cfg.activeHeight : cfg.height;
      const toA = wantActive ? cfg.activeAlpha : cfg.defaultAlpha;
      const bloom = wantActive ? cfg.activeBloom : 0;

      item.isActive = wantActive;
      item.wrap.style.filter = wantActive
        ? `drop-shadow(0 0 ${bloom}px ${item.color})`
        : "none";

      if (Math.abs(fromW - toW) < 0.01 && Math.abs(fromH - toH) < 0.01 && Math.abs(fromA - toA) < 0.01) {
        item.width = toW;
        item.height = toH;
        item.alpha = toA;
        sizeCanvas(item.canvas, toW, toH, cfg.skew);
        const col = wantActive ? item.color : "#ffffff";
        drawSlash(item.ctx, toW, toH, cfg.skew, col, toA);
        return;
      }

      sizeCanvas(item.canvas, Math.max(fromW, toW), Math.max(fromH, toH), cfg.skew);

      const proxy = { w: fromW, h: fromH, a: fromA };
      item._tween = gsap.to(proxy, {
        w: toW,
        h: toH,
        a: toA,
        duration: cfg.animDuration,
        ease: "power2.out",
        onUpdate: () => {
          item.width = proxy.w;
          item.height = proxy.h;
          item.alpha = proxy.a;
          const col = item.isActive ? item.color : "#ffffff";
          drawSlash(item.ctx, proxy.w, proxy.h, cfg.skew, col, proxy.a);
        },
        onComplete: () => {
          item._tween = null;
          sizeCanvas(item.canvas, toW, toH, cfg.skew);
          const col = item.isActive ? item.color : "#ffffff";
          drawSlash(item.ctx, toW, toH, cfg.skew, col, toA);
        },
      });
    });
  }

  function onResize() {
    applyDeviceMode();
    showWindow(projectSlider.getActiveIndex());
    items.forEach((item) => {
      const h = item.isActive ? cfg.activeHeight : cfg.height;
      const w = item.isActive ? cfg.activeWidth : cfg.slashWidth;
      sizeCanvas(item.canvas, w, h, cfg.skew);
      const col = item.isActive ? item.color : "#ffffff";
      drawSlash(item.ctx, item.width, item.height, cfg.skew, col, item.alpha);
    });
  }
  window.addEventListener("resize", onResize);

  if (gui) {
    const f = gui.addFolder("Pagination");
    f.close();
    f.add(cfg, "slashWidth", 1, 12, 1).name("Width").onchange = () => items.forEach((it) => { const h = it.isActive ? cfg.activeHeight : cfg.height; sizeCanvas(it.canvas, it.width, h, cfg.skew); drawSlash(it.ctx, it.width, it.height, cfg.skew, it.color, it.alpha); });
    f.add(cfg, "activeWidth", 1, 60, 1).name("Active Width");
    f.add(cfg, "height", 10, 60, 1).name("Height").onChange(() => items.forEach((it) => drawSlash(it.ctx, it.width, it.height, cfg.skew, it.color, it.alpha)));
    f.add(cfg, "activeHeight", 20, 100, 1).name("Active Height");
    f.add(cfg, "skew", 0, 60, 1).name("Skew").onChange(() => items.forEach((it) => { const h = it.isActive ? cfg.activeHeight : cfg.height; sizeCanvas(it.canvas, it.width, h, cfg.skew); drawSlash(it.ctx, it.width, it.height, cfg.skew, it.color, it.alpha); }));
    f.add(cfg, "gap", 0, 30, 1).name("Gap").onChange(() => { wrapper.style.gap = cfg.gap + "px"; });
    f.add(cfg, "overlap", -30, 10, 1).name("Overlap").onChange(() => applyOverlap());
    f.add(cfg, "defaultAlpha", 0, 1, 0.05).name("Alpha").onChange(() => items.forEach((it) => drawSlash(it.ctx, it.width, it.height, cfg.skew, it.color, it.alpha)));
    f.add(cfg, "activeAlpha", 0, 1, 0.05).name("Active Alpha");
    f.add(cfg, "activeBloom", 0, 40, 1).name("Bloom");
    f.add(cfg, "hoverBloom", 0, 40, 1).name("Hover Bloom");
  }

  function dispose() {
    window.removeEventListener("resize", onResize);
    items.forEach((it) => { if (it._tween) it._tween.kill(); });
    wrapper.remove();
  }

  return { setActive, items, cfg, wrapper, dispose };
}
