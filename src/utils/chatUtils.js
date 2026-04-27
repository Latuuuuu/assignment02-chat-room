export const getUserDisplayName = (userInfo) => {
    return userInfo?.displayName || userInfo?.email || "User";
};

export const getChatAvatarFallback = (chat) => {
    const label = chat?.name || "#";
    return label[0]?.toUpperCase() || "#";
};

export const getMessagePreview = (message) => {
    return message?.text || "Sent an image";
};

export const filterMessagesByQuery = (messages, query) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return messages;
    }

    return messages.filter((msg) => {
        const text = (msg.text || "").toLowerCase();
        const replyText = (msg.replyToText || "").toLowerCase();
        return text.includes(normalized) || replyText.includes(normalized);
    });
};
