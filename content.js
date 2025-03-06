// Helper function for debouncing - move to top
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

class BilibiliPlaylistManager {
  constructor() {
    this.originalOrder = [];
    this.buttonsAdded = false;
    this.init();
  }

  init() {
    // Create separate observers for playlist and header
    const playlistObserver = new MutationObserver((mutations) => {
      const playlist = document.querySelector('.video-pod__list');
      if (playlist && !this.originalOrder.length) {
        this.saveOriginalOrder();
        this.setupVideoNavigation();
      }
    });

    const headerObserver = new MutationObserver((mutations) => {
      const header = document.querySelector('.video-pod__header .header-top .left');
      if (header && !document.querySelector('.playlist-controls')) {
        this.addControlButtons();
        this.buttonsAdded = true;
      }
    });

    // Observe only specific parts of the DOM
    const playlistContainer = document.querySelector('.video-pod');
    if (playlistContainer) {
        playlistObserver.observe(playlistContainer, {
            childList: true,
            subtree: true
        });
    }

    const headerContainer = document.querySelector('.video-pod__header');
    if (headerContainer) {
        headerObserver.observe(headerContainer, {
            childList: true,
            subtree: true
        });
    }

    // Set up a retry mechanism for initial setup
    const setupInterval = setInterval(() => {
        const playlist = document.querySelector('.video-pod__list');
        const header = document.querySelector('.video-pod__header .header-top .left');
        
        if (playlist && !this.originalOrder.length) {
            this.saveOriginalOrder();
            this.setupVideoNavigation();
        }
        
        if (header && !document.querySelector('.playlist-controls')) {
            this.addControlButtons();
            this.buttonsAdded = true;
        }

        if (this.originalOrder.length && this.buttonsAdded) {
            clearInterval(setupInterval);
        }
    }, 1000);

    // Clean up interval after 10 seconds to prevent infinite running
    setTimeout(() => clearInterval(setupInterval), 10000);
  }

  setupVideoNavigation() {
    // Inject the external script file
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('playerHandler.js');
    script.type = 'text/javascript';
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
  }

  shouldShowControls() {
    // Check for the header-bottom element which only exists in video lists
    const headerBottom = document.querySelector('.video-pod__header .header-bottom');
    
    // If header-bottom exists, it's a video list (not a video selection)
    return !!headerBottom;
  }

  addControlButtons() {
    const header = document.querySelector('.video-pod__header .header-top .left');
    if (!header || this.buttonsAdded) return;

    // Check if we should show controls
    if (!this.shouldShowControls()) {
      console.log("Video selection detected, not showing playlist controls");
      return;
    }

    // Create container for our buttons
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'playlist-controls';
    controlsContainer.style.cssText = 'display: inline-flex; align-items: center; margin-left: 12px; gap: 8px;';

    // Add reverse button
    const reverseBtn = this.createControlButton('reverseBtn', '倒序', this.reversePlaylist.bind(this));
    controlsContainer.appendChild(reverseBtn);

    // Add shuffle button
    const shuffleBtn = this.createControlButton('shuffleBtn', '随机', this.shufflePlaylist.bind(this));
    controlsContainer.appendChild(shuffleBtn);

    // Add reset button
    const resetBtn = this.createControlButton('resetBtn', '重置', this.resetPlaylist.bind(this));
    controlsContainer.appendChild(resetBtn);

    // Add the controls to the header
    header.appendChild(controlsContainer);
    this.buttonsAdded = true;
  }

