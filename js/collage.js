'use strict';

(function (root) {
  const state = { items: [], rects: [], selected: -1, drag: null, layout: '' };

  function gridRects(columns, rows, width, height) {
    const result = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = Math.round(column * width / columns);
        const y = Math.round(row * height / rows);
        result.push({ x, y, w: Math.round((column + 1) * width / columns) - x,
          h: Math.round((row + 1) * height / rows) - y });
      }
    }
    return result;
  }

  function buildLayoutRects(layout, width, height) {
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));
    switch (layout) {
      case 'left-right': return gridRects(2, 1, width, height);
      case 'top-bottom': return gridRects(1, 2, width, height);
      case 'three-horizontal': return gridRects(3, 1, width, height);
      case 'three-vertical': return gridRects(1, 3, width, height);
      case 'six-grid': return gridRects(3, 2, width, height);
      case 'nine-grid': return gridRects(3, 3, width, height);
      case 'diagonal':
        return [
          { x: 0, y: 0, w: width, h: height, shape: 'diagonal-upper' },
          { x: 0, y: 0, w: width, h: height, shape: 'diagonal-lower' }
        ];
      case 'four-grid':
      default: return gridRects(2, 2, width, height);
    }
  }

  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ image, scale: 1, offsetX: 0, offsetY: 0, name: file.name });
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`无法读取 ${file.name}`));
      };
      image.src = url;
    });
  }

  function clipRegion(context, rect) {
    context.beginPath();
    if (rect.shape === 'diagonal-upper') {
      context.moveTo(0, 0); context.lineTo(rect.w, 0); context.lineTo(0, rect.h);
    } else if (rect.shape === 'diagonal-lower') {
      context.moveTo(rect.w, 0); context.lineTo(rect.w, rect.h); context.lineTo(0, rect.h);
    } else {
      context.rect(rect.x, rect.y, rect.w, rect.h);
    }
    context.closePath();
    context.clip();
  }

  function drawItem(context, item, rect) {
    if (!item || !item.image) return;
    const image = item.image;
    const cover = Math.max(rect.w / image.naturalWidth, rect.h / image.naturalHeight);
    const width = image.naturalWidth * cover * item.scale;
    const height = image.naturalHeight * cover * item.scale;
    const x = rect.x + (rect.w - width) / 2 + item.offsetX;
    const y = rect.y + (rect.h - height) / 2 + item.offsetY;
    context.save();
    clipRegion(context, rect);
    context.drawImage(image, x, y, width, height);
    context.restore();
  }

  function setStatus(text) {
    const element = document.getElementById('collageSelected');
    if (element) element.textContent = text;
  }

  function renderCollage(commitHistory) {
    const canvas = document.getElementById('canvas');
    if (!canvas || !state.rects.length) return;
    const source = document.createElement('canvas');
    source.width = canvas.width;
    source.height = canvas.height;
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    sourceContext.fillStyle = '#fff';
    sourceContext.fillRect(0, 0, source.width, source.height);
    state.rects.forEach((rect, index) => drawItem(sourceContext, state.items[index], rect));
    const imageData = sourceContext.getImageData(0, 0, source.width, source.height);

    const dither = document.getElementById('collageDitherPreview');
    if (typeof root.renderCollageImagePreview === 'function')
      root.renderCollageImagePreview(imageData, !dither || dither.checked, !!commitHistory);
  }

  function pointInRect(x, y, rect) {
    if (x < rect.x || y < rect.y || x >= rect.x + rect.w || y >= rect.y + rect.h) return false;
    if (rect.shape === 'diagonal-upper') return x / rect.w + y / rect.h <= 1;
    if (rect.shape === 'diagonal-lower') return x / rect.w + y / rect.h > 1;
    return true;
  }

  function regionAt(event) {
    const canvas = document.getElementById('canvas');
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
    return {
      index: state.rects.findIndex((rect) => pointInRect(x, y, rect)), x, y
    };
  }

  function selectRegion(index) {
    state.selected = index;
    const item = state.items[index];
    setStatus(item ? `区域 ${index + 1}：${item.name}（拖动位置，滚轮缩放，拖到其他区域交换）`
      : `区域 ${index + 1}：空白`);
  }

  function bindCanvasEvents() {
    const target = document.getElementById('canvas');
    if (!target || target.dataset.collageEvents === '1') return;
    target.dataset.collageEvents = '1';
    target.addEventListener('pointerdown', (event) => {
      if (target.dataset.collageEditing !== '1') return;
      const point = regionAt(event);
      if (point.index < 0) return;
      selectRegion(point.index);
      state.drag = { index: point.index, x: point.x, y: point.y, moved: false };
      target.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    target.addEventListener('pointermove', (event) => {
      if (!state.drag || target.dataset.collageEditing !== '1') return;
      const point = regionAt(event);
      const item = state.items[state.drag.index];
      if (!item) return;
      item.offsetX += point.x - state.drag.x;
      item.offsetY += point.y - state.drag.y;
      state.drag.x = point.x;
      state.drag.y = point.y;
      state.drag.moved = true;
      renderCollage(false);
      event.preventDefault();
    });
    target.addEventListener('pointerup', (event) => {
      if (!state.drag) return;
      const point = regionAt(event);
      if (state.drag.moved && point.index >= 0 && point.index !== state.drag.index) {
        const item = state.items[state.drag.index];
        state.items[state.drag.index] = state.items[point.index];
        state.items[point.index] = item;
        selectRegion(point.index);
      }
      state.drag = null;
      renderCollage(true);
    });
    target.addEventListener('wheel', (event) => {
      if (target.dataset.collageEditing !== '1') return;
      const point = regionAt(event);
      const item = state.items[point.index];
      if (!item) return;
      item.scale = Math.max(1, Math.min(5, item.scale * (event.deltaY < 0 ? 1.08 : 0.92)));
      selectRegion(point.index);
      renderCollage(false);
      event.preventDefault();
    }, { passive: false });
  }

  async function applyCollage() {
    const input = document.getElementById('collageFiles');
    const layout = document.getElementById('collageLayout').value;
    const files = Array.from(input.files || []);
    if (files.length) {
      try {
        state.items = await Promise.all(files.map(loadImageFile));
        input.value = '';
      } catch (error) {
        setStatus(error.message || String(error));
        return false;
      }
    }
    if (!state.items.length) {
      setStatus('请先选择两张或更多图片');
      return false;
    }
    const canvas = document.getElementById('canvas');
    if (!canvas) return false;
    state.layout = layout;
    state.rects = buildLayoutRects(layout, canvas.width, canvas.height);
    canvas.dataset.collageEditing = '1';
    if (typeof root.resetPaintForImageLoad === 'function') root.resetPaintForImageLoad();
    selectRegion(0);
    renderCollage(true);
    return true;
  }

  function initCollage() {
    bindCanvasEvents();
    document.getElementById('collageFiles')?.addEventListener('change', applyCollage);
    document.getElementById('collageLayout')?.addEventListener('change', () => {
      if (state.items.length) applyCollage();
    });
    document.getElementById('collageDitherPreview')?.addEventListener('change', () => {
      if (state.items.length) renderCollage(false);
    });
  }

  root.buildLayoutRects = buildLayoutRects;
  root.applyCollage = applyCollage;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', initCollage);
  if (typeof module !== 'undefined' && module.exports) module.exports = { buildLayoutRects };
})(typeof window !== 'undefined' ? window : globalThis);
