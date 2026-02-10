import { useEffect, useRef, useState } from "react";

const isValidLocation = (location) =>
  Number.isFinite(Number(location?.lat)) && Number.isFinite(Number(location?.lng));

const loadLeaflet = () =>
  new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    const existingScript = document.querySelector("script[data-leaflet-script]");
    const existingStyles = document.querySelector("link[data-leaflet-style]");

    const handleResolve = () => {
      if (window.L) resolve(window.L);
      else reject(new Error("Leaflet failed to initialize"));
    };

    if (!existingStyles) {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      style.dataset.leafletStyle = "true";
      document.head.appendChild(style);
    }

    if (existingScript) {
      existingScript.addEventListener("load", handleResolve);
      existingScript.addEventListener("error", () =>
        reject(new Error("Leaflet script failed to load")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.leafletScript = "true";
    script.addEventListener("load", handleResolve);
    script.addEventListener("error", () =>
      reject(new Error("Leaflet script failed to load")),
    );
    document.body.appendChild(script);
  });

const fetchShortestRoute = async (start, end) => {
  const startLat = Number(start.lat);
  const startLng = Number(start.lng);
  const endLat = Number(end.lat);
  const endLng = Number(end.lng);

  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`,
  );

  if (!response.ok) {
    throw new Error("Routing service failed");
  }

  const data = await response.json();
  const routeCoords = data?.routes?.[0]?.geometry?.coordinates;

  if (!Array.isArray(routeCoords) || routeCoords.length === 0) {
    throw new Error("Route path unavailable");
  }

  return routeCoords.map((point) => [Number(point[1]), Number(point[0])]);
};

const LiveRouteMap = ({ startLocation, endLocation, currentLocation, heightClassName = "h-56" }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);
  const markersRef = useRef({
    start: null,
    end: null,
    current: null,
  });
  const requestIdRef = useRef(0);

  const [mapReady, setMapReady] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initializeMap = async () => {
      if (!containerRef.current || mapRef.current) return;

      try {
        const L = await loadLeaflet();
        if (!mounted || !containerRef.current) return;

        const fallbackCenter = isValidLocation(endLocation)
          ? [Number(endLocation.lat), Number(endLocation.lng)]
          : [37.7749, -122.4194];

        const map = L.map(containerRef.current, {
          zoomControl: true,
        }).setView(fallbackCenter, 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;
        setMapReady(true);
      } catch {
        setMapReady(false);
      }
    };

    initializeMap();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      routeLayerRef.current = null;
      markersRef.current = {
        start: null,
        end: null,
        current: null,
      };
    };
  }, [endLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;

    const updateMarker = (key, location, options) => {
      const marker = markersRef.current[key];
      if (isValidLocation(location)) {
        const point = [Number(location.lat), Number(location.lng)];
        if (!marker) {
          markersRef.current[key] = L.circleMarker(point, options).addTo(map);
        } else {
          marker.setLatLng(point);
        }
      } else if (marker) {
        marker.remove();
        markersRef.current[key] = null;
      }
    };

    updateMarker("start", startLocation, {
      radius: 6,
      color: "#1d4ed8",
      fillColor: "#1d4ed8",
      fillOpacity: 0.9,
      weight: 2,
    });
    updateMarker("end", endLocation, {
      radius: 7,
      color: "#dc2626",
      fillColor: "#dc2626",
      fillOpacity: 0.9,
      weight: 2,
    });
    updateMarker("current", currentLocation, {
      radius: 6,
      color: "#059669",
      fillColor: "#10b981",
      fillOpacity: 1,
      weight: 2,
    });
  }, [startLocation, endLocation, currentLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;

    const routeStart = isValidLocation(currentLocation)
      ? currentLocation
      : isValidLocation(startLocation)
        ? startLocation
        : null;
    const routeEnd = isValidLocation(endLocation) ? endLocation : null;

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    const drawFallback = () => {
      if (!routeStart || !routeEnd) return;
      if (routeLayerRef.current) routeLayerRef.current.remove();
      routeLayerRef.current = L.polyline(
        [
          [Number(routeStart.lat), Number(routeStart.lng)],
          [Number(routeEnd.lat), Number(routeEnd.lng)],
        ],
        {
          color: "#3b82f6",
          weight: 4,
          opacity: 0.7,
          dashArray: "8 6",
        },
      ).addTo(map);
      map.fitBounds(routeLayerRef.current.getBounds(), { padding: [24, 24] });
    };

    if (!routeStart || !routeEnd) {
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
      return;
    }

    const drawRoute = async () => {
      try {
        setRouteLoading(true);
        setRouteError("");
        const routePoints = await fetchShortestRoute(routeStart, routeEnd);
        if (requestId !== requestIdRef.current) return;

        if (routeLayerRef.current) routeLayerRef.current.remove();
        routeLayerRef.current = L.polyline(routePoints, {
          color: "#2563eb",
          weight: 4,
          opacity: 0.95,
        }).addTo(map);
        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [24, 24] });
      } catch {
        if (requestId !== requestIdRef.current) return;
        setRouteError("Could not load shortest path. Showing direct path.");
        drawFallback();
      } finally {
        if (requestId === requestIdRef.current) {
          setRouteLoading(false);
        }
      }
    };

    drawRoute();
  }, [startLocation, endLocation, currentLocation]);

  return (
    <div className="space-y-2">
      <div className={`w-full rounded overflow-hidden border border-gray-200 ${heightClassName}`}>
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <div className="text-[11px] text-gray-500">
        {!mapReady && <p>Loading route map...</p>}
        {routeLoading && <p>Computing shortest path...</p>}
        {routeError && <p className="text-amber-600">{routeError}</p>}
      </div>
    </div>
  );
};

export default LiveRouteMap;
