const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const input = path.join(__dirname, '..', 'assets', 'icons', 'nyla-avatar.png');

if (!fs.existsSync(input)) {
  console.log('Could not find nyla-avatar.png at:', input);
  const assetsDir = path.join(__dirname, '..', 'assets');
  function listFiles(dir, prefix = '') {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        console.log(prefix + item + '/');
        listFiles(full, prefix + '  ');
      } else {
        console.log(prefix + item);
      }
    });
  }
  listFiles(assetsDir);
  process.exit(1);
}

const output = input.replace('nyla-avatar.png', 'nyla-avatar-clean.png');

sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    const { width, height, channels } = info;
    let pixelsCleared = 0;
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < 30 && g < 30 && b < 30) {
        data[i + 3] = 0;
        pixelsCleared++;
      }
    }
    console.log(`Cleared ${pixelsCleared} dark pixels out of ${width * height} total`);
    return sharp(data, { raw: { width, height, channels } })
      .png()
      .toFile(output);
  })
  .then(() => {
    console.log('Done! Saved to ' + output);
    fs.copyFileSync(output, input);
    fs.unlinkSync(output);
    console.log('Replaced original nyla-avatar.png');
  })
  .catch(err => console.error(err));
