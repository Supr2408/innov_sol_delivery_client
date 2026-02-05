import { Link } from 'react-router-dom'

const PartnerDashboard = () => {
  return (
    <div className="px-10 py-12 space-y-8">
      <header>
        <p className="text-sm uppercase tracking-wide text-red-500 font-semibold">
          Partner Console
        </p>
        <h1 className="text-3xl font-semibold mt-2">Welcome back, Rohan</h1>
        <p className="text-gray-600 mt-2 max-w-2xl">
          Review assigned deliveries, check earnings, and navigate to drop
          locations.
        </p>
      </header>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">Assigned Orders</h2>
          <p className="text-sm text-gray-600">See your active pickup tasks.</p>
          <button className="text-sm font-semibold text-red-500">Open list →</button>
        </div>
        <div className="rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">Delivery History</h2>
          <p className="text-sm text-gray-600">Review completed deliveries.</p>
          <button className="text-sm font-semibold text-red-500">View history →</button>
        </div>
        <div className="rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">Support</h2>
          <p className="text-sm text-gray-600">Quick contacts and safety tools.</p>
          <button className="text-sm font-semibold text-red-500">Get help →</button>
        </div>
        <div className="rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">Track</h2>
          <p className="text-sm text-gray-600">
            Open the drop-off map and navigation view.
          </p>
          <Link className="text-sm font-semibold text-red-500" to="/partner-tracking">
            Open map →
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Active delivery</h2>
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-900">Order #INV-2048</p>
            <p>Pickup: Fresh Mart, MG Road</p>
            <p>Drop: Residency Road, Bengaluru</p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-red-500 px-4 py-2 text-white font-semibold"
            to="/partner-tracking"
          >
            Start navigation
          </Link>
        </div>
      </div>
    </div>
  )
}

export default PartnerDashboard
