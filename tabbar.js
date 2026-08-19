/*!
 * TabBar — reusable mobile-first bottom nav (mirrors AppLayout.tsx pattern)
 *
 * Matches the React/Tailwind approach:
 *   • fixed bottom:0 (no -5px hack)
 *   • full env(safe-area-inset-bottom) — uncapped
 *   • 64px bar height (h-16 equivalent)
 *   • hidden above 768px breakpoint (md:hidden equivalent)
 *   • tabs divide width equally (no horizontal scroll)
 *
 * Usage:
 *   const bar = new TabBar(tabs, options);
 *   bar.setActive('home');
 *   bar.setColors({ bgColor: '#fff', borderColor: '#e2e8f0', accentColor: '#0ea86d', inactiveColor: '#64748b' });
 *   bar.destroy();
 *
 * tabs: Array of { id: string, label: string, svg: string (raw SVG element HTML) }
 *
 * options: {
 *   accentColor?:   string  — active tab colour        (default '#00d17a')
 *   bgColor?:       string  — bar background           (default '#161b22')
 *   borderColor?:   string  — top border colour        (default '#21262d')
 *   inactiveColor?: string  — inactive tab colour      (default '#484f58')
 *   height?:        number  — bar height in px         (default 64)
 *   contentEl?:     Element — scrollable content elem; its paddingBottom is adjusted automatically
 *   onTabChange?:   function(id, btnEl) — called when a tab is tapped
 * }
 */
(function (global) {
  'use strict';

  var CSS_ID = 'tabbar-modern-css';

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent =
      '#tabbar-modern{' +
        'position:fixed;bottom:0;left:0;right:0;' +
        'display:flex;flex-direction:column;z-index:100;' +
      '}' +
      '@media(min-width:768px){#tabbar-modern{display:none;}}' +
      '#tabbar-modern-row{display:flex;align-items:stretch;}' +
      '#tabbar-modern-safe{height:env(safe-area-inset-bottom,0px);}' +
      '.tbm-btn{' +
        'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;' +
        'background:none;border:none;cursor:pointer;' +
        'font-size:10px;font-weight:500;letter-spacing:0;' +
        'font-family:inherit;transition:color 0.2s;padding:0;' +
        '-webkit-tap-highlight-color:transparent;' +
      '}' +
      '.tbm-btn svg{width:20px;height:20px;stroke-width:1.8;fill:none;stroke:currentColor;display:block;}';
    document.head.appendChild(s);
  }

  function TabBar(tabs, opts) {
    this._o = Object.assign({
      accentColor: '#00d17a',
      bgColor: '#161b22',
      borderColor: '#21262d',
      inactiveColor: '#484f58',
      height: 64,
      contentEl: null,
      onTabChange: null,
    }, opts || {});
    this._tabs = tabs;
    this._el = null;
    this._mount();
  }

  TabBar.prototype._mount = function () {
    var prev = document.getElementById('tabbar-modern');
    if (prev) prev.remove();

    injectCSS();

    var o = this._o;
    var wrap = document.createElement('div');
    wrap.id = 'tabbar-modern';
    wrap.style.background = o.bgColor;
    wrap.style.borderTop = '1px solid ' + o.borderColor;

    var row = document.createElement('div');
    row.id = 'tabbar-modern-row';
    row.style.height = o.height + 'px';

    var self = this;
    this._tabs.forEach(function (tab) {
      var btn = document.createElement('button');
      btn.className = 'tbm-btn';
      btn.setAttribute('data-tab', tab.id);
      btn.style.color = o.inactiveColor;
      btn.innerHTML = tab.svg + '<span>' + tab.label + '</span>';
      btn.addEventListener('click', function () { self._click(tab.id, btn); });
      row.appendChild(btn);
    });

    var safe = document.createElement('div');
    safe.id = 'tabbar-modern-safe';
    safe.style.background = o.bgColor;

    wrap.appendChild(row);
    wrap.appendChild(safe);
    document.body.appendChild(wrap);
    this._el = wrap;

    if (o.contentEl) {
      o.contentEl.style.paddingBottom = 'calc(' + o.height + 'px + env(safe-area-inset-bottom,0px))';
    }
  };

  TabBar.prototype._click = function (id, btn) {
    this.setActive(id);
    if (typeof this._o.onTabChange === 'function') {
      this._o.onTabChange(id, btn);
    }
  };

  /** Highlight the tab matching id, dim all others. */
  TabBar.prototype.setActive = function (id) {
    if (!this._el) return;
    var accent = this._o.accentColor;
    var inactive = this._o.inactiveColor;
    this._el.querySelectorAll('.tbm-btn').forEach(function (b) {
      b.style.color = b.getAttribute('data-tab') === id ? accent : inactive;
    });
  };

  /** Swap colours without re-mounting (e.g. light/dark theme toggle). */
  TabBar.prototype.setColors = function (opts) {
    Object.assign(this._o, opts || {});
    if (!this._el) return;
    var o = this._o;
    this._el.style.background = o.bgColor;
    this._el.style.borderTopColor = o.borderColor;
    var safe = document.getElementById('tabbar-modern-safe');
    if (safe) safe.style.background = o.bgColor;
    // re-apply active/inactive colours from current state
    this._el.querySelectorAll('.tbm-btn').forEach(function (b) {
      var isActive = b.style.color === o.accentColor ||
                     getComputedStyle(b).color === o.accentColor;
      b.style.color = isActive ? o.accentColor : o.inactiveColor;
    });
  };

  /** Remove the bar and its injected stylesheet from the DOM. */
  TabBar.prototype.destroy = function () {
    if (this._el) { this._el.remove(); this._el = null; }
    var styleEl = document.getElementById(CSS_ID);
    if (styleEl) styleEl.remove();
  };

  global.TabBar = TabBar;
}(window));
