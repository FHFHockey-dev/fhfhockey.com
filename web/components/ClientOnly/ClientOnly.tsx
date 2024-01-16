import { ReactNode, useEffect, useState } from "react";

interface ClientOnlyProps {
  children: ReactNode;
  placeHolder?: ReactNode;
  [key: string]: any;
}

export default function ClientOnly({
  children,
  placeHolder,
  ...delegated
}: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{placeHolder ?? null}</>;
  }

  return <div {...delegated}>{children}</div>;
}
