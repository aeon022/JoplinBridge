const fs = require('fs-extra');
const path = require('path');
const tar = require('tar');

async function packPlugin() {
  const distDir = path.resolve(__dirname, '../dist');
  const publishDir = path.resolve(__dirname, '../publish');
  const outputFile = path.resolve(publishDir, 'com.aeon022.joplinbridge.jpl');

  if (!(await fs.pathExists(distDir))) {
    console.error('[JoplinBridge] Build directory dist/ does not exist. Run build first.');
    process.exit(1);
  }

  await fs.ensureDir(publishDir);
  await fs.remove(outputFile);

  await tar.create(
    {
      strict: true,
      portable: true,
      file: outputFile,
      cwd: distDir,
      sync: true
    },
    ['index.js', 'manifest.json']
  );

  console.log(`[JoplinBridge] Created JPL package at: ${outputFile}`);
}

packPlugin().catch((err) => {
  console.error('[JoplinBridge] Error packing plugin:', err);
  process.exit(1);
});
