export function untilNextOnset(items) {
  const onsets = new Map();
  for (const { pat, on } of items) {
    if (!onsets.has(pat)) onsets.set(pat, []);
    onsets.get(pat).push(on);
  }
  for (const list of onsets.values()) list.sort((a, z) => a - z);
  return items.map(({ pat, on, off }) => {
    const next = onsets.get(pat).find((t) => t > on);
    return next === undefined ? off : Math.min(off, next);
  });
}
