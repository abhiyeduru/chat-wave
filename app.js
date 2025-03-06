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
const clearChatBtn = document.getElementById('clearChatBtn');

// Add to your DOM Elements section
const infoModal = document.createElement('div');
infoModal.className = 'info-modal';
document.body.appendChild(infoModal);

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

// Add after existing event listeners
let touchStartX = 0;
let touchEndX = 0;

// Handle touch events for mobile swipe
document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, false);

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchEndX - touchStartX;
    
    if (Math.abs(diff) < swipeThreshold) return;

    if (diff > 0) {
        // Swipe right - show login
        cube.classList.remove('show-signup');
    } else {
        // Swipe left - show signup
        cube.classList.add('show-signup');
    }
}

// Update form submission for better mobile handling
function updateFormSubmission() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', () => {
            // Blur any focused input to hide mobile keyboard
            document.activeElement.blur();
        });
    });
}

// Call on page load
updateFormSubmission();

// Handle viewport height for mobile browsers
function setMobileHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

window.addEventListener('resize', setMobileHeight);
setMobileHeight();

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

function loadMessages(userId) {
    messagesContainer.innerHTML = '';
    const chatRoomId = [currentUserId, userId].sort().join('_');
    isFirstLoad = true;

    return db.collection('messages')
        .where('chatRoomId', '==', chatRoomId)
        .orderBy('timestamp', 'asc')
        .limit(50) // Limit for performance
        .onSnapshot({
            next: (snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        appendMessage(change.doc.data());
                    } else if (change.type === 'modified') {
                        updateMessage(change.doc.id, change.doc.data());
                    } else if (change.type === 'removed') {
                        removeMessage(change.doc.id);
                    }
                });
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            error: (error) => {
                console.error('Messages listener error:', error);
                messagesContainer.innerHTML = `
                    <div class="error-message">
                        Failed to load messages. Please refresh.
                    </div>
                `;
            }
        });
}

// Update appendMessage function to handle timestamps better
function appendMessage(message) {
    const messageElement = document.createElement('div');
    const isCurrentUser = message.senderId === currentUserId;
    messageElement.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
    const messageId = message.id || Date.now().toString();
    messageElement.id = `message-${messageId}`;
    
    let mediaHtml = '';
    if (message.mediaUrl) {
        if (message.mediaType === 'image') {
            mediaHtml = `<img src="${message.mediaUrl}" class="message-media" alt="Image">`;
        } else if (message.mediaType === 'video') {
            mediaHtml = `<video src="${message.mediaUrl}" class="message-media" controls></video>`;
        }
    }
    
    // Initial timestamp display
    const timestamp = message.timestamp ? formatTime(message.timestamp.toDate()) : 'Sending...';
    
    messageElement.innerHTML = `
        <div class="message-content">
            ${mediaHtml}
            ${message.text || ''}
            <div class="message-time" id="time-${messageId}">${timestamp}</div>
            <div class="message-options">
                <button class="message-option-btn" onclick="showMessageMenu(event, '${messageId}')">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Update timestamp when it becomes available
    if (!message.timestamp) {
        const timeElement = messageElement.querySelector(`#time-${messageId}`);
        const checkTimestamp = setInterval(async () => {
            try {
                const messageRef = await db.collection('messages')
                    .where('chatRoomId', '==', message.chatRoomId)
                    .where('senderId', '==', message.senderId)
                    .where('text', '==', message.text)
                    .limit(1)
                    .get();

                if (!messageRef.empty) {
                    const updatedMessage = messageRef.docs[0].data();
                    if (updatedMessage.timestamp) {
                        timeElement.textContent = formatTime(updatedMessage.timestamp.toDate());
                        clearInterval(checkTimestamp);
                    }
                }
            } catch (error) {
                console.error('Error updating timestamp:', error);
            }
        }, 1000);

        // Clear interval after 10 seconds to prevent infinite checking
        setTimeout(() => clearInterval(checkTimestamp), 10000);
    }
}

