import fs from 'fs';

const filePath = 'src/components/AdminDashboardScreen.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Find the index of the explanation section where the corruption started
// Corruption started inside:
// value={q.explanationAr} 
// onChange={(e) => {
//   const list = [...editingLesson.quiz];
//   list[qIdx].explanationAr = e.target.value;
//   updateEditingLessonField('quiz', list);

const searchStart = `value={q.explanationAr} 
                                      onChange={(e) => {
                                        const list = [...editingLesson.quiz];
                                        list[qIdx].explanationAr = e.target.value;
                                        updateEditingLessonField('quiz', list);`;

const startIdx = content.indexOf(searchStart);
if (startIdx === -1) {
  console.log("Could not find start index!");
  process.exit(1);
}

const corruptionPoint = startIdx + searchStart.length;

// Now find the end of the corrupted block.
// The corrupted block ends right before the files tab:
// {/* ── SUB-TAB: File Editor (HTML & Binary Uploads) ──────────────────────── */}
const searchEnd = `{/* ── SUB-TAB: File Editor (HTML & Binary Uploads) ──────────────────────── */}`;
const endIdx = content.indexOf(searchEnd);
if (endIdx === -1) {
  console.log("Could not find end index!");
  process.exit(1);
}

console.log("Corrupt block starts around:", corruptionPoint);
console.log("Corrupt block ends around:", endIdx);

// The clean replacement for this entire block should be:
const cleanBlock = `
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

                                {/* Prev / Next Pagination buttons */}
                                <div className="flex items-center justify-between border-t border-slate-150 dark:border-slate-800 pt-4 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => setActiveQuizIdx(prev => Math.max(0, prev - 1))}
                                    disabled={activeQuizIdx === 0}
                                    className="flex items-center gap-1.5 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 disabled:opacity-40 disabled:pointer-events-none px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm"
                                  >
                                    {lang === 'ar' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                                    <span>{lang === 'ar' ? 'السؤال السابق' : 'Previous'}</span>
                                  </button>

                                  <span className="text-[10px] font-black text-slate-400 font-sans">
                                    {lang === 'ar' ? \`السؤال \${activeQuizIdx + 1} من \${editingLesson.quiz.length}\` : \`Question \${activeQuizIdx + 1} of \${editingLesson.quiz.length}\`}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => setActiveQuizIdx(prev => Math.min(editingLesson.quiz.length - 1, prev + 1))}
                                    disabled={activeQuizIdx === editingLesson.quiz.length - 1}
                                    className="flex items-center gap-1.5 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 disabled:opacity-40 disabled:pointer-events-none px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 shadow-sm"
                                  >
                                    <span>{lang === 'ar' ? 'السؤال التالي' : 'Next'}</span>
                                    {lang === 'ar' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                `;

const repairedContent = content.slice(0, corruptionPoint) + cleanBlock + content.slice(endIdx);
fs.writeFileSync(filePath, repairedContent, 'utf-8');
console.log("Repaired AdminDashboardScreen.tsx successfully!");
