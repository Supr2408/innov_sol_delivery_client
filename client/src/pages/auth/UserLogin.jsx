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
        resetForm(); // 🔥 IMPORTANT FIX
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <form
        onSubmit={onSubmitHandler}
        className="bg-white p-8 rounded-lg shadow-md w-96"
      >
        <h2 className="text-2xl font-semibold text-center mb-4 capitalize">
          {mode === "login" ? "User Login" : "User Registration"}
        </h2>

        {mode === "register" && (
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            className="w-full mb-3 p-2 border rounded"
            value={name}
            onChange={onChangeHandler}
            required
          />
        )}

        <input
          type="email"
          name="email"
          placeholder="Email"
          className="w-full mb-3 p-2 border rounded"
          value={email}
          onChange={onChangeHandler}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          className="w-full mb-4 p-2 border rounded"
          value={password}
          onChange={onChangeHandler}
          required
        />

        <button className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600">
          {mode === "login" ? "Login" : "Register"}
        </button>

        {mode === "login" ? (
          <p className="mt-4 text-center text-sm">
            New user?{" "}
            <span
              className="text-red-500 cursor-pointer"
              onClick={() => {
                setMode("register");
                resetForm();
              }}
            >
              Create an account
            </span>
          </p>
        ) : (
          <p className="mt-4 text-center text-sm">
            Already registered?{" "}
            <span
              className="text-red-500 cursor-pointer"
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
