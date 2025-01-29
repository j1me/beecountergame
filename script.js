class BeeGame {
    constructor() {
        this.beeContainer = document.getElementById('beeContainer');
        this.beeCount = document.getElementById('beeCount');
        this.submitButton = document.getElementById('submitCount');
        this.feedback = document.getElementById('feedback');
        this.highScoreElement = document.getElementById('highScore');
        this.resetButton = document.getElementById('resetGame');
        
        this.bees = [];
        this.highestCorrectCount = 0;
        this.isGenerating = false;
        this.isInputFocused = false;  // New flag to track input focus state
        
        // Track the last filled position
        this.lastFilledPosition = 0;
        // Spacing configuration
        this.minSpacing = 40;  // Minimum pixels between bees
        this.maxSpacing = 80;  // Maximum pixels between bees
        // Size of bee element for calculations
        this.beeSize = 30;  // Approximate size of bee emoji
        
        // Calculate usable viewport height (70% for new bees)
        this.usableViewportHeight = window.innerHeight * 0.8; // for initial bees
        this.newBeeViewportHeight = window.innerHeight * 0.7; // for scrolling bees
        
        // Track if we're at the bottom
        this.reachedBottom = false;
        
        // Add last scroll position tracking
        this.lastScrollPosition = 0;
        
        // Add grid tracking for bee positions
        this.beePositions = new Set();
        this.gridSize = this.beeSize + 10; // Size of each grid cell
        
        this.certificateModal = document.getElementById('certificateModal');
        this.certCount = document.getElementById('certCount');
        this.certName = document.getElementById('certName');
        this.generateCertButton = document.getElementById('generateCert');
        this.closeCertButton = document.getElementById('closeCert');
        
        this.shareButton = document.getElementById('shareButton');
        
        this.leaderboardModal = document.getElementById('leaderboardModal');
        this.leaderboardButton = document.getElementById('leaderboardButton');
        this.closeLeaderboardButton = document.getElementById('closeLeaderboard');
        this.leaderboardBody = document.getElementById('leaderboardBody');
        
        // Google Apps Script URL
        this.apiUrl = 'https://script.google.com/macros/s/AKfycbzgK72WqEMmZZw9z-qiD_s7TQZxKMa7jPrk5GkWpdzVd3tfJlIb31lRa5NVpEOO5xMRcg/exec';
        
        this.init();
    }

    init() {
        // Reset scroll position
        window.scrollTo(0, 0);
        this.setupEventListeners();
        this.initializeContainer();
        this.fillInitialViewport();
        this.setupShareButton();
        this.setupLeaderboardHandlers();
        this.loadLeaderboard(); // Load leaderboard on startup
    }

    setupEventListeners() {
        this.submitButton.addEventListener('click', () => this.checkAnswer());
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkAnswer();
        });

        // Add focus and blur event listeners for the input
        this.beeCount.addEventListener('focus', () => {
            this.isInputFocused = true;
        });
        
        this.beeCount.addEventListener('blur', () => {
            this.isInputFocused = false;
        });

        // Efficient scroll handling
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            // Don't generate bees if input is focused
            if (this.isInputFocused) return;
            
            if (scrollTimeout) return;
            scrollTimeout = setTimeout(() => {
                this.handleScroll();
                scrollTimeout = null;
            }, 30);
        });

        // Add reset button listener
        this.resetButton.addEventListener('click', () => {
            window.scrollTo(0, 0);
            this.initializeContainer();
            this.fillInitialViewport();
        });

        // Help modal functionality
        const helpModal = document.getElementById('helpModal');
        const helpButton = document.getElementById('helpButton');
        const closeHelp = document.getElementById('closeHelp');

        helpButton.addEventListener('click', () => {
            helpModal.style.display = 'block';
        });

        closeHelp.addEventListener('click', () => {
            helpModal.style.display = 'none';
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.style.display = 'none';
            }
        });

        // Certificate modal handlers
        this.generateCertButton.addEventListener('click', () => this.generateCertificate());
        this.closeCertButton.addEventListener('click', () => {
            this.certificateModal.style.display = 'none';
        });
    }

    setupShareButton() {
        this.shareButton.addEventListener('click', () => this.handleShare());
    }

    async handleShare() {
        const shareData = {
            title: '🐝 Test Your Counting Skills: How Many Bees Can You Spot?',
            text: 'The bees are buzzing, and the challenge gets harder as you scroll! Can you keep up? 🐝✨',
            url: 'https://beecountergame.jimmeyjose.com'
        };

        try {
            if (navigator.share) {
                // Use native share on mobile
                await navigator.share(shareData);
            } else {
                // Fallback for desktop: copy link to clipboard
                await navigator.clipboard.writeText(shareData.url);
                this.showFeedback('Link copied to clipboard!', true);
            }
        } catch (err) {
            console.error('Error sharing:', err);
            // Only show error if it's not a user cancellation
            if (err.name !== 'AbortError') {
                this.showFeedback('Could not share the game. Try copying the URL from your browser.', false);
            }
        }
    }

    initializeContainer() {
        // Clear any existing bees
        this.bees.forEach(bee => bee.remove());
        this.bees = [];
        this.lastFilledPosition = 0;
        this.reachedBottom = false;
        
        // Set initial container height larger to enable scrolling
        this.beeContainer.style.minHeight = '200vh';
        this.beePositions.clear();
    }

    fillInitialViewport() {
        this.isGenerating = true;
        let currentTop = 20; // Start 20px from top
        
        // Only fill up to 80% of viewport height
        while (currentTop + this.beeSize < this.usableViewportHeight) {
            currentTop = this.createBee(currentTop, true);
            currentTop += this.minSpacing + Math.random() * (this.maxSpacing - this.minSpacing);
        }
        
        // Set last filled position
        this.lastFilledPosition = currentTop;
        this.isGenerating = false;
    }

    createBee(basePosition, isInitial = false) {
        const spacing = isInitial ? 0 : this.minSpacing + Math.random() * (this.maxSpacing - this.minSpacing);
        let top;
        
        if (isInitial) {
            top = basePosition;
        } else {
            const scrollPosition = window.scrollY;
            const visibleTop = scrollPosition;
            const visibleBottom = scrollPosition + this.newBeeViewportHeight;
            top = visibleTop + Math.random() * (visibleBottom - visibleTop - this.beeSize);
        }

        // Get container dimensions
        const containerWidth = this.beeContainer.clientWidth;
        const padding = 40;
        
        // Try to find a non-overlapping position (max 10 attempts)
        let attempts = 0;
        let position = null;
        
        while (attempts < 10) {
            const left = padding + Math.random() * (containerWidth - 2 * padding);
            
            // Check grid cells around the potential position
            const gridX = Math.floor(left / this.gridSize);
            const gridY = Math.floor(top / this.gridSize);
            const positionKey = `${gridX},${gridY}`;
            
            // Check surrounding cells for other bees
            let hasOverlap = false;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const checkKey = `${gridX + dx},${gridY + dy}`;
                    if (this.beePositions.has(checkKey)) {
                        hasOverlap = true;
                        break;
                    }
                }
                if (hasOverlap) break;
            }
            
            if (!hasOverlap) {
                position = { left, top, gridKey: positionKey };
                break;
            }
            
            attempts++;
        }
        
        // If no non-overlapping position found, return null
        if (!position) {
            return null;
        }
        
        const bee = document.createElement('div');
        bee.className = 'bee';
        if (!isInitial) {
            bee.classList.add('bee-appear');
        }
        bee.textContent = '🐝';
        
        const rotation = Math.random() * 360;
        
        bee.style.left = `${position.left}px`;
        bee.style.top = `${position.top}px`;
        bee.style.transform = `rotate(${rotation}deg)`;
        
        this.beeContainer.appendChild(bee);
        this.bees.push(bee);
        
        // Store the position in our grid
        this.beePositions.add(position.gridKey);
        
        this.lastFilledPosition = Math.max(this.lastFilledPosition, position.top);
        return position.top;
    }

    handleScroll() {
        if (this.isGenerating || this.reachedBottom) return;
        
        const scrollPosition = window.scrollY;
        const windowHeight = window.innerHeight;
        const scrollBottom = scrollPosition + windowHeight;
        const containerHeight = this.beeContainer.offsetHeight;
        
        // Only generate bees when scrolling down
        const isScrollingDown = scrollPosition > this.lastScrollPosition;
        this.lastScrollPosition = scrollPosition;
        
        // Generate when scrolling down and reached trigger point
        if (isScrollingDown && scrollBottom > this.lastFilledPosition - windowHeight * 0.3) {
            this.generateNextBee();
            
            // Extend container if needed
            const newMinHeight = Math.max(
                containerHeight,
                scrollBottom + windowHeight // Keep one viewport height ahead
            );
            this.beeContainer.style.minHeight = `${newMinHeight}px`;
        }
    }

    generateNextBee() {
        this.isGenerating = true;
        const newTop = this.createBee(this.lastFilledPosition);
        this.isGenerating = false;
        return newTop !== null;
    }

    checkAnswer() {
        const userCount = parseInt(this.beeCount.value);
        const totalBees = this.bees.length;
        
        if (isNaN(userCount)) {
            this.showFeedback('Please enter a valid number!', false);
            return;
        }

        if (userCount === totalBees) {
            if (userCount > this.highestCorrectCount) {
                this.highestCorrectCount = userCount;
                this.highScoreElement.textContent = userCount;
            }
            this.showFeedback(`Correct! There were exactly ${totalBees} bees.`, true);
            
            // Show certificate modal and prepare for score submission
            this.certCount.textContent = totalBees;
            this.certificateModal.style.display = 'block';
            
            // Modify the certificate generation to also submit the score
            this.generateCertButton.onclick = async () => {
                const name = this.certName.value.trim();
                if (!name) {
                    alert('Please enter your name first!');
                    return;
                }

                // Submit score to leaderboard
                await this.submitScore(name, totalBees);
                
                // Generate certificate
                this.generateCertificate();
                
                // Close the certificate modal
                this.certificateModal.style.display = 'none';
                
                // Show and update leaderboard
                this.leaderboardModal.style.display = 'block';
                await this.loadLeaderboard();
            };
        } else {
            this.showFeedback(`Try again! Your count was off by ${Math.abs(userCount - totalBees)} bees.`, false);
            
            // Reset the game after a short delay to show the feedback
            setTimeout(() => {
                window.scrollTo(0, 0);
                this.initializeContainer();
                this.fillInitialViewport();
            }, 2000);
        }
        
        this.beeCount.value = '';
    }

    showFeedback(message, success) {
        this.feedback.textContent = message;
        this.feedback.className = `feedback ${success ? 'success' : 'error'}`;
        
        setTimeout(() => {
            this.feedback.className = 'feedback';
        }, 3000);
    }

    generateCertificate() {
        const name = this.certName.value.trim();
        if (!name) {
            alert('Please enter your name first!');
            return;
        }

        const count = this.certCount.textContent;
        const date = new Date().toLocaleDateString();

        // Create certificate canvas
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');

        // Set background
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(0, 0, 800, 600);

        // Add border
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 20;
        ctx.strokeRect(10, 10, 780, 580);

        // Add text
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        
        // Title
        ctx.font = 'bold 40px Arial';
        ctx.fillText('Certificate of Achievement', 400, 100);
        
        // Body text
        ctx.font = '24px Arial';
        ctx.fillText('This certifies that', 400, 200);
        
        // Name
        ctx.font = 'bold 36px Arial';
        ctx.fillText(name, 400, 260);
        
        // Achievement text
        ctx.font = '24px Arial';
        ctx.fillText(`successfully counted ${count} bees`, 400, 320);
        ctx.fillText(`on ${date}`, 400, 360);

        // Add bee emoji
        ctx.font = '40px Arial';
        ctx.fillText('🐝', 200, 450);
        ctx.fillText('🐝', 600, 450);

        // Convert to image and download
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'bee-counter-certificate.png';
        link.href = dataUrl;
        link.click();

        // Close modal after generating
        this.certificateModal.style.display = 'none';
    }

    setupLeaderboardHandlers() {
        this.leaderboardButton.addEventListener('click', () => {
            this.leaderboardModal.style.display = 'block';
            this.loadLeaderboard();
        });

        this.closeLeaderboardButton.addEventListener('click', () => {
            this.leaderboardModal.style.display = 'none';
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.leaderboardModal) {
                this.leaderboardModal.style.display = 'none';
            }
        });
    }

    async loadLeaderboard() {
        try {
            this.showLeaderboardMessage('Loading scores...', 'loading');
            
            const response = await fetch(`${this.apiUrl}?action=getScores`, {
                method: 'GET',
                mode: 'cors'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.status === 'success' && Array.isArray(data.data)) {
                this.updateLeaderboardUI(data.data);
            } else {
                throw new Error('Invalid data format');
            }
        } catch (error) {
            console.error('Error loading leaderboard:', error);
            this.showLeaderboardError();
        }
    }

    async submitScore(name, score) {
        try {
            this.showLeaderboardMessage('Submitting score...', 'loading');
            
            // Create form data for the POST request
            const formData = new FormData();
            formData.append('action', 'addScore');
            formData.append('name', name);
            formData.append('score', score);
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                mode: 'cors',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.status === 'success') {
                await this.loadLeaderboard(); // Reload the leaderboard
                this.showLeaderboardMessage('Score submitted successfully!', 'success');
                return true;
            } else {
                throw new Error(data.message || 'Invalid data format');
            }
        } catch (error) {
            console.error('Error submitting score:', error);
            this.showLeaderboardMessage('Failed to submit score. Please try again.', 'error');
            return false;
        }
    }

    showLeaderboardMessage(message, type) {
        this.leaderboardBody.innerHTML = `
            <tr>
                <td colspan="4" class="leaderboard-message ${type}">
                    ${message} ${type === 'loading' ? '🔄' : type === 'success' ? '✅' : type === 'error' ? '❌' : '🐝'}
                </td>
            </tr>
        `;
    }

    showLeaderboardError() {
        this.showLeaderboardMessage('Unable to load scores. Please try again later.', 'error');
    }

    updateLeaderboardUI(scores) {
        if (!Array.isArray(scores) || scores.length === 0) {
            this.showLeaderboardMessage('No scores yet. Be the first to make it to the leaderboard!', 'info');
            return;
        }

        this.leaderboardBody.innerHTML = scores.map(([rank, name, score, date]) => `
            <tr class="${rank <= 3 ? 'top-' + rank : ''}">
                <td>${rank}</td>
                <td>${this.escapeHtml(name)}</td>
                <td>${score}</td>
                <td>${new Date(date).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new BeeGame();
}); 