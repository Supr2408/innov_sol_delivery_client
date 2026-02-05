import React from 'react'

const Home = () => {
  return (
    <div className="px-10 py-16">
      <h2 className="text-4xl font-semibold mb-4">
        Fast Local Delivery 🚀
      </h2>

      <p className="text-gray-600 max-w-xl">
        Order from nearby local stores and get it delivered by trusted
        delivery partners in real time.
      </p>

      <div className="mt-10 grid grid-cols-3 gap-6">
        <div className="p-6 shadow rounded">
          🛒 Browse Local Stores
        </div>
        <div className="p-6 shadow rounded">
          📦 Real‑Time Order Tracking
        </div>
        <div className="p-6 shadow rounded">
          🛵 Fast Delivery Partners
        </div>
      </div>
    </div>
  );
};

export default Home;
