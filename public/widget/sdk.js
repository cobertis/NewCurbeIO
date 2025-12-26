(function(window, document) {
  'use strict';

  var STORAGE_KEY_PREFIX = 'curbe_widget_session_';
  var TOKEN_REFRESH_BUFFER = 24 * 60 * 60 * 1000; // 24 hours before expiry

  function getStorageKey(websiteToken) {
    return STORAGE_KEY_PREFIX + (websiteToken || 'default');
  }

  var CurbeWidgetSDK = {
    initialized: false,
    config: null,
    iframe: null,
    bubble: null,
    isOpen: false,
    token: null,
    sessionData: null,
    pendingActions: [],
    locale: 'en',
    
    run: function(options) {
      if (this.initialized) {
        console.warn('Curbe Widget SDK already initialized');
        return;
      }

      if (!options.websiteToken) {
        console.error('Curbe Widget SDK: websiteToken is required');
        return;
      }

      this.config = {
        websiteToken: options.websiteToken,
        baseUrl: (options.baseUrl || '').replace(/\/$/, ''),
        position: options.position || 'right',
        locale: options.locale || 'en',
        launcherTitle: options.launcherTitle || 'Chat with us',
        showPopoutButton: options.showPopoutButton !== false,
        hideMessageBubble: options.hideMessageBubble || false,
        darkMode: options.darkMode || 'light'
      };

      this.locale = this.config.locale;
      this.initSession();
    },

    initSession: function() {
      var self = this;
      var storedSession = this.getStoredSession();

      if (storedSession && storedSession.token && !this.isTokenExpired(storedSession)) {
        this.token = storedSession.token;
        this.sessionData = storedSession;
        this.scheduleTokenRefresh(storedSession);
        this.setupWidget();
        this.processQueue();
      } else if (storedSession && storedSession.token) {
        this.refreshToken(storedSession.token)
          .then(function(newToken) {
            self.token = newToken;
            self.sessionData.token = newToken;
            self.storeSession(self.sessionData);
            self.setupWidget();
            self.processQueue();
          })
          .catch(function() {
            self.createNewSession();
          });
      } else {
        this.createNewSession();
      }
    },

    createNewSession: function() {
      var self = this;
      var url = this.config.baseUrl + '/api/widget/session';
      
      this.request('POST', url, {
        websiteToken: this.config.websiteToken,
        deviceId: this.getDeviceId(),
        referrer: document.referrer,
        initialPageUrl: window.location.href
      })
      .then(function(response) {
        self.token = response.token;
        self.sessionData = {
          token: response.token,
          sourceId: response.sourceId,
          contactId: response.contactId,
          config: response.config,
          createdAt: Date.now()
        };
        self.storeSession(self.sessionData);
        self.scheduleTokenRefresh(self.sessionData);
        self.setupWidget();
        self.processQueue();
        self.postMessage({ event: 'curbe:session:created', data: { sourceId: response.sourceId } });
      })
      .catch(function(error) {
        console.error('Curbe Widget SDK: Failed to create session', error);
      });
    },

    refreshToken: function(oldToken) {
      var self = this;
      var url = this.config.baseUrl + '/api/widget/session/refresh';
      
      return this.request('POST', url, {}, {
        'Authorization': 'Bearer ' + oldToken
      })
      .then(function(response) {
        self.sessionData.token = response.token;
        self.sessionData.refreshedAt = Date.now();
        self.storeSession(self.sessionData);
        self.scheduleTokenRefresh(self.sessionData);
        self.postMessage({ event: 'curbe:session:refreshed' });
        return response.token;
      });
    },

    scheduleTokenRefresh: function(sessionData) {
      var self = this;
      var tokenData = this.parseToken(sessionData.token);
      if (!tokenData || !tokenData.exp) return;

      var expiresAt = tokenData.exp * 1000;
      var refreshAt = expiresAt - TOKEN_REFRESH_BUFFER;
      var delay = refreshAt - Date.now();

      if (delay > 0) {
        setTimeout(function() {
          self.refreshToken(sessionData.token).catch(function(error) {
            console.error('Curbe Widget SDK: Token refresh failed', error);
            self.postMessage({ event: 'curbe:session:expired' });
          });
        }, delay);
      }
    },

    isTokenExpired: function(sessionData) {
      var tokenData = this.parseToken(sessionData.token);
      if (!tokenData || !tokenData.exp) return true;
      return Date.now() >= tokenData.exp * 1000;
    },

    parseToken: function(token) {
      try {
        var parts = token.split('.');
        if (parts.length !== 3) return null;
        var payload = parts[1];
        var decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
      } catch (e) {
        return null;
      }
    },

    getStoredSession: function() {
      try {
        var key = getStorageKey(this.config ? this.config.websiteToken : null);
        var stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      } catch (e) {
        return null;
      }
    },

    storeSession: function(sessionData) {
      try {
        var key = getStorageKey(this.config ? this.config.websiteToken : null);
        localStorage.setItem(key, JSON.stringify(sessionData));
      } catch (e) {
        console.warn('Curbe Widget SDK: Failed to store session');
      }
    },

    clearSession: function() {
      try {
        var key = getStorageKey(this.config ? this.config.websiteToken : null);
        localStorage.removeItem(key);
      } catch (e) {}
      this.token = null;
      this.sessionData = null;
    },

    getDeviceId: function() {
      var key = 'curbe_device_id';
      var deviceId = localStorage.getItem(key);
      if (!deviceId) {
        deviceId = 'dev_' + this.generateId();
        localStorage.setItem(key, deviceId);
      }
      return deviceId;
    },

    generateId: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    setupWidget: function() {
      this.injectStyles();
      this.createBubble();
      this.createIframe();
      this.setupMessageListener();
      this.initialized = true;
    },

    injectStyles: function() {
      var styles = '\n' +
        '.curbe-widget-bubble {\n' +
        '  position: fixed;\n' +
        '  bottom: 20px;\n' +
        '  z-index: 2147483647;\n' +
        '  width: 60px;\n' +
        '  height: 60px;\n' +
        '  border-radius: 50%;\n' +
        '  background: #1D4ED8;\n' +
        '  cursor: pointer;\n' +
        '  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);\n' +
        '  display: flex;\n' +
        '  align-items: center;\n' +
        '  justify-content: center;\n' +
        '  transition: transform 0.2s ease, box-shadow 0.2s ease;\n' +
        '}\n' +
        '.curbe-widget-bubble:hover {\n' +
        '  transform: scale(1.05);\n' +
        '  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);\n' +
        '}\n' +
        '.curbe-widget-bubble.left { left: 20px; }\n' +
        '.curbe-widget-bubble.right { right: 20px; }\n' +
        '.curbe-widget-bubble svg {\n' +
        '  width: 28px;\n' +
        '  height: 28px;\n' +
        '  fill: white;\n' +
        '}\n' +
        '.curbe-widget-bubble.open svg.chat-icon { display: none; }\n' +
        '.curbe-widget-bubble.open svg.close-icon { display: block; }\n' +
        '.curbe-widget-bubble svg.close-icon { display: none; }\n' +
        '.curbe-widget-bubble .notification-badge {\n' +
        '  position: absolute;\n' +
        '  top: -4px;\n' +
        '  right: -4px;\n' +
        '  background: #EF4444;\n' +
        '  color: white;\n' +
        '  font-size: 12px;\n' +
        '  font-weight: bold;\n' +
        '  min-width: 20px;\n' +
        '  height: 20px;\n' +
        '  border-radius: 10px;\n' +
        '  display: none;\n' +
        '  align-items: center;\n' +
        '  justify-content: center;\n' +
        '  padding: 0 6px;\n' +
        '}\n' +
        '.curbe-widget-bubble .notification-badge.visible {\n' +
        '  display: flex;\n' +
        '}\n' +
        '.curbe-widget-container {\n' +
        '  position: fixed;\n' +
        '  bottom: 90px;\n' +
        '  z-index: 2147483646;\n' +
        '  width: 400px;\n' +
        '  height: 600px;\n' +
        '  max-height: calc(100vh - 110px);\n' +
        '  border-radius: 16px;\n' +
        '  overflow: hidden;\n' +
        '  box-shadow: 0 5px 40px rgba(0, 0, 0, 0.16);\n' +
        '  opacity: 0;\n' +
        '  visibility: hidden;\n' +
        '  transform: translateY(20px);\n' +
        '  transition: opacity 0.3s ease, visibility 0.3s ease, transform 0.3s ease;\n' +
        '}\n' +
        '.curbe-widget-container.left { left: 20px; }\n' +
        '.curbe-widget-container.right { right: 20px; }\n' +
        '.curbe-widget-container.open {\n' +
        '  opacity: 1;\n' +
        '  visibility: visible;\n' +
        '  transform: translateY(0);\n' +
        '}\n' +
        '.curbe-widget-container iframe {\n' +
        '  width: 100%;\n' +
        '  height: 100%;\n' +
        '  border: none;\n' +
        '  background: white;\n' +
        '}\n' +
        '@media (max-width: 480px) {\n' +
        '  .curbe-widget-container {\n' +
        '    width: 100%;\n' +
        '    height: 100%;\n' +
        '    max-height: 100%;\n' +
        '    bottom: 0;\n' +
        '    left: 0 !important;\n' +
        '    right: 0 !important;\n' +
        '    border-radius: 0;\n' +
        '  }\n' +
        '  .curbe-widget-bubble.open {\n' +
        '    display: none;\n' +
        '  }\n' +
        '}\n';

      var styleEl = document.createElement('style');
      styleEl.id = 'curbe-widget-styles';
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);
    },

    createBubble: function() {
      if (this.config.hideMessageBubble) return;

      var bubble = document.createElement('div');
      bubble.className = 'curbe-widget-bubble ' + this.config.position;
      bubble.setAttribute('data-testid', 'curbe-widget-bubble');
      bubble.setAttribute('aria-label', this.config.launcherTitle);
      bubble.setAttribute('role', 'button');
      bubble.setAttribute('tabindex', '0');

      bubble.innerHTML = '\n' +
        '<svg class="chat-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">\n' +
        '  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>\n' +
        '  <circle cx="8" cy="10" r="1.5"/>\n' +
        '  <circle cx="12" cy="10" r="1.5"/>\n' +
        '  <circle cx="16" cy="10" r="1.5"/>\n' +
        '</svg>\n' +
        '<svg class="close-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">\n' +
        '  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>\n' +
        '</svg>\n' +
        '<span class="notification-badge" data-testid="curbe-notification-badge"></span>';

      var self = this;
      bubble.addEventListener('click', function() { self.toggle(); });
      bubble.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          self.toggle();
        }
      });

      document.body.appendChild(bubble);
      this.bubble = bubble;
    },

    createIframe: function() {
      var container = document.createElement('div');
      container.className = 'curbe-widget-container ' + this.config.position;
      container.setAttribute('data-testid', 'curbe-widget-container');

      var iframe = document.createElement('iframe');
      iframe.setAttribute('data-testid', 'curbe-widget-iframe');
      iframe.setAttribute('allow', 'microphone; camera');
      iframe.setAttribute('title', 'Curbe Chat Widget');
      
      var frameUrl = this.config.baseUrl + '/widget/frame';
      frameUrl += '?token=' + encodeURIComponent(this.token);
      frameUrl += '&websiteToken=' + encodeURIComponent(this.config.websiteToken);
      frameUrl += '&locale=' + encodeURIComponent(this.locale);
      if (this.config.darkMode === 'dark') {
        frameUrl += '&darkMode=1';
      }
      
      iframe.src = frameUrl;

      container.appendChild(iframe);
      document.body.appendChild(container);
      this.iframe = iframe;
      this.container = container;
    },

    setupMessageListener: function() {
      var self = this;
      window.addEventListener('message', function(event) {
        if (!self.config || !self.iframe) return;
        
        var expectedOrigin = self.config.baseUrl || window.location.origin;
        if (event.origin !== expectedOrigin && event.origin !== window.location.origin) return;
        
        var data = event.data;
        if (!data || !data.event) return;

        switch (data.event) {
          case 'curbe:ready':
            self.onFrameReady();
            break;
          case 'curbe:close':
            self.close();
            break;
          case 'curbe:toggle':
            self.toggle();
            break;
          case 'curbe:open':
            self.open();
            break;
          case 'curbe:unreadCount':
            self.updateUnreadCount(data.count || 0);
            break;
          case 'curbe:message:received':
            self.onNewMessage(data.message);
            break;
          case 'curbe:session:authenticated':
            self.onAuthenticated(data.contact);
            break;
          case 'curbe:session:expired':
            self.onSessionExpired();
            break;
          case 'curbe:resize':
            if (data.height && self.container) {
              self.container.style.height = data.height + 'px';
            }
            break;
        }
      });
    },

    postMessage: function(data) {
      if (this.iframe && this.iframe.contentWindow) {
        var origin = this.config.baseUrl || window.location.origin;
        this.iframe.contentWindow.postMessage(data, origin);
      }
    },

    onFrameReady: function() {
      this.postMessage({
        event: 'curbe:config',
        config: this.config,
        token: this.token,
        sessionData: this.sessionData
      });
      this.processQueue();
    },

    processQueue: function() {
      var self = this;
      this.pendingActions.forEach(function(action) {
        self[action.method].apply(self, action.args);
      });
      this.pendingActions = [];
    },

    queueAction: function(method, args) {
      if (this.initialized) {
        this[method].apply(this, args);
      } else {
        this.pendingActions.push({ method: method, args: args });
      }
    },

    toggle: function() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    },

    open: function() {
      if (!this.container) return;
      this.isOpen = true;
      this.container.classList.add('open');
      if (this.bubble) {
        this.bubble.classList.add('open');
      }
      this.postMessage({ event: 'curbe:widget:opened' });
      this.updateUnreadCount(0);
    },

    close: function() {
      if (!this.container) return;
      this.isOpen = false;
      this.container.classList.remove('open');
      if (this.bubble) {
        this.bubble.classList.remove('open');
      }
      this.postMessage({ event: 'curbe:widget:closed' });
    },

    setLocale: function(locale) {
      this.locale = locale;
      this.postMessage({ event: 'curbe:locale', locale: locale });
    },

    setUser: function(userInfo) {
      var self = this;
      if (!this.token) {
        this.queueAction('setUser', [userInfo]);
        return;
      }

      var url = this.config.baseUrl + '/api/widget/contacts/identify';
      
      this.request('POST', url, {
        identifier: userInfo.identifier,
        email: userInfo.email,
        name: userInfo.name,
        phoneNumber: userInfo.phone_number || userInfo.phoneNumber,
        avatarUrl: userInfo.avatar_url || userInfo.avatarUrl,
        customAttributes: userInfo.custom_attributes || userInfo.customAttributes,
        hmacSignature: userInfo.identifier_hash || userInfo.hmacSignature
      }, {
        'Authorization': 'Bearer ' + this.token
      })
      .then(function(response) {
        self.postMessage({ event: 'curbe:user:identified', contact: response.contact });
      })
      .catch(function(error) {
        console.error('Curbe Widget SDK: Failed to identify user', error);
      });
    },

    setCustomAttributes: function(attributes) {
      var self = this;
      if (!this.token) {
        this.queueAction('setCustomAttributes', [attributes]);
        return;
      }

      var url = this.config.baseUrl + '/api/widget/contacts/me';
      
      this.request('PATCH', url, {
        customAttributes: attributes
      }, {
        'Authorization': 'Bearer ' + this.token
      })
      .then(function(response) {
        self.postMessage({ event: 'curbe:attributes:updated', contact: response.contact });
      })
      .catch(function(error) {
        console.error('Curbe Widget SDK: Failed to set custom attributes', error);
      });
    },

    setLabel: function(label) {
      this.setCustomAttributes({ label: label });
    },

    removeLabel: function(label) {
      this.setCustomAttributes({ label: null });
    },

    setConversationCustomAttributes: function(attributes) {
      this.postMessage({ event: 'curbe:conversation:attributes', attributes: attributes });
    },

    deleteConversationCustomAttribute: function(key) {
      this.postMessage({ event: 'curbe:conversation:deleteAttribute', key: key });
    },

    updateUnreadCount: function(count) {
      if (!this.bubble) return;
      var badge = this.bubble.querySelector('.notification-badge');
      if (badge) {
        if (count > 0 && !this.isOpen) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.classList.add('visible');
        } else {
          badge.classList.remove('visible');
        }
      }
    },

    onNewMessage: function(message) {
      if (!this.isOpen && message) {
        this.updateUnreadCount((parseInt(this.getUnreadCount()) || 0) + 1);
      }
      window.dispatchEvent(new CustomEvent('curbe:message', { detail: message }));
    },

    getUnreadCount: function() {
      var badge = this.bubble ? this.bubble.querySelector('.notification-badge') : null;
      return badge ? parseInt(badge.textContent) || 0 : 0;
    },

    onAuthenticated: function(contact) {
      window.dispatchEvent(new CustomEvent('curbe:authenticated', { detail: contact }));
    },

    onSessionExpired: function() {
      this.clearSession();
      this.createNewSession();
      window.dispatchEvent(new CustomEvent('curbe:session:expired'));
    },

    reset: function() {
      this.clearSession();
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
      if (this.bubble) {
        this.bubble.remove();
        this.bubble = null;
      }
      var styles = document.getElementById('curbe-widget-styles');
      if (styles) styles.remove();
      this.initialized = false;
      this.isOpen = false;
      this.iframe = null;
    },

    shutdown: function() {
      this.reset();
    },

    request: function(method, url, body, headers) {
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        if (headers) {
          Object.keys(headers).forEach(function(key) {
            xhr.setRequestHeader(key, headers[key]);
          });
        }

        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                resolve(xhr.responseText);
              }
            } else {
              var error = new Error('Request failed');
              error.status = xhr.status;
              try {
                error.response = JSON.parse(xhr.responseText);
              } catch (e) {
                error.response = xhr.responseText;
              }
              reject(error);
            }
          }
        };

        xhr.onerror = function() {
          reject(new Error('Network error'));
        };

        xhr.send(body ? JSON.stringify(body) : null);
      });
    }
  };

  var $curbe = {
    toggle: function() { CurbeWidgetSDK.toggle(); },
    open: function() { CurbeWidgetSDK.open(); },
    close: function() { CurbeWidgetSDK.close(); },
    setLocale: function(locale) { CurbeWidgetSDK.setLocale(locale); },
    setUser: function(userInfo) { CurbeWidgetSDK.setUser(userInfo); },
    setCustomAttributes: function(attrs) { CurbeWidgetSDK.setCustomAttributes(attrs); },
    setLabel: function(label) { CurbeWidgetSDK.setLabel(label); },
    removeLabel: function(label) { CurbeWidgetSDK.removeLabel(label); },
    setConversationCustomAttributes: function(attrs) { CurbeWidgetSDK.setConversationCustomAttributes(attrs); },
    deleteConversationCustomAttribute: function(key) { CurbeWidgetSDK.deleteConversationCustomAttribute(key); },
    reset: function() { CurbeWidgetSDK.reset(); },
    shutdown: function() { CurbeWidgetSDK.shutdown(); },
    isOpen: function() { return CurbeWidgetSDK.isOpen; },
    getToken: function() { return CurbeWidgetSDK.token; },
    getSessionData: function() { return CurbeWidgetSDK.sessionData; }
  };

  function generateEmbedCode(websiteToken, baseUrl) {
    baseUrl = (baseUrl || '').replace(/\/$/, '');
    return '<script>\n' +
      '  (function(d,t) {\n' +
      '    var BASE_URL="' + baseUrl + '";\n' +
      '    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];\n' +
      '    g.src=BASE_URL+"/widget/sdk.js";\n' +
      '    g.defer=true;\n' +
      '    g.async=true;\n' +
      '    s.parentNode.insertBefore(g,s);\n' +
      '    g.onload=function(){\n' +
      '      window.curbeWidgetSDK.run({\n' +
      '        websiteToken: "' + websiteToken + '",\n' +
      '        baseUrl: BASE_URL\n' +
      '      });\n' +
      '    }\n' +
      '  })(document,"script");\n' +
      '</script>';
  }

  window.curbeWidgetSDK = CurbeWidgetSDK;
  window.$curbe = $curbe;
  window.generateCurbeEmbedCode = generateEmbedCode;

})(window, document);
