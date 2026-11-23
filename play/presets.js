// play/presets.js
// Starting patterns for visitors who have never written one. Strudel syntax;
// each `$:` line is one layer (one row of the course).
export const presets = [
  {
    name: 'steady',
    code: `setcps(0.5)
$: s("bd ~ bd ~").gain(1.1)
$: s("~ sd").gain(1.2)
$: s("hh*8").gain(".4 .7")`,
  },
  {
    name: 'melodic',
    code: `setcps(0.5)
$: s("bd ~ ~ bd")
$: s("~ cp")
$: note("<c3 e3 g3 b3> ~ [e3 g3] ~").s("sawtooth").lpf(1400).release(.2)
$: s("hh*4").gain(.5)`,
  },
  {
    name: 'busy',
    code: `setcps(0.55)
$: s("bd(5,8)").gain(1.2)
$: s("sd(3,8,2)").gain(1.4)
$: s("hh*16").gain(".3 .6")
$: s("arpy*4").n("<0 2 4 7>")`,
  },
  {
    name: 'slow',
    code: `setcps(0.4)
$: s("bd ~ ~ ~ bd ~ ~ ~")
$: note("c2 ~ ~ [g1 c2]").s("triangle").release(.3)
$: s("~ ~ cp ~").room(.6)`,
  },
];
