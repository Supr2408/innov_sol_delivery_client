import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

const ensureCustomPinStyles = () => {
  if (document.getElementById("codex-red-pin-style")) return;

  const style = document.createElement("style");
  style.id = "codex-red-pin-style";
  style.textContent = `
    .codex-red-pin {
      position: relative;
      width: 22px;
      height: 22px;
      background: #e23744;
      border: 2px solid #ffffff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
    }
    .codex-red-pin::after {
      content: "";
      position: absolute;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ffffff;
      top: 5px;
      left: 5px;
    }
  `;
  document.head.appendChild(style);
};

const createRedPinIcon = (L) =>
  L.divIcon({
    html: '<div class="codex-red-pin"></div>',
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });

const loadLeaflet = () =>
  new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    ensureCustomPinStyles();

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
    script.addEventListener("error", () => reject(new Error("Leaflet script failed to load")));
    document.body.appendChild(script);
  });

const buildPhotonLabel = (properties = {}) => {
  const parts = [
    properties.name,
    properties.housenumber && properties.street
      ? `${properties.housenumber} ${properties.street}`
      : properties.street,
    properties.district,
    properties.city,
    properties.state,
    properties.country,
  ].filter(Boolean);

  return parts.join(", ");
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
      const coords = feature?.geometry?.coordinates;
      const lng = Array.isArray(coords) ? Number(coords[0]) : NaN;
      const lat = Array.isArray(coords) ? Number(coords[1]) : NaN;
      const label = buildPhotonLabel(feature?.properties);

      return {
        label,
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

const DeliveryLocationPicker = ({ value, onChange, onAddressResolved }) => {
  const mapContainerRef = useRef(null);
  const searchContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  const suppressSearchRef = useRef(false);
  const onAddressResolvedRef = useRef(onAddressResolved);

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
    let mounted = true;

    const initMap = async () => {
      if (!mapContainerRef.current || mapRef.current) return;

      try {
        const L = await loadLeaflet();
        if (!mounted || !mapContainerRef.current) return;

        const startPosition =
          value && Number.isFinite(value.lat) && Number.isFinite(value.lng)
            ? [value.lat, value.lng]
            : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];

        const map = L.map(mapContainerRef.current).setView(startPosition, 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        markerRef.current = L.marker(startPosition, {
          icon: createRedPinIcon(L),
          draggable: true,
        }).addTo(map);

        markerRef.current.on("dragend", () => {
          const position = markerRef.current.getLatLng();
          onChange({
            lat: Number(position.lat.toFixed(6)),
            lng: Number(position.lng.toFixed(6)),
          });
        });

        map.on("click", (event) => {
          const lat = Number(event.latlng.lat.toFixed(6));
          const lng = Number(event.latlng.lng.toFixed(6));
          onChange({ lat, lng });
        });

        mapRef.current = map;
        setMapReady(true);
      } catch (error) {
        if (!mounted) return;
        setMapReady(false);
        setMapError(error.message || "Unable to load map");
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
    };
  }, [onChange, value]);

  useEffect(() => {
    if (!mapRef.current || !value) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
    }

    mapRef.current.setView([value.lat, value.lng], 15);
  }, [value]);

  useEffect(() => {
    if (!value || !onAddressResolvedRef.current) return;

    let cancelled = false;

    const resolveAddress = async () => {
      try {
        setResolvingAddress(true);
        const address = await reversePhoton(value.lat, value.lng);
        if (!cancelled && address) {
          suppressSearchRef.current = true;
          setSearchQuery(address);
          onAddressResolvedRef.current(address);
        }
      } catch {
        // Reverse lookup is optional.
      } finally {
        if (!cancelled) setResolvingAddress(false);
      }
    };

    resolveAddress();

    return () => {
      cancelled = true;
    };
  }, [value]);

  const triggerSearch = async (queryText, requestId) => {
    try {
      setSearchingLocations(true);
      const results = await searchPhoton(queryText);
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
    const nextValue = event.target.value;
    setSearchQuery(nextValue);

    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const trimmedQuery = nextValue.trim();
    if (trimmedQuery.length < 3) {
      searchRequestIdRef.current += 1;
      setLocationResults([]);
      setShowResults(false);
      setSearchingLocations(false);
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    searchTimeoutRef.current = setTimeout(() => {
      triggerSearch(trimmedQuery, requestId);
    }, 300);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        onChange({ lat, lng });
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSelectLocation = (location) => {
    onChange({ lat: location.lat, lng: location.lng });
    suppressSearchRef.current = true;
    setSearchQuery(location.label);
    setShowResults(false);
    if (onAddressResolvedRef.current) {
      onAddressResolvedRef.current(location.label);
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
        <p className="text-gray-500">Powered by OpenStreetMap and Photon (free tier, fair use).</p>
      </div>
    </div>
  );
};

export default DeliveryLocationPicker;
