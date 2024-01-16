import { useEffect, useState } from "react";

export default function ClientOnly({ children, placeHolder, ...delegated }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return placeHolder ?? null;
  }

  return <div {...delegated}>{children}</div>;
}