  createControlButton(id, text, action) {
    const button = document.createElement('div');
    button.className = 'view-mode';
    button.setAttribute('data-v-db178646', '');
    button.innerHTML = `
      <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
        ${this.getIconSvg(id)}
      </svg>
      <span style="margin-left: 3px;">${text}</span>
    `;

    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      cursor: pointer;
      color: #61666d;
      font-size: 11px;
      padding: 0 6px;
      height: 22px;
    `;

    button.addEventListener('mouseover', () => button.style.color = '#00a1d6');
    button.addEventListener('mouseout', () => button.style.color = '#61666d');
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    });

    return button;
  }

  getIconSvg(buttonId) {
    const icons = {
        reverseBtn: '<path fill="currentColor" d="M7 7h10v3l5-4-5-4v3H5v6h2V7zm10 10H7v-3l-5 4 5 4v-3h12v-6h-2v4z"/>',
        shuffleBtn: '<path fill="currentColor" d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>',
        resetBtn: '<path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>'
    };
    return icons[buttonId] || '';
  }

  saveOriginalOrder() {
    const items = this.getPlaylistItems();
    this.originalOrder = Array.from(items).map(item => {
      const clone = item.cloneNode(true);
      // Store all important attributes based on playlist type
      const type = this.getPlaylistType();
      
      if (type === 'pod') {
        ['data-key', 'data-scrolled', 'class', 'style'].forEach(attr => {
          if (item.hasAttribute(attr)) {
            clone.setAttribute(attr, item.getAttribute(attr));
          }
        });
      } else if (type === 'section') {
        ['data-key', 'class', 'style', 'data-active'].forEach(attr => {
          if (item.hasAttribute(attr)) {
            clone.setAttribute(attr, item.getAttribute(attr));
          }
        });
      } else {
        // For unknown types, copy all attributes
        Array.from(item.attributes).forEach(attr => {
          clone.setAttribute(attr.name, attr.value);
        });
      }
      
      return clone;
    });
  }

  getPlaylistType() {
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

  getPlaylist() {
    const type = this.getPlaylistType();
    if (type === 'pod') {
      return document.querySelector('.video-pod__list');
    } else if (type === 'section') {
      return document.querySelector('.video-section-list');
    } else {
      return document.querySelector('.video-pod [class*="list"]');
    }
  }

  getPlaylistItems() {
    const type = this.getPlaylistType();
    if (type === 'pod') {
      return document.querySelectorAll('.video-pod__list .video-pod__item');
    } else if (type === 'section') {
      return document.querySelectorAll('.video-section-list .video-section-list-item');
    } else {
      return document.querySelectorAll('.video-pod [class*="item"]');
    }
  }

  getActiveItem() {
    const type = this.getPlaylistType();
    if (type === 'pod') {
      return document.querySelector('.video-pod__item[data-scrolled="true"]');
    } else if (type === 'section') {
      return document.querySelector('.video-section-list-item.active') || 
             document.querySelector('.video-section-list-item[data-active="true"]');
    } else {
      // Try all possible active indicators
      return document.querySelector('.video-pod [class*="item"][data-scrolled="true"]') ||
             document.querySelector('.video-pod [class*="item"].active') ||
             document.querySelector('.video-pod [class*="item"][data-active="true"]') ||
             document.querySelector('.video-pod [class*="item"][aria-selected="true"]');
    }
  }

  setActiveItem(item) {
    const type = this.getPlaylistType();
    const items = Array.from(this.getPlaylistItems());
    
    if (type === 'pod') {
      items.forEach(i => i.setAttribute('data-scrolled', i === item ? 'true' : 'false'));
    } else if (type === 'section') {
      items.forEach(i => {
        i.classList.toggle('active', i === item);
        if (i.hasAttribute('data-active')) {
          i.setAttribute('data-active', i === item ? 'true' : 'false');
        }
      });
    } else {
      // Try all possible active indicators
      items.forEach(i => {
        if (i.hasAttribute('data-scrolled')) {
          i.setAttribute('data-scrolled', i === item ? 'true' : 'false');
        }
        i.classList.toggle('active', i === item);
        if (i.hasAttribute('data-active')) {
          i.setAttribute('data-active', i === item ? 'true' : 'false');
        }
        if (i.hasAttribute('aria-selected')) {
          i.setAttribute('aria-selected', i === item ? 'true' : 'false');
        }
      });
    }
  }

  setupClickHandlers(items) {
    const playlistType = this.getPlaylistType();
    
    items.forEach(item => {
      item.style.cursor = 'pointer';
      item.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const videoId = item.getAttribute('data-key');
        if (videoId) {
          // Only update URL for regular playlists, not for video selections
          if (playlistType === 'pod') {
            const newUrl = `https://www.bilibili.com/video/${videoId}`;
            history.replaceState(null, "", newUrl);
          }
          
