import { useCallback, useEffect, useRef, useState } from "react";

const MAP_STYLE_API_KEY = import.meta.env.VITE_STADIA_MAPS_API_KEY;
const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY;
const ROUTE_FALLBACK_RETRY_MS = 6000;
const MAP_STYLE_FALLBACK = MAPTILER_API_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`
  : MAP_STYLE_API_KEY
    ? `https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=${MAP_STYLE_API_KEY}`
    : "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || MAP_STYLE_FALLBACK;
const ROUTE_SOURCE_ID = "live-route-source";
const ROUTE_LAYER_ID = "live-route-layer";
const OSRM_BASE_URL = "https://router.project-osrm.org";
const ROUTE_PROXY_API_BASE = (import.meta.env.VITE_BACKEND_URL || "/api").replace(/\/+$/, "");

const isValidLocation = (location) =>
  Number.isFinite(Number(location?.lat)) && Number.isFinite(Number(location?.lng));

const toLngLat = (location) => [Number(location.lng), Number(location.lat)];

const createMarkerElement = (fillColor, borderColor, markerSize) => {
  const markerElement = document.createElement("div");
  markerElement.style.width = `${markerSize}px`;
  markerElement.style.height = `${markerSize}px`;
  markerElement.style.borderRadius = "9999px";
  markerElement.style.backgroundColor = fillColor;
  markerElement.style.border = `2px solid ${borderColor}`;
  markerElement.style.boxShadow = "0 0 0 2px rgba(255,255,255,0.9)";
  return markerElement;
};

const createBikeMarkerElement = () => {
  const markerElement = document.createElement("div");
  markerElement.style.width = "34px";
  markerElement.style.height = "34px";
  markerElement.style.borderRadius = "9999px";
  markerElement.style.background = "linear-gradient(135deg, #10b981, #059669)";
  markerElement.style.border = "2px solid #ffffff";
  markerElement.style.boxShadow = "0 0 0 2px rgba(16,185,129,0.25), 0 8px 18px rgba(0,0,0,0.2)";
  markerElement.style.display = "flex";
  markerElement.style.alignItems = "center";
  markerElement.style.justifyContent = "center";
  markerElement.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="17" r="3" stroke="#ffffff" stroke-width="1.8"/>
      <circle cx="18" cy="17" r="3" stroke="#ffffff" stroke-width="1.8"/>
      <path d="M8 17l3-6h2.4l2.6 6M11 11h-2M13.4 11h3.2M10.4 13.5h5.2" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 8h2" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `;
  return markerElement;
};

const calculateDistanceMeters = (pointA, pointB) => {
  const [lngA, latA] = pointA;
  const [lngB, latB] = pointB;
  const earthRadiusMeters = 6371000;
  const radians = Math.PI / 180;
  const deltaLatitude = (latB - latA) * radians;
  const deltaLongitude = (lngB - lngA) * radians;
  const latitudeAInRadians = latA * radians;
  const latitudeBInRadians = latB * radians;
  const haversineComponent =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitudeAInRadians) *
      Math.cos(latitudeBInRadians) *
      Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversineComponent), Math.sqrt(1 - haversineComponent));
};

