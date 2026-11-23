# notes-runner: a game played by notes

- A jump-and-run where the pattern is the level, played in the browser with Strudel; visitors need nothing installed.
- Split from `tidal-viz` (commit `2735eb3`): `play/` is the app; `public/` holds the runner scene and the libraries it imports from tidal-viz, in the same layout so the relative imports stay as they are.
- License: AGPL-3.0-or-later (Strudel is AGPL); see `LICENSE`. Applies to the whole repository.
- Embedded on konschack.de through the instrument stage (`?embed=1`).

## Run

```sh
npm start   # python3 -m http.server 8767 from the repo root
npm test    # node --test, no dependencies
```

- Open http://localhost:8767/play/ (served from the repo root, because `main.js` imports `../public/scenes/runner.js`).
- Sound starts on "Play" (browser autoplay rule). Samples load from Dirt-Samples on GitHub on first play.
- Deploy: static files only. Serve the repo root (`LICENSE`, `play/`, `public/`) as is.

## How it works

- `strudel-source.js`: same interface as `public/demo.js` / the bridge sockets.
  - `onForecast`: every 100 ms, `pattern.queryArc(now − 1/4, now + 2)`, same snapshot shape as `tidal/forecast.hs`.
  - `onEvent`: Strudel's `onTrigger`, delivered when the note actually sounds (audio time, not scheduling time).
  - `kill({ pat, on })`: the scheduled pattern is wrapped in `filterHaps`, so a shot note is dropped before Strudel schedules it. Replaces the bridge → Tidal `vizKillable` round trip.
  - Pattern id: Strudel keeps `$:` layer names out of note values, so the sound name (`s`) stands in for Tidal's `_id_`. A shot removes that sound at that onset; other sounds at the same onset still play.
  - Notes: Strudel note names / MIDI numbers → Tidal semitones (note 0 = c5).
- `runner.config.js`: browser rules (Strudel synth names) and site colours for past / aim.
- `presets.js`: four starting patterns in Strudel syntax.
- `main.js`: wires source and scene; sets `runner.colors` (ink on paper, cobalt accent). Without `colors` the scene keeps the viz palette.
- Space / B only act while the stage has focus; Shoot / Bomb buttons for touch.

## Measured (headless Chromium, 23 Nov 2026)

- Shots and bombs: 11 notes killed, none of them played; other sounds at the same onset kept playing.
- Visual vs. audio clock: obstacles cross the "now" line within ±0.001 cycles of the note sounding (17 notes).
- All four presets run; roles come out as expected (hurdle bd, wall sd/cp, platform sawtooth/arpy/triangle, track hh).
- Not yet tried: real audio on a phone, the minimum `killLead` (still 0.3 s from the Tidal setup).

## Differences from the Tidal setup

- Strudel syntax: `s("bd ~ bd ~")`, one `$:` line per layer.
- No SuperDirt synths (`superfm`, `superpiano`…); use Strudel's `sawtooth`, `square`, `triangle`, `sine` or samples.
