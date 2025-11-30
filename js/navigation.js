/**
 * SwiftShelf TV Navigation Manager
 * Handles D-pad navigation for webOS TV remote
 */

const Navigation = {
    currentScreen: 'login',
    focusedElement: null,
    focusableElements: [],
    carouselIndex: 0,
    currentCarouselRow: 0,
    dropdownOpen: false,
    sidebarOpen: false,
    modalMode: null,

    // Key codes for webOS remote
    KEYS: {
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        ENTER: 13,
        BACK: 461,
        BACK_ALT: 8,
        RED: 403,
        GREEN: 404,
        YELLOW: 405,
        BLUE: 406
    },

    /**
     * Initialize navigation
     */
    init() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.updateFocusableElements();
    },

    /**
     * Update the list of focusable elements for current screen
     */
    updateFocusableElements() {
        // Handle modal mode
        if (this.modalMode) {
            this.updateModalFocusableElements();
            return;
        }

        const screen = document.getElementById(`${this.currentScreen}-screen`);
        if (!screen) return;

        switch (this.currentScreen) {
            case 'login':
                if (this.dropdownOpen) {
                    this.focusableElements = Array.from(
                        document.querySelectorAll('#auth-type-dropdown .dropdown-item')
                    );
                } else {
                    this.focusableElements = Array.from(
                        screen.querySelectorAll('.focusable:not(.hidden):not([disabled])')
                    ).filter(el => !el.closest('.hidden'));
                }
                break;

            case 'library-selection':
                this.focusableElements = Array.from(
                    screen.querySelectorAll('.library-item.focusable, .connect-button.focusable')
                );
                break;

            case 'library':
                if (this.sidebarOpen) {
                    this.focusableElements = Array.from(
                        document.querySelectorAll('#sidebar .focusable')
                    );
                } else {
                    // Combine continue listening and recent books carousels
                    const continueCards = Array.from(document.querySelectorAll('#continue-carousel .book-card'));
                    const recentCards = Array.from(document.querySelectorAll('#books-carousel .book-card'));
                    this.focusableElements = [...continueCards, ...recentCards];
                }
                break;

            case 'search':
                this.focusableElements = Array.from(
                    screen.querySelectorAll('.focusable')
                );
                break;

            case 'player':
                this.focusableElements = Array.from(
                    screen.querySelectorAll('.focusable')
                );
                break;
        }

        // Set initial focus if none
        if (!this.focusedElement && this.focusableElements.length > 0) {
            this.setFocus(this.focusableElements[0]);
        }
    },

    /**
     * Update focusable elements for modal
     */
    updateModalFocusableElements() {
        let modalId;
        switch (this.modalMode) {
            case 'settings':
                modalId = 'settings-modal';
                break;
            case 'book-details':
                modalId = 'book-details-modal';
                break;
            case 'color-picker':
                modalId = 'color-picker-modal';
                break;
            case 'library-picker':
                modalId = 'library-picker-modal';
                break;
            default:
                return;
        }

        const modal = document.getElementById(modalId);
        if (modal) {
            this.focusableElements = Array.from(modal.querySelectorAll('.focusable'));
            if (this.focusableElements.length > 0 && !this.focusedElement) {
                this.setFocus(this.focusableElements[0]);
            }
        }
    },

    /**
     * Set modal mode
     */
    setModalMode(mode) {
        this.modalMode = mode;
        this.focusedElement = null;
        this.updateFocusableElements();
    },

    /**
     * Exit modal mode
     */
    exitModalMode() {
        this.modalMode = null;
        this.focusedElement = null;
        this.updateFocusableElements();
    },

    /**
     * Set focus to an element
     */
    setFocus(element) {
        if (this.focusedElement) {
            this.focusedElement.classList.remove('focused');
            this.focusedElement.blur();
        }

        this.focusedElement = element;

        if (element) {
            element.classList.add('focused');
            element.focus();

            // Scroll carousel if needed
            if (this.currentScreen === 'library' && !this.sidebarOpen && !this.modalMode) {
                this.scrollCarouselToFocused();
                this.updateContentInfoFromFocused();
            }
        }
    },

    /**
     * Update content info when focus changes in carousel
     */
    updateContentInfoFromFocused() {
        if (!this.focusedElement || !this.focusedElement.classList.contains('book-card')) return;

        const bookId = this.focusedElement.dataset.id;
        const source = this.focusedElement.dataset.source;

        if (typeof App !== 'undefined') {
            const bookList = source === 'continue' ? App.continueListeningBooks : App.books;
            const book = bookList.find(b => b.id === bookId);
            if (book) {
                App.onCarouselFocusChange(book);
            }
        }
    },

    /**
     * Handle keydown events
     */
    handleKeyDown(event) {
        const key = event.keyCode;

        // Handle modal navigation
        if (this.modalMode) {
            this.handleModalNavigation(event);
            return;
        }

        // Handle dropdown navigation
        if (this.dropdownOpen) {
            this.handleDropdownNavigation(event);
            return;
        }

        switch (key) {
            case this.KEYS.UP:
                event.preventDefault();
                this.navigateVertical(-1);
                break;

            case this.KEYS.DOWN:
                event.preventDefault();
                this.navigateVertical(1);
                break;

            case this.KEYS.LEFT:
                event.preventDefault();
                this.navigateHorizontal(-1);
                break;

            case this.KEYS.RIGHT:
                event.preventDefault();
                this.navigateHorizontal(1);
                break;

            case this.KEYS.ENTER:
                event.preventDefault();
                this.handleEnter();
                break;

            case this.KEYS.BACK:
            case this.KEYS.BACK_ALT:
                event.preventDefault();
                this.handleBack();
                break;
        }
    },

    /**
     * Handle modal navigation
     */
    handleModalNavigation(event) {
        const key = event.keyCode;
        event.preventDefault();

        switch (key) {
            case this.KEYS.UP:
            case this.KEYS.DOWN:
                const direction = key === this.KEYS.UP ? -1 : 1;
                this.navigateModalVertical(direction);
                break;

            case this.KEYS.LEFT:
            case this.KEYS.RIGHT:
                const hDirection = key === this.KEYS.LEFT ? -1 : 1;
                this.navigateModalHorizontal(hDirection);
                break;

            case this.KEYS.ENTER:
                if (this.focusedElement) {
                    this.focusedElement.click();
                }
                break;

            case this.KEYS.BACK:
            case this.KEYS.BACK_ALT:
                this.handleModalBack();
                break;
        }
    },

    /**
     * Navigate vertically in modal
     */
    navigateModalVertical(direction) {
        const currentIndex = this.focusableElements.indexOf(this.focusedElement);
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = this.focusableElements.length - 1;
        if (newIndex >= this.focusableElements.length) newIndex = 0;

        this.setFocus(this.focusableElements[newIndex]);
    },

    /**
     * Navigate horizontally in modal (for color picker grid, etc.)
     */
    navigateModalHorizontal(direction) {
        if (this.modalMode === 'color-picker') {
            // Color picker has 2 columns
            const currentIndex = this.focusableElements.indexOf(this.focusedElement);
            let newIndex = currentIndex + direction;

            if (newIndex >= 0 && newIndex < this.focusableElements.length) {
                this.setFocus(this.focusableElements[newIndex]);
            }
        } else {
            // For other modals, horizontal navigation moves between buttons
            const currentIndex = this.focusableElements.indexOf(this.focusedElement);
            let newIndex = currentIndex + direction;

            if (newIndex >= 0 && newIndex < this.focusableElements.length) {
                this.setFocus(this.focusableElements[newIndex]);
            }
        }
    },

    /**
     * Handle back button in modal
     */
    handleModalBack() {
        switch (this.modalMode) {
            case 'settings':
                if (typeof App !== 'undefined') App.closeSettings();
                break;
            case 'book-details':
                if (typeof App !== 'undefined') App.closeBookDetails();
                break;
            case 'color-picker':
                if (typeof App !== 'undefined') App.closeColorPicker();
                break;
            case 'library-picker':
                if (typeof App !== 'undefined') App.closeLibraryPicker();
                break;
        }
    },

    /**
     * Navigate vertically
     */
    navigateVertical(direction) {
        switch (this.currentScreen) {
            case 'login':
            case 'library-selection':
            case 'search':
                this.navigateList(direction);
                break;

            case 'library':
                if (this.sidebarOpen) {
                    this.navigateList(direction);
                } else {
                    // Switch between carousel rows
                    this.switchCarouselRow(direction);
                }
                break;

            case 'player':
                this.navigateList(direction);
                break;
        }
    },

    /**
     * Navigate list vertically
     */
    navigateList(direction) {
        const currentIndex = this.focusableElements.indexOf(this.focusedElement);
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = 0;
        if (newIndex >= this.focusableElements.length) {
            newIndex = this.focusableElements.length - 1;
        }

        if (newIndex !== currentIndex) {
            this.setFocus(this.focusableElements[newIndex]);
        }
    },

    /**
     * Switch between carousel rows
     */
    switchCarouselRow(direction) {
        const continueSection = document.getElementById('continue-listening-section');
        const hasContinue = !continueSection.classList.contains('hidden');

        if (!hasContinue) return; // Only one row

        const currentInContinue = this.focusedElement &&
            this.focusedElement.closest('#continue-carousel');
        const currentInRecent = this.focusedElement &&
            this.focusedElement.closest('#books-carousel');

        if (direction === 1 && currentInContinue) {
            // Move down to recent books
            const recentCards = document.querySelectorAll('#books-carousel .book-card');
            if (recentCards.length > 0) {
                this.setFocus(recentCards[0]);
            }
        } else if (direction === -1 && currentInRecent) {
            // Move up to continue listening
            const continueCards = document.querySelectorAll('#continue-carousel .book-card');
            if (continueCards.length > 0) {
                this.setFocus(continueCards[0]);
            }
        }
    },

    /**
     * Navigate horizontally
     */
    navigateHorizontal(direction) {
        switch (this.currentScreen) {
            case 'library':
                if (this.sidebarOpen) {
                    if (direction === 1) {
                        // Close sidebar and go to carousel
                        this.closeSidebar();
                    }
                } else {
                    if (direction === -1 && this.isAtCarouselStart()) {
                        // Open sidebar
                        this.openSidebar();
                    } else {
                        // Navigate within carousel
                        this.navigateCarousel(direction);
                    }
                }
                break;

            case 'player':
                // Navigate player controls horizontally
                this.navigateList(direction);
                break;
        }
    },

    /**
     * Check if at start of carousel
     */
    isAtCarouselStart() {
        if (!this.focusedElement) return true;
        const index = parseInt(this.focusedElement.dataset.index);
        return index === 0;
    },

    /**
     * Navigate within carousel
     */
    navigateCarousel(direction) {
        // Get current carousel's cards
        const currentCarousel = this.focusedElement?.closest('.carousel');
        if (!currentCarousel) return;

        const cards = Array.from(currentCarousel.querySelectorAll('.book-card'));
        const currentIndex = cards.indexOf(this.focusedElement);
        let newIndex = currentIndex + direction;

        if (newIndex >= 0 && newIndex < cards.length) {
            this.setFocus(cards[newIndex]);
        }
    },

    /**
     * Open sidebar
     */
    openSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.add('open');
        this.sidebarOpen = true;
        this.updateFocusableElements();

        // Focus first sidebar item
        if (this.focusableElements.length > 0) {
            this.setFocus(this.focusableElements[0]);
        }
    },

    /**
     * Close sidebar
     */
    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('open');
        this.sidebarOpen = false;
        this.updateFocusableElements();

        // Focus first carousel item
        if (this.focusableElements.length > 0) {
            this.setFocus(this.focusableElements[0]);
        }
    },

    /**
     * Handle enter/select key
     */
    handleEnter() {
        if (!this.focusedElement) return;

        // Check if it's the auth type button
        if (this.focusedElement.id === 'auth-type-btn') {
            this.openDropdown();
            return;
        }

        // For inputs, don't intercept
        if (this.focusedElement.tagName === 'INPUT') {
            return;
        }

        // For buttons and other elements, trigger click
        this.focusedElement.click();
    },

    /**
     * Handle back button
     */
    handleBack() {
        if (this.dropdownOpen) {
            this.closeDropdown();
            return;
        }

        if (this.sidebarOpen) {
            this.closeSidebar();
            return;
        }

        switch (this.currentScreen) {
            case 'library':
                // Open sidebar instead of logging out
                this.openSidebar();
                break;

            case 'search':
                this.switchScreen('library');
                break;

            case 'player':
                if (typeof App !== 'undefined') {
                    App.stopPlayback();
                }
                this.switchScreen('library');
                break;

            case 'library-selection':
                // Go back to login
                this.switchScreen('login');
                break;
        }
    },

    /**
     * Open auth type dropdown
     */
    openDropdown() {
        const dropdown = document.getElementById('auth-type-dropdown');
        dropdown.classList.remove('hidden');
        this.dropdownOpen = true;
        this.updateFocusableElements();

        const currentAuthType = document.getElementById('auth-type-label').textContent;
        const items = this.focusableElements;
        const currentItem = items.find(item => item.textContent === currentAuthType) || items[0];
        this.setFocus(currentItem);
    },

    /**
     * Close auth type dropdown
     */
    closeDropdown() {
        const dropdown = document.getElementById('auth-type-dropdown');
        dropdown.classList.add('hidden');
        this.dropdownOpen = false;
        this.updateFocusableElements();

        const authBtn = document.getElementById('auth-type-btn');
        this.setFocus(authBtn);
    },

    /**
     * Handle navigation within dropdown
     */
    handleDropdownNavigation(event) {
        const key = event.keyCode;
        event.preventDefault();

        switch (key) {
            case this.KEYS.UP:
            case this.KEYS.DOWN:
                const direction = key === this.KEYS.UP ? -1 : 1;
                const currentIndex = this.focusableElements.indexOf(this.focusedElement);
                let newIndex = currentIndex + direction;

                if (newIndex < 0) newIndex = this.focusableElements.length - 1;
                if (newIndex >= this.focusableElements.length) newIndex = 0;

                this.setFocus(this.focusableElements[newIndex]);
                break;

            case this.KEYS.ENTER:
                const authType = this.focusedElement.dataset.authType;
                if (typeof App !== 'undefined' && App.setAuthType) {
                    App.setAuthType(authType);
                }
                this.closeDropdown();
                break;

            case this.KEYS.BACK:
            case this.KEYS.BACK_ALT:
            case this.KEYS.LEFT:
                this.closeDropdown();
                break;
        }
    },

    /**
     * Scroll carousel to keep focused item visible
     */
    scrollCarouselToFocused() {
        if (!this.focusedElement) return;

        const carousel = this.focusedElement.closest('.carousel');
        if (!carousel) return;

        const card = this.focusedElement;
        const cardRect = card.getBoundingClientRect();
        const carouselRect = carousel.getBoundingClientRect();

        if (cardRect.left < carouselRect.left + 48) {
            carousel.scrollLeft -= (carouselRect.left + 100 - cardRect.left);
        } else if (cardRect.right > carouselRect.right - 48) {
            carousel.scrollLeft += (cardRect.right - carouselRect.right + 100);
        }
    },

    /**
     * Switch to a different screen
     */
    switchScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        // Reset state
        this.currentScreen = screenName;
        this.focusedElement = null;
        this.focusableElements = [];
        this.sidebarOpen = false;
        this.modalMode = null;

        // Update focusable elements after DOM updates
        setTimeout(() => {
            this.updateFocusableElements();
        }, 100);
    }
};
