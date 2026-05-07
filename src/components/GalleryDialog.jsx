import { useCallback, useRef, useState } from "react";
import { GalleryIcon } from "./GalleryIcons.jsx";

export function GalleryDialog({ dialog, onClose }) {
    if (!dialog) return null;

    const isConfirm = dialog.type === "confirm";

    return (
        <div className="gallery-dialog" role="presentation">
            <div
                className="gallery-dialog__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="gallery-dialog-title"
            >
                <div className="gallery-dialog__frame-icon">
                    <GalleryIcon name={isConfirm ? "pin" : "frame"} size={20} />
                </div>
                <div className="gallery-dialog__content">
                    <h3 id="gallery-dialog-title">{dialog.title}</h3>
                    <p>{dialog.message}</p>
                </div>
                <div className="gallery-dialog__actions">
                    {isConfirm && (
                        <button type="button" className="gallery-dialog__button" onClick={() => onClose(false)}>
                            {dialog.cancelLabel || "Cancel"}
                        </button>
                    )}
                    <button type="button" className="gallery-dialog__button gallery-dialog__button--primary" onClick={() => onClose(true)} autoFocus>
                        {dialog.confirmLabel || "OK"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function useGalleryDialog() {
    const [dialog, setDialog] = useState(null);
    const resolverRef = useRef(null);

    const closeDialog = useCallback((result) => {
        setDialog(null);
        resolverRef.current?.(result);
        resolverRef.current = null;
    }, []);

    const openDialog = useCallback((options) => (
        new Promise((resolve) => {
            resolverRef.current = resolve;
            setDialog(options);
        })
    ), []);

    const notify = useCallback((message, options = {}) => openDialog({
        type: "notice",
        title: options.title || "Gallery Notice",
        message,
        confirmLabel: options.confirmLabel || "OK"
    }), [openDialog]);

    const confirm = useCallback((message, options = {}) => openDialog({
        type: "confirm",
        title: options.title || "Confirm",
        message,
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel"
    }), [openDialog]);

    return {
        dialogNode: <GalleryDialog dialog={dialog} onClose={closeDialog} />,
        notify,
        confirm
    };
}
