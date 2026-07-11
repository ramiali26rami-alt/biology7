import React, { useState, useRef } from 'react';
import { HelpCircle, X, ChevronLeft, ChevronRight, Info, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { InteractiveDiagram, InteractiveHotspot } from '../types';
import { Language } from '../utils/translations';

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
    <div className="w-full h-full bg-white dark:bg-[#0a0e1a] p-1.5 flex flex-col justify-between overflow-hidden">
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
        className="relative w-full flex-1 overflow-hidden bg-white dark:bg-[#0a0e1a] select-none flex items-center justify-center touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: transform.scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
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

        {/* Zoomable Inner Canvas */}
        <div
          ref={containerRef}
          className="relative w-full h-full flex items-center justify-center"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out'
          }}
        >
          {/* Sub-wrapper that matches the exact dimensions of the image */}
          <div className="relative inline-block max-w-full max-h-full">
            <img
              src={getAssetUrl(activeDiagram.imageFile)}
              alt={activeDiagram.titleAr}
              className="max-w-full max-h-full object-contain block"
              draggable={false}
            />

            {/* Hotspots overlay */}
            {activeDiagram.hotspots?.map((hotspot) => {
              const isActive = selectedHotspot?.id === hotspot.id;
              return (
                <button
                  key={hotspot.id}
                  onClick={() => setSelectedHotspot(hotspot)}
                  style={{
                    left: `${hotspot.x}%`,
                    top: `${hotspot.y}%`,
                    transform: `translate(-50%, -50%) scale(${1 / transform.scale})`, // keep hotspot marker size stable
                    transformOrigin: 'center center'
                  }}
                  className="absolute w-6 h-6 flex items-center justify-center z-20 group focus:outline-none"
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
              );
            })}
          </div>
        </div>

        {/* Tooltip Overlay (remains anchored outside the zoom canvas for readability) */}
        {selectedHotspot && (
          <div className="absolute inset-x-4 bottom-4 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-xl animate-slideUp flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-emerald-500 dark:text-emerald-400">
                {lang === 'ar' ? selectedHotspot.labelAr : (selectedHotspot.labelEn || selectedHotspot.labelAr)}
              </h4>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">
                {lang === 'ar' ? selectedHotspot.descAr : (selectedHotspot.descEn || selectedHotspot.descAr)}
              </p>
            </div>
            <button
              onClick={() => setSelectedHotspot(null)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Diagram Title */}
      <div className="text-center">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">
          {lang === 'ar' ? activeDiagram.titleAr : (activeDiagram.titleEn || activeDiagram.titleAr)}
        </h3>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
          {lang === 'ar' ? 'اسحب للتحريك واستخدم الأزرار للتكبير أو باصبعين على الهاتف' : 'Drag to pan, use buttons to zoom, or pinch with two fingers on mobile'}
        </p>
      </div>
    </div>
  );
}
