/**
 * SwiftShelf API Client
 * Handles communication with Audiobookshelf server
 */

const SwiftShelfAPI = {
    hostUrl: '',
    apiToken: '',

    /**
     * Set the server configuration
     */
    configure(hostUrl, apiToken) {
        // Normalize URL (remove trailing slash)
        this.hostUrl = hostUrl.replace(/\/$/, '');
        this.apiToken = apiToken;
    },

    /**
     * Make an authenticated API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.hostUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.apiToken) {
            headers['Authorization'] = `Bearer ${this.apiToken}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`);
                error.status = response.status;
                throw error;
            }

            // Handle empty responses
            const text = await response.text();
            return text ? JSON.parse(text) : {};
        } catch (error) {
            console.error('API request failed:', endpoint, error);
            throw error;
        }
    },

    /**
     * Login with username and password
     * Returns the user object with token
     */
    async login(username, password) {
        const response = await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        return response;
    },

    /**
     * Verify API key by fetching libraries
     * If successful, the API key is valid
     */
    async verifyApiKey() {
        const response = await this.request('/api/libraries');
        return response;
    },

    /**
     * Get all libraries
     */
    async getLibraries() {
        const response = await this.request('/api/libraries');
        return response.libraries || [];
    },

    /**
     * Get library items (recent books)
     */
    async getLibraryItems(libraryId, options = {}) {
        const params = new URLSearchParams({
            limit: options.limit || 20,
            sort: options.sort || 'addedAt',
            desc: options.desc !== false ? 1 : 0,
            expanded: 1
        });

        if (options.filter) {
            params.set('filter', options.filter);
        }

        const response = await this.request(`/api/libraries/${libraryId}/items?${params}`);
        return response.results || [];
    },

    /**
     * Get items in progress (continue listening)
     */
    async getItemsInProgress(libraryId, options = {}) {
        const params = new URLSearchParams({
            limit: options.limit || 20,
            expanded: 1
        });

        // Filter for items with progress
        params.set('filter', 'progress.01-1');

        const response = await this.request(`/api/libraries/${libraryId}/items?${params}`);
        return response.results || [];
    },

    /**
     * Get item details
     */
    async getItemDetails(itemId) {
        return await this.request(`/api/items/${itemId}?include=progress`);
    },

    /**
     * Search library
     */
    async searchLibrary(libraryId, query) {
        const params = new URLSearchParams({
            q: query,
            limit: 10
        });

        return await this.request(`/api/libraries/${libraryId}/search?${params}`);
    },

    /**
     * Start playback session
     */
    async startPlaybackSession(itemId, deviceInfo) {
        return await this.request(`/api/items/${itemId}/play`, {
            method: 'POST',
            body: JSON.stringify({
                deviceInfo: {
                    deviceId: deviceInfo.deviceId || 'webos-' + Date.now(),
                    clientName: 'SwiftShelf webOS',
                    clientVersion: '1.0.0',
                    platform: 'webOS TV',
                    model: deviceInfo.model || 'LG TV',
                    deviceName: deviceInfo.deviceName || 'webOS TV'
                },
                supportedMimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg']
            })
        });
    },

    /**
     * Sync playback session
     */
    async syncSession(sessionId, currentTime, timeListened, duration) {
        return await this.request(`/api/session/${sessionId}/sync`, {
            method: 'POST',
            body: JSON.stringify({
                currentTime,
                timeListened,
                duration
            })
        });
    },

    /**
     * Close playback session
     */
    async closeSession(sessionId, currentTime, timeListened, duration) {
        return await this.request(`/api/session/${sessionId}/close`, {
            method: 'POST',
            body: JSON.stringify({
                currentTime,
                timeListened,
                duration
            })
        });
    },

    /**
     * Update progress directly
     */
    async updateProgress(libraryItemId, currentTime, duration, isFinished = false) {
        const progress = duration > 0 ? currentTime / duration : 0;
        return await this.request('/api/me/progress', {
            method: 'PATCH',
            body: JSON.stringify({
                libraryItemId,
                duration,
                progress,
                currentTime,
                isFinished
            })
        });
    },

    /**
     * Get user's progress for an item
     */
    async getProgress(itemId) {
        try {
            return await this.request(`/api/me/progress/${itemId}`);
        } catch (e) {
            return null;
        }
    },

    /**
     * Get cover image URL
     */
    getCoverUrl(itemId) {
        return `${this.hostUrl}/api/items/${itemId}/cover?token=${this.apiToken}`;
    },

    /**
     * Get audio stream URL for a track
     */
    getAudioStreamUrl(contentUrl) {
        if (contentUrl.startsWith('http')) {
            return contentUrl;
        }
        return `${this.hostUrl}${contentUrl}?token=${this.apiToken}`;
    }
};
