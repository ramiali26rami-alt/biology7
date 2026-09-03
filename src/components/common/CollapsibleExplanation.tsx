import React, { useLayoutEffect, useRef, useState } from 'react';

interface CollapsibleExplanationProps {
  text?: string;
  lang: 'ar' | 'en';
  className?: string;
}

export default function CollapsibleExplanation({
  text = '',
  lang,
  className = ''
}: CollapsibleExplanationProps) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useLayoutEffect(() => {
    setIsExpanded(false);
    const paragraph = paragraphRef.current;
    if (!paragraph) return;

    const measure = () => {
      setCanExpand(paragraph.scrollHeight > paragraph.clientHeight + 1);
    };

    const frame = window.requestAnimationFrame(measure);
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measure)
      : null;
    observer?.observe(paragraph);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [text]);

  if (!text) return null;

  return (
    <div className="mt-0.5">
      <p
        ref={paragraphRef}
        className={`${className} ${isExpanded ? '' : 'overflow-hidden'}`}
        style={isExpanded ? undefined : {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2
        }}
      >
        {text}
      </p>
      {canExpand && (
        <button
          type="button"
          onClick={() => setIsExpanded(expanded => !expanded)}
          aria-expanded={isExpanded}
          className="mt-1 text-[10px] font-black underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
        >
          {isExpanded
            ? (lang === 'ar' ? 'عرض أقل' : 'Show less')
            : (lang === 'ar' ? 'اقرأ المزيد' : 'Read more')}
        </button>
      )}
    </div>
  );
}
