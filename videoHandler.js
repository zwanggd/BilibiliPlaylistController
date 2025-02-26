// Wait for video player to be ready
function setupVideoEndedHandler() {
  // Find Bilibili's video player
  const videoPlayer = document.querySelector('.bpx-player-video-wrap video');
  if (videoPlayer) {
    videoPlayer.addEventListener('ended', handleVideoEnded);
  } else {
    // If player not found, retry after a short delay
    setTimeout(setupVideoEndedHandler, 1000);
  }
}

function handleVideoEnded() {
  const currentItem = document.querySelector('.video-pod__item.active');
  if (currentItem) {
    const nextUrl = currentItem.getAttribute('data-next-url');
    if (nextUrl) {
      // Use Bilibili's router if available, otherwise fallback to direct navigation
      if (window.__INITIAL_STATE__) {
        // Trigger custom navigation event
        document.dispatchEvent(new CustomEvent('biliPlaylistNavigation', {
          detail: { nextUrl }
        }));
      } else {
        window.location.href = nextUrl;
      }
    }
  }
}

// Start monitoring for video player
setupVideoEndedHandler();

// Re-setup handler when video source changes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      setupVideoEndedHandler();
    }
  }
});

// Observe changes to the video container
const videoContainer = document.querySelector('.bpx-player-video-wrap');
if (videoContainer) {
  observer.observe(videoContainer, {
    childList: true,
    subtree: true
  });
} 