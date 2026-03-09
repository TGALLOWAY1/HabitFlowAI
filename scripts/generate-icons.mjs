/**
 * Generates PWA icons from icon.svg using sharp.
 * Run with: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const svgPath = join(publicDir, 'icon.svg');
const svgBuffer = readFileSync(svgPath);

const icons = [
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of icons) {
  const outPath = join(publicDir, name);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✓ Generated ${name} (${size}x${size})`);
}

console.log('All icons generated!');
