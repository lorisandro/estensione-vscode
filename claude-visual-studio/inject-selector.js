const puppeteer = require('puppeteer-core');

const SELECTOR_SCRIPT = `
(function() {
  if (window.__claudeSelectorActive) { console.log('Already active'); return; }
  window.__claudeSelectorActive = true;
  window.__claudeSelectedElement = null;
  window.__claudeDraggedElement = null;
  window.__claudeChanges = [];

  const toolbar = document.createElement('div');
  toolbar.id = '__claude-selector-toolbar';
  toolbar.innerHTML = '<button id="__claude-minimize-btn" title="Minimize">◀</button><button id="__claude-selector-btn" title="Select">🎯</button><button id="__claude-style-btn" title="Style element" style="display:none;">🎨</button><button id="__claude-drag-btn" title="Drag">🖐️</button><button id="__claude-copy-btn" title="Copy changes" style="display:none;">📋</button><span id="__claude-selector-status"></span><span id="__claude-changes-count" style="display:none;background:#ff9500;color:#000;padding:2px 6px;border-radius:10px;font-size:11px;font-weight:bold;"></span>';
  toolbar.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;background:#1a1a2e;border:2px solid #00d4ff;border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:8px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;color:#fff;box-shadow:0 4px 20px rgba(0,212,255,0.3);cursor:move;';

  const minimizeBtn = toolbar.querySelector('#__claude-minimize-btn');
  const selectBtn = toolbar.querySelector('#__claude-selector-btn');
  const styleBtn = toolbar.querySelector('#__claude-style-btn');
  const dragBtn = toolbar.querySelector('#__claude-drag-btn');
  const copyBtn = toolbar.querySelector('#__claude-copy-btn');
  const status = toolbar.querySelector('#__claude-selector-status');
  const changesCount = toolbar.querySelector('#__claude-changes-count');

  minimizeBtn.style.cssText = 'background:none;border:none;font-size:14px;cursor:pointer;padding:4px;color:#888;transition:all 0.2s;';
  minimizeBtn.onmouseenter = () => minimizeBtn.style.color = '#fff';
  minimizeBtn.onmouseleave = () => minimizeBtn.style.color = '#888';

  [selectBtn, styleBtn, dragBtn, copyBtn].forEach(btn => {
    btn.style.cssText = 'background:none;border:2px solid transparent;font-size:24px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:all 0.2s;';
  });

  function updateChangesCount() {
    const count = window.__claudeChanges.length;
    if (count > 0) {
      changesCount.textContent = count;
      changesCount.style.display = '';
      copyBtn.style.display = '';
    } else {
      changesCount.style.display = 'none';
      copyBtn.style.display = 'none';
    }
  }

  document.body.appendChild(toolbar);

  // CSS Editor Panel (Elementor-style)
  const cssPanel = document.createElement('div');
  cssPanel.id = '__claude-css-panel';
  cssPanel.innerHTML = '<div class="panel-header"><span>🎨 Style Editor</span><button id="__claude-panel-close">✕</button></div><div class="panel-content"><div class="control-group"><label>Font Size</label><div class="control-row"><input type="range" id="__css-font-size" min="8" max="72" value="16"><input type="number" id="__css-font-size-val" value="16" min="8" max="200"><span>px</span></div></div><div class="control-group"><label>Line Height</label><div class="control-row"><input type="range" id="__css-line-height" min="0.5" max="3" step="0.1" value="1.5"><input type="number" id="__css-line-height-val" value="1.5" min="0.5" max="5" step="0.1"></div></div><div class="control-group"><label>Font Weight</label><select id="__css-font-weight"><option value="300">Light (300)</option><option value="400" selected>Normal (400)</option><option value="500">Medium (500)</option><option value="600">Semi Bold (600)</option><option value="700">Bold (700)</option><option value="800">Extra Bold (800)</option></select></div><div class="control-group"><label>Text Color</label><div class="control-row"><input type="color" id="__css-color" value="#ffffff"><input type="text" id="__css-color-val" value="#ffffff" maxlength="7"></div></div><div class="control-group"><label>Background</label><div class="control-row"><input type="color" id="__css-bg-color" value="#000000"><input type="text" id="__css-bg-color-val" value="#000000" maxlength="7"></div></div><div class="control-group"><label>Padding (px)</label><div class="control-row four"><input type="number" id="__css-padding-top" placeholder="T" min="0"><input type="number" id="__css-padding-right" placeholder="R" min="0"><input type="number" id="__css-padding-bottom" placeholder="B" min="0"><input type="number" id="__css-padding-left" placeholder="L" min="0"></div></div><div class="control-group"><label>Margin (px)</label><div class="control-row four"><input type="number" id="__css-margin-top" placeholder="T"><input type="number" id="__css-margin-right" placeholder="R"><input type="number" id="__css-margin-bottom" placeholder="B"><input type="number" id="__css-margin-left" placeholder="L"></div></div><div class="control-group"><label>Border Radius</label><div class="control-row"><input type="range" id="__css-border-radius" min="0" max="50" value="0"><input type="number" id="__css-border-radius-val" value="0" min="0" max="200"><span>px</span></div></div></div><div class="panel-footer"><button id="__claude-apply-styles">Apply & Track</button></div>';
  cssPanel.style.cssText = 'position:fixed;top:60px;right:10px;width:280px;z-index:2147483647;background:#1a1a2e;border:2px solid #00d4ff;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;color:#fff;box-shadow:0 8px 32px rgba(0,212,255,0.3);display:none;';

  const panelStyles = document.createElement('style');
  panelStyles.textContent = '#__claude-css-panel .panel-header{display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-bottom:1px solid #333;font-weight:600;}#__claude-css-panel .panel-header button{background:none;border:none;color:#888;cursor:pointer;font-size:16px;}#__claude-css-panel .panel-header button:hover{color:#fff;}#__claude-css-panel .panel-content{padding:15px;max-height:400px;overflow-y:auto;}#__claude-css-panel .control-group{margin-bottom:15px;}#__claude-css-panel .control-group label{display:block;margin-bottom:6px;color:#aaa;font-size:11px;text-transform:uppercase;}#__claude-css-panel .control-row{display:flex;gap:8px;align-items:center;}#__claude-css-panel .control-row.four{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;}#__claude-css-panel input[type="range"]{flex:1;accent-color:#00d4ff;}#__claude-css-panel input[type="number"],#__claude-css-panel input[type="text"]{width:60px;padding:6px 8px;background:#2a2a3e;border:1px solid #444;border-radius:4px;color:#fff;font-size:12px;}#__claude-css-panel .control-row.four input{width:100%;text-align:center;}#__claude-css-panel input[type="color"]{width:40px;height:30px;border:none;border-radius:4px;cursor:pointer;}#__claude-css-panel select{width:100%;padding:8px;background:#2a2a3e;border:1px solid #444;border-radius:4px;color:#fff;font-size:12px;}#__claude-css-panel .panel-footer{padding:15px;border-top:1px solid #333;}#__claude-css-panel .panel-footer button{width:100%;padding:10px;background:linear-gradient(135deg,#00d4ff,#0099cc);border:none;border-radius:6px;color:#fff;font-weight:600;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;}#__claude-css-panel .panel-footer button:hover{transform:translateY(-1px);box-shadow:0 4px 15px rgba(0,212,255,0.4);}';
  document.head.appendChild(panelStyles);
  document.body.appendChild(cssPanel);

  let currentEditElement = null;
  let originalStyles = {};

  cssPanel.querySelector('#__claude-panel-close').onclick = () => {
    cssPanel.style.display = 'none';
    currentEditElement = null;
    updateButtonState(styleBtn, false, '');
  };

  function syncInputs(rangeId, numId) {
    const range = cssPanel.querySelector(rangeId);
    const num = cssPanel.querySelector(numId);
    range.oninput = () => { num.value = range.value; applyLivePreview(); };
    num.oninput = () => { range.value = num.value; applyLivePreview(); };
  }
  syncInputs('#__css-font-size', '#__css-font-size-val');
  syncInputs('#__css-line-height', '#__css-line-height-val');
  syncInputs('#__css-border-radius', '#__css-border-radius-val');

  function syncColors(colorId, textId) {
    const color = cssPanel.querySelector(colorId);
    const text = cssPanel.querySelector(textId);
    color.oninput = () => { text.value = color.value; applyLivePreview(); };
    text.oninput = () => { if (/^#[0-9A-Fa-f]{6}$/.test(text.value)) { color.value = text.value; applyLivePreview(); } };
  }
  syncColors('#__css-color', '#__css-color-val');
  syncColors('#__css-bg-color', '#__css-bg-color-val');

  ['#__css-font-weight', '#__css-padding-top', '#__css-padding-right', '#__css-padding-bottom', '#__css-padding-left', '#__css-margin-top', '#__css-margin-right', '#__css-margin-bottom', '#__css-margin-left'].forEach(id => {
    const el = cssPanel.querySelector(id);
    if (el) el.oninput = applyLivePreview;
  });

  function applyLivePreview() {
    if (!currentEditElement) return;
    currentEditElement.style.fontSize = cssPanel.querySelector('#__css-font-size-val').value + 'px';
    currentEditElement.style.lineHeight = cssPanel.querySelector('#__css-line-height-val').value;
    currentEditElement.style.fontWeight = cssPanel.querySelector('#__css-font-weight').value;
    currentEditElement.style.color = cssPanel.querySelector('#__css-color').value;
    currentEditElement.style.backgroundColor = cssPanel.querySelector('#__css-bg-color').value;
    currentEditElement.style.borderRadius = cssPanel.querySelector('#__css-border-radius-val').value + 'px';
    const pt = cssPanel.querySelector('#__css-padding-top').value;
    const pr = cssPanel.querySelector('#__css-padding-right').value;
    const pb = cssPanel.querySelector('#__css-padding-bottom').value;
    const pl = cssPanel.querySelector('#__css-padding-left').value;
    if (pt || pr || pb || pl) currentEditElement.style.padding = (pt||0) + 'px ' + (pr||0) + 'px ' + (pb||0) + 'px ' + (pl||0) + 'px';
    const mt = cssPanel.querySelector('#__css-margin-top').value;
    const mr = cssPanel.querySelector('#__css-margin-right').value;
    const mb = cssPanel.querySelector('#__css-margin-bottom').value;
    const ml = cssPanel.querySelector('#__css-margin-left').value;
    if (mt || mr || mb || ml) currentEditElement.style.margin = (mt||0) + 'px ' + (mr||0) + 'px ' + (mb||0) + 'px ' + (ml||0) + 'px';
  }

  cssPanel.querySelector('#__claude-apply-styles').onclick = () => {
    if (!currentEditElement) return;
    const selector = getSelector(currentEditElement);
    const newStyles = {
      fontSize: cssPanel.querySelector('#__css-font-size-val').value + 'px',
      lineHeight: cssPanel.querySelector('#__css-line-height-val').value,
      fontWeight: cssPanel.querySelector('#__css-font-weight').value,
      color: cssPanel.querySelector('#__css-color').value,
      backgroundColor: cssPanel.querySelector('#__css-bg-color').value,
      borderRadius: cssPanel.querySelector('#__css-border-radius-val').value + 'px',
    };
    const pt = cssPanel.querySelector('#__css-padding-top').value;
    const pr = cssPanel.querySelector('#__css-padding-right').value;
    const pb = cssPanel.querySelector('#__css-padding-bottom').value;
    const pl = cssPanel.querySelector('#__css-padding-left').value;
    if (pt || pr || pb || pl) newStyles.padding = (pt||0) + 'px ' + (pr||0) + 'px ' + (pb||0) + 'px ' + (pl||0) + 'px';
    const mt = cssPanel.querySelector('#__css-margin-top').value;
    const mr = cssPanel.querySelector('#__css-margin-right').value;
    const mb = cssPanel.querySelector('#__css-margin-bottom').value;
    const ml = cssPanel.querySelector('#__css-margin-left').value;
    if (mt || mr || mb || ml) newStyles.margin = (mt||0) + 'px ' + (mr||0) + 'px ' + (mb||0) + 'px ' + (ml||0) + 'px';
    const change = { type: 'style', selector: selector, element: currentEditElement.tagName.toLowerCase(), css: newStyles, original: originalStyles };
    window.__claudeChanges.push(change);
    updateChangesCount();
    status.textContent = 'Styled! (' + window.__claudeChanges.length + ')';
    status.style.color = '#00ff00';
    setTimeout(() => updateStatus(), 1500);
    cssPanel.style.display = 'none';
    updateButtonState(styleBtn, false, '');
  };

  function openCssPanel(el) {
    currentEditElement = el;
    const computed = getComputedStyle(el);
    originalStyles = { fontSize: computed.fontSize, lineHeight: computed.lineHeight, fontWeight: computed.fontWeight, color: computed.color, backgroundColor: computed.backgroundColor, padding: computed.padding, margin: computed.margin, borderRadius: computed.borderRadius };
    cssPanel.querySelector('#__css-font-size').value = parseInt(computed.fontSize) || 16;
    cssPanel.querySelector('#__css-font-size-val').value = parseInt(computed.fontSize) || 16;
    cssPanel.querySelector('#__css-line-height').value = parseFloat(computed.lineHeight) / parseInt(computed.fontSize) || 1.5;
    cssPanel.querySelector('#__css-line-height-val').value = (parseFloat(computed.lineHeight) / parseInt(computed.fontSize) || 1.5).toFixed(1);
    cssPanel.querySelector('#__css-font-weight').value = computed.fontWeight;
    function rgbToHex(rgb) { const match = rgb.match(/\\d+/g); if (!match || match.length < 3) return '#000000'; return '#' + match.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join(''); }
    cssPanel.querySelector('#__css-color').value = rgbToHex(computed.color);
    cssPanel.querySelector('#__css-color-val').value = rgbToHex(computed.color);
    cssPanel.querySelector('#__css-bg-color').value = rgbToHex(computed.backgroundColor);
    cssPanel.querySelector('#__css-bg-color-val').value = rgbToHex(computed.backgroundColor);
    cssPanel.querySelector('#__css-border-radius').value = parseInt(computed.borderRadius) || 0;
    cssPanel.querySelector('#__css-border-radius-val').value = parseInt(computed.borderRadius) || 0;
    const paddings = computed.padding.split(' ').map(p => parseInt(p) || 0);
    cssPanel.querySelector('#__css-padding-top').value = paddings[0] || '';
    cssPanel.querySelector('#__css-padding-right').value = paddings[1] || paddings[0] || '';
    cssPanel.querySelector('#__css-padding-bottom').value = paddings[2] || paddings[0] || '';
    cssPanel.querySelector('#__css-padding-left').value = paddings[3] || paddings[1] || paddings[0] || '';
    const margins = computed.margin.split(' ').map(m => parseInt(m) || 0);
    cssPanel.querySelector('#__css-margin-top').value = margins[0] || '';
    cssPanel.querySelector('#__css-margin-right').value = margins[1] || margins[0] || '';
    cssPanel.querySelector('#__css-margin-bottom').value = margins[2] || margins[0] || '';
    cssPanel.querySelector('#__css-margin-left').value = margins[3] || margins[1] || margins[0] || '';
    cssPanel.style.display = 'block';
  }

  // Minimize functionality
  let isMinimized = false;
  minimizeBtn.onclick = () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
      selectBtn.style.display = 'none';
      styleBtn.style.display = 'none';
      dragBtn.style.display = 'none';
      copyBtn.style.display = 'none';
      status.style.display = 'none';
      changesCount.style.display = 'none';
      minimizeBtn.textContent = '🎯';
      toolbar.style.padding = '6px 10px';
    } else {
      selectBtn.style.display = '';
      dragBtn.style.display = '';
      status.style.display = '';
      minimizeBtn.textContent = '◀';
      toolbar.style.padding = '8px 12px';
      updateChangesCount();
      if (window.__claudeSelectedElement) styleBtn.style.display = '';
    }
  };

  let isToolbarDragging = false;
  let toolbarOffsetX, toolbarOffsetY;
  toolbar.onmousedown = (e) => {
    if (e.target === selectBtn || e.target === styleBtn || e.target === dragBtn || e.target === minimizeBtn || e.target === copyBtn) return;
    isToolbarDragging = true;
    toolbarOffsetX = e.clientX - toolbar.offsetLeft;
    toolbarOffsetY = e.clientY - toolbar.offsetTop;
  };

  const highlight = document.createElement('div');
  highlight.id = '__claude-selector-highlight';
  highlight.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #00d4ff;background:rgba(0,212,255,0.1);z-index:2147483646;display:none;transition:all 0.05s ease;';
  document.body.appendChild(highlight);

  const tooltip = document.createElement('div');
  tooltip.id = '__claude-selector-tooltip';
  tooltip.style.cssText = 'position:fixed;z-index:2147483647;background:#1a1a2e;border:1px solid #00d4ff;border-radius:4px;padding:6px 10px;font-family:monospace;font-size:12px;color:#00d4ff;display:none;max-width:400px;word-break:break-all;';
  document.body.appendChild(tooltip);

  let selectionActive = false;
  let dragModeActive = false;
  let dragTarget = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let originalPosition = null;
  let isDraggingElement = false;

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    let path = [];
    while (el && el.nodeType === 1) {
      let selector = el.tagName.toLowerCase();
      if (el.id) { selector = '#' + el.id; path.unshift(selector); break; }
      else if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\\s+/).filter(c => !c.startsWith('__claude'));
        if (classes.length) selector += '.' + classes.join('.');
      }
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(' > ');
  }

  function updateButtonState(btn, active, color) {
    if (active) { btn.style.background = color; btn.style.borderColor = color; }
    else { btn.style.background = 'none'; btn.style.borderColor = 'transparent'; }
  }

  function updateStatus() {
    if (selectionActive && dragModeActive) { status.textContent = 'Select + Drag'; status.style.color = '#ff00ff'; }
    else if (selectionActive) { status.textContent = 'Select'; status.style.color = '#00d4ff'; }
    else if (dragModeActive) { status.textContent = 'Drag'; status.style.color = '#ff9500'; }
    else { status.textContent = ''; }
  }

  function handleSelectMouseMove(e) {
    if (!selectionActive || isDraggingElement) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id?.startsWith('__claude')) return;
    const rect = el.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = rect.left + 'px';
    highlight.style.top = rect.top + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    highlight.style.border = '2px solid #00d4ff';
    highlight.style.background = 'rgba(0, 212, 255, 0.1)';
    tooltip.textContent = getSelector(el);
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(e.clientX + 10, window.innerWidth - tooltip.offsetWidth - 10) + 'px';
    tooltip.style.top = Math.min(e.clientY + 10, window.innerHeight - tooltip.offsetHeight - 10) + 'px';
  }

  function handleSelectClick(e) {
    if (!selectionActive || isDraggingElement) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id?.startsWith('__claude')) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    window.__claudeSelectedElement = {
      tagName: el.tagName.toLowerCase(),
      id: el.id || null,
      className: el.className || null,
      selector: getSelector(el),
      text: el.innerText?.substring(0, 200) || null,
      boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    };
    highlight.style.border = '3px solid #00ff00';
    highlight.style.background = 'rgba(0, 255, 0, 0.2)';

    const selectorText = window.__claudeSelectedElement.selector;
    navigator.clipboard.writeText(selectorText).then(() => {
      status.textContent = '📋 Copied! Click 🎨 to style';
      status.style.color = '#00ff00';
      setTimeout(() => updateStatus(), 2500);
      const notif = document.createElement('div');
      notif.textContent = selectorText;
      notif.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#00ff00;color:#000;padding:10px 20px;border-radius:8px;font-family:monospace;font-size:12px;z-index:2147483647;max-width:80%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 4px 20px rgba(0,255,0,0.4);';
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 3000);
      styleBtn.style.display = '';
    });
    console.log('[Claude Selector] Element selected:', window.__claudeSelectedElement);
  }

  function handleDragMouseDown(e) {
    if (!dragModeActive || selectionActive) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id?.startsWith('__claude') || el === toolbar) return;
    e.preventDefault();
    e.stopPropagation();
    dragTarget = el;
    isDraggingElement = true;
    const rect = el.getBoundingClientRect();
    const computedStyle = getComputedStyle(el);
    originalPosition = { position: computedStyle.position, left: computedStyle.left, top: computedStyle.top, zIndex: computedStyle.zIndex };
    if (computedStyle.position === 'static') el.style.position = 'relative';
    el.style.zIndex = '999999';
    el.style.cursor = 'grabbing';
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    highlight.style.display = 'block';
    highlight.style.border = '3px solid #ff9500';
    highlight.style.background = 'rgba(255, 149, 0, 0.2)';
    status.textContent = 'Dragging...';
    status.style.color = '#ff9500';
  }

  function handleDragMouseMove(e) {
    if (isToolbarDragging) {
      toolbar.style.left = (e.clientX - toolbarOffsetX) + 'px';
      toolbar.style.right = 'auto';
      toolbar.style.top = (e.clientY - toolbarOffsetY) + 'px';
      return;
    }
    if (!isDraggingElement || !dragTarget) return;
    e.preventDefault();
    const rect = dragTarget.getBoundingClientRect();
    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;
    const computedStyle = getComputedStyle(dragTarget);
    const currentLeft = parseFloat(computedStyle.left) || 0;
    const currentTop = parseFloat(computedStyle.top) || 0;
    dragTarget.style.left = (currentLeft + (newX - rect.left)) + 'px';
    dragTarget.style.top = (currentTop + (newY - rect.top)) + 'px';
    const newRect = dragTarget.getBoundingClientRect();
    highlight.style.left = newRect.left + 'px';
    highlight.style.top = newRect.top + 'px';
    highlight.style.width = newRect.width + 'px';
    highlight.style.height = newRect.height + 'px';
  }

  function handleDragMouseUp(e) {
    isToolbarDragging = false;
    if (!isDraggingElement || !dragTarget) return;
    isDraggingElement = false;
    dragTarget.style.cursor = '';
    dragTarget.style.zIndex = originalPosition.zIndex || '';
    const selector = getSelector(dragTarget);
    const computedStyle = getComputedStyle(dragTarget);
    const change = { type: 'position', selector: selector, element: dragTarget.tagName.toLowerCase(), css: { position: dragTarget.style.position || computedStyle.position, left: dragTarget.style.left, top: dragTarget.style.top }, original: originalPosition };
    window.__claudeChanges.push(change);
    updateChangesCount();
    highlight.style.border = '3px solid #00ff00';
    highlight.style.background = 'rgba(0, 255, 0, 0.2)';
    status.textContent = 'Changed! (' + window.__claudeChanges.length + ')';
    status.style.color = '#00ff00';
    setTimeout(() => updateStatus(), 1500);
    console.log('[Claude Drag] CSS change tracked:', change);
    dragTarget = null;
    originalPosition = null;
  }

  function handleDragHover(e) {
    if (!dragModeActive || isDraggingElement || selectionActive) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id?.startsWith('__claude') || el === toolbar) return;
    const rect = el.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = rect.left + 'px';
    highlight.style.top = rect.top + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    highlight.style.border = '2px dashed #ff9500';
    highlight.style.background = 'rgba(255, 149, 0, 0.1)';
    tooltip.textContent = 'Drag: ' + getSelector(el);
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(e.clientX + 10, window.innerWidth - tooltip.offsetWidth - 10) + 'px';
    tooltip.style.top = Math.min(e.clientY + 10, window.innerHeight - tooltip.offsetHeight - 10) + 'px';
  }

  selectBtn.onclick = () => {
    selectionActive = !selectionActive;
    updateButtonState(selectBtn, selectionActive, 'rgba(0, 212, 255, 0.3)');
    if (selectionActive) {
      document.addEventListener('mousemove', handleSelectMouseMove, true);
      document.addEventListener('click', handleSelectClick, true);
    } else {
      document.removeEventListener('mousemove', handleSelectMouseMove, true);
      document.removeEventListener('click', handleSelectClick, true);
      if (!dragModeActive) { highlight.style.display = 'none'; tooltip.style.display = 'none'; }
    }
    updateStatus();
  };

  styleBtn.onclick = () => {
    if (!window.__claudeSelectedElement) {
      status.textContent = 'Select element first!';
      status.style.color = '#ff4444';
      setTimeout(() => updateStatus(), 1500);
      return;
    }
    const selector = window.__claudeSelectedElement.selector;
    const el = document.querySelector(selector);
    if (el) {
      openCssPanel(el);
      updateButtonState(styleBtn, true, 'rgba(138, 43, 226, 0.3)');
    }
  };

  dragBtn.onclick = () => {
    dragModeActive = !dragModeActive;
    updateButtonState(dragBtn, dragModeActive, 'rgba(255, 149, 0, 0.3)');
    if (dragModeActive) {
      document.addEventListener('mousedown', handleDragMouseDown, true);
      document.addEventListener('mousemove', handleDragMouseMove, true);
      document.addEventListener('mousemove', handleDragHover, true);
      document.addEventListener('mouseup', handleDragMouseUp, true);
    } else {
      document.removeEventListener('mousedown', handleDragMouseDown, true);
      document.removeEventListener('mousemove', handleDragMouseMove, true);
      document.removeEventListener('mousemove', handleDragHover, true);
      document.removeEventListener('mouseup', handleDragMouseUp, true);
      if (!selectionActive) { highlight.style.display = 'none'; tooltip.style.display = 'none'; }
    }
    updateStatus();
  };

  copyBtn.onclick = () => {
    if (window.__claudeChanges.length === 0) return;
    let prompt = 'Applica queste modifiche CSS ai seguenti elementi:\\n\\n';
    window.__claudeChanges.forEach((change, index) => {
      prompt += (index + 1) + '. Elemento: ' + change.selector + '\\n';
      prompt += '   CSS da applicare:\\n';
      const css = change.css;
      if (css.position && css.position !== 'static') prompt += '   position: ' + css.position + ';\\n';
      if (css.left && css.left !== 'auto') prompt += '   left: ' + css.left + ';\\n';
      if (css.top && css.top !== 'auto') prompt += '   top: ' + css.top + ';\\n';
      if (css.fontSize) prompt += '   font-size: ' + css.fontSize + ';\\n';
      if (css.lineHeight) prompt += '   line-height: ' + css.lineHeight + ';\\n';
      if (css.fontWeight) prompt += '   font-weight: ' + css.fontWeight + ';\\n';
      if (css.color) prompt += '   color: ' + css.color + ';\\n';
      if (css.backgroundColor) prompt += '   background-color: ' + css.backgroundColor + ';\\n';
      if (css.padding) prompt += '   padding: ' + css.padding + ';\\n';
      if (css.margin) prompt += '   margin: ' + css.margin + ';\\n';
      if (css.borderRadius) prompt += '   border-radius: ' + css.borderRadius + ';\\n';
      prompt += '\\n';
    });
    navigator.clipboard.writeText(prompt).then(() => {
      status.textContent = '📋 Prompt copied!';
      status.style.color = '#00ff00';
      const notif = document.createElement('div');
      notif.innerHTML = '<strong>Prompt copiato!</strong><br><small>' + window.__claudeChanges.length + ' modifiche - Incolla in Claude Code</small>';
      notif.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#00ff00;color:#000;padding:15px 25px;border-radius:8px;font-family:sans-serif;font-size:14px;z-index:2147483647;text-align:center;box-shadow:0 4px 20px rgba(0,255,0,0.4);';
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 3000);
      window.__claudeChanges = [];
      updateChangesCount();
      setTimeout(() => updateStatus(), 1500);
    });
  };

  window.__claudeDisableSelector = () => { toolbar.remove(); highlight.remove(); tooltip.remove(); cssPanel.remove(); panelStyles.remove(); window.__claudeSelectorActive = false; };
  console.log('[Claude] Page Builder ready! Features: 🎯 Select, 🎨 Style, 🖐️ Drag, 📋 Copy');
})();
`;

(async () => {
  try {
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
    const pages = await browser.pages();
    const page = pages[0];
    console.log('Connected to page:', await page.title());

    await page.evaluate(() => {
      if (window.__claudeDisableSelector) window.__claudeDisableSelector();
      window.__claudeSelectorActive = false;
    });

    await page.evaluate(SELECTOR_SCRIPT);
    console.log('');
    console.log('Page Builder injected successfully!');
    console.log('');
    console.log('Features:');
    console.log('  🎯 Select mode - click elements to copy selector');
    console.log('  🎨 Style mode - opens Elementor-style CSS editor panel');
    console.log('  🖐️ Drag mode - drag elements to reposition');
    console.log('  📋 Copy - copies all CSS changes as prompt for Claude Code');
    console.log('');
    browser.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    console.log('Make sure Chrome is running with --remote-debugging-port=9222');
  }
})();
