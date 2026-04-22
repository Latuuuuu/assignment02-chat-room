import { Link } from "react-router-dom";
import { Auth } from "../components/auth.jsx";
import { Database } from "../components/database.jsx";
import "../styles/app.scss";

function Feature() {
    return (
        <div className="app">
            <aside className="app__auth">
                <Auth />
            </aside>
            <main className="app__db">
                <Database />
            </main>
            <Link to="/" className="app__back" title="Back to intro">← Back</Link>
        </div>
    );
}

export default Feature;
