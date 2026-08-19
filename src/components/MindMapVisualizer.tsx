/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, Info, HelpCircle, X } from 'lucide-react';
import { MindmapNode } from '../types';
import { Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';
import { playHotspotSound, playMindmapSound } from '../utils/soundEffects';

interface MindMapVisualizerProps {
  mindmap: MindmapNode[];
  lang: Language;
}

export function MindMapVisualizer({ mindmap, lang }: MindMapVisualizerProps) {
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<{ title: string; details: string } | null>(null);
  const isDarkMode = document.documentElement.classList.contains('dark');

  const rootNode = mindmap.find(n => !n.parentId) || mindmap[0];
  const branches = rootNode ? mindmap.filter(n => n.parentId === rootNode.id) : [];

  const getChildren = (nodeId: string) => mindmap.filter(n => n.parentId === nodeId);

  const toggleBranch = (branchId: string) => {
    playMindmapSound();
    setExpandedBranches(prev => ({ ...prev, [branchId]: !prev[branchId] }));
  };

  const toggleSub = (subId: string) => {
    playMindmapSound();
    setExpandedSubs(prev => ({ ...prev, [subId]: !prev[subId] }));
  };

  if (!rootNode) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold py-10">
        {lang === 'ar' ? 'لا توجد بيانات خارطة ذهنية متوفرة.' : 'No mindmap data available.'}
      </div>
    );
  }

  // لوحة ألوان الفروع — عائلة واحدة متسقة، وأول لون هو لون هوية التطبيق الأساسي
  const defaultColors = ['#10b981', '#e0527a', '#f59e0b', '#38bdf8', '#8b7cf6'];

  return (
    <div className="w-full text-right select-none animate-fadeIn pb-28">
      {/* البانر الرئيسي — بقى بتدرج لون العلامة الأساسي بدل بنفسجي/إندگو منفصل */}
      <div className="mb-5 bg-gradient-to-r from-[#10b981] to-[#059669] dark:from-emerald-900/60 dark:to-emerald-950/60 border border-emerald-500/20 rounded-app-card p-5 shadow-sm flex items-center justify-between gap-4">
        <div className="flex-1">
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-100 block mb-1">
            {lang === 'ar' ? 'المفهوم الرئيسي للحصة' : 'Core Lesson Concept'}
          </span>
          <h3 className="text-base md:text-lg font-black text-white leading-tight">
            {lang === 'ar' ? rootNode.textAr : (rootNode.textEn || rootNode.textAr)}
          </h3>
        </div>
        {rootNode.details && (
          <button
            onClick={() => {
              playHotspotSound();
              setSelectedNodeDetails({
                title: lang === 'ar' ? rootNode.textAr : (rootNode.textEn || rootNode.textAr),
                details: rootNode.details!
              });
            }}
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <Info className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-3.5">
        {branches.map((branch, i) => {
          const color = branch.color || defaultColors[i % defaultColors.length];
          const isBranchExpanded = !!expandedBranches[branch.id];
          const branchChildren = getChildren(branch.id);

          return (
            <div
              key={branch.id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-app-card overflow-hidden shadow-sm transition-all"
            >
              <div
                onClick={() => toggleBranch(branch.id)}
                className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-app-btn flex items-center justify-center transition-all shrink-0"
                    style={{
                      backgroundColor: isBranchExpanded ? `${color}1A` : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                      color: color
                    }}
                  >
                    <ChevronDown
                      className="w-4 h-4 transition-transform duration-300"
                      style={{ transform: isBranchExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </div>
                  {/* مستوى 1 (الفرع الرئيسي) */}
                  <h4
                    className="text-base md:text-lg font-black transition-colors tracking-tight"
                    style={{ color: isBranchExpanded ? (isDarkMode ? '#ffffff' : color) : (isDarkMode ? '#e2e8f0' : '#1e293b') }}
                  >
                    {lang === 'ar' ? branch.textAr : (branch.textEn || branch.textAr)}
                  </h4>
                </div>

                {branch.details && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeDetails({
                        title: lang === 'ar' ? branch.textAr : (branch.textEn || branch.textAr),
                        details: branch.details!
                      });
                    }}
                    style={{ color: color }}
                    className="w-11 h-11 rounded-app-btn bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 opacity-70 hover:opacity-100 flex items-center justify-center transition-all cursor-pointer shrink-0"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                )}
              </div>

              <AnimatePresence initial={false}>
                {isBranchExpanded && branchChildren.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                  >
                    <div className="px-4 pb-4 border-t border-slate-50 dark:border-slate-800/40 pt-3 space-y-3">
                      {branchChildren.map(subNode => {
                        const subChildren = getChildren(subNode.id);
                        const isSubExpanded = !!expandedSubs[subNode.id];
                        const isSubBranch = subChildren.length > 0;

                        if (isSubBranch) {
                          return (
                            <div
                              key={subNode.id}
                              className="border border-slate-100 dark:border-slate-800/60 rounded-app-btn overflow-hidden"
                            >
                              <div
                                onClick={() => toggleSub(subNode.id)}
                                className="p-3.5 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-100/40 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <ChevronDown
                                    className="w-4 h-4 transition-transform duration-300 shrink-0"
                                    style={{ transform: isSubExpanded ? 'rotate(180deg)' : 'rotate(0deg)', color: color }}
                                  />
                                  {/* مستوى 2 (الجزء / التركيب) */}
                                  <span className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                                    {lang === 'ar' ? subNode.textAr : (subNode.textEn || subNode.textAr)}
                                  </span>
                                </div>
                                {subNode.details && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedNodeDetails({
                                        title: lang === 'ar' ? subNode.textAr : (subNode.textEn || subNode.textAr),
                                        details: subNode.details!
                                      });
                                    }}
                                    style={{ color: color }}
                                    className="w-11 h-11 rounded-app-btn bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 opacity-70 hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                                  >
                                    <Info className="w-5 h-5" />
                                  </button>
                                )}
                              </div>

                              <AnimatePresence initial={false}>
                                {isSubExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.15, ease: 'easeInOut' }}
                                  >
                                    <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/40 space-y-2.5">
                                      {subChildren.map(leaf => (
                                        <div
                                          key={leaf.id}
                                          /* مستوى 3 (الوظيفة / الشرح) */
                                          className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50 rounded-app-btn text-sm md:text-base font-medium leading-relaxed text-slate-800 dark:text-slate-200 flex items-center justify-between gap-3"
                                        >
                                          <div className="flex items-start gap-2.5">
                                            <span className="text-base font-bold shrink-0 mt-0.5" style={{ color: color }}>↳</span>
                                            <span className="leading-relaxed">{lang === 'ar' ? leaf.textAr : (leaf.textEn || leaf.textAr)}</span>
                                          </div>
                                          {leaf.details && (
                                            <button
                                              onClick={() => setSelectedNodeDetails({
                                                title: lang === 'ar' ? leaf.textAr : (leaf.textEn || leaf.textAr),
                                                details: leaf.details!
                                              })}
                                              style={{ color: color }}
                                              className="w-11 h-11 rounded-app-btn bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 opacity-70 hover:opacity-100 flex items-center justify-center transition-all cursor-pointer shrink-0"
                                            >
                                              <Info className="w-5 h-5" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        } else {
                          return (
                            <div
                              key={subNode.id}
                              className="p-3.5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/40 rounded-app-btn text-sm md:text-base font-medium leading-relaxed text-slate-800 dark:text-slate-200 relative overflow-hidden flex items-center justify-between gap-3"
                            >
                              <div className="absolute right-0 top-0 bottom-0 w-[4px]" style={{ backgroundColor: color }} />
                              <div className="flex items-start gap-2.5 me-1">
                                <span className="leading-relaxed">
                                  {lang === 'ar' ? subNode.textAr : (subNode.textEn || subNode.textAr)}
                                </span>
                              </div>
                              {subNode.details && (
                                <button
                                  onClick={() => setSelectedNodeDetails({
                                    title: lang === 'ar' ? subNode.textAr : (subNode.textEn || subNode.textAr),
                                    details: subNode.details!
                                  })}
                                  style={{ color: color }}
                                  className="w-11 h-11 rounded-app-btn bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 opacity-70 hover:opacity-100 flex items-center justify-center transition-all cursor-pointer shrink-0"
                                >
                                  <Info className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          );
                        }
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedNodeDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNodeDetails(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700/80 rounded-app-card p-6 shadow-2xl max-w-sm w-full relative z-10 text-right animate-fadeIn"
            >
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() => setSelectedNodeDetails(null)}
                  className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-350 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-500" />
                  <span>{selectedNodeDetails.title}</span>
                </h3>
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/80 pt-4">
                {selectedNodeDetails.details}
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
