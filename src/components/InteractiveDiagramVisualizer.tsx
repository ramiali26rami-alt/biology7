import React, { useState, useRef } from 'react';
import { HelpCircle, X, ChevronLeft, ChevronRight, Info, ZoomIn, ZoomOut, RefreshCw, Sparkles } from 'lucide-react';
import { InteractiveDiagram, InteractiveHotspot } from '../types';
import { Language } from '../utils/translations';
import { playClickSound, playHotspotSound } from '../utils/soundEffects';

interface InteractiveDiagramVisualizerProps {
  diagrams: InteractiveDiagram[];
  lang: Language;
  lessonFolder: string;
}

export function InteractiveDiagramVisualizer({ diagrams, lang, lessonFolder }: InteractiveDiagramVisualizerProps) {
  const [activeDiagIdx, setActiveDiagIdx] = useState(0);
  const [selectedHotspot, setSelectedHotspot] = useState<InteractiveHotspot | null>(null);

  // Zoom and Pan state
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const touchStartDist = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  if (!diagrams || diagrams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl min-h-[260px]">
        <Info className="w-10 h-10 text-slate-350 dark:text-slate-700 mb-2" />
        <span className="text-xs font-bold">
          {lang === 'ar' ? 'لا توجد رسومات تفاعلية مضافة لهذا الدرس.' : 'No interactive diagrams added for this lesson.'}
        </span>
      </div>
    );
  }

  const activeDiagram = diagrams[activeDiagIdx];
  const hotspotsList = activeDiagram.hotspots || [];

  const getAssetUrl = (file: string) => {
    if (!file) return '';
    if (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('//')) {
      return file;
    }
    if (lessonFolder === '.' || lessonFolder === '/' || !lessonFolder) {
      return `/${file}`;
    }
    return `/${lessonFolder}/${file}`;
  };

  // Zoom Handlers
  const zoomIn = () => {
    setTransform(prev => ({ ...prev, scale: Math.min(4, prev.scale + 0.25) }));
  };

  const zoomOut = () => {
    setTransform(prev => ({ ...prev, scale: Math.max(1, prev.scale - 0.25) }));
  };

  const resetZoom = () => {
    setTransform({ scale: 1, x: 0, y: 0 });
  };

  // Navigate between hotspots
  const handlePrevHotspot = () => {
    if (hotspotsList.length === 0) return;
    playHotspotSound();
    if (!selectedHotspot) {
      setSelectedHotspot(hotspotsList[hotspotsList.length - 1]);
      return;
    }
    const currentIdx = hotspotsList.findIndex(h => h.id === selectedHotspot.id);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : hotspotsList.length - 1;
    setSelectedHotspot(hotspotsList[prevIdx]);
  };

  const handleNextHotspot = () => {
    if (hotspotsList.length === 0) return;
    playHotspotSound();
    if (!selectedHotspot) {
      setSelectedHotspot(hotspotsList[0]);
      return;
    }
    const currentIdx = hotspotsList.findIndex(h => h.id === selectedHotspot.id);
    const nextIdx = currentIdx < hotspotsList.length - 1 ? currentIdx + 1 : 0;
    setSelectedHotspot(hotspotsList[nextIdx]);
  };

  // Mouse Drag / Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (transform.scale === 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || transform.scale === 1) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    
    const bound = 300 * (transform.scale - 1);
    setTransform(prev => ({
      ...prev,
      x: Math.max(-bound, Math.min(bound, newX)),
      y: Math.max(-bound, Math.min(bound, newY))
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for Mobile Devices
  const getTouchDist = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return 0;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      touchStartDist.current = getTouchDist(e);
    } else if (e.touches.length === 1) {
      if (transform.scale === 1) return;
      setIsDragging(true);
      dragStart.current = { 
        x: e.touches[0].clientX - transform.x, 
        y: e.touches[0].clientY - transform.y 
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current) {
      const dist = getTouchDist(e);
      if (dist === 0) return;
      const scaleFactor = dist / touchStartDist.current;
      setTransform(prev => ({
        ...prev,
        scale: Math.max(1, Math.min(4, prev.scale * scaleFactor))
      }));
      touchStartDist.current = dist;
    } else if (e.touches.length === 1 && isDragging && transform.scale > 1) {
      const newX = e.touches[0].clientX - dragStart.current.x;
      const newY = e.touches[0].clientY - dragStart.current.y;
      const bound = 300 * (transform.scale - 1);
      setTransform(prev => ({
        ...prev,
        x: Math.max(-bound, Math.min(bound, newX)),
        y: Math.max(-bound, Math.min(bound, newY))
      }));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartDist.current = null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs p-3 space-y-2.5">
      {/* Tab Navigation if multiple diagrams exist */}
      {diagrams.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-100 dark:border-slate-800 scrollbar-none">
          {diagrams.map((diag, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveDiagIdx(idx);
                setSelectedHotspot(null);
                resetZoom();
              }}
              className={`px-3 py-1 rounded-app-btn text-xs font-black transition-all shrink-0 ${
                activeDiagIdx === idx
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-650 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {diag.titleAr || diag.imageFile}
            </button>
          ))}
        </div>
      )}

      {/* Main Diagram Canvas Area - Wraps tightly with Zero Side Gaps */}
      <div className="flex items-center justify-center w-full overflow-hidden">
        <div 
          className="relative inline-block max-w-full border border-slate-150 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-slate-950/20 dark:bg-[#060913] select-none touch-none shadow-xs"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: transform.scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          {/* Zoomable Inner Canvas */}
          <div
            ref={containerRef}
            className="relative flex items-center justify-center"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
          >
            {/* Sub-wrapper that strictly matches the exact rendered image width & height */}
            <div className="relative inline-block w-auto h-auto max-w-full">
              <img
                src={getAssetUrl(activeDiagram.imageFile)}
                alt={lang === 'ar' ? activeDiagram.titleAr : (activeDiagram.titleEn || activeDiagram.titleAr)}
                className="max-h-[42vh] md:max-h-[380px] w-auto max-w-full object-contain block rounded-xl mx-auto"
                draggable={false}
              />

              {/* SVG arrows overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-15">
                <defs>
                  {/* Arrow marker for default state */}
                  <marker
                    id="arrow-head-default"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#10b981" />
                  </marker>
                  {/* Arrow marker for active state */}
                  <marker
                    id="arrow-head-active"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#f59e0b" />
                  </marker>
                </defs>

                {hotspotsList.map((hotspot) => {
                  if (hotspot.arrowX === undefined || hotspot.arrowY === undefined || hotspot.arrowX === null || hotspot.arrowY === null) return null;
                  const isActive = selectedHotspot?.id === hotspot.id;
                  
                  return (
                    <line
                      key={`arrow-${hotspot.id}`}
                      x1={`${hotspot.x}%`}
                      y1={`${hotspot.y}%`}
                      x2={`${hotspot.arrowX}%`}
                      y2={`${hotspot.arrowY}%`}
                      stroke={isActive ? '#f59e0b' : '#10b981'}
                      strokeWidth={isActive ? 3 : 1.8}
                      strokeDasharray={isActive ? 'none' : '3 3'}
                      markerEnd={`url(#arrow-head-${isActive ? 'active' : 'default'})`}
                      className="transition-all duration-300"
                      style={{
                        opacity: selectedHotspot ? (isActive ? 1 : 0.4) : 0.85
                      }}
                    />
                  );
                })}
              </svg>

              {/* Hotspots clickable markers */}
              {hotspotsList.map((hotspot, idx) => {
                const isActive = selectedHotspot?.id === hotspot.id;
                return (
                  <div
                    key={hotspot.id}
                    className="absolute"
                    style={{
                      left: `${hotspot.x}%`,
                      top: `${hotspot.y}%`,
                      transform: `translate(-50%, -50%) scale(${1 / transform.scale})`,
                      transformOrigin: 'center center',
                      zIndex: isActive ? 50 : 20
                    }}
                  >
                    <button
                      onClick={() => {
                        playHotspotSound();
                        setSelectedHotspot(isActive ? null : hotspot);
                      }}
                      className={`w-6 h-6 md:w-7 md:h-7 flex items-center justify-center group focus:outline-none relative cursor-pointer rounded-full transition-transform ${
                        isActive ? 'scale-125' : 'hover:scale-110 active:scale-95'
                      }`}
                      title={hotspot.labelAr}
                      aria-label={hotspot.labelAr}
                    >
                      {/* Pulsing ring */}
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-80 ${
                        isActive ? 'animate-ping bg-amber-400' : 'animate-pulse bg-emerald-400'
                      }`}></span>
                      {/* Inner core badge with number */}
                      <span className={`relative inline-flex items-center justify-center rounded-full h-4.5 w-4.5 md:h-5 md:w-5 text-[9px] md:text-[10px] font-black text-white shadow-xs border border-white transition-colors ${
                        isActive ? 'bg-amber-500 ring-2 ring-amber-300' : 'bg-emerald-600'
                      }`}>
                        {idx + 1}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Compact Bottom Info Panel */}
      {selectedHotspot ? (
        <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/60 dark:from-slate-800/95 dark:to-slate-850 border border-emerald-200/90 dark:border-emerald-800/70 p-3 rounded-2xl shadow-2xs space-y-1.5 animate-fadeIn transition-all">
          <div className="flex items-center justify-between gap-2 border-b border-emerald-100 dark:border-slate-700/60 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {hotspotsList.findIndex(h => h.id === selectedHotspot.id) + 1} / {hotspotsList.length}
              </span>
              <h4 className="text-xs md:text-sm font-black text-emerald-850 dark:text-emerald-300">
                {lang === 'ar' ? selectedHotspot.labelAr : (selectedHotspot.labelEn || selectedHotspot.labelAr)}
              </h4>
            </div>
            
            <button
              onClick={() => setSelectedHotspot(null)}
              className="p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title={lang === 'ar' ? 'إغلاق الشرح' : 'Close'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] md:text-xs font-semibold text-slate-750 dark:text-slate-200 leading-relaxed max-h-24 overflow-y-auto">
            {lang === 'ar' ? selectedHotspot.descAr : (selectedHotspot.descEn || selectedHotspot.descAr)}
          </p>

          {/* Sequential Hotspot Navigation Buttons */}
          <div className="flex items-center justify-between pt-0.5 text-xs">
            <button
              onClick={handlePrevHotspot}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold border border-slate-200/60 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 text-[11px] cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'السابق' : 'Previous'}</span>
            </button>

            <button
              onClick={handleNextHotspot}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all active:scale-95 text-[11px] cursor-pointer"
            >
              <span>{lang === 'ar' ? 'التالي' : 'Next'}</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-150 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px]">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <p className="font-bold leading-normal">
            {lang === 'ar'
              ? 'انقر على أي رقم ملون على الرسمة لتمييز السهم وقراءة الشرح.'
              : 'Tap any numbered point on the diagram to highlight its arrow and read details.'}
          </p>
        </div>
      )}

      {/* Diagram Title & Zoom controls outside the image canvas */}
      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="text-right flex-1 min-w-0">
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
            {lang === 'ar' ? activeDiagram.titleAr : (activeDiagram.titleEn || activeDiagram.titleAr)}
          </h3>
        </div>
        
        {/* Compact Zoom Controls */}
        <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-1 rounded-lg shadow-2xs shrink-0">
          <button 
            onClick={zoomIn} 
            aria-label={lang === 'ar' ? 'تكبير' : 'Zoom In'}
            className="p-1 text-slate-650 dark:text-slate-200 hover:text-emerald-500 rounded transition-colors border-0 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={zoomOut} 
            aria-label={lang === 'ar' ? 'تصغير' : 'Zoom Out'}
            className="p-1 text-slate-650 dark:text-slate-200 hover:text-emerald-500 rounded transition-colors border-0 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={resetZoom} 
            aria-label={lang === 'ar' ? 'إعادة ضبط' : 'Reset Zoom'}
            className="p-1 text-slate-650 dark:text-slate-200 hover:text-emerald-500 rounded transition-colors border-0 cursor-pointer"
            title="Reset"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
