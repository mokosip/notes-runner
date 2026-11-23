export const HERO_ROWS = [
  '......kkkk......',
  '....kkrrrrkk....',
  '...krrkkkkrrk...',
  '..krrk....krrk..',
  '..krkkkkkkkkkk..',
  '..krkwwwwwwwwk..',
  '.krrrkwwwwwwwwk.',
  'krrrrkwkkkkkkkwr',
  'krkkrkwkwkkkwkwr',
  'krkkrkwkwkkkwkwr',
  'krrrrkwkkkkkkkwr',
  '.kkkkkwwwwwwwwk.',
  '....kkwwwwwwkk..',
  '...kwwkwwwwk.kk.',
  '..kwwwkwwwwkkwwk',
  '.kwwwkwwwwwkwwk.',
  '..kkkwwwwwwkkk..',
  '...kwwwkwwwwk...',
  '..kwwwk..kwwwk..',
  '..kwwk....kwwwk.',
  '...kk......kkk..',
];

export const HERO_COLORS = { k: '#000000', w: '#ffffff', r: '#ff2a2a' };

export function renderSprite(rows, colors) {
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!colors[ch]) return;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}
