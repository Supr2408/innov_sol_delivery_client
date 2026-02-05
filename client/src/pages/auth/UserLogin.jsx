import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { AppContext } from "../../context/AppContext";

const UserLogin = () => {
  const navigate = useNavigate();
  const { setToken, setUser } = useContext(AppContext);

  const [mode, setMode] = useState("login"); // login | register
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const { name, email, password } = formData;

  const onChangeHandler = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "" });
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();

    try {
      if (mode === "login") {
        const { data } = await axios.post("/users/login", {
          email,
          password,
        });

        setToken(data.token);
        setUser({ ...data.user, role: "user" });
        localStorage.setItem("token", data.token);

        toast.success("Login successful");
        navigate("/user-dashboard");
      } else {
        await axios.post("/users/register", {
          name,
          email,
          password,
        });

        toast.success("Registration successful. Please login.");
        setMode("login");
        resetForm();
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
        <h2 className="text-xl sm:text-2xl font-semibold text-center mb-4 sm:mb-6 capitalize">
          {mode === "login" ? "User Login" : "User Registration"}
        </h2>

        {mode === "register" && (
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            className="w-full mb-2 sm:mb-3 p-2 sm:p-3 border rounded text-sm sm:text-base"
            value={name}
            onChange={onChangeHandler}
            required
          />
        )}

        <input
          type="email"
          name="email"
          placeholder="Email"
          className="w-full mb-2 sm:mb-3 p-2 sm:p-3 border rounded text-sm sm:text-base"
          value={email}
          onChange={onChangeHandler}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          className="w-full mb-4 sm:mb-6 p-2 sm:p-3 border rounded text-sm sm:text-base"
          value={password}
          onChange={onChangeHandler}
          required
        />

        <button className="w-full bg-red-500 text-white py-2 sm:py-3 rounded hover:bg-red-600 transition font-medium text-sm sm:text-base">
          {mode === "login" ? "Login" : "Register"}
        </button>

        {mode === "login" ? (
          <p className="mt-4 text-center text-xs sm:text-sm">
            Don't have an account?{" "}
            <span
              className="text-red-500 cursor-pointer font-semibold hover:underline"
              onClick={() => {
                setMode("register");
                resetForm();
              }}
            >
              Create an account
            </span>
          </p>
        ) : (
          <p className="mt-4 text-center text-xs sm:text-sm">
            Already have an account?{" "}
            <span
              className="text-red-500 cursor-pointer font-semibold hover:underline"
              onClick={() => {
                setMode("login");
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

export default UserLogin;
