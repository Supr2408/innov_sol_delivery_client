import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const CARTO_VOYAGER_STYLE_URL = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

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
      const existingStyleElement = document.querySelector("link[data-maplibre-style]");
      const existingScriptElement = document.querySelector("script[data-maplibre-script]");

      const finalizeMapLibreLoad = () => {
        if (window.maplibregl) {
          internalResolve(window.maplibregl);
          return;
        }

        internalReject(new Error("MapLibre failed to initialize"));
      };

      if (!existingStyleElement) {
        const styleElement = document.createElement("link");
        styleElement.rel = "stylesheet";
        styleElement.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
        styleElement.dataset.maplibreStyle = "true";
        document.head.appendChild(styleElement);
      }

      if (existingScriptElement) {
        existingScriptElement.addEventListener("load", finalizeMapLibreLoad);
        existingScriptElement.addEventListener("error", () =>
          internalReject(new Error("MapLibre script failed to load")),
        );
        return;
      }

      const scriptElement = document.createElement("script");
      scriptElement.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
      scriptElement.async = true;
      scriptElement.dataset.maplibreScript = "true";
      scriptElement.addEventListener("load", finalizeMapLibreLoad);
      scriptElement.addEventListener("error", () =>
        internalReject(new Error("MapLibre script failed to load")),
      );
      document.body.appendChild(scriptElement);
    });

    window.__mapLibreLoadingPromise.then(resolve).catch(reject);
  });

const buildPhotonLabel = (properties = {}) => {
  const labelParts = [
    properties.name,
    properties.housenumber && properties.street
      ? `${properties.housenumber} ${properties.street}`
      : properties.street,
    properties.district,
    properties.city,
    properties.state,
    properties.country,
  ].filter(Boolean);

  return labelParts.join(", ");
};

const searchPhoton = async (queryText) => {
  const query = new URLSearchParams({
    q: queryText,
    limit: "6",
    lang: "en",
  });

  const response = await fetch(`https://photon.komoot.io/api/?${query}`);
  if (!response.ok) {
    throw new Error("Location search failed");
  }

  const data = await response.json();
  const features = Array.isArray(data?.features) ? data.features : [];

  return features
    .map((feature) => {
      const coordinates = feature?.geometry?.coordinates;
      const lng = Array.isArray(coordinates) ? Number(coordinates[0]) : NaN;
      const lat = Array.isArray(coordinates) ? Number(coordinates[1]) : NaN;

      return {
        label: buildPhotonLabel(feature?.properties),
        lat,
        lng,
      };
    })
    .filter((result) => result.label && Number.isFinite(result.lat) && Number.isFinite(result.lng));
};

const reversePhoton = async (lat, lng) => {
  const query = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    limit: "1",
    lang: "en",
  });

  const response = await fetch(`https://photon.komoot.io/reverse?${query}`);
  if (!response.ok) {
    throw new Error("Reverse geocoding failed");
  }

  const data = await response.json();
  const feature = Array.isArray(data?.features) ? data.features[0] : null;
  return buildPhotonLabel(feature?.properties);
};

const searchMapTiler = async (queryText, mapTilerApiKey) => {
  const query = new URLSearchParams({
    key: mapTilerApiKey,
    language: "en",
    autocomplete: "true",
    limit: "6",
  });

  const encodedQueryText = encodeURIComponent(queryText);
  const response = await fetch(`https://api.maptiler.com/geocoding/${encodedQueryText}.json?${query}`);
  if (!response.ok) {
    throw new Error("MapTiler search failed");
  }

  const data = await response.json();
  const features = Array.isArray(data?.features) ? data.features : [];

  return features
    .map((feature) => {
      const centerCoordinates = feature?.center;
      const lng = Array.isArray(centerCoordinates) ? Number(centerCoordinates[0]) : NaN;
      const lat = Array.isArray(centerCoordinates) ? Number(centerCoordinates[1]) : NaN;
      const label = feature?.place_name || feature?.text || "";

      return {
        label,
        lat,
        lng,
      };
    })
    .filter((result) => result.label && Number.isFinite(result.lat) && Number.isFinite(result.lng));
};

