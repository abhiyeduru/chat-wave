import { fileUtils } from './utils.js';

export class MessageHandler {
    constructor(db, cloudinaryConfig) {
        this.db = db;
        this.cloudinaryConfig = cloudinaryConfig;
        this.messageListeners = new Map();
    }

    // Encrypt message before sending
    encryptMessage(text) {
        // Simple encryption for demo - replace with proper encryption in production
        return btoa(text);
    }

    // Decrypt received message
    decryptMessage(text) {
        // Simple decryption for demo - replace with proper decryption in production
        return atob(text);
    }

    async sendMessage(senderId, receiverId, text, mediaFile = null) {
        try {
            let mediaUrl = '';
            let mediaType = '';

            if (mediaFile) {
                if (!fileUtils.isValidFileType(mediaFile)) {
                    throw new Error('Invalid file type');
                }
                if (!fileUtils.isValidFileSize(mediaFile)) {
                    throw new Error('File too large (max 10MB)');
                }

                // Compress image if it's an image file
                if (mediaFile.type.startsWith('image/')) {
                    mediaFile = await fileUtils.compressImage(mediaFile);
                }

                mediaUrl = await this.uploadMedia(mediaFile);
                mediaType = fileUtils.getFileType(mediaFile);
            }

            const chatRoomId = [senderId, receiverId].sort().join('_');
            const encryptedText = this.encryptMessage(text);

            await this.db.collection('messages').add({
                chatRoomId,
                senderId,
                receiverId,
                text: encryptedText,
                mediaUrl,
                mediaType,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            });

            // Update last message preview
            const messagePreview = text || `[${mediaType}]`;
            await this.updateLastMessage(senderId, receiverId, messagePreview);

            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    async uploadMedia(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${this.cloudinaryConfig.cloudName}/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message);
        }

        return data.secure_url;
    }

    async updateLastMessage(senderId, receiverId, messagePreview) {
        const batch = this.db.batch();

        // Update sender's last message
        const senderRef = this.db.collection('users').doc(senderId);
        batch.update(senderRef, {
            [`lastMessages.${receiverId}`]: {
                message: messagePreview,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }
        });

        // Update receiver's last message
        const receiverRef = this.db.collection('users').doc(receiverId);
        batch.update(receiverRef, {
            [`lastMessages.${senderId}`]: {
                message: messagePreview,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }
        });

        await batch.commit();
    }

    listenToMessages(chatRoomId, callback) {
        // Remove existing listener if any
        if (this.messageListeners.has(chatRoomId)) {
            this.messageListeners.get(chatRoomId)();
        }

        // Set up new listener
        const unsubscribe = this.db.collection('messages')
            .where('chatRoomId', '==', chatRoomId)
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                const messages = [];
                snapshot.forEach(doc => {
                    const message = doc.data();
                    message.id = doc.id;
                    message.text = this.decryptMessage(message.text);
                    messages.push(message);
                });
                callback(messages);
            });

        // Store the unsubscribe function
        this.messageListeners.set(chatRoomId, unsubscribe);
        return unsubscribe;
    }

    async markMessageAsRead(messageId) {
        await this.db.collection('messages').doc(messageId).update({
            read: true
        });
    }

    async deleteMessage(messageId) {
        await this.db.collection('messages').doc(messageId).delete();
    }

    // Clean up listeners
    cleanup() {
        this.messageListeners.forEach(unsubscribe => unsubscribe());
        this.messageListeners.clear();
    }
}
