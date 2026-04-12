/**
 * AutoCurb Platform — App Switcher
 * Shared component across all products. Matches Clear Deal's implementation.
 *
 * Usage:
 *   <script src="/autocurb-switcher.js"
 *     data-current="autovideo"
 *     data-rooftop="uuid-here"
 *     data-api="https://autovideo.autocurb.io">
 *   </script>
 */
(function() {
  'use strict';

  // ── CONFIG ────────────────────────────────────────
  var script = document.currentScript;
  var currentApp = script?.getAttribute('data-current') || 'autovideo';
  var rooftopId = script?.getAttribute('data-rooftop') || '';
  var apiBase = script?.getAttribute('data-api') || '';

  if (!rooftopId) {
    try { rooftopId = localStorage.getItem('autocurb_rooftop_id') || ''; } catch(e) {}
  }

  // ── STYLES ────────────────────────────────────────
  var css = document.createElement('style');
  css.textContent = [
    '.ac-switcher-bar{',
    '  position:fixed;top:0;left:0;right:0;height:40px;z-index:9999;',
    '  background:rgba(10,10,13,.96);border-bottom:1px solid rgba(255,255,255,.06);',
    '  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
    '  display:flex;align-items:center;padding:0 14px;gap:10px;',
    '  font-family:"Geist",-apple-system,sans-serif;',
    '}',
    '.ac-sw-logo{display:flex;align-items:center;gap:6px;text-decoration:none}',
    '.ac-sw-mark{',
    '  width:22px;height:22px;border-radius:6px;background:#D94F00;',
    '  display:flex;align-items:center;justify-content:center;',
    '  box-shadow:0 2px 6px rgba(217,79,0,.3);',
    '}',
    '.ac-sw-wordmark{font-size:12px;font-weight:800;color:rgba(255,255,255,.9);letter-spacing:-.2px}',
    '.ac-sw-wordmark em{color:#E85A0A;font-style:normal}',
    '.ac-sw-sep{width:1px;height:18px;background:rgba(255,255,255,.08)}',
    '.ac-sw-current{',
    '  font-size:11px;font-weight:700;color:rgba(255,255,255,.55);',
    '  letter-spacing:.04em;text-transform:uppercase;',
    '}',
    '.ac-sw-spacer{flex:1}',
    '.ac-sw-counter{',
    '  font-size:10px;font-weight:600;color:rgba(255,255,255,.3);',
    '  font-family:"Geist Mono",monospace;',
    '}',
    '.ac-sw-grid-btn{',
    '  width:28px;height:28px;border-radius:6px;border:none;',
    '  background:transparent;cursor:pointer;display:flex;',
    '  align-items:center;justify-content:center;transition:background .12s;',
    '}',
    '.ac-sw-grid-btn:hover{background:rgba(255,255,255,.08)}',
    '.ac-sw-grid-btn svg{color:rgba(255,255,255,.5)}',
    '',
    '.ac-sw-dropdown{',
    '  position:fixed;top:44px;right:10px;z-index:10000;',
    '  background:#111116;border:1px solid rgba(255,255,255,.08);',
    '  border-radius:14px;padding:10px;min-width:290px;',
    '  box-shadow:0 16px 48px rgba(0,0,0,.6),0 4px 12px rgba(0,0,0,.4);',
    '  display:none;',
    '  font-family:"Geist",-apple-system,sans-serif;',
    '}',
    '.ac-sw-dropdown.open{display:block;animation:acSwFade .15s ease}',
    '@keyframes acSwFade{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}',
    '',
    '.ac-sw-dd-hdr{',
    '  display:flex;align-items:center;justify-content:space-between;',
    '  padding:4px 8px 10px;',
    '}',
    '.ac-sw-dd-label{',
    '  font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;',
    '  color:rgba(255,255,255,.3);',
    '}',
    '.ac-sw-dd-count{',
    '  font-size:9px;font-weight:700;color:rgba(255,255,255,.25);',
    '  font-family:"Geist Mono",monospace;',
    '}',
    '',
    '.ac-sw-app{',
    '  display:flex;align-items:center;gap:10px;',
    '  padding:8px 10px;border-radius:8px;',
    '  transition:background .12s;text-decoration:none;border:1px solid transparent;',
    '}',
    '.ac-sw-app:not(.locked){cursor:pointer}',
    '.ac-sw-app:not(.locked):hover{background:rgba(255,255,255,.06)}',
    '.ac-sw-app.active{background:rgba(217,79,0,.1);border-color:rgba(217,79,0,.2)}',
    '.ac-sw-app.locked{opacity:.45;pointer-events:none}',
    '',
    '.ac-sw-app-icon{',
    '  width:32px;height:32px;border-radius:8px;',
    '  background:rgba(255,255,255,.06);',
    '  display:flex;align-items:center;justify-content:center;',
    '  font-size:16px;flex-shrink:0;position:relative;',
    '}',
    '.ac-sw-app.active .ac-sw-app-icon{background:rgba(217,79,0,.15)}',
    '.ac-sw-lock{',
    '  position:absolute;bottom:-2px;right:-2px;',
    '  width:14px;height:14px;border-radius:50%;',
    '  background:#111116;border:1px solid rgba(255,255,255,.08);',
    '  display:flex;align-items:center;justify-content:center;',
    '  font-size:8px;line-height:1;',
    '}',
    '',
    '.ac-sw-app-info{flex:1;min-width:0}',
    '.ac-sw-app-name{font-size:13px;font-weight:600;color:rgba(255,255,255,.9)}',
    '.ac-sw-app.locked .ac-sw-app-name{color:rgba(255,255,255,.35)}',
    '.ac-sw-app-desc{font-size:10px;color:rgba(255,255,255,.35);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '',
    '.ac-sw-app-status{flex-shrink:0;font-size:8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:10px}',
    '.ac-sw-app-status.current{background:rgba(34,197,94,.1);color:#22c55e}',
    '.ac-sw-app-status.active-s{background:rgba(255,255,255,.04);color:rgba(255,255,255,.3)}',
    '',
    '.ac-sw-divider{height:1px;background:rgba(255,255,255,.05);margin:6px 0}',
    '',
    '.ac-sw-upgrade{',
    '  display:block;text-align:center;margin-top:6px;padding:10px;',
    '  border-radius:10px;border:1px solid rgba(217,79,0,.2);',
    '  background:rgba(217,79,0,.06);',
    '  font-size:12px;font-weight:700;color:#E85A0A;',
    '  text-decoration:none;transition:background .12s;',
    '}',
    '.ac-sw-upgrade:hover{background:rgba(217,79,0,.12)}',
    '',
    'body{padding-top:40px !important}',
  ].join('\n');
  document.head.appendChild(css);

  // ── BUILD BAR ─────────────────────────────────────
  var bar = document.createElement('div');
  bar.className = 'ac-switcher-bar';
  bar.innerHTML = [
    '<a class="ac-sw-logo" href="https://autocurb.io">',
    '  <div class="ac-sw-mark">',
    '    <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M1.5 10.5L7 2 12.5 10.5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    '  </div>',
    '  <div class="ac-sw-wordmark">Auto<em>Curb</em></div>',
    '</a>',
    '<div class="ac-sw-sep"></div>',
    '<div class="ac-sw-current" id="acSwCurrent">Loading...</div>',
    '<div class="ac-sw-spacer"></div>',
    '<div class="ac-sw-counter" id="acSwCounter"></div>',
    '<button class="ac-sw-grid-btn" id="acSwBtn" title="Switch apps">',
    '  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">',
    '    <rect x="1" y="1" width="4" height="4" rx="1" fill="currentColor"/>',
    '    <rect x="6" y="1" width="4" height="4" rx="1" fill="currentColor"/>',
    '    <rect x="11" y="1" width="4" height="4" rx="1" fill="currentColor"/>',
    '    <rect x="1" y="6" width="4" height="4" rx="1" fill="currentColor"/>',
    '    <rect x="6" y="6" width="4" height="4" rx="1" fill="currentColor"/>',
    '    <rect x="11" y="6" width="4" height="4" rx="1" fill="currentColor"/>',
    '    <rect x="1" y="11" width="4" height="4" rx="1" fill="currentColor"/>',
    '    <rect x="6" y="11" width="4" height="4" rx="1" fill="currentColor"/>',
    '    <rect x="11" y="11" width="4" height="4" rx="1" fill="currentColor"/>',
    '  </svg>',
    '</button>',
  ].join('');

  // ── BUILD DROPDOWN ────────────────────────────────
  var dd = document.createElement('div');
  dd.className = 'ac-sw-dropdown';
  dd.id = 'acSwDropdown';
  dd.innerHTML = [
    '<div class="ac-sw-dd-hdr">',
    '  <div class="ac-sw-dd-label">AutoCurb Platform</div>',
    '  <div class="ac-sw-dd-count" id="acSwDdCount"></div>',
    '</div>',
    '<div id="acSwApps">Loading...</div>',
  ].join('');

  document.body.prepend(dd);
  document.body.prepend(bar);

  // ── TOGGLE ────────────────────────────────────────
  document.getElementById('acSwBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    dd.classList.toggle('open');
  });
  document.addEventListener('click', function() { dd.classList.remove('open'); });
  dd.addEventListener('click', function(e) { e.stopPropagation(); });

  // ── FALLBACK DATA ─────────────────────────────────
  var fallbackApps = [
    { id:'autocurb',  name:'Autocurb.io', icon:'\uD83D\uDE97', url:'https://autocurb.io',              description:'Off-street vehicle acquisition',    has_access:false },
    { id:'cleardeal', name:'Clear Deal',   icon:'\uD83D\uDCCB', url:'https://cleardeal.autocurb.io',    description:'Window stickers + compliance',       has_access:false },
    { id:'autoframe', name:'AutoFrame',    icon:'\uD83D\uDCF7', url:'https://autoframe.autocurb.io',    description:'Vehicle photography automation',     has_access:false },
    { id:'autovideo', name:'AutoVideo',    icon:'\uD83C\uDFAC', url:'https://autovideo.autocurb.io',    description:'Video messaging + walkarounds + MPI', has_access:true  },
  ];

  // ── RENDER ────────────────────────────────────────
  function renderApps(apps) {
    var currentName = '';
    var activeCount = 0;
    var total = apps.length;
    var html = '';

    apps.forEach(function(app) {
      var isCurrent = app.id === currentApp;
      var hasAccess = app.has_access;
      if (isCurrent) currentName = app.name;
      if (hasAccess) activeCount++;

      var cls = 'ac-sw-app' + (isCurrent ? ' active' : '') + (!hasAccess ? ' locked' : '');

      // Lock icon for locked products
      var lockHtml = !hasAccess
        ? '<div class="ac-sw-lock">\uD83D\uDD12</div>'
        : '';

      // Status badge
      var statusHtml = '';
      if (isCurrent) {
        statusHtml = '<span class="ac-sw-app-status current">Current</span>';
      } else if (hasAccess) {
        statusHtml = '<span class="ac-sw-app-status active-s">Active</span>';
      }

      var href = hasAccess ? app.url : '#';
      var tag = hasAccess ? 'a' : 'div';

      html += '<' + tag + ' class="' + cls + '"' + (hasAccess ? ' href="' + href + '"' : '') + '>' +
        '<div class="ac-sw-app-icon">' + (app.icon || '\uD83D\uDCE6') + lockHtml + '</div>' +
        '<div class="ac-sw-app-info">' +
          '<div class="ac-sw-app-name">' + app.name + '</div>' +
          '<div class="ac-sw-app-desc">' + (app.description || '') + '</div>' +
        '</div>' +
        statusHtml +
      '</' + tag + '>';
    });

    // Divider + Upgrade Plan button
    html += '<div class="ac-sw-divider"></div>';
    html += '<a class="ac-sw-upgrade" href="https://autocurb.io/pricing">Upgrade Plan</a>';

    document.getElementById('acSwApps').innerHTML = html;
    document.getElementById('acSwCurrent').textContent = currentName || currentApp;

    // Counter: "X of 4 products active"
    var counterText = activeCount + ' of ' + total + ' products active';
    document.getElementById('acSwCounter').textContent = counterText;
    document.getElementById('acSwDdCount').textContent = counterText;
  }

  // ── FETCH & RENDER ────────────────────────────────
  if (apiBase) {
    var url = apiBase + '/api/platform/apps' + (rooftopId ? '?rooftop_id=' + rooftopId : '');
    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(data) { renderApps(data.apps || fallbackApps); })
      .catch(function() { renderApps(fallbackApps); });
  } else {
    renderApps(fallbackApps);
  }

})();
