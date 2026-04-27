import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { db, storage } from "../config.js";
import { ref, onValue, push, set, serverTimestamp, get, update, remove } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../config.js";
import "../styles/chat.scss";

function Chat() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [userChats, setUserChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [allUsers, setAllUsers] = useState([]);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState([]);
    
    const [searchQuery, setSearchQuery] = useState("");
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editMessageText, setEditMessageText] = useState("");
    const [readReceipts, setReadReceipts] = useState({});

    const [showSettings, setShowSettings] = useState(false);
    const [settingsView, setSettingsView] = useState('main');
    const [showAddMember, setShowAddMember] = useState(false);
    const [newChatName, setNewChatName] = useState("");
    const [mutedChats, setMutedChats] = useState({});
    
    const [pinnedMessages, setPinnedMessages] = useState([]);
    const [showAllPinned, setShowAllPinned] = useState(false);

    const [imageFile, setImageFile] = useState(null);
    const [fullScreenImage, setFullscreenImage] = useState(null);
    
    const [replyingTo, setReplyingTo] = useState(null);
    const [lastReadMsgId, setLastReadMsgId] = useState(null);

    const messagesEndRef = useRef(null);
    const messageListRef = useRef(null);
    const previousMessagesLength = useRef(0);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    
    // Request notification permission
    useEffect(() => {
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }, []);

    // Load user's chats
    useEffect(() => {
        if (!user) return;
        const userChatsRef = ref(db, `user_chats/${user.uid}`);
        const unsubscribe = onValue(userChatsRef, async (snapshot) => {
            if (snapshot.exists()) {
                const chatIds = Object.keys(snapshot.val());
                // Fetch details for each chat
                const chatDataPromises = chatIds.map(async (chatId) => {
                    const chatSnapshot = await get(ref(db, `chats/${chatId}/metadata`));
                    return { id: chatId, ...chatSnapshot.val() };
                });
                const chats = await Promise.all(chatDataPromises);
                setUserChats(chats);
            } else {
                setUserChats([]);
            }
        });
        return () => unsubscribe();
    }, [user]);

    // Load available users for new chat
    useEffect(() => {
        const usersRef = ref(db, `users`);
        onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const usersData = [];
                snapshot.forEach((childSnapshot) => {
                    const data = childSnapshot.val();
                    if (data.uid !== user?.uid) {
                        usersData.push(data);
                    }
                });
                setAllUsers(usersData);
            }
        }, { onlyOnce: true });
    }, [user]);

    // Listen to selected chat messages
    useEffect(() => {
        if (!selectedChat) {
            setMessages([]);
            setPinnedMessages([]);
            previousMessagesLength.current = 0;
            return;
        }
        const messagesRef = ref(db, `chats/${selectedChat.id}/messages`);
        const receiptsRef = ref(db, `chats/${selectedChat.id}/readReceipts`);
        const pinnedRef = ref(db, `chats/${selectedChat.id}/pinnedMessages`);
        
        let unsubscribeMsgs = () => {};
        
        const initChat = async () => {
            setIsInitialLoad(true);
            previousMessagesLength.current = 0;

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

                    const resolvedMsgs = await Promise.all(messagePromises);
                    
                    if (resolvedMsgs.length > previousMessagesLength.current) {
                        const newMsgs = resolvedMsgs.slice(previousMessagesLength.current);
                        newMsgs.forEach(m => {
                            if (m.senderId !== user.uid && document.hidden && !mutedChats[selectedChat.id]) {
                                if (Notification.permission === "granted") {
                                    new Notification(`New message from ${m.senderInfo?.displayName || 'User'}`, {
                                        body: m.text || "Sent an image",
                                        icon: m.senderInfo?.photoURL || '/react.svg'
                                    });
                                } else if (Notification.permission !== "denied") {
                                    Notification.requestPermission().then(permission => {
                                        if (permission === 'granted') {
                                            new Notification(`New message from ${m.senderInfo?.displayName || 'User'}`, {
                                                body: m.text || "Sent an image",
                                                icon: m.senderInfo?.photoURL || '/react.svg'
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    }
                    
                    previousMessagesLength.current = resolvedMsgs.length;
                    setMessages(resolvedMsgs);
                } else {
                    setMessages([]);
                    previousMessagesLength.current = 0;
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
    }, [selectedChat, user.uid, mutedChats]);

    // Handle scroll and delayed read receipts
    useEffect(() => {
        if (messages.length === 0 || !selectedChat) return;

        if (isInitialLoad) {
            setTimeout(() => {
                if (lastReadMsgId) {
                    const lastReadIdx = messages.findIndex(m => m.id === lastReadMsgId);
                    if (lastReadIdx !== -1 && lastReadIdx + 1 < messages.length) {
                        const targetId = messages[lastReadIdx + 1].id;
                        const elem = document.getElementById(`msg-${targetId}`);
                        if (elem) elem.scrollIntoView({ behavior: "smooth", block: "center" });
                        else scrollToBottom();
                    } else {
                        scrollToBottom();
                    }
                } else {
                    scrollToBottom();
                }
                setIsInitialLoad(false);
            }, 300);
        } else {
            // Not initial load, just scroll to bottom for new messages
            // Actually, we should only scroll if we were already near bottom, but let's keep it simple
            if (messages[messages.length - 1].senderId === user.uid) {
                scrollToBottom();
            }
        }

        // Delayed update read receipt
        const timer = setTimeout(() => {
            if (document.hasFocus()) {
                const lastMsgId = messages[messages.length - 1].id;
                update(ref(db, `chats/${selectedChat.id}/readReceipts`), {
                    [user.uid]: lastMsgId
                });
            }
        }, 1500); // 1.5 seconds delay

        return () => clearTimeout(timer);
    }, [messages, isInitialLoad, lastReadMsgId, selectedChat, user.uid]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() && !imageFile) return;
        if (!selectedChat) return;

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
                alert("Failed to upload image. Please check your Firebase Storage rules.");
                return;
            }
        }

        const msgData = {
            senderId: user.uid,
            text: newMessage || "",
            timestamp: serverTimestamp()
        };

        if (imageUrl) {
            msgData.imageUrl = imageUrl;
        }

        if (replyingTo) {
            msgData.replyToId = replyingTo.id;
            msgData.replyToText = replyingTo.text || "Image";
            msgData.replyToSender = replyingTo.senderInfo?.displayName || replyingTo.senderInfo?.email || "User";
        }

        await set(newMsgRef, msgData);

        setNewMessage("");
        setImageFile(null);
        setReplyingTo(null);
    };

    const handleReplyClick = (msg) => {
        setReplyingTo(msg);
        document.querySelector('.chat-room__input-form input[type="text"]')?.focus();
    };

    const scrollToMessage = (msgId) => {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('highlight-message');
            setTimeout(() => {
                el.classList.remove('highlight-message');
            }, 2000);
        }
    };

    const handleDeleteMessage = async (msgId) => {
        if (!window.confirm("Are you sure you want to unsend this message?")) return;
        await remove(ref(db, `chats/${selectedChat.id}/messages/${msgId}`));
    };

    const handleEditClick = (msg) => {
        setEditingMessageId(msg.id);
        setEditMessageText(msg.text || "");
    };

    const handleSaveEdit = async () => {
        if (!editMessageText.trim()) return;
        await update(ref(db, `chats/${selectedChat.id}/messages/${editingMessageId}`), {
            text: editMessageText,
            isEdited: true
        });
        setEditingMessageId(null);
        setEditMessageText("");
    };

    const handleCancelEdit = () => {
        setEditingMessageId(null);
        setEditMessageText("");
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

    const handleCreateChat = async () => {
        if (selectedUsers.length === 0) return;

        const chatMembers = { [user.uid]: true };
        selectedUsers.forEach(uid => { chatMembers[uid] = true; });

        const chatsRef = ref(db, `chats`);
        const newChatRef = push(chatsRef);
        
        const memberNames = allUsers.filter(u => selectedUsers.includes(u.uid)).map(u => u.displayName || u.email.split('@')[0]).join(', ');
        const chatName = `Group with ${memberNames}`;

        await set(newChatRef, {
            metadata: {
                name: chatName,
                members: chatMembers,
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

    return (
        <div className="chat-layout">
            <aside className="chat-sidebar">
                <div className="chat-sidebar__header">
                    <h2>Chats</h2>
                    <button className="chat-sidebar__new-btn" onClick={() => setShowNewChatModal(true)}>+</button>
                </div>
                <div className="chat-sidebar__list">
                    {userChats.map(chat => (
                        <div 
                            key={chat.id} 
                            className={`chat-sidebar__item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                            onClick={() => setSelectedChat(chat)}
                        >
                            <div className="chat-sidebar__item-avatar">
                                {chat.name?.[0]?.toUpperCase() || '#'}
                            </div>
                            <div className="chat-sidebar__item-info">
                                <span className="chat-sidebar__item-name">{chat.name}</span>
                            </div>
                        </div>
                    ))}
                    {userChats.length === 0 && <div className="chat-sidebar__empty">No chats yet</div>}
                </div>
                <div className="chat-sidebar__user">
                    <button onClick={() => navigate('/profile')}>Profile</button>
                    <button onClick={() => signOut(auth)}>Log Out</button>
                </div>
            </aside>

            <main className="chat-main">
                {selectedChat ? (
                    <div className="chat-room">
                        <header className="chat-room__header">
                            <div style={{display: 'flex', alignItems: 'center'}}>
                                {selectedChat?.iconUrl ? (
                                    <img src={selectedChat.iconUrl} alt="icon" style={{width: 32, height: 32, borderRadius: '50%', marginRight: 10}} />
                                ) : (
                                    <div style={{width: 32, height: 32, borderRadius: '50%', marginRight: 10, background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>#</div>
                                )}
                                <h3>{selectedChat.name}</h3>
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                <button className="settings-btn" onClick={() => setShowSettings(!showSettings)} style={{fontSize: '1.2rem', cursor: 'pointer', background: 'none', border: 'none'}}>⚙️</button>
                            </div>
                        </header>
                        <div className="chat-room__messages" style={{ position: 'relative' }}>
                            {pinnedMessages.length > 0 && (
                                <div className="chat-room__pinned" style={{ position: 'sticky', top: 0, zIndex: 5, background: '#fef3c7', padding: '10px', borderRadius: '4px', marginBottom: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                        <strong style={{ color: '#b45309' }}>📌 Pinned Message(s)</strong>
                                        <button onClick={() => setShowAllPinned(!showAllPinned)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1rem', color: '#b45309' }}>
                                            {showAllPinned ? '▲' : '▼'}
                                        </button>
                                    </div>
                                    <div style={{ marginTop: '5px' }}>
                                        {(showAllPinned ? pinnedMessages : [pinnedMessages[0]]).map(pm => (
                                            <div key={pm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: showAllPinned ? '1px solid rgba(180, 83, 9, 0.2)' : 'none', paddingTop: showAllPinned ? '5px' : 0, marginTop: showAllPinned ? '5px' : 0 }}>
                                                <div 
                                                    style={{ flex: 1, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                    onClick={() => scrollToMessage(pm.id)}
                                                >
                                                    <strong>{pm.senderInfo?.displayName || 'User'}: </strong> 
                                                    {pm.text || '[Image]'}
                                                </div>
                                                <button onClick={() => handleUnpinMessage(pm.id)} style={{ border: 'none', background: 'transparent', color: '#d97706', cursor: 'pointer', fontSize: '0.8rem' }}>Unpin</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {messages.filter(msg => msg.text?.toLowerCase().includes(searchQuery.toLowerCase())).map(msg => {
                                const isMe = msg.senderId === user.uid;
                                const isEditing = editingMessageId === msg.id;
                                const readers = Object.entries(readReceipts || {})
                                    .filter(([uid, msgId]) => msgId === msg.id && uid !== user.uid)
                                    .map(([uid]) => allUsers.find(u => u.uid === uid) || { uid, displayName: 'User', photoURL: null });

                                return (
                                    <div key={msg.id} id={`msg-${msg.id}`} style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div className={`message ${isMe ? 'message--me' : 'message--other'}`}>
                                            {!isMe && (
                                                <div className="message__avatar">
                                                    {msg.senderInfo?.photoURL ? (
                                                        <img src={msg.senderInfo.photoURL} alt="avatar" />
                                                    ) : (
                                                        <span>{(msg.senderInfo?.displayName || '?')[0].toUpperCase()}</span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="message__content">
                                                {!isMe && <span className="message__sender">{msg.senderInfo?.displayName || msg.senderInfo?.email}</span>}
                                                
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
                                                    {isEditing ? (
                                                        <div className="message__edit-form">
                                                            <input 
                                                                type="text" 
                                                                value={editMessageText} 
                                                                onChange={e => setEditMessageText(e.target.value)}
                                                                autoFocus
                                                            />
                                                            <button onClick={handleSaveEdit}>Save</button>
                                                            <button onClick={handleCancelEdit}>Cancel</button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {msg.imageUrl && (
                                                                <img 
                                                                    src={msg.imageUrl} 
                                                                    alt="attached" 
                                                                    className="message__image" 
                                                                    onClick={() => setFullscreenImage(msg.imageUrl)}
                                                                    style={{ cursor: 'pointer', maxWidth: '200px', maxHeight: '200px', objectFit: 'cover' }}
                                                                />
                                                            )}
                                                            {msg.text && <p>{msg.text}</p>}
                                                            {msg.isEdited && <small className="message__edited-tag">(edited)</small>}
                                                        </>
                                                    )}
                                                </div>
                                                {isMe && !isEditing && (
                                                    <div className="message__actions">
                                                        <button onClick={() => handleEditClick(msg)}>Edit</button>
                                                        <button onClick={() => handleDeleteMessage(msg.id)}>Unsend</button>
                                                        <button onClick={() => handlePinMessage(msg)}>Pin</button>
                                                    </div>
                                                )}
                                                {!isMe && !isEditing && (
                                                    <div className="message__actions">
                                                        <button onClick={() => handlePinMessage(msg)}>Pin</button>
                                                    </div>
                                                )}
                                                {/* Allow anyone to reply */}
                                                {!isEditing && (
                                                    <div className="message__actions message__actions--reply" style={{ marginTop: '2px' }}>
                                                        <button style={{ marginLeft: isMe ? 0 : '8px', color: '#666', border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px' }} onClick={() => handleReplyClick(msg)}>Reply</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Reply Preview */}
                                        {readers.length > 0 && isMe && (
                                            <div className="message__read-receipts" style={{ alignSelf: 'flex-end', display: 'flex', gap: '3px', marginTop: '2px', marginRight: '10px' }}>
                                                {readers.map(r => (
                                                    <img key={r.uid} src={r.photoURL || `https://ui-avatars.com/api/?name=${r.displayName}&size=14&background=random`} alt={r.displayName} style={{ width: '14px', height: '14px', borderRadius: '50%' }} title={`Read by ${r.displayName}`} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                        
                        {/* Reply Preview */}
                        {replyingTo && (
                            <div className="chat-room__reply-preview" style={{ padding: '8px 12px', background: '#f0f0f0', borderLeft: '4px solid #007bff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: '#555' }}>
                                    <strong style={{ display: 'block', color: '#333' }}>Replying to {replyingTo.senderInfo?.displayName || replyingTo.senderInfo?.email || 'User'}</strong>
                                    <span>{replyingTo.text || 'Image'}</span>
                                </div>
                                <button type="button" onClick={() => setReplyingTo(null)} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#888' }}>&times;</button>
                            </div>
                        )}

                        <form className="chat-room__input-form" onSubmit={handleSendMessage}>
                            <label className="chat-room__upload-btn" title="Send image">
                                📎
                                <input 
                                    type="file" 
                                    name="imageFile" 
                                    accept="image/*" 
                                    style={{ display: 'none' }} 
                                    onChange={(e) => setImageFile(e.target.files[0])}
                                />
                            </label>
                            {imageFile && (
                                <div className="chat-room__image-preview" style={{ padding: '0 10px', color: 'blue', fontSize: '0.8rem' }}>
                                    {imageFile.name} (File attached) <button type="button" onClick={() => setImageFile(null)} style={{border:'none', background:'none', color:'red', cursor:'pointer'}}>&times;</button>
                                </div>
                            )}
                            <input 
                                type="text" 
                                placeholder="Type a message..." 
                                value={newMessage} 
                                onChange={e => setNewMessage(e.target.value)} 
                            />
                            <button type="submit" disabled={!newMessage.trim() && !imageFile}>Send</button>
                        </form>
                    </div>
                ) : (
                    <div className="chat-main__empty">
                        <p>Select a chat to start messaging</p>
                    </div>
                )}
            </main>

            {showSettings && selectedChat && (
                <aside className="chat-right-sidebar" style={{ width: '320px', background: 'white', borderLeft: '1px solid #dadce0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    {settingsView === 'main' ? (
                        <>
                            <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid #dadce0' }}>
                                {selectedChat?.iconUrl ? (
                                    <img src={selectedChat.iconUrl} alt="icon" style={{ width: 80, height: 80, borderRadius: '50%', marginBottom: 10, objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 10px', background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>#</div>
                                )}
                                <h3 style={{ margin: '0 0 10px', wordBreak: 'break-all' }}>{selectedChat.name}</h3>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#5f6368' }} onClick={() => {
                                        const newMuted = { ...mutedChats, [selectedChat.id]: !mutedChats[selectedChat.id] };
                                        setMutedChats(newMuted);
                                        localStorage.setItem('mutedChats', JSON.stringify(newMuted));
                                    }}>
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                                            {mutedChats[selectedChat.id] ? '🔕' : '🔔'}
                                        </div>
                                        <small>{mutedChats[selectedChat.id] ? 'Unmute' : 'Mute'}</small>
                                    </button>
                                </div>
                            </div>

                            <div style={{ padding: '15px' }}>
                                <input 
                                    type="text" 
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #dadce0', borderRadius: '20px', fontSize: '0.9rem' }}
                                    placeholder="Search in conversation..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                <details style={{ padding: '15px', borderBottom: '1px solid #eee' }} open>
                                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Custom Chat</summary>
                                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{display: 'flex', gap: '5px'}}>
                                            <input type="text" placeholder="New Name" value={newChatName} onChange={e => setNewChatName(e.target.value)} style={{padding: '4px', flex: 1, minWidth: 0}}/>
                                            <button onClick={() => { if(newChatName){ update(ref(db, `chats/${selectedChat.id}/metadata`), {name: newChatName}); setNewChatName(''); } }}>Rename</button>
                                        </div>
                                        <button onClick={() => {
                                            const url = prompt("Enter new icon URL:");
                                            if (url) update(ref(db, `chats/${selectedChat.id}/metadata`), {iconUrl: url});
                                        }} style={{ textAlign: 'left', padding: '8px', background: '#f8f9fa', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Change Icon</button>
                                        <button onClick={() => alert('Editing nickname feature here')} style={{ textAlign: 'left', padding: '8px', background: '#f8f9fa', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Edit Nicknames</button>
                                    </div>
                                </details>

                                <details style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Members</summary>
                                    <div style={{ marginTop: '10px' }}>
                                        <button onClick={() => setShowAddMember(true)} style={{ width: '100%', padding: '8px', background: '#e8eaed', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '10px' }}>+ Add member</button>
                                        {/* Member list simplified */}
                                        <small style={{ color: '#666' }}>{Object.keys(selectedChat.members || {}).length} members</small>
                                    </div>
                                </details>

                                <details style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={(e) => { e.preventDefault(); setSettingsView('media'); }}>
                                        <span>Media, Files & Links</span>
                                        <span>▶</span>
                                    </summary>
                                </details>

                                <div style={{ padding: '15px' }}>
                                    <button style={{ color: 'red', width: '100%', padding: '10px', background: 'none', border: '1px solid currentColor', borderRadius: '4px', cursor: 'pointer', textAlign: 'left' }} onClick={() => {
                                        if(window.confirm("Leave this chat?")){
                                            remove(ref(db, `user_chats/${user.uid}/${selectedChat.id}`));
                                            update(ref(db, `chats/${selectedChat.id}/metadata/members/${user.uid}`), null);
                                            setSelectedChat(null);
                                            setShowSettings(false);
                                        }
                                    }}>🚪 Leave Chat</button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ padding: '15px', borderBottom: '1px solid #dadce0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button onClick={() => setSettingsView('main')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>◀</button>
                                <h3 style={{ margin: 0 }}>Media</h3>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                                {messages.filter(m => m.imageUrl).map(m => (
                                    <img key={m.id} src={m.imageUrl} alt="media" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setFullscreenImage(m.imageUrl)} />
                                ))}
                            </div>
                        </div>
                    )}
                </aside>
            )}

            {showNewChatModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Create New Chat</h3>
                        <div className="modal__user-list">
                            {allUsers.map(u => (
                                <label key={u.uid} className="modal__user-item">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedUsers.includes(u.uid)} 
                                        onChange={() => toggleUserSelection(u.uid)} 
                                    />
                                    {u.displayName || u.email}
                                </label>
                            ))}
                        </div>
                        <div className="modal__actions">
                            <button onClick={() => setShowNewChatModal(false)}>Cancel</button>
                            <button className="primary" onClick={handleCreateChat} disabled={selectedUsers.length === 0}>Create</button>
                        </div>
                    </div>
                </div>
            )}

            {showAddMember && (
                <div className="modal-overlay">
                    <div className="modal" style={{background: 'white', padding: '20px', borderRadius: '8px', minWidth: '300px'}}>
                        <h3>Add Members</h3>
                        <div className="modal__user-list" style={{maxHeight: '200px', overflowY: 'auto', marginBottom: '15px'}}>
                            {allUsers.filter(u => !(selectedChat?.members?.[u.uid])).map(u => (
                                <label key={u.uid} className="modal__user-item" style={{display: 'flex', gap: '8px', padding: '4px 0'}}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedUsers.includes(u.uid)} 
                                        onChange={() => toggleUserSelection(u.uid)} 
                                    />
                                    {u.displayName || u.email}
                                </label>
                            ))}
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
                            }} disabled={selectedUsers.length === 0} style={{background: '#0b57d0', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '4px'}}>
                                Add
                            </button>
                        </div>
                    </div>
                </div>
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
                        &times;
                    </button>
                </div>
            )}
        </div>
    );
}

export default Chat;