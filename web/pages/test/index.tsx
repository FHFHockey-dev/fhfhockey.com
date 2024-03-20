import { getLineCombinations } from "components/LineCombinations/utilities";
import { useEffect } from "react";

export default function Page() {
  useEffect(() => {
    getLineCombinations(26);
  }, []);
  return <>h</>;
}
