const iconPaths = {
    chat: (
        <>
            <path d="M5 6.5h14v9H9l-4 3v-12Z" />
            <path d="M8.5 10h7" />
            <path d="M8.5 13h4.5" />
        </>
    ),
    friends: (
        <>
            <path d="M8.5 11.25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path d="M15.75 10.5a2.45 2.45 0 1 0 0-4.9 2.45 2.45 0 0 0 0 4.9Z" />
            <path d="M3.75 18.5c.7-2.8 2.25-4.2 4.75-4.2s4.05 1.4 4.75 4.2" />
            <path d="M13.6 14.25c2.2.15 3.55 1.55 4.15 4.25" />
        </>
    ),
    settings: (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3.75v2.1" />
            <path d="M12 18.15v2.1" />
            <path d="m5.8 5.8 1.48 1.48" />
            <path d="m16.72 16.72 1.48 1.48" />
            <path d="M3.75 12h2.1" />
            <path d="M18.15 12h2.1" />
            <path d="m5.8 18.2 1.48-1.48" />
            <path d="m16.72 7.28 1.48-1.48" />
        </>
    ),
    pin: (
        <>
            <path d="M9.25 4.75h5.5l-.8 5.45 2.3 2.3v1.25H7.75V12.5l2.3-2.3-.8-5.45Z" />
            <path d="M12 13.75v5.5" />
        </>
    ),
    chevronDown: <path d="m7 10 5 5 5-5" />,
    chevronUp: <path d="m7 14 5-5 5 5" />,
    chevronRight: <path d="m10 7 5 5-5 5" />,
    chevronLeft: <path d="m14 7-5 5 5 5" />,
    close: (
        <>
            <path d="M7 7l10 10" />
            <path d="M17 7 7 17" />
        </>
    ),
    attach: (
        <>
            <path d="m8.2 12.4 5.75-5.75a3 3 0 0 1 4.25 4.25l-7.05 7.05a4.4 4.4 0 0 1-6.22-6.22l6.8-6.8" />
            <path d="m10.1 14.3 5.1-5.1" />
        </>
    ),
    bell: (
        <>
            <path d="M6.5 17h11l-1.4-2.1V10a4.1 4.1 0 0 0-8.2 0v4.9L6.5 17Z" />
            <path d="M10 19a2.2 2.2 0 0 0 4 0" />
        </>
    ),
    mutedBell: (
        <>
            <path d="M6.5 17h9.5" />
            <path d="M8 14.4V10a4.1 4.1 0 0 1 5.95-3.65" />
            <path d="M16.1 10.1v4.8L17.5 17" />
            <path d="M10 19a2.2 2.2 0 0 0 4 0" />
            <path d="m5 5 14 14" />
        </>
    ),
    check: <path d="m5 12.5 4 4L19 6.5" />,
    plus: (
        <>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
        </>
    ),
    leave: (
        <>
            <path d="M5.5 4.5h8v15h-8z" />
            <path d="M13.5 12h6" />
            <path d="m16.8 8.8 3.2 3.2-3.2 3.2" />
        </>
    ),
    frame: (
        <>
            <path d="M5 5h14v14H5z" />
            <path d="M8 8h8v8H8z" />
        </>
    )
};

export function GalleryIcon({ name, size = 20, className = "", title }) {
    return (
        <svg
            className={`gallery-icon ${className}`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden={title ? undefined : true}
            role={title ? "img" : undefined}
        >
            {title && <title>{title}</title>}
            {iconPaths[name] || iconPaths.frame}
        </svg>
    );
}
