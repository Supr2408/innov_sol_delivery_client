import { createElement } from "react";
import { ClipboardList, House, UserRound } from "lucide-react";

const NAV_ITEMS = [
  { id: "home", label: "Home", IconComponent: House },
  { id: "orders", label: "My Orders", IconComponent: ClipboardList },
  { id: "account", label: "Account", IconComponent: UserRound },
];

const UserBottomNav = ({ activeTab, onTabChange }) => (
  <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm">
    <div className="mx-auto flex max-w-3xl items-center justify-around px-4 py-2">
      {NAV_ITEMS.map(({ id, label, IconComponent }) => {
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              isActive
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            {createElement(IconComponent, { size: 18 })}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);

export default UserBottomNav;
