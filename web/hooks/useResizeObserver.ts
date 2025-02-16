// hooks/useResizeObserver.ts
import { useState, useEffect } from "react";

export default function useResizeObserver(ref: React.RefObject<HTMLElement>) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    resizeObserver.observe(ref.current);

    return () => resizeObserver.disconnect();
  }, [ref]);

  return dimensions;
}
