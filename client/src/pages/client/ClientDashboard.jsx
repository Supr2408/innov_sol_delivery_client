import { Link } from 'react-router-dom'

const ClientDashboard = () => {
  return (
    <div className="px-10 py-12 space-y-8">
      <header>
        <p className="text-sm uppercase tracking-wide text-red-500 font-semibold">
          Client Console
        </p>
        <h1 className="text-3xl font-semibold mt-2">Welcome back, Ayesha</h1>
        <p className="text-gray-600 mt-2 max-w-2xl">
          Manage your orders, browse history, and track live deliveries from one
          dashboard.
        </p>
      </header>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">Orders</h2>
          <p className="text-sm text-gray-600">View your active and upcoming orders.</p>
          <button className="text-sm font-semibold text-red-500">View orders →</button>
        </div>
        <div className="rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">History</h2>
          <p className="text-sm text-gray-600">Reorder from previous deliveries.</p>
          <button className="text-sm font-semibold text-red-500">Open history →</button>
        </div>
        <div className="rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">Search</h2>
          <p className="text-sm text-gray-600">Find nearby stores and items quickly.</p>
          <button className="text-sm font-semibold text-red-500">Search now →</button>
        </div>
        <div className="rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold">Track</h2>
          <p className="text-sm text-gray-600">See your partner live on the map.</p>
          <Link className="text-sm font-semibold text-red-500" to="/track-order">
            Track order →
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Live order snapshot</h2>
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-900">Order #INV-2048</p>
            <p>Pickup: Fresh Mart, MG Road</p>
            <p>Status: Partner en route</p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-red-500 px-4 py-2 text-white font-semibold"
            to="/track-order"
          >
            View live tracking
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ClientDashboard
