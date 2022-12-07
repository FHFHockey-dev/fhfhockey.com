import { useState, useEffect, useDeferredValue } from "react";

enum BreakPoint {
  s = "s",
  m = "m",
  l = "l",
}

const isClient = typeof window === "object";

const getSize = () => {
  return {
    width: isClient ? window.innerWidth : 0,
    height: isClient ? window.innerHeight : 0,
    screen: BreakPoint.s,
  };
};

// Screen Size Hook
const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState(getSize);

  const deferredScreenSize = useDeferredValue(screenSize);
  useEffect(() => {
    if (!isClient) {
      return;
    }

    const handleResize = () => {
      setScreenSize(getSize);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (deferredScreenSize.width < 641) {
    deferredScreenSize.screen = BreakPoint.s;
  } else if (
    deferredScreenSize.width >= 641 &&
    deferredScreenSize.width < 1007
  ) {
    deferredScreenSize.screen = BreakPoint.m;
  } else if (deferredScreenSize.width >= 1024) {
    deferredScreenSize.screen = BreakPoint.l;
  }

  return deferredScreenSize;
};

export { BreakPoint, useScreenSize as default };
