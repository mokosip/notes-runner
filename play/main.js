// play/main.js
// The runner scene, driven by Strudel in the browser instead of Tidal + SuperDirt.
import { runner } from '../public/scenes/runner.js';
import config from './runner.config.js';
import { presets } from './presets.js';
import { startStrudel } from './strudel-source.js';

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const canvas = $('screen');
const ctx = canvas.getContext('2d');
const code = $('code');
const status = $('status');
const errorBox = $('error');

// Embedded in a host page: index.html's head sets .embed before the first paint.
// Esc is passed up because key presses inside a frame never reach the host.
if (document.documentElement.classList.contains('embed')) {
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.parent.postMessage({ type: 'moko:close' }, '*');
  });
}

// The scene in the site's colours: ink on paper, the accent for aim and explosions.
runner.config = config;
runner.loading = Promise.resolve(); // config is static here; skip the viz hot-reload import
runner.colors = { fg: css('--ink'), hero: { k: css('--ink'), w: css('--paper'), r: css('--accent') } };

let source = null;
const ready = startStrudel({
  onEvent: (e) => runner.onEvent({ ...e, pat: e._id_ }, performance.now()),
  onForecast: (snap) => runner.onForecast(snap, performance.now()),
}).then((s) => {
  source = s;
  runner.send = (msg) => { if (msg.kill) source.kill(msg.kill); };
  status.textContent = '';
  return s;
}).catch((err) => {
  status.textContent = 'Could not load the sound engine.';
  console.error(err);
});
status.textContent = 'loading sounds…';

// ---------- patterns ----------
let current = 0;
const presetButtons = presets.map((p, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = p.name;
  b.addEventListener('click', () => { choose(i); play(); });
  $('presets').append(b);
  return b;
});
const choose = (i) => {
  current = i;
  code.value = presets[i].code;
  presetButtons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
};
choose(0);

const play = async () => {
  const s = await ready;
  if (!s) return;
  errorBox.textContent = '';
  try {
    const result = await s.play(code.value);
    if (!result) errorBox.textContent = 'That pattern did not run. Check the browser console for details.';
  } catch (err) {
    errorBox.textContent = String(err.message ?? err);
  }
  $('idle').hidden = true;
  stage.focus({ preventScroll: true });
};
$('play').addEventListener('click', play);
$('run').addEventListener('click', play);
$('stop').addEventListener('click', async () => { (await ready)?.stop(); });
code.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); play(); }
});
code.addEventListener('input', () => presetButtons.forEach((b) => b.setAttribute('aria-pressed', 'false')));

// ---------- game input: only while the stage has focus ----------
stage.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); runner.onKey(' '); }
  if (e.key === 'b' || e.key === 'B') runner.onKey('b');
});
$('shoot').addEventListener('click', () => runner.onKey(' '));
$('bomb').addEventListener('click', () => runner.onKey('b'));
stage.addEventListener('pointerdown', () => stage.focus({ preventScroll: true }));

// ---------- draw ----------
const resize = () => {
  canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
  canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
};
new ResizeObserver(resize).observe(canvas);
resize();

let last = performance.now();
const frame = (now) => {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (runner.sync) runner.draw(ctx, { w: canvas.clientWidth, h: canvas.clientHeight, dt, now });
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