const loadMapLibre = () =>
  new Promise((resolve, reject) => {
    if (window.maplibregl) {
      resolve(window.maplibregl);
      return;
    }

    if (window.__mapLibreLoadingPromise) {
      window.__mapLibreLoadingPromise.then(resolve).catch(reject);
      return;
    }

    window.__mapLibreLoadingPromise = new Promise((internalResolve, internalReject) => {
      const existingStyle = document.querySelector("link[data-maplibre-style]");
      const existingScript = document.querySelector("script[data-maplibre-script]");

      const finalizeResolve = () => {
        if (window.maplibregl) {
          internalResolve(window.maplibregl);
          return;
        }
        internalReject(new Error("MapLibre failed to initialize"));
      };

      if (!existingStyle) {
        const styleElement = document.createElement("link");
        styleElement.rel = "stylesheet";
        styleElement.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
        styleElement.dataset.maplibreStyle = "true";
        document.head.appendChild(styleElement);
      }

      if (existingScript) {
        existingScript.addEventListener("load", finalizeResolve);
        existingScript.addEventListener("error", () =>
          internalReject(new Error("MapLibre script failed to load")),
        );
        return;
      }

      const scriptElement = document.createElement("script");
      scriptElement.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
      scriptElement.async = true;
      scriptElement.dataset.maplibreScript = "true";
      scriptElement.addEventListener("load", finalizeResolve);
      scriptElement.addEventListener("error", () =>
        internalReject(new Error("MapLibre script failed to load")),
      );
      document.body.appendChild(scriptElement);
    });

    window.__mapLibreLoadingPromise.then(resolve).catch(reject);
  });

const fetchRouteFromOsrm = async (startLocationCoordinates, endLocationCoordinates) => {
  const [startLongitude, startLatitude] = startLocationCoordinates;
  const [endLongitude, endLatitude] = endLocationCoordinates;

  const response = await fetch(
    `${OSRM_BASE_URL}/route/v1/driving/${startLongitude},${startLatitude};${endLongitude},${endLatitude}?overview=full&geometries=geojson`,
  );

  if (!response.ok) {
    throw new Error("Routing service failed");
  }

  const data = await response.json();
  const routeCoordinates = data?.routes?.[0]?.geometry?.coordinates;

  if (!Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
    throw new Error("Route path unavailable");
  }

  return routeCoordinates.map((point) => [Number(point[0]), Number(point[1])]);
};

const fetchNearestRoadPointFromOsrm = async (locationCoordinates) => {
  const [longitude, latitude] = locationCoordinates;
  const response = await fetch(
    `${OSRM_BASE_URL}/nearest/v1/driving/${longitude},${latitude}?number=1`,
  );

  if (!response.ok) {
    throw new Error("OSRM nearest failed");
  }

  const data = await response.json();
  const nearestLocation = data?.waypoints?.[0]?.location;
  if (!Array.isArray(nearestLocation) || nearestLocation.length < 2) {
    throw new Error("OSRM nearest unavailable");
  }

  return [Number(nearestLocation[0]), Number(nearestLocation[1])];
};

const snapRouteEndpoints = async (startLocationCoordinates, endLocationCoordinates) => {
  const [snappedStartCoordinates, snappedEndCoordinates] = await Promise.all([
    fetchNearestRoadPointFromOsrm(startLocationCoordinates).catch(() => startLocationCoordinates),
    fetchNearestRoadPointFromOsrm(endLocationCoordinates).catch(() => endLocationCoordinates),
  ]);

  const snapped =
    calculateDistanceMeters(startLocationCoordinates, snappedStartCoordinates) > 1 ||
    calculateDistanceMeters(endLocationCoordinates, snappedEndCoordinates) > 1;

  return {
    snappedStartCoordinates,
    snappedEndCoordinates,
    snapped,
  };
};

const fetchRouteFromMapTiler = async (startLocationCoordinates, endLocationCoordinates) => {
  if (!MAPTILER_API_KEY) {
    throw new Error("MapTiler key unavailable");
  }

  const [startLongitude, startLatitude] = startLocationCoordinates;
  const [endLongitude, endLatitude] = endLocationCoordinates;
  const query = new URLSearchParams({
    key: MAPTILER_API_KEY,
    geometry: "geojson",
  });

  const response = await fetch(
    `https://api.maptiler.com/directions/v2/driving/${startLongitude},${startLatitude};${endLongitude},${endLatitude}?${query}`,
  );

  if (!response.ok) {
    throw new Error("MapTiler routing failed");
  }

  const data = await response.json();
  const routeCoordinates = data?.routes?.[0]?.geometry?.coordinates;

  if (!Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
    throw new Error("MapTiler route path unavailable");
  }

  return routeCoordinates.map((point) => [Number(point[0]), Number(point[1])]);
};

