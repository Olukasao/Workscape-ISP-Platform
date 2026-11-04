import { useCallback, useEffect, useLayoutEffect } from "react";
import { usePreferences, useSession, useServers } from "../stores/workspace";
import { DEFAULT_ZOOM, normalizeZoom, ZOOM_STEP } from "./zoom";

export function useZoomPreference() {
  const user = useSession((s) => s.user);
  const server = useServers((s) => s.config.chat);
  const userKey = user ? JSON.stringify([server, user.empresa_id, user.id]) : "login";
  const percent = usePreferences((s) => normalizeZoom(s.zoomByUser[userKey]));
  const save = usePreferences((s) => s.setZoom);
  const setZoom = useCallback((value: number) => save(userKey, value), [save, userKey]);
  return { percent, setZoom };
}

/** Uma escala para toda a janela, inclusive menus, diálogos e módulos antigos. */
export function useApplicationZoom() {
  const { percent, setZoom } = useZoomPreference();
  useLayoutEffect(() => {
    if (window.desktop) {
      void window.desktop.setZoom(percent);
    } else {
      // O preview web acompanha o desktop; compensa as alturas em unidades de viewport.
      document.documentElement.style.zoom = String(percent / 100);
      document.documentElement.style.setProperty("--workspace-viewport-height", `calc(100dvh / ${percent / 100})`);
    }
  }, [percent]);
  useEffect(() => {
    const stopNative = window.desktop?.onZoomStep((action) => {
      setZoom(action === "reset" ? DEFAULT_ZOOM : percent + (action === "in" ? ZOOM_STEP : -ZOOM_STEP));
    });
    const keydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      let next: number;
      if (["+", "=", "Add"].includes(event.key)) next = percent + ZOOM_STEP;
      else if (["-", "_", "Subtract"].includes(event.key)) next = percent - ZOOM_STEP;
      else if (event.key === "0" || event.code === "Numpad0") next = DEFAULT_ZOOM;
      else return;
      event.preventDefault();
      event.stopPropagation();
      setZoom(next);
    };
    window.addEventListener("keydown", keydown, true);
    return () => {
      stopNative?.();
      window.removeEventListener("keydown", keydown, true);
    };
  }, [percent, setZoom]);
}
