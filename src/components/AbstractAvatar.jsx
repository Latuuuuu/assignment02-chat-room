const palettes = [
    ["#7a3324", "#f0c98a", "#27483b", "#fff7e8"],
    ["#2f4f68", "#d9a46f", "#8f5f47", "#fffaf1"],
    ["#566247", "#e6c37c", "#7a3324", "#f8ead7"],
    ["#5a3a27", "#c56f5c", "#63715d", "#fff7e8"],
    ["#6c5f7d", "#d8b36f", "#284c70", "#fffaf1"]
];

const hashSeed = (value = "gallery-user") => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
};

export function AbstractAvatar({ seed = "", title = "User avatar", className = "" }) {
    const hash = hashSeed(seed);
    const palette = palettes[hash % palettes.length];
    const hatTilt = (hash % 13) - 6;
    const brushTilt = ((hash >> 3) % 24) - 12;
    const eyeOffset = (hash % 5) - 2;
    const coatShape = hash % 2 === 0
        ? "M24 87c5-19 18-29 36-29s31 10 36 29v13H24z"
        : "M21 100c7-24 20-38 39-38s32 14 39 38z";

    return (
        <svg
            className={`abstract-avatar ${className}`}
            viewBox="0 0 120 120"
            role="img"
            aria-label={title}
        >
            <rect width="120" height="120" rx="60" fill={palette[3]} />
            <circle cx="26" cy="25" r="18" fill={palette[1]} opacity="0.45" />
            <circle cx="96" cy="91" r="24" fill={palette[2]} opacity="0.18" />
            <path d="M12 78c22-24 48-24 96 0v42H12z" fill={palette[2]} opacity="0.16" />
            <g transform={`rotate(${hatTilt} 60 38)`}>
                <path d="M28 43c8-20 22-30 40-29 15 1 25 10 31 25-18 7-42 9-71 4z" fill={palette[0]} />
                <path d="M22 43c24 9 54 9 76 0 4-2 6 6 2 8-23 10-56 10-82 0-4-2 0-10 4-8z" fill={palette[1]} />
            </g>
            <circle cx="60" cy="53" r="22" fill="#d9b083" />
            <path d="M39 51c8-15 24-20 43-11 2 13-2 24-12 32-13-3-23-10-31-21z" fill="#e5bd8e" opacity="0.72" />
            <circle cx={52 + eyeOffset} cy="52" r="2.6" fill="#2f241d" />
            <circle cx={70 + eyeOffset} cy="52" r="2.6" fill="#2f241d" />
            <path d="M53 65c6 4 13 4 19 0" fill="none" stroke="#7a3324" strokeWidth="3" strokeLinecap="round" />
            <path d={coatShape} fill={palette[0]} />
            <path d="M46 66l14 18 14-18" fill={palette[3]} opacity="0.9" />
            <g transform={`rotate(${brushTilt} 84 74)`}>
                <path d="M80 35h6v58h-6z" fill="#5a3a27" />
                <path d="M78 31c3-9 12-9 14 0l-4 10h-6z" fill={palette[1]} />
            </g>
            <circle cx="34" cy="82" r="6" fill={palette[1]} />
            <circle cx="45" cy="91" r="4" fill={palette[3]} opacity="0.8" />
        </svg>
    );
}
