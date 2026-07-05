import fs from 'fs';

const bundlePath = 'dist/assets/index-BwfeltTY.js';
const content = fs.readFileSync(bundlePath, 'utf-8');

const searchStr = '{ar:{lessons:"الدروس"';
const startIndex = content.indexOf(searchStr);

if (startIndex === -1) {
  console.log("Could not find start index in bundle!");
  process.exit(1);
}

let braceCount = 1;
let endIndex = startIndex + 1;

while (braceCount > 0 && endIndex < content.length) {
  if (content[endIndex] === '{') {
    braceCount++;
  } else if (content[endIndex] === '}') {
    braceCount--;
  }
  endIndex++;
}

const objectStr = content.slice(startIndex, endIndex);
console.log("Object extracted successfully! Length:", objectStr.length);

// Format it as:
// export type Language = 'ar' | 'en';
// export const translations = <extracted object>;
const finalCode = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Language = 'ar' | 'en';

export const translations = ${objectStr};
`;

fs.writeFileSync('src/utils/translations.ts', finalCode, 'utf-8');
console.log("Wrote clean translations to src/utils/translations.ts!");
