/**
 * SwiftShelf Storage Manager
 * Handles persistent storage for webOS
 */

const Storage = {
    PREFIX: 'swiftshelf_',

    /**
     * Save a value to localStorage
     */
    set(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(this.PREFIX + key, serialized);
            return true;
        } catch (error) {
            console.error('Storage.set failed:', key, error);
            return false;
        }
    },

    /**
     * Get a value from localStorage
     */
    get(key, defaultValue = null) {
        try {
            const serialized = localStorage.getItem(this.PREFIX + key);
            if (serialized === null) {
                return defaultValue;
            }
            return JSON.parse(serialized);
        } catch (error) {
            console.error('Storage.get failed:', key, error);
            return defaultValue;
        }
    },

    /**
     * Remove a value from localStorage
     */
    remove(key) {
        try {
            localStorage.removeItem(this.PREFIX + key);
            return true;
        } catch (error) {
            console.error('Storage.remove failed:', key, error);
            return false;
        }
    },

    /**
     * Clear all SwiftShelf data
     */
    clear() {
        try {
            const keys = Object.keys(localStorage).filter(k => k.startsWith(this.PREFIX));
            keys.forEach(k => localStorage.removeItem(k));
            return true;
        } catch (error) {
            console.error('Storage.clear failed:', error);
            return false;
        }
    },

    // Convenience methods for common data
    saveCredentials(hostUrl, apiToken, authType) {
        this.set('hostUrl', hostUrl);
        this.set('apiToken', apiToken);
        this.set('authType', authType);
    },

    getCredentials() {
        return {
            hostUrl: this.get('hostUrl', ''),
            apiToken: this.get('apiToken', ''),
            authType: this.get('authType', 'username')
        };
    },

    clearCredentials() {
        this.remove('hostUrl');
        this.remove('apiToken');
        this.remove('authType');
    },

    // Library management
    saveSelectedLibraries(libraryIds) {
        this.set('selectedLibraryIds', libraryIds);
    },

    getSelectedLibraries() {
        return this.get('selectedLibraryIds', []);
    },

    saveCurrentLibrary(libraryId) {
        this.set('currentLibraryId', libraryId);
    },

    getCurrentLibrary() {
        return this.get('currentLibraryId', null);
    },

    // Settings
    saveSettings(settings) {
        this.set('settings', settings);
    },

    getSettings() {
        return this.get('settings', {
            itemLimit: 20,
            playbackSpeed: 1.0,
            progressBarColor: 'Yellow'
        });
    },

    // Playback state
    savePlaybackState(state) {
        this.set('playbackState', state);
    },

    getPlaybackState() {
        return this.get('playbackState', null);
    },

    clearPlaybackState() {
        this.remove('playbackState');
    }
};
