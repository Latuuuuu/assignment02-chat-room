import './styles/global.scss';
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from './context/AuthContext.jsx';

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <AuthProvider>
        <Router>
            <App />
        </Router>
    </AuthProvider>
);
