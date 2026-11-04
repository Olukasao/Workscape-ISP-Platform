import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Mesmos provedores da agenda original (index.html do agenda-tecnicos).
const TILES = {
  ruas: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: { maxZoom: 19, attribution: "© OpenStreetMap" },
  },
  satelite: {
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: { maxZoom: 19, attribution: "Imagens © Esri" },
  },
} as const;

// Centro da área atendida (Franco da Rocha / Francisco Morato / Caieiras).
const CENTRO: L.LatLngExpression = [-23.33, -46.73];

/**
 * Mapa Leaflet controlado por efeito: `draw` recebe um LayerGroup limpo a
 * cada mudança de `deps` e desenha marcadores, rotas e áreas.
 */
export function LeafletMap({
  draw,
  deps,
  satelite = false,
  fitKey,
  className,
}: {
  draw: (layer: L.LayerGroup, map: L.Map) => L.LatLngBounds | null | void;
  deps: unknown[];
  satelite?: boolean;
  /** Ao mudar, reenquadra o mapa nos elementos desenhados. */
  fitKey?: string;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const lastFit = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, {
      center: CENTRO,
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    });
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // O módulo da agenda fica montado escondido; recalcula ao reaparecer.
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    tiles.current?.remove();
    const t = satelite ? TILES.satelite : TILES.ruas;
    tiles.current = L.tileLayer(t.url, t.options).addTo(m);
    tiles.current.bringToBack();
  }, [satelite]);

  useEffect(() => {
    const m = map.current,
      g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const bounds = draw(g, m);
    if (bounds && bounds.isValid() && fitKey !== lastFit.current) {
      lastFit.current = fitKey;
      m.fitBounds(bounds.pad(0.12), { maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return <div ref={host} className={`agenda-map ${className || ""}`.trim()} />;
}

export const escapeHtml = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Pino circular com rótulo, sem imagens externas. */
export function pin(color: string, label = "", size = 26, extra = "") {
  return L.divIcon({
    className: "agenda-pin",
    html: `<span class="agenda-pin-dot ${extra}" style="--pin:${color};width:${size}px;height:${size}px">${escapeHtml(label)}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}