// Add these new functions
function showMessageMenu(event, messageId) {
    event.stopPropagation();
    
    // Remove any existing menu
    const existingMenu = document.querySelector('.message-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'message-menu';
    menu.innerHTML = `
        <div class="message-menu-item" onclick="editMessage('${messageId}')">
            <i class="fas fa-edit"></i> Edit
        </div>
        <div class="message-menu-item" onclick="deleteMessage('${messageId}')">
            <i class="fas fa-trash"></i> Delete
        </div>
        <div class="message-menu-item" onclick="showMessageInfo('${messageId}')">
            <i class="fas fa-info-circle"></i> Info
        </div>
    `;

    // Position menu
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    menu.style.top = `${rect.top}px`;
    menu.style.left = `${rect.left + 30}px`;

    document.body.appendChild(menu);

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target) && !button.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

async function editMessage(messageId) {
    const messageDoc = await db.collection('messages').doc(messageId).get();
    if (!messageDoc.exists) return;

    const message = messageDoc.data();
    if (message.senderId !== currentUserId) {
        alert("You can only edit your own messages");
        return;
    }

    const newText = prompt('Edit message:', message.text);
    if (newText && newText !== message.text) {
        await db.collection('messages').doc(messageId).update({
            text: newText,
            edited: true,
            editedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
        const messageDoc = await db.collection('messages').doc(messageId).get();
        if (!messageDoc.exists) return;

        const message = messageDoc.data();
        if (message.senderId !== currentUserId) {
            alert("You can only delete your own messages");
            return;
        }

        await db.collection('messages').doc(messageId).delete();
        
        // Remove message from UI
        const messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
            messageElement.remove();
        }
    } catch (error) {
        console.error('Error deleting message:', error);
        alert('Failed to delete message');
    }
}

async function showMessageInfo(messageId) {
    try {
        const messageDoc = await db.collection('messages').doc(messageId).get();
        if (!messageDoc.exists) return;

        const message = messageDoc.data();
        const sender = await db.collection('users').doc(message.senderId).get();
        const senderData = sender.exists ? sender.data() : { name: 'Unknown' };

        infoModal.innerHTML = `
            <div class="info-modal-header">
                <h3>Message Info</h3>
                <button class="info-modal-close" onclick="infoModal.style.display='none'">×</button>
            </div>
            <div class="info-modal-content">
                <div class="info-item">
                    <span class="info-label">From:</span>
                    <span>${senderData.name}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Sent:</span>
                    <span>${message.timestamp ? formatTime(message.timestamp.toDate()) : 'Sending...'}</span>
                </div>
                ${message.edited ? `
                    <div class="info-item">
                        <span class="info-label">Edited:</span>
                        <span>${formatTime(message.editedAt.toDate())}</span>
                    </div>
                ` : ''}
                <div class="info-item">
                    <span class="info-label">Status:</span>
                    <span>${message.read ? 'Read' : 'Delivered'}</span>
                </div>
            </div>
        `;

        infoModal.style.display = 'block';

        // Close modal when clicking outside
        window.addEventListener('click', function closeModal(e) {
            if (e.target === infoModal) {
                infoModal.style.display = 'none';
                window.removeEventListener('click', closeModal);
            }
        });
    } catch (error) {
        console.error('Error showing message info:', error);
        alert('Failed to load message info');
    }
}

// Add this event listener for Enter key
messageText.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Update sendMessage function to include message ID
async function sendMessage() {
    const text = messageText.value.trim();
    
    if ((!text && !mediaFile) || !selectedUserId) {
        return;
    }

    // Reset form immediately for better UX
    messageText.value = '';
    const textToSend = text;
    const messageId = Date.now().toString();

    try {
        const chatRoomId = [currentUserId, selectedUserId].sort().join('_');
        let mediaUrl = '';
        let mediaType = '';

        if (mediaFile) {
            try {
                const formData = new FormData();
                formData.append('file', mediaFile);
                formData.append('upload_preset', cloudinaryConfig.uploadPreset);
                
                const response = await fetch(
                    `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`,
                    { method: 'POST', body: formData }
                );
                
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                
                mediaUrl = data.secure_url;
                mediaType = mediaFile.type.split('/')[0];

                // Reset media preview
                mediaFile = null;
                mediaPreview.style.display = 'none';
                mediaPreviewImg.src = '';
                mediaPreviewVideo.src = '';
                mediaUpload.value = '';
            } catch (error) {
                console.error('Media upload failed:', error);
                // Continue without media if upload fails
            }
        }

        // Create message document with ID
        const messageData = {
            id: messageId,
            chatRoomId,
            senderId: currentUserId,
            receiverId: selectedUserId,
            text: textToSend,
            mediaUrl,
            mediaType,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        };

        // Add message with specific ID
        await db.collection('messages').doc(messageId).set(messageData);

        // Update last messages for both users
        const batch = db.batch();
        const lastMessageData = {
            message: textToSend || `[${mediaType}]`,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        batch.update(db.collection('users').doc(currentUserId), {
            [`lastMessages.${selectedUserId}`]: lastMessageData
        });

        batch.update(db.collection('users').doc(selectedUserId), {
            [`lastMessages.${currentUserId}`]: lastMessageData
        });

        await batch.commit();

    } catch (error) {
        console.error('Error sending message:', error);
        // Show error in UI instead of alert
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message-error';
        errorDiv.textContent = 'Failed to send message. Please try again.';
        messagesContainer.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
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

// Add CSS for error message
const style = document.createElement('style');
style.textContent = `
    .message-error {
        color: #721c24;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        padding: 10px;
        margin: 10px;
        border-radius: 5px;
        text-align: center;
    }
    
    .error-message {
        text-align: center;
        color: #721c24;
        padding: 20px;
        margin: 20px;
        background: #f8d7da;
        border-radius: 5px;
    }
    .system-message {
        text-align: center;
        color: #0084ff;
        background-color: rgba(0, 132, 255, 0.1);
        padding: 10px;
        margin: 10px auto;
        border-radius: 5px;
        max-width: 200px;
    }
`;
document.head.appendChild(style);

clearChatBtn.addEventListener('click', async () => {
    if (!selectedUserId) return;
    
    if (confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
        try {
            showSpinner();
            const chatRoomId = [currentUserId, selectedUserId].sort().join('_');
            
            // Get all messages from this chat room
            const messagesSnapshot = await db.collection('messages')
                .where('chatRoomId', '==', chatRoomId)
                .get();
            
            // Delete all messages in a batch
            const batch = db.batch();
            messagesSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Clear last messages from both users
            batch.update(db.collection('users').doc(currentUserId), {
                [`lastMessages.${selectedUserId}`]: firebase.firestore.FieldValue.delete()
            });
            
            batch.update(db.collection('users').doc(selectedUserId), {
                [`lastMessages.${currentUserId}`]: firebase.firestore.FieldValue.delete()
            });
            
            await batch.commit();
            
            // Clear messages container
            messagesContainer.innerHTML = '';
            
            // Show success message
            const successDiv = document.createElement('div');
            successDiv.className = 'system-message';
            successDiv.textContent = 'Chat cleared successfully';
            messagesContainer.appendChild(successDiv);
            setTimeout(() => successDiv.remove(), 3000);
            
            hideSpinner();
        } catch (error) {
            hideSpinner();
            console.error('Error clearing chat:', error);
            alert('Failed to clear chat. Please try again.');
        }
    }
});

// Add this CSS to your existing styles
const additionalStyles = `
    .system-message {
        text-align: center;
        color: #0084ff;
        background-color: rgba(0, 132, 255, 0.1);
        padding: 10px;
        margin: 10px auto;
        border-radius: 5px;
        max-width: 200px;
        animation: fadeIn 0.3s ease;
    }
`;
style.textContent += additionalStyles;

// Add this function at the end of your existing code
function fixMobileHeight() {
    // Fix for mobile browsers' viewport height
    function setVH() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
}

// Call the function
fixMobileHeight();

// Add this style to your existing styles
const mobileStyles = `
    @media (max-width: 480px) {
        .auth-container {
            min-height: calc(var(--vh, 1vh) * 100);
        }
    }
`;
style.textContent += mobileStyles;