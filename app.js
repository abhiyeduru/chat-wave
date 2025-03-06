// Firebase Configuration - Replace with your own Firebase config
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAxDmW6dbfN3pEJQkltCn_jq2YGGbMRqhA",
    authDomain: "whatsapp-8fcfe.firebaseapp.com",
    projectId: "whatsapp-8fcfe",
    storageBucket: "whatsapp-8fcfe.firebasestorage.app",
    messagingSenderId: "254784334711",
    appId: "1:254784334711:web:b927837e290bccaa694f72",
    measurementId: "G-GEESEBDRWW"
  };

// Cloudinary Configuration - Replace with your own Cloudinary config
const cloudinaryConfig = {
    cloudName: "dp8bfdbab",
    uploadPreset: "cryptchat"
};

// Initialize Firebase properly with compat version
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const realtimeDb = firebase.database();

// DOM Elements
// Auth Elements
const authContainer = document.getElementById('authContainer');
const chatContainer = document.getElementById('chatContainer');
const cube = document.getElementById('cube');
const showSignupBtn = document.getElementById('showSignup');
const showLoginBtn = document.getElementById('showLogin');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const profileImage = document.getElementById('profileImage');
const profilePreview = document.getElementById('profilePreview');
const logoutBtn = document.getElementById('logoutBtn');
const mobileBackBtn = document.getElementById('mobileBackBtn');

// User Interface Elements
const currentUserAvatar = document.getElementById('currentUserAvatar');
const currentUserName = document.getElementById('currentUserName');
const usersList = document.getElementById('usersList');
const userSearch = document.getElementById('userSearch');

// Chat Elements
const selectedUserAvatar = document.getElementById('selectedUserAvatar');
const selectedUserName = document.getElementById('selectedUserName');
const selectedUserStatus = document.getElementById('selectedUserStatus');
const selectedUserLastSeen = document.getElementById('selectedUserLastSeen');
const typingIndicator = document.getElementById('typingIndicator');
const welcomeMessage = document.getElementById('welcomeMessage');
const messagesContainer = document.getElementById('messagesContainer');
const messageInputContainer = document.getElementById('messageInputContainer');
const messageText = document.getElementById('messageText');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const mediaUpload = document.getElementById('mediaUpload');
const mediaPreview = document.getElementById('mediaPreview');
const mediaPreviewImg = document.getElementById('mediaPreviewImg');
const mediaPreviewVideo = document.getElementById('mediaPreviewVideo');
const removeMediaBtn = document.getElementById('removeMediaBtn');
const emojiPickerBtn = document.getElementById('emojiPickerBtn');
const emojiPicker = document.getElementById('emojiPicker');
const spinnerOverlay = document.getElementById('spinnerOverlay');

// Global Variables
let currentUser = null;
let currentUserId = null;
let selectedUserId = null;
let mediaFile = null;
let typingTimeout = null;
let lastTypingTime = 0;
let isFirstLoad = true;
let usersSnapshot = null;

// Event Listeners
showSignupBtn.addEventListener('click', () => {
    cube.classList.add('show-signup');
});

showLoginBtn.addEventListener('click', () => {
    cube.classList.remove('show-signup');
});

profileImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            profilePreview.src = event.target.result;
            profilePreview.style.display = 'block';
            document.querySelector('.profile-placeholder').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
});

// Update login handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        showSpinner();
        
        // 1. Sign in with Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        
        // 2. Update user status in Firestore
        await db.collection('users').doc(userCredential.user.uid).update({
            isOnline: true,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 3. Reset form
        loginForm.reset();
        
        // 4. Hide auth container, show chat
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        
        hideSpinner();
    } catch (error) {
        hideSpinner();
        alert('Login Error: ' + error.message);
    }
});

