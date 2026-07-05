import fs from 'fs';

const filePath = 'src/components/AdminDashboardScreen.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Use a regex to find the start point (whitespace insensitive)
const startRegex = /list\[qIdx\]\.explanationAr\s*=\s*e\.target\.value;\s*updateEditingLessonField\('quiz',\s*list\);/;
const startMatch = content.match(startRegex);

if (!startMatch) {
  console.log("Could not find startStr regex match!");
  process.exit(1);
}

const replaceStart = startMatch.index + startMatch[0].length;
console.log("Found start match at index:", startMatch.index);

// Use a regex to find the end point
const endRegex = /type="button"\s*onClick=\{\(\)\s*=>\s*setActiveQuizIdx\(prev\s*=>\s*Math\.max\(0,\s*prev\s*-\s*1\)\)\}/;
const endMatch = content.match(endRegex);

if (!endMatch) {
  console.log("Could not find endStr regex match!");
  process.exit(1);
}

const replaceEnd = endMatch.index;
console.log("Found end match at index:", replaceEnd);

const cleanReplacement = `
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold h-12 focus:outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-extrabold text-slate-450 mb-1">{lang === 'ar' ? 'التفسير العلمي بالإنجليزي (يظهر بعد الحل)' : 'Scientific Explanation (EN)'}</label>
                                    <textarea 
                                      value={q.explanationEn} 
                                      onChange={(e) => {
                                        const list = [...editingLesson.quiz];
                                        list[qIdx].explanationEn = e.target.value;
                                        updateEditingLessonField('quiz', list);
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold h-12 focus:outline-none"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-150 dark:border-slate-800 pt-4 mt-2">
                                  <button
                                    `;

const repaired = content.slice(0, replaceStart) + cleanReplacement + content.slice(replaceEnd);
fs.writeFileSync(filePath, repaired, 'utf-8');
console.log("Replaced block successfully using regex!");
