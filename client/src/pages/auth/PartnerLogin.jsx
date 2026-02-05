import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { AppContext } from "../../context/AppContext";

const PartnerLogin = () => {
  const navigate = useNavigate();
  const { setToken, setUser } = useContext(AppContext);

  const [state, setState] = useState("Login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("bike");

  const onSubmitHandler = async (e) => {
    e.preventDefault();

    try {
      if (state === "Login") {
        const { data } = await axios.post("/partners/login", {
          email,
          password,
        });

        setToken(data.token);
        setUser(data.user);
        localStorage.setItem("token", data.token);

        toast.success("Login successful");
        navigate("/partner-dashboard");
      } else {
        await axios.post("/partners/register", {
          name,
          email,
          password,
          phone,
          vehicle,
        });

        toast.success("Registration successful. Please login.");
        setState("Login");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 px-4 py-8">
      <form
        onSubmit={onSubmitHandler}
        className="bg-white p-6 sm:p-8 rounded-lg shadow-md w-full max-w-sm"
      >
        <h2 className="text-xl sm:text-2xl font-semibold text-center mb-4 sm:mb-6">
          {state === "Login" ? "Partner Login" : "Partner Registration"}
        </h2>

        {state !== "Login" && (
          <>
            <input
              type="text"
              placeholder="Full Name"
              className="w-full mb-2 sm:mb-3 p-2 sm:p-3 border rounded text-sm sm:text-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <input
              type="tel"
              placeholder="Phone Number"
              className="w-full mb-2 sm:mb-3 p-2 sm:p-3 border rounded text-sm sm:text-base"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <select
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              className="w-full mb-2 sm:mb-3 p-2 sm:p-3 border rounded text-sm sm:text-base"
              required
            >
              <option value="bike">Bike</option>
              <option value="car">Car</option>
              <option value="van">Van</option>
            </select>
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-2 sm:mb-3 p-2 sm:p-3 border rounded text-sm sm:text-base"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-4 sm:mb-6 p-2 sm:p-3 border rounded text-sm sm:text-base"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="w-full bg-blue-500 text-white py-2 sm:py-3 rounded cursor-pointer hover:bg-blue-600 transition-colors font-medium text-sm sm:text-base">
          {state === "Login" ? "Login" : "Create Account"}
        </button>

        {state === "Login" ? (
          <p className="mt-4 text-center text-xs sm:text-sm">
            Don't have an account?{" "}
            <span
              className="text-blue-500 cursor-pointer font-semibold hover:underline"
              onClick={() => setState("Register")}
            >
              Register
            </span>
          </p>
        ) : (
          <p className="mt-4 text-center text-xs sm:text-sm">
            Already have an account?{" "}
            <span
              className="text-blue-500 cursor-pointer font-semibold hover:underline"
              onClick={() => setState("Login")}
            >
              Login
            </span>
          </p>
        )}
      </form>
    </div>
  );
};

export default PartnerLogin;