const fetchRouteFromBackendProxy = async (startLocationCoordinates, endLocationCoordinates) => {
  const [startLongitude, startLatitude] = startLocationCoordinates;
  const [endLongitude, endLatitude] = endLocationCoordinates;
  const query = new URLSearchParams({
    startLat: String(startLatitude),
    startLng: String(startLongitude),
    endLat: String(endLatitude),
    endLng: String(endLongitude),
  });

  const response = await fetch(`${ROUTE_PROXY_API_BASE}/maps/route?${query.toString()}`);
  if (!response.ok) {
    throw new Error("Route proxy request failed");
  }

  const data = await response.json();
  const routeCoordinates = data?.coordinates;
  if (!Array.isArray(routeCoordinates) || routeCoordinates.length === 0) {
    throw new Error("Route proxy coordinates unavailable");
  }

  const provider = String(data?.provider || "proxy");
  const snapped = Boolean(data?.snapped);

  return {
    routeCoordinates: routeCoordinates.map((point) => [Number(point[0]), Number(point[1])]),
    provider: `server-${provider}`,
    snapped,
  };
};

const fetchShortestRoute = async (startLocationCoordinates, endLocationCoordinates) => {
  try {
    return await fetchRouteFromBackendProxy(startLocationCoordinates, endLocationCoordinates);
  } catch {
    // Browser can still try direct providers if backend route is unavailable.
  }

  const { snappedStartCoordinates, snappedEndCoordinates, snapped } = await snapRouteEndpoints(
    startLocationCoordinates,
    endLocationCoordinates,
  );

  try {
    const routeCoordinates = await fetchRouteFromOsrm(snappedStartCoordinates, snappedEndCoordinates);
    return {
      routeCoordinates,
      provider: "osrm",
      snapped,
    };
  } catch {
    const routeCoordinates = await fetchRouteFromMapTiler(
      snappedStartCoordinates,
      snappedEndCoordinates,
    );
    return {
      routeCoordinates,
      provider: "maptiler",
      snapped,
    };
  }
};

