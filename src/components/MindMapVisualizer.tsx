/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, RefreshCw, ZoomIn, ZoomOut, Info, Sparkles } from 'lucide-react';
import { MindmapNode } from '../types';
import { Language } from '../utils/translations';

interface MindMapVisualizerProps {
  mindmap: MindmapNode[];
  lang: Language;
}

export function MindMapVisualizer({ mindmap, lang }: MindMapVisualizerProps) {
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<{ title: string; details: string } | null>(null);
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  // Zoom and Pan state
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const touchStartDist = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLButtonElement>(null);
  const branchRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [lines, setLines] = useState<{ d: string; color: string }[]>([]);

  // Find root and branches
  const rootNode = mindmap.find(n => !n.parentId) || mindmap[0];
  const branches = rootNode ? mindmap.filter(n => n.parentId === rootNode.id) : [];

  // Helper: check if a node is a sub-branch (i.e. has children)
  const getChildren = (nodeId: string) => mindmap.filter(n => n.parentId === nodeId);

  // Center node function
  const centerNode = (nodeId: string, zoomScale?: number) => {
    const container = containerRef.current;
    let nodeEl: HTMLElement | null = null;
    
    if (nodeId === 'root' && rootRef.current) {
      nodeEl = rootRef.current;
    } else {
      nodeEl = branchRefs.current[nodeId];
    }
    
    if (!container || !nodeEl) return;

    const containerRect = container.getBoundingClientRect();
    const nodeRect = nodeEl.getBoundingClientRect();

    const containerCenter = {
      x: containerRect.left + containerRect.width / 2,
      y: containerRect.top + containerRect.height / 2
    };

    const nodeCenter = {
      x: nodeRect.left + nodeRect.width / 2,
      y: nodeRect.top + nodeRect.height / 2
    };

    const dx = nodeCenter.x - containerCenter.x;
    const dy = nodeCenter.y - containerCenter.y;

    setTransform(prev => ({
      scale: zoomScale || Math.max(1.15, prev.scale),
      x: prev.x - dx,
      y: prev.y - dy
    }));

    // Trigger redraw lines after animation frames
    setTimeout(redrawLines, 50);
    setTimeout(redrawLines, 150);
  };

  // Toggle handlers
  const toggleBranch = (branchId: string) => {
    const willExpand = !expandedBranches[branchId];
    setExpandedBranches(prev => {
      const next = { ...prev, [branchId]: !prev[branchId] };
      // Redraw lines after transition
      setTimeout(redrawLines, 100);
      setTimeout(redrawLines, 300);
      return next;
    });

    if (willExpand) {
      setTimeout(() => {
        centerNode(branchId);
      }, 150);
    } else {
      setTimeout(() => {
        centerNode('root', 1.0);
      }, 150);
    }
  };

  const toggleSub = (subId: string) => {
    setExpandedSubs(prev => {
      const next = { ...prev, [subId]: !prev[subId] };
      // Redraw lines after transition
      setTimeout(redrawLines, 100);
      setTimeout(redrawLines, 300);
      return next;
    });
  };

  // Measure and redraw lines
  const redrawLines = () => {
    if (!canvasRef.current || !rootRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const rootRect = rootRef.current.getBoundingClientRect();

    const rootCenter = {
      x: rootRect.left - canvasRect.left + rootRect.width / 2,
      y: rootRect.top - canvasRect.top + rootRect.height / 2
    };

    const newLines: { d: string; color: string }[] = [];
    const colors = ['#1db88a', '#e05c7a', '#f59e0b', '#38bdf8', '#a78bfa'];

    branches.forEach((branch, i) => {
      const branchEl = branchRefs.current[branch.id];
      if (!branchEl) return;

      const isExpanded = expandedBranches[branch.id];
      if (!isExpanded) return;

      // Find the dot connector inside the branch element
      const dotEl = branchEl.querySelector('.dot-connector');
      if (!dotEl) return;

      const dotRect = dotEl.getBoundingClientRect();
      const dotCenter = {
        x: dotRect.left - canvasRect.left + dotRect.width / 2,
        y: dotRect.top - canvasRect.top + dotRect.height / 2
      };

      const color = branch.color || colors[i % colors.length];

      // Draw beautiful curved bezier path from root to branch dot
      const dx = dotCenter.x - rootCenter.x;
      const dy = dotCenter.y - rootCenter.y;
      const cx1 = rootCenter.x + dx * 0.1;
      const cy1 = rootCenter.y + dy * 0.6;
      const cx2 = dotCenter.x - dx * 0.1;
      const cy2 = dotCenter.y - dy * 0.3;

      const d = `M${rootCenter.x},${rootCenter.y} C${cx1},${cy1} ${cx2},${cy2} ${dotCenter.x},${dotCenter.y}`;
      newLines.push({ d, color });
    });

    setLines(newLines);
  };

  // Redraw when layout changes
  useEffect(() => {
    redrawLines();
    window.addEventListener('resize', redrawLines);
    return () => window.removeEventListener('resize', redrawLines);
  }, [expandedBranches, expandedSubs, mindmap]);

  // Touch & Mouse Dragging / Panning handlers (Bounded to make it easy to control without going out of screen)
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    // Strict boundaries relative to scale to avoid map elements getting lost
    const boundX = 350 * Math.max(1, transform.scale);
    const boundY = 250 * Math.max(1, transform.scale);
    setTransform(prev => ({
      ...prev,
      x: Math.max(-boundX, Math.min(boundX, newX)),
      y: Math.max(-boundY, Math.min(boundY, newY))
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { 
        x: e.touches[0].clientX - transform.x, 
        y: e.touches[0].clientY - transform.y 
      };
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      const newX = e.touches[0].clientX - dragStart.current.x;
      const newY = e.touches[0].clientY - dragStart.current.y;
      const boundX = 350 * Math.max(1, transform.scale);
      const boundY = 250 * Math.max(1, transform.scale);
      setTransform(prev => ({
        ...prev,
        x: Math.max(-boundX, Math.min(boundX, newX)),
        y: Math.max(-boundY, Math.min(boundY, newY))
      }));
    } else if (e.touches.length === 2 && touchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleFactor = dist / touchStartDist.current;
      setTransform(prev => ({
        ...prev,
        scale: Math.max(0.6, Math.min(3, prev.scale * scaleFactor))
      }));
      touchStartDist.current = dist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartDist.current = null;
  };

  // Zoom control buttons
  const zoomIn = () => {
    setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.25) }));
    setTimeout(redrawLines, 100);
  };

  const zoomOut = () => {
    setTransform(prev => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.25) }));
    setTimeout(redrawLines, 100);
  };

  const resetZoom = () => {
    setTransform({ scale: 1, x: 0, y: 0 });
    setTimeout(redrawLines, 100);
  };

  if (!rootNode) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs font-bold py-10">
        {lang === 'ar' ? 'لا توجد بيانات خارطة ذهنية متوفرة.' : 'No mindmap data available.'}
      </div>
    );
  }

  const colors = ['#1db88a', '#e05c7a', '#f59e0b', '#38bdf8', '#a78bfa'];

  return (
    <div 
      className="relative w-full h-full overflow-hidden select-none bg-white dark:bg-[#0a0e1a] touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Zoom Control Panel */}
      <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-2 bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 p-2 rounded-2xl backdrop-blur-md shadow-lg">
        <button 
          onClick={zoomIn} 
          className="p-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 rounded-xl transition-all"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button 
          onClick={zoomOut} 
          className="p-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 rounded-xl transition-all"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button 
          onClick={resetZoom} 
          className="p-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 rounded-xl transition-all"
          title="Reset"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Draggable / Zoomable Canvas */}
      <div 
        ref={containerRef}
        className="w-full h-full relative"
      >
        {/* Nodes Layer (Translated and Zoomed Canvas) */}
        <div
          ref={canvasRef}
          className="absolute inset-0 flex flex-col items-center pt-8 z-20 w-full min-h-max"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
        >
          {/* SVG lines layer (Drawn inside the translated canvas to inherit coordinate offsets dynamically) */}
          <svg className="absolute inset-0 pointer-events-none z-10 w-full h-full">
            <defs>
              {lines.map((_, i) => (
                <filter id={`glow-v-${i}`} key={i}>
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}
            </defs>
            {lines.map((line, i) => (
              <React.Fragment key={i}>
                {/* Glow line */}
                <path
                  d={line.d}
                  fill="none"
                  stroke={line.color}
                  strokeWidth="6"
                  strokeOpacity="0.15"
                  filter={`url(#glow-v-${i})`}
                />
                {/* Core line */}
                <path
                  d={line.d}
                  fill="none"
                  stroke={line.color}
                  strokeWidth="2.5"
                  strokeOpacity="0.8"
                  strokeLinecap="round"
                />
              </React.Fragment>
            ))}
          </svg>
          {/* ROOT node */}
          <div className="mb-14">
            <button
              ref={rootRef}
              onClick={() => {
                // Toggle all main branches
                const allOpen = branches.every(b => expandedBranches[b.id]);
                const nextState: Record<string, boolean> = {};
                branches.forEach(b => {
                  nextState[b.id] = !allOpen;
                });
                setExpandedBranches(nextState);
                setTimeout(redrawLines, 150);
                setTimeout(() => {
                  centerNode('root', 1.0);
                }, 160);
              }}
              className="bg-gradient-to-tr from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 text-white font-black text-base md:text-lg px-8 py-4 rounded-full shadow-lg hover:shadow-indigo-500/30 border border-indigo-400/20 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            >
              <span>{lang === 'ar' ? rootNode.textAr : (rootNode.textEn || rootNode.textAr)}</span>
              {rootNode.details && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeDetails({
                      title: lang === 'ar' ? rootNode.textAr : (rootNode.textEn || rootNode.textAr),
                      details: rootNode.details!
                    });
                  }}
                  className="p-1 hover:bg-white/20 rounded-full text-indigo-200 active:scale-90 transition-all cursor-pointer inline-flex items-center"
                >
                  <Info className="w-4 h-4" />
                </span>
              )}
            </button>
          </div>

          {/* Branches Row */}
          <div className="flex flex-wrap justify-center gap-6 max-w-full px-4">
            {branches.map((branch, i) => {
              const color = branch.color || colors[i % colors.length];
              const isBranchExpanded = !!expandedBranches[branch.id];
              const branchChildren = getChildren(branch.id);

              return (
                <div
                  key={branch.id}
                  ref={el => { branchRefs.current[branch.id] = el; }}
                  className="flex flex-col items-center w-64 max-w-xs transition-all duration-300"
                >
                  {/* Dot Connector */}
                  <div 
                    className="dot-connector w-3 h-3 rounded-full mb-3 transition-all duration-300"
                    style={{ 
                      backgroundColor: color,
                      boxShadow: `0 0 10px ${color}`,
                      opacity: isBranchExpanded ? 1 : 0.4
                    }}
                  />

                  {/* Branch Button */}
                  <button
                    onClick={() => toggleBranch(branch.id)}
                    className="w-full text-center py-3 px-4 font-black text-sm rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2"
                    style={{
                      backgroundColor: isBranchExpanded ? `${color}1A` : (isDarkMode ? '#151d35' : '#f8fafc'),
                      borderColor: isBranchExpanded ? color : (isDarkMode ? '#2a3460' : '#cbd5e1'),
                      color: isBranchExpanded ? (isDarkMode ? '#ffffff' : color) : (isDarkMode ? '#8892b0' : '#475569'),
                      boxShadow: isBranchExpanded ? `0 0 15px ${color}20` : 'none'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown 
                        className="w-3.5 h-3.5 transition-transform duration-300"
                        style={{
                          transform: isBranchExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          color: color
                        }}
                      />
                      <span>{lang === 'ar' ? branch.textAr : (branch.textEn || branch.textAr)}</span>
                    </div>
                    {branch.details && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNodeDetails({
                            title: lang === 'ar' ? branch.textAr : (branch.textEn || branch.textAr),
                            details: branch.details!
                          });
                        }}
                        className="p-1 hover:bg-white/10 rounded-full text-indigo-400 active:scale-90 transition-all cursor-pointer inline-flex items-center"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>

                  {/* Leaves / Sub-branches Panel */}
                  {isBranchExpanded && branchChildren.length > 0 && (
                    <div className="w-full mt-4 flex flex-col gap-3 animate-fadeIn">
                      {branchChildren.map(subNode => {
                        const subChildren = getChildren(subNode.id);
                        const isSubExpanded = !!expandedSubs[subNode.id];
                        const isSubBranch = subChildren.length > 0;

                        if (isSubBranch) {
                          // Renders Sub-branch with its nested leaf items
                          return (
                            <div key={subNode.id} className="w-full flex flex-col items-stretch">
                              <button
                                onClick={() => toggleSub(subNode.id)}
                                className="w-full text-right py-2 px-3 font-extrabold text-xs rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-1"
                                style={{
                                  backgroundColor: isSubExpanded ? (isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)') : (isDarkMode ? '#101726' : '#f8fafc'),
                                  borderColor: isSubExpanded ? `${color}40` : (isDarkMode ? '#222d4a' : '#cbd5e1'),
                                  color: isSubExpanded ? (isDarkMode ? '#e8eaf6' : color) : (isDarkMode ? '#8892b0' : '#475569')
                                }}
                              >
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                  <ChevronDown 
                                    className="w-3 h-3 transition-transform duration-300 shrink-0"
                                    style={{
                                      transform: isSubExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                      color: color
                                    }}
                                  />
                                  <span className="truncate">{lang === 'ar' ? subNode.textAr : (subNode.textEn || subNode.textAr)}</span>
                                </div>
                                {subNode.details && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedNodeDetails({
                                        title: lang === 'ar' ? subNode.textAr : (subNode.textEn || subNode.textAr),
                                        details: subNode.details!
                                      });
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-full text-indigo-400 active:scale-90 transition-all cursor-pointer inline-flex items-center shrink-0"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </button>

                              {isSubExpanded && (
                                <div className="mt-2 pl-4 pr-2 border-r-2 border-slate-800 flex flex-col gap-2 animate-slideDown">
                                  {subChildren.map(leaf => (
                                    <div
                                      key={leaf.id}
                                      className="text-right py-2.5 px-3 bg-[#f8fafc] dark:bg-[#151d35] border border-slate-200 dark:border-[#2a3460] rounded-lg text-xs leading-relaxed font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1.5"
                                    >
                                      <span>{lang === 'ar' ? leaf.textAr : (leaf.textEn || leaf.textAr)}</span>
                                      {leaf.details && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedNodeDetails({
                                              title: lang === 'ar' ? leaf.textAr : (leaf.textEn || leaf.textAr),
                                              details: leaf.details!
                                            });
                                          }}
                                          className="p-0.5 hover:bg-slate-800 rounded-full text-indigo-400 active:scale-90 transition-all cursor-pointer inline-flex items-center shrink-0"
                                        >
                                          <Info className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          // Renders flat Leaf Item directly
                          return (
                            <div
                              key={subNode.id}
                              className="text-right py-3 px-3 bg-[#f8fafc] dark:bg-[#151d35] border border-slate-200 dark:border-[#2a3460] rounded-xl text-xs leading-relaxed font-semibold text-slate-700 dark:text-slate-200 relative overflow-hidden flex items-center justify-between gap-1.5"
                            >
                              <div 
                                className="absolute right-0 top-0 bottom-0 w-[3px]"
                                style={{ backgroundColor: color }}
                              />
                              <span>{lang === 'ar' ? subNode.textAr : (subNode.textEn || subNode.textAr)}</span>
                              {subNode.details && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedNodeDetails({
                                      title: lang === 'ar' ? subNode.textAr : (subNode.textEn || subNode.textAr),
                                      details: subNode.details!
                                    });
                                  }}
                                  className="p-0.5 hover:bg-slate-800 rounded-full text-indigo-400 active:scale-90 transition-all cursor-pointer inline-flex items-center shrink-0"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Node Details Modal */}
      {selectedNodeDetails && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-[28px] shadow-2xl relative animate-scaleUp">
            <h3 className="text-white font-black text-xl mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
              {selectedNodeDetails.title}
            </h3>
            <p className="text-slate-200 text-sm leading-relaxed font-bold whitespace-pre-line text-right">
              {selectedNodeDetails.details}
            </p>
            <button
              onClick={() => setSelectedNodeDetails(null)}
              className="mt-6 w-full py-3.5 bg-gradient-to-tr from-violet-600 to-indigo-500 text-white font-black text-sm rounded-xl active:scale-95 transition-all shadow-lg shadow-indigo-500/20"
            >
              {lang === 'ar' ? 'حسناً، إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
