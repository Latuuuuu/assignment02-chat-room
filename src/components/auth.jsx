import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut
} from "firebase/auth";
import { useState } from "react";
import { auth } from "../config.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import '../styles/auth.scss';

const GoogleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
);

const errorMap = {
    'auth/email-already-in-use': 'Email already registered.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/weak-password': 'Password must be 6+ characters.',
    'auth/user-not-found': 'No account with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/popup-closed-by-user': 'Popup was closed.',
    'auth/too-many-requests': 'Too many attempts. Try later.',
};

export const Auth = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const clear = () => { setEmail(''); setPassword(''); setError(''); };

    const handleEmailAuth = async (action) => {
        if (!email || !password) { setError('Please fill in all fields.'); return; }
        setLoading(true); setError('');
        try {
            action === 'signup'
                ? await createUserWithEmailAndPassword(auth, email, password)
                : await signInWithEmailAndPassword(auth, email, password);
            clear();
        } catch (e) { setError(errorMap[e.code] || 'An error occurred.'); }
        setLoading(false);
    };

    const handleGoogle = async () => {
        setError('');
        try { await signInWithPopup(auth, new GoogleAuthProvider()); }
        catch (e) { setError(errorMap[e.code] || 'An error occurred.'); }
    };

    return (
        <div className="auth">
            {/* Header */}
            <div className="auth__header">
                <span className="auth__logo">📡</span>
                <span className="auth__brand-name">Chat App</span>
            </div>

            <div className="auth__body">
                {user ? (
                    /* ── Signed-in state ── */
                    <div className="auth__profile">
                        <div className="auth__avatar">
                            {user.photoURL
                                ? <img src={user.photoURL} alt="avatar" />
                                : <span>{(user.displayName || user.email || '?')[0].toUpperCase()}</span>
                            }
                        </div>
                        <div className="auth__profile-name">{user.displayName || 'User'}</div>
                        <div className="auth__profile-email">{user.email}</div>
                        <div className="auth__signed-badge">● Signed in</div>
                        <button className="auth__signout" onClick={() => navigate('/profile')} style={{ background: '#e0e0e0', color: '#333', marginBottom: '8px' }}>Edit Profile</button>
                        <button className="auth__signout" onClick={() => signOut(auth)}>Sign Out</button>
                    </div>
                ) : (
                    /* ── Sign-in form ── */
                    <div className="auth__form">
                        <div className="auth__field">
                            <label className="auth__label">Email</label>
                            <input
                                className="auth__input"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleEmailAuth('login')}
                            />
                        </div>
                        <div className="auth__field">
                            <label className="auth__label">Password</label>
                            <input
                                className="auth__input"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleEmailAuth('login')}
                            />
                        </div>

                        {error && <div className="auth__error">{error}</div>}

                        <div className="auth__actions" style={{ display: 'flex', gap: '8px' }}>
                            <button className="auth__submit" onClick={() => handleEmailAuth('login')} disabled={loading}>
                                {loading ? 'Wait…' : 'Sign In'}
                            </button>
                            <button className="auth__submit auth__submit--signup" style={{ background: '#eee', color: '#333' }} onClick={() => handleEmailAuth('signup')} disabled={loading}>
                                {loading ? 'Wait…' : 'Sign Up'}
                            </button>
                        </div>

                        <div className="auth__divider">
                            <div className="auth__divider-line" />
                            <span className="auth__divider-text">or</span>
                            <div className="auth__divider-line" />
                        </div>

                        <button className="auth__google" onClick={handleGoogle}>
                            <GoogleIcon /> Continue with Google
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
