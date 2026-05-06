import { Route, Routes, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";
import Chat from "./pages/Chat.jsx";
import Entry from "./pages/Entry.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";

function App() {
    return (
        <Routes>
            <Route path="/" element={<Entry />} />
            <Route path="/login" element={<Login />} />
            <Route 
                path="/chat" 
                element={
                    <ProtectedRoute>
                        <Chat />
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/profile" 
                element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                } 
            />
            <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
    );
}

export default App;
