import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { resolveModuleTarget } from "../../electron/moduleNavigation";
import { useServers } from "../stores/workspace";

export default function ModuleLinkBoundary() {
  const navigate = useNavigate();
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]");
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute("download")
      )
        return;
      const raw = anchor.getAttribute("href") || "";
      const target = resolveModuleTarget(raw, useServers.getState().config);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      navigate(target);
    };
    document.addEventListener("click", click, true);
    document.addEventListener("auxclick", click, true);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("auxclick", click, true);
    };
  }, [navigate]);
  return null;
}