const LiveRouteMap = ({
  startLocation,
  endLocation,
  currentLocation,
  heightClassName = "h-56",
  currentMarkerStyle = "dot",
}) => {
  const mapContainerReference = useRef(null);
  const mapReference = useRef(null);
  const initialCenterLocationsReference = useRef({
    startLocation,
    endLocation,
  });
  const markersReference = useRef({
    start: null,
    end: null,
    current: null,
  });
  const routeRequestIdentifierReference = useRef(0);
  const currentMarkerAnimationFrameReference = useRef(null);
  const renderedCurrentMarkerLocationReference = useRef(null);
  const routeComputationReference = useRef({
    previousStartCoordinates: null,
    previousEndCoordinates: null,
    lastComputedTimestamp: 0,
    lastRouteMode: "none",
  });
  const hasInitialBoundsFitReference = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [routeStatus, setRouteStatus] = useState("loading");

  const removeRouteLayer = useCallback(() => {
    const mapInstance = mapReference.current;
    if (!mapInstance) return;

    if (mapInstance.getLayer(ROUTE_LAYER_ID)) {
      mapInstance.removeLayer(ROUTE_LAYER_ID);
    }

    if (mapInstance.getSource(ROUTE_SOURCE_ID)) {
      mapInstance.removeSource(ROUTE_SOURCE_ID);
    }
  }, []);

  const fitMapToCoordinates = useCallback((mapInstance, maplibre, coordinates, forceFit = false) => {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return;
    }

    if (!forceFit && hasInitialBoundsFitReference.current) {
      return;
    }

    const bounds = coordinates.reduce(
      (accumulatorBounds, coordinatePair) => accumulatorBounds.extend(coordinatePair),
      new maplibre.LngLatBounds(coordinates[0], coordinates[0]),
    );

    mapInstance.fitBounds(bounds, {
      padding: 36,
      duration: 900,
      maxZoom: 15,
    });

    hasInitialBoundsFitReference.current = true;
  }, []);

  const updateRouteLayer = useCallback((mapInstance, maplibre, coordinates, forceFitBounds = false) => {
    const geoJsonRoute = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates,
      },
    };

    const applyRoute = () => {
      if (mapInstance.getSource(ROUTE_SOURCE_ID)) {
        mapInstance.getSource(ROUTE_SOURCE_ID).setData(geoJsonRoute);
      } else {
        mapInstance.addSource(ROUTE_SOURCE_ID, {
          type: "geojson",
          data: geoJsonRoute,
        });

        mapInstance.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#2563eb",
            "line-width": 4,
            "line-opacity": 0.92,
          },
        });
      }

      fitMapToCoordinates(mapInstance, maplibre, coordinates, forceFitBounds);
    };

    if (mapInstance.isStyleLoaded()) {
      applyRoute();
      return;
    }

    mapInstance.once("load", applyRoute);
  }, [fitMapToCoordinates]);

  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      if (!mapContainerReference.current || mapReference.current) return;

      try {
        const maplibre = await loadMapLibre();
        if (!isMounted || !mapContainerReference.current) return;

        const initialEndLocation = initialCenterLocationsReference.current.endLocation;
        const initialStartLocation = initialCenterLocationsReference.current.startLocation;
        const fallbackCenter = isValidLocation(initialEndLocation)
          ? toLngLat(initialEndLocation)
          : isValidLocation(initialStartLocation)
            ? toLngLat(initialStartLocation)
            : [-122.4194, 37.7749];

        const mapInstance = new maplibre.Map({
          container: mapContainerReference.current,
          style: MAP_STYLE_URL,
          center: fallbackCenter,
          zoom: 13,
        });

        mapInstance.addControl(new maplibre.NavigationControl({ showCompass: true }), "top-right");

        mapInstance.on("load", () => {
          if (isMounted) {
            setMapReady(true);
          }
        });

        mapReference.current = mapInstance;
      } catch {
        if (isMounted) {
          setMapReady(false);
        }
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      if (currentMarkerAnimationFrameReference.current) {
        cancelAnimationFrame(currentMarkerAnimationFrameReference.current);
      }
      if (mapReference.current) {
        mapReference.current.remove();
        mapReference.current = null;
      }
      markersReference.current = {
        start: null,
        end: null,
        current: null,
      };
      renderedCurrentMarkerLocationReference.current = null;
      hasInitialBoundsFitReference.current = false;
    };
  }, []);

  useEffect(() => {
    const mapInstance = mapReference.current;
    const maplibre = window.maplibregl;
    if (!mapInstance || !maplibre) return;

    const upsertStaticMarker = (markerKey, location, fillColor, borderColor, markerSize) => {
      const existingMarker = markersReference.current[markerKey];
      if (!isValidLocation(location)) {
        if (existingMarker) {
          existingMarker.remove();
          markersReference.current[markerKey] = null;
        }
        return;
      }

      const locationCoordinates = toLngLat(location);

      if (!existingMarker) {
        const markerInstance = new maplibre.Marker({
          element: createMarkerElement(fillColor, borderColor, markerSize),
        })
          .setLngLat(locationCoordinates)
          .addTo(mapInstance);
        markersReference.current[markerKey] = markerInstance;
        return;
      }

      existingMarker.setLngLat(locationCoordinates);
    };

    const animateCurrentMarker = (nextLocation) => {
      const existingMarker = markersReference.current.current;
      if (!isValidLocation(nextLocation)) {
        if (existingMarker) {
          existingMarker.remove();
          markersReference.current.current = null;
        }
        renderedCurrentMarkerLocationReference.current = null;
        if (currentMarkerAnimationFrameReference.current) {
          cancelAnimationFrame(currentMarkerAnimationFrameReference.current);
          currentMarkerAnimationFrameReference.current = null;
        }
        return;
      }

      const targetCoordinates = toLngLat(nextLocation);

      if (!existingMarker) {
        const currentMarkerElement =
          currentMarkerStyle === "bike"
            ? createBikeMarkerElement()
            : createMarkerElement("#10b981", "#047857", 14);
        const markerInstance = new maplibre.Marker({
          element: currentMarkerElement,
        })
          .setLngLat(targetCoordinates)
          .addTo(mapInstance);
        markersReference.current.current = markerInstance;
        renderedCurrentMarkerLocationReference.current = targetCoordinates;
        return;
      }

      if (currentMarkerAnimationFrameReference.current) {
        cancelAnimationFrame(currentMarkerAnimationFrameReference.current);
      }

      const animationStartCoordinates =
        renderedCurrentMarkerLocationReference.current ||
        [existingMarker.getLngLat().lng, existingMarker.getLngLat().lat];
      const animationStartTimestamp = performance.now();
      const animationDurationMilliseconds = 900;

      const stepAnimation = (currentTimestamp) => {
        const progressRatio = Math.min(
          (currentTimestamp - animationStartTimestamp) / animationDurationMilliseconds,
          1,
        );
        const easedProgress =
          progressRatio < 0.5
            ? 2 * progressRatio * progressRatio
            : 1 - ((-2 * progressRatio + 2) ** 2) / 2;
        const interpolatedLongitude =
          animationStartCoordinates[0] +
          (targetCoordinates[0] - animationStartCoordinates[0]) * easedProgress;
        const interpolatedLatitude =
          animationStartCoordinates[1] +
          (targetCoordinates[1] - animationStartCoordinates[1]) * easedProgress;
        const interpolatedCoordinates = [interpolatedLongitude, interpolatedLatitude];

        existingMarker.setLngLat(interpolatedCoordinates);
        renderedCurrentMarkerLocationReference.current = interpolatedCoordinates;

        if (progressRatio < 1) {
          currentMarkerAnimationFrameReference.current = requestAnimationFrame(stepAnimation);
        } else {
          currentMarkerAnimationFrameReference.current = null;
          renderedCurrentMarkerLocationReference.current = targetCoordinates;
        }
      };

      currentMarkerAnimationFrameReference.current = requestAnimationFrame(stepAnimation);
    };

    // Keep destination marker on top so user drop-off pin remains visible even
    // when partner reaches the exact same coordinates.
    upsertStaticMarker("start", startLocation, "#1d4ed8", "#1e3a8a", 13);
    animateCurrentMarker(currentLocation);
    upsertStaticMarker("end", endLocation, "#dc2626", "#7f1d1d", 16);
  }, [startLocation, endLocation, currentLocation, currentMarkerStyle]);

  useEffect(() => {
    const mapInstance = mapReference.current;
    const maplibre = window.maplibregl;
    if (!mapInstance || !maplibre) return;

    const routeStartLocation = isValidLocation(currentLocation)
      ? currentLocation
      : isValidLocation(startLocation)
        ? startLocation
        : null;
    const routeEndLocation = isValidLocation(endLocation) ? endLocation : null;

    routeRequestIdentifierReference.current += 1;
    const activeRequestIdentifier = routeRequestIdentifierReference.current;

    if (!routeStartLocation || !routeEndLocation) {
      removeRouteLayer();
      setRouteStatus("idle");
      return;
    }

    const startCoordinates = toLngLat(routeStartLocation);
    const endCoordinates = toLngLat(routeEndLocation);
    const previousStartCoordinates = routeComputationReference.current.previousStartCoordinates;
    const previousEndCoordinates = routeComputationReference.current.previousEndCoordinates;
    const elapsedFromLastComputation =
      Date.now() - routeComputationReference.current.lastComputedTimestamp;
    const startMovedMeters = previousStartCoordinates
      ? calculateDistanceMeters(previousStartCoordinates, startCoordinates)
      : Infinity;
    const endMovedMeters = previousEndCoordinates
      ? calculateDistanceMeters(previousEndCoordinates, endCoordinates)
      : Infinity;
    const shouldRefetchRoute =
      !previousStartCoordinates ||
      !previousEndCoordinates ||
      startMovedMeters >= 120 ||
      endMovedMeters >= 20 ||
      elapsedFromLastComputation > 30000 ||
      (routeComputationReference.current.lastRouteMode === "fallback" &&
        elapsedFromLastComputation > ROUTE_FALLBACK_RETRY_MS);
    const shouldFitBounds = !hasInitialBoundsFitReference.current || endMovedMeters >= 20;

    const drawFallbackRoute = () => {
      updateRouteLayer(mapInstance, maplibre, [startCoordinates, endCoordinates], shouldFitBounds);
      setRouteStatus("fallback");
    };

    if (!mapInstance.getSource(ROUTE_SOURCE_ID)) {
      drawFallbackRoute();
    }

    if (!shouldRefetchRoute) {
      return;
    }

    const drawRoute = async () => {
      try {
        const { routeCoordinates, provider, snapped } = await fetchShortestRoute(
          startCoordinates,
          endCoordinates,
        );
        if (activeRequestIdentifier !== routeRequestIdentifierReference.current) return;

        updateRouteLayer(mapInstance, maplibre, routeCoordinates, shouldFitBounds);
        setRouteStatus(snapped ? `${provider}-snapped` : provider);
        routeComputationReference.current = {
          previousStartCoordinates: startCoordinates,
          previousEndCoordinates: endCoordinates,
          lastComputedTimestamp: Date.now(),
          lastRouteMode: "network",
        };
      } catch {
        if (activeRequestIdentifier !== routeRequestIdentifierReference.current) return;
        drawFallbackRoute();
        routeComputationReference.current = {
          previousStartCoordinates: startCoordinates,
          previousEndCoordinates: endCoordinates,
          lastComputedTimestamp: Date.now(),
          lastRouteMode: "fallback",
        };
      } finally {
        // No-op: avoid flickering status text for background route recomputations.
      }
    };

    drawRoute();
  }, [startLocation, endLocation, currentLocation, removeRouteLayer, updateRouteLayer]);

  return (
    <div className="space-y-2">
      <div className={`w-full rounded overflow-hidden border border-gray-200 ${heightClassName}`}>
        <div ref={mapContainerReference} className="h-full w-full" />
      </div>
      <div className="flex items-center justify-between">
        {!mapReady && <div className="text-[11px] text-gray-500">Loading route map...</div>}
        {routeStatus !== "idle" && (
          <div
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              routeStatus === "fallback"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-blue-50 text-blue-700 border border-blue-200"
            }`}
          >
            {routeStatus === "fallback"
              ? "Route: direct line (fallback)"
              : routeStatus === "server-osrm-snapped"
                ? "Route: exact (Server/OSRM, snapped)"
                : routeStatus === "server-maptiler-snapped"
                  ? "Route: exact (Server/MapTiler, snapped)"
                  : routeStatus === "server-proxy-snapped"
                    ? "Route: exact (Server, snapped)"
                    : routeStatus === "server-osrm"
                      ? "Route: exact (Server/OSRM)"
                      : routeStatus === "server-maptiler"
                        ? "Route: exact (Server/MapTiler)"
                        : routeStatus === "server-proxy"
                          ? "Route: exact (Server)"
              : routeStatus === "osrm-snapped"
                ? "Route: exact (OSRM, snapped)"
                : routeStatus === "maptiler-snapped"
                  ? "Route: exact (MapTiler, snapped)"
                  : routeStatus === "maptiler"
                    ? "Route: exact (MapTiler)"
                    : routeStatus === "osrm"
                      ? "Route: exact (OSRM)"
                      : "Route: updating"}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveRouteMap;
