/**
 * SwiftShelf webOS TV App
 * Main application logic
 */

const App = {
    // State
    authType: 'username',
    isLoading: false,
    libraries: [],
    selectedLibraryIds: [],
    currentLibrary: null,
    books: [],
    continueListeningBooks: [],
    focusedBookIndex: 0,
    currentBook: null,
    searchResults: null,

    // Settings
    settings: {
        itemLimit: 20,
        playbackSpeed: 1.0,
        progressBarColor: 'Yellow'
    },

    // Player state
    player: {
        audio: null,
        session: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        currentTrackIndex: 0,
        tracks: [],
        syncInterval: null
    },

    // Color options
    colorOptions: ['Yellow', 'Red', 'Green', 'Blue', 'Purple', 'Orange', 'Pink', 'Teal'],
    colorValues: {
        Yellow: '#ffeb3b',
        Red: '#f44336',
        Green: '#4caf50',
        Blue: '#2196f3',
        Purple: '#BB86FC',
        Orange: '#FF9800',
        Pink: '#E91E63',
        Teal: '#009688'
    },

    /**
     * Initialize the application
     */
    async init() {
        console.log('SwiftShelf webOS initializing...');

        // Load settings
        this.settings = Storage.getSettings();
        this.selectedLibraryIds = Storage.getSelectedLibraries();

        // Apply progress bar color
        this.applyProgressBarColor();

        // Initialize navigation
        Navigation.init();

        // Set up event listeners
        this.setupEventListeners();

        // Try to load config file (for simulator/development)
        const configLoaded = await this.tryLoadConfigFile();

        if (!configLoaded) {
            // Check for saved credentials
            this.checkSavedCredentials();
        }

        console.log('SwiftShelf webOS initialized');
    },

    /**
     * Check if running in simulator/development mode
     * Detection based on URL or user agent
     */
    isSimulatorMode() {
        // Running via file:// protocol (direct file open)
        if (window.location.protocol === 'file:') {
            return true;
        }

        // Running via localhost (ares-server)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return true;
        }

        // Check for simulator-specific indicators in user agent
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('webos') && (ua.includes('simulator') || ua.includes('emulator'))) {
            return true;
        }

        // Check if webOS deviceId is not set (indicates simulator)
        // On real devices, webOS provides device info
        if (typeof webOS !== 'undefined' && webOS.deviceInfo) {
            // Real device usually has proper device info
            return false;
        }

        // Default to checking if we can fetch local files
        return true;
    },

    /**
     * Try to load config file for auto-login in simulator
     */
    async tryLoadConfigFile() {
        if (!this.isSimulatorMode()) {
            console.log('Not in simulator mode, skipping config file');
            return false;
        }

        console.log('Simulator mode detected, trying to load config file...');

        try {
            // Try to fetch the config file from the app directory
            const response = await fetch('.swiftshelf-config.json');

            if (!response.ok) {
                console.log('No config file found (this is normal)');
                return false;
            }

            const config = await response.json();
            console.log('Config file loaded successfully');

            if (!config.host) {
                console.log('Config file missing host');
                return false;
            }

            document.getElementById('host-url').value = config.host;

            // Try API key first, then username/password
            if (config.apiKey) {
                console.log('Auto-connecting with API key...');
                SwiftShelfAPI.configure(config.host, config.apiKey);
                this.setAuthType('apikey');
                document.getElementById('api-key').value = config.apiKey;

                try {
                    await SwiftShelfAPI.verifyApiKey();
                    Storage.saveCredentials(config.host, config.apiKey, 'apikey');
                    await this.loadLibrariesAndShow();
                    return true;
                } catch (error) {
                    console.error('Auto-connect failed with API key:', error);
                    this.showError('Config file API key invalid: ' + this.getErrorMessage(error));
                    return false;
                }
            } else if (config.username && config.password) {
                console.log('Auto-connecting with username/password...');
                SwiftShelfAPI.configure(config.host, '');
                this.setAuthType('username');
                document.getElementById('username').value = config.username;
                document.getElementById('password').value = config.password;

                try {
                    const response = await SwiftShelfAPI.login(config.username, config.password);
                    const token = response.user.token;
                    SwiftShelfAPI.configure(config.host, token);
                    Storage.saveCredentials(config.host, token, 'username');
                    await this.loadLibrariesAndShow();
                    return true;
                } catch (error) {
                    console.error('Auto-connect failed with username/password:', error);
                    this.showError('Config file credentials invalid: ' + this.getErrorMessage(error));
                    return false;
                }
            } else {
                console.log('Config file missing credentials (apiKey or username/password)');
                return false;
            }
        } catch (error) {
            // Config file doesn't exist or can't be read - this is fine
            console.log('Could not load config file:', error.message);
            return false;
        }
    },

    /**
     * Set up event listeners for UI elements
     */
    setupEventListeners() {
        // Login screen
        document.getElementById('connect-btn').addEventListener('click', () => this.handleConnect());
        document.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                this.setAuthType(item.dataset.authType);
                Navigation.closeDropdown();
            });
        });
        document.querySelectorAll('#login-screen input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.keyCode === 13) this.handleConnect();
            });
        });

        // Library selection screen
        document.getElementById('library-continue-btn').addEventListener('click', () => this.handleLibrarySelectionContinue());

        // Sidebar buttons
        document.getElementById('search-btn').addEventListener('click', () => this.openSearch());
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());

        // Search screen
        document.getElementById('search-submit-btn').addEventListener('click', () => this.performSearch());
        document.getElementById('search-input').addEventListener('keydown', (e) => {
            if (e.keyCode === 13) this.performSearch();
        });

        // Settings modal
        document.getElementById('settings-close-btn').addEventListener('click', () => this.closeSettings());
        document.getElementById('settings-logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('settings-libraries-btn').addEventListener('click', () => this.openLibraryPicker());
        document.getElementById('settings-color-btn').addEventListener('click', () => this.openColorPicker());
        document.getElementById('item-limit-down').addEventListener('click', () => this.adjustItemLimit(-5));
        document.getElementById('item-limit-up').addEventListener('click', () => this.adjustItemLimit(5));
        document.getElementById('playback-speed-down').addEventListener('click', () => this.adjustPlaybackSpeed(-0.1));
        document.getElementById('playback-speed-up').addEventListener('click', () => this.adjustPlaybackSpeed(0.1));

        // Book details modal
        document.getElementById('details-close-btn').addEventListener('click', () => this.closeBookDetails());
        document.getElementById('details-play-btn').addEventListener('click', () => this.playCurrentBook());

        // Color picker modal
        document.getElementById('color-picker-close').addEventListener('click', () => this.closeColorPicker());

        // Library picker modal
        document.getElementById('library-picker-close').addEventListener('click', () => this.closeLibraryPicker());

        // Player controls
        document.getElementById('player-play').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('player-rewind').addEventListener('click', () => this.seekRelative(-30));
        document.getElementById('player-forward').addEventListener('click', () => this.seekRelative(30));
        document.getElementById('player-prev').addEventListener('click', () => this.previousTrack());
        document.getElementById('player-next').addEventListener('click', () => this.nextTrack());
        document.getElementById('player-speed-down').addEventListener('click', () => this.adjustPlaybackSpeed(-0.1));
        document.getElementById('player-speed-up').addEventListener('click', () => this.adjustPlaybackSpeed(0.1));
    },

    /**
     * Check for saved credentials and auto-login
     */
    checkSavedCredentials() {
        const creds = Storage.getCredentials();

        if (creds.hostUrl && creds.apiToken) {
            document.getElementById('host-url').value = creds.hostUrl;

            if (creds.authType === 'apikey') {
                this.setAuthType('apikey');
                document.getElementById('api-key').value = creds.apiToken;
            }

            SwiftShelfAPI.configure(creds.hostUrl, creds.apiToken);
            this.loadLibrariesAndShow();
        }
    },

    /**
     * Set authentication type
     */
    setAuthType(type) {
        this.authType = type;

        const label = document.getElementById('auth-type-label');
        const usernameFields = document.getElementById('username-password-fields');
        const apiKeyField = document.getElementById('api-key-field');

        if (type === 'apikey') {
            label.textContent = 'API Key';
            usernameFields.classList.add('hidden');
            apiKeyField.classList.remove('hidden');
        } else {
            label.textContent = 'Username / Password';
            usernameFields.classList.remove('hidden');
            apiKeyField.classList.add('hidden');
        }

        Navigation.updateFocusableElements();
    },

    /**
     * Handle connect button click
     */
    async handleConnect() {
        if (this.isLoading) return;

        const hostUrl = document.getElementById('host-url').value.trim();

        if (!hostUrl) {
            this.showError('Please enter a server URL');
            return;
        }

        if (!hostUrl.startsWith('http://') && !hostUrl.startsWith('https://')) {
            this.showError('Server URL must start with http:// or https://');
            return;
        }

        this.setLoading(true);
        this.hideError();

        try {
            if (this.authType === 'apikey') {
                await this.connectWithApiKey(hostUrl);
            } else {
                await this.connectWithCredentials(hostUrl);
            }
        } catch (error) {
            console.error('Connection failed:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            this.setLoading(false);
        }
    },

    /**
     * Connect using API key
     */
    async connectWithApiKey(hostUrl) {
        const apiKey = document.getElementById('api-key').value.trim();

        if (!apiKey) {
            this.showError('Please enter an API key');
            return;
        }

        SwiftShelfAPI.configure(hostUrl, apiKey);
        await SwiftShelfAPI.verifyApiKey();
        Storage.saveCredentials(hostUrl, apiKey, 'apikey');
        await this.loadLibrariesAndShow();
    },

    /**
     * Connect using username/password
     */
    async connectWithCredentials(hostUrl) {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showError('Please enter username and password');
            return;
        }

        SwiftShelfAPI.configure(hostUrl, '');
        const response = await SwiftShelfAPI.login(username, password);
        const token = response.user.token;

        SwiftShelfAPI.configure(hostUrl, token);
        Storage.saveCredentials(hostUrl, token, 'username');
        await this.loadLibrariesAndShow();
    },

    /**
     * Load libraries and determine next screen
     */
    async loadLibrariesAndShow() {
        try {
            this.libraries = await SwiftShelfAPI.getLibraries();

            if (this.libraries.length === 0) {
                this.showError('No libraries found on server');
                return;
            }

            // Check if we have previously selected libraries
            const savedLibraryIds = Storage.getSelectedLibraries();
            if (savedLibraryIds.length > 0) {
                this.selectedLibraryIds = savedLibraryIds;
                const currentLibraryId = Storage.getCurrentLibrary();
                this.currentLibrary = this.libraries.find(l => l.id === currentLibraryId)
                    || this.libraries.find(l => savedLibraryIds.includes(l.id))
                    || this.libraries[0];

                await this.loadBooks();
                this.renderSidebar();
                Navigation.switchScreen('library');
            } else {
                // Show library selection screen
                this.renderLibrarySelection();
                Navigation.switchScreen('library-selection');
            }
        } catch (error) {
            console.error('Failed to load libraries:', error);
            this.showError('Failed to load libraries. Please check your credentials.');
            Storage.clearCredentials();
        }
    },

    /**
     * Render library selection screen
     */
    renderLibrarySelection() {
        const listEl = document.getElementById('library-list');
        listEl.innerHTML = this.libraries.map((lib, index) => {
            const isSelected = this.selectedLibraryIds.includes(lib.id);
            return `
                <div class="library-item focusable ${isSelected ? 'selected' : ''}"
                     data-id="${lib.id}" data-index="${index}" tabindex="0">
                    <div class="library-checkbox">${isSelected ? '✓' : ''}</div>
                    <div class="library-item-info">
                        <div class="library-item-name">${lib.name}</div>
                        <div class="library-item-type">${lib.mediaType || 'Unknown type'}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        listEl.querySelectorAll('.library-item').forEach(item => {
            item.addEventListener('click', () => this.toggleLibrarySelection(item.dataset.id));
        });

        this.updateLibraryContinueButton();
        Navigation.updateFocusableElements();
    },

    /**
     * Toggle library selection
     */
    toggleLibrarySelection(libraryId) {
        const index = this.selectedLibraryIds.indexOf(libraryId);
        if (index > -1) {
            this.selectedLibraryIds.splice(index, 1);
        } else {
            this.selectedLibraryIds.push(libraryId);
        }

        this.renderLibrarySelection();
    },

    /**
     * Update library continue button state
     */
    updateLibraryContinueButton() {
        const btn = document.getElementById('library-continue-btn');
        btn.disabled = this.selectedLibraryIds.length === 0;
    },

    /**
     * Handle library selection continue
     */
    async handleLibrarySelectionContinue() {
        if (this.selectedLibraryIds.length === 0) return;

        Storage.saveSelectedLibraries(this.selectedLibraryIds);
        this.currentLibrary = this.libraries.find(l => this.selectedLibraryIds.includes(l.id));
        Storage.saveCurrentLibrary(this.currentLibrary.id);

        await this.loadBooks();
        this.renderSidebar();
        Navigation.switchScreen('library');
    },

    /**
     * Render sidebar with libraries
     */
    renderSidebar() {
        const container = document.getElementById('sidebar-libraries');
        const selectedLibraries = this.libraries.filter(l => this.selectedLibraryIds.includes(l.id));

        container.innerHTML = selectedLibraries.map(lib => {
            const isActive = this.currentLibrary?.id === lib.id;
            return `
                <div class="sidebar-library-item focusable ${isActive ? 'active' : ''}"
                     data-id="${lib.id}" tabindex="0">
                    ${lib.name}
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.sidebar-library-item').forEach(item => {
            item.addEventListener('click', () => this.switchLibrary(item.dataset.id));
        });
    },

    /**
     * Switch to a different library
     */
    async switchLibrary(libraryId) {
        this.currentLibrary = this.libraries.find(l => l.id === libraryId);
        Storage.saveCurrentLibrary(libraryId);
        await this.loadBooks();
        this.renderSidebar();
        Navigation.closeSidebar();
    },

    /**
     * Load books for current library
     */
    async loadBooks() {
        if (!this.currentLibrary) return;

        try {
            // Load recent books
            this.books = await SwiftShelfAPI.getLibraryItems(this.currentLibrary.id, {
                limit: this.settings.itemLimit,
                sort: 'addedAt',
                desc: true
            });

            // Load continue listening
            try {
                const inProgress = await SwiftShelfAPI.getItemsInProgress(this.currentLibrary.id, {
                    limit: 10
                });
                this.continueListeningBooks = inProgress.filter(book => {
                    const progress = book.userMediaProgress?.progress || 0;
                    return progress > 0 && progress < 1;
                });
            } catch (e) {
                this.continueListeningBooks = [];
            }

            this.renderCarousels();

            if (this.books.length > 0) {
                this.focusedBookIndex = 0;
                this.updateContentInfo(this.books[0]);
            }
        } catch (error) {
            console.error('Failed to load books:', error);
        }
    },

    /**
     * Render all carousels
     */
    renderCarousels() {
        const isEbook = this.currentLibrary?.mediaType === 'book';

        // Continue Listening
        const continueSection = document.getElementById('continue-listening-section');
        const continueCarousel = document.getElementById('continue-carousel');

        if (this.continueListeningBooks.length > 0) {
            continueSection.classList.remove('hidden');
            continueCarousel.innerHTML = this.renderBookCards(this.continueListeningBooks, isEbook, 'continue');
        } else {
            continueSection.classList.add('hidden');
        }

        // Recent Books
        const booksCarousel = document.getElementById('books-carousel');
        if (this.books.length === 0) {
            booksCarousel.innerHTML = `
                <div class="empty-state">
                    <h3>No books found</h3>
                    <p>This library is empty</p>
                </div>
            `;
        } else {
            booksCarousel.innerHTML = this.renderBookCards(this.books, isEbook, 'recent');
        }

        // Add click handlers
        document.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', () => {
                const bookId = card.dataset.id;
                const source = card.dataset.source;
                const bookList = source === 'continue' ? this.continueListeningBooks : this.books;
                const book = bookList.find(b => b.id === bookId);
                if (book) this.openBookDetails(book);
            });
        });

        Navigation.updateFocusableElements();
    },

    /**
     * Render book cards HTML
     */
    renderBookCards(books, isEbook, source) {
        return books.map((book, index) => {
            const coverUrl = SwiftShelfAPI.getCoverUrl(book.id);
            const progress = book.userMediaProgress?.progress || 0;
            const progressPercent = Math.round(progress * 100);
            const coverClass = isEbook ? 'book-cover ebook' : 'book-cover';

            return `
                <div class="book-card focusable" data-index="${index}" data-id="${book.id}" data-source="${source}" tabindex="0">
                    <div class="${coverClass}">
                        <img src="${coverUrl}" alt="${book.media?.metadata?.title || 'Book'}"
                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%232d2d44%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2250%22 font-size=%2212%22 fill=%22%23888%22 text-anchor=%22middle%22 dy=%22.3em%22>No Cover</text></svg>'">
                        ${progress > 0 ? `
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progressPercent}%; background-color: ${this.colorValues[this.settings.progressBarColor]}"></div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Handle carousel focus change
     */
    onCarouselFocusChange(book) {
        this.updateContentInfo(book);
    },

    /**
     * Update content info panel
     */
    updateContentInfo(book) {
        if (!book) return;

        const metadata = book.media?.metadata;
        const author = metadata?.authors?.[0]?.name || metadata?.authorName || 'Unknown Author';
        const year = metadata?.publishedYear || '';
        const duration = book.media?.duration;
        const durationText = this.formatDuration(duration);

        const bgEl = document.getElementById('library-background');
        const coverUrl = SwiftShelfAPI.getCoverUrl(book.id);
        bgEl.style.backgroundImage = `url(${coverUrl})`;

        document.getElementById('content-meta').textContent = [author, year, durationText].filter(Boolean).join(' • ');
        document.getElementById('content-title').textContent = metadata?.title || 'Unknown Title';
        document.getElementById('content-description').textContent = metadata?.description || '';
        document.getElementById('content-info').classList.add('visible');
    },

    /**
     * Open book details modal
     */
    openBookDetails(book) {
        this.currentBook = book;
        const metadata = book.media?.metadata;

        document.getElementById('details-cover-img').src = SwiftShelfAPI.getCoverUrl(book.id);
        document.getElementById('details-title').textContent = metadata?.title || 'Unknown Title';
        document.getElementById('details-author').textContent = `by ${metadata?.authors?.[0]?.name || metadata?.authorName || 'Unknown Author'}`;
        document.getElementById('details-narrator').textContent = metadata?.narrators?.length ? `Narrated by ${metadata.narrators.join(', ')}` : '';
        document.getElementById('details-duration').textContent = this.formatDuration(book.media?.duration);
        document.getElementById('details-description').textContent = metadata?.description || '';

        const progress = book.userMediaProgress?.progress || 0;
        document.getElementById('details-progress-bar').style.width = `${Math.round(progress * 100)}%`;

        document.getElementById('book-details-modal').classList.remove('hidden');
        Navigation.setModalMode('book-details');
    },

    /**
     * Close book details modal
     */
    closeBookDetails() {
        document.getElementById('book-details-modal').classList.add('hidden');
        Navigation.exitModalMode();
    },

    /**
     * Play current book
     */
    async playCurrentBook() {
        if (!this.currentBook) return;

        this.closeBookDetails();
        await this.startPlayback(this.currentBook);
    },

    /**
     * Start playback for a book
     */
    async startPlayback(book) {
        try {
            // Start playback session
            const session = await SwiftShelfAPI.startPlaybackSession(book.id, {
                deviceId: 'webos-' + Date.now(),
                model: 'LG TV',
                deviceName: 'SwiftShelf webOS'
            });

            this.player.session = session;
            this.player.tracks = session.audioTracks || [];
            this.player.duration = session.duration || book.media?.duration || 0;

            // Get starting position from progress
            const progress = book.userMediaProgress;
            this.player.currentTime = progress?.currentTime || 0;
            this.player.currentTrackIndex = 0;

            // Find correct track based on current time
            let accumulatedTime = 0;
            for (let i = 0; i < this.player.tracks.length; i++) {
                const trackDuration = this.player.tracks[i].duration || 0;
                if (accumulatedTime + trackDuration > this.player.currentTime) {
                    this.player.currentTrackIndex = i;
                    break;
                }
                accumulatedTime += trackDuration;
            }

            // Update player UI
            this.updatePlayerUI(book);
            Navigation.switchScreen('player');

            // Start audio
            this.loadAndPlayTrack();

            // Start sync interval
            this.player.syncInterval = setInterval(() => this.syncProgress(), 30000);

        } catch (error) {
            console.error('Failed to start playback:', error);
        }
    },

    /**
     * Update player UI
     */
    updatePlayerUI(book) {
        const metadata = book.media?.metadata;
        document.getElementById('player-cover-img').src = SwiftShelfAPI.getCoverUrl(book.id);
        document.getElementById('player-title').textContent = metadata?.title || 'Unknown Title';
        document.getElementById('player-author').textContent = metadata?.authors?.[0]?.name || '';
        document.getElementById('player-speed-value').textContent = `${this.settings.playbackSpeed.toFixed(1)}x`;
        this.updatePlayerProgress();
    },

    /**
     * Load and play current track
     */
    loadAndPlayTrack() {
        if (this.player.audio) {
            this.player.audio.pause();
        }

        const track = this.player.tracks[this.player.currentTrackIndex];
        if (!track) return;

        this.player.audio = new Audio(SwiftShelfAPI.getAudioStreamUrl(track.contentUrl));
        this.player.audio.playbackRate = this.settings.playbackSpeed;

        this.player.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.player.audio.addEventListener('ended', () => this.onTrackEnded());
        this.player.audio.addEventListener('loadedmetadata', () => {
            // Seek to position within track if needed
            const trackStartTime = this.getTrackStartTime(this.player.currentTrackIndex);
            const seekTo = this.player.currentTime - trackStartTime;
            if (seekTo > 0) {
                this.player.audio.currentTime = seekTo;
            }
        });

        document.getElementById('player-chapter').textContent = track.title || `Track ${this.player.currentTrackIndex + 1}`;

        this.player.audio.play();
        this.player.isPlaying = true;
        document.getElementById('player-play').innerHTML = '&#9208;'; // Pause icon
    },

    /**
     * Get start time of a track
     */
    getTrackStartTime(trackIndex) {
        let time = 0;
        for (let i = 0; i < trackIndex; i++) {
            time += this.player.tracks[i].duration || 0;
        }
        return time;
    },

    /**
     * Handle time update
     */
    onTimeUpdate() {
        if (!this.player.audio) return;

        const trackStartTime = this.getTrackStartTime(this.player.currentTrackIndex);
        this.player.currentTime = trackStartTime + this.player.audio.currentTime;
        this.updatePlayerProgress();
    },

    /**
     * Handle track ended
     */
    onTrackEnded() {
        if (this.player.currentTrackIndex < this.player.tracks.length - 1) {
            this.player.currentTrackIndex++;
            this.loadAndPlayTrack();
        } else {
            // Book finished
            this.player.isPlaying = false;
            document.getElementById('player-play').innerHTML = '&#9654;';
            this.syncProgress();
        }
    },

    /**
     * Update player progress display
     */
    updatePlayerProgress() {
        document.getElementById('player-current-time').textContent = this.formatTime(this.player.currentTime);
        document.getElementById('player-duration').textContent = this.formatTime(this.player.duration);

        const percent = this.player.duration > 0 ? (this.player.currentTime / this.player.duration) * 100 : 0;
        document.getElementById('player-progress-bar').style.width = `${percent}%`;
    },

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (!this.player.audio) return;

        if (this.player.isPlaying) {
            this.player.audio.pause();
            this.player.isPlaying = false;
            document.getElementById('player-play').innerHTML = '&#9654;';
        } else {
            this.player.audio.play();
            this.player.isPlaying = true;
            document.getElementById('player-play').innerHTML = '&#9208;';
        }
    },

    /**
     * Seek relative to current position
     */
    seekRelative(seconds) {
        if (!this.player.audio) return;

        const newTime = this.player.currentTime + seconds;
        this.seekToTime(Math.max(0, Math.min(newTime, this.player.duration)));
    },

    /**
     * Seek to absolute time
     */
    seekToTime(time) {
        // Find correct track
        let accumulatedTime = 0;
        for (let i = 0; i < this.player.tracks.length; i++) {
            const trackDuration = this.player.tracks[i].duration || 0;
            if (accumulatedTime + trackDuration > time) {
                if (i !== this.player.currentTrackIndex) {
                    this.player.currentTrackIndex = i;
                    this.player.currentTime = time;
                    this.loadAndPlayTrack();
                } else {
                    this.player.audio.currentTime = time - accumulatedTime;
                }
                return;
            }
            accumulatedTime += trackDuration;
        }
    },

    /**
     * Previous track
     */
    previousTrack() {
        if (this.player.currentTrackIndex > 0) {
            this.player.currentTrackIndex--;
            this.player.currentTime = this.getTrackStartTime(this.player.currentTrackIndex);
            this.loadAndPlayTrack();
        }
    },

    /**
     * Next track
     */
    nextTrack() {
        if (this.player.currentTrackIndex < this.player.tracks.length - 1) {
            this.player.currentTrackIndex++;
            this.player.currentTime = this.getTrackStartTime(this.player.currentTrackIndex);
            this.loadAndPlayTrack();
        }
    },

    /**
     * Sync progress to server
     */
    async syncProgress() {
        if (!this.player.session || !this.currentBook) return;

        try {
            await SwiftShelfAPI.syncSession(
                this.player.session.id,
                this.player.currentTime,
                30, // time listened since last sync
                this.player.duration
            );
        } catch (error) {
            console.error('Failed to sync progress:', error);
        }
    },

    /**
     * Stop playback and close session
     */
    async stopPlayback() {
        if (this.player.syncInterval) {
            clearInterval(this.player.syncInterval);
        }

        if (this.player.audio) {
            this.player.audio.pause();
            this.player.audio = null;
        }

        if (this.player.session) {
            try {
                await SwiftShelfAPI.closeSession(
                    this.player.session.id,
                    this.player.currentTime,
                    0,
                    this.player.duration
                );
            } catch (e) {
                console.error('Failed to close session:', e);
            }
        }

        this.player.session = null;
        this.player.isPlaying = false;
    },

    /**
     * Open search screen
     */
    openSearch() {
        Navigation.closeSidebar();
        Navigation.switchScreen('search');
    },

    /**
     * Perform search
     */
    async performSearch() {
        const query = document.getElementById('search-input').value.trim();
        if (!query || !this.currentLibrary) return;

        try {
            const results = await SwiftShelfAPI.searchLibrary(this.currentLibrary.id, query);
            this.searchResults = results;
            this.renderSearchResults();
        } catch (error) {
            console.error('Search failed:', error);
        }
    },

    /**
     * Render search results
     */
    renderSearchResults() {
        const container = document.getElementById('search-results');
        const results = this.searchResults;

        if (!results) {
            container.innerHTML = '';
            return;
        }

        let html = '';

        // Books
        if (results.book && results.book.length > 0) {
            html += `<div class="search-section">
                <h3 class="search-section-title">Books</h3>
                ${results.book.map(result => {
                    const item = result.libraryItem;
                    const metadata = item.media?.metadata;
                    return `
                        <div class="search-result-item focusable" data-id="${item.id}" tabindex="0">
                            <img class="search-result-cover" src="${SwiftShelfAPI.getCoverUrl(item.id)}" alt="">
                            <div class="search-result-info">
                                <div class="search-result-title">${metadata?.title || 'Unknown'}</div>
                                <div class="search-result-author">by ${metadata?.authors?.[0]?.name || 'Unknown'}</div>
                                <div class="search-result-duration">${this.formatDuration(item.media?.duration)}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>`;
        }

        // Series
        if (results.series && results.series.length > 0) {
            html += `<div class="search-section">
                <h3 class="search-section-title">Series</h3>
                ${results.series.map(result => `
                    <div class="search-result-item focusable" tabindex="0">
                        <div class="search-result-info">
                            <div class="search-result-title">${result.series?.name || 'Unknown'}</div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
        }

        container.innerHTML = html || '<div class="empty-state"><p>No results found</p></div>';

        // Add click handlers for book results
        container.querySelectorAll('.search-result-item[data-id]').forEach(item => {
            item.addEventListener('click', async () => {
                const book = await SwiftShelfAPI.getItemDetails(item.dataset.id);
                this.openBookDetails(book);
            });
        });

        Navigation.updateFocusableElements();
    },

    /**
     * Open settings modal
     */
    openSettings() {
        Navigation.closeSidebar();

        document.getElementById('settings-libraries-count').textContent = `${this.selectedLibraryIds.length} selected`;
        document.getElementById('item-limit-value').textContent = this.settings.itemLimit;
        document.getElementById('playback-speed-value').textContent = `${this.settings.playbackSpeed.toFixed(1)}x`;
        document.getElementById('color-value').textContent = this.settings.progressBarColor;
        document.getElementById('color-preview').style.backgroundColor = this.colorValues[this.settings.progressBarColor];
        document.getElementById('settings-server-url').textContent = Storage.getCredentials().hostUrl;

        document.getElementById('settings-modal').classList.remove('hidden');
        Navigation.setModalMode('settings');
    },

    /**
     * Close settings modal
     */
    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
        Navigation.exitModalMode();
    },

    /**
     * Adjust item limit setting
     */
    adjustItemLimit(delta) {
        this.settings.itemLimit = Math.max(5, Math.min(50, this.settings.itemLimit + delta));
        document.getElementById('item-limit-value').textContent = this.settings.itemLimit;
        Storage.saveSettings(this.settings);
    },

    /**
     * Adjust playback speed
     */
    adjustPlaybackSpeed(delta) {
        this.settings.playbackSpeed = Math.max(0.5, Math.min(3.0, this.settings.playbackSpeed + delta));
        this.settings.playbackSpeed = Math.round(this.settings.playbackSpeed * 10) / 10;
        document.getElementById('playback-speed-value').textContent = `${this.settings.playbackSpeed.toFixed(1)}x`;
        document.getElementById('player-speed-value').textContent = `${this.settings.playbackSpeed.toFixed(1)}x`;

        if (this.player.audio) {
            this.player.audio.playbackRate = this.settings.playbackSpeed;
        }

        Storage.saveSettings(this.settings);
    },

    /**
     * Open color picker modal
     */
    openColorPicker() {
        const grid = document.getElementById('color-grid');
        grid.innerHTML = this.colorOptions.map(color => `
            <div class="color-option focusable ${color === this.settings.progressBarColor ? 'selected' : ''}"
                 data-color="${color}" tabindex="0">
                <div class="color-swatch" style="background-color: ${this.colorValues[color]}"></div>
                <span class="color-name">${color}</span>
                ${color === this.settings.progressBarColor ? '<span class="color-check">✓</span>' : ''}
            </div>
        `).join('');

        grid.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                this.setProgressBarColor(option.dataset.color);
                this.closeColorPicker();
            });
        });

        document.getElementById('color-picker-modal').classList.remove('hidden');
        Navigation.setModalMode('color-picker');
    },

    /**
     * Close color picker
     */
    closeColorPicker() {
        document.getElementById('color-picker-modal').classList.add('hidden');
        Navigation.setModalMode('settings');
    },

    /**
     * Set progress bar color
     */
    setProgressBarColor(color) {
        this.settings.progressBarColor = color;
        Storage.saveSettings(this.settings);
        this.applyProgressBarColor();
        document.getElementById('color-value').textContent = color;
        document.getElementById('color-preview').style.backgroundColor = this.colorValues[color];
    },

    /**
     * Apply progress bar color to CSS
     */
    applyProgressBarColor() {
        document.documentElement.style.setProperty('--progress-color', this.colorValues[this.settings.progressBarColor]);
    },

    /**
     * Open library picker modal
     */
    openLibraryPicker() {
        const list = document.getElementById('library-picker-list');
        list.innerHTML = this.libraries.map(lib => {
            const isSelected = this.selectedLibraryIds.includes(lib.id);
            return `
                <div class="library-picker-item focusable ${isSelected ? 'selected' : ''}"
                     data-id="${lib.id}" tabindex="0">
                    <div class="library-checkbox">${isSelected ? '✓' : ''}</div>
                    <div class="library-item-info">
                        <div class="library-item-name">${lib.name}</div>
                        <div class="library-item-type">${lib.mediaType || 'Unknown'}</div>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.library-picker-item').forEach(item => {
            item.addEventListener('click', () => {
                this.toggleLibraryInPicker(item.dataset.id);
            });
        });

        document.getElementById('library-picker-modal').classList.remove('hidden');
        Navigation.setModalMode('library-picker');
    },

    /**
     * Toggle library in picker
     */
    toggleLibraryInPicker(libraryId) {
        const index = this.selectedLibraryIds.indexOf(libraryId);
        if (index > -1) {
            if (this.selectedLibraryIds.length > 1) {
                this.selectedLibraryIds.splice(index, 1);
            }
        } else {
            this.selectedLibraryIds.push(libraryId);
        }

        Storage.saveSelectedLibraries(this.selectedLibraryIds);
        document.getElementById('settings-libraries-count').textContent = `${this.selectedLibraryIds.length} selected`;
        this.openLibraryPicker(); // Re-render
    },

    /**
     * Close library picker
     */
    closeLibraryPicker() {
        document.getElementById('library-picker-modal').classList.add('hidden');
        Navigation.setModalMode('settings');
        this.renderSidebar();
    },

    /**
     * Logout
     */
    logout() {
        this.closeSettings();
        this.stopPlayback();
        Storage.clear();
        SwiftShelfAPI.configure('', '');

        this.libraries = [];
        this.selectedLibraryIds = [];
        this.currentLibrary = null;
        this.books = [];
        this.continueListeningBooks = [];

        document.getElementById('host-url').value = '';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('api-key').value = '';

        Navigation.switchScreen('login');
    },

    /**
     * Format duration in seconds to readable string
     */
    formatDuration(seconds) {
        if (!seconds) return '';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    },

    /**
     * Format time in seconds to HH:MM:SS
     */
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    },

    /**
     * Show error message
     */
    showError(message) {
        const errorEl = document.getElementById('error-message');
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    },

    /**
     * Hide error message
     */
    hideError() {
        document.getElementById('error-message').classList.add('hidden');
    },

    /**
     * Set loading state
     */
    setLoading(loading) {
        this.isLoading = loading;
        const btn = document.getElementById('connect-btn');
        const text = document.getElementById('connect-text');
        const spinner = document.getElementById('connect-spinner');

        if (loading) {
            btn.disabled = true;
            text.textContent = 'Connecting...';
            spinner.classList.remove('hidden');
        } else {
            btn.disabled = false;
            text.textContent = 'Connect';
            spinner.classList.add('hidden');
        }
    },

    /**
     * Get user-friendly error message
     */
    getErrorMessage(error) {
        if (error.status === 401) {
            return 'Invalid credentials. Please check your username/password or API key.';
        }
        if (error.status === 404) {
            return 'Server not found. Please check the URL.';
        }
        if (error.message.includes('Failed to fetch')) {
            return 'Could not connect to server. Please check the URL and your network connection.';
        }
        return error.message || 'An unexpected error occurred.';
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
