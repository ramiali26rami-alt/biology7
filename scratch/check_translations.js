import fs from 'fs';

const recovered = fs.readFileSync('src/utils/translations.ts.recovered', 'utf-8');
const current = fs.readFileSync('src/utils/translations.ts', 'utf-8');

console.log("premiumButtonText in recovered:", recovered.includes('premiumButtonText'));
console.log("premiumButtonText in current:", current.includes('premiumButtonText'));
console.log("File sizes - recovered:", recovered.length, "current:", current.length);
