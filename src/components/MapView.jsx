import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

/* Warm-paper Leaflet map of one day's stops: dashed terracotta route,
   numbered round pins, focused pin in sage + popup (see organic.css).
   If no tile server is reachable, falls back to a paper-dot background
   with a note — pin positions stay correct. */
export default function MapView({ stops, focusIdx = -1, zoomControl = true, style }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [noTiles, setNoTiles] = useState(false);

  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl, attributionControl: true });
    map.setView([16.05, 108.22], 12);
    mapRef.current = map;

    let loadedTiles = 0;
    let usingFallback = false;
    const timers = [];
    const addLayer = (url, onFail) => {
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
    addLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', () => {
      if (usingFallback) return;
      usingFallback = true;
      addLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', () => setNoTiles(true));
    });

    return () => {
      timers.forEach(clearTimeout);
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

    const pts = stops.map((s) => [s.lat, s.lng]);
    if (pts.length > 1) {
      L.polyline(pts, { color: '#c67139', weight: 3, opacity: 0.5, dashArray: '1 9', lineCap: 'round' }).addTo(g);
    }
    let focusMarker = null;
    stops.forEach((s, i) => {
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
      time.textContent = s.t;
      const name = document.createElement('b');
      name.textContent = s.n;
      popup.append(time, name);
      m.bindPopup(popup);
      if (isFocus) focusMarker = m;
    });

    const t = setTimeout(() => {
      map.invalidateSize();
      if (pts.length) map.fitBounds(pts, { padding: [34, 34], maxZoom: 15 });
      if (focusMarker) focusMarker.openPopup();
    }, 60);
    return () => clearTimeout(t);
  }, [stops, focusIdx]);

  return (
    <div className={'st-mapwrap' + (noTiles ? ' no-tiles' : '')} style={style}>
      <div ref={elRef} className="st-map" style={{ position: 'absolute', inset: 0 }} />
      {noTiles && (
        <div className="st-map-note">
          Bản đồ nền không tải được — vị trí ghim vẫn chính xác.
        </div>
      )}
    </div>
  );
}