          if (window.loadNewVideo) {
            await window.loadNewVideo(videoId);
            
            // Update active state
            this.setActiveItem(item);

            // Get the current playlist order
            const currentPlaylist = Array.from(this.getPlaylistItems());
            const currentIndex = currentPlaylist.indexOf(item);
            
            // Set up the next video based on current playlist order
            if (currentIndex !== -1 && currentIndex + 1 < currentPlaylist.length) {
              const nextVideo = currentPlaylist[currentIndex + 1];
              const nextVideoId = nextVideo.getAttribute('data-key');
              
              // Create event with or without URL based on playlist type
              const eventDetail = playlistType === 'pod' 
                ? {
                    nextVideoId: nextVideoId,
                    nextVideoUrl: `https://www.bilibili.com/video/${nextVideoId}`
                  }
                : {
                    nextVideoId: nextVideoId,
                    // Don't include nextVideoUrl for video selections
                  };
              
              document.dispatchEvent(new CustomEvent('updateNextVideo', {
                detail: eventDetail
              }));
            }
            
            // Scroll to the clicked item
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      };
    });
  }

  reversePlaylist() {
    const playlist = this.getPlaylist();
    if (!playlist) return;

    if (window.setPlaylistCustomizing) {
      window.setPlaylistCustomizing(true);
    }

    const items = Array.from(this.getPlaylistItems());
    items.forEach(item => {
      item.setAttribute('data-our-change', 'true');
      item.remove();
    });
    items.reverse().forEach(item => playlist.appendChild(item));

    // Setup click handlers for the reversed items
    this.setupClickHandlers(items);

    if (window.setPlaylistCustomizing) {
      window.setPlaylistCustomizing(false);
    }

    const activeItem = items.find(item => item.getAttribute('data-scrolled') === 'true');
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  shufflePlaylist() {
    const playlist = this.getPlaylist();
    if (!playlist) return;

    if (window.setPlaylistCustomizing) {
      window.setPlaylistCustomizing(true);
    }

    const items = Array.from(this.getPlaylistItems());
    const activeItem = items.find(item => item.getAttribute('data-scrolled') === 'true');
    
    items.forEach(item => {
      item.setAttribute('data-our-change', 'true');
      item.remove();
    });
    
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    if (activeItem) {
      const activeIndex = items.indexOf(activeItem);
      if (activeIndex > 0) {
        items.splice(activeIndex, 1);
        items.unshift(activeItem);
      }
    }
    
    items.forEach(item => playlist.appendChild(item));

    // Setup click handlers for the shuffled items
    this.setupClickHandlers(items);

    if (window.setPlaylistCustomizing) {
      window.setPlaylistCustomizing(false);
    }
    
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  resetPlaylist() {
    const playlist = this.getPlaylist();
    if (!playlist) return;

    if (window.setPlaylistCustomizing) {
        window.setPlaylistCustomizing(true);
    }

    // Store current active video ID
    const currentVideoId = this.getActiveItem()?.getAttribute('data-key');

    // Get current items and remove them
    const currentItems = Array.from(this.getPlaylistItems());
    currentItems.forEach(item => item.remove());

    // Create new items from original order while preserving event handlers
    const items = this.originalOrder.map((originalItem, index) => {
        // Find the corresponding current item with the same data-key
        const currentItem = currentItems.find(item => 
            item.getAttribute('data-key') === originalItem.getAttribute('data-key')
        ) || currentItems[index];

        if (currentItem) {
            // Update necessary attributes
            currentItem.setAttribute('data-our-change', 'true');
            
            // Set active state if this is the current video
            if (currentItem.getAttribute('data-key') === currentVideoId) {
                this.setActiveItem(currentItem);
            } else {
                this.setActiveItem(currentItem);
            }

            return currentItem;
        } else {
            // If no current item exists, create a new one
            const newItem = originalItem.cloneNode(true);
            newItem.setAttribute('data-our-change', 'true');
            this.setupClickHandlers([newItem]);
            return newItem;
        }
    });

    // Add items back to playlist
    items.forEach(item => playlist.appendChild(item));

    if (window.setPlaylistCustomizing) {
        window.setPlaylistCustomizing(false);
    }

    const activeItem = this.getActiveItem();
    if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// Initialize the playlist manager
const playlistManager = new BilibiliPlaylistManager();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    switch (request.action) {
      case 'reverse':
        playlistManager.reversePlaylist();
        break;
      case 'shuffle':
        playlistManager.shufflePlaylist();
        break;
      case 'reset':
        playlistManager.resetPlaylist();
        break;
    }
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error in content script:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true;
});

// Add error handling for video loading
window.loadNewVideo = async function(videoId) {
    try {
        const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${videoId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.code === 0 && data.data) {
            const cid = data.data.cid;
            const aid = data.data.aid;
            
            if (window.player) {
                await window.player.reload({
                    bvid: videoId,
                    cid: cid,
                    aid: aid
                });
                return true;
            }
        } else {
            throw new Error(`API error! code: ${data.code}`);
        }
    } catch (error) {
        console.error("Failed to load video:", error);
        // Show user-friendly error message
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

// Add cleanup on page unload
window.addEventListener('unload', () => {
    // Clear observers
    if (window.playlistObserver) window.playlistObserver.disconnect();
    if (window.headerObserver) window.headerObserver.disconnect();
    
    // Clear intervals
    if (window.setupInterval) clearInterval(window.setupInterval);
}); 