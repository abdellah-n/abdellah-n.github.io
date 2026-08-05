const MQ =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(max-width: 768px)")
    : null;

export function isMobile() {
  if (MQ) return MQ.matches;
  return window.innerWidth < 768;
}
