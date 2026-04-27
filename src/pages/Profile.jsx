import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { Link } from "react-router-dom";
import { auth, db, storage } from "../config";
import { updateEmail } from "firebase/auth";
import { ref, get, set, update } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import "../styles/profile.scss";

function Profile() {
    const { user } = useAuth();
    const [profile, setProfile] = useState({
        displayName: "",
        email: "",
        phone: "",
        address: "",
        photoURL: ""
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [file, setFile] = useState(null);

    useEffect(() => {
        if (user) {
            const fetchProfile = async () => {
                const userRef = ref(db, `users/${user.uid}`);
                const snapshot = await get(userRef);
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setProfile({
                        displayName: data.displayName || "",
                        email: data.email || user.email || "",
                        phone: data.phone || "",
                        address: data.address || "",
                        photoURL: data.photoURL || user.photoURL || ""
                    });
                }
                setLoading(false);
            };
            fetchProfile();
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage("");

        try {
            let updatedPhotoURL = profile.photoURL;

            if (file) {
                const imageRef = storageRef(storage, `profiles/${user.uid}/${file.name}`);
                await uploadBytes(imageRef, file);
                updatedPhotoURL = await getDownloadURL(imageRef);
            }

            if (profile.email !== user.email) {
                await updateEmail(auth.currentUser, profile.email);
            }

            const updates = {
                displayName: profile.displayName,
                email: profile.email,
                phone: profile.phone,
                address: profile.address,
                photoURL: updatedPhotoURL
            };

            await update(ref(db, `users/${user.uid}`), updates);
            setProfile(prev => ({ ...prev, photoURL: updatedPhotoURL }));
            setFile(null);
            setMessage("Profile updated successfully!");
        } catch (error) {
            console.error("Error updating profile:", error);
            if (error.code === 'auth/requires-recent-login') {
                setMessage("Please log out and log in again to update your email.");
            } else {
                setMessage("Failed to update profile: " + error.message);
            }
        }
        setSaving(false);
    };

    if (loading) return <div className="profile__loading">Loading profile...</div>;

    return (
        <div className="profile-page">
            <header className="profile-page__header">
                <h2>User Profile</h2>
                <Link to="/chat" className="profile-page__back">Back to Chat</Link>
            </header>
            
            <div className="profile-page__content">
                <div className="profile-card">
                    <form className="profile-card__form" onSubmit={handleSave}>
                        <div className="profile-card__avatar-group">
                            <div className="profile-card__avatar">
                                {profile.photoURL ? (
                                    <img src={profile.photoURL} alt="Profile" />
                                ) : (
                                    <div className="profile-card__avatar-placeholder">
                                        {profile.displayName ? profile.displayName[0].toUpperCase() : "?"}
                                    </div>
                                )}
                            </div>
                            <label className="profile-card__upload-btn">
                                Change Picture
                                <input type="file" accept="image/*" onChange={handleFileChange} />
                            </label>
                            {file && <span className="profile-card__file-name">{file.name}</span>}
                        </div>

                        <div className="profile-card__fields">
                            <div className="profile-card__field">
                                <label>Email</label>
                                <input type="email" name="email" value={profile.email} onChange={handleChange} className="profile-card__input" required />
                                <small>Updating this will update your database email.</small>
                            </div>
                            <div className="profile-card__field">
                                <label>Display Name</label>
                                <input type="text" name="displayName" value={profile.displayName} onChange={handleChange} className="profile-card__input" required />
                            </div>
                            <div className="profile-card__field">
                                <label>Phone</label>
                                <input type="tel" name="phone" value={profile.phone} onChange={handleChange} className="profile-card__input" />
                            </div>
                            <div className="profile-card__field">
                                <label>Address</label>
                                <textarea name="address" value={profile.address} onChange={handleChange} className="profile-card__input" rows="3" />
                            </div>
                        </div>

                        {message && (
                            <div className={`profile-card__message ${message.includes('success') ? 'profile-card__message--success' : 'profile-card__message--error'}`}>
                                {message}
                            </div>
                        )}

                        <button type="submit" disabled={saving} className="profile-card__submit">
                            {saving ? "Saving..." : "Save Profile"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Profile;