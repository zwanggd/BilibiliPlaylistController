// Completely block URL changes for video selections
function blockUrlChangesForVideoSelections() {
    const playlistType = getPlaylistType();
    
    if (playlistType !== 'pod') {
        console.log("Video selection mode detected, blocking URL changes");
        
        // Save original history methods
        const originalPushState = window.history.pushState;
        const originalReplaceState = window.history.replaceState;
        
        // Override with versions that check the URL
        window.history.pushState = function(state, title, url) {
            // Allow non-video URL changes
            if (url && !url.includes('/video/BV')) {
                return originalPushState.call(this, state, title, url);
            }
            console.log("Blocked pushState URL change to:", url);
        };
        
        window.history.replaceState = function(state, title, url) {
            // Allow non-video URL changes
            if (url && !url.includes('/video/BV')) {
                return originalReplaceState.call(this, state, title, url);
            }
            console.log("Blocked replaceState URL change to:", url);
        };
        
        // Also intercept anchor clicks in the video selection list
        const videoItems = document.querySelectorAll('.video-pod__item a, .video-section-list-item a');
        videoItems.forEach(link => {
            link.addEventListener('click', function(e) {
                if (this.href && this.href.includes('/video/BV')) {
                    e.preventDefault();
                    console.log("Blocked link navigation to:", this.href);
                    
                    // Extract the video ID from the href
                    const videoId = this.href.match(/\/video\/(BV[a-zA-Z0-9]+)/)?.[1];
                    if (videoId) {
                        // Use our custom video loading without URL change
                        window.player.reload({
                            bvid: videoId
                        });
                        
                        // Update active state
                        const items = document.querySelectorAll('.video-pod__item, .video-section-list-item');
                        items.forEach(item => {
                            const itemVideoId = item.getAttribute('data-key');
                            if (itemVideoId === videoId) {
                                item.classList.add('active');
                                if (item.hasAttribute('data-active')) {
                                    item.setAttribute('data-active', 'true');
                                }
                            } else {
                                item.classList.remove('active');
                                if (item.hasAttribute('data-active')) {
                                    item.setAttribute('data-active', 'false');
                                }
                            }
                        });
                    }
                }
            }, true); // Use capture phase to intercept before Bilibili's handlers
        });
    }
}

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

// Add a function to detect the playlist type
function getPlaylistType() {
    const videoPodList = document.querySelector('.video-pod__list');
    const videoSectionList = document.querySelector('.video-section-list');
    
    if (videoPodList && videoPodList.children.length > 0) {
        return 'pod';
    } else if (videoSectionList && videoSectionList.children.length > 0) {
        return 'section';
    } else {
        // Check for any other list container within video-pod
        const anyList = document.querySelector('.video-pod [class*="list"]');
        return anyList ? 'unknown' : null;
    }
}

