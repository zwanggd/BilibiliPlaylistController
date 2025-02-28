// Prevent Bilibili from updating playlist highlight
function setupHighlightProtection() {
    // Temporarily disabled to test behavior
    /*
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === "attributes" && mutation.attributeName === "data-scrolled") {
                console.log("Blocked Bilibili from changing the active video highlight.");
                mutation.target.setAttribute("data-scrolled", "true");
            }
        });
    });

    // Watch all video list items for changes
    document.querySelectorAll(".video-pod__item").forEach((item) => {
        observer.observe(item, { attributes: true });
    });
    */
}

// Prevent Bilibili from regenerating the playlist
function setupPlaylistProtection() {
    let isCustomizing = false;  // Flag to track our custom operations

    const playlistObserver = new MutationObserver((mutations) => {
        if (isCustomizing) return;  // Skip if we're making changes

        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.target.classList.contains("video-pod__list")) {
                // Don't clear the list, just prevent unwanted updates
                mutation.addedNodes.forEach(node => {
                    if (!node.hasAttribute('data-our-change')) {
                        node.remove();
                    }
                });
            }
        });
    });

    // Start observing the playlist container
    let playlistContainer = document.querySelector(".video-pod__list");
    if (playlistContainer) {
        playlistObserver.observe(playlistContainer, {
            childList: true,
            subtree: true
        });
    }

    // Expose the flag setter for our operations
    window.setPlaylistCustomizing = function(value) {
        isCustomizing = value;
    };
}

// Override Bilibili's history manipulation
function setupHistoryProtection() {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(state, title, url) {
        console.log("Intercepted Bilibili's pushState:", url);
        if (!url.includes('video')) return originalPushState.call(this, state, title, url);
        history.replaceState(state, title, url);
    };

    window.history.replaceState = function(state, title, url) {
        console.log("Intercepted Bilibili's replaceState:", url);
        if (!url.includes('video')) return originalReplaceState.call(this, state, title, url);
    };
}

