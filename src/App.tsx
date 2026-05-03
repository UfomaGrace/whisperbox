import AppRouter from "./route/AppRouter";
import { AuthProvider } from "./store/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <AppRouter/>
    </AuthProvider>
  )
}
