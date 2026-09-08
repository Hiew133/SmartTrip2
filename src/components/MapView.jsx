import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { hasCoords } from '../data.js';
import { basemap } from '../backend/maps.js';

/* Warm-paper Leaflet map of one day's stops: terracotta route, numbered round
   pins, focused pin in sage + popup (see organic.css).

   Two things can go under the pins. With a Goong Maptiles key it is Goong's
   own basemap, which knows Vietnamese street and place names that
   OpenStreetMap renders sparsely or not at all; without one it is OSM raster
   tiles, as before. Goong's styles are vector, so that path needs MapLibre —
   which is why it is loaded with a dynamic import and only when a key exists.
   A build with no key never downloads a byte of it.

   If no tile server is reachable at all, falls back to a paper-dot background
   with a note — pin positions stay correct.

   `routePath` is the real road line between the stops, fetched by whoever owns
   the day (see components/useRoadRoute.js). Given one, it is drawn solid;
   without one the pins are joined by the old dashed straight line, and the two
   look different on purpose: a straight line between two pins is a claim about
   distance that no road supports. */
export default function MapView({
  stops = [], focusIdx = -1, routePath = null, zoomControl = true, style, onBasemap,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [noTiles, setNoTiles] = useState(false);

  /* Held in a ref so a caller passing an inline arrow does not tear the map
     down and rebuild it on every render. Seeded at first render and kept
     current from an effect — writing a ref during render is the cascade the
     hooks rules exist to catch. */
  const reportRef = useRef(onBasemap);
  useEffect(() => { reportRef.current = onBasemap; }, [onBasemap]);

  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl, attributionControl: true });
    map.setView([16.05, 108.22], 12);
    mapRef.current = map;

    let loadedTiles = 0;
    let usingFallback = false;
    let disposed = false;
    let glLayer = null;
    const timers = [];

    const addRaster = (url, onFail) => {
      const lyr = L.tileLayer(url, { attribution: '© OpenStreetMap contributors', maxZoom: 19 });
      let failed = 0;
      lyr.on('tileload', () => { loadedTiles++; });
      lyr.on('tileerror', () => {
        failed++;
        if (failed > 2 && loadedTiles === 0 && map.hasLayer(lyr)) { map.removeLayer(lyr); onFail(); }
      });
      lyr.addTo(map);
      timers.push(setTimeout(() => {
        if (loadedTiles === 0 && map.hasLayer(lyr)) { map.removeLayer(lyr); onFail(); }
      }, 4000));
    };

    /* Which basemap is really on screen, not which one was configured. The
       caption next to the map credits it, and after a fallback those are two
       different providers — crediting the wrong one is a licence problem as
       much as a wording one. */
    const report = (kind) => { if (!disposed) reportRef.current?.(kind); };

    const openStreetMap = () => {
      report('osm');
      addRaster('https://tile.openstreetmap.org/{z}/{x}/{y}.png', () => {
        if (usingFallback) return;
        usingFallback = true;
        addRaster('https://tile.openstreetmap.de/{z}/{x}/{y}.png', () => setNoTiles(true));
      });
    };

    const base = basemap();
    if (base.kind === 'goong') {
      /* MapLibre is ~250 kB gzipped and the whole reason this import is
         dynamic. It also has to be pre-bundled in vite.config.js for the same
         reason firebase/ai is: Vite cannot see a dynamic-only import while it
         scans at startup, discovers it mid-session, re-optimises, and leaves
         the request already in flight pointing at a stale hash. */
      Promise.all([
        import('maplibre-gl'),
        import('@maplibre/maplibre-gl-leaflet'),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ]).then(([, plugin]) => {
        if (disposed) return;
        /* Named export, not L.maplibreGL: the plugin only patches itself onto
           L when that namespace object is extensible, and under a bundler it
           often is not. */
        const maplibreGL = plugin.maplibreGL || plugin.default;
        glLayer = maplibreGL({ style: base.style, attribution: '© Goong Maps' }).addTo(map);

        const gl = glLayer.getMaplibreMap();
        let styleLoaded = false;
        gl?.on('load', () => { styleLoaded = true; report('goong'); });
        /* Only an error *before* the style loads means the basemap is not
           coming: a wrong or expired Maptiles key, or a style that has moved.
           MapLibre also emits `error` for a single tile that timed out, and
           tearing the whole basemap down over one of those would be worse
           than the hiccup. */
        gl?.on('error', (e) => {
          if (disposed || styleLoaded || !glLayer || !map.hasLayer(glLayer)) return;
          console.warn('SmartTrip · Goong basemap không tải được, quay lại OpenStreetMap:', e?.error || e);
          map.removeLayer(glLayer);
          glLayer = null;
          openStreetMap();
        });
      }).catch((err) => {
        /* Also the landing place for a device with no WebGL, where
           constructing the GL map throws rather than emitting an event. */
        if (disposed) return;
        console.warn('SmartTrip · nạp MapLibre:', err);
        openStreetMap();
      });
    } else {
      openStreetMap();
    }

    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      layerRef.current = null;   // the group dies with the map; don't reuse the handle
      map.remove();
      mapRef.current = null;
    };
  }, [zoomControl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) layerRef.current.remove();
    const g = L.layerGroup().addTo(map);
    layerRef.current = g;

    /* A stop added by hand has no coordinates until somebody picks a search
       suggestion, so it is skipped here — but pin numbers stay tied to the
       stop's real position in the day, not to its position on the map. */
    const located = stops.map((s, i) => ({ s, i })).filter(({ s }) => hasCoords(s));
    const pts = located.map(({ s }) => [s.lat, s.lng]);
    const road = Array.isArray(routePath) && routePath.length > 1 ? routePath : null;

    if (road) {
      L.polyline(road, { color: '#c67139', weight: 4, opacity: 0.65, lineCap: 'round', lineJoin: 'round' }).addTo(g);
    } else if (pts.length > 1) {
      L.polyline(pts, { color: '#c67139', weight: 3, opacity: 0.5, dashArray: '1 9', lineCap: 'round' }).addTo(g);
    }

    let focusMarker = null;
    located.forEach(({ s, i }) => {
      const isFocus = i === focusIdx;
      const el = document.createElement('div');
      el.className = 'pin' + (isFocus ? ' focus' : '');
      el.textContent = String(i + 1);
      const m = L.marker([s.lat, s.lng], {
        icon: L.divIcon({ className: '', html: el, iconSize: [27, 27], iconAnchor: [13, 13] }),
      }).addTo(g);
      const popup = document.createElement('div');
      const time = document.createElement('div');
      time.className = 't';
      time.textContent = s.time;
      const name = document.createElement('b');
      name.textContent = s.name;
      popup.append(time, name);
      m.bindPopup(popup);
      if (isFocus) focusMarker = m;
    });

    const t = setTimeout(() => {
      map.invalidateSize();
      /* Fit to the pins, not to the road line: a route that loops out to a
         bypass would otherwise zoom the day's stops down to nothing. */
      if (pts.length) map.fitBounds(pts, { padding: [34, 34], maxZoom: 15 });
      if (focusMarker) focusMarker.openPopup();
    }, 60);
    return () => clearTimeout(t);
  }, [stops, focusIdx, routePath]);

  const missing = stops.filter((s) => !hasCoords(s)).length;

  return (
    <div className={'st-mapwrap' + (noTiles ? ' no-tiles' : '')} style={style}>
      <div ref={elRef} className="st-map" style={{ position: 'absolute', inset: 0 }} />
      {noTiles && (
        <div className="st-map-note">
          Bản đồ nền không tải được — vị trí ghim vẫn chính xác.
        </div>
      )}
      {!noTiles && missing > 0 && (
        <div className="st-map-note">
          {missing} điểm dừng chưa có toạ độ nên chưa hiện trên bản đồ.
        </div>
      )}
    </div>
  );
}
