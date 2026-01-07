import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconPath = join(__dirname, '../public/icon.png');
const publicDir = join(__dirname, '../public');

const sizes = [192, 512];

async function generateIcons() {
  const iconBuffer = readFileSync(iconPath);

  // Get image metadata
  const metadata = await sharp(iconBuffer).metadata();
  const { width, height } = metadata;

  // Create a rounded rectangle mask
  const radius = Math.min(width, height) * 0.225; // 22.5% radius for rounded corners

  const roundedCorners = Buffer.from(
    `<svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`
  );

  // Apply the rounded corner mask
  const processedIcon = await sharp(iconBuffer)
    .composite([{
      input: roundedCorners,
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();

  for (const size of sizes) {
    await sharp(processedIcon)
      .resize(size, size)
      .png()
      .toFile(join(publicDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // Also save the main processed icon
  await sharp(processedIcon)
    .png()
    .toFile(join(publicDir, 'icon-transparent.png'));
  console.log('Generated icon-transparent.png');

  console.log('All icons generated successfully with rounded corners!');
}

generateIcons().catch(console.error);
