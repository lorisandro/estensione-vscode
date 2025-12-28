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
  toolbar.innerHTML = '<button id="__claude-minimize-btn" title="Minimize">◀</button><button id="__claude-selector-btn" title="Select">🎯</button><button id="__claude-drag-btn" title="Drag">🖐️</button><button id="__claude-copy-btn" title="Copy changes" style="display:none;">📋</button><span id="__claude-selector-status"></span><span id="__claude-changes-count" style="display:none;background:#ff9500;color:#000;padding:2px 6px;border-radius:10px;font-size:11px;font-weight:bold;"></span>';
  toolbar.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;background:#1a1a2e;border:2px solid #00d4ff;border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:8px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;color:#fff;box-shadow:0 4px 20px rgba(0,212,255,0.3);cursor:move;';

  const minimizeBtn = toolbar.querySelector('#__claude-minimize-btn');
  const selectBtn = toolbar.querySelector('#__claude-selector-btn');
  const dragBtn = toolbar.querySelector('#__claude-drag-btn');
  const copyBtn = toolbar.querySelector('#__claude-copy-btn');
  const status = toolbar.querySelector('#__claude-selector-status');
  const changesCount = toolbar.querySelector('#__claude-changes-count');

  minimizeBtn.style.cssText = 'background:none;border:none;font-size:14px;cursor:pointer;padding:4px;color:#888;transition:all 0.2s;';
  minimizeBtn.onmouseenter = () => minimizeBtn.style.color = '#fff';
  minimizeBtn.onmouseleave = () => minimizeBtn.style.color = '#888';

  [selectBtn, dragBtn, copyBtn].forEach(btn => {
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

  // Minimize functionality
  let isMinimized = false;
  minimizeBtn.onclick = () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
      selectBtn.style.display = 'none';
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
    }
  };

  let isToolbarDragging = false;
  let toolbarOffsetX, toolbarOffsetY;
  toolbar.onmousedown = (e) => {
    if (e.target === selectBtn || e.target === dragBtn || e.target === minimizeBtn || e.target === copyBtn) return;
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

    // Copy selector to clipboard
    const selectorText = window.__claudeSelectedElement.selector;
    navigator.clipboard.writeText(selectorText).then(() => {
      status.textContent = '📋 Copied! Ctrl+V';
      status.style.color = '#00ff00';
      setTimeout(() => updateStatus(), 2500);

      const notif = document.createElement('div');
      notif.textContent = selectorText;
      notif.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#00ff00;color:#000;padding:10px 20px;border-radius:8px;font-family:monospace;font-size:12px;z-index:2147483647;max-width:80%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-shadow:0 4px 20px rgba(0,255,0,0.4);';
      document.body.appendChild(notif);
      setTimeout(() => notif.remove(), 3000);
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

    // Track the CSS change
    const change = {
      type: 'position',
      selector: selector,
      element: dragTarget.tagName.toLowerCase(),
      css: {
        position: dragTarget.style.position || computedStyle.position,
        left: dragTarget.style.left,
        top: dragTarget.style.top
      },
      original: originalPosition
    };

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

  // Copy all changes as Claude Code prompt
  copyBtn.onclick = () => {
    if (window.__claudeChanges.length === 0) return;

    let prompt = 'Applica queste modifiche CSS:\\n\\n';
    window.__claudeChanges.forEach((change, index) => {
      prompt += (index + 1) + '. Elemento: ' + change.selector + '\\n';
      prompt += '   CSS da aggiungere:\\n';
      if (change.css.position && change.css.position !== 'static') {
        prompt += '   position: ' + change.css.position + ';\\n';
      }
      if (change.css.left) prompt += '   left: ' + change.css.left + ';\\n';
      if (change.css.top) prompt += '   top: ' + change.css.top + ';\\n';
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

  window.__claudeDisableSelector = () => { toolbar.remove(); highlight.remove(); tooltip.remove(); window.__claudeSelectorActive = false; };
  console.log('[Claude] Selector ready with page builder mode!');
})();
`;

(async () => {
  try {
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
    const pages = await browser.pages();
    const page = pages[0];
    console.log('Connected to page:', await page.title());

    // Remove old toolbar if exists
    await page.evaluate(() => {
      if (window.__claudeDisableSelector) window.__claudeDisableSelector();
      window.__claudeSelectorActive = false;
    });

    await page.evaluate(SELECTOR_SCRIPT);
    console.log('Selector toolbar injected successfully!');
    console.log('Features:');
    console.log('  🎯 Select mode - click elements to copy selector');
    console.log('  🖐️ Drag mode - drag elements, changes are tracked');
    console.log('  📋 Copy button - appears when you have changes, copies prompt for Claude Code');
    browser.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
