import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { GalleryIcon } from "../components/GalleryIcons.jsx";
import "../styles/entry.scss";

const paintings = [
    { title: "Mona Lisa", artist: "Leonardo", scene: "mona", tone: "olive", x: 7, y: 18 },
    { title: "Primavera", artist: "Botticelli", scene: "primavera", tone: "sage", x: 22, y: 12 },
    { title: "The Birth of Venus", artist: "Botticelli", scene: "venus", tone: "shell", x: 40, y: 17 },
    { title: "Annunciation", artist: "Leonardo", scene: "annunciation", tone: "stone", x: 58, y: 12 },
    { title: "Madonna Study", artist: "Raphael", scene: "madonna", tone: "fresco", x: 76, y: 18 },
    { title: "The School of Athens", artist: "Raphael", scene: "athens", tone: "stone", x: 92, y: 25 },
    { title: "The Last Supper", artist: "Leonardo", scene: "supper", tone: "umber", x: 12, y: 58 },
    { title: "Sistine Study", artist: "Michelangelo", scene: "sistine", tone: "fresco", x: 29, y: 68 },
    { title: "Venetian Portrait", artist: "Titian", scene: "titian", tone: "shell", x: 48, y: 72 },
    { title: "Garden Fresco", artist: "Botticelli", scene: "garden", tone: "sage", x: 67, y: 66 },
    { title: "Urbino Arches", artist: "Bramante", scene: "urbino", tone: "olive", x: 86, y: 70 },
    { title: "Celestial Hands", artist: "Michelangelo", scene: "celestial", tone: "fresco", x: 97, y: 52 }
];

function PaintingScene({ scene }) {
    return (
        <div className={`entry-painting__scene entry-painting__scene--${scene}`}>
            <span className="scene__sun" />
            <span className="scene__arch scene__arch--a" />
            <span className="scene__arch scene__arch--b" />
            <span className="scene__figure scene__figure--a" />
            <span className="scene__figure scene__figure--b" />
            <span className="scene__figure scene__figure--c" />
            <span className="scene__horizon" />
            <span className="scene__accent scene__accent--a" />
            <span className="scene__accent scene__accent--b" />
            <span className="scene__accent scene__accent--c" />
        </div>
    );
}

function Entry() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const wallRef = useRef(null);
    const dragRef = useRef(null);
    const [paintingPositions, setPaintingPositions] = useState(() => (
        Object.fromEntries(paintings.map((painting) => [painting.title, { x: painting.x, y: painting.y }]))
    ));

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

    const movePainting = (event) => {
        const drag = dragRef.current;
        const wall = wallRef.current;
        if (!drag || !wall) return;

        const rect = wall.getBoundingClientRect();
        const nextX = ((event.clientX - drag.offsetX - rect.left) / rect.width) * 100;
        const nextY = ((event.clientY - drag.offsetY - rect.top) / rect.height) * 100;

        setPaintingPositions((prev) => ({
            ...prev,
            [drag.title]: {
                x: clamp(nextX, 3, 97),
                y: clamp(nextY, 6, 94)
            }
        }));
    };

    const handlePaintingPointerDown = (event, painting) => {
        if (event.button !== undefined && event.button !== 0) return;
        const card = event.currentTarget;
        const rect = card.getBoundingClientRect();
        dragRef.current = {
            title: painting.title,
            offsetX: event.clientX - (rect.left + rect.width / 2),
            offsetY: event.clientY - (rect.top + rect.height / 2)
        };
        card.classList.add("entry-painting--dragging");
        card.setPointerCapture?.(event.pointerId);
        movePainting(event);
    };

    const handlePaintingPointerMove = (event) => {
        handleMouseMove(event);
        if (dragRef.current) {
            movePainting(event);
        }
    };

    const stopDragging = (event) => {
        dragRef.current = null;
        event.currentTarget.classList.remove("entry-painting--dragging");
        resetTilt(event);
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
                    Browse the movable salon wall before entering the chatroom.
                </p>
                <button className="entry-gallery__enter" type="button" onClick={enterGallery} disabled={loading}>
                    <GalleryIcon name="frame" size={18} />
                    {loading ? "Preparing gallery" : "Enter Gallery"}
                </button>
            </section>

            <section ref={wallRef} className="entry-gallery__wall" aria-label="Interactive painting wall">
                {paintings.map((painting, index) => (
                    <article
                        key={painting.title}
                        className={`entry-painting entry-painting--${painting.tone}`}
                        style={{
                            "--x": `${paintingPositions[painting.title]?.x ?? painting.x}%`,
                            "--y": `${paintingPositions[painting.title]?.y ?? painting.y}%`,
                            "--delay": `${index * 90}ms`
                        }}
                        onPointerDown={(event) => handlePaintingPointerDown(event, painting)}
                        onPointerMove={handlePaintingPointerMove}
                        onPointerUp={stopDragging}
                        onPointerCancel={stopDragging}
                        onPointerLeave={(event) => {
                            if (dragRef.current?.title !== painting.title) resetTilt(event);
                        }}
                    >
                        <div className="entry-painting__frame">
                            <PaintingScene scene={painting.scene} />
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
