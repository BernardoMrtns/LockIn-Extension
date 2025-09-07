const params = new URLSearchParams(location.search);
const site = params.get('site') || '';
const tabId = parseInt(params.get('tabId'), 10); // pode ser NaN se não vier

document.getElementById('siteText').innerText = site ? `Tentativa: ${site}` : '';

// Prevent back button navigation to bypass blocking
function preventBackNavigation() {
  // Replace current history state to prevent back navigation
  history.replaceState(null, '', location.href);

  // Listen for navigation attempts
  window.addEventListener('popstate', (event) => {
    // If someone tries to go back, redirect back to blocked page
    history.pushState(null, '', location.href);
  });

  // Prevent page from being cached or stored in history
  window.addEventListener('beforeunload', () => {
    // This helps prevent the page from being accessible via back button
  });

  // Additional protection: redirect if page becomes hidden then visible again
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Page became visible again, ensure we're still on the blocked page
      if (location.href.includes('blocked.html')) {
        // Still on blocked page, good
        return;
      }
    }
  });

  // Monitor for any navigation away from blocked page
  let currentUrl = location.href;
  const checkUrl = () => {
    if (location.href !== currentUrl && !location.href.includes('blocked.html')) {
      // User navigated away, redirect back to blocked page
      location.href = currentUrl;
    }
  };

  // Check URL periodically
  setInterval(checkUrl, 100);

  // Also check on focus
  window.addEventListener('focus', checkUrl);
}

// Initialize protection when page loads
preventBackNavigation();

document.getElementById('closeBtn').addEventListener('click', () => {
  // Tenta primeiro fechar via background (mais confiável)
  chrome.runtime.sendMessage({ action: 'closeThisTab', tabId }, (resp) => {
    // se por algum motivo não fechou, tenta window.close() como fallback visual
    if (!resp || resp.status !== 'closed') {
      try {
        window.close();
      } catch (e) {
        // Redireciona para uma página em branco como último recurso
        window.location.href = 'about:blank';
      }
    }
  });
});
