import heroVideo from "../../assets/video/hero.mp4";

const Home = () => {
  return (
    <div className="bg-black">
      {/* ================= HERO (FULL SCREEN VIDEO) ================= */}
      <section className="relative min-h-screen overflow-hidden flex items-center">
        {/* VIDEO */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={heroVideo} type="video/mp4" />
        </video>

        {/* OVERLAY */}
        <div className="absolute inset-0 bg-black/50"></div>

        {/* CONTENT */}
        <div className="relative z-10 px-6 lg:px-10 max-w-6xl mx-auto text-white">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            India’s trusted <br />
            <span className="text-[#E23744]">local delivery platform</span>
          </h1>

          <p className="text-lg max-w-2xl mb-8 opacity-90">
            Order from nearby stores and get groceries, food, and essentials
            delivered at lightning speed.
          </p>

          <div className="flex gap-4 flex-wrap">
            <button className="bg-[#E23744] hover:bg-red-600 px-6 py-3 rounded-md font-semibold transition">
              Order Now
            </button>
            <button className="border border-white/70 hover:bg-white hover:text-black px-6 py-3 rounded-md font-semibold transition">
              Become a Partner
            </button>
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section className="bg-gray-50 px-4 sm:px-6 lg:px-10 py-16 lg:py-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-center mb-12 text-gray-900">
            Why Choose InnovSol?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* CARD 1 */}
            <div className="bg-white p-6 lg:p-8 rounded-xl shadow hover:shadow-lg transition">
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
            <div className="bg-white p-6 lg:p-8 rounded-xl shadow hover:shadow-lg transition">
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
            <div className="bg-white p-6 lg:p-8 rounded-xl shadow hover:shadow-lg transition">
              <div className="w-14 h-14 flex items-center justify-center bg-green-100 text-green-500 rounded-full mb-4 text-2xl">
                🛵
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Fast Delivery Partners
              </h3>
              <p className="text-gray-600 text-sm">
                Verified partners ensure safe and speedy delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="bg-white px-4 sm:px-6 lg:px-10 py-14 lg:py-16">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 text-center sm:text-left">
            Ready to experience lightning-fast delivery?
          </h3>

          <button className="bg-[#E23744] text-white px-6 py-3 rounded-md font-semibold hover:bg-red-600 transition whitespace-nowrap">
            Get Started
          </button>
        </div>
      </section>
    </div>
  );
};

export default Home;
