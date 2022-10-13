import { useState, useEffect, useCallback } from "react";
import debounce from "utils/debounce";

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

  const handleResize = useCallback(
    debounce(
      () => {
        setScreenSize(getSize());
      },
      300,
      true
    ),
    []
  );

  useEffect(() => {
    if (!isClient) {
      return;
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

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
