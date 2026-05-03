import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Chat from "../pages/Chat";
import ProtectedRoute from "../components/ProtectedRoutes";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/*Public routes */}
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        {/* Protected route */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

        {/* Default route - redirect to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
