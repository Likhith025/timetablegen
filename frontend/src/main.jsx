import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./AuthContext"; // Import AuthProvider
import "react-toastify/dist/ReactToastify.css";

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <BrowserRouter basename="/">
      <App />
    </BrowserRouter>
  </AuthProvider>
);
