/*!
 * tabbar-react.js — React 18 + Tailwind tab bar
 *
 * Exact structural mirror of AppLayout.tsx:
 *   nav:    md:hidden fixed bottom-0 left-0 right-0 flex flex-col z-50
 *   row:    flex h-16   (64 px — equivalent to h-16 / 4rem)
 *   btn:    flex-1 flex flex-col items-center justify-center gap-1
 *   label:  text-[10px] font-medium
 *   safe-area: full env(safe-area-inset-bottom) — uncapped
 *   content:   calc(4rem + env(safe-area-inset-bottom)) — AppLayout.tsx:206
 *
 * Requires: React 18, ReactDOM 18, Tailwind CSS (all loaded before this script)
 * Exposes:  window.TabBar  (identical API to tabbar.js vanilla version)
 *
 * Usage:
 *   const bar = new TabBar(tabs, options);
 *   bar.setActive('home');
 *   bar.setColors({ bgColor, borderColor, accentColor, inactiveColor });
 *   bar.destroy();
 */
(function (global) {
  'use strict';

  var h = global.React.createElement;

  // SVGs set via dangerouslySetInnerHTML need explicit dimensions via CSS
  function injectSvgStyle() {
    if (document.getElementById('tbr-svg-css')) return;
    var s = document.createElement('style');
    s.id = 'tbr-svg-css';
    s.textContent = '#tabbar-modern svg{width:20px;height:20px;stroke-width:1.8;fill:none;stroke:currentColor;display:block;}';
    document.head.appendChild(s);
  }

  // Stateless — activeId is owned by the TabBar instance and passed as a prop
  // Stateless — activeId is owned by the TabBar instance and passed as a prop
  function TabBarComponent(props) {
    var tabs       = props.tabs;
    var activeId   = props.activeId;
    var o          = props.opts;
    var onTabChange = props.onTabChange;

    return h('nav',
      {
        // AppLayout.tsx:209
        className: 'md:hidden fixed bottom-0 left-0 right-0 flex flex-col z-50',
        style: {
          background:  o.bgColor,
          borderTop:   '1px solid ' + o.borderColor,
        },
      },

      // Reduced inner row height from h-16 (64px) to h-11 (44px)
      h('div', { className: 'flex h-[-24px] items-center' },
        tabs.map(function (tab) {
          return h('button', {
            key:       tab.id,
            className: 'flex-1 flex flex-col items-center justify-center gap-0.5',
            style: {
              color:                    tab.id === activeId ? o.accentColor : o.inactiveColor,
              background:               'none',
              border:                   'none',
              cursor:                   'pointer',
              transition:               'color 0.2s',
              WebkitTapHighlightColor:  'transparent',
              fontFamily:               'inherit',
            },
            onClick: function () { onTabChange(tab.id); },
          },
            h('div', { dangerouslySetInnerHTML: { __html: tab.svg } }),
            h('span', { className: 'text-[10px] font-medium leading-none', style: { letterSpacing: 0 } }, tab.label)
          );
        })
      ),

      // Safe-area spacer
      h('div', {
        style: { height: 'env(safe-area-inset-bottom, 0px)', background: o.bgColor },
      })
    );
  }

  /**
   * @param {Array<{id:string, label:string, svg:string}>} tabs
   * @param {{
   *   accentColor?:   string   — active colour    (default '#818cf8' = text-indigo-400)
   *   bgColor?:       string   — background        (default '#0D1424' = bg-[#0D1424])
   *   borderColor?:   string   — top border        (default rgba(255,255,255,0.06) = border-white/[0.06])
   *   inactiveColor?: string   — inactive colour   (default '#64748b' = text-slate-500)
   *   contentEl?:     Element  — gets paddingBottom adjusted automatically
   *   onTabChange?:   function(id:string):void
   * }} [opts]
   */
  function TabBar(tabs, opts) {
    this._o = Object.assign({
      accentColor:   '#818cf8',
      bgColor:       '#0D1424',
      borderColor:   'rgba(255,255,255,0.06)',
      inactiveColor: '#64748b',
      contentEl:     null,
      onTabChange:   null,
    }, opts || {});
    this._tabs      = tabs;
    this._activeId  = tabs[0] ? tabs[0].id : null;
    this._root      = null;
    this._container = null;
    this._mount();
  }

  TabBar.prototype._mount = function () {
    var prev = document.getElementById('tabbar-modern');
    if (prev) prev.remove();
    injectSvgStyle();

    var container = document.createElement('div');
    container.id  = 'tabbar-modern';
    document.body.appendChild(container);
    this._container = container;

    this._root = global.ReactDOM.createRoot(container);
    this._render();

    // Adjusted from 4rem (64px) down to 2.75rem (44px)
    if (this._o.contentEl) {
      this._o.contentEl.style.paddingBottom = 'calc(2.75rem + env(safe-area-inset-bottom, 0px))';
    }
  };

  TabBar.prototype._render = function () {
    var self = this;
    this._root.render(
      h(TabBarComponent, {
        tabs:        self._tabs,
        activeId:    self._activeId,
        opts:        self._o,
        // Let the external onTabChange (switchTab) drive state via setActive()
        onTabChange: function (id) {
          if (typeof self._o.onTabChange === 'function') {
            self._o.onTabChange(id);
          } else {
            self.setActive(id);
          }
        },
      })
    );
  };

  /** Highlight the tab matching id and re-render. */
  TabBar.prototype.setActive = function (id) {
    this._activeId = id;
    this._render();
  };

  /** Hot-swap colours without re-mounting (e.g. light/dark toggle). */
  TabBar.prototype.setColors = function (opts) {
    Object.assign(this._o, opts || {});
    this._render();
  };

  /** Unmount and remove the bar from the DOM. */
  TabBar.prototype.destroy = function () {
    if (this._root) { this._root.unmount(); this._root = null; }
    if (this._container) { this._container.remove(); this._container = null; }
    var s = document.getElementById('tbr-svg-css');
    if (s) s.remove();
  };

  global.TabBar = TabBar;
}(window));
