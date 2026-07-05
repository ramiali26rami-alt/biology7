import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = './public';
const OUTPUT_FILE = './public/detected_assets.json';

function getFilesRecursively(dir, baseDir = PUBLIC_DIR) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      // Recurse into subdirectory
      results = results.concat(getFilesRecursively(filePath, baseDir));
    } else {
      // It's a file
      results.push(filePath);
    }
  });

  return results;
}

function scan() {
  console.log('🔍 Scanning public directory for assets...');
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error(`Error: ${PUBLIC_DIR} does not exist.`);
    return;
  }

  // Get all files
  const allFiles = getFilesRecursively(PUBLIC_DIR);

  // Group by their folder relative to public/
  const groups = {};

  allFiles.forEach(file => {
    // Relative path to public
    const relPath = path.relative(PUBLIC_DIR, file).replace(/\\/g, '/');
    const parts = relPath.split('/');

    if (parts.length > 1) {
      // It is inside a subfolder
      const fileName = parts.pop();
      const folderPath = parts.join('/');
      const folderName = parts[parts.length - 1];

      if (!groups[folderPath]) {
        groups[folderPath] = {
          path: folderPath,
          name: folderName,
          files: []
        };
      }
      groups[folderPath].files.push(fileName);
    }
  });

  const folders = Object.values(groups);

  const output = {
    folders
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`✅ Scan complete! Detected ${folders.length} folders. Written to ${OUTPUT_FILE}`);
}

scan();
