import React, { useState, useRef } from 'react';
import { HelpCircle, X, ChevronLeft, ChevronRight, Info, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { InteractiveDiagram, InteractiveHotspot } from '../types';
import { Language } from '../utils/translations';
import { playClickSound } from '../utils/soundEffects';

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
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl min-h-[300px]">
        <Info className="w-12 h-12 text-slate-350 dark:text-slate-700 mb-3" />
        <span className="text-sm font-bold">
          {lang === 'ar' ? 'لا توجد رسومات تفاعلية مضافة لهذا الدرس.' : 'No interactive diagrams added for this lesson.'}
        </span>
      </div>
    );
  }

  const activeDiagram = diagrams[activeDiagIdx];

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

  // Mouse Drag / Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (transform.scale === 1) return; // Disable drag/pan when scale is 1
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || transform.scale === 1) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    
    // Restrict pan bounds based on scale
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
      if (transform.scale === 1) return; // Disable drag/pan when scale is 1
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
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm p-4 space-y-3">
      {/* Tab Navigation if multiple diagrams exist */}
      {diagrams.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1.5 border-b border-slate-100 dark:border-slate-800 scrollbar-none">
          {diagrams.map((diag, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveDiagIdx(idx);
                setSelectedHotspot(null);
                resetZoom();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 ${
                activeDiagIdx === idx
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-650 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {diag.titleAr || diag.imageFile}
            </button>
          ))}
        </div>
      )}

      {/* Main Diagram Area */}
      <div 
        className="relative w-full h-auto border border-slate-150 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-slate-950/20 dark:bg-[#060913] select-none flex items-start justify-center touch-none"
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
          className="relative w-full h-auto flex items-start justify-center"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
        >
          {/* Sub-wrapper that matches the exact dimensions of the image */}
          <div className="relative inline-block w-full h-auto">
            <img
              src={getAssetUrl(activeDiagram.imageFile)}
              alt={activeDiagram.titleAr}
              className="w-full h-auto object-contain block rounded-2xl"
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

              {activeDiagram.hotspots?.map((hotspot) => {
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
                    strokeWidth={isActive ? 2.5 : 1.5}
                    strokeDasharray={isActive ? 'none' : '3 3'}
                    markerEnd={`url(#arrow-head-${isActive ? 'active' : 'default'})`}
                    className="transition-all duration-300"
                    style={{
                      opacity: selectedHotspot ? (isActive ? 1 : 0.35) : 0.85
                    }}
                  />
                );
              })}
            </svg>

            {/* Hotspots overlay */}
            {activeDiagram.hotspots?.map((hotspot) => {
              const isActive = selectedHotspot?.id === hotspot.id;
              return (
                <div
                  key={hotspot.id}
                  className="absolute"
                  style={{
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                    transform: `translate(-50%, -50%) scale(${1 / transform.scale})`, // keep hotspot marker size stable
                    transformOrigin: 'center center',
                    zIndex: isActive ? 50 : 20
                  }}
                >
                  <button
                    onClick={() => {
                      playClickSound();
                      setSelectedHotspot(isActive ? null : hotspot);
                    }}
                    className="w-6 h-6 flex items-center justify-center group focus:outline-none relative cursor-pointer"
                    title={hotspot.labelAr}
                  >
                    {/* Outer pulsing ring */}
                    <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                      isActive ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}></span>
                    {/* Inner circle */}
                    <span className={`relative inline-flex rounded-full h-3 w-3 shadow-md border border-white transition-colors duration-250 ${
                      isActive ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}></span>
                  </button>

                  {/* Popover Tooltip directly near the hotspot */}
                  {isActive && (() => {
                    const isNearTop = hotspot.y < 25;
                    const isNearLeft = hotspot.x < 30;
                    const isNearRight = hotspot.x > 70;

                    let horizontalClass = "left-1/2 -translate-x-1/2";
                    let arrowHorizontalClass = "left-1/2 -translate-x-1/2";

                    if (isNearLeft) {
                      horizontalClass = "left-0 -translate-x-[15%]";
                      arrowHorizontalClass = "left-[20%]";
                    } else if (isNearRight) {
                      horizontalClass = "right-0 translate-x-[15%] left-auto";
                      arrowHorizontalClass = "right-[20%] left-auto";
                    }

                    const verticalClass = isNearTop ? "top-8" : "bottom-8";
                    
                    const arrowClass = isNearTop
                      ? `absolute bottom-full -mb-[1px] border-[6px] border-transparent border-b-white dark:border-b-slate-900 ${arrowHorizontalClass}`
                      : `absolute top-full -mt-[1px] border-[6px] border-transparent border-t-white dark:border-t-slate-900 ${arrowHorizontalClass}`;

                    return (
                      <div 
                        className={`absolute z-30 w-48 md:w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xl animate-fadeIn flex flex-col gap-1.5 text-right cursor-default ${verticalClass} ${horizontalClass}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-between items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          <button
                            onClick={() => setSelectedHotspot(null)}
                            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 transition-colors border-0 bg-transparent cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <h4 className="text-xs md:text-sm font-black text-emerald-500 dark:text-emerald-400 leading-tight">
                            {lang === 'ar' ? hotspot.labelAr : (hotspot.labelEn || hotspot.labelAr)}
                          </h4>
                        </div>
                        <p className="text-xs md:text-sm font-black text-slate-800 dark:text-slate-200 leading-relaxed max-h-32 overflow-y-auto">
                          {lang === 'ar' ? hotspot.descAr : (hotspot.descEn || hotspot.descAr)}
                        </p>
                        
                        {/* Dynamic Arrow */}
                        <div className={arrowClass}></div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Diagram Title & Zoom controls outside the image canvas */}
      <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-850 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="text-right flex-1 min-w-0">
          <h3 className="text-xs md:text-sm font-black text-slate-850 dark:text-slate-100 truncate">
            {lang === 'ar' ? activeDiagram.titleAr : (activeDiagram.titleEn || activeDiagram.titleAr)}
          </h3>
          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
            {lang === 'ar' ? 'اسحب للتحريك واستخدم الزر للتكبير أو قرصة الأصابع' : 'Drag to pan, pinch to zoom'}
          </p>
        </div>
        
        {/* Clean Zoom Controls */}
        <div className="flex gap-1.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 p-1.5 rounded-xl shadow-sm shrink-0">
          <button 
            onClick={zoomIn} 
            className="p-1.5 text-slate-650 dark:text-slate-200 hover:text-emerald-500 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-lg transition-colors border-0 cursor-pointer bg-transparent"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={zoomOut} 
            className="p-1.5 text-slate-650 dark:text-slate-200 hover:text-emerald-500 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-lg transition-colors border-0 cursor-pointer bg-transparent"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={resetZoom} 
            className="p-1.5 text-slate-650 dark:text-slate-200 hover:text-emerald-500 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 rounded-lg transition-colors border-0 cursor-pointer bg-transparent"
            title="Reset"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
