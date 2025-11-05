// Simple script to create placeholder PNG icons
// Note: For production, use proper icon design tools

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const iconDir = path.join(__dirname, 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Create SVG icons that can be converted to PNG
const sizes = [16, 48, 128];

const createSVG = (size) => {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#0A66C2"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-size="${size * 0.5}" font-family="Arial, sans-serif" font-weight="bold">LB</text>
</svg>`;
};

sizes.forEach(size => {
  const svgContent = createSVG(size);
  const svgPath = path.join(iconDir, `icon${size}.svg`);
  fs.writeFileSync(svgPath, svgContent);
  console.log(`Created ${svgPath}`);
});

console.log('\nPlaceholder SVG icons created!');
console.log('For PNG icons:');
console.log('1. Open each SVG in a browser');
console.log('2. Take a screenshot or use an SVG to PNG converter');
console.log('3. Save as icon16.png, icon48.png, icon128.png');
console.log('\nOr use an online tool like: https://cloudconvert.com/svg-to-png');
