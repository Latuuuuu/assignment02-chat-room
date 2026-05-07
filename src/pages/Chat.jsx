import { useEffect, useLayoutEffect,useMemo, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { db, storage } from "../config.js";
import { ref, onValue, push, set, serverTimestamp, get, update, remove, query, limitToLast } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../config.js";
import { MUTED_CHATS_KEY, NOTIFICATION_PREFS_KEY } from "../constants/storageKeys.js";
import { filterMessagesByQuery, getChatAvatarFallback, getMessagePreview, getUserDisplayName } from "../utils/chatUtils.js";
import { GalleryIcon } from "../components/GalleryIcons.jsx";
import { AbstractAvatar } from "../components/AbstractAvatar.jsx";
import { useGalleryDialog } from "../components/GalleryDialog.jsx";
import "../styles/chat.scss";

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY;
const EMOJI_PICKER_OPTIONS = ["😀", "😊", "😂", "😍", "🥹", "😎", "😭", "😡", "👍", "👏", "🙏", "❤️", "🔥", "✨", "🎉", "💡"];
const REACTION_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function Chat() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [userChats, setUserChats] = useState([]);
    const [userChatsLoaded, setUserChatsLoaded] = useState(false);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [allUsers, setAllUsers] = useState([]);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [newGroupName, setNewGroupName] = useState("");
    
    // Check if we came from another page with a specific view
    const [activeView, setActiveView] = useState(location.state?.view || "chats"); // 'chats' | 'friends'
    const [friends, setFriends] = useState({});
    const [friendSearchQuery, setFriendSearchQuery] = useState("");
    const [addFriendEmail, setAddFriendEmail] = useState("");
    
    useEffect(() => {
        if (location.state?.view) {
            setActiveView(location.state.view);
            // Clear the state so refreshing doesn't keep forcing it if user switched locally
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const [searchQuery, setSearchQuery] = useState("");
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [readReceipts, setReadReceipts] = useState({});

    const [showSettings, setShowSettings] = useState(false);
    const [settingsView, setSettingsView] = useState('main');
    const [showAddMember, setShowAddMember] = useState(false);
    const [newChatName, setNewChatName] = useState("");
    const [mutedChats, setMutedChats] = useState({});
    
    // For single-member nickname editing
    const [editingNicknameUid, setEditingNicknameUid] = useState(null);
    const [singleNicknameDraft, setSingleNicknameDraft] = useState("");
    
    const [pinnedMessages, setPinnedMessages] = useState([]);
    const [showAllPinned, setShowAllPinned] = useState(false);

    const [imageFile, setImageFile] = useState(null);
    const [fullScreenImage, setFullscreenImage] = useState(null);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [gifQuery, setGifQuery] = useState("");
    const [gifResults, setGifResults] = useState([]);
    const [gifLoading, setGifLoading] = useState(false);
    const [gifError, setGifError] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [notificationPrefs, setNotificationPrefs] = useState({});
    const [mentionQuery, setMentionQuery] = useState(null);
    const [mentionStart, setMentionStart] = useState(null);
    const [selectedMentions, setSelectedMentions] = useState({});
    
    const [replyingTo, setReplyingTo] = useState(null);
    const [lastReadMsgId, setLastReadMsgId] = useState(null);
    const [lastVisibleMessageId, setLastVisibleMessageId] = useState(null);
    const [lastReadResolved, setLastReadResolved] = useState(false);
    const [currentUserProfile, setCurrentUserProfile] = useState({ displayName: "", photoURL: "" });
    
    const [notificationPermission, setNotificationPermission] = useState("default");
    useEffect(() => {
        try {
            if (typeof window !== "undefined" && "Notification" in window) {
                setNotificationPermission(Notification.permission);
                if (Notification.permission !== "granted" && Notification.permission !== "denied") {
                    requestNotificationPermission();
                }
            }
        } catch (error) {
            console.warn("Notification API 的讀取錯誤", error);
        }
    }, []);

    const [isUpdatingChatIcon, setIsUpdatingChatIcon] = useState(false);

    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const composerInputRef = useRef(null);
    const chatIconUploadRef = useRef(null);
    const mutedChatsRef = useRef({});
    const lastNotifiedMessageByChatRef = useRef({});
    const notificationInitializedByChatRef = useRef({});
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isChatReady, setIsChatReady] = useState(false);
    const pinnedMessageIdSet = useMemo(() => new Set(pinnedMessages.map((pm) => pm.id)), [pinnedMessages]);
    const { dialogNode, notify, confirm } = useGalleryDialog();

    const getMentionLabel = (profile) => {
        if (profile?.uid === "everyone") return "everyone";
        return getUserDisplayName(profile).replace(/\s+/g, "");
    };

    const getMentionSuggestions = () => {
        if (mentionQuery === null) return [];
        const normalized = mentionQuery.toLowerCase();
        const memberProfiles = Object.keys(selectedChat?.members || {})
            .filter((uid) => uid !== user?.uid)
            .map((uid) => getMemberInfo(uid));
        const suggestions = [
            { uid: "everyone", displayName: "Everyone", isEveryone: true },
            ...memberProfiles
        ];

        return suggestions
            .filter((profile, index, list) => list.findIndex((item) => item.uid === profile.uid) === index)
            .filter((profile) => {
                const label = getMentionLabel(profile).toLowerCase();
                const name = getUserDisplayName(profile).toLowerCase();
                return label.includes(normalized) || name.includes(normalized);
            })
            .slice(0, 6);
    };

    const isMentionForUser = (message, uid = user?.uid) => {
        if (!message || !uid) return false;
        return Boolean(message.mentions?.everyone || message.mentions?.[uid]);
    };
    
    const requestNotificationPermission = async () => {
        if (!("Notification" in window)) {
            return "denied";
        }

        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        return permission;
    };

    // Request notification permission
    useEffect(() => {
        if ("Notification" in window) {
            setNotificationPermission(Notification.permission);
            if (Notification.permission !== "granted" && Notification.permission !== "denied") {
                requestNotificationPermission();
            }
        }
    }, []);

    useEffect(() => {
        try {
            const storedMuted = localStorage.getItem(MUTED_CHATS_KEY);
            if (storedMuted) {
                setMutedChats(JSON.parse(storedMuted));
            }
            const storedPrefs = localStorage.getItem(NOTIFICATION_PREFS_KEY);
            if (storedPrefs) {
                setNotificationPrefs(JSON.parse(storedPrefs));
            }
        }catch (e) {
            console.error("Failed to load notification settings from localStorage", e);
            setMutedChats({});
            setNotificationPrefs({});
        }
    }, []);

    useEffect(() => {
        mutedChatsRef.current = mutedChats;
    }, [mutedChats]);

    useEffect(() => {
        if (!showGifPicker) return;

        if (!GIPHY_API_KEY) {
            setGifResults([]);
            setGifError("Set VITE_GIPHY_API_KEY to enable GIF search.");
            return;
        }

        const controller = new AbortController();
        const searchTerm = gifQuery.trim().slice(0, 50);

        const timer = setTimeout(async () => {
            setGifLoading(true);
            setGifError("");

            try {
                const endpoint = searchTerm
                    ? "https://api.giphy.com/v1/gifs/search"
                    : "https://api.giphy.com/v1/gifs/trending";
                const params = new URLSearchParams({
                    api_key: GIPHY_API_KEY,
                    limit: "12",
                    rating: "pg",
                    bundle: "messaging_non_clips"
                });

                if (searchTerm) {
                    params.set("q", searchTerm);
                }

                const response = await fetch(`${endpoint}?${params.toString()}`, {
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error(`GIPHY request failed (${response.status})`);
                }

                const payload = await response.json();
                const gifs = (payload.data || []).map((gif) => {
                    const preview = gif.images?.fixed_width_small || gif.images?.fixed_width || gif.images?.downsized;
                    const messageImage = gif.images?.downsized_medium || gif.images?.fixed_width || gif.images?.original;

                    return {
                        id: gif.id,
                        title: gif.title || "GIPHY GIF",
                        previewUrl: preview?.url || messageImage?.url,
                        gifUrl: messageImage?.url || preview?.url,
                        giphyUrl: gif.url
                    };
                }).filter((gif) => gif.previewUrl && gif.gifUrl);

                setGifResults(gifs);
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error("GIPHY search failed", error);
                    setGifError("Could not load GIFs. Please try again.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setGifLoading(false);
                }
            }
        }, 250);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [showGifPicker, gifQuery]);

    useEffect(() => {
        if (!user) return;
        const meRef = ref(db, `users/${user.uid}`);
        const unsubscribe = onValue(meRef, (snapshot) => {
            if (!snapshot.exists()) {
                return;
            }
            const me = snapshot.val();
            setCurrentUserProfile({
                displayName: me.displayName || "",
                photoURL: me.photoURL || ""
            });
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!selectedChat?.id) return;

        const metadataRef = ref(db, `chats/${selectedChat.id}/metadata`);
        const unsubscribe = onValue(metadataRef, (snapshot) => {
            if (!snapshot.exists()) return;

            const metadata = snapshot.val();
            setSelectedChat((prev) => (prev?.id === selectedChat.id ? { ...prev, ...metadata } : prev));
            setUserChats((prev) => prev.map((chat) => (chat.id === selectedChat.id ? { ...chat, ...metadata } : chat)));
        });

        return () => unsubscribe();
    }, [selectedChat?.id]);

    useEffect(() => {
        setEditingNicknameUid(null);
        setSingleNicknameDraft("");
    }, [selectedChat?.id]);

    const sendBrowserNotification = (title, body, icon) => {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted") {
            new Notification(title, { body, icon });
            return;
        }

        if (Notification.permission !== "denied") {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    new Notification(title, { body, icon });
                }
            });
        }
    };

    useEffect(() => {
        if (!user?.uid || userChats.length === 0) return;

        const unsubscribes = userChats.map((chat) => {
            const lastMessageQuery = query(ref(db, `chats/${chat.id}/messages`), limitToLast(1));

            return onValue(lastMessageQuery, async (snapshot) => {
                if (!snapshot.exists()) {
                    notificationInitializedByChatRef.current[chat.id] = true;
                    return;
                }

                let latestMessage = null;
                snapshot.forEach((child) => {
                    latestMessage = { id: child.key, ...child.val() };
                });
                if (!latestMessage) return;

                if (!notificationInitializedByChatRef.current[chat.id]) {
                    notificationInitializedByChatRef.current[chat.id] = true;
                    lastNotifiedMessageByChatRef.current[chat.id] = latestMessage.id;
                    return;
                }

                const previousMessageId = lastNotifiedMessageByChatRef.current[chat.id];
                if (previousMessageId === latestMessage.id) {
                    return;
                }

                lastNotifiedMessageByChatRef.current[chat.id] = latestMessage.id;

                if (latestMessage.senderId === user.uid) return;
                if (document.hasFocus() && !document.hidden) return;
                const pref = notificationPrefs[chat.id] || (mutedChatsRef.current[chat.id] ? "muted" : "all");
                if (pref === "muted") return;
                if (pref === "mentions" && !isMentionForUser(latestMessage, user.uid)) return;

                const senderSnapshot = await get(ref(db, `users/${latestMessage.senderId}`));
                const senderInfo = senderSnapshot.exists() ? senderSnapshot.val() : null;

                const nickname = chat?.nicknames?.[latestMessage.senderId];
                const senderName = nickname?.trim() || getUserDisplayName(senderInfo);

                sendBrowserNotification(
                    `New message in ${getChatTitle(chat)}`,
                    `${senderName}: ${getMessagePreview(latestMessage)}`,
                    senderInfo?.photoURL || getDirectChatPeer(chat)?.photoURL || chat.iconUrl || "/react.svg"
                );
            });
        });

        return () => {
            unsubscribes.forEach((unsubscribe) => unsubscribe());
        };
    }, [user?.uid, userChats, notificationPrefs]);

    // Load user's chats
    useEffect(() => {
        if (!user) return;
        const userChatsRef = ref(db, `user_chats/${user.uid}`);
        const unsubscribe = onValue(userChatsRef, async (snapshot) => {
            if (snapshot.exists()) {
                const chatIds = Object.keys(snapshot.val());
                const chatDataPromises = chatIds.map(async (chatId) => {
                    const chatSnapshot = await get(ref(db, `chats/${chatId}/metadata`));
                    return { id: chatId, ...chatSnapshot.val() };
                });
                const chats = await Promise.all(chatDataPromises);
                setUserChats(chats);
            } else {
                setUserChats([]);
            }
            setUserChatsLoaded(true);
        });
        return () => unsubscribe();
    }, [user]);

    // Load available users for new chat
    useEffect(() => {
        const usersRef = ref(db, `users`);
        onValue(usersRef, (snapshot) => {
            const usersData = [];
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const data = childSnapshot.val();
                    if (data.uid !== user?.uid) {
                        usersData.push(data);
                    }
                });
            }
            setAllUsers(usersData);
        }, { onlyOnce: true });
    }, [user]);

    // Load friends
    useEffect(() => {
        if (!user) return;
        const friendsRef = ref(db, `friends/${user.uid}`);
        const unsubscribe = onValue(friendsRef, (snapshot) => {
            if (snapshot.exists()) {
                setFriends(snapshot.val());
            } else {
                setFriends({});
            }
        });
        return () => unsubscribe();
    }, [user]);

    // Listen to selected chat messages
    useEffect(() => {
        if (!selectedChat) {
            setMessages([]);
            setPinnedMessages([]);
            setIsChatReady(false);
            return;
        }
        
        // 【關鍵修正 1】：切換聊天室時，同步清空舊訊息與狀態，防止 useLayoutEffect 提早觸發
        setIsChatReady(false);
        setMessages([]); 
        setLastReadMsgId(null);
        setIsInitialLoad(true);
        
        const messagesRef = ref(db, `chats/${selectedChat.id}/messages`);
        const receiptsRef = ref(db, `chats/${selectedChat.id}/readReceipts`);
        const pinnedRef = ref(db, `chats/${selectedChat.id}/pinnedMessages`);
        
        let unsubscribeMsgs = () => {};
        
        const initChat = async () => {
            // (這裡不用再寫 setIsInitialLoad(true) 了，上面已經同步設定)
            let myLastReadId = null;
            const snap = await get(receiptsRef);
            if (snap.exists() && snap.val()[user.uid]) {
                myLastReadId = snap.val()[user.uid];
            }
            setLastReadMsgId(myLastReadId);

            unsubscribeMsgs = onValue(messagesRef, async (snapshot) => {
                if (snapshot.exists()) {
                    const msgs = [];
                    const messagePromises = [];
                    
                    snapshot.forEach((child) => {
                        const msgData = { id: child.key, ...child.val() };
                        const promise = get(ref(db, `users/${msgData.senderId}`)).then(userSnap => {
                            if(userSnap.exists()) {
                                msgData.senderInfo = userSnap.val();
                            }
                            return msgData;
                        });
                        msgs.push(msgData);
                        messagePromises.push(promise);
                    });

                    await Promise.all(messagePromises);

                    setMessages(msgs);
                } else {
                    setMessages([]);
                    setIsChatReady(true);
                }
            });
        };

        const unsubscribeReceipts = onValue(receiptsRef, (snapshot) => {
            if (snapshot.exists()) setReadReceipts(snapshot.val());
            else setReadReceipts({});
        });

        const unsubscribePinned = onValue(pinnedRef, (snapshot) => {
            if (snapshot.exists()) {
                const pinned = [];
                snapshot.forEach(child => { pinned.push({id: child.key, ...child.val()}); });
                setPinnedMessages(pinned.sort((a,b) => b.pinnedAt - a.pinnedAt));
            } else {
                setPinnedMessages([]);
            }
        });

        initChat();

        return () => {
            unsubscribeMsgs();
            unsubscribeReceipts();
            unsubscribePinned();
        };
    }, [selectedChat, user.uid]);

    // Handle initial scroll positioning
    useLayoutEffect(() => {
        // 加入 !messagesContainerRef.current 防呆，確保 DOM 已經準備好
        if (messages.length === 0 || !selectedChat || !messagesContainerRef.current) return;

        if (isInitialLoad) {
            let targetNode = null;
            
            if (lastReadMsgId) {
                const lastReadIdx = messages.findIndex(m => m.id === lastReadMsgId);
                // 尋找最後已讀的「下一則」訊息
                if (lastReadIdx !== -1 && lastReadIdx + 1 < messages.length) {
                    const targetId = messages[lastReadIdx + 1].id;
                    targetNode = document.getElementById(`msg-${targetId}`);
                }
            }

            if (targetNode) {
                // 定位到未讀訊息
                targetNode.scrollIntoView({ block: "center" });
            } else {
                // 【關鍵修正 2】：若沒有未讀訊息，改用 scrollTop 直接強制滾動到底部，比 scrollIntoView 更可靠
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
            
            setIsInitialLoad(false);
            setIsChatReady(true);
        } else {
            // 處理後續的新訊息滾動
            if (messages[messages.length - 1]?.senderId === user.uid) {
                scrollToBottom();
            } else if (!isChatReady) {
               setIsChatReady(true);
            }
        }
    }, [messages, isInitialLoad, lastReadMsgId, selectedChat, user.uid]);

    // Observe message visibility and track the latest message visible in viewport.
    useEffect(() => {
        if (!selectedChat || messages.length === 0 || !messagesContainerRef.current) return;

        // if (!("IntersectionObserver" in window)) return;

        const observer = new IntersectionObserver(
            (entries) => {
                let latestVisible = null;

                entries.forEach((entry) => {
                    if (!entry.isIntersecting || entry.intersectionRatio < 0.55) return;

                    const msgId = entry.target.getAttribute("data-msg-id");
                    if (!msgId) return;

                    const index = messages.findIndex((m) => m.id === msgId);
                    if (index === -1) return;

                    if (!latestVisible || index > latestVisible.index) {
                        latestVisible = { id: msgId, index };
                    }
                });

                if (latestVisible?.id) {
                    setLastVisibleMessageId(latestVisible.id);
                }
            },
            {
                root: messagesContainerRef.current,
                threshold: [0.25, 0.55, 0.8]
            }
        );

        messages.forEach((msg) => {
            const node = document.getElementById(`msg-${msg.id}`);
            if (node) {
                observer.observe(node);
            }
        });

        return () => observer.disconnect();
    }, [messages, selectedChat]);

    // Mark read when message is actually visible to the reader.
    useEffect(() => {
        if (!selectedChat || !lastVisibleMessageId) return;

        const visibleIdx = messages.findIndex((m) => m.id === lastVisibleMessageId);
        const currentReadIdx = messages.findIndex((m) => m.id === readReceipts?.[user.uid]);
        if (visibleIdx === -1 || (currentReadIdx !== -1 && visibleIdx <= currentReadIdx)) return;

        const timer = setTimeout(() => {
            update(ref(db, `chats/${selectedChat.id}/readReceipts`), {
                [user.uid]: lastVisibleMessageId
            });
        }, 450);

        return () => clearTimeout(timer);
    }, [selectedChat, user.uid, lastVisibleMessageId, messages, readReceipts]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const getMentionMapFromText = (text) => {
        const mentions = {};
        const normalized = text || "";
        const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        Object.values(selectedMentions).forEach((mention) => {
            if (normalized.includes(`@${mention.label}`)) {
                mentions[mention.uid] = true;
            }
        });

        if (/(^|\s)@everyone\b/i.test(normalized)) {
            mentions.everyone = true;
        }

        Object.keys(selectedChat?.members || {}).forEach((uid) => {
            const profile = getMemberInfo(uid);
            const label = getMentionLabel(profile);
            if (label && new RegExp(`(^|\\s)@${escapeRegExp(label)}\\b`, "i").test(normalized)) {
                mentions[uid] = true;
            }
        });

        return mentions;
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!selectedChat) return;

        if (editingMessageId) {
            if (!newMessage.trim()) return;

            await update(ref(db, `chats/${selectedChat.id}/messages/${editingMessageId}`), {
                text: newMessage.trim(),
                isEdited: true,
                editedAt: serverTimestamp()
            });

            setEditingMessageId(null);
            setNewMessage("");
            if (composerInputRef.current) composerInputRef.current.style.height = 'auto';
            return;
        }

        if (!newMessage.trim() && !imageFile) return;
        const messageText = newMessage.trim();
        const mentions = getMentionMapFromText(messageText);

        const messagesRef = ref(db, `chats/${selectedChat.id}/messages`);
        const newMsgRef = push(messagesRef);
        
        let imageUrl = null;
        
        if (imageFile) {
            try {
                const imageRef = storageRef(storage, `chats/${selectedChat.id}/${Date.now()}_${imageFile.name}`);
                await uploadBytes(imageRef, imageFile);
                imageUrl = await getDownloadURL(imageRef);
            } catch (err) {
                console.error("Image upload failed: ", err);
                await notify("Failed to upload image. Please check your Firebase Storage rules.", { title: "Image Not Sent" });
                return;
            }
        }

        const msgData = {
            senderId: user.uid,
            text: newMessage || "",
            timestamp: serverTimestamp()
        };

        if (Object.keys(mentions).length > 0) {
            msgData.mentions = mentions;
        }

        if (imageUrl) {
            msgData.imageUrl = imageUrl;
        }

        if (replyingTo) {
            msgData.replyToId = replyingTo.id;
            msgData.replyToText = replyingTo.text || "Image";
            msgData.replyToSender = getChatDisplayName(replyingTo.senderId, replyingTo.senderInfo);
        }

        await set(newMsgRef, msgData);

        setNewMessage("");
        setImageFile(null);
        setReplyingTo(null);
        setShowEmojiPicker(false);
        setSelectedMentions({});
        setMentionQuery(null);
        setMentionStart(null);
    };

    const handleSendGif = async (gif) => {
        if (!selectedChat || !gif?.gifUrl) return;

        const messagesRef = ref(db, `chats/${selectedChat.id}/messages`);
        const newMsgRef = push(messagesRef);
        const msgData = {
            senderId: user.uid,
            text: "",
            timestamp: serverTimestamp(),
            gifUrl: gif.gifUrl,
            gifPreviewUrl: gif.previewUrl,
            gifTitle: gif.title,
            giphyUrl: gif.giphyUrl
        };

        if (replyingTo) {
            msgData.replyToId = replyingTo.id;
            msgData.replyToText = replyingTo.text || replyingTo.gifTitle || "GIF";
            msgData.replyToSender = getChatDisplayName(replyingTo.senderId, replyingTo.senderInfo);
        }

        await set(newMsgRef, msgData);

        setShowGifPicker(false);
        setGifQuery("");
        setReplyingTo(null);
        setImageFile(null);
        setShowEmojiPicker(false);
    };

    const insertEmoji = (emoji) => {
        const input = composerInputRef.current;
        const start = input?.selectionStart ?? newMessage.length;
        const end = input?.selectionEnd ?? newMessage.length;
        const nextMessage = `${newMessage.slice(0, start)}${emoji}${newMessage.slice(end)}`;

        setNewMessage(nextMessage);

        requestAnimationFrame(() => {
            if (!composerInputRef.current) return;
            const nextCursor = start + emoji.length;
            composerInputRef.current.focus();
            composerInputRef.current.setSelectionRange(nextCursor, nextCursor);
            composerInputRef.current.style.height = "auto";
            composerInputRef.current.style.height = `${composerInputRef.current.scrollHeight}px`;
        });
    };

    const handleToggleReaction = async (msg, emoji) => {
        if (!selectedChat || !msg?.id || !user?.uid) return;

        const reactionRef = ref(db, `chats/${selectedChat.id}/messages/${msg.id}/reactions/${user.uid}`);
        if (msg.reactions?.[user.uid] === emoji) {
            await remove(reactionRef);
        } else {
            await set(reactionRef, emoji);
        }
    };

    const getReactionCounts = (reactions = {}) => {
        return Object.values(reactions).reduce((counts, emoji) => {
            counts[emoji] = (counts[emoji] || 0) + 1;
            return counts;
        }, {});
    };

    const handleReplyClick = (msg) => {
        setReplyingTo(msg);
        composerInputRef.current?.focus();
    };

    const scrollToMessage = (msgId) => {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const bubble = el.querySelector('.message__bubble');
            bubble?.classList.add('message__bubble--spotlight');
            setTimeout(() => {
                bubble?.classList.remove('message__bubble--spotlight');
            }, 2000);
        }
    };

    const handleDeleteMessage = async (msgId) => {
        const ok = await confirm("Are you sure you want to unsend this message?", {
            title: "Unsend Message",
            confirmLabel: "Unsend"
        });
        if (!ok) return;
        await remove(ref(db, `chats/${selectedChat.id}/messages/${msgId}`));
    };

    const handleEditClick = (msg) => {
        setEditingMessageId(msg.id);
        setReplyingTo(null);
        setImageFile(null);
        setShowGifPicker(false);
        setShowEmojiPicker(false);
        setNewMessage(msg.text || "");
        setTimeout(() => composerInputRef.current?.focus(), 0);
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setNewMessage("");
    };

    const handlePinMessage = async (msg) => {
        const pinRef = ref(db, `chats/${selectedChat.id}/pinnedMessages/${msg.id}`);
        await set(pinRef, {
            ...msg,
            pinnedAt: serverTimestamp(),
            pinnedBy: user.uid
        });
    };

    const handleUnpinMessage = async (msgId) => {
        await remove(ref(db, `chats/${selectedChat.id}/pinnedMessages/${msgId}`));
    };

    const openDirectChat = async (targetUid) => {
        // Check if direct chat already exists
        const existingChat = userChats.find(chat => {
            const members = Object.keys(chat.members || {});
            return members.length === 2 && members.includes(user.uid) && members.includes(targetUid);
        });

        if (existingChat) {
            setSelectedChat(existingChat);
            setActiveView("chats");
            return;
        }

        // Create new direct chat
        const chatMembers = { [user.uid]: true, [targetUid]: true };
        const chatsRef = ref(db, `chats`);
        const newChatRef = push(chatsRef);
        
        const targetUser = allUsers.find(u => u.uid === targetUid);
        const chatName = targetUser ? getUserDisplayName(targetUser) : "Direct Chat";

        await set(newChatRef, {
            metadata: {
                name: chatName,
                members: chatMembers,
                nicknames: {},
                createdAt: serverTimestamp(),
                isDirect: true
            }
        });

        const updates = {
            [`user_chats/${user.uid}/${newChatRef.key}`]: true,
            [`user_chats/${targetUid}/${newChatRef.key}`]: true
        };
        await update(ref(db), updates);

        setSelectedChat({ id: newChatRef.key, name: chatName, members: chatMembers, isDirect: true });
        setActiveView("chats");
    };

    const handleAddFriend = async () => {
        if (!addFriendEmail.trim()) return;
        const targetUser = allUsers.find(u => u.email === addFriendEmail.trim());
        if (!targetUser) {
            await notify("User not found.", { title: "No Match" });
            return;
        }
        if (targetUser.uid === user.uid) {
            await notify("You cannot add yourself as a friend.", { title: "Already You" });
            return;
        }
        if (friends[targetUser.uid]) {
            await notify("This user is already in your friends list.", { title: "Already Friends" });
            return;
        }
        
        const updates = {
            [`friends/${user.uid}/${targetUser.uid}`]: true,
            [`friends/${targetUser.uid}/${user.uid}`]: true
        };
        await update(ref(db), updates);
        setAddFriendEmail("");
        await notify("Friend added.", { title: "New Friend" });
    };

    const handleDeleteFriend = async (friendUid, friendName) => {
        const ok = await confirm(`Remove ${friendName} from your friends list?`, {
            title: "Delete Friend",
            confirmLabel: "Remove"
        });
        if (!ok) return;
        
        try {
            const updates = {
                [`friends/${user.uid}/${friendUid}`]: null,
                [`friends/${friendUid}/${user.uid}`]: null
            };
            await update(ref(db), updates);
            
            // Also option to remove direct chat if preferred? No the request only says "delete friend". We'll just remove them from friends node.
            await notify("Friend removed.", { title: "Friends Updated" });
        } catch (error) {
            console.error("Error removing friend:", error);
            await notify("Failed to remove friend.", { title: "Update Failed" });
        }
    };

    const handleCreateChat = async () => {
        if (selectedUsers.length === 0) return;

        if (selectedUsers.length === 1) {
            await openDirectChat(selectedUsers[0]);
            setShowNewChatModal(false);
            setSelectedUsers([]);
            setNewGroupName("");
            return;
        }

        const chatMembers = { [user.uid]: true };
        selectedUsers.forEach(uid => { chatMembers[uid] = true; });

        const chatsRef = ref(db, `chats`);
        const newChatRef = push(chatsRef);
        
        const memberNames = allUsers.filter(u => selectedUsers.includes(u.uid)).map(u => getUserDisplayName(u)).join('、');
        const chatName = newGroupName.trim() || memberNames;

        await set(newChatRef, {
            metadata: {
                name: chatName,
                members: chatMembers,
                nicknames: {},
                createdAt: serverTimestamp()
            }
        });

        // Add chat ID to all members
        const updates = {};
        Object.keys(chatMembers).forEach(uid => {
            updates[`user_chats/${uid}/${newChatRef.key}`] = true;
        });
        await update(ref(db), updates);

        setShowNewChatModal(false);
        setSelectedUsers([]);
        setSelectedChat({ id: newChatRef.key, name: chatName });
    };

    const toggleUserSelection = (uid) => {
        setSelectedUsers(prev => 
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const getDirectChatPeer = (chat) => {
        if (!chat?.isDirect || !user?.uid) return null;
        const peerUid = Object.keys(chat.members || {}).find((uid) => uid !== user.uid);
        return peerUid ? getMemberInfo(peerUid) : null;
    };

    const getChatTitle = (chat) => {
        const peer = getDirectChatPeer(chat);
        if (peer) return getUserDisplayName(peer);
        return chat?.name || "Chat";
    };

    const renderChatIcon = (chat, size, className) => {
        const directPeer = getDirectChatPeer(chat);
        if (directPeer?.photoURL) {
            const peerName = getUserDisplayName(directPeer);
            return (
                <span className={`gallery-round-frame ${className}`} style={{ width: size, height: size }}>
                    <img src={directPeer.photoURL} alt={peerName} />
                </span>
            );
        }

        if (directPeer) {
            return (
                <div className={`gallery-round-frame ${className}`} style={{ width: size, height: size }}>
                    <AbstractAvatar seed={directPeer.uid || directPeer.email || getUserDisplayName(directPeer)} />
                </div>
            );
        }

        if (chat?.iconUrl) {
            return (
                <span className={`gallery-round-frame ${className}`} style={{ width: size, height: size }}>
                    <img src={chat.iconUrl} alt={getChatTitle(chat)} />
                </span>
            );
        }

        return (
            <div className={`gallery-round-frame ${className}`} style={{ width: size, height: size }}>
                {getChatAvatarFallback(chat)}
            </div>
        );
    };

    const applyChatMetadataLocally = (chatId, changes) => {
        setSelectedChat((prev) => (prev?.id === chatId ? { ...prev, ...changes } : prev));
        setUserChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, ...changes } : chat)));
    };

    const getMemberInfo = (uid) => {
        if (uid === user?.uid) {
            return {
                uid,
                displayName: currentUserProfile.displayName || user?.email || "User",
                photoURL: currentUserProfile.photoURL || "",
                email: user?.email || ""
            };
        }

        return allUsers.find((u) => u.uid === uid) || { uid, displayName: "User", photoURL: "" };
    };

    const getChatDisplayName = (uid, userInfo) => {
        const nickname = selectedChat?.nicknames?.[uid];
        if (nickname && nickname.trim()) return nickname.trim();
        return getUserDisplayName(userInfo);
    };

    const startEditSingleNickname = (uid, currentNickname) => {
        setEditingNicknameUid(uid);
        setSingleNicknameDraft(currentNickname || "");
    };

    const cancelEditSingleNickname = () => {
        setEditingNicknameUid(null);
        setSingleNicknameDraft("");
    };

    const saveSingleNickname = async (uid) => {
        if (!selectedChat) return;
        const value = singleNicknameDraft.trim();
        const updates = {};
        updates[`chats/${selectedChat.id}/metadata/nicknames/${uid}`] = value || null;

        await update(ref(db), updates);
        setEditingNicknameUid(null);
    };

    const handleRenameChat = async () => {
        if (!selectedChat || !newChatName.trim()) return;

        const updatedName = newChatName.trim();
        await update(ref(db, `chats/${selectedChat.id}/metadata`), { name: updatedName });
        applyChatMetadataLocally(selectedChat.id, { name: updatedName });
        setNewChatName("");
    };

    const handleChangeChatIcon = async () => {
        if (!selectedChat) return;
        chatIconUploadRef.current?.click();
    };

    const cycleNotificationPreference = () => {
        if (!selectedChat) return;

        const current = notificationPrefs[selectedChat.id] || (mutedChats[selectedChat.id] ? "muted" : "all");
        const next = current === "all" ? "mentions" : current === "mentions" ? "muted" : "all";
        const nextPrefs = { ...notificationPrefs, [selectedChat.id]: next };
        const newMuted = { ...mutedChats, [selectedChat.id]: next === "muted" };
        setNotificationPrefs(nextPrefs);
        setMutedChats(newMuted);
        localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(nextPrefs));
        localStorage.setItem(MUTED_CHATS_KEY, JSON.stringify(newMuted));
    };

    // Keyboard Shortcuts
    const handleNicknameKeyDown = (e, uid) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveSingleNickname(uid);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditSingleNickname();
        }
    };

    const handleRenameKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleRenameChat();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setNewChatName("");
        }
    };

    const handleAddFriendKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddFriend();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setAddFriendEmail("");
        }
    };

    const handleCreateChatKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (Object.keys(friends).length === 0) {
                setShowNewChatModal(false);
                setActiveView('friends');
            } else {
                handleCreateChat();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setShowNewChatModal(false);
            setNewGroupName("");
            setSelectedUsers([]);
        }
    };

    // Add a global listener for the modal so Esc/Enter works anywhere while it's open, 
    // without needing focus on the input specifically, but input events will bubble up.
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (!showNewChatModal) return;
            // Ignore if active element is already handling it
            if (e.target.tagName === 'INPUT' && e.target.type === 'text') return; 

            if (e.key === 'Escape') {
                setShowNewChatModal(false);
                setNewGroupName("");
                setSelectedUsers([]);
            } else if (e.key === 'Enter') {
                if (Object.keys(friends).length === 0) {
                    setShowNewChatModal(false);
                    setActiveView('friends');
                } else if (selectedUsers.length > 0) {
                    handleCreateChat();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [showNewChatModal, friends, selectedUsers]);

    const handleComposerKeyDown = (e) => {
        if (e.key === "Escape" && mentionQuery !== null) {
            setMentionQuery(null);
            setMentionStart(null);
            return;
        }
        if (e.key !== "Enter") return;

        // Use modifier + Enter for manual line break; Enter alone submits.
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            return;
        }

        e.preventDefault();
        e.currentTarget.form?.requestSubmit();
    };

    const handleInputResize = (e) => {
        const value = e.target.value;
        setNewMessage(value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
        const cursor = e.target.selectionStart ?? value.length;
        const beforeCursor = value.slice(0, cursor);
        const match = beforeCursor.match(/(^|\s)@([A-Za-z0-9_.-]*)$/);
        if (match) {
            setMentionStart(cursor - match[2].length - 1);
            setMentionQuery(match[2]);
        } else {
            setMentionStart(null);
            setMentionQuery(null);
        }
    };

    const handleSelectMention = (profile) => {
        if (mentionStart === null) return;
        const input = composerInputRef.current;
        const cursor = input?.selectionStart ?? newMessage.length;
        const label = getMentionLabel(profile);
        const nextMessage = `${newMessage.slice(0, mentionStart)}@${label} ${newMessage.slice(cursor)}`;

        setNewMessage(nextMessage);
        setSelectedMentions((prev) => ({
            ...prev,
            [profile.uid]: { uid: profile.uid, label }
        }));
        setMentionQuery(null);
        setMentionStart(null);

        requestAnimationFrame(() => {
            if (!composerInputRef.current) return;
            const nextCursor = mentionStart + label.length + 2;
            composerInputRef.current.focus();
            composerInputRef.current.setSelectionRange(nextCursor, nextCursor);
            composerInputRef.current.style.height = "auto";
            composerInputRef.current.style.height = `${composerInputRef.current.scrollHeight}px`;
        });
    };

    const handleLogout = async () => {
        await signOut(auth);
    };

    const mediaItems = messages.filter((message) => message.imageUrl || message.gifUrl);
    const linkItems = messages.flatMap((message) => {
        const matches = (message.text || "").match(/https?:\/\/[^\s]+/g) || [];
        return matches.map((rawUrl) => {
            const url = rawUrl.replace(/[),.;!?]+$/, "");
            try {
                return {
                    id: `${message.id}-${url}`,
                    url,
                    host: new URL(url).hostname,
                    sender: getChatDisplayName(message.senderId, message.senderInfo)
                };
            } catch {
                return null;
            }
        }).filter(Boolean);
    });

    const handleChatIconUpload = async (e) => {
        if (!selectedChat || !e.target.files?.[0]) return;

        const file = e.target.files[0];
        setIsUpdatingChatIcon(true);

        try {
            const imageRef = storageRef(storage, `chats/${selectedChat.id}/icon/${Date.now()}_${file.name}`);
            await uploadBytes(imageRef, file);
            const iconUrl = await getDownloadURL(imageRef);

            await update(ref(db, `chats/${selectedChat.id}/metadata`), { iconUrl });
            applyChatMetadataLocally(selectedChat.id, { iconUrl });
        } catch (error) {
            console.error("Failed to update chat icon", error);
            await notify("Failed to upload chat icon.", { title: "Icon Not Updated" });
        } finally {
            setIsUpdatingChatIcon(false);
            e.target.value = "";
        }
    };

    const handleLeaveChat = async () => {
        if (!selectedChat) return;
        const ok = await confirm("Leave this chat?", {
            title: "Leave Chat",
            confirmLabel: "Leave"
        });
        if (!ok) return;

        await remove(ref(db, `user_chats/${user.uid}/${selectedChat.id}`));
        await update(ref(db, `chats/${selectedChat.id}/metadata/members/${user.uid}`), null);
        setSelectedChat(null);
        setShowSettings(false);
    };

    return (
        <div className="chat-layout">
            {dialogNode}
            <nav className="main-nav">
	                <div className="main-nav__top">
	                    <button className={`nav-icon ${activeView === 'chats' ? 'active' : ''}`} onClick={() => setActiveView('chats')} title="Chats">
	                        <GalleryIcon name="chat" size={22} title="Chats" />
	                    </button>
	                    <button className={`nav-icon ${activeView === 'friends' ? 'active' : ''}`} onClick={() => setActiveView('friends')} title="Friends">
	                        <GalleryIcon name="friends" size={22} title="Friends" />
	                    </button>
	                </div>
                <div className="main-nav__bottom">
                    <button className="nav-icon profile-icon" onClick={() => navigate('/profile')} title="Profile">
                        {currentUserProfile.photoURL ? (
                            <img src={currentUserProfile.photoURL} alt="Profile" />
                        ) : (
                            <AbstractAvatar seed={user.uid || user.email} />
                        )}
                    </button>
                </div>
            </nav>

            {activeView === 'chats' ? (
                <>
                    <aside className="chat-sidebar">
                        <div className="chat-sidebar__header">
                            <h2>Chats</h2>
                            <button className="chat-sidebar__new-btn" onClick={() => setShowNewChatModal(true)}>
                                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="chat-sidebar__list">
                            {userChats.map(chat => (
                                <div 
                                    key={chat.id} 
                                    className={`chat-sidebar__item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                                    onClick={() => setSelectedChat(chat)}
                                >
                                    <div className="chat-sidebar__item-avatar">
                                        {renderChatIcon(chat, 40, "chat-icon chat-icon--sidebar")}
                                    </div>
                                    <div className="chat-sidebar__item-info">
                                        <span className="chat-sidebar__item-name">{getChatTitle(chat)}</span>
                                    </div>
                                </div>
                            ))}
                            {userChats.length === 0 && <div className="chat-sidebar__empty">No chats yet</div>}
                        </div>
                    </aside>

                    <main className="chat-main">
                        {selectedChat ? (
                            <div className="chat-room">
                                <header className="chat-room__header">
                            <div className="chat-room__title-wrap" style={{display: 'flex', alignItems: 'center'}}>
                                {renderChatIcon(selectedChat, 32, "chat-icon chat-icon--header")}
                                <h3>{getChatTitle(selectedChat)}</h3>
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
	                                <button className="settings-btn" onClick={() => setShowSettings(!showSettings)} style={{fontSize: '1.2rem', cursor: 'pointer', background: 'none', border: 'none'}} title="Conversation settings"><GalleryIcon name="settings" size={22} /></button>
                            </div>
                        </header>
                        <div ref={messagesContainerRef} className={`chat-room__messages ${editingMessageId ? "chat-room__messages--editing" : ""}`} style={{ position: 'relative', opacity: isChatReady ? 1 : 0, transition: 'opacity 0.2s ease-in' }}>
                            {pinnedMessages.length > 0 && (
	                                <div className="chat-room__pinned" style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f2e2c8', padding: '10px', borderRadius: '4px', marginBottom: '10px', boxShadow: '0 2px 4px rgba(47,36,29,0.1)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
	                                        <strong className="gallery-inline-title"><GalleryIcon name="pin" size={16} /> Pinned Message(s)</strong>
	                                        <button onClick={() => setShowAllPinned(!showAllPinned)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1rem', color: '#7a3324' }}>
	                                            <GalleryIcon name={showAllPinned ? "chevronUp" : "chevronDown"} size={18} />
                                        </button>
                                    </div>
                                    <div style={{ marginTop: '5px' }}>
                                        {(showAllPinned ? pinnedMessages : [pinnedMessages[0]]).map(pm => (
	                                            <div key={pm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: showAllPinned ? '1px solid rgba(184, 138, 80, 0.28)' : 'none', paddingTop: showAllPinned ? '5px' : 0, marginTop: showAllPinned ? '5px' : 0 }}>
                                                <div 
                                                    style={{ flex: 1, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                    onClick={() => scrollToMessage(pm.id)}
                                                >
                                                    <strong>{getChatDisplayName(pm.senderId, pm.senderInfo)}: </strong> 
                                                    {pm.text || '[Image]'}
                                                </div>
	                                                <button onClick={() => handleUnpinMessage(pm.id)} style={{ border: 'none', background: 'transparent', color: '#7a3324', cursor: 'pointer', fontSize: '0.8rem' }}>Unpin</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
	                            {filterMessagesByQuery(messages, searchQuery).map(msg => {
	                                const isMe = msg.senderId === user.uid;
	                                const isEditingTarget = editingMessageId === msg.id;
	                                const isDimmed = Boolean(editingMessageId) && !isEditingTarget;
	                                const isMentioned = isMentionForUser(msg);
	                                const reactionCounts = getReactionCounts(msg.reactions);
	                                const readers = Object.entries(readReceipts || {})
                                    .filter(([uid, msgId]) => msgId === msg.id && uid !== user.uid)
                                    .map(([uid]) => allUsers.find(u => u.uid === uid) || { uid, displayName: 'User', photoURL: null });

                                return (
                                    <div
                                        key={msg.id}
                                        id={`msg-${msg.id}`}
                                        data-msg-id={msg.id}
	                                        className={`message-row ${isMentioned ? "message-row--mentioned" : ""} ${isDimmed ? "message-row--dimmed" : ""} ${isEditingTarget ? "message-row--editing" : ""}`}
                                        style={{ display: 'flex', flexDirection: 'column' }}
                                    >
                                        <div className={`message ${isMe ? 'message--me' : 'message--other'}`}>
                                            {!isMe && (
                                                <div className="message__avatar">
                                                    {msg.senderInfo?.photoURL ? (
                                                        <img src={msg.senderInfo.photoURL} alt="avatar" />
                                                    ) : (
                                                        <AbstractAvatar seed={msg.senderId || msg.senderInfo?.email || msg.senderInfo?.displayName} />
                                                    )}
                                                </div>
                                            )}
                                            <div className="message__content">
                                                {!isMe && <span className="message__sender">{getChatDisplayName(msg.senderId, msg.senderInfo)}</span>}
                                                
                                                {/* Replied-to Box */}
                                                {msg.replyToId && (
                                                    <div 
                                                        className="message__replied-to box-reply" 
                                                        style={{ opacity: 0.8, fontSize: '0.8rem', padding: '5px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.05)', marginBottom: '4px', cursor: 'pointer', borderLeft: '3px solid #ccc' }}
                                                        onClick={() => scrollToMessage(msg.replyToId)}
                                                    >
                                                        <strong>{msg.replyToSender}: </strong>
                                                        <span>{msg.replyToText}</span>
                                                    </div>
                                                )}

	                                                <div className="message__bubble">
                                                    {msg.imageUrl && (
                                                        <img 
                                                            src={msg.imageUrl} 
                                                            alt="attached" 
                                                            className="message__image" 
                                                            onClick={() => setFullscreenImage(msg.imageUrl)}
                                                            style={{ cursor: 'pointer', maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                                                        />
                                                    )}
                                                    {msg.gifUrl && (
                                                        <a
                                                            className="message__gif-link"
                                                            href={msg.giphyUrl || msg.gifUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            title="Open on GIPHY"
                                                        >
                                                            <img
                                                                src={msg.gifUrl}
                                                                alt={msg.gifTitle || "GIPHY GIF"}
                                                                className="message__image message__gif"
                                                                style={{ cursor: 'pointer', maxWidth: '220px', maxHeight: '220px', objectFit: 'cover' }}
                                                            />
                                                            <span>GIPHY</span>
                                                        </a>
                                                    )}
	                                                    {msg.text && <p>{msg.text}</p>}
	                                                    {msg.isEdited && <small className="message__edited-tag">(edited)</small>}
	                                                    {isEditingTarget && <small className="message__edited-tag">Editing in composer...</small>}
	                                                </div>
	                                                {Object.keys(reactionCounts).length > 0 && (
	                                                    <div className="message__reaction-summary">
	                                                        {Object.entries(reactionCounts).map(([emoji, count]) => (
	                                                            <button
	                                                                key={emoji}
	                                                                type="button"
	                                                                className={msg.reactions?.[user.uid] === emoji ? "active" : ""}
	                                                                onClick={() => handleToggleReaction(msg, emoji)}
	                                                                title={msg.reactions?.[user.uid] === emoji ? "Remove reaction" : "React"}
	                                                            >
	                                                                <span>{emoji}</span>
	                                                                <small>{count}</small>
	                                                            </button>
	                                                        ))}
	                                                    </div>
	                                                )}
	                                                {!editingMessageId && (
	                                                    <div className="message__actions">
	                                                        <button onClick={() => handleReplyClick(msg)}>Reply</button>
                                                        {pinnedMessageIdSet.has(msg.id) ? (
                                                            <button onClick={() => handleUnpinMessage(msg.id)}>Unpin</button>
                                                        ) : (
                                                            <button onClick={() => handlePinMessage(msg)}>Pin</button>
                                                        )}
                                                        {isMe && (
                                                            <>
                                                                <button onClick={() => handleEditClick(msg)}>Edit</button>
                                                                <button onClick={() => handleDeleteMessage(msg.id)}>Unsend</button>
                                                            </>
                                                        )}
                                                        <div className="message__reaction-popover" aria-label="React to message">
                                                            <button type="button" className="message__reaction-trigger" title="React">
                                                                ☺
                                                            </button>
                                                            <div className="message__reaction-list">
                                                                {REACTION_OPTIONS.map((emoji) => (
                                                                    <button
                                                                        key={emoji}
                                                                        type="button"
                                                                        className={msg.reactions?.[user.uid] === emoji ? "active" : ""}
                                                                        onClick={() => handleToggleReaction(msg, emoji)}
                                                                        title={msg.reactions?.[user.uid] === emoji ? "Remove reaction" : `React ${emoji}`}
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Read Receipts Preview */}
                                        {readers.length > 0 && (
                                            <div className="message__read-receipts" style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', display: 'flex', gap: '3px', marginTop: '2px', marginRight: isMe ? '10px' : '0', marginLeft: isMe ? '0' : '46px' }}>
                                                {readers.map(r => (
                                                    r.photoURL ? (
                                                        <img key={r.uid} src={r.photoURL} alt={r.displayName} style={{ width: '14px', height: '14px', borderRadius: '50%' }} title={`Read by ${getChatDisplayName(r.uid, r)}`} />
                                                    ) : (
                                                        <span key={r.uid} className="message__read-receipt-avatar" title={`Read by ${getChatDisplayName(r.uid, r)}`}>
                                                            <AbstractAvatar seed={r.uid || r.email || r.displayName} />
                                                        </span>
                                                    )
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Reply Preview */}
                        {editingMessageId && (
	                            <div className="chat-room__reply-preview chat-room__reply-preview--editing" style={{ padding: '8px 12px', background: '#efe0c8', borderLeft: '4px solid #7a3324', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
	                                <div style={{ fontSize: '0.85rem', color: '#7a6a58' }}>
	                                    <strong style={{ display: 'block', color: '#2f241d' }}>Editing message</strong>
                                    <span>Press Enter or Send to save</span>
                                </div>
	                                <button type="button" onClick={handleCancelEdit} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#7a6a58' }} title="Cancel edit"><GalleryIcon name="close" size={18} /></button>
                            </div>
                        )}

                        {/* Reply Preview */}
                        {replyingTo && (
	                            <div className="chat-room__reply-preview" style={{ padding: '8px 12px', background: '#efe0c8', borderLeft: '4px solid #7a3324', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
	                                <div style={{ fontSize: '0.85rem', color: '#7a6a58' }}>
	                                    <strong style={{ display: 'block', color: '#2f241d' }}>Replying to {getChatDisplayName(replyingTo.senderId, replyingTo.senderInfo)}</strong>
                                    <span>{replyingTo.text || 'Image'}</span>
                                </div>
	                                <button type="button" onClick={() => setReplyingTo(null)} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#7a6a58' }} title="Cancel reply"><GalleryIcon name="close" size={18} /></button>
                            </div>
                        )}

	                        {showGifPicker && !editingMessageId && (
	                            <div className="chat-room__gif-panel">
                                <div className="chat-room__gif-header">
                                    <div className="chat-room__gif-search">
                                        <GalleryIcon name="gif" size={18} />
                                        <input
                                            type="search"
                                            placeholder="Search GIPHY..."
                                            value={gifQuery}
                                            onChange={(e) => setGifQuery(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <button type="button" onClick={() => setShowGifPicker(false)} title="Close GIF search">
                                        <GalleryIcon name="close" size={17} />
                                    </button>
                                </div>
                                <div className="chat-room__gif-grid">
                                    {gifLoading && <div className="chat-room__gif-status">Loading GIFs...</div>}
                                    {gifError && <div className="chat-room__gif-status chat-room__gif-status--error">{gifError}</div>}
                                    {!gifLoading && !gifError && gifResults.map((gif) => (
                                        <button
                                            key={gif.id}
                                            type="button"
                                            className="chat-room__gif-result"
                                            onClick={() => handleSendGif(gif)}
                                            title={gif.title}
                                        >
                                            <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
                                        </button>
                                    ))}
                                </div>
                                <div className="chat-room__gif-attribution">Powered by GIPHY</div>
	                            </div>
	                        )}

	                        {showEmojiPicker && (
	                            <div className="chat-room__emoji-panel">
	                                <div className="chat-room__emoji-header">
	                                    <span>Choose an emoji</span>
	                                    <button type="button" onClick={() => setShowEmojiPicker(false)} title="Close emoji picker">
	                                        <GalleryIcon name="close" size={17} />
	                                    </button>
	                                </div>
	                                <div className="chat-room__emoji-grid">
	                                    {EMOJI_PICKER_OPTIONS.map((emoji) => (
	                                        <button
	                                            key={emoji}
	                                            type="button"
	                                            onClick={() => insertEmoji(emoji)}
	                                            title={`Insert ${emoji}`}
	                                        >
	                                            {emoji}
	                                        </button>
	                                    ))}
	                                </div>
	                            </div>
	                        )}

	                        {mentionQuery !== null && getMentionSuggestions().length > 0 && (
	                            <div className="chat-room__mention-menu">
	                                {getMentionSuggestions().map((profile) => (
	                                    <button key={profile.uid} type="button" onClick={() => handleSelectMention(profile)}>
	                                        <span className="gallery-round-frame gallery-round-frame--mention">
	                                            {profile.isEveryone ? <GalleryIcon name="friends" size={15} /> : <AbstractAvatar seed={profile.uid || profile.email || getMentionLabel(profile)} />}
	                                        </span>
	                                        <span>{getUserDisplayName(profile)}</span>
	                                        <small>@{getMentionLabel(profile)}</small>
	                                    </button>
	                                ))}
	                            </div>
	                        )}

	                        <form className="chat-room__input-form" onSubmit={handleSendMessage}>
	                            <button
	                                type="button"
	                                className={`chat-room__emoji-btn ${showEmojiPicker ? "active" : ""}`}
	                                title="Insert emoji"
	                                onClick={() => {
	                                    setShowEmojiPicker((open) => !open);
	                                    setShowGifPicker(false);
	                                }}
	                            >
	                                <span>☺</span>
	                            </button>
	                            {!editingMessageId && (
	                                <button
                                    type="button"
                                    className={`chat-room__tool-btn ${showGifPicker ? "active" : ""}`}
                                    title="Search GIFs"
	                                    onClick={() => {
	                                        setShowGifPicker((open) => !open);
	                                        setShowEmojiPicker(false);
	                                        setImageFile(null);
	                                    }}
                                >
                                    <GalleryIcon name="gif" size={23} />
                                </button>
                            )}
                            {!editingMessageId && (
                                <label className="chat-room__upload-btn" title="Send image">
                                    <GalleryIcon name="attach" size={24} />
                                    <input 
                                        type="file" 
                                        name="imageFile" 
                                        accept="image/*" 
                                        style={{ display: 'none' }} 
                                        onChange={(e) => setImageFile(e.target.files[0])}
                                    />
                                </label>
                            )}
                            {imageFile && !editingMessageId && (
	                                <div className="chat-room__image-preview" style={{ padding: '0 10px', color: '#7a6a58', fontSize: '0.8rem' }}>
	                                    {imageFile.name} (File attached) <button type="button" onClick={() => setImageFile(null)} style={{border:'none', background:'none', color:'#7a3324', cursor:'pointer'}} title="Remove image"><GalleryIcon name="close" size={14} /></button>
                                </div>
                            )}
                            <textarea
                                ref={composerInputRef}
                                className="chat-room__composer"
                                placeholder={editingMessageId ? "Edit your message..." : "Type a message..."}
                                value={newMessage} 
                                onChange={handleInputResize}
                                onKeyDown={handleComposerKeyDown}
                                rows={1}
                            />
                            <button type="submit" disabled={!newMessage.trim() && !imageFile}>{editingMessageId ? "Save" : "Send"}</button>
                        </form>
                    </div>
                ) : (
                    <div className="chat-main__empty">
                        <p>Select a chat to start messaging</p>
                    </div>
                )}
            </main>

            {showSettings && selectedChat && (
                <aside className="chat-settings-panel">
                    {settingsView === 'main' ? (
                        <>
	                            <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid #d8c7ad' }}>
                                {renderChatIcon(selectedChat, 80, "chat-icon chat-icon--settings")}
	                                <h3 style={{ margin: '0 0 10px', wordBreak: 'break-all', color: '#2f241d' }}>{getChatTitle(selectedChat)}</h3>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
	                                    <button className="chat-settings-panel__notification-btn" onClick={cycleNotificationPreference}>
	                                        <div className="gallery-round-frame gallery-round-frame--control">
	                                            <GalleryIcon name={(notificationPrefs[selectedChat.id] || (mutedChats[selectedChat.id] ? "muted" : "all")) === "muted" ? "mutedBell" : "bell"} size={18} />
	                                        </div>
                                        <small>{(notificationPrefs[selectedChat.id] || (mutedChats[selectedChat.id] ? "muted" : "all")) === "all" ? "All" : (notificationPrefs[selectedChat.id] || (mutedChats[selectedChat.id] ? "muted" : "all")) === "mentions" ? "Mentions" : "Muted"}</small>
	                                    </button>
                                </div>
                            </div>

                            <div style={{ padding: '15px' }}>
                                <input 
                                    type="text" 
	                                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #d8c7ad', borderRadius: '20px', fontSize: '0.9rem' }}
                                    placeholder="Search in conversation..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto' }}>
	                                <details style={{ padding: '15px', borderBottom: '1px solid #d8c7ad' }} open>
	                                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#2f241d' }}>Custom Chat</summary>
                                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{display: 'flex', gap: '5px'}}>
                                            <input type="text" placeholder="New Name" value={newChatName} onChange={e => setNewChatName(e.target.value)} onKeyDown={handleRenameKeyDown} style={{padding: '4px', flex: 1, minWidth: 0}}/>
                                            <button onClick={handleRenameChat}>Rename</button>
                                        </div>
	                                        <button onClick={handleChangeChatIcon} disabled={isUpdatingChatIcon} style={{ textAlign: 'left', padding: '8px', background: '#fffaf1', border: '1px solid #d8c7ad', borderRadius: '4px', cursor: 'pointer', color: '#2f241d' }}>
                                            {isUpdatingChatIcon ? "Uploading icon..." : "Change Icon"}
                                        </button>
                                        <input
                                            ref={chatIconUploadRef}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={handleChatIconUpload}
                                        />
                                    </div>
                                </details>

	                                <details style={{ padding: '15px', borderBottom: '1px solid #d8c7ad' }}>
	                                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#2f241d' }}>Members</summary>
                                    <div style={{ marginTop: '10px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                                            {Object.keys(selectedChat.members || {}).map((uid) => {
                                                const memberInfo = getMemberInfo(uid);
                                                const displayName = getChatDisplayName(uid, memberInfo);
                                                const baseName = getUserDisplayName(memberInfo);
                                                const hasNickname = Boolean(selectedChat?.nicknames?.[uid]);
                                                const isEditingThis = editingNicknameUid === uid;

                                                return (
                                                    <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div className="gallery-round-frame gallery-round-frame--member" style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#efe0c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#7a3324' }}>
                                                            {memberInfo.photoURL ? (
                                                                <img src={memberInfo.photoURL} alt={baseName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <AbstractAvatar seed={uid || memberInfo.email || baseName} />
                                                            )}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            {isEditingThis ? (
                                                                <div style={{ display: 'flex', gap: '5px', width: '100%' }}>
                                                                    <input
                                                                        type="text"
                                                                        value={singleNicknameDraft}
                                                                        placeholder={baseName}
                                                                        onChange={(e) => setSingleNicknameDraft(e.target.value)}
                                                                        onKeyDown={(e) => handleNicknameKeyDown(e, uid)}
                                                                        autoFocus
                                                                        style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '4px 6px', border: '1px solid #d8c7ad', borderRadius: '4px' }}
                                                                    />
	                                                                    <button className="gallery-icon-button gallery-icon-button--solid" onClick={() => saveSingleNickname(uid)} style={{ border: 'none', background: '#7a3324', color: 'white', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }} title="Save nickname"><GalleryIcon name="check" size={16} /></button>
	                                                                    <button className="gallery-icon-button" onClick={cancelEditSingleNickname} style={{ border: '1px solid #d8c7ad', background: 'white', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }} title="Cancel"><GalleryIcon name="close" size={16} /></button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div style={{ minWidth: 0 }}>
	                                                                        <div style={{ fontWeight: 600, color: '#2f241d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                                                                        {hasNickname && displayName !== baseName && (
	                                                                            <small style={{ color: '#7a6a58' }}>{baseName}</small>
                                                                        )}
                                                                    </div>
                                                                    <button 
                                                                        onClick={() => startEditSingleNickname(uid, selectedChat?.nicknames?.[uid])}
	                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#7a3324', padding: '4px', flexShrink: 0 }}
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
	                                        <button onClick={() => setShowAddMember(true)} style={{ width: '100%', padding: '8px', background: '#efe0c8', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px' }}>+ Add member</button>
	                                        <small style={{ color: '#2f241d' }}>{Object.keys(selectedChat.members || {}).length} members</small>
                                    </div>
                                </details>

	                                <details style={{ padding: '15px', borderBottom: '1px solid #d8c7ad' }}>
	                                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#2f241d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={(e) => { e.preventDefault(); setSettingsView('media'); }}>
                                        <span>Media, Files & Links</span>
	                                        <GalleryIcon name="chevronRight" size={17} />
                                    </summary>
                                </details>

                                <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
	                                    <button style={{ color: '#7a3324', width: '100%', padding: '10px', background: '#fff2ea', border: '1px solid currentColor', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }} onClick={handleLeaveChat}><GalleryIcon name="leave" size={17} /> Leave Chat</button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="chat-media-panel">
	                            <div className="chat-media-panel__header">
	                                <button onClick={() => setSettingsView('main')} title="Back"><GalleryIcon name="chevronLeft" size={22} /></button>
                                <div>
                                    <h3>Media, Files & Links</h3>
                                    <span>{mediaItems.length} media · {linkItems.length} links</span>
                                </div>
                            </div>
                            <div className="chat-media-panel__body">
                                <section className="chat-media-panel__section">
                                    <div className="chat-media-panel__section-title">
                                        <span>Media</span>
                                        <small>{mediaItems.length}</small>
                                    </div>
                                    {mediaItems.length > 0 ? (
                                        <div className="chat-media-panel__grid">
                                            {mediaItems.map((m) => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    className="chat-media-panel__tile"
                                                    onClick={() => m.imageUrl ? setFullscreenImage(m.imageUrl) : window.open(m.giphyUrl || m.gifUrl, "_blank", "noopener,noreferrer")}
                                                >
                                                    <img src={m.imageUrl || m.gifUrl} alt={m.gifTitle || "media"} />
                                                    {m.gifUrl && <span>GIF</span>}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="chat-media-panel__empty">No shared media yet.</div>
                                    )}
                                </section>

                                <section className="chat-media-panel__section">
                                    <div className="chat-media-panel__section-title">
                                        <span>Links</span>
                                        <small>{linkItems.length}</small>
                                    </div>
                                    {linkItems.length > 0 ? (
                                        <div className="chat-media-panel__links">
                                            {linkItems.map((link) => (
                                                <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
                                                    <span>{link.host}</span>
                                                    <small>{link.sender}</small>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="chat-media-panel__empty">No links shared yet.</div>
                                    )}
                                </section>

                                <section className="chat-media-panel__section">
                                    <div className="chat-media-panel__section-title">
                                        <span>Files</span>
                                        <small>0</small>
                                    </div>
                                    <div className="chat-media-panel__empty">No shared files yet.</div>
                                </section>
                            </div>
                        </div>
                    )}
                </aside>
            )}

            {showNewChatModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Create New Chat</h3>
                        {selectedUsers.length > 1 && (
                            <input 
                                type="text" 
                                placeholder="Group Name (Optional)" 
                                value={newGroupName} 
                                onChange={e => setNewGroupName(e.target.value)} 
                                onKeyDown={handleCreateChatKeyDown}
                                style={{ width: '100%', marginBottom: '10px', padding: '8px', boxSizing: 'border-box' }}
                            />
                        )}
                        <div className="modal__user-list">
                            {Object.keys(friends).map(uid => {
                                const u = allUsers.find(user => user.uid === uid);
                                if (!u) return null;
                                return (
                                    <label key={u.uid} className="modal__user-item">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedUsers.includes(u.uid)} 
                                            onChange={() => toggleUserSelection(u.uid)} 
                                        />
                                        {u.displayName || u.email}
                                    </label>
                                );
                            })}
                            {Object.keys(friends).length === 0 && (
                                <div style={{padding: '20px 10px', color: '#666', textAlign: 'center'}}>
                                    <p style={{margin: '0 0 15px 0'}}>No friends yet. Add some friends first!</p>
                                    <button 
                                        onClick={() => { setShowNewChatModal(false); setActiveView('friends'); }}
	                                        style={{ padding: '8px 16px', background: '#7a3324', color: '#fffaf1', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Go to Friends List
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="modal__actions">
                            <button onClick={() => { setShowNewChatModal(false); setNewGroupName(""); setSelectedUsers([]); }}>Cancel</button>
                            {Object.keys(friends).length > 0 && (
                                <button className="primary" onClick={handleCreateChat} disabled={selectedUsers.length === 0}>Create</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showAddMember && (
                <div className="modal-overlay">
	                    <div className="modal" style={{background: '#fffaf1', padding: '20px', borderRadius: '8px', minWidth: '300px'}}>
                        <h3>Add Members</h3>
                        <div className="modal__user-list" style={{maxHeight: '200px', overflowY: 'auto', marginBottom: '15px'}}>
                            {Object.keys(friends).filter(uid => !(selectedChat?.members?.[uid])).map(uid => {
                                const u = allUsers.find(user => user.uid === uid);
                                if (!u) return null;
                                return (
                                    <label key={u.uid} className="modal__user-item" style={{display: 'flex', gap: '8px', padding: '4px 0'}}>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedUsers.includes(u.uid)} 
                                            onChange={() => toggleUserSelection(u.uid)} 
                                        />
                                        {u.displayName || u.email}
                                    </label>
                                );
                            })}
	                            {Object.keys(friends).filter(uid => !(selectedChat?.members?.[uid])).length === 0 && <div style={{padding: '10px', color: '#7a6a58'}}>All friends are already in this chat.</div>}
                        </div>
                        <div className="modal__actions" style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                            <button onClick={() => { setShowAddMember(false); setSelectedUsers([]); }}>Cancel</button>
                            <button className="primary" onClick={() => {
                                const updates = {};
                                selectedUsers.forEach(uid => {
                                    updates[`user_chats/${uid}/${selectedChat.id}`] = true;
                                    updates[`chats/${selectedChat.id}/metadata/members/${uid}`] = true;
                                });
                                update(ref(db), updates);
                                setShowAddMember(false);
                                setSelectedUsers([]);
	                            }} disabled={selectedUsers.length === 0} style={{background: '#7a3324', color: '#fffaf1', border: 'none', padding: '5px 15px', borderRadius: '4px'}}>
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </>
            ) : null}
            
            {/* Friends View */}
            {activeView === 'friends' && (
	                <main className="friends-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f4efe7', padding: '20px', overflowY: 'auto' }}>
                    <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
	                        <h2 style={{ marginBottom: '20px', color: '#2f241d' }}>Friends</h2>
                        
	                        <div className="card" style={{ background: '#fffaf1', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(47,36,29,0.1)', marginBottom: '20px' }}>
	                            <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#2f241d' }}>Add Friend</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input 
                                    type="email" 
                                    placeholder="Enter user email..." 
                                    value={addFriendEmail}
                                    onChange={e => setAddFriendEmail(e.target.value)}
                                    onKeyDown={handleAddFriendKeyDown}
	                                    style={{ flex: 1, padding: '10px', border: '1px solid #d8c7ad', borderRadius: '4px' }}
                                />
	                                <button onClick={handleAddFriend} style={{ padding: '10px 20px', background: '#7a3324', color: '#fffaf1', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
                            </div>
                        </div>

	                        <div className="card" style={{ background: '#fffaf1', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(47,36,29,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
	                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#2f241d' }}>My Friends ({Object.keys(friends).length})</h3>
                                <input 
                                    type="text" 
                                    placeholder="Search friends..." 
                                    value={friendSearchQuery}
                                    onChange={e => setFriendSearchQuery(e.target.value)}
	                                    style={{ padding: '8px', border: '1px solid #d8c7ad', borderRadius: '4px' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {Object.keys(friends)
                                    .map(uid => allUsers.find(u => u.uid === uid))
                                    .filter(Boolean)
                                    .filter(u => (u.displayName || u.email).toLowerCase().includes(friendSearchQuery.toLowerCase()))
                                    .map(friend => {
                                        // Calculate mutual chats
                                        const mutualChatsCount = userChats.filter(chat => chat.members && chat.members[friend.uid] && !chat.isDirect).length;
                                        
                                        return (
                                            <div key={friend.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', border: '1px solid #f1f3f4', borderRadius: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div className="gallery-round-frame gallery-round-frame--friend" style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#efe0c8', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a3324', fontWeight: 600 }}>
                                                        {friend.photoURL ? (
                                                            <img src={friend.photoURL} alt={friend.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <AbstractAvatar seed={friend.uid || friend.email || friend.displayName} />
                                                        )}
                                                    </div>
                                                    <div>
	                                                        <div style={{ fontWeight: 500, color: '#2f241d' }}>{friend.displayName || friend.email}</div>
	                                                        <div style={{ fontSize: '0.8rem', color: '#7a6a58' }}>
                                                            {mutualChatsCount > 0 ? `${mutualChatsCount} mutual group(s)` : 'No mutual groups'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button 
                                                        onClick={() => openDirectChat(friend.uid)}
	                                                        style={{ padding: '8px 16px', background: '#efe0c8', color: '#7a3324', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                                                    >
                                                        Chat
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteFriend(friend.uid, friend.displayName || friend.email)}
	                                                        style={{ padding: '8px 16px', background: '#fff2ea', color: '#7a3324', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                })}
	                                {Object.keys(friends).length === 0 && <div style={{ textAlign: 'center', color: '#7a6a58', padding: '20px 0' }}>No friends added yet.</div>}
                            </div>
                        </div>
                    </div>
                </main>
            )}

            {/* Fullscreen Image Modal */}
            {fullScreenImage && (
                <div 
                    className="fullscreen-image-overlay" 
                    onClick={() => setFullscreenImage(null)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'zoom-out' }}
                >
                    <img 
                        src={fullScreenImage} 
                        alt="fullscreen" 
                        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} 
                    />
                    <button 
                        className="fullscreen-close-btn"
                        onClick={() => setFullscreenImage(null)}
                        style={{ position: 'absolute', top: '20px', right: '30px', background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer' }}
                    >
	                        <GalleryIcon name="close" size={30} />
                    </button>
                </div>
            )}
        </div>
    );
}

export default Chat;
