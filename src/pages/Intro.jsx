import { Link } from "react-router-dom";
import "../styles/intro.scss";

const features = [
    {
        icon: "🌐",
        title: "Firebase Hosting",
        desc: "Deploy fast, secure static sites to a global CDN with a single command.",
    },
    {
        icon: "🔐",
        title: "Authentication",
        desc: "Sign in with email/password or Google OAuth — state persists across sessions.",
    },
    {
        icon: "🗄️",
        title: "Realtime Database",
        desc: "Browse your database as an interactive tree. Click any node to read or write.",
    },
];

function Intro() {
    return (
        <div className="intro">
            {/* Background grid */}
            <div className="intro__grid-bg" aria-hidden="true" />

            <div className="intro__content">
                {/* Logo + title */}
                <div className="intro__logo">🔥</div>
                <h1 className="intro__title">Firebase Modular Demo</h1>
                <p className="intro__desc">
                    An interactive walkthrough of three core Firebase features —<br />
                    <strong>Hosting</strong>, <strong>Authentication</strong>, and <strong>Realtime Database</strong> —
                    built with the modular SDK and React.
                </p>

                {/* Feature cards */}
                <div className="intro__features">
                    {features.map(f => (
                        <div key={f.title} className="intro__card">
                            <div className="intro__card-icon">{f.icon}</div>
                            <div className="intro__card-title">{f.title}</div>
                            <div className="intro__card-desc">{f.desc}</div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <Link to="/feature" className="intro__start">
                    Get Started <span className="intro__arrow">→</span>
                </Link>

                <p className="intro__stack">Built with React · Vite · Firebase 11</p>
            </div>
        </div>
    );
}

export default Intro;
