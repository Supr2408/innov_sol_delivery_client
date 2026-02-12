import { useContext, useEffect, useMemo, useState } from "react";
import { AppContext } from "../context/appContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import DeliveryLocationPicker from "./DeliveryLocationPicker";
import { MapPin, X } from "lucide-react";

const StoreNavbar = () => {
  const { user, setUser, logout } = useContext(AppContext);
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationDraft, setLocationDraft] = useState(null);
  const [addressDraft, setAddressDraft] = useState("");
  const [cityDraft, setCityDraft] = useState("");

  const firstLetter = user?.storeName?.charAt(0).toUpperCase();
  const storeId = user?.id || user?._id;
  const hasValidLocation = useMemo(
    () =>
      Number.isFinite(Number(locationDraft?.lat)) &&
      Number.isFinite(Number(locationDraft?.lng)),
    [locationDraft],
  );

  useEffect(() => {
    setLocationDraft(
      user?.location &&
        Number.isFinite(Number(user.location.lat)) &&
        Number.isFinite(Number(user.location.lng))
        ? {
            lat: Number(user.location.lat),
            lng: Number(user.location.lng),
          }
        : null,
    );
    setAddressDraft(user?.address || "");
    setCityDraft(user?.city || "");
  }, [user?.address, user?.city, user?.location]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSaveLocation = async () => {
    if (!storeId) return;

    if (!hasValidLocation) {
      toast.error("Please select a valid location on the map");
      return;
    }

    try {
      setSavingLocation(true);
      const { data } = await axios.put(`/stores/${storeId}/location`, {
        location: {
          lat: Number(locationDraft.lat),
          lng: Number(locationDraft.lng),
        },
        address: addressDraft.trim(),
        city: cityDraft.trim(),
      });

      if (data?.store) {
        setUser((previousUser) => ({
          ...previousUser,
          ...data.store,
          role: "store",
        }));
      }

      setShowLocationModal(false);
      setShowProfile(false);
      toast.success("Store location updated");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update location");
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <>
    <nav className="bg-white shadow-md px-8 py-4 flex justify-between items-center">
      <h1
        className="text-xl font-semibold text-red-500 cursor-pointer"
        onClick={() => navigate("/store-dashboard")}
      >
        InnovSol Delivery
      </h1>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfile((previousState) => !previousState)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500 text-white font-semibold cursor-pointer"
          >
            {firstLetter}
          </button>

          {showProfile && (
            <div className="absolute top-12 right-0 bg-white shadow-md rounded px-4 py-3 text-sm min-w-52 z-40">
              <p className="font-medium">{user?.storeName}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{user?.address || "No address set"}</p>
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 text-xs bg-red-50 text-red-600 px-3 py-2 rounded hover:bg-red-100"
              >
                <MapPin size={14} />
                Update Location
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="text-sm bg-gray-100 px-3 py-1 rounded cursor-pointer hover:bg-gray-200"
        >
          Logout
        </button>
      </div>
    </nav>

    {showLocationModal && (
      <div className="fixed inset-0 z-[60] flex items-end bg-black/45 p-4 sm:items-center sm:justify-center">
        <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl sm:p-5 max-h-[92vh] overflow-y-auto">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-600">Store Settings</p>
              <h3 className="text-base font-semibold text-gray-900">Update Store Location</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowLocationModal(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3">
            <DeliveryLocationPicker
              value={locationDraft}
              onChange={setLocationDraft}
              onAddressResolved={(resolvedAddress) => {
                if (!resolvedAddress) return;
                setAddressDraft((previousAddress) => previousAddress || resolvedAddress);
              }}
            />

            <input
              type="text"
              value={addressDraft}
              onChange={(event) => setAddressDraft(event.target.value)}
              placeholder="Store address"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400"
            />
            <input
              type="text"
              value={cityDraft}
              onChange={(event) => setCityDraft(event.target.value)}
              placeholder="City"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400"
            />

            <button
              type="button"
              onClick={handleSaveLocation}
              disabled={savingLocation}
              className="w-full inline-flex h-11 items-center justify-center rounded-lg bg-red-500 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingLocation ? "Saving..." : "Save Location"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default StoreNavbar;
