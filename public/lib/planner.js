export function buildCourse(towers, platforms, { clear, hop }) {
  const arcs = towers.map(({ on, height }) => ({ t: on, apex: height + clear }));
  for (const p of platforms) {
    arcs.push({ t: p.on, apex: p.height + hop });
    arcs.push({ t: p.off, apex: p.height });
  }
  return { arcs, platforms };
}

export function floorAt(c, platforms) {
  let floor = 0;
  for (const p of platforms) if (c >= p.on && c < p.off && p.height > floor) floor = p.height;
  return floor;
}

export function heroHeight(c, course, gravity) {
  let y = floorAt(c, course.platforms);
  for (const a of course.arcs) {
    const d = c - a.t;
    const v = a.apex - gravity * d * d;
    if (v > y) y = v;
  }
  return y;
}

export function newHero(c) {
  return { y: 0, vy: 0, c, mode: 'normal', until: 0 };
}

export function stepHero(h, c, now, course, o) {
  const dc = Math.min(Math.max(c - h.c, 0), 0.1);
  const target = heroHeight(c, course, o.gravity);
  const planned = heroHeight(h.c, course, o.gravity);
  h.c = c;
  if (h.mode === 'normal') {
    if (planned - h.y > o.snap) {
      h.mode = 'stumble';
      h.until = now + o.stumbleMs;
    } else if (h.y - planned > o.snap) {
      h.mode = 'fall';
      h.vy = 0;
    } else {
      h.y = target;
      return;
    }
  }
  if (h.mode === 'stumble' && now >= h.until) h.mode = 'recover';
  if (h.mode === 'recover') {
    if (target - h.y > o.snap) {
      h.y = Math.min(target, h.y + o.recover * dc);
      return;
    }
    h.mode = h.y - target > o.snap ? 'fall' : 'normal';
    if (h.mode === 'normal') {
      h.y = target;
      return;
    }
  }
  const goal = h.mode === 'stumble' ? floorAt(c, course.platforms) : target;
  if (h.y > goal) {
    h.vy -= 2 * o.gravity * dc;
    h.y += h.vy * dc;
  }
  if (h.y <= goal) {
    h.y = goal;
    h.vy = 0;
    if (h.mode === 'fall') h.mode = 'normal';
  }
}
