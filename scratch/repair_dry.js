import fs from 'fs';

const filePath = 'src/components/AdminDashboardScreen.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

console.log(content.slice(115000, 118000));
