import gsap from "gsap";

export function createScrollController(container) {
  if (!container) return null;

  const state = {
    enabled: false,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragStartY: 0,
    scrollStartTop: 0,
    magnetRadius: 100,
  };

  const el = document.createElement("div");
  el.id = "scroll-ctrl";
  el.innerHTML = `
    <svg class="sc-arrow sc-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
    <div class="sc-mid"></div>
    <svg class="sc-arrow sc-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 5v14M19 12l-7 7-7-7"/>
    </svg>
  `;
  document.body.appendChild(el);

  function getCenter() {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function hasScroll() {
    return container.scrollHeight > container.clientHeight + 4;
  }

  function syncToScroll() {
    if (state.isDragging || !state.enabled) return;
    if (!hasScroll()) { el.classList.remove("active"); return; }
    const max = container.scrollHeight - container.clientHeight;
    if (max <= 0) return;
    const ratio = container.scrollTop / max;
    const offsetY = (ratio - 0.5) * 50;
    gsap.to(el, { x: 0, y: offsetY, duration: 0.3, ease: "power2.out", overwrite: "auto" });
  }

  function onWindowMove(e) {
    if (!state.enabled) return;

    if (state.isDragging) {
      const mx = e.clientX - state.dragOffsetX;
      const my = e.clientY - state.dragOffsetY;
      const dx = mx - window.innerWidth / 2;
      const dy = my - window.innerHeight / 2;
      gsap.set(el, { x: dx, y: dy });
      const max = container.scrollHeight - container.clientHeight;
      if (max > 0) {
        const scrollRatio = (my / window.innerHeight);
        container.scrollTop = scrollRatio * max;
      }
      return;
    }

    const c = getCenter();
    const dx = e.clientX - c.x;
    const dy = e.clientY - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < state.magnetRadius) {
      gsap.to(el, { x: dx * 0.3, y: dy * 0.3, scale: 1.05, duration: 0.3, ease: "power2.out", overwrite: "auto" });
    } else {
      const max = container.scrollHeight - container.clientHeight;
      const ratio = max > 0 ? container.scrollTop / max : 0;
      const homeY = (ratio - 0.5) * 50;
      gsap.to(el, { x: 0, y: homeY, scale: 1, duration: 0.4, ease: "elastic.out(1,0.6)", overwrite: "auto" });
    }
  }

  function onDown(e) {
    if (!state.enabled || !hasScroll()) return;
    const c = getCenter();
    const dx = e.clientX - c.x;
    const dy = e.clientY - c.y;
    if (Math.sqrt(dx * dx + dy * dy) > state.magnetRadius) return;
    e.preventDefault();
    state.isDragging = true;
    state.dragOffsetX = e.clientX - window.innerWidth / 2 - dx;
    state.dragOffsetY = e.clientY - window.innerHeight / 2 - dy;
    state.dragStartY = e.clientY;
    state.scrollStartTop = container.scrollTop;
    el.classList.add("dragging");
    gsap.to(el, { scale: 1.1, duration: 0.2, ease: "power2.out", overwrite: "auto" });
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onUp);
  }

  function onUp() {
    if (!state.isDragging) return;
    state.isDragging = false;
    el.classList.remove("dragging");
    window.removeEventListener("pointermove", onWindowMove);
    window.removeEventListener("pointerup", onUp);
    gsap.to(el, { scale: 1, duration: 0.3, ease: "power2.out", overwrite: "auto" });
    syncToScroll();
  }

  window.addEventListener("pointermove", onWindowMove);
  window.addEventListener("pointerdown", onDown);

  let rafId;
  function tick() {
    if (state.enabled && hasScroll()) {
      if (!el.classList.contains("active")) el.classList.add("active");
      syncToScroll();
    } else if (state.enabled && !hasScroll()) {
      el.classList.remove("active");
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  return {
    enable() {
      if (!hasScroll()) return;
      state.enabled = true;
      el.classList.add("active");
    },
    disable() {
      state.enabled = false;
      state.isDragging = false;
      el.classList.remove("active", "dragging");
      gsap.killTweensOf(el);
      gsap.set(el, { x: 0, y: 0, scale: 1 });
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onUp);
    },
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      el.remove();
    },
    syncScroll: syncToScroll,
  };
}
