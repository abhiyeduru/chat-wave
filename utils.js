// File handling utilities
const fileUtils = {
    getFileType(file) {
        return file.type.split('/')[0];
    },
    
    isValidFileType(file) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
        return validTypes.includes(file.type);
    },
    
    isValidFileSize(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        return file.size <= maxSize;
    },
    
    async compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate new dimensions while maintaining aspect ratio
                    let width = img.width;
                    let height = img.height;
                    const maxDimension = 1200;
                    
                    if (width > height && width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(blob => {
                        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                    }, 'image/jpeg', 0.8);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }
};

// Validation utilities
const validationUtils = {
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    isValidPassword(password) {
        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        return passwordRegex.test(password);
    },
    
    isValidName(name) {
        return name.length >= 2 && name.length <= 50;
    }
};

// Time formatting utilities
const timeUtils = {
    formatMessageTime(date) {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString();
        }
    },
    
    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };
        
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
            }
        }
        
        return 'Just now';
    }
};

// Error handling utilities
const errorUtils = {
    handleFirebaseError(error) {
        const errorMessages = {
            'auth/email-already-in-use': 'This email is already registered.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/weak-password': 'Password should be at least 6 characters.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'storage/unauthorized': 'You are not authorized to access this file.',
            'storage/canceled': 'Upload was canceled.',
            'storage/unknown': 'An unknown error occurred during upload.'
        };
        
        return errorMessages[error.code] || error.message;
    },
    
    logError(error, context) {
        console.error(`[${context}]`, error);
        // You could also send this to a logging service
    }
};

// Export all utilities
export {
    fileUtils,
    validationUtils,
    timeUtils,
    errorUtils
};
