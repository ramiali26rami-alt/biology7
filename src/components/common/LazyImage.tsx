import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
}

export default function LazyImage({ src, alt, fallbackSrc = '', className = '', ...props }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let active = true;
    
    // Fallback if IntersectionObserver is not supported
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setCurrentSrc(src);
      setLoaded(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = new Image();
            img.src = src;
            img.onload = () => {
              if (active) {
                setCurrentSrc(src);
                setLoaded(true);
              }
            };
            img.onerror = () => {
              if (active) {
                setCurrentSrc(fallbackSrc || src);
                setLoaded(true);
              }
            };
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '80px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      active = false;
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src, fallbackSrc]);

  return (
    <div className={`relative overflow-hidden bg-slate-100 dark:bg-slate-800/40 transition-all duration-300 ${className}`} ref={imgRef}>
      {/* Shimmer overlay */}
      {!loaded && (
        <div className="absolute inset-0 animate-shimmer" />
      )}
      
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          className={`transition-opacity duration-300 ease-out ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          {...props}
        />
      )}
    </div>
  );
}
