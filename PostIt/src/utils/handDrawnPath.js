// Deterministic "hand-drawn" wobble from coordinates (no random so path is stable)
const JITTER = 4;
function wobble(seed) {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

export function getHandDrawnPath(x1, y1, x2, y2) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const ctrlX = midX + wobble(x1 + y2) * JITTER;
  const ctrlY = midY + wobble(y1 + x2) * JITTER;
  return `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`;
}

// Alternative: multi-segment path for more organic feel
export function getHandDrawnPathOrganic(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(3, Math.floor(dist / 60));
  let path = `M ${x1} ${y1}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + dx * t + (Math.random() - 0.5) * JITTER * 2;
    const y = y1 + dy * t + (Math.random() - 0.5) * JITTER * 2;
    path += ` L ${x} ${y}`;
  }
  path += ` L ${x2} ${y2}`;
  return path;
}
