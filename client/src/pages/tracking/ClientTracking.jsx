import StaticMap from '../../components/StaticMap'
import useSimulatedTracking from '../../hooks/useSimulatedTracking'

const ClientTracking = () => {
  const storeLocation = {
    id: 'store',
    position: [12.9698, 77.598],
    label: 'Store pickup',
    subtitle: 'Packed and ready',
    color: 'blue',
  }
  const dropLocation = {
    id: 'drop',
    position: [12.9754, 77.605],
    label: 'Your drop location',
    subtitle: 'Drop-off',
    color: 'green',
  }

  const { distanceKm, etaMinutes, lastUpdated, position } = useSimulatedTracking({
    initialPosition: [12.9719, 77.5948],
    targetPosition: dropLocation.position,
    speedKmph: 22,
  })

  const partnerLocation = {
    id: 'partner',
    position,
    label: 'Delivery partner',
    subtitle: `${distanceKm.toFixed(2)} km away`,
    color: 'red',
  }

  return (
    <div className="px-10 py-12 space-y-8">
      <header>
        <p className="text-sm uppercase tracking-wide text-red-500 font-semibold">
          Live Order Tracking
        </p>
        <h1 className="text-3xl font-semibold mt-2">Order #INV-2048</h1>
        <p className="text-gray-600 mt-2 max-w-2xl">
          Track your delivery partner in real time and get accurate arrival updates.
          Map tiles powered by OpenStreetMap.
        </p>
      </header>

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
        <StaticMap
          center={partnerLocation.position}
          markers={[partnerLocation, storeLocation, dropLocation]}
        />

        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Delivery status</h2>
            <ul className="mt-4 space-y-3 text-sm text-gray-700">
              <li className="flex items-center justify-between">
                <span>Pickup confirmed</span>
                <span className="font-semibold text-green-600">Done</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Partner en route</span>
                <span className="font-semibold text-red-500">Live</span>
              </li>
              <li className="flex items-center justify-between">
                <span>ETA to you</span>
                <span className="font-semibold">{etaMinutes} mins</span>
              </li>
              <li className="flex items-center justify-between text-xs text-gray-500">
                <span>Last updated</span>
                <span>{lastUpdated.toLocaleTimeString()}</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Driver details</h2>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              <p>Name: Rohan S.</p>
              <p>Vehicle: Blue Honda Activa</p>
              <p>Contact: +91 9XX-XXX-1234</p>
              <p className="text-xs text-gray-500">
                Location updates refresh every 3 seconds (simulated).
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default ClientTracking
