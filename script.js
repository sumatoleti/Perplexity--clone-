document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleSidebar = document.getElementById('toggleSidebar');
    const newChatBtn = document.getElementById('newChatBtn');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const hero = document.getElementById('hero');
    const chatDisplay = document.getElementById('chatDisplay');
    const micBtn = document.getElementById('micBtn');
    const camBtn = document.getElementById('camBtn');
    const imageBtn = document.getElementById('imageBtn');
    const fileInput = document.getElementById('fileInput');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImageBtn');

    const pdfBtn = document.getElementById('pdfBtn');
    const pdfInput = document.getElementById('pdfInput');
    const pdfPreviewContainer = document.getElementById('pdfPreviewContainer');
    const pdfName = document.getElementById('pdfName');
    const removePdfBtn = document.getElementById('removePdfBtn');

    let base64Image = null;
    let base64Pdf = null;

    const historyList = document.getElementById('historyList');
    const suggestionChips = document.querySelectorAll('.suggestion-chip');

    let currentChatId = null;

    // Load history on startup
    const loadHistory = () => {
        const historyData = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        historyList.innerHTML = '';
        historyData.forEach(item => {
            addHistoryToUI(item);
        });
    };

    const addHistoryToUI = (item) => {
        const li = document.createElement('li');
        li.className = `history-item ${item.id === currentChatId ? 'active' : ''}`;
        li.dataset.id = item.id;
        li.innerHTML = `
            <i data-lucide="message-square"></i>
            <span class="history-title">${item.title}</span>
            <button class="delete-history-btn" onclick="deleteChat('${item.id}', event)">
                <i data-lucide="trash-2"></i>
            </button>
        `;
        li.onclick = () => {
            loadChat(item.id);
        };
        historyList.prepend(li);
        if (window.lucide) window.lucide.createIcons();
    };

    window.deleteChat = (id, event) => {
        if (event) event.stopPropagation(); // Prevent loading the chat when deleting
        
        const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        const updatedHistory = history.filter(c => c.id !== id);
        localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
        
        // If the deleted chat was the active one, clear the screen
        if (currentChatId === id) {
            newChatBtn.click();
        }
        
        loadHistory(); // Re-render the sidebar
    };

    const loadChat = (id) => {
        const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        const chat = history.find(c => c.id === id);
        if (chat) {
            currentChatId = id;
            
            // UI setup
            hero.classList.add('hidden');
            chatDisplay.classList.add('chat-display');
            chatDisplay.classList.remove('hidden');
            chatDisplay.innerHTML = ''; // Clear current view
            
            // Highlight active history item
            document.querySelectorAll('.history-item').forEach(el => {
                el.classList.toggle('active', el.dataset.id === id);
            });
            
            // Render stored messages
            chat.messages.forEach(msg => {
                addMessage(msg.text, msg.sender, msg.id, msg.imageUrl, false);
            });
        }
    };

    const saveToHistory = (text) => {
        if (!currentChatId) {
            currentChatId = Date.now().toString();
            const title = text.length > 25 ? text.substring(0, 25) + '...' : text;
            const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
            const newItem = { id: currentChatId, title: title, messages: [] };
            history.push(newItem);
            localStorage.setItem('chatHistory', JSON.stringify(history));
            addHistoryToUI(newItem);
        }
    };

    const appendMessageToStore = (text, sender, imageUrl = null) => {
        if (!currentChatId) return;
        const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        const chatIndex = history.findIndex(c => c.id === currentChatId);
        if (chatIndex !== -1) {
            history[chatIndex].messages.push({
                text,
                sender,
                imageUrl,
                id: Date.now().toString()
            });
            localStorage.setItem('chatHistory', JSON.stringify(history));
        }
    };

    // Handle Suggestion Chips
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const text = chip.querySelector('span').textContent;
            chatInput.value = text;
            chatInput.style.height = 'auto';
            chatInput.style.height = (chatInput.scrollHeight) + 'px';
            sendBtn.classList.add('active');
            handleSend();
        });
    });

    // Toggle Sidebar
    toggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // Handle New Chat
    newChatBtn.addEventListener('click', () => {
        chatInput.value = '';
        chatInput.style.height = 'auto';
        sendBtn.classList.remove('active');
        currentChatId = null; // Reset for new entry
        
        // Reset Backend Session
        fetch('http://127.0.0.1:5000/api/new-chat', { method: 'POST' });
        
        // Clear logic
        base64Pdf = null;
        pdfPreviewContainer.classList.add('hidden');
        
        // Return to hero view
        hero.classList.remove('hidden');
        chatDisplay.classList.add('hidden');
        chatDisplay.innerHTML = '';
        
        // Update active highlight
        document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
        
        // Mobile: Close sidebar if open
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('active');
        }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = (chatInput.scrollHeight) + 'px';
        
        if (chatInput.value.trim().length > 0 || base64Image) {
            sendBtn.classList.add('active');
        } else {
            sendBtn.classList.remove('active');
        }
    });

    // --- Multimodal Logic ---

    // Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;

        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('recording')) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });

        recognition.onstart = () => {
            micBtn.classList.add('recording');
        };

        recognition.onend = () => {
            micBtn.classList.remove('recording');
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    chatInput.value += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            chatInput.style.height = 'auto';
            chatInput.style.height = (chatInput.scrollHeight) + 'px';
            sendBtn.classList.add('active');
        };
    } else {
        micBtn.style.display = 'none';
        console.warn('Speech Recognition not supported in this browser.');
    }

    // Image Upload
    imageBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleImageSelection(file);
        }
    });

    // Camera Capture
    camBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            video.style.display = 'block'; // Temporarily show video to capture
            
            // Wait for video to be ready
            await new Promise(resolve => video.onloadedmetadata = resolve);
            
            // Capture after a brief delay for camera stabilization
            setTimeout(() => {
                const context = canvas.getContext('2d');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const dataUrl = canvas.toDataURL('image/jpeg');
                setPreview(dataUrl);
                
                // Stop the stream
                stream.getTracks().forEach(track => track.stop());
                video.style.display = 'none';
            }, 1000);
            
        } catch (err) {
            console.error('Camera error:', err);
            alert('Could not access camera.');
        }
    });

    function handleImageSelection(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Optimization: Resize image before sending to save tokens
            resizeImage(e.target.result, 1024, (resizedDataUrl) => {
                setPreview(resizedDataUrl);
            });
        };
        reader.readAsDataURL(file);
    }

    // Helper: Resize Image using Canvas to optimize tokens for multimodal inputs
    function resizeImage(dataUrl, maxDimension, callback) {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDimension) {
                    height *= maxDimension / width;
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width *= maxDimension / height;
                    height = maxDimension;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = dataUrl;
    }

    function setPreview(dataUrl) {
        base64Image = dataUrl;
        imagePreview.src = dataUrl;
        imagePreviewContainer.classList.remove('hidden');
        sendBtn.classList.add('active');
    }

    removeImageBtn.addEventListener('click', () => {
        base64Image = null;
        imagePreviewContainer.classList.add('hidden');
        imagePreview.src = '';
        fileInput.value = '';
        if (chatInput.value.trim().length === 0 && !base64Pdf) {
            sendBtn.classList.remove('active');
        }
    });

    // PDF Logic
    pdfBtn.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                base64Pdf = e.target.result;
                pdfName.textContent = file.name;
                pdfPreviewContainer.classList.remove('hidden');
                
                // Hide hero, show chat
                hero.classList.add('hidden');
                chatDisplay.classList.remove('hidden');
                
                // Send "Pin" request to backend
                sendChatRequest('', null, base64Pdf);
                base64Pdf = true; // Mark as "active in session" (don't send binary again)
            };
            reader.readAsDataURL(file);
        }
    });

    removePdfBtn.addEventListener('click', () => {
        base64Pdf = null;
        pdfPreviewContainer.classList.add('hidden');
        pdfInput.value = '';
        fetch('http://127.0.0.1:5000/api/new-chat', { method: 'POST' });
        
        if (chatInput.value.trim().length === 0 && !base64Image) {
            sendBtn.classList.remove('active');
        }
    });

    // Refactored Send logic to be reusable
    const sendChatRequest = (text, image, pdf = null) => {
        // Show loading indicator
        const loadingMsgId = 'loading-' + Date.now();
        addMessage('Thinking...', 'ai', loadingMsgId);
        
        fetch('http://127.0.0.1:5000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: text,
                image: image,
                pdf: (pdf && pdf !== true) ? pdf : null
            })
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                let errorMsg = data.error || 'Server error';
                if (response.status === 429) {
                    errorMsg = 'Quota Exceeded: You\'ve hit the Gemini free tier limit. Please wait 1-2 minutes or check your API key.';
                }
                throw new Error(errorMsg);
            }
            return data;
        })
        .then(data => {
            const loadingMsg = document.getElementById(loadingMsgId);
            if (loadingMsg) {
                const textDiv = loadingMsg.querySelector('.message-text');
                const textContainer = textDiv.querySelector('div:last-of-type');
                
                if (data.status === 'success') {
                    textContainer.textContent = data.response;
                    // Save AI response to history
                    appendMessageToStore(data.response, 'ai');
                } else {
                    textContainer.textContent = 'Error: ' + (data.error || 'Failed to get response');
                    textContainer.style.color = '#ff6b6b';
                }
            }
        })
        .catch(err => {
            console.error('Fetch error:', err);
            const loadingMsg = document.getElementById(loadingMsgId);
            if (loadingMsg) {
                const textDiv = loadingMsg.querySelector('.message-text');
                const textContainer = textDiv.querySelector('div:last-of-type');
                textContainer.textContent = err.message || 'Error: Could not connect to the backend.';
                textContainer.style.color = '#ff6b6b';
            }
        });
    };

    // Handle Send Event
    const handleSend = () => {
        const text = chatInput.value.trim();
        if (text || base64Image || base64Pdf) {
            // Save to history if it's a new chat
            if (text) saveToHistory(text);
            
            // Hide hero, show chat
            hero.classList.add('hidden');
            chatDisplay.classList.add('chat-display'); // Ensure display class is added
            chatDisplay.classList.remove('hidden');
            
            // Add user message
            addMessage(text, 'user', null, base64Image);
            
            // Save User message to history
            appendMessageToStore(text, 'user', base64Image);
            
            // Store current image and clear for next message
            const currentImage = base64Image;
            base64Image = null;
            imagePreviewContainer.classList.add('hidden');
            imagePreview.src = '';
            
            // Clear input
            chatInput.value = '';
            chatInput.style.height = 'auto';
            sendBtn.classList.remove('active');
            
            // Send the request via refactored function
            sendChatRequest(text, currentImage);
        }
    };

    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    function addMessage(text, sender, id = null, imageUrl = null, shouldSave = true) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;
        if (id) msgDiv.id = id;
        
        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" class="message-image">`;
        }

        // Add a "Share" button for AI messages to satisfy the "generate link" request
        const shareBtnHtml = sender === 'ai' ? `<button class="share-btn" onclick="copyToClipboard('${id || 'chat-msg'}')"><i data-lucide="share-2"></i></button>` : '';

        msgDiv.innerHTML = `
            <div class="message-content">
                <div class="message-avatar">${sender === 'ai' ? 'S' : 'U'}</div>
                <div class="message-text">
                    ${imageHtml}
                    <div>${text}</div>
                    ${shareBtnHtml}
                </div>
            </div>
        `;
        chatDisplay.appendChild(msgDiv);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
        
        if (window.lucide) window.lucide.createIcons();
    }

    // Global copy function for the share buttons
    window.copyToClipboard = (id) => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            const btn = window.event.currentTarget;
            const originalIcon = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check"></i>';
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = originalIcon;
                if (window.lucide) window.lucide.createIcons();
            }, 2000);
        });
    };

    // Initialize UI on startup
    if (window.lucide) window.lucide.createIcons();
    loadHistory();

    // Enable Options (footer buttons)
    const settingsBtn = document.querySelector('.footer-item:nth-child(1)');
    const helpBtn = document.querySelector('.footer-item:nth-child(2)');

    if (settingsBtn) {
        settingsBtn.onclick = () => {
            alert('Sers AI Settings: Configuration options for Gemini model and visual theme are being finalized.');
        };
    }

    if (helpBtn) {
        helpBtn.onclick = () => {
            alert('Sers AI Support: You are using the latest version of Sigma 3 interface. Visit documentation for more info.');
        };
    }
});
