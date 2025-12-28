const puppeteer = require('puppeteer-core');

const SELECTOR_SCRIPT = `
(function() {
  if (window.__claudeSelectorActive) { console.log('Already active'); return; }
  window.__claudeSelectorActive = true;
  window.__claudeSelectedElement = null;
  window.__claudeDraggedElement = null;

  const toolbar = document.createElement('div');
  toolbar.id = '__claude-selector-toolbar';
  toolbar.innerHTML = '<button id="__claude-selector-btn" title="Toggle element selection mode">🎯</button><button id="__claude-drag-btn" title="Toggle element drag mode">🖐️</button><span id="__claude-selector-status"></span>';
  toolbar.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;background:#1a1a2e;border:2px solid #00d4ff;border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:8px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;color:#fff;box-shadow:0 4px 20px rgba(0,212,255,0.3);cursor:move;';

  const selectBtn = toolbar.querySelector('#__claude-selector-btn');
  const dragBtn = toolbar.querySelector('#__claude-drag-btn');
  const status = toolbar.querySelector('#__claude-selector-status');

  [selectBtn, dragBtn].forEach(btn => {
    btn.style.cssText = 'background:none;border:2px solid transparent;font-size:24px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:all 0.2s;';
  });

  document.body.appendChild(toolbar);

  let isToolbarDragging = false;
  let toolbarOffsetX, toolbarOffsetY;
  toolbar.onmousedown = (e) => {
    if (e.target === selectBtn || e.target === dragBtn) return;
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
    status.textContent = 'Selected: ' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
    status.style.color = '#00ff00';
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
    originalPosition = { position: computedStyle.position, left: computedStyle.left, top: computedStyle.top };
    if (computedStyle.position === 'static') el.style.position = 'relative';
    el.style.zIndex = '999999';
    el.style.cursor = 'grabbing';
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    highlight.style.display = 'block';
    highlight.style.border = '3px solid #ff9500';
    highlight.style.background = 'rgba(255, 149, 0, 0.2)';
    status.textContent = 'Dragging: ' + el.tagName.toLowerCase();
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
    const rect = dragTarget.getBoundingClientRect();
    window.__claudeDraggedElement = { tagName: dragTarget.tagName.toLowerCase(), selector: getSelector(dragTarget), newPosition: { x: rect.left, y: rect.top } };
    highlight.style.border = '3px solid #00ff00';
    highlight.style.background = 'rgba(0, 255, 0, 0.2)';
    status.textContent = 'Dropped: ' + dragTarget.tagName.toLowerCase();
    status.style.color = '#00ff00';
    console.log('[Claude Drag] Element dropped:', window.__claudeDraggedElement);
    dragTarget = null;
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

  window.__claudeDisableSelector = () => {
    toolbar.remove();
    highlight.remove();
    tooltip.remove();
    window.__claudeSelectorActive = false;
  };

  console.log('[Claude] Selector toolbar injected!');
})();
`;

(async () => {
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    if (pages.length === 0) {
      console.log('No pages found');
      return;
    }

    const page = pages[0];
    console.log('Connected to page:', await page.title());

    await page.evaluate(SELECTOR_SCRIPT);

    console.log('Selector toolbar injected successfully!');
    console.log('Look for the toolbar with 🎯 and 🖐️ icons in the top-right corner of the page.');
    browser.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