// Update loadNewVideo to handle the two modes differently
window.loadNewVideo = async function(videoId) {
    try {
        // Get video info from Bilibili's API
        const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${videoId}`);
        const data = await response.json();
        
        if (data.code === 0 && data.data) {
            const cid = data.data.cid;
            const aid = data.data.aid;
            const playlistType = getPlaylistType();
            
            // For video selections, try to find and click the item directly
            if (playlistType !== 'pod') {
                const videoItem = document.querySelector(`.video-pod__item[data-key="${videoId}"], .video-section-list-item[data-key="${videoId}"]`);
                if (videoItem) {
                    console.log("Video selection mode: clicking item directly");
                    // Simulate a click on the item itself, not looking for <a> tags
                    videoItem.click();
                    return true;
                }
            }
            
            // For regular playlists or as fallback, use the player API and URL change
            if (window.player) {
                console.log("Regular playlist mode or fallback: using player API");
                
                // Only update URL for regular playlists
                if (playlistType === 'pod') {
                    const newUrl = `https://www.bilibili.com/video/${videoId}`;
                    history.replaceState(null, "", newUrl);
                }
                
                await window.player.reload({
                    bvid: videoId,
                    cid: cid,
                    aid: aid
                });
                
                // Update active state based on playlist type
                if (playlistType === 'pod') {
                    const items = document.querySelectorAll('.video-pod__item');
                    items.forEach(item => {
                        item.setAttribute('data-scrolled', item.getAttribute('data-key') === videoId ? 'true' : 'false');
                    });
                } else {
                    const items = document.querySelectorAll('.video-pod__item, .video-section-list-item');
                    items.forEach(item => {
                        if (item.getAttribute('data-key') === videoId) {
                            item.classList.add('active');
                            if (item.hasAttribute('data-active')) {
                                item.setAttribute('data-active', 'true');
                            }
                        } else {
                            item.classList.remove('active');
                            if (item.hasAttribute('data-active')) {
                                item.setAttribute('data-active', 'false');
                            }
                        }
                    });
                }
                
                return true;
            }
        }
    } catch (error) {
        console.error("Failed to load new video:", error);
        // Show error message
        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: rgba(255, 0, 0, 0.8);
            color: white;
            border-radius: 4px;
            z-index: 9999;
        `;
        errorMsg.textContent = '视频加载失败，请刷新页面重试 / Video loading failed, please refresh';
        document.body.appendChild(errorMsg);
        setTimeout(() => errorMsg.remove(), 3000);
        return false;
    }
};

// Add event listener for next video updates
document.addEventListener('updateNextVideo', (event) => {
    window.nextVideoId = event.detail.nextVideoId;
    window.nextVideoUrl = event.detail.nextVideoUrl;
});

// Update playNextCustomVideo to handle both playlist types
function playNextCustomVideo() {
    const playlistType = getPlaylistType();
    
    // Get the current active item using a more flexible approach
    let currentVideo = document.querySelector(".video-pod__item[data-scrolled='true']") || 
                       document.querySelector(".video-pod__item.active") ||
                       document.querySelector(".video-section-list-item.active");
    
    if (!currentVideo) return;

    // Get all playlist items in a more flexible way
    let playlist = Array.from(document.querySelectorAll(".video-pod__item").length > 0 ? 
                             document.querySelectorAll(".video-pod__item") : 
                             document.querySelectorAll(".video-section-list-item"));
    
    let currentIndex = playlist.indexOf(currentVideo);

    if (currentIndex !== -1 && currentIndex + 1 < playlist.length) {
        let nextVideo = playlist[currentIndex + 1];
        let nextVideoId = nextVideo.getAttribute("data-key");

        console.log("Switching to next video:", nextVideoId);

        // Only update URL for regular playlists
        if (playlistType === 'pod') {
            let newUrl = `https://www.bilibili.com/video/${nextVideoId}`;
            history.replaceState(null, "", newUrl);
        }
        
        window.loadNewVideo(nextVideoId);

        // Update active state for all items
        if (nextVideo.classList.contains("video-pod__item")) {
            playlist.forEach(item => {
                item.setAttribute('data-scrolled', item === nextVideo ? 'true' : 'false');
            });
        } else {
            playlist.forEach(item => {
                item.classList.toggle('active', item === nextVideo);
                if (item.hasAttribute('data-active')) {
                    item.setAttribute('data-active', item === nextVideo ? 'true' : 'false');
                }
            });
        }

        // Update next video info for auto-play
        if (currentIndex + 2 < playlist.length) {
            const nextNextVideo = playlist[currentIndex + 2];
            
            // Create event with or without URL based on playlist type
            const eventDetail = playlistType === 'pod' 
                ? {
                    nextVideoId: nextNextVideo.getAttribute('data-key'),
                    nextVideoUrl: `https://www.bilibili.com/video/${nextNextVideo.getAttribute('data-key')}`
                }
                : {
                    nextVideoId: nextNextVideo.getAttribute('data-key'),
                    // Don't include nextVideoUrl for video selections
                };
            
            document.dispatchEvent(new CustomEvent('updateNextVideo', {
                detail: eventDetail
            }));
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
    blockUrlChangesForVideoSelections();
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