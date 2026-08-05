let GUI = null;
let instance = null;

if (import.meta.env.DEV) {
  const mod = await import("lil-gui");
  GUI = mod.default;
}

function createNoopProxy() {
  const noop = () => proxy;
  const proxy = new Proxy(noop, {
    get(target, prop) {
      if (prop === "then") return undefined;
      if (prop === "domElement") return { style: new Proxy({}, { get: () => "", set: () => true }) };
      return proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

export function getGUI() {
  if (!import.meta.env.DEV) {
    return createNoopProxy();
  }

  if (!instance && GUI) {
    instance = new GUI({ title: "Controls" });
    instance.domElement.style.display = "block";
  }
  return instance;
}
