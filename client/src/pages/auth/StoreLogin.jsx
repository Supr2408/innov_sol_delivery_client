import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { AppContext } from "../../context/AppContext";

const StoreLogin = () => {
  const navigate = useNavigate();
  const { setToken, setUser } = useContext(AppContext);

  const [state, setState] = useState("Login");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const resetForm = () => {
    setStoreName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setAddress("");
    setCity("");
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();

    try {
      if (state === "Login") {
        const { data } = await axios.post("/stores/login", {
          email,
          password,
        });

        setToken(data.token);
        setUser({ ...data.user, role: "store" });
        localStorage.setItem("token", data.token);

        toast.success("Login successful");
        navigate("/store-dashboard");
      } else {
        await axios.post("/stores/register", {
          storeName,
          email,
          password,
          phone,
          address,
          city,
        });

        toast.success("Registration successful. Please login.");
        resetForm();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 py-8">
      <form
        onSubmit={onSubmitHandler}
        className="bg-white p-8 rounded-lg shadow-md w-96"
      >
        <h2 className="text-2xl font-semibold text-center mb-4 capitalize">
          {state === "Login" ? "Store Login" : "Store Registration"}
        </h2>

        {state !== "Login" && (
          <>
            <input
              type="text"
              placeholder="Store Name"
              className="w-full mb-3 p-2 border rounded"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
            />

            <input
              type="tel"
              placeholder="Phone Number"
              className="w-full mb-3 p-2 border rounded"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Store Address"
              className="w-full mb-3 p-2 border rounded"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="City"
              className="w-full mb-3 p-2 border rounded"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 p-2 border rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-4 p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="w-full bg-green-500 text-white py-2 rounded cursor-pointer hover:bg-green-600 transition-colors">
          {state === "Login" ? "Login" : "Create Account"}
        </button>

        {state === "Login" ? (
          <p className="mt-4 text-center text-sm">
            Don't have an account?{" "}
            <span
              className="text-green-500 cursor-pointer"
              onClick={() => {
                setState("Register");
                resetForm();
              }}
            >
              Register
            </span>
          </p>
        ) : (
          <p className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <span
              className="text-green-500 cursor-pointer"
              onClick={() => {
                setState("Login");
                resetForm();
              }}
            >
              Login
            </span>
          </p>
        )}
      </form>
    </div>
  );
};

export default StoreLogin;
