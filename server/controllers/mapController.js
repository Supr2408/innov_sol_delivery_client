const OSRM_BASE_URL = "https://router.project-osrm.org";
const MAPTILER_DIRECTIONS_BASE_URL = "https://api.maptiler.com/directions/v2/driving";

const getMaptilerApiKey = () =>
  process.env.MAPTILER_API_KEY || process.env.VITE_MAPTILER_API_KEY || "";

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

const toCoordinate = (lng, lat) => [Number(lng), Number(lat)];

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

const fetchJson = async (url, timeoutMs = 9000) => {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: abortController.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchNearestRoadPointFromOsrm = async (coordinate) => {
  const [lng, lat] = coordinate;
  const data = await fetchJson(`${OSRM_BASE_URL}/nearest/v1/driving/${lng},${lat}?number=1`);
  const nearest = data?.waypoints?.[0]?.location;

  if (!Array.isArray(nearest) || nearest.length < 2) {
    throw new Error("OSRM nearest location unavailable");
  }

  return toCoordinate(nearest[0], nearest[1]);
};

const snapRouteEndpoints = async (startCoordinate, endCoordinate) => {
  const [snappedStartCoordinate, snappedEndCoordinate] = await Promise.all([
    fetchNearestRoadPointFromOsrm(startCoordinate).catch(() => startCoordinate),
    fetchNearestRoadPointFromOsrm(endCoordinate).catch(() => endCoordinate),
  ]);

  const snapped =
    calculateDistanceMeters(startCoordinate, snappedStartCoordinate) > 1 ||
    calculateDistanceMeters(endCoordinate, snappedEndCoordinate) > 1;

  return {
    snappedStartCoordinate,
    snappedEndCoordinate,
    snapped,
  };
};

const fetchRouteFromOsrm = async (startCoordinate, endCoordinate) => {
  const [startLng, startLat] = startCoordinate;
  const [endLng, endLat] = endCoordinate;
  const data = await fetchJson(
    `${OSRM_BASE_URL}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`,
  );
  const coordinates = data?.routes?.[0]?.geometry?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error("OSRM route coordinates unavailable");
  }

  return coordinates.map((point) => toCoordinate(point[0], point[1]));
};

const fetchRouteFromMapTiler = async (startCoordinate, endCoordinate) => {
  const maptilerApiKey = getMaptilerApiKey();
  if (!maptilerApiKey) {
    throw new Error("MapTiler API key missing");
  }

  const [startLng, startLat] = startCoordinate;
  const [endLng, endLat] = endCoordinate;
  const query = new URLSearchParams({
    key: maptilerApiKey,
    geometry: "geojson",
  });

  const data = await fetchJson(
    `${MAPTILER_DIRECTIONS_BASE_URL}/${startLng},${startLat};${endLng},${endLat}?${query.toString()}`,
  );
  const coordinates = data?.routes?.[0]?.geometry?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error("MapTiler route coordinates unavailable");
  }

  return coordinates.map((point) => toCoordinate(point[0], point[1]));
};

export const getRoutePath = async (req, res) => {
  try {
    const startLat = Number(req.query.startLat);
    const startLng = Number(req.query.startLng);
    const endLat = Number(req.query.endLat);
    const endLng = Number(req.query.endLng);

    if (
      !isFiniteCoordinate(startLat) ||
      !isFiniteCoordinate(startLng) ||
      !isFiniteCoordinate(endLat) ||
      !isFiniteCoordinate(endLng)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid route coordinates",
      });
    }

    const startCoordinate = toCoordinate(startLng, startLat);
    const endCoordinate = toCoordinate(endLng, endLat);
    const { snappedStartCoordinate, snappedEndCoordinate, snapped } = await snapRouteEndpoints(
      startCoordinate,
      endCoordinate,
    );

    try {
      const coordinates = await fetchRouteFromOsrm(snappedStartCoordinate, snappedEndCoordinate);
      return res.status(200).json({
        success: true,
        provider: "osrm",
        snapped,
        coordinates,
      });
    } catch {
      const coordinates = await fetchRouteFromMapTiler(snappedStartCoordinate, snappedEndCoordinate);
      return res.status(200).json({
        success: true,
        provider: "maptiler",
        snapped,
        coordinates,
      });
    }
  } catch {
    return res.status(502).json({
      success: false,
      message: "Unable to compute route",
    });
  }
};
