function onSurface(x, s) {
  return x >= s.l - 1 && x <= s.r + 1;
}

export function stepBomb(bomb, dt, xAt, surfaces, ground, gravity) {
  if (bomb.resting) {
    const x = xAt(bomb.bc);
    if (bomb.y >= ground || surfaces.some((s) => onSurface(x, s) && s.t === bomb.y)) return;
    bomb.resting = false;
    bomb.vy = 0;
  }
  bomb.bc += bomb.vx * dt;
  const y0 = bomb.y;
  bomb.vy += gravity * dt;
  bomb.y += bomb.vy * dt;
  if (bomb.vy < 0) return;
  const x = xAt(bomb.bc);
  const tops = surfaces.filter((s) => onSurface(x, s) && y0 <= s.t && bomb.y >= s.t).map((s) => s.t);
  if (bomb.y >= ground) tops.push(ground);
  if (!tops.length) return;
  bomb.y = Math.min(...tops);
  bomb.resting = true;
  bomb.vx = 0;
  bomb.vy = 0;
}

export function inBlast(box, cx, cy, r) {
  const dx = Math.max(box.l - cx, 0, cx - box.r);
  const dy = Math.max(box.t - cy, 0, cy - box.b);
  return dx * dx + dy * dy <= r * r;
}
