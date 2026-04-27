import { Auth } from "../components/auth.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { Navigate } from "react-router-dom";

function Login() {
    const { user, loading } = useAuth();
    
    if (loading) return null;
    if (user) {
        return <Navigate to="/chat" replace />;
    }

    return (
        <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Auth />
        </div>
    );
}

export default Login;