// Update signup handler
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const file = profileImage.files[0];
    
    if (!file) {
        alert('Please upload a profile picture.');
        return;
    }

    try {
        showSpinner();

        // 1. First create the user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        if (!userCredential.user) {
            throw new Error('Failed to create user account');
        }

        // 2. Upload profile image to Cloudinary
        let imageUrl;
        try {
            imageUrl = await uploadToCloudinary(file);
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            // If image upload fails, use a default image
            imageUrl = 'https://via.placeholder.com/150';
        }

        // 3. Create the user document in Firestore
        const userData = {
            uid: userCredential.user.uid,
            name: name,
            email: email,
            profileImageUrl: imageUrl,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            isOnline: true,
            lastMessages: {}
        };

        // 4. Save user data to Firestore
        await db.collection('users').doc(userCredential.user.uid).set(userData);

        // 5. Update user profile in Firebase Auth
        await userCredential.user.updateProfile({
            displayName: name,
            photoURL: imageUrl
        });

        // 6. Reset form and UI
        signupForm.reset();
        profilePreview.style.display = 'none';
        document.querySelector('.profile-placeholder').style.display = 'block';
        
        // 7. Switch to chat interface
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        
        hideSpinner();
        
        // 8. Initialize user's UI
        currentUser = userCredential.user;
        currentUserId = userCredential.user.uid;
        currentUserName.textContent = name;
        currentUserAvatar.src = imageUrl;
        
        // 9. Load users list
        await loadUsers();
        setupPresenceListeners();

    } catch (error) {
        console.error('Signup error:', error);
        hideSpinner();
        
        // If we failed after creating the auth user but before completing setup,
        // clean up by deleting the auth user
        if (auth.currentUser) {
            try {
                await auth.currentUser.delete();
            } catch (deleteError) {
                console.error('Cleanup error:', deleteError);
            }
        }
        
        alert('Signup Error: ' + error.message);
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        showSpinner();
        
        // Update user status to offline
        await db.collection('users').doc(currentUserId).update({
            isOnline: false,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        clearChat(); // Clear chat before logout
        await auth.signOut();
        hideSpinner();
    } catch (error) {
        hideSpinner();
        alert('Logout Error: ' + error.message);
    }
});

