const Footer = () => {
  return (
    <footer className="bg-slate-900 text-gray-400 py-6">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <h3 className="text-white text-lg font-semibold mb-2">
            InnovSol Delivery
          </h3>
          <p className="text-sm">
            Fast, reliable local delivery for food, groceries and essentials.
          </p>
        </div>

        <div className="text-sm">
          <p className="mb-2 text-white">Company</p>
          <p className="hover:text-white cursor-pointer">Privacy</p>
          <p className="hover:text-white cursor-pointer">Terms</p>
          <p className="hover:text-white cursor-pointer">Support</p>
        </div>

        <div className="text-sm sm:text-right">
          <p>© {new Date().getFullYear()} InnovSol</p>
          <p className="mt-1">All rights reserved</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
