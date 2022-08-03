import { useState, useEffect, useCallback } from "react";

enum BreakPoint {
  s = "s",
  m = "m",
  l = "l",
}

// Screen Size Hook
const useScreenSize = () => {
  const isClient = typeof window === "object";

  const getSize = useCallback(() => {
    return {
      width: isClient ? window.innerWidth : 0,
      height: isClient ? window.innerHeight : 0,
      screen: BreakPoint.s,
    };
  }, [isClient]);

  const [screenSize, setScreenSize] = useState(getSize);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    function handleResize() {
      setScreenSize(getSize());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (screenSize.width < 641) {
    screenSize.screen = BreakPoint.s;
  } else if (screenSize.width >= 641 && screenSize.width < 1007) {
    screenSize.screen = BreakPoint.m;
  } else if (screenSize.width >= 1024) {
    screenSize.screen = BreakPoint.l;
  }

  return screenSize;
};

export { BreakPoint, useScreenSize as default };
