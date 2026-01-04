const fs = require('fs');
const path = require('path');

// Read source files
const html = fs.readFileSync(path.join(__dirname, 'src/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'src/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, 'src/app.js'), 'utf8');

// Inline CSS and JS into HTML
const output = html
  .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`)
  .replace('<script src="app.js"></script>', `<script>\n${js}\n</script>`);

// Write to dist
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

fs.writeFileSync(path.join(distDir, 'index.html'), output);
console.log('✓ Build complete! Output: dist/index.html');