const reverseMapTiler = async (lat, lng, mapTilerApiKey) => {
  const query = new URLSearchParams({
    key: mapTilerApiKey,
    language: "en",
    limit: "1",
  });

  const response = await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?${query}`);
  if (!response.ok) {
    throw new Error("MapTiler reverse geocoding failed");
  }

  const data = await response.json();
  const feature = Array.isArray(data?.features) ? data.features[0] : null;
  return feature?.place_name || feature?.text || "";
};

const createDeliveryPinElement = () => {
  const markerElement = document.createElement("div");
  markerElement.style.width = "18px";
  markerElement.style.height = "18px";
  markerElement.style.borderRadius = "9999px";
  markerElement.style.background = "#e23744";
  markerElement.style.border = "3px solid #ffffff";
  markerElement.style.boxShadow = "0 0 0 2px rgba(226,55,68,0.25), 0 10px 20px rgba(0,0,0,0.22)";
  return markerElement;
};

const DeliveryLocationPicker = ({ value, onChange, onAddressResolved }) => {
  const mapTilerApiKey = import.meta.env.VITE_MAPTILER_API_KEY;
  const mapTilerStyleUrl = mapTilerApiKey
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerApiKey}`
    : "";
  const mapStyleUrl =
    import.meta.env.VITE_LOCATION_PICKER_MAP_STYLE_URL ||
    import.meta.env.VITE_MAP_STYLE_URL ||
    mapTilerStyleUrl ||
    CARTO_VOYAGER_STYLE_URL;

  const mapContainerRef = useRef(null);
  const searchContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  const suppressSearchRef = useRef(false);
  const onAddressResolvedRef = useRef(onAddressResolved);
  const onChangeRef = useRef(onChange);
  const initialSelectedLocationRef = useRef(value);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [locating, setLocating] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [locationResults, setLocationResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    onAddressResolvedRef.current = onAddressResolved;
  }, [onAddressResolved]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!searchContainerRef.current) return;
      if (!searchContainerRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeMap = async () => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      try {
        const maplibre = await loadMapLibre();
        if (!isMounted || !mapContainerRef.current) return;

        const initialSelectedLocation = initialSelectedLocationRef.current;
        const initialLocation =
          initialSelectedLocation &&
          Number.isFinite(initialSelectedLocation.lat) &&
          Number.isFinite(initialSelectedLocation.lng)
            ? { lat: Number(initialSelectedLocation.lat), lng: Number(initialSelectedLocation.lng) }
            : DEFAULT_CENTER;

        const mapInstance = new maplibre.Map({
          container: mapContainerRef.current,
          style: mapStyleUrl,
          center: [initialLocation.lng, initialLocation.lat],
          zoom: 14,
        });

        mapInstance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

        const markerInstance = new maplibre.Marker({
          element: createDeliveryPinElement(),
          draggable: true,
        })
          .setLngLat([initialLocation.lng, initialLocation.lat])
          .addTo(mapInstance);

        markerInstance.on("dragend", () => {
          const markerPosition = markerInstance.getLngLat();
          onChangeRef.current({
            lat: Number(markerPosition.lat.toFixed(6)),
            lng: Number(markerPosition.lng.toFixed(6)),
          });
        });

        mapInstance.on("click", (event) => {
          const lat = Number(event.lngLat.lat.toFixed(6));
          const lng = Number(event.lngLat.lng.toFixed(6));
          onChangeRef.current({ lat, lng });
        });

        mapInstanceRef.current = mapInstance;
        markerInstanceRef.current = markerInstance;
        setMapReady(true);
      } catch (error) {
        if (!isMounted) return;
        setMapReady(false);
        setMapError(error.message || "Unable to load map");
      }
    };

    initializeMap();

    return () => {
      isMounted = false;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      markerInstanceRef.current = null;
    };
  }, [mapStyleUrl]);

  useEffect(() => {
    const mapInstance = mapInstanceRef.current;
    const markerInstance = markerInstanceRef.current;

    if (!mapInstance || !markerInstance || !value) return;

    const nextLatitude = Number(value.lat);
    const nextLongitude = Number(value.lng);
    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) return;

    markerInstance.setLngLat([nextLongitude, nextLatitude]);
    mapInstance.easeTo({
      center: [nextLongitude, nextLatitude],
      zoom: 15,
      duration: 700,
    });
  }, [value]);

  useEffect(() => {
    if (!value || !onAddressResolvedRef.current) return;

    let cancelled = false;

    const resolveAddress = async () => {
      try {
        setResolvingAddress(true);
        const resolvedAddress = mapTilerApiKey
          ? await reverseMapTiler(value.lat, value.lng, mapTilerApiKey)
          : await reversePhoton(value.lat, value.lng);

        if (!cancelled && resolvedAddress) {
          suppressSearchRef.current = true;
          setSearchQuery(resolvedAddress);
          onAddressResolvedRef.current(resolvedAddress);
        }
      } catch {
        setMapError("");
      } finally {
        if (!cancelled) {
          setResolvingAddress(false);
        }
      }
    };

    resolveAddress();

    return () => {
      cancelled = true;
    };
  }, [mapTilerApiKey, value]);

  const triggerSearch = async (queryText, requestId) => {
    try {
      setSearchingLocations(true);
      const results = mapTilerApiKey
        ? await searchMapTiler(queryText, mapTilerApiKey)
        : await searchPhoton(queryText);
      if (requestId !== searchRequestIdRef.current) return;
      setLocationResults(results);
      setShowResults(true);
    } catch {
      if (requestId !== searchRequestIdRef.current) return;
      setLocationResults([]);
      setShowResults(true);
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearchingLocations(false);
      }
    }
  };

  const handleSearchInputChange = (event) => {
    const nextSearchValue = event.target.value;
    setSearchQuery(nextSearchValue);

    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const trimmedSearchValue = nextSearchValue.trim();
    if (trimmedSearchValue.length < 3) {
      searchRequestIdRef.current += 1;
      setLocationResults([]);
      setShowResults(false);
      setSearchingLocations(false);
      return;
    }

    const nextRequestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = nextRequestId;

    searchTimeoutRef.current = setTimeout(() => {
      triggerSearch(trimmedSearchValue, nextRequestId);
    }, 250);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        onChangeRef.current({ lat, lng });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSelectLocation = (selectedLocation) => {
    onChangeRef.current({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    suppressSearchRef.current = true;
    setSearchQuery(selectedLocation.label);
    setShowResults(false);

    if (onAddressResolvedRef.current) {
      onAddressResolvedRef.current(selectedLocation.label);
    }
  };

  return (
    <div className="rounded border border-gray-200 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-700">Delivery Location</p>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {locating ? "Locating..." : "Use My Location"}
        </button>
      </div>

      <div className="relative" ref={searchContainerRef}>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchInputChange}
          onFocus={() => {
            if (locationResults.length > 0) setShowResults(true);
          }}
          placeholder="Search area, street, landmark..."
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        {showResults && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow max-h-56 overflow-auto">
            {searchingLocations ? (
              <div className="px-3 py-2 text-xs text-gray-500">Searching locations...</div>
            ) : locationResults.length > 0 ? (
              locationResults.map((location, index) => (
                <button
                  key={`${location.lat}-${location.lng}-${index}`}
                  type="button"
                  onClick={() => handleSelectLocation(location)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  {location.label}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-gray-500">No matching locations found.</div>
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-gray-500">Type at least 3 characters to get suggestions.</p>
      </div>

      <div className="h-56 w-full rounded overflow-hidden border border-gray-200">
        <div ref={mapContainerRef} className="h-full w-full" />
      </div>

      <div className="text-xs text-gray-600 space-y-1">
        <p>Tap map or drag red pin for manual selection.</p>
        {value ? (
          <p>
            Selected: {value.lat}, {value.lng}
          </p>
        ) : (
          <p>No location selected yet.</p>
        )}
        {resolvingAddress && <p>Resolving address...</p>}
        {mapError && <p className="text-red-600">{mapError}</p>}
        {!mapError && !mapReady && <p>Loading map...</p>}
        <p className="text-gray-500">Powered by MapLibre and MapTiler (fallback: Photon).</p>
      </div>
    </div>
  );
};

export default DeliveryLocationPicker;