// Make loadNewVideo available globally
window.loadNewVideo = async function(videoId) {
    try {
        // Get video info from Bilibili's API
        const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${videoId}`);
        const data = await response.json();
        if (data.code === 0 && data.data) {
            const cid = data.data.cid;
            const aid = data.data.aid;
            
            // Update player with new video
            if (window.player) {
                await window.player.reload({
                    bvid: videoId,
                    cid: cid,
                    aid: aid
                });
                return true;
            }
        }
    } catch (error) {
        console.error("Failed to load new video:", error);
        return false;
    }
};

// Add event listener for next video updates
document.addEventListener('updateNextVideo', (event) => {
    window.nextVideoId = event.detail.nextVideoId;
    window.nextVideoUrl = event.detail.nextVideoUrl;
});

// Update playNextCustomVideo to handle next video properly
function playNextCustomVideo() {
    let currentVideo = document.querySelector(".video-pod__item[data-scrolled='true']");
    if (!currentVideo) return;

    let playlist = Array.from(document.querySelectorAll(".video-pod__item"));
    let currentIndex = playlist.indexOf(currentVideo);

    if (currentIndex !== -1 && currentIndex + 1 < playlist.length) {
        let nextVideo = playlist[currentIndex + 1];
        let nextVideoId = nextVideo.getAttribute("data-key");

        console.log("Switching to next video:", nextVideoId);

        let newUrl = `https://www.bilibili.com/video/${nextVideoId}`;
        history.replaceState(null, "", newUrl);
        window.loadNewVideo(nextVideoId);

        // Update active state for all items
        playlist.forEach(item => {
            item.setAttribute('data-scrolled', item === nextVideo ? 'true' : 'false');
        });

        // Update next video info for auto-play
        if (currentIndex + 2 < playlist.length) {
            const nextNextVideo = playlist[currentIndex + 2];
            const event = new CustomEvent('updateNextVideo', {
                detail: {
                    nextVideoId: nextNextVideo.getAttribute('data-key'),
                    nextVideoUrl: `https://www.bilibili.com/video/${nextNextVideo.getAttribute('data-key')}`
                }
            });
            document.dispatchEvent(event);
        }

        nextVideo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function setupVideoEndHandler() {
    const videoElement = document.querySelector("video");
    if (videoElement) {
        videoElement.addEventListener("ended", playNextCustomVideo);
    } else {
        setTimeout(setupVideoEndHandler, 1000);
    }
}

// Function to play previous video
function playPreviousVideo() {
    let currentVideo = document.querySelector(".video-pod__item[data-scrolled='true']");
    if (!currentVideo) return;

    let playlist = Array.from(document.querySelectorAll(".video-pod__item"));
    let currentIndex = playlist.indexOf(currentVideo);

    if (currentIndex > 0) {
        let prevVideo = playlist[currentIndex - 1];
        let prevVideoId = prevVideo.getAttribute("data-key");

        console.log("Switching to previous video:", prevVideoId);

        let newUrl = `https://www.bilibili.com/video/${prevVideoId}`;
        history.replaceState(null, "", newUrl);
        window.loadNewVideo(prevVideoId);

        // Update active state for all items
        playlist.forEach(item => {
            item.setAttribute('data-scrolled', item === prevVideo ? 'true' : 'false');
        });

        // Update next video info
        if (currentIndex - 1 >= 0) {
            const event = new CustomEvent('updateNextVideo', {
                detail: {
                    nextVideoId: currentVideo.getAttribute('data-key'),
                    nextVideoUrl: `https://www.bilibili.com/video/${currentVideo.getAttribute('data-key')}`
                }
            });
            document.dispatchEvent(event);
        }

        prevVideo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Override Bilibili's default video navigation with retry mechanism
function overrideVideoNavigation() {
    // Override the video player's next/previous functions
    if (window.player) {
        window.player.next = function() {
            playNextCustomVideo();
            return false;
        };

        window.player.prev = function() {
            playPreviousVideo();
            return false;
        };
    }

    // Override button click handlers with retry
    function setupButtons() {
        const prevButton = document.querySelector('.bpx-player-ctrl-prev');
        const nextButton = document.querySelector('.bpx-player-ctrl-next');
        const controlsExist = prevButton && nextButton;

        if (controlsExist) {
            // Previous button
            prevButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                playPreviousVideo();
                return false;
            };

            // Next button
            nextButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                playNextCustomVideo();
                return false;
            };

            // Make buttons visible if they're hidden
            prevButton.style.display = 'flex';
            nextButton.style.display = 'flex';
            
            return true;
        }
        return false;
    }

    // Try to set up buttons immediately
    if (!setupButtons()) {
        // If buttons aren't found, wait for them to appear
        const observer = new MutationObserver((mutations, obs) => {
            if (setupButtons()) {
                obs.disconnect(); // Stop observing once buttons are set up
            }
        });

        // Observe the player container for changes
        const playerContainer = document.querySelector('.bpx-player-control-bottom-left');
        if (playerContainer) {
            observer.observe(playerContainer, {
                childList: true,
                subtree: true
            });
        }
    }
}

// Initialize all protections and handlers
function initialize() {
    setupHighlightProtection();
    setupPlaylistProtection();
    setupHistoryProtection();
    setupVideoEndHandler();
    overrideVideoNavigation();

    // Periodically check and reapply navigation override
    // (in case player reloads)
    setInterval(() => {
        overrideVideoNavigation();
    }, 2000); // Increased interval to reduce CPU usage
}

// Start the initialization
initialize();

// Add cleanup on page unload
window.addEventListener('unload', () => {
    // Remove video event listeners
    const videoElement = document.querySelector("video");
    if (videoElement) {
        videoElement.removeEventListener("ended", playNextCustomVideo);
    }

    // Clean up navigation overrides
    if (window.player) {
        window.player.next = null;
        window.player.prev = null;
    }

    // Remove our custom event listeners
    document.removeEventListener('updateNextVideo', null);

    // Clear our interval
    if (window.navigationInterval) {
        clearInterval(window.navigationInterval);
    }
});

// Store interval reference
window.navigationInterval = setInterval(() => {
    overrideVideoNavigation();
}, 2000); 