messageText.addEventListener('input', () => {
    const now = new Date().getTime();
    
    // Only send typing indicator if it's been more than 3 seconds since last one
    if (selectedUserId && (now - lastTypingTime > 3000)) {
        lastTypingTime = now;
        db.collection('typingStatus').doc(`${currentUserId}_${selectedUserId}`).set({
            isTyping: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    
    // Clear previous timeout
    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    
    // Set typing to false after 3 seconds of no input
    typingTimeout = setTimeout(() => {
        if (selectedUserId) {
            db.collection('typingStatus').doc(`${currentUserId}_${selectedUserId}`).set({
                isTyping: false,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }, 3000);
});

sendMessageBtn.addEventListener('click', sendMessage);

mediaUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        mediaFile = file;
        const fileType = file.type.split('/')[0];
        
        if (fileType === 'image') {
            const reader = new FileReader();
            reader.onload = (event) => {
                mediaPreviewImg.src = event.target.result;
                mediaPreviewImg.style.display = 'block';
                mediaPreviewVideo.style.display = 'none';
                mediaPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else if (fileType === 'video') {
            const reader = new FileReader();
            reader.onload = (event) => {
                mediaPreviewVideo.src = event.target.result;
                mediaPreviewVideo.style.display = 'block';
                mediaPreviewImg.style.display = 'none';
                mediaPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }
});

removeMediaBtn.addEventListener('click', () => {
    mediaFile = null;
    mediaPreview.style.display = 'none';
    mediaPreviewImg.src = '';
    mediaPreviewVideo.src = '';
    mediaUpload.value = '';
});

emojiPickerBtn.addEventListener('click', () => {
    if (emojiPicker.style.display === 'grid') {
        emojiPicker.style.display = 'none';
    } else {
        emojiPicker.style.display = 'grid';
        loadEmojis();
    }
});

userSearch.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterUsers(searchTerm);
});

mobileBackBtn.addEventListener('click', () => {
    chatContainer.classList.remove('show-chat');
});

// Update auth state observer
auth.onAuthStateChanged(async (user) => {
    try {
        if (user) {
            currentUser = user;
            currentUserId = user.uid;
            
            // Get user data from Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                // Update UI
                currentUserName.textContent = userData.name || user.displayName;
                currentUserAvatar.src = userData.profileImageUrl || user.photoURL;
                
                // Update online status
                await db.collection('users').doc(user.uid).update({
                    isOnline: true,
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Show chat container, hide auth
                authContainer.style.display = 'none';
                chatContainer.style.display = 'flex';
                
                // Load users and setup listeners
                await loadUsers();
                setupPresenceListeners();
            } else {
                // If this is a new user, create their document
                const userData = {
                    uid: user.uid,
                    name: user.displayName || 'Anonymous',
                    email: user.email,
                    profileImageUrl: user.photoURL || 'https://via.placeholder.com/150',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                    isOnline: true,
                    lastMessages: {}
                };
                
                await db.collection('users').doc(user.uid).set(userData);
                
                currentUserName.textContent = userData.name;
                currentUserAvatar.src = userData.profileImageUrl;
                
                authContainer.style.display = 'none';
                chatContainer.style.display = 'flex';
                
                await loadUsers();
                setupPresenceListeners();
            }
        } else {
            // Reset state
            currentUser = null;
            currentUserId = null;
            selectedUserId = null;
            
            // Show auth container, hide chat
            authContainer.style.display = 'flex';
            chatContainer.style.display = 'none';
            
            // Reset auth forms
            loginForm.reset();
            signupForm.reset();
            profilePreview.style.display = 'none';
            document.querySelector('.profile-placeholder').style.display = 'block';
            
            // Clear users list
            usersList.innerHTML = '';
            
            // Cleanup listeners
            if (usersSnapshot) {
                usersSnapshot();
            }
        }
    } catch (error) {
        console.error('Auth state change error:', error);
        alert('Authentication error: ' + error.message);
        hideSpinner();
    }
});

// Functions
async function uploadToCloudinary(file) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        
        fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            resolve(data.secure_url);
        })
        .catch(error => {
            reject(error);
        });
    });
}

async function loadUsers() {
    // Unsubscribe from previous listener if exists
    if (usersSnapshot) {
        usersSnapshot();
    }
    
    usersSnapshot = db.collection('users')
        .where('email', '!=', currentUser.email)
        .orderBy('email')
        .onSnapshot(snapshot => {
            usersList.innerHTML = '';
            
            snapshot.forEach(doc => {
                const userData = doc.data();
                const userId = doc.id;
                
                // Create user item element
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.dataset.userId = userId;
                
                const isOnline = userData.isOnline || false;
                const lastMessage = userData.lastMessage || '';
                const lastMessageTime = userData.lastMessageTime ? formatTime(userData.lastMessageTime.toDate()) : '';
                
                userItem.innerHTML = `
                    <div class="user-avatar">
                        <img src="${userData.profileImageUrl}" alt="${userData.name}">
                        <span class="status-dot ${isOnline ? 'online' : ''}"></span>
                    </div>
                    <div class="user-message-info">
                        <h4>${userData.name}</h4>
                        <p class="last-message">${lastMessage}</p>
                    </div>
                    <span class="message-time">${lastMessageTime}</span>
                `;
                
                userItem.addEventListener('click', () => {
                    // Highlight selected user
                    document.querySelectorAll('.user-item').forEach(item => {
                        item.classList.remove('active');
                    });
                    userItem.classList.add('active');
                    
                    // Set selected user
                    selectedUserId = userId;
                    selectedUserName.textContent = userData.name;
                    selectedUserAvatar.src = userData.profileImageUrl;
                    selectedUserStatus.className = `status-dot ${isOnline ? 'online' : ''}`;
                    
                    if (!isOnline && userData.lastSeen) {
                        const lastSeenDate = userData.lastSeen.toDate();
                        selectedUserLastSeen.textContent = `Last seen: ${formatLastSeen(lastSeenDate)}`;
                    } else {
                        selectedUserLastSeen.textContent = 'Online';
                    }
                    
                    // Show message input and load messages
                    welcomeMessage.style.display = 'none';
                    messageInputContainer.style.display = 'flex';
                    
                    // Handle mobile view transition
                    if (window.innerWidth <= 768) {
                        chatContainer.classList.add('show-chat');
                    }
                    
                    loadMessages(userId);
                    setupTypingIndicator(userId);
                });
                
                usersList.appendChild(userItem);
            });
        });
}

function filterUsers(searchTerm) {
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const userName = item.querySelector('h4').textContent.toLowerCase();
        if (userName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

async function loadMessages(userId) {
    // Clear messages container
    messagesContainer.innerHTML = '';
    
    // Create a unique chat room ID (sort user IDs to ensure consistency)
    const chatRoomId = [currentUserId, userId].sort().join('_');
    
    // Listen for messages in real-time
    return db.collection('messages')
        .where('chatRoomId', '==', chatRoomId)
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            // Handle only new messages if not first load
            if (!isFirstLoad) {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const message = change.doc.data();
                        appendMessage(message);
                    }
                });
            } else {
                // Load all messages on first load
                snapshot.forEach(doc => {
                    const message = doc.data();
                    appendMessage(message);
                });
                isFirstLoad = false;
                
                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        });
}

function appendMessage(message) {
    const messageElement = document.createElement('div');
    const isCurrentUser = message.senderId === currentUserId;
    messageElement.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
    
    let mediaHtml = '';
    if (message.mediaUrl) {
        if (message.mediaType === 'image') {
            mediaHtml = `<img src="${message.mediaUrl}" class="message-media" alt="Image">`;
        } else if (message.mediaType === 'video') {
            mediaHtml = `<video src="${message.mediaUrl}" class="message-media" controls></video>`;
        }
    }
    
    messageElement.innerHTML = `
        <div class="message-content">
            ${mediaHtml}
            ${message.text}
            <div class="message-time">${formatTime(message.timestamp.toDate())}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update sendMessage function
async function sendMessage() {
    const text = messageText.value.trim();
    
    if ((!text && !mediaFile) || !selectedUserId) {
        return;
    }
    
    try {
        showSpinner();
        
        let mediaUrl = '';
        let mediaType = '';
        
        if (mediaFile) {
            const formData = new FormData();
            formData.append('file', mediaFile);
            formData.append('upload_preset', cloudinaryConfig.uploadPreset);
            
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`,
                {
                    method: 'POST',
                    body: formData
                }
            );
            
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            mediaUrl = data.secure_url;
            mediaType = mediaFile.type.split('/')[0];
        }
        
        const chatRoomId = [currentUserId, selectedUserId].sort().join('_');
        
        // Create message document
        const messageDoc = {
            chatRoomId: chatRoomId,
            senderId: currentUserId,
            receiverId: selectedUserId,
            text: text,
            mediaUrl: mediaUrl,
            mediaType: mediaType,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        };
        
        // Add message to Firestore
        await db.collection('messages').add(messageDoc);
        
        // Update last message preview
        const messagePreview = text || `[${mediaType}]`;
        const batch = db.batch();
        
        // Update both users' last messages
        const updates = {
            message: messagePreview,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        batch.update(db.collection('users').doc(currentUserId), {
            [`lastMessages.${selectedUserId}`]: updates
        });
        
        batch.update(db.collection('users').doc(selectedUserId), {
            [`lastMessages.${currentUserId}`]: updates
        });
        
        await batch.commit();
        
        // Reset form
        messageText.value = '';
        mediaFile = null;
        mediaPreview.style.display = 'none';
        mediaPreviewImg.src = '';
        mediaPreviewVideo.src = '';
        mediaUpload.value = '';
        
        hideSpinner();
    } catch (error) {
        hideSpinner();
        console.error('Error sending message:', error);
        alert('Error sending message: ' + error.message);
    }
}

function setupTypingIndicator(userId) {
    // Listen for typing status
    return db.collection('typingStatus')
        .doc(`${userId}_${currentUserId}`)
        .onSnapshot(doc => {
            if (doc.exists) {
                const typingStatus = doc.data();
                if (typingStatus.isTyping) {
                    typingIndicator.style.display = 'block';
                } else {
                    typingIndicator.style.display = 'none';
                }
            } else {
                typingIndicator.style.display = 'none';
            }
        });
}

function setupPresenceListeners() {
    // Set up Firebase presence system
    const connectedRef = firebase.database().ref('.info/connected');
    connectedRef.on('value', async (snap) => {
        if (snap.val() === true && currentUserId) {
            // User is online
            await db.collection('users').doc(currentUserId).update({
                isOnline: true,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Set up disconnect handler
            firebase.database().ref(`/status/${currentUserId}`).onDisconnect().set({
                isOnline: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                // Update Firestore with online status
                db.collection('users').doc(currentUserId).update({
                    isOnline: true,
                    lastSeen: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
        }
    });
}

function loadEmojis() {
    // Common emojis
    const emojis = ['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', 
                   '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗', 
                   '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', 
                   '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', 
                   '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', 
                   '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', 
                   '👍', '👎', '❤️', '🔥', '👋'];
    
    emojiPicker.innerHTML = '';
    
    emojis.forEach(emoji => {
        const emojiElement = document.createElement('div');
        emojiElement.className = 'emoji-item';
        emojiElement.textContent = emoji;
        emojiElement.addEventListener('click', () => {
            messageText.value += emoji;
            emojiPicker.style.display = 'none';
            messageText.focus();
        });
        
        emojiPicker.appendChild(emojiElement);
    });
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatLastSeen(date) {
    const now = new Date();
    const diff = (now - date) / 1000; // difference in seconds
    
    if (diff < 60) {
        return 'Just now';
    } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function showSpinner() {
    spinnerOverlay.style.display = 'flex';
}

function hideSpinner() {
    spinnerOverlay.style.display = 'none';
}

function clearChat() {
    selectedUserId = null;
    selectedUserName.textContent = 'Select a user to start chatting';
    selectedUserAvatar.src = '';
    selectedUserStatus.className = 'status-dot';
    selectedUserLastSeen.textContent = '';
    messagesContainer.innerHTML = '';
    welcomeMessage.style.display = 'flex';
    messageInputContainer.style.display = 'none';
    chatContainer.classList.remove('show-chat');
}

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        chatContainer.classList.remove('show-chat');
    }
});