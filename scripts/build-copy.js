import fs from 'fs';
import path from 'path';

const copyFile = (src, dest) => {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
};

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// Copy plugin files (only .js files)
const pluginDir = 'dist/plugin';
const pluginFiles = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js'));
pluginFiles.forEach(file => {
  copyFile(path.join(pluginDir, file), `.opencode/plugin/${file}`);
});

// No separate browser or utils files to copy - all in browserless.ts

// Create package.json for .opencode
const deps = {
  type: 'module',
  dependencies: {},
};
['@opencode-ai/plugin', 'puppeteer-core'].forEach(d => {
  if (pkg.dependencies[d]) deps.dependencies[d] = pkg.dependencies[d];
});
fs.writeFileSync('.opencode/package.json', JSON.stringify(deps, null, 2));
