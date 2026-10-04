// Ambria FnB — shared "is this a phone-width viewport" hook.
// Used to switch a dense grid/table layout to a stacked card layout on
// narrow screens, where CSS reflow alone can't relabel columns into
// label:value pairs. 768px matches the breakpoint the admin shell's own
// slide-in sidebar switches at (theme.js, .ash-sidebar mobile rules).
import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= breakpoint
  );
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth <= breakpoint); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

export default useIsMobile;
