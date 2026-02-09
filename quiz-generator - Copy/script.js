document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const themeIcon = themeToggle.querySelector('.theme-icon');
    
    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
        localStorage.setItem('theme', newTheme);
    });
    
    const messagesScriptContainer = document.getElementById('messages-script');
    const addMessageBtn = document.getElementById('add-message-btn');
    const previewBtn = document.getElementById('preview-btn');
    const exportBtn = document.getElementById('export-btn');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const phoneScreen = document.getElementById('phone-screen');
    const typingIndicator = document.getElementById('typing-indicator');
    
    const senderDelayInput = document.getElementById('sender-delay');
    const receiverDelayInput = document.getElementById('receiver-delay');
    const typingDelayInput = document.getElementById('typing-delay');
    const typingPerCharInput = document.getElementById('typing-per-char');
    const typingSpeedInput = document.getElementById('typing-speed');
    
    const typingVolumeInput = document.getElementById('typing-volume');
    const sendVolumeInput = document.getElementById('send-volume');
    const receiveVolumeInput = document.getElementById('receive-volume');
    
    const profileNameInput = document.getElementById('profile-name');
    const profilePictureInput = document.getElementById('profile-picture');
    const messageCountInput = document.getElementById('message-count');
    const headerProfileName = document.getElementById('header-profile-name');
    const headerProfilePic = document.getElementById('header-profile-pic');
    const backCount = document.querySelector('.back-count');
    
    const bgTypeSelect = document.getElementById('bg-type');
    const bgColorInput = document.getElementById('bg-color');
    const bgImageInput = document.getElementById('bg-image');
    const bgVideoInput = document.getElementById('bg-video');
    const bgMusicInput = document.getElementById('bg-music');
    const chatBackground = document.getElementById('chat-background');
    const bgVideoElement = document.getElementById('bg-video-element');
    const bgMusicElement = document.getElementById('bg-music-element');
    
    const saveNameInput = document.getElementById('save-name');
    const saveBtn = document.getElementById('save-btn');
    const loadBtn = document.getElementById('load-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const savedConversationsSelect = document.getElementById('saved-conversations');
    const soundEffectsCheckbox = document.getElementById('sound-effects');

    let messageCount = 0;
    let isAnimating = false;
    let shouldStopAnimation = false;
    let profilePicUrl = null;
    let backgroundImageUrl = null;
    let backgroundVideoUrl = null;
    let backgroundMusicUrl = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let audioContext = null;

    // Slider value updates
    senderDelayInput.addEventListener('input', (e) => {
        document.getElementById('sender-delay-value').textContent = e.target.value;
    });
    
    receiverDelayInput.addEventListener('input', (e) => {
        document.getElementById('receiver-delay-value').textContent = e.target.value;
    });
    
    typingDelayInput.addEventListener('input', (e) => {
        document.getElementById('typing-delay-value').textContent = e.target.value;
    });
    
    typingPerCharInput.addEventListener('input', (e) => {
        document.getElementById('typing-per-char-value').textContent = e.target.value;
    });
    
    typingSpeedInput.addEventListener('input', (e) => {
        document.getElementById('typing-speed-value').textContent = e.target.value;
    });
    
    typingVolumeInput.addEventListener('input', (e) => {
        document.getElementById('typing-volume-value').textContent = e.target.value;
    });
    
    sendVolumeInput.addEventListener('input', (e) => {
        document.getElementById('send-volume-value').textContent = e.target.value;
    });
    
    receiveVolumeInput.addEventListener('input', (e) => {
        document.getElementById('receive-volume-value').textContent = e.target.value;
    });

    // Profile name update
    profileNameInput.addEventListener('input', () => {
        headerProfileName.textContent = profileNameInput.value || 'My Brain';
    });
    
    // Message count update
    messageCountInput.addEventListener('input', () => {
        backCount.textContent = messageCountInput.value || '147';
    });
    
    // Initialize profile name and message count on load
    headerProfileName.textContent = profileNameInput.value || 'My Brain';
    backCount.textContent = messageCountInput.value || '147';

    // Profile picture upload
    profilePictureInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                profilePicUrl = event.target.result;
                headerProfilePic.src = profilePicUrl;
                headerProfilePic.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    // Background type change
    bgTypeSelect.addEventListener('change', () => {
        const type = bgTypeSelect.value;
        document.getElementById('bg-color-group').style.display = type === 'color' ? 'flex' : 'none';
        document.getElementById('bg-image-group').style.display = type === 'image' ? 'flex' : 'none';
        document.getElementById('bg-video-group').style.display = type === 'video' ? 'flex' : 'none';
        
        updateBackground();
    });

    // Background color change
    bgColorInput.addEventListener('input', () => {
        if (bgTypeSelect.value === 'color') {
            updateBackground();
        }
    });

    // Background image upload
    bgImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                backgroundImageUrl = event.target.result;
                updateBackground();
            };
            reader.readAsDataURL(file);
        }
    });

    // Background video upload
    bgVideoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                backgroundVideoUrl = event.target.result;
                updateBackground();
            };
            reader.readAsDataURL(file);
        }
    });

    // Background music upload
    bgMusicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                backgroundMusicUrl = event.target.result;
                bgMusicElement.src = backgroundMusicUrl;
            };
            reader.readAsDataURL(file);
        }
    });

    function updateBackground() {
        const type = bgTypeSelect.value;
        chatBackground.innerHTML = '';
        bgVideoElement.style.display = 'none';
        
        if (type === 'color') {
            chatBackground.style.backgroundColor = bgColorInput.value;
        } else if (type === 'image' && backgroundImageUrl) {
            chatBackground.style.backgroundColor = 'transparent';
            const img = document.createElement('img');
            img.src = backgroundImageUrl;
            chatBackground.appendChild(img);
        } else if (type === 'video' && backgroundVideoUrl) {
            chatBackground.style.backgroundColor = 'transparent';
            bgVideoElement.src = backgroundVideoUrl;
            bgVideoElement.style.display = 'block';
            bgVideoElement.play();
            chatBackground.appendChild(bgVideoElement);
        }
    }

    function addMessageInput(text = '', sender = 'sent', delay = 0) {
        messageCount++;
        const messageGroup = document.createElement('div');
        messageGroup.classList.add('message-input-group');
        messageGroup.draggable = true;
        messageGroup.innerHTML = `
            <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
            <select>
                <option value="sent" ${sender === 'sent' ? 'selected' : ''}>Sender</option>
                <option value="received" ${sender === 'received' ? 'selected' : ''}>Receiver</option>
                <option value="neutral" ${sender === 'neutral' ? 'selected' : ''}>Neutral</option>
            </select>
            <input type="text" class="message-text" placeholder="Type a message..." value="${text}">
            <input type="number" class="message-delay" placeholder="Delay (s)" value="${delay}" min="0" step="0.5" title="Extra delay before this message (seconds)">
            <div class="message-controls">
                <button class="move-up-btn" title="Move up">↑</button>
                <button class="move-down-btn" title="Move down">↓</button>
                <button class="delete-btn" title="Delete">×</button>
            </div>
        `;
        
        // Add event listeners for move/delete buttons
        const moveUpBtn = messageGroup.querySelector('.move-up-btn');
        const moveDownBtn = messageGroup.querySelector('.move-down-btn');
        const deleteBtn = messageGroup.querySelector('.delete-btn');
        
        moveUpBtn.addEventListener('click', () => moveMessage(messageGroup, -1));
        moveDownBtn.addEventListener('click', () => moveMessage(messageGroup, 1));
        deleteBtn.addEventListener('click', () => deleteMessage(messageGroup));
        
        // Add drag and drop event listeners
        messageGroup.addEventListener('dragstart', handleDragStart);
        messageGroup.addEventListener('dragover', handleDragOver);
        messageGroup.addEventListener('drop', handleDrop);
        messageGroup.addEventListener('dragend', handleDragEnd);
        
        messagesScriptContainer.appendChild(messageGroup);
    }
    
    function moveMessage(messageGroup, direction) {
        const sibling = direction === -1 ? messageGroup.previousElementSibling : messageGroup.nextElementSibling;
        if (sibling) {
            if (direction === -1) {
                messagesScriptContainer.insertBefore(messageGroup, sibling);
            } else {
                messagesScriptContainer.insertBefore(sibling, messageGroup);
            }
        }
    }
    
    function deleteMessage(messageGroup) {
        if (confirm('Delete this message?')) {
            messageGroup.remove();
        }
    }
    
    // Drag and drop functionality
    let draggedElement = null;
    
    function handleDragStart(e) {
        draggedElement = this;
        this.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
    }
    
    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        
        if (this !== draggedElement) {
            const rect = this.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (e.clientY < midpoint) {
                this.parentNode.insertBefore(draggedElement, this);
            } else {
                this.parentNode.insertBefore(draggedElement, this.nextSibling);
            }
        }
        
        return false;
    }
    
    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        return false;
    }
    
    function handleDragEnd(e) {
        this.style.opacity = '1';
        draggedElement = null;
    }
    
    function importConversation() {
        const text = document.getElementById('import-text').value.trim();
        if (!text) {
            alert('Please paste a conversation to import');
            return;
        }
        
        // Clear existing messages
        messagesScriptContainer.innerHTML = '';
        messageCount = 0;
        
        const lines = text.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (!line) continue; // Skip empty lines
            
            // Parse "Name: message" format
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) continue; // Skip lines without colon
            
            const name = line.substring(0, colonIndex).trim();
            const message = line.substring(colonIndex + 1).trim();
            
            if (!message) continue; // Skip if no message
            
            // "Me" = sent, anything else = received
            const sender = name.toLowerCase() === 'me' ? 'sent' : 'received';
            addMessageInput(message, sender);
        }
        
        document.getElementById('import-text').value = '';
        alert('Conversation imported!');
    }

    function getMessages() {
        const messages = [];
        const messageInputs = document.querySelectorAll('.message-input-group');
        messageInputs.forEach(group => {
            const sender = group.querySelector('select').value;
            const text = group.querySelector('.message-text').value.trim();
            const delay = parseFloat(group.querySelector('.message-delay').value) || 0;
            if (text) {
                messages.push({ sender, text, delay });
            }
        });
        return messages;
    }
    
    // Sound Effects - iOS-like sounds using Web Audio API
    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContext;
    }
    
    function playSendSound() {
        if (!soundEffectsCheckbox.checked) return;
        
        const ctx = initAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // iOS send sound: quick "whoosh" upward sweep
        oscillator.frequency.setValueAtTime(600, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        
        const volume = parseFloat(sendVolumeInput.value) / 100;
        gainNode.gain.setValueAtTime(0.3 * volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, ctx.currentTime + 0.1);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.1);
    }
    
    function playReceiveSound() {
        if (!soundEffectsCheckbox.checked) return;
        
        const ctx = initAudioContext();
        
        // iOS receive sound: two-tone notification
        const oscillator1 = ctx.createOscillator();
        const oscillator2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // First tone
        oscillator1.frequency.setValueAtTime(800, ctx.currentTime);
        oscillator1.type = 'sine';
        
        // Second tone (slightly lower)
        oscillator2.frequency.setValueAtTime(600, ctx.currentTime + 0.08);
        oscillator2.type = 'sine';
        
        const volume = parseFloat(receiveVolumeInput.value) / 100;
        gainNode.gain.setValueAtTime(0.2 * volume, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.2 * volume, ctx.currentTime + 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, ctx.currentTime + 0.25);
        
        oscillator1.start(ctx.currentTime);
        oscillator1.stop(ctx.currentTime + 0.08);
        
        oscillator2.start(ctx.currentTime + 0.08);
        oscillator2.stop(ctx.currentTime + 0.25);
    }
    
    function playTypingSound() {
        if (!soundEffectsCheckbox.checked) return;
        
        const ctx = initAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Subtle click sound for typing
        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        oscillator.type = 'square';
        
        const volume = parseFloat(typingVolumeInput.value) / 100;
        gainNode.gain.setValueAtTime(0.05 * volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, ctx.currentTime + 0.02);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.02);
    }

    async function typeCharacterByCharacter(element, text, speed) {
        element.textContent = '';
        for (let char of text) {
            element.textContent += char;
            await sleep(speed);
        }
    }

    function stopAnimation() {
        shouldStopAnimation = true;
        previewBtn.textContent = 'Preview Animation';
        previewBtn.disabled = true;
    }
    
    async function animateConversation() {
        if (isAnimating) {
            stopAnimation();
            return;
        }
        
        isAnimating = true;
        shouldStopAnimation = false;
        previewBtn.textContent = 'Stop Preview';
        previewBtn.disabled = false;
        exportBtn.disabled = true;
        
        // Clear existing messages
        chatMessagesContainer.innerHTML = '';
        const imessageInput = document.getElementById('imessage-input');
        imessageInput.textContent = '';
        imessageInput.classList.remove('active');
        
        // Start background music if available
        if (backgroundMusicUrl) {
            bgMusicElement.currentTime = 0;
            bgMusicElement.play();
        }
        
        // Start video if background is video
        if (bgTypeSelect.value === 'video' && backgroundVideoUrl) {
            bgVideoElement.currentTime = 0;
            bgVideoElement.play();
        }
        
        const messages = getMessages();
        const senderDelay = parseInt(senderDelayInput.value);
        const receiverDelay = parseInt(receiverDelayInput.value);
        const baseTypingDelay = parseInt(typingDelayInput.value);
        const typingPerChar = parseInt(typingPerCharInput.value);
        const typingSpeed = parseInt(typingSpeedInput.value);

        for (let i = 0; i < messages.length; i++) {
            if (shouldStopAnimation) break;
            
            const message = messages[i];
            
            // Add extra delay if specified
            if (message.delay > 0) {
                await sleep(message.delay * 1000);
                if (shouldStopAnimation) break;
            }
            
            const delay = message.sender === 'sent' ? senderDelay : receiverDelay;
            
            // For sent messages, type character by character in iMessage input first
            if (message.sender === 'sent') {
                imessageInput.classList.add('active');
                
                // Type with sound effects
                for (let char of message.text) {
                    imessageInput.textContent += char;
                    playTypingSound();
                    await sleep(typingSpeed);
                    if (shouldStopAnimation) {
                        imessageInput.textContent = '';
                        imessageInput.classList.remove('active');
                        break;
                    }
                }
                
                if (shouldStopAnimation) break;
                
                await sleep(300);
                playSendSound();
                imessageInput.textContent = '';
                imessageInput.classList.remove('active');
            }
            
            // Show typing indicator for received messages
            if (message.sender === 'received') {
                // Calculate typing delay based on message length
                const typingDelay = baseTypingDelay + (message.text.length * typingPerChar);
                
                // Add "..." message bubble
                const typingMessage = document.createElement('div');
                typingMessage.classList.add('message', 'received', 'visible');
                typingMessage.textContent = '...';
                chatMessagesContainer.appendChild(typingMessage);
                chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                
                await sleep(typingDelay);
                
                // Remove the "..." message
                typingMessage.remove();
                
                if (shouldStopAnimation) break;
            }
            
            // Add message
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', message.sender);
            messageElement.textContent = message.text;
            chatMessagesContainer.appendChild(messageElement);
            
            // Play receive sound for received messages
            if (message.sender === 'received') {
                playReceiveSound();
            }
            
            // Trigger animation
            await sleep(50);
            messageElement.classList.add('visible');
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
            
            // Wait before next message
            if (i < messages.length - 1) {
                await sleep(delay);
            }
        }
        
        // Stop background music
        if (backgroundMusicUrl) {
            bgMusicElement.pause();
        }
        
        isAnimating = false;
        shouldStopAnimation = false;
        previewBtn.textContent = 'Preview Animation';
        previewBtn.disabled = false;
        exportBtn.disabled = false;
    }

    async function exportVideo() {
        try {
            exportBtn.textContent = 'Preparing...';
            exportBtn.disabled = true;
            previewBtn.disabled = true;

            // Create a canvas to capture the phone screen
            const canvas = document.createElement('canvas');
            canvas.width = phoneScreen.offsetWidth;
            canvas.height = phoneScreen.offsetHeight;
            const ctx = canvas.getContext('2d');

            // Get video stream from canvas
            const videoStream = canvas.captureStream(30);
            
            // Combine video and audio streams if music is available
            let combinedStream;
            if (backgroundMusicUrl) {
                try {
                    // Create audio context to capture music
                    const audioContext = new AudioContext();
                    const source = audioContext.createMediaElementSource(bgMusicElement);
                    const destination = audioContext.createMediaStreamDestination();
                    source.connect(destination);
                    source.connect(audioContext.destination); // Also play the audio
                    
                    // Combine video and audio
                    combinedStream = new MediaStream([
                        ...videoStream.getVideoTracks(),
                        ...destination.stream.getAudioTracks()
                    ]);
                } catch (error) {
                    console.warn('Failed to capture audio, recording video only:', error);
                    combinedStream = videoStream;
                }
            } else {
                combinedStream = videoStream;
            }
            
            recordedChunks = [];
            
            mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 2500000
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'conversation.webm';
                a.click();
                URL.revokeObjectURL(url);
                
                exportBtn.textContent = 'Export as Video';
                exportBtn.disabled = false;
                previewBtn.disabled = false;
            };

            // Start recording
            mediaRecorder.start();
            exportBtn.textContent = 'Recording...';

            // Capture frames
            async function captureToCanvas() {
                const screenshot = await html2canvas(phoneScreen, {
                    logging: false,
                    useCORS: true,
                    allowTaint: true,
                    scale: 1
                });
                ctx.drawImage(screenshot, 0, 0, canvas.width, canvas.height);
            }

            // Clear existing messages
            chatMessagesContainer.innerHTML = '';
            const imessageInput = document.getElementById('imessage-input');
            imessageInput.textContent = '';
            imessageInput.classList.remove('active');

            // Start background music if available
            if (backgroundMusicUrl) {
                bgMusicElement.currentTime = 0;
                bgMusicElement.play();
            }

            // Start video if background is video
            if (bgTypeSelect.value === 'video' && backgroundVideoUrl) {
                bgVideoElement.currentTime = 0;
                bgVideoElement.play();
            }

            const messages = getMessages();
            const senderDelay = parseInt(senderDelayInput.value);
            const receiverDelay = parseInt(receiverDelayInput.value);
            const baseTypingDelay = parseInt(typingDelayInput.value);
            const typingPerChar = parseInt(typingPerCharInput.value);
            const typingSpeed = parseInt(typingSpeedInput.value);

            // Initial capture
            await captureToCanvas();
            await sleep(500);

            // Animate and capture - run animation in real-time, capture at 15fps to reduce lag
            const targetFPS = 15; // Reduced from 30 to minimize lag
            const frameInterval = 1000 / targetFPS;
            
            // Start a consistent frame capture loop
            const captureLoop = setInterval(async () => {
                await captureToCanvas();
            }, frameInterval);
            
            // Animate and capture
            for (let i = 0; i < messages.length; i++) {
                const message = messages[i];
                
                // Add extra delay if specified
                if (message.delay > 0) {
                    await sleep(message.delay * 1000);
                }
                
                const delay = message.sender === 'sent' ? senderDelay : receiverDelay;
                
                // For sent messages, type character by character in iMessage input
                if (message.sender === 'sent') {
                    imessageInput.classList.add('active');
                    
                    for (let char of message.text) {
                        imessageInput.textContent += char;
                        await sleep(typingSpeed);
                    }
                    
                    await sleep(300);
                    imessageInput.textContent = '';
                    imessageInput.classList.remove('active');
                }
                
                // Show typing indicator for received messages
                if (message.sender === 'received') {
                    // Calculate typing delay based on message length
                    const typingDelay = baseTypingDelay + (message.text.length * typingPerChar);
                    
                    // Add "..." message bubble
                    const typingMessage = document.createElement('div');
                    typingMessage.classList.add('message', 'received', 'visible');
                    typingMessage.textContent = '...';
                    chatMessagesContainer.appendChild(typingMessage);
                    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                    
                    await sleep(typingDelay);
                    
                    // Remove the "..." message
                    typingMessage.remove();
                }
                
                // Add message
                const messageElement = document.createElement('div');
                messageElement.classList.add('message', message.sender, 'visible');
                messageElement.textContent = message.text;
                chatMessagesContainer.appendChild(messageElement);
                chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                
                // Wait before next message
                await sleep(delay);
            }

            // Final pause
            await sleep(1000);
            
            // Stop capture loop
            clearInterval(captureLoop);

            // Stop background music
            if (backgroundMusicUrl) {
                bgMusicElement.pause();
            }

            // Stop recording
            mediaRecorder.stop();

        } catch (error) {
            console.error('Error exporting video:', error);
            alert('Error exporting video: ' + error.message + '\n\nPlease check the console for more details.');
            exportBtn.textContent = 'Export as Video';
            exportBtn.disabled = false;
            previewBtn.disabled = false;
        }
    }

    // Save/Load functionality
    function saveConversation() {
        const name = saveNameInput.value.trim();
        if (!name) {
            alert('Please enter a name for this conversation');
            return;
        }

        const data = {
            name,
            messages: getMessages(),
            settings: {
                profileName: profileNameInput.value,
                messageCount: messageCountInput.value,
                profilePic: profilePicUrl,
                bgType: bgTypeSelect.value,
                bgColor: bgColorInput.value,
                bgImage: backgroundImageUrl,
                bgVideo: backgroundVideoUrl,
                bgMusic: backgroundMusicUrl,
                senderDelay: senderDelayInput.value,
                receiverDelay: receiverDelayInput.value,
                typingDelay: typingDelayInput.value,
                typingPerChar: typingPerCharInput.value,
                typingSpeed: typingSpeedInput.value,
                soundEffects: soundEffectsCheckbox.checked,
                typingVolume: typingVolumeInput.value,
                sendVolume: sendVolumeInput.value,
                receiveVolume: receiveVolumeInput.value
            }
        };

        const saved = JSON.parse(localStorage.getItem('savedConversations') || '{}');
        saved[name] = data;
        localStorage.setItem('savedConversations', JSON.stringify(saved));
        
        loadSavedConversationsList();
        saveNameInput.value = '';
        alert('Conversation saved!');
    }

    function loadSavedConversationsList() {
        const saved = JSON.parse(localStorage.getItem('savedConversations') || '{}');
        savedConversationsSelect.innerHTML = '';
        
        const names = Object.keys(saved);
        if (names.length === 0) {
            savedConversationsSelect.innerHTML = '<option value="">-- No saved conversations --</option>';
        } else {
            names.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                savedConversationsSelect.appendChild(option);
            });
        }
    }

    function loadConversation() {
        const name = savedConversationsSelect.value;
        if (!name) {
            alert('Please select a conversation to load');
            return;
        }

        const saved = JSON.parse(localStorage.getItem('savedConversations') || '{}');
        const data = saved[name];
        
        if (!data) {
            alert('Conversation not found');
            return;
        }

        // Load settings
        const s = data.settings;
        profileNameInput.value = s.profileName;
        headerProfileName.textContent = s.profileName;
        
        if (s.messageCount !== undefined) {
            messageCountInput.value = s.messageCount;
            backCount.textContent = s.messageCount;
        }
        
        if (s.profilePic) {
            profilePicUrl = s.profilePic;
            headerProfilePic.src = profilePicUrl;
            headerProfilePic.style.display = 'block';
        }
        
        bgTypeSelect.value = s.bgType;
        bgColorInput.value = s.bgColor;
        backgroundImageUrl = s.bgImage;
        backgroundVideoUrl = s.bgVideo;
        backgroundMusicUrl = s.bgMusic;
        
        if (backgroundMusicUrl) {
            bgMusicElement.src = backgroundMusicUrl;
        }
        
        senderDelayInput.value = s.senderDelay;
        receiverDelayInput.value = s.receiverDelay;
        typingDelayInput.value = s.typingDelay;
        typingPerCharInput.value = s.typingPerChar || 30;
        typingSpeedInput.value = s.typingSpeed;
        soundEffectsCheckbox.checked = s.soundEffects !== undefined ? s.soundEffects : true;
        typingVolumeInput.value = s.typingVolume || 50;
        sendVolumeInput.value = s.sendVolume || 50;
        receiveVolumeInput.value = s.receiveVolume || 50;
        
        document.getElementById('sender-delay-value').textContent = s.senderDelay;
        document.getElementById('receiver-delay-value').textContent = s.receiverDelay;
        document.getElementById('typing-delay-value').textContent = s.typingDelay;
        document.getElementById('typing-per-char-value').textContent = s.typingPerChar || 30;
        document.getElementById('typing-speed-value').textContent = s.typingSpeed;
        document.getElementById('typing-volume-value').textContent = s.typingVolume || 50;
        document.getElementById('send-volume-value').textContent = s.sendVolume || 50;
        document.getElementById('receive-volume-value').textContent = s.receiveVolume || 50;
        
        updateBackground();
        
        // Load messages
        messagesScriptContainer.innerHTML = '';
        messageCount = 0;
        data.messages.forEach(msg => {
            addMessageInput(msg.text, msg.sender, msg.delay || 0);
        });
        
        alert('Conversation loaded!');
    }

    function deleteConversation() {
        const name = savedConversationsSelect.value;
        if (!name) {
            alert('Please select a conversation to delete');
            return;
        }

        if (!confirm(`Delete conversation "${name}"?`)) {
            return;
        }

        const saved = JSON.parse(localStorage.getItem('savedConversations') || '{}');
        delete saved[name];
        localStorage.setItem('savedConversations', JSON.stringify(saved));
        
        loadSavedConversationsList();
        alert('Conversation deleted!');
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Hamburger Menu and Overlay Functions
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const menuOverlay = document.getElementById('menu-overlay');
    const closeOverlayBtn = document.getElementById('close-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayBody = document.getElementById('overlay-body');
    
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const saveLoadMenuBtn = document.getElementById('save-load-menu-btn');
    
    function openOverlay(title, content) {
        overlayTitle.textContent = title;
        overlayBody.innerHTML = content;
        menuOverlay.classList.add('active');
    }
    
    function closeOverlay() {
        menuOverlay.classList.remove('active');
    }
    
    hamburgerBtn.addEventListener('click', () => {
        const content = `
            <div style="text-align: center;">
                <button onclick="document.getElementById('profile-menu-btn').click(); document.getElementById('close-overlay').click();" style="width: 100%; padding: 15px; margin: 10px 0; font-size: 16px; cursor: pointer; border: none; border-radius: 8px; background-color: #007aff; color: white;">👤 Profile Settings</button>
                <button onclick="document.getElementById('save-load-menu-btn').click(); document.getElementById('close-overlay').click();" style="width: 100%; padding: 15px; margin: 10px 0; font-size: 16px; cursor: pointer; border: none; border-radius: 8px; background-color: #007aff; color: white;">💾 Save/Load</button>
            </div>
        `;
        openOverlay('Menu', content);
    });
    
    closeOverlayBtn.addEventListener('click', closeOverlay);
    menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) closeOverlay();
    });
    
    profileMenuBtn.addEventListener('click', () => {
        const currentTime = document.querySelector('.time').textContent;
        const content = `
            <div class="setting-group">
                <label>Profile Name:</label>
                <input type="text" id="overlay-profile-name" value="${profileNameInput.value}" style="padding: 8px; border-radius: 5px; border: 1px solid #ccc; width: 200px;">
            </div>
            <div class="setting-group" style="margin-top: 15px;">
                <label>Profile Picture:</label>
                <button onclick="document.getElementById('profile-picture').click()" style="padding: 8px 15px; cursor: pointer; border: none; border-radius: 5px; background-color: #007aff; color: white;">Choose File</button>
            </div>
            <div class="setting-group" style="margin-top: 15px;">
                <label>Message Count:</label>
                <input type="number" id="overlay-message-count" value="${messageCountInput.value}" min="0" style="padding: 8px; border-radius: 5px; border: 1px solid #ccc; width: 100px;">
            </div>
            <div class="setting-group" style="margin-top: 15px;">
                <label>Time Display:</label>
                <input type="time" id="overlay-time" value="${currentTime}" style="padding: 8px; border-radius: 5px; border: 1px solid #ccc; width: 150px;">
            </div>
            <button id="save-profile-btn" style="width: 100%; padding: 12px; margin-top: 20px; font-size: 16px; cursor: pointer; border: none; border-radius: 8px; background-color: #28a745; color: white;">Save Profile</button>
        `;
        openOverlay('Profile Settings', content);
        
        setTimeout(() => {
            document.getElementById('save-profile-btn').addEventListener('click', () => {
                profileNameInput.value = document.getElementById('overlay-profile-name').value;
                messageCountInput.value = document.getElementById('overlay-message-count').value;
                const timeValue = document.getElementById('overlay-time').value;
                headerProfileName.textContent = profileNameInput.value || 'My Brain';
                backCount.textContent = messageCountInput.value || '147';
                if (timeValue) {
                    document.querySelector('.time').textContent = timeValue;
                }
                closeOverlay();
                alert('Profile updated!');
            });
        }, 100);
    });
    
    saveLoadMenuBtn.addEventListener('click', () => {
        loadSavedConversationsList();
        const savedList = savedConversationsSelect.innerHTML;
        
        const content = `
            <h3>Save Current Conversation</h3>
            <div style="margin-bottom: 20px;">
                <input type="text" id="overlay-save-name" placeholder="Conversation name..." style="width: 100%; padding: 10px; border-radius: 5px; border: 1px solid #ccc; margin-bottom: 10px;">
                <button id="overlay-save-btn" style="width: 48%; padding: 10px; cursor: pointer; border: none; border-radius: 5px; background-color: #28a745; color: white; margin-right: 2%;">💾 Save to Browser</button>
                <button id="overlay-export-btn" style="width: 48%; padding: 10px; cursor: pointer; border: none; border-radius: 5px; background-color: #007aff; color: white; margin-left: 2%;">📥 Export to File</button>
            </div>
            
            <h3>Load Conversation</h3>
            <select id="overlay-saved-conversations" size="5" style="width: 100%; padding: 10px; border-radius: 5px; border: 1px solid #ccc; margin-bottom: 10px;">${savedList}</select>
            <button id="overlay-load-btn" style="width: 48%; padding: 10px; cursor: pointer; border: none; border-radius: 5px; background-color: #007aff; color: white; margin-right: 2%;">📂 Load</button>
            <button id="overlay-delete-btn" style="width: 48%; padding: 10px; cursor: pointer; border: none; border-radius: 5px; background-color: #dc3545; color: white; margin-left: 2%;">🗑️ Delete</button>
            
            <h3 style="margin-top: 20px;">Import from File</h3>
            <input type="file" id="overlay-import-file" accept=".json" style="width: 100%; padding: 10px; margin-bottom: 10px;">
            <button id="overlay-import-btn" style="width: 100%; padding: 10px; cursor: pointer; border: none; border-radius: 5px; background-color: #17a2b8; color: white;">📤 Import File</button>
        `;
        openOverlay('Save/Load Conversations', content);
        
        setTimeout(() => {
            document.getElementById('overlay-save-btn').addEventListener('click', () => {
                const name = document.getElementById('overlay-save-name').value.trim();
                if (!name) {
                    alert('Please enter a name');
                    return;
                }
                saveNameInput.value = name;
                saveConversation();
                saveLoadMenuBtn.click();
            });
            
            document.getElementById('overlay-export-btn').addEventListener('click', () => {
                const name = document.getElementById('overlay-save-name').value.trim() || 'conversation';
                exportConversationToFile(name);
            });
            
            document.getElementById('overlay-load-btn').addEventListener('click', () => {
                const select = document.getElementById('overlay-saved-conversations');
                savedConversationsSelect.value = select.value;
                loadConversation();
                closeOverlay();
            });
            
            document.getElementById('overlay-delete-btn').addEventListener('click', () => {
                const select = document.getElementById('overlay-saved-conversations');
                savedConversationsSelect.value = select.value;
                deleteConversation();
                saveLoadMenuBtn.click();
            });
            
            document.getElementById('overlay-import-btn').addEventListener('click', () => {
                const fileInput = document.getElementById('overlay-import-file');
                const file = fileInput.files[0];
                if (file) {
                    importConversationFromFile(file);
                }
            });
        }, 100);
    });
    
    function exportConversationToFile(name) {
        const data = {
            name,
            messages: getMessages(),
            settings: {
                profileName: profileNameInput.value,
                messageCount: messageCountInput.value,
                profilePic: profilePicUrl,
                bgType: bgTypeSelect.value,
                bgColor: bgColorInput.value,
                bgImage: backgroundImageUrl,
                bgVideo: backgroundVideoUrl,
                bgMusic: backgroundMusicUrl,
                senderDelay: senderDelayInput.value,
                receiverDelay: receiverDelayInput.value,
                typingDelay: typingDelayInput.value,
                typingPerChar: typingPerCharInput.value,
                typingSpeed: typingSpeedInput.value,
                soundEffects: soundEffectsCheckbox.checked,
                typingVolume: typingVolumeInput.value,
                sendVolume: sendVolumeInput.value,
                receiveVolume: receiveVolumeInput.value
            }
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('Conversation exported to file!');
    }
    
    function importConversationFromFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Load settings
                const s = data.settings;
                profileNameInput.value = s.profileName;
                headerProfileName.textContent = s.profileName;
                
                if (s.messageCount !== undefined) {
                    messageCountInput.value = s.messageCount;
                    backCount.textContent = s.messageCount;
                }
                
                if (s.profilePic) {
                    profilePicUrl = s.profilePic;
                    headerProfilePic.src = profilePicUrl;
                    headerProfilePic.style.display = 'block';
                }
                
                bgTypeSelect.value = s.bgType;
                bgColorInput.value = s.bgColor;
                backgroundImageUrl = s.bgImage;
                backgroundVideoUrl = s.bgVideo;
                backgroundMusicUrl = s.bgMusic;
                
                if (backgroundMusicUrl) {
                    bgMusicElement.src = backgroundMusicUrl;
                }
                
                senderDelayInput.value = s.senderDelay;
                receiverDelayInput.value = s.receiverDelay;
                typingDelayInput.value = s.typingDelay;
                typingPerCharInput.value = s.typingPerChar || 30;
                typingSpeedInput.value = s.typingSpeed;
                soundEffectsCheckbox.checked = s.soundEffects !== undefined ? s.soundEffects : true;
                typingVolumeInput.value = s.typingVolume || 50;
                sendVolumeInput.value = s.sendVolume || 50;
                receiveVolumeInput.value = s.receiveVolume || 50;
                
                document.getElementById('sender-delay-value').textContent = s.senderDelay;
                document.getElementById('receiver-delay-value').textContent = s.receiverDelay;
                document.getElementById('typing-delay-value').textContent = s.typingDelay;
                document.getElementById('typing-per-char-value').textContent = s.typingPerChar || 30;
                document.getElementById('typing-speed-value').textContent = s.typingSpeed;
                document.getElementById('typing-volume-value').textContent = s.typingVolume || 50;
                document.getElementById('send-volume-value').textContent = s.sendVolume || 50;
                document.getElementById('receive-volume-value').textContent = s.receiveVolume || 50;
                
                updateBackground();
                
                // Load messages
                messagesScriptContainer.innerHTML = '';
                messageCount = 0;
                data.messages.forEach(msg => {
                    addMessageInput(msg.text, msg.sender, msg.delay || 0);
                });
                
                closeOverlay();
                alert('Conversation imported from file!');
            } catch (error) {
                alert('Error importing file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    addMessageBtn.addEventListener('click', () => addMessageInput());
    previewBtn.addEventListener('click', animateConversation);
    exportBtn.addEventListener('click', exportVideo);
    document.getElementById('import-btn').addEventListener('click', importConversation);

    // Add sample messages on load
    addMessageInput("Hello there!", "sent");
    addMessageInput("Hi! How are you?", "received");
    addMessageInput("I'm good, thanks!", "sent");
    
    // Initialize with default background
    updateBackground();
    
    // Load saved conversations list
    loadSavedConversationsList();
});
