export function go(path: string): void {
  const next = `#/${path.replace(/^\//, "")}`;
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = next;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}