import { useNavigate } from "react-router-dom";
import heroVideo from "../../assets/video/hero.mp4";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-white">
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
        <div className="absolute inset-0 bg-black/60"></div>

        {/* CONTENT */}
        <div className="relative z-10 px-6 lg:px-10 max-w-6xl mx-auto text-white w-full">
          <div className="flex gap-2 mb-8 items-center">
            <span className="inline-block px-4 py-2 bg-white/10 border border-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
              ✓ Hardware & Industrial Solutions
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-tight max-w-4xl">
            Fast B2B Hardware <br />
            <span className="text-[#E23744]">Delivery for Local Industries</span>
          </h1>

          <p className="text-lg sm:text-xl max-w-2xl mb-4 opacity-90 leading-relaxed">
            Connect with local hardware suppliers. Get tools, materials, and equipment delivered to your business quickly and reliably.
          </p>

          <p className="text-sm max-w-2xl mb-8 opacity-80">
            Trusted Hardware Suppliers • Same-Day Delivery • Bulk Orders • Quality Assured
          </p>

          <div className="flex gap-4 flex-wrap">
            <button
              onClick={() => navigate("/user-login")}
              className="bg-[#E23744] hover:bg-red-600 text-white px-8 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105 shadow-lg"
            >
              Order Hardware
            </button>
            <button
              onClick={() => navigate("/partner-login")}
              className="border-2 border-white hover:bg-white hover:text-black px-8 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105 text-white"
            >
              Become a Delivery Agent
            </button>
          </div>
        </div>
      </section>

      {/* ================= KEY FEATURES ================= */}
      <section className="bg-white px-4 sm:px-6 lg:px-10 py-16 lg:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Why Choose InnovSol Hardware?
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Optimized for local industrial B2B needs with reliable suppliers and fast delivery
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: "🚚",
                title: "Same-Day Delivery",
                description: "Get hardware and tools delivered within hours to your premises"
              },
              {
                icon: "📦",
                title: "Bulk Orders Ready",
                description: "Handle large orders with inventory management and easy reordering"
              },
              {
                icon: "✅",
                title: "Verified Suppliers",
                description: "Only trusted local hardware stores with quality guarantee"
              },
              {
                icon: "💼",
                title: "Business Accounts",
                description: "Flexible payment terms and credit options for registered industries"
              },
              {
                icon: "📱",
                title: "Easy Ordering",
                description: "Simple interface to browse, quote, and order hardware supplies"
              },
              {
                icon: "🔧",
                title: "Product Variety",
                description: "Wide range from tools, fasteners to construction and industrial supplies"
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition border border-gray-100"
              >
                <div className="w-16 h-16 flex items-center justify-center bg-red-100 text-red-500 rounded-full mb-6 text-4xl">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-3 text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="bg-gray-900 text-white px-4 sm:px-6 lg:px-10 py-16 lg:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Simple Ordering Process
            </h2>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Order hardware for your business in just 4 easy steps
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {[
              {
                step: "1",
                title: "Browse Suppliers",
                description: "View local hardware stores with pricing"
              },
              {
                step: "2",
                title: "Add to Cart",
                description: "Select needed materials and tools"
              },
              {
                step: "3",
                title: "Checkout",
                description: "Secure payment and confirm order"
              },
              {
                step: "4",
                title: "Track Delivery",
                description: "Real-time tracking to your location"
              }
            ].map((item, idx) => (
              <div key={idx} className="relative">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 flex items-center justify-center bg-[#E23744] rounded-full text-2xl font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold text-center mb-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-400 text-center text-sm">
                    {item.description}
                  </p>
                </div>
                {idx < 3 && (
                  <div className="hidden lg:block absolute top-10 left-[60%] w-[40%] h-1 bg-gradient-to-r from-[#E23744] to-gray-900"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= PLATFORM INFO ================= */}
      <section className="bg-white px-4 sm:px-6 lg:px-10 py-16 lg:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Local Hardware Delivery Platform
              </h2>
              <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                InnovSol connects local industries and businesses with nearby hardware suppliers. We ensure timely delivery of quality materials, tools, and equipment at competitive prices.
              </p>
              <ul className="space-y-4">
                {[
                  "Same-day or scheduled delivery",
                  "Access to local hardware suppliers",
                  "Competitive B2B pricing",
                  "Bulk order management",
                  "Secure payment and invoicing",
                  "Real-time order tracking"
                ].map((item, idx) => (
                  <li key={idx} className="flex gap-3 items-start">
                    <span className="text-[#E23744] font-bold mt-1">✓</span>
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Content */}
            <div className="bg-gradient-to-br from-gray-50 to-white p-10 rounded-2xl shadow-xl border border-gray-100">
              <h3 className="text-2xl font-bold text-gray-900 mb-8">
                Join as
              </h3>
              
              <div className="space-y-6">
                {[
                  {
                    role: "Industry Buyer",
                    action: "Order hardware and materials",
                    link: "/user-login"
                  },
                  {
                    role: "Delivery Agent",
                    action: "Deliver orders to businesses",
                    link: "/partner-login"
                  },
                  {
                    role: "Hardware Supplier",
                    action: "Manage store and orders",
                    link: "/store-login"
                  }
                  // Admin registration commented out
                  // {
                  //   role: "Administrator",
                  //   action: "Manage platform & operations",
                  //   link: "/admin-login"
                  // }
                ].map((user, idx) => (
                  <div key={idx} className="p-4 bg-white rounded-xl border border-gray-200 hover:border-[#E23744] transition">
                    <h4 className="font-bold text-gray-900 mb-1">
                      {user.role}
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      {user.action}
                    </p>
                    <button
                      onClick={() => navigate(user.link)}
                      className="text-[#E23744] font-semibold hover:text-red-600 text-sm flex items-center gap-2"
                    >
                      Go to Login →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SUPPLIER CATEGORIES ================= */}
      <section className="bg-gray-50 px-4 sm:px-6 lg:px-10 py-16 lg:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Hardware Categories Available
            </h2>
            <p className="text-gray-600 text-lg">Local suppliers offering various hardware products</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              "Hand Tools",
              "Power Tools",
              "Fasteners & Hardware",
              "Safety Equipment",
              "Building Materials",
              "Electrical Supplies",
              "Plumbing Supplies",
              "Industrial Equipment"
            ].map((category, idx) => (
              <div
                key={idx}
                className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition border border-gray-200 hover:border-[#E23744] text-center"
              >
                <h4 className="font-bold text-gray-900 text-lg">{category}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="bg-gradient-to-r from-[#E23744] to-red-600 text-white px-4 sm:px-6 lg:px-10 py-16 lg:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Get Your Hardware Delivered Today
          </h2>
          <p className="text-lg sm:text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Connect with local hardware suppliers and get the materials you need fast
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <button
              onClick={() => navigate("/user-login")}
              className="bg-white text-[#E23744] px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition transform hover:scale-105"
            >
              Order Now
            </button>
            <button
              onClick={() => navigate("/partner-login")}
              className="border-2 border-white text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-white/10 transition transform hover:scale-105"
            >
              Become Delivery Agent
            </button>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="bg-gray-900 text-gray-300 px-4 sm:px-6 lg:px-10 py-12 lg:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="font-bold text-white mb-4">InnovSol</h4>
              <p className="text-sm opacity-75">
                B2B hardware delivery platform connecting local industries with trusted suppliers.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Quick Links</h4>
              <ul className="text-sm space-y-2 opacity-75">
                <li>
                  <button onClick={() => navigate("/")} className="hover:text-[#E23744] transition">
                    Home
                  </button>
                </li>
                <li>
                  <a href="#about" className="hover:text-[#E23744] transition">
                    About
                  </a>
                </li>
                <li>
                  <a href="#contact" className="hover:text-[#E23744] transition">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Login links</h4>
              <ul className="text-sm space-y-2 opacity-75">
                <li>
                  <button onClick={() => navigate("/user-login")} className="hover:text-[#E23744] transition">
                    Buyer Login
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate("/partner-login")} className="hover:text-[#E23744] transition">
                    Delivery Login
                  </button>
                </li>
                <li>
                  <button onClick={() => navigate("/store-login")} className="hover:text-[#E23744] transition">
                    Supplier Login
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="text-sm space-y-2 opacity-75">
                <li>
                  <a href="#privacy" className="hover:text-[#E23744] transition">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#terms" className="hover:text-[#E23744] transition">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#help" className="hover:text-[#E23744] transition">
                    Help Center
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm opacity-75">
            <p>&copy; 2026 InnovSol. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-[#E23744] transition">
                Twitter
              </a>
              <a href="#" className="hover:text-[#E23744] transition">
                Facebook
              </a>
              <a href="#" className="hover:text-[#E23744] transition">
                Instagram
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
