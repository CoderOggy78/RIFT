import React, { useState, useEffect, useRef } from 'react';

interface Token {
  text: string;
  isAccent?: boolean;
  isBold?: boolean;
}

const TOKENS: Token[] = [
  { text: 'RIFT', isBold: true },
  { text: 'is' },
  { text: 'our' },
  { text: 'agentic' },
  { text: 'incident' },
  { text: 'investigation' },
  { text: 'platform,' },
  { text: 'bridging' },
  { text: 'the' },
  { text: 'gap' },
  { text: 'between' },
  { text: 'what agents intend', isAccent: true, isBold: true },
  { text: 'and' },
  { text: 'what they do', isBold: true },
  { text: 'in' },
  { text: 'the' },
  { text: 'agent-first' },
  { text: 'era.' },
];

export const TypewriterStatement: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(0);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  // Trigger typewriter when scrolled into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasStarted]);

  // Word-by-word typewriter interval timer
  useEffect(() => {
    if (!hasStarted) return;
    if (visibleCount >= TOKENS.length) {
      setIsComplete(true);
      return;
    }

    const timer = setTimeout(() => {
      setVisibleCount((prev) => prev + 1);
    }, 110);

    return () => clearTimeout(timer);
  }, [hasStarted, visibleCount]);

  return (
    <div ref={containerRef} className="max-w-5xl mx-auto relative">
      <p className="font-display text-2xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#202124] leading-[1.3] min-h-[120px] sm:min-h-[160px]">
        {TOKENS.slice(0, visibleCount).map((token, index) => (
          <span
            key={index}
            className={`inline-block mr-[0.28em] transition-all duration-200 animate-in fade-in slide-in-from-bottom-1 ${
              token.isAccent
                ? 'text-rift-accent font-medium'
                : token.isBold
                ? 'text-[#202124] font-semibold'
                : 'text-[#202124]'
            }`}
          >
            {token.text}
          </span>
        ))}

        {/* Dynamic Blinking Typewriter Cursor */}
        <span
          className="inline-block w-1 sm:w-1.5 h-6 sm:h-9 lg:h-11 ml-1 bg-rift-accent align-middle rounded-full animate-pulse transition-opacity duration-300"
          style={{ opacity: isComplete ? 0.75 : 1 }}
          aria-hidden="true"
        />
      </p>
    </div>
  );
};
