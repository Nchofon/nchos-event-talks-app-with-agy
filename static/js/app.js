// Global App State
let allReleases = [];
let currentFilter = 'all';
let searchQuery = '';
let selectedUpdate = null;

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const lastUpdatedText = document.getElementById('last-updated-text');
const releaseNotesList = document.getElementById('release-notes-list');
const feedLoading = document.getElementById('feed-loading');
const feedError = document.getElementById('feed-error');
const errorMessageText = document.getElementById('error-message-text');
const retryBtn = document.getElementById('retry-btn');
const feedEmpty = document.getElementById('feed-empty');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const filterContainer = document.getElementById('filter-container');

// Stats Counters Elements
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statAnnouncements = document.getElementById('stat-announcements');
const statIssues = document.getElementById('stat-issues');

// Floating Action Bar Elements
const floatingActionBar = document.getElementById('floating-action-bar');
const selectedCount = document.getElementById('selected-count');
const selectedSnippet = document.getElementById('selected-snippet');
const previewTweetBtn = document.getElementById('preview-tweet-btn');
const copyClipboardBtn = document.getElementById('copy-clipboard-btn');
const clearSelectionBtn = document.getElementById('clear-selection-btn');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const progressBarCircle = document.getElementById('progress-bar-circle');
const tweetLinkPreview = document.getElementById('tweet-link-preview');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const tweetSubmitBtn = document.getElementById('tweet-submit-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

// Style Maps for Categories
const CATEGORY_MAP = {
    'Feature': { color: 'var(--color-feature)', glow: 'var(--color-feature-glow)', icon: 'fa-solid fa-cube' },
    'Announcement': { color: 'var(--color-announcement)', glow: 'var(--color-announcement-glow)', icon: 'fa-solid fa-bullhorn' },
    'Issue': { color: 'var(--color-issue)', glow: 'var(--color-issue-glow)', icon: 'fa-solid fa-bug' },
    'Change': { color: 'var(--color-change)', glow: 'var(--color-change-glow)', icon: 'fa-solid fa-pen-to-square' },
    'Breaking': { color: 'var(--color-breaking)', glow: 'var(--color-breaking-glow)', icon: 'fa-solid fa-triangle-exclamation' }
};

// ==========================================================================
// 1. Data Fetching & State Management
// ==========================================================================

async function fetchReleases() {
    // Start loader
    setLoadingState(true);
    clearSelection();
    
    try {
        const response = await fetch('/api/releases');
        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.status === 'success') {
            allReleases = result.data;
            updateStats();
            renderReleases();
            
            // Update time
            const now = new Date();
            lastUpdatedText.textContent = `Updated ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
            
            setLoadingState(false);
            showToast("Release notes refreshed!");
        } else {
            throw new Error(result.message || "Failed parsing the XML feed.");
        }
    } catch (err) {
        console.error(err);
        setLoadingState(false);
        setErrorState(true, err.message);
    }
}

function setLoadingState(isLoading) {
    if (isLoading) {
        refreshIcon.classList.add('spin');
        refreshBtn.disabled = true;
        feedLoading.style.display = 'flex';
        feedError.style.display = 'none';
        feedEmpty.style.display = 'none';
        releaseNotesList.style.display = 'none';
    } else {
        refreshIcon.classList.remove('spin');
        refreshBtn.disabled = false;
        feedLoading.style.display = 'none';
    }
}

function setErrorState(isError, msg = '') {
    if (isError) {
        feedError.style.display = 'flex';
        errorMessageText.textContent = msg || "An error occurred while fetching the release notes. Please try again.";
        releaseNotesList.style.display = 'none';
        feedEmpty.style.display = 'none';
    } else {
        feedError.style.display = 'none';
    }
}

// ==========================================================================
// 2. Stats Bar Calculation
// ==========================================================================

function updateStats() {
    let total = 0;
    let features = 0;
    let announcements = 0;
    let issuesChanges = 0;

    allReleases.forEach(entry => {
        entry.updates.forEach(update => {
            total++;
            if (update.type === 'Feature') features++;
            else if (update.type === 'Announcement') announcements++;
            else if (['Issue', 'Change', 'Breaking'].includes(update.type)) issuesChanges++;
        });
    });

    statTotal.textContent = total;
    statFeatures.textContent = features;
    statAnnouncements.textContent = announcements;
    statIssues.textContent = issuesChanges;
}

// ==========================================================================
// 3. UI Rendering & Template Building
// ==========================================================================

function renderReleases() {
    releaseNotesList.innerHTML = '';
    let totalDisplayed = 0;

    allReleases.forEach(entry => {
        // Filter sub-updates
        const filteredUpdates = entry.updates.filter(update => {
            // Category check
            const matchesCategory = currentFilter === 'all' || update.type === currentFilter;
            
            // Search query check
            const plainText = stripHtml(update.html).toLowerCase();
            const matchesSearch = !searchQuery || 
                                  plainText.includes(searchQuery) || 
                                  update.type.toLowerCase().includes(searchQuery) ||
                                  entry.date.toLowerCase().includes(searchQuery);
                                  
            return matchesCategory && matchesSearch;
        });

        // Only build the group if there's at least one update left
        if (filteredUpdates.length > 0) {
            const dayGroup = document.createElement('div');
            dayGroup.className = 'day-group';
            
            const relativeTime = getRelativeTime(entry.updated);
            
            dayGroup.innerHTML = `
                <div class="day-header">
                    <div class="day-date-sticky">
                        <span>${entry.date}</span>
                        <span class="day-relative-time">${relativeTime}</span>
                    </div>
                </div>
                <div class="day-updates-list"></div>
            `;
            
            const listContainer = dayGroup.querySelector('.day-updates-list');
            
            filteredUpdates.forEach(update => {
                totalDisplayed++;
                const card = createUpdateCard(entry, update);
                listContainer.appendChild(card);
            });
            
            releaseNotesList.appendChild(dayGroup);
        }
    });

    // Toggle Empty State vs List Visibility
    if (totalDisplayed === 0) {
        releaseNotesList.style.display = 'none';
        feedEmpty.style.display = 'flex';
    } else {
        releaseNotesList.style.display = 'flex';
        feedEmpty.style.display = 'none';
    }
}

function createUpdateCard(entry, update) {
    const card = document.createElement('article');
    card.className = 'update-card';
    
    // Unify styling configurations
    const config = CATEGORY_MAP[update.type] || { color: 'var(--color-general)', glow: 'var(--color-general-glow)', icon: 'fa-solid fa-circle-info' };
    card.style.setProperty('--type-color', config.color);
    card.style.setProperty('--type-color-glow', config.glow);
    
    // Check if this specific card matches current selection
    const isSelected = selectedUpdate && 
                       selectedUpdate.id === entry.id && 
                       selectedUpdate.type === update.type && 
                       selectedUpdate.html === update.html;
                       
    if (isSelected) {
        card.classList.add('selected');
    }
    
    card.innerHTML = `
        <div class="card-select-checkbox">
            <i class="fa-solid fa-check"></i>
        </div>
        <div class="card-main-content">
            <div class="card-meta-header">
                <span class="badge">
                    <i class="${config.icon}"></i> ${update.type}
                </span>
                <div class="quick-actions">
                    <button class="btn-icon-action action-tweet" title="Tweet this update">
                        <i class="fa-brands fa-x-twitter"></i>
                    </button>
                    <button class="btn-icon-action action-copy" title="Copy to clipboard">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="update-body-text">${update.html}</div>
        </div>
    `;

    // Setup Click selection (clicking anywhere on card handles selection toggle)
    card.addEventListener('click', (e) => {
        // Ignore clicks on buttons to avoid triggering twice
        if (e.target.closest('.quick-actions') || e.target.closest('a')) {
            return;
        }
        toggleCardSelection(card, entry, update);
    });

    // Quick Action button listeners
    const tweetBtn = card.querySelector('.action-tweet');
    tweetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTweetModalForUpdate(entry, update);
    });

    const copyBtn = card.querySelector('.action-copy');
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const plainText = getFormattedShareText(entry.date, update.type, update.html, entry.link);
        copyToClipboard(plainText);
    });

    return card;
}

// ==========================================================================
// 4. Selection Mechanics & Floating Action Bar
// ==========================================================================

function toggleCardSelection(cardElement, entry, update) {
    const isCurrentlySelected = cardElement.classList.contains('selected');
    
    // Clear selection
    clearSelection();
    
    if (!isCurrentlySelected) {
        cardElement.classList.add('selected');
        selectedUpdate = {
            id: entry.id,
            date: entry.date,
            type: update.type,
            html: update.html,
            link: entry.link
        };
        
        // Show floating action bar
        selectedCount.textContent = "1";
        const plainTextSnippet = stripHtml(update.html).substring(0, 100).trim() + "...";
        selectedSnippet.textContent = `[${update.type}] ${plainTextSnippet}`;
        floatingActionBar.classList.add('show');
    }
}

function clearSelection() {
    selectedUpdate = null;
    document.querySelectorAll('.update-card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    floatingActionBar.classList.remove('show');
}

// ==========================================================================
// 5. Sharing Formatting & Customization Modal
// ==========================================================================

function getFormattedShareText(date, type, html, link) {
    const rawBody = stripHtml(html).replace(/\s+/g, ' ').trim();
    const header = `BigQuery Update [${date}] - ${type}:\n\n`;
    const footer = link ? `\n\nSource: ${link}` : '';
    return `${header}${rawBody}${footer}`;
}

function openTweetModalForUpdate(entry, update) {
    selectedUpdate = {
        id: entry.id,
        date: entry.date,
        type: update.type,
        html: update.html,
        link: entry.link
    };
    
    // Build prefilled text adhering to 280-char limit rules
    const prefilledText = generatePrefilledTweet(selectedUpdate);
    tweetTextarea.value = prefilledText;
    
    // Update link preview banner
    tweetLinkPreview.textContent = entry.link || 'https://docs.cloud.google.com/bigquery/docs/release-notes';
    
    // Trigger modal visual animation
    tweetModal.classList.add('show');
    
    // Set initial character counting
    updateCharProgress(prefilledText);
    
    // Focus textarea
    setTimeout(() => tweetTextarea.focus(), 200);
}

function generatePrefilledTweet(selected) {
    const rawBody = stripHtml(selected.html).replace(/\s+/g, ' ').trim();
    const header = `BigQuery Update [${selected.date}] - ${selected.type}:\n\n`;
    
    // X/Twitter counts links as exactly 23 characters
    const link = selected.link || '';
    const footer = link ? `\n\nSource: ${link}` : '';
    const footerLengthForTwitter = link ? ('\n\nSource: '.length + 23) : 0;
    
    const maxBodyLength = 280 - header.length - footerLengthForTwitter;
    
    let body = rawBody;
    if (body.length > maxBodyLength) {
        body = body.substring(0, maxBodyLength - 3) + '...';
    }
    
    return `${header}${body}${footer}`;
}

function countTwitterCharacters(text, originalLink) {
    let tempText = text;
    // Replace URL in the text with 23 characters to accurately mirror Twitter counting
    if (originalLink && tempText.includes(originalLink)) {
        tempText = tempText.replace(originalLink, 'x'.repeat(23));
    }
    return tempText.length;
}

function updateCharProgress(text) {
    const link = selectedUpdate ? selectedUpdate.link : '';
    const charCount = countTwitterCharacters(text, link);
    
    charCounter.textContent = `${charCount}/280`;
    
    const percentage = Math.min(charCount / 280, 1);
    const perimeter = 2 * Math.PI * 10; // r=10 -> 62.83
    const offset = perimeter * (1 - percentage);
    progressBarCircle.style.strokeDashoffset = offset;
    
    if (charCount > 280) {
        progressBarCircle.style.stroke = '#ef4444'; // neon red
        charCounter.style.color = '#ef4444';
        tweetSubmitBtn.disabled = true;
        tweetSubmitBtn.style.opacity = '0.5';
    } else if (charCount >= 260) {
        progressBarCircle.style.stroke = '#f59e0b'; // neon yellow
        charCounter.style.color = '#f59e0b';
        tweetSubmitBtn.disabled = false;
        tweetSubmitBtn.style.opacity = '1';
    } else {
        progressBarCircle.style.stroke = 'var(--accent-color)'; // default neon blue
        charCounter.style.color = 'var(--text-secondary)';
        tweetSubmitBtn.disabled = false;
        tweetSubmitBtn.style.opacity = '1';
    }
}

function closeTweetModal() {
    tweetModal.classList.remove('show');
}

function submitTweet() {
    const text = tweetTextarea.value;
    const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
    
    closeTweetModal();
    clearSelection();
    showToast("Opened X/Twitter composer!");
}

// ==========================================================================
// 6. Helpers / Utilities
// ==========================================================================

function stripHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
}

function getRelativeTime(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return 'Just now';
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
        }
        const months = Math.floor(diffDays / 30);
        return months === 1 ? '1 month ago' : `${months} months ago`;
    } catch (e) {
        return '';
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("Copied to clipboard!");
        }).catch(err => {
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast("Copied to clipboard!");
    } catch (err) {
        showToast("Failed to copy text");
    }
    document.body.removeChild(textArea);
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    toastMsg.textContent = message;
    
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==========================================================================
// 7. Event Listeners Initialization
// ==========================================================================

// Refresh triggers
refreshBtn.addEventListener('click', fetchReleases);
retryBtn.addEventListener('click', fetchReleases);

// Filter chips triggers
filterContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    
    currentFilter = chip.getAttribute('data-filter');
    renderReleases();
});

resetFiltersBtn.addEventListener('click', () => {
    currentFilter = 'all';
    searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.filter-chip[data-filter="all"]').classList.add('active');
    
    renderReleases();
});

// Search input triggers
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    if (searchQuery) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }
    renderReleases();
});

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    renderReleases();
});

// Floating Action bar triggers
clearSelectionBtn.addEventListener('click', clearSelection);

copyClipboardBtn.addEventListener('click', () => {
    if (selectedUpdate) {
        const plainText = getFormattedShareText(selectedUpdate.date, selectedUpdate.type, selectedUpdate.html, selectedUpdate.link);
        copyToClipboard(plainText);
        clearSelection();
    }
});

previewTweetBtn.addEventListener('click', () => {
    if (selectedUpdate) {
        openTweetModalForUpdate({ date: selectedUpdate.date, link: selectedUpdate.link, id: selectedUpdate.id }, { type: selectedUpdate.type, html: selectedUpdate.html });
    }
});

// Modal triggers
tweetTextarea.addEventListener('input', (e) => {
    updateCharProgress(e.target.value);
});

closeModalBtn.addEventListener('click', closeTweetModal);
modalCancelBtn.addEventListener('click', closeTweetModal);
tweetSubmitBtn.addEventListener('click', submitTweet);

// Close modal when clicking outside modal-container
tweetModal.addEventListener('click', (e) => {
    if (e.target === tweetModal) {
        closeTweetModal();
    }
});

// Kickstart App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleases();
});
