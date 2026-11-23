// play/runner.config.js
// Runner config for the browser version (Strudel instead of Tidal). Same format
// as public/runner.config.js; sound names follow Strudel and Dirt-Samples.
export default {
  // The Strudel source already reports the audible cycle; no extra lead.
  audioLead: 0,
  pxPerCycle: 150,
  ahead: 2,
  // Site palette: what has passed fades, the aim and explosions use the accent.
  pastColor: '#a9a69e',
  targetColor: '#1f3fd6',
  // Strudel commits notes ~0.1–0.2 s before they sound (latency + one tick).
  killLead: 0.3,
  aimTolerance: 8,
  bombFuse: 2,
  bombRadius: 28,
  bombThrow: 240,
  rules: [
    { match: { s: /^(bd|kick|clubkick|reverbkick|stomp|bassdm)/ }, role: 'hurdle' },
    { match: { s: /^(sd|sn|cp|clap|realclaps|rs|clak)/ }, role: 'wall' },
    { match: { s: /^(hh|oh|hc|sh|lc|perc|breaks|amencutup|jungle)/ }, role: 'track' },
    { match: { s: /^(noise|nature|vinyl|pad)/ }, role: 'bg' },
    { match: { s: /^(sawtooth|square|triangle|sine|arpy|bass|jvbass|east|sitar|sax|notes|newnotes|superpiano)/ }, role: 'platform' },
    { match: {}, role: 'track' },
  ],
  roles: {
    hurdle: { height: { from: 'gain', in: [0.5, 1.5], out: [9, 27] } },
    wall: { height: { from: 'gain', in: [0.5, 1.5], out: [18, 42] } },
    platform: { y: { from: ['note', 'n'], in: [-36, 24], out: [14, 90] }, length: 'next' },
    coin: { y: { from: ['note', 'n'], in: [0, 24], out: [10, 24] } },
    bg: { y: { from: ['note', 'n'], in: [-12, 24], out: [105, 175] } },
  },
  glyphs: {},
};
