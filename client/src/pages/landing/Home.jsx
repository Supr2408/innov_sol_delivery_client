import React from "react";

const Home = () => {
  return (
    <div className="bg-gray-50">
      {/* HERO SECTION */}
      <section className="px-10 py-20 bg-gradient-to-r from-red-500 to-orange-400 text-white">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Fast Local Delivery <span className="inline-block">🚀</span>
          </h1>

          <p className="text-lg max-w-2xl mb-8 opacity-90">
            Order from nearby local stores and get lightning-fast delivery
            by trusted partners — anytime, anywhere.
          </p>

          <div className="flex gap-4">
            <button className="bg-white text-red-500 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition">
              Order Now
            </button>
            <button className="border border-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-red-500 transition">
              Become a Partner
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="px-10 py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-12">
            Why Choose InnovSol?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* CARD 1 */}
            <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
              <div className="w-14 h-14 flex items-center justify-center bg-red-100 text-red-500 rounded-full mb-4 text-2xl">
                🛒
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Browse Local Stores
              </h3>
              <p className="text-gray-600 text-sm">
                Discover nearby shops and order everything you need in minutes.
              </p>
            </div>

            {/* CARD 2 */}
            <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
              <div className="w-14 h-14 flex items-center justify-center bg-orange-100 text-orange-500 rounded-full mb-4 text-2xl">
                📦
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Real-Time Tracking
              </h3>
              <p className="text-gray-600 text-sm">
                Track your order live from store pickup to doorstep.
              </p>
            </div>

            {/* CARD 3 */}
            <div className="bg-white p-8 rounded-xl shadow hover:shadow-lg transition">
              <div className="w-14 h-14 flex items-center justify-center bg-green-100 text-green-500 rounded-full mb-4 text-2xl">
                🛵
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Fast Delivery Partners
              </h3>
              <p className="text-gray-600 text-sm">
                Verified delivery partners ensure safe and speedy delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="px-10 py-16 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <h3 className="text-2xl font-semibold">
            Ready to experience lightning-fast delivery?
          </h3>

          <button className="bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition">
            Get Started
          </button>
        </div>
      </section>
    </div>
  );
};

export default Home;
