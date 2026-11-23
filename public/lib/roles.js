export const ROLES = ['hurdle', 'wall', 'platform', 'coin', 'track', 'bg', 'ignore'];

function fieldMatches(key, cond, e) {
  const v = e[key];
  if (key === 'pat') return v !== undefined && String(v) === String(cond).replace(/^d/, '');
  if (cond === true) return v !== undefined;
  if (cond === false) return v === undefined;
  if (cond instanceof RegExp) return typeof v === 'string' && cond.test(v);
  if (Array.isArray(cond)) return typeof v === 'number' && v >= cond[0] && v <= cond[1];
  return v === cond;
}

export function classify(e, config, allowed = ROLES, fallback = 'ignore') {
  if (allowed.includes(e.vrole)) return e.vrole;
  for (const rule of config.rules ?? []) {
    if (Object.entries(rule.match ?? {}).every(([k, c]) => fieldMatches(k, c, e))) return rule.role;
  }
  return fallback;
}

export function mapField(spec, e) {
  const [lo, hi] = spec.out;
  const key = [spec.from].flat().find((k) => typeof e[k] === 'number');
  if (key === undefined) return spec.default ?? (lo + hi) / 2;
  const t = Math.min(Math.max((e[key] - spec.in[0]) / (spec.in[1] - spec.in[0]), 0), 1);
  return lo + t * (hi - lo);
}
