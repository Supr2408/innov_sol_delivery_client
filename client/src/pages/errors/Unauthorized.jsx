import { useNavigate } from "react-router-dom";

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold text-red-500 mb-4">
        Unauthorized Access
      </h1>
      <p className="text-gray-600 mb-6">
        You don’t have permission to view this page.
      </p>
      <button
        onClick={() => navigate(-1)}
        className="bg-red-500 text-white px-6 py-2 rounded cursor-pointer hover:bg-red-600"
      >
        Go Back
      </button>
    </div>
  );
};

export default Unauthorized;
