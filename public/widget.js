(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf("/widget.js") !== -1) {
        script = scripts[i];
        break;
      }
    }
  }
  if (!script) {
    console.error("[CurbeWidget] script tag not found");
    return;
  }

  var widgetId = script.getAttribute("data-widget");
  if (!widgetId) {
    console.error("[CurbeWidget] missing data-widget");
    return;
  }

  window.__curbeWidgetInit = window.__curbeWidgetInit || {};
  if (window.__curbeWidgetInit[widgetId]) return;
  window.__curbeWidgetInit[widgetId] = true;

  var API_BASE = script.src.replace(/\/widget\.js.*$/, "");

  var config = {
    shouldDisplay: true,
    settings: {
      position: "br",
      launcherSize: 56,
      panelWidth: 380,
      panelHeight: 560
    }
  };

  var wrapper = document.createElement("div");
  wrapper.id = "curbe-widget-wrapper-" + widgetId;
  wrapper.style.cssText =
    "position:fixed; z-index:2147483647; background:transparent; " +
    "right:24px; bottom:24px; width:56px; height:56px; " +
    "border-radius:9999px; overflow:hidden; box-shadow:none; " +
    "transition: all 0.3s ease;";

  var iframe = document.createElement("iframe");
  iframe.id = "curbe-widget-iframe-" + widgetId;
  iframe.src = API_BASE + "/widget-frame/" + encodeURIComponent(widgetId) + "?origin=" + encodeURIComponent(window.location.origin);
  iframe.style.cssText = "width:100%; height:100%; border:0; background:transparent;";
  iframe.allow = "microphone; camera; geolocation";
  iframe.setAttribute("title", "Curbe Chat Widget");
  iframe.setAttribute("allowtransparency", "true");

  wrapper.appendChild(iframe);
  document.body.appendChild(wrapper);

  function applyClosedState() {
    var s = config.settings;
    wrapper.style.width = s.launcherSize + "px";
    wrapper.style.height = s.launcherSize + "px";
    wrapper.style.borderRadius = "9999px";
    wrapper.style.boxShadow = "none";
    wrapper.style.right = "24px";
    wrapper.style.bottom = "24px";
  }

  function applyOpenState() {
    var s = config.settings;
    var isMobile = window.innerWidth < 480;

    if (isMobile) {
      wrapper.style.width = "100vw";
      wrapper.style.height = "100vh";
      wrapper.style.right = "0";
      wrapper.style.bottom = "0";
      wrapper.style.borderRadius = "0px";
    } else {
      wrapper.style.width = s.panelWidth + "px";
      wrapper.style.height = s.panelHeight + "px";
      wrapper.style.right = "24px";
      wrapper.style.bottom = "24px";
      wrapper.style.borderRadius = "16px";
      wrapper.style.boxShadow = "0 18px 60px rgba(0,0,0,0.25)";
    }
  }

  window.addEventListener("message", function (event) {
    var d = event.data;
    if (!d || d.widgetId !== widgetId) return;

    if (d.type === "curbe-widget-open") applyOpenState();
    if (d.type === "curbe-widget-close") applyClosedState();
    if (d.type === "curbe-widget-ready") console.log("[CurbeWidget] ready", widgetId);
  });

  fetch(API_BASE + "/api/public/widgets/" + encodeURIComponent(widgetId) + "/config", {
    method: "GET",
    credentials: "omit"
  })
    .then(function (r) { return r.ok ? r.json() : Promise.reject({ status: r.status }); })
    .then(function (json) {
      config = json || config;
      if (!config.shouldDisplay) {
        wrapper.remove();
        return;
      }
      applyClosedState();
      console.log("[CurbeWidget] loaded", widgetId);
    })
    .catch(function (err) {
      console.error("[CurbeWidget] config fetch failed", err);
      applyClosedState();
    });

  applyClosedState();

  window.CurbeWidget = window.CurbeWidget || {};
  window.CurbeWidget[widgetId] = {
    open: function() { iframe.contentWindow.postMessage({ type: 'curbe-widget-open-command' }, '*'); },
    close: function() { iframe.contentWindow.postMessage({ type: 'curbe-widget-close-command' }, '*'); },
    toggle: function() { iframe.contentWindow.postMessage({ type: 'curbe-widget-toggle' }, '*'); }
  };
})();
