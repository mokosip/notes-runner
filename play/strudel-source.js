// play/strudel-source.js
// Strudel as the event source for viz scenes, so they run in a browser without
// Tidal, SuperDirt or the bridge. Same shape as demo.js / the bridge sockets:
//   onEvent(e)        when a note sounds (Tidal-style fields, cycle = onset)
//   onForecast(snap)  every 100 ms: notes from now - 1/4 to now + 2 cycles
// plus kill({ pat, on }) to drop a note before it is scheduled.
//
// Strudel is AGPL-3.0-or-later; see LICENSE at the repository root.
import {
  initStrudel,
  evaluate,
  hush,
  samples,
  getAudioContext,
  noteToMidi,
} from 'https://unpkg.com/@strudel/web@1.3.0/dist/index.mjs';

// Same Dirt-Samples commit as wtpm-web, so both play the same sounds.
const DIRT = 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/c74fc80f8db8038f6a33648ffef5ac00a07ad402/strudel.json';
const FORECAST_MS = 100;
const BEHIND = 0.25;
const AHEAD = 2;

const num = (x) => (x === undefined || x === null ? undefined : Number(x));
const killKey = (pat, on) => `${pat}|${Number(on).toFixed(4)}`;

// Strudel values → the fields the viz scenes expect (Tidal naming and units).
// Strudel notes are names or MIDI numbers; Tidal's note 0 is c5 (MIDI 60).
function toFields(value) {
  const fields = { ...value };
  delete fields.id;
  if (typeof fields.note === 'string') {
    try { fields.note = noteToMidi(fields.note) - 60; } catch { delete fields.note; }
  } else if (typeof fields.note === 'number') {
    fields.note -= 60;
  }
  return fields;
}

export async function startStrudel({ onEvent, onForecast }) {
  let pattern = null; // the evaluated pattern, before kills
  let cps = 0.5;
  // Audible clock: the last note's cycle and the audio time it sounds at.
  let anchor = null; // { cycle, audioTime }
  const killed = new Set();

  // Strudel keeps `$:` layer names out of the note values, so the sound name stands
  // in for Tidal's pattern id: a shot removes that sound at that onset, not the
  // whole chord of layers that share it.
  const patOf = (hap) => String(hap.value?.id ?? hap.value?.s ?? '1');

  const audibleCycle = () => {
    if (!anchor) return 0;
    return anchor.cycle + (getAudioContext().currentTime - anchor.audioTime) * cps;
  };

  const onTrigger = (hap, currentTime, hapCps, targetTime) => {
    cps = hapCps;
    const on = Number(hap.whole.begin);
    anchor = { cycle: on, audioTime: targetTime };
    const fields = toFields(hap.value);
    const event = {
      _id_: patOf(hap),
      cps,
      cycle: on,
      delta: Number(hap.duration) / cps,
      _received: Date.now(),
      ...fields,
    };
    // Strudel schedules ahead; report the note when it actually sounds.
    setTimeout(() => onEvent(event), Math.max(0, (targetTime - currentTime) * 1000));
  };

  // iOS Safari mutes web audio with the silent switch unless the page plays as media (Safari 17+).
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
  const repl = await initStrudel({
    prebake: () => samples(DIRT),
    // Every evaluation passes through here: keep the clean pattern for the
    // forecast, and schedule a version that skips killed notes and reports triggers.
    editPattern: (pat) => {
      pattern = pat;
      return pat
        .filterHaps((hap) => !hap.hasOnset() || !killed.has(killKey(patOf(hap), hap.whole.begin)))
        .onTrigger(onTrigger, false);
    },
  });

  let seq = 0;
  setInterval(() => {
    if (!pattern || !repl.scheduler.started) return;
    const now = anchor ? audibleCycle() : repl.scheduler.now();
    const from = now - BEHIND;
    const to = now + AHEAD;
    const events = pattern.queryArc(from, to)
      .filter((hap) => hap.hasOnset())
      .map((hap) => ({ pat: patOf(hap), on: Number(hap.whole.begin), off: Number(hap.whole.end), ...toFields(hap.value) }));
    onForecast({ seq: seq++, from, to, now, cps, received: Date.now(), events });
  }, FORECAST_MS);

  return {
    play: (code) => evaluate(code),
    stop: () => { hush(); anchor = null; },
    kill: ({ pat, on }) => killed.add(killKey(pat, on)),
    get started() { return repl.scheduler.started; },
  };
}
