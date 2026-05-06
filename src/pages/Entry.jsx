import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { GalleryIcon } from "../components/GalleryIcons.jsx";
import "../styles/entry.scss";

const paintings = [
    { title: "Mona Lisa", artist: "Leonardo", type: "portrait", tone: "olive", x: 10, y: 18 },
    { title: "Primavera", artist: "Botticelli", type: "garden", tone: "sage", x: 38, y: 10 },
    { title: "The Birth of Venus", artist: "Botticelli", type: "venus", tone: "shell", x: 67, y: 20 },
    { title: "The School of Athens", artist: "Raphael", type: "arches", tone: "stone", x: 19, y: 58 },
    { title: "The Last Supper", artist: "Leonardo", type: "supper", tone: "umber", x: 51, y: 54 },
    { title: "Sistine Study", artist: "Michelangelo", type: "sky", tone: "fresco", x: 78, y: 59 }
];

function PaintingScene({ type }) {
    return (
        <div className={`entry-painting__scene entry-painting__scene--${type}`}>
            <span className="scene__sun" />
            <span className="scene__arch scene__arch--a" />
            <span className="scene__arch scene__arch--b" />
            <span className="scene__figure scene__figure--a" />
            <span className="scene__figure scene__figure--b" />
            <span className="scene__figure scene__figure--c" />
            <span className="scene__horizon" />
        </div>
    );
}

function Entry() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();

    const handleMouseMove = (event) => {
        const card = event.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        card.style.setProperty("--my", `${event.clientY - rect.top}px`);
        card.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
    };

    const resetTilt = (event) => {
        event.currentTarget.style.setProperty("--rx", "0deg");
        event.currentTarget.style.setProperty("--ry", "0deg");
    };

    const enterGallery = () => {
        if (loading) return;
        navigate(user ? "/chat" : "/login");
    };

    return (
        <main className="entry-gallery">
            <div className="entry-gallery__ambient" aria-hidden="true" />
            <section className="entry-gallery__intro">
                <p className="entry-gallery__kicker">Renaissance Galleria</p>
                <h1>Galleria Chat</h1>
                <p className="entry-gallery__copy">
                    Browse the moving salon wall before entering the chatroom.
                </p>
                <button className="entry-gallery__enter" type="button" onClick={enterGallery} disabled={loading}>
                    <GalleryIcon name="frame" size={18} />
                    {loading ? "Preparing gallery" : "Enter Gallery"}
                </button>
            </section>

            <section className="entry-gallery__wall" aria-label="Interactive painting wall">
                {paintings.map((painting, index) => (
                    <article
                        key={painting.title}
                        className={`entry-painting entry-painting--${painting.tone}`}
                        style={{
                            "--x": `${painting.x}%`,
                            "--y": `${painting.y}%`,
                            "--delay": `${index * 90}ms`
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={resetTilt}
                    >
                        <div className="entry-painting__frame">
                            <PaintingScene type={painting.type} />
                        </div>
                        <div className="entry-painting__plate">
                            <strong>{painting.title}</strong>
                            <span>{painting.artist}</span>
                        </div>
                    </article>
                ))}
            </section>
        </main>
    );
}

export default Entry;
