const buildMarkerParam = (markers) => {
  if (!markers.length) {
    return ''
  }

  return markers
    .map((marker) => `${marker.position[0]},${marker.position[1]},${marker.color}`)
    .join('|')
}

const StaticMap = ({ center, zoom = 13, markers = [] }) => {
  const markerParam = buildMarkerParam(markers)
  const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${center[0]},${center[1]}&zoom=${zoom}&size=900x420&maptype=mapnik${
    markerParam ? `&markers=${encodeURIComponent(markerParam)}` : ''
  }`

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl shadow">
        <img
          className="h-[420px] w-full object-cover"
          src={mapUrl}
          alt="Delivery tracking map"
          loading="lazy"
        />
      </div>
      <p className="text-xs text-gray-500">
        Map tiles and markers powered by OpenStreetMap contributors.
      </p>
    </div>
  )
}

export default StaticMap
