import StaticMap from '../../components/StaticMap'
import useSimulatedTracking from '../../hooks/useSimulatedTracking'

const PartnerTracking = () => {
  const pickupLocation = {
    id: 'pickup',
    position: [12.9698, 77.598],
    label: 'Pickup store',
    subtitle: 'Order collected',
    color: 'blue',
  }
  const dropLocation = {
    id: 'drop',
    position: [12.9754, 77.605],
    label: 'Customer drop-off',
    subtitle: 'Navigate to destination',
    color: 'green',
  }

  const { distanceKm, etaMinutes, lastUpdated, position } = useSimulatedTracking({
    initialPosition: [12.9719, 77.5948],
    targetPosition: dropLocation.position,
    speedKmph: 25,
  })

  const partnerLocation = {
    id: 'partner',
    position,
    label: 'Your live location',
    subtitle: 'Sharing with customer',
    color: 'red',
  }

  return (
    <div className="px-10 py-12 space-y-8">
      <header>
        <p className="text-sm uppercase tracking-wide text-red-500 font-semibold">
          Partner Live Map
        </p>
        <h1 className="text-3xl font-semibold mt-2">Delivery #INV-2048</h1>
        <p className="text-gray-600 mt-2 max-w-2xl">
          View the pickup and customer drop location on a free OpenStreetMap
          tile layer while sharing your live coordinates.
        </p>
      </header>

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
        <StaticMap
          center={partnerLocation.position}
          markers={[partnerLocation, pickupLocation, dropLocation]}
        />

        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Route summary</h2>
            <ul className="mt-4 space-y-3 text-sm text-gray-700">
              <li className="flex items-center justify-between">
                <span>Pickup</span>
                <span className="font-semibold text-green-600">Completed</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Drop-off ETA</span>
                <span className="font-semibold">{etaMinutes} mins</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Distance remaining</span>
                <span className="font-semibold">{distanceKm.toFixed(2)} km</span>
              </li>
              <li className="flex items-center justify-between text-xs text-gray-500">
                <span>Last updated</span>
                <span>{lastUpdated.toLocaleTimeString()}</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Customer details</h2>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              <p>Name: Priya K.</p>
              <p>Drop location: MG Road, Bengaluru</p>
              <p>Contact: +91 9XX-XXX-5678</p>
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

export default PartnerTracking
