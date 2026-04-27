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

    const [imageFile, setImageFile] = useState(null);
    const [fullScreenImage, setFullscreenImage] = useState(null);
    
    const [replyingTo, setReplyingTo] = useState(null);
    const [lastReadMsgId, setLastReadMsgId] = useState(null);

    const messagesEndRef = useRef(null);
    const messageListRef = useRef(null);
    
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
            return;
        }
        const messagesRef = ref(db, `chats/${selectedChat.id}/messages`);
        const receiptsRef = ref(db, `chats/${selectedChat.id}/readReceipts`);
        
        let initialLoad = true;

        // Fetch my last read message ID first
        let myLastReadId = null;
        get(receiptsRef).then(snap => {
            if (snap.exists() && snap.val()[user.uid]) {
                myLastReadId = snap.val()[user.uid];
            }
        });

        const unsubscribe = onValue(messagesRef, async (snapshot) => {
            if (snapshot.exists()) {
                const msgs = [];
                const messagePromises = [];
                
                let hasNewIncomingMsgs = false;
                
                snapshot.forEach((child) => {
                    const msgData = { id: child.key, ...child.val() };
                    // Resolve sender profile info
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
                
                // Check if there are new messages from others since last render
                if (!initialLoad && messages.length > 0 && resolvedMsgs.length > messages.length) {
                    const newMsgs = resolvedMsgs.slice(messages.length);
                    newMsgs.forEach(m => {
                        if (m.senderId !== user.uid && !document.hasFocus()) {
                            hasNewIncomingMsgs = true;
                            if (Notification.permission === "granted") {
                                new Notification(`New message from ${m.senderInfo?.displayName || 'User'}`, {
                                    body: m.text || "Sent an image",
                                    icon: m.senderInfo?.photoURL || '/react.svg'
                                });
                            }
                        }
                    });
                }
                
                setMessages(resolvedMsgs);

                if (initialLoad) {
                    // Try to scroll to the first unread message
                    setTimeout(() => {
                        if (myLastReadId) {
                            const lastReadIdx = resolvedMsgs.findIndex(m => m.id === myLastReadId);
                            // If there is an unread message after the last read one
                            if (lastReadIdx !== -1 && lastReadIdx + 1 < resolvedMsgs.length) {
                                const targetId = resolvedMsgs[lastReadIdx + 1].id;
                                const elem = document.getElementById(`msg-${targetId}`);
                                if (elem) {
                                    elem.scrollIntoView({ behavior: "smooth", block: "center" });
                                } else {
                                    scrollToBottom();
                                }
                            } else {
                                scrollToBottom();
                            }
                        } else {
                            scrollToBottom();
                        }
                        initialLoad = false;
                    }, 300);
                } else if (!hasNewIncomingMsgs) {
                    scrollToBottom();
                }

                // Update read receipt for the current user to the latest message id
                if (resolvedMsgs.length > 0 && document.hasFocus()) {
                    const lastMsgId = resolvedMsgs[resolvedMsgs.length - 1].id;
                    update(receiptsRef, {
                        [user.uid]: lastMsgId
                    });
                }
            } else {
                setMessages([]);
                initialLoad = false;
            }
        });
        
        // Listen to read receipts
        const unsubscribeReceipts = onValue(receiptsRef, (snapshot) => {
            if (snapshot.exists()) {
                setReadReceipts(snapshot.val());
            } else {
                setReadReceipts({});
            }
        });

        return () => {
            unsubscribe();
            unsubscribeReceipts();
        };
    }, [selectedChat, user.uid]);

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
                            <h3>{selectedChat.name}</h3>
                            <input 
                                type="text" 
                                className="chat-room__search"
                                placeholder="Search messages..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </header>
                        <div className="chat-room__messages">
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
                                        {readers.length > 0 && (
                                            <div className="message__read-receipts" style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', display: 'flex', gap: '3px', marginTop: '2px', marginRight: isMe ? '10px' : '0', marginLeft: isMe ? '0' : '50px' }}>
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