const sharp = require('sharp');
const path = require('path');

async function createIcon() {
  const width = 256;
  const height = 256;

  const svgBuffer = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" rx="48" ry="48" fill="#0f1923" />
      <!-- The amber strip spans the entire width but stops at the bottom rounded corners.
           To clip it properly, we can use a clipPath, or just draw a rect and rely on 
           the overall svg not having rounded corners unless we clip it. 
           Wait, SVG 'rect' with rx/ry rounds ALL corners. If we just draw a strip at the bottom, 
           it will overlap the rounded corners.
           A simpler way: draw the base rounded rect. Draw the GS text. 
           For the strip, we can just draw a rounded rect at the bottom, or clip it.
           Instead of SVG clipping, let's just make the background full, and visually
           it will be an icon. -->
      <clipPath id="rounded">
        <rect width="256" height="256" rx="40" ry="40" />
      </clipPath>
      
      <g clip-path="url(#rounded)">
        <rect width="256" height="256" fill="#0f1923" />
        <rect x="0" y="216" width="256" height="40" fill="#f59e0b" />
        <text x="128" y="160" font-family="Arial, system-ui, sans-serif" font-weight="bold" font-size="110" fill="#ffffff" text-anchor="middle">GS</text>
      </g>
    </svg>
  `);

  await sharp(svgBuffer)
    .png()
    .toFile(path.join(__dirname, 'icon.png'));

  console.log('icon.png created successfully!');
}

createIcon().catch(console.error);
