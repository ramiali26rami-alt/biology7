import fs from 'fs';

const bundlePath = 'dist/assets/index-BwfeltTY.js';
if (!fs.existsSync(bundlePath)) {
  console.log("Bundle file does not exist!");
  process.exit(1);
}

const content = fs.readFileSync(bundlePath, 'utf-8');

// Search for Arabic translations
const searchAr = 'lessons:"الدروس"';
const arIdx = content.indexOf(searchAr);
if (arIdx === -1) {
  console.log("Could not find Arabic translations in bundle.");
} else {
  console.log("Found Arabic translations at index:", arIdx);
  // Print some characters around it
  console.log("Arabic bundle slice:\n", content.slice(arIdx - 200, arIdx + 1500));
}

// Search for English translations
const searchEn = 'lessons:"Lessons"';
const enIdx = content.indexOf(searchEn);
if (enIdx === -1) {
  console.log("Could not find English translations in bundle.");
} else {
  console.log("Found English translations at index:", enIdx);
  console.log("English bundle slice:\n", content.slice(enIdx - 200, enIdx + 1500));
}
