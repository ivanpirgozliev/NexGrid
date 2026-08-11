/*
  Generates the Microsoft Store tile images in build/appx/ from the same
  geometry as electron/assets/icon.svg, so the tiles cannot drift from the app
  icon. Run with: node scripts/generate-appx-assets.mjs

  sharp is not a project dependency — install it just for this:
    npm install --no-save sharp
*/
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'appx');
mkdirSync(outDir, { recursive: true });

const BG = '#0d1117';
const CYAN = '#00e5ff';
const TEAL = '#00c4d9';

// Block positions lifted from icon.svg, in its 400x400 coordinate space.
const COLUMN_Y = [65, 125, 185, 245, 305];
const BLOCKS = [
  ...COLUMN_Y.map((y) => ({ x: 45, y, fill: CYAN, opacity: 0.95 })),
  { x: 105, y: 125, fill: TEAL, opacity: 0.9 },
  { x: 165, y: 185, fill: TEAL, opacity: 0.9 },
  { x: 225, y: 245, fill: TEAL, opacity: 0.9 },
  ...COLUMN_Y.map((y) => ({ x: 285, y, fill: CYAN, opacity: 0.95 })),
];

// Bounding box of the glyph, used to centre it on non-square tiles.
const GLYPH = { minX: 45, minY: 65, maxX: 339, maxY: 359 };
const GLYPH_W = GLYPH.maxX - GLYPH.minX;
const GLYPH_H = GLYPH.maxY - GLYPH.minY;
const GLYPH_CX = (GLYPH.minX + GLYPH.maxX) / 2;
const GLYPH_CY = (GLYPH.minY + GLYPH.maxY) / 2;

function blocksMarkup() {
  return BLOCKS.map(
    ({ x, y, fill, opacity }) =>
      `<rect x="${x}" y="${y}" width="54" height="54" rx="6" fill="${fill}" opacity="${opacity}"/>`
  ).join('');
}

function gridMarkup(width, height) {
  const lines = [];
  for (let y = 40; y < height; y += 40) {
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`);
  }
  for (let x = 40; x < width; x += 40) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`);
  }
  return `<g opacity="0.07" stroke="${CYAN}" stroke-width="0.7" fill="none">${lines.join('')}</g>`;
}

/*
  Square tiles are full-bleed: Windows draws them inside its own shape, so the
  rounded corners from the app icon would show as dark notches against the
  tile background.
*/
function squareSvg() {
  return `<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="400" fill="${BG}"/>
    ${gridMarkup(400, 400)}
    ${blocksMarkup()}
  </svg>`;
}

/*
  The wide tile keeps the glyph at its own aspect ratio and centres it, rather
  than stretching a square mark into a 2:1 box.
*/
function wideSvg(width, height) {
  const scale = (height * 0.72) / GLYPH_H;
  const tx = width / 2;
  const ty = height / 2;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${BG}"/>
    ${gridMarkup(width, height)}
    <g transform="translate(${tx} ${ty}) scale(${scale}) translate(${-GLYPH_CX} ${-GLYPH_CY})">
      ${blocksMarkup()}
    </g>
  </svg>`;
}

/*
  Store listing art. Unlike the tiles, these are uploaded by hand in Partner
  Center rather than embedded in the package, so they live in build/store/.
  The poster is 9:16 and the box art 1:1, both rendered at the larger of the
  two sizes Microsoft accepts so they stay crisp when scaled down.
*/
function storeArtSvg(width, height) {
  const isPortrait = height > width;

  /*
    Portrait art carries a wordmark under the glyph, so the mark is smaller and
    sits above centre to leave the text clear air. The square version is the
    glyph alone, centred.
  */
  /*
    Sized against the shorter edge, so a 16:9 canvas gets a glyph that fits its
    height instead of one scaled off the top and bottom.
  */
  const glyphSize = Math.min(width, height) * (isPortrait ? 0.52 : 0.55);
  const scale = glyphSize / GLYPH_W;
  const cy = isPortrait ? height * 0.42 : height / 2;

  const wordmark = !isPortrait
    ? ''
    : `<text x="${width / 2}" y="${height * 0.74}" text-anchor="middle"
             font-family="Segoe UI, Arial, sans-serif" font-weight="700"
             font-size="${width * 0.11}" fill="#ffffff" letter-spacing="${width * 0.004}">NexGrid</text>`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${BG}"/>
    ${gridMarkup(width, height)}
    <g transform="translate(${width / 2} ${cy}) scale(${scale}) translate(${-GLYPH_CX} ${-GLYPH_CY})">
      ${blocksMarkup()}
    </g>
    ${wordmark}
  </svg>`;
}

const targets = [
  { name: 'Square44x44Logo.png', size: 44, svg: squareSvg() },
  { name: 'Square71x71Logo.png', size: 71, svg: squareSvg() },
  { name: 'Square150x150Logo.png', size: 150, svg: squareSvg() },
  { name: 'Square310x310Logo.png', size: 310, svg: squareSvg() },
  { name: 'StoreLogo.png', size: 50, svg: squareSvg() },
  { name: 'Wide310x150Logo.png', width: 310, height: 150, svg: wideSvg(310, 150) },
];

const storeDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'store');
mkdirSync(storeDir, { recursive: true });

const storeTargets = [
  { name: 'PosterArt1440x2160.png', width: 1440, height: 2160 },
  { name: 'BoxArt2160x2160.png', width: 2160, height: 2160 },
  // Super hero art must not carry the product title, so it is glyph-only.
  { name: 'SuperHeroArt3840x2160.png', width: 3840, height: 2160 },
].map((t) => ({ ...t, svg: storeArtSvg(t.width, t.height), dir: storeDir }));

for (const t of [...targets.map((t) => ({ ...t, dir: outDir })), ...storeTargets]) {
  const width = t.width ?? t.size;
  const height = t.height ?? t.size;

  const png = await sharp(Buffer.from(t.svg))
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();

  writeFileSync(join(t.dir, t.name), png);
  console.log(`✓ ${t.name.padEnd(24)} ${width}x${height}`);
}

console.log(`\nWrote ${targets.length} tiles to build/appx/ and ${storeTargets.length} images to build/store/`);
