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

// Update playNextCustomVideo to use the global loadNewVideo function
function playNextCustomVideo() {
    // Use the next video ID set by our click handler
    if (window.nextVideoId) {
        const nextVideoId = window.nextVideoId;
        const nextVideoUrl = window.nextVideoUrl;
        
        console.log("Playing next video:", nextVideoId);
        
        // Update URL and navigate
        history.replaceState(null, "", nextVideoUrl);
        window.loadNewVideo(nextVideoId);
        
        // Clear the stored next video
        window.nextVideoId = null;
        window.nextVideoUrl = null;
    } else {
        // Fallback to original logic for autoplay
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
        }
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

// Initialize all protections and handlers
function initialize() {
    setupHighlightProtection();
    setupPlaylistProtection();
    setupHistoryProtection();
    setupVideoEndHandler();
}

// Start the initialization
initialize(); 