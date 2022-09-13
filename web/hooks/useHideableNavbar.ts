import { useCallback, useEffect, useRef, useState } from "react";

type ScrollPosition = { scrollX: number; scrollY: number };

export default function useHideableNavbar(): {
  /** A ref to the navbar component. Plug this into the actual element. */
  readonly navbarRef: (node: HTMLElement | null) => void;
  /** If `false`, the navbar component should not be rendered. */
  readonly isNavbarVisible: boolean;
} {
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const navbarHeight = useRef(0);
  const lastPositionRef = useRef<ScrollPosition | null>({
    scrollX: 0,
    scrollY: 0,
  });

  const navbarRef = useCallback((node: HTMLElement | null) => {
    if (node !== null) {
      navbarHeight.current = node.getBoundingClientRect().height;
    }
  }, []);

  useEffect(() => {
    // scroll down => hide
    // scroll up   => show

    const handleScroll = () => {
      if (!lastPositionRef.current) return;
      const scrollTop = window.pageYOffset;

      if (scrollTop < navbarHeight.current) {
        setIsNavbarVisible(true);
        return;
      }

      const lastScrollTop = lastPositionRef.current.scrollY;
      const documentHeight =
        document.documentElement.scrollHeight - navbarHeight.current;
      const windowHeight = window.innerHeight;

      if (lastScrollTop && scrollTop >= lastScrollTop) {
        setIsNavbarVisible(false);
      } else if (scrollTop + windowHeight < documentHeight) {
        setIsNavbarVisible(true);
      }

      lastPositionRef.current = {
        scrollX: window.pageXOffset,
        scrollY: window.pageYOffset,
      };
    };

    const opts: AddEventListenerOptions & EventListenerOptions = {
      passive: true,
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, opts);
    return () => window.removeEventListener("scroll", handleScroll, opts);
  }, []);

  useEffect(() => {}, []);

  return { navbarRef, isNavbarVisible };
}
