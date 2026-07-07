class PaintManager {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.painting = false;
    this.lastX = 0;
    this.lastY = 0;
    this.brushColor = "#000000";
    this.brushSize = 2;
    this.currentTool = null;
    this.textElements = [];
    this.lineSegments = [];
    this.isTextPlacementMode = false;
    this.draggingCanvasContext = null;
    this.selectedTextElement = null;
    this.isDraggingText = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.textBold = false;
    this.textItalic = false;
    this.todoItems = [];
    this.isTodoPlacementMode = false;
    this.selectedTodoItem = null;
    this.todoBold = false;
    this.todoItalic = false;
    this.todoColor = '#000000';
    this.showTodoDeleteButtons = true;

    this.scheduleData = null;
    this.scheduleDays = 5;
    this.scheduleClasses = 6;
    this.scheduleFontFamily = 'SimHei';
    this.scheduleFontSize = 12;
    this.scheduleColor = '#000000';
    this.scheduleStartX = 20;
    this.scheduleStartY = 20;
    this.scheduleCellWidth = 60;
    this.scheduleCellHeight = 35;
    this.weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    this.selectedScheduleCell = null;
    this.showScheduleCellIndicator = true;
    this.scheduleCellFontSizes = null;
    this.scheduleBaseImageData = null;

    // Brush cursor indicator
    this.brushCursor = null;

    // Undo/Redo functionality
    this.historyStack = [];
    this.historyStep = -1;
    this.MAX_HISTORY = 50;

    // Bind event handlers
    this.startPaint = this.startPaint.bind(this);
    this.paint = this.paint.bind(this);
    this.endPaint = this.endPaint.bind(this);
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.handleKeyboard = this.handleKeyboard.bind(this);
    this.updateBrushCursor = this.updateBrushCursor.bind(this);
    this.hideBrushCursor = this.hideBrushCursor.bind(this);
  }

  saveToHistory() {
    // Remove any states after current step (when user drew something after undoing)
    this.historyStack = this.historyStack.slice(0, this.historyStep + 1);

    // Save current canvas state along with text and line data
    const canvasState = {
      imageData: this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height),
      textElements: JSON.parse(JSON.stringify(this.textElements)),
      lineSegments: JSON.parse(JSON.stringify(this.lineSegments)),
      todoItems: JSON.parse(JSON.stringify(this.todoItems)),
      scheduleData: this.scheduleData ? JSON.parse(JSON.stringify(this.scheduleData)) : null,
      scheduleCellFontSizes: this.scheduleCellFontSizes ? JSON.parse(JSON.stringify(this.scheduleCellFontSizes)) : null,
      scheduleDays: this.scheduleDays,
      scheduleClasses: this.scheduleClasses,
      scheduleFontFamily: this.scheduleFontFamily,
      scheduleFontSize: this.scheduleFontSize,
      scheduleColor: this.scheduleColor,
      scheduleStartX: this.scheduleStartX,
      scheduleStartY: this.scheduleStartY,
      scheduleCellWidth: this.scheduleCellWidth,
      scheduleCellHeight: this.scheduleCellHeight,
      scheduleBaseImageData: this.scheduleBaseImageData ? this.cloneImageData(this.scheduleBaseImageData) : null
    };

    this.historyStack.push(canvasState);
    this.historyStep++;

    // Limit history size
    if (this.historyStack.length > this.MAX_HISTORY) {
      this.historyStack.shift();
      this.historyStep--;
    }

    this.updateUndoRedoButtons();
  }

  clearHistory() {
    this.historyStack = [];
    this.historyStep = -1;
    this.updateUndoRedoButtons();
  }

  undo() {
    if (this.historyStep > 0) {
      this.historyStep--;
      this.restoreFromHistory();
    }
  }

  redo() {
    if (this.historyStep < this.historyStack.length - 1) {
      this.historyStep++;
      this.restoreFromHistory();
    }
  }

  restoreFromHistory() {
    if (this.historyStep >= 0 && this.historyStep < this.historyStack.length) {
      const state = this.historyStack[this.historyStep];

      // Restore canvas image
      this.ctx.putImageData(state.imageData, 0, 0);

      // Restore text and line data
      this.textElements = JSON.parse(JSON.stringify(state.textElements));
      this.lineSegments = JSON.parse(JSON.stringify(state.lineSegments));
      this.todoItems = JSON.parse(JSON.stringify(state.todoItems || []));
      this.scheduleData = state.scheduleData ? JSON.parse(JSON.stringify(state.scheduleData)) : null;
      this.scheduleCellFontSizes = state.scheduleCellFontSizes ? JSON.parse(JSON.stringify(state.scheduleCellFontSizes)) : null;
      this.scheduleDays = state.scheduleDays || this.scheduleDays;
      this.scheduleClasses = state.scheduleClasses || this.scheduleClasses;
      this.scheduleFontFamily = state.scheduleFontFamily || this.scheduleFontFamily;
      this.scheduleFontSize = state.scheduleFontSize || this.scheduleFontSize;
      this.scheduleColor = state.scheduleColor || this.scheduleColor;
      this.scheduleStartX = Number.isFinite(state.scheduleStartX) ? state.scheduleStartX : this.scheduleStartX;
      this.scheduleStartY = Number.isFinite(state.scheduleStartY) ? state.scheduleStartY : this.scheduleStartY;
      this.scheduleCellWidth = state.scheduleCellWidth || this.scheduleCellWidth;
      this.scheduleCellHeight = state.scheduleCellHeight || this.scheduleCellHeight;
      this.scheduleBaseImageData = state.scheduleBaseImageData ? this.cloneImageData(state.scheduleBaseImageData) : null;

      this.updateUndoRedoButtons();
    }
  }

  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    if (undoBtn) {
      undoBtn.disabled = this.historyStep <= 0;
    }

    if (redoBtn) {
      redoBtn.disabled = this.historyStep >= this.historyStack.length - 1;
    }
  }

  initPaintTools() {
    document.getElementById('brush-mode').addEventListener('click', () => {
      if (this.currentTool === 'brush') {
        this.setActiveTool(null, '');
      } else {
        this.setActiveTool('brush', '画笔模式');
        this.brushColor = document.getElementById('brush-color').value;
      }
    });

    document.getElementById('eraser-mode').addEventListener('click', () => {
      if (this.currentTool === 'eraser') {
        this.setActiveTool(null, '');
      } else {
        this.setActiveTool('eraser', '橡皮擦');
        this.brushColor = "#FFFFFF";
      }
    });

    document.getElementById('text-mode').addEventListener('click', () => {
      if (this.currentTool === 'text') {
        this.setActiveTool(null, '');
      } else {
        this.setActiveTool('text', '插入文字');
        this.brushColor = document.getElementById('brush-color').value;
      }
    });

    document.getElementById('brush-color').addEventListener('change', (e) => {
      this.brushColor = e.target.value;
      if (this.selectedTextElement) {
        this.selectedTextElement.color = this.brushColor;
        this.redrawAll();
        this.saveToHistory();
        this.markCanvasChanged();
      }
    });

    document.getElementById('brush-size').addEventListener('input', (e) => {
      this.updateBrushSize(e.target.value);
    });
    document.getElementById('brush-size-range').addEventListener('input', (e) => {
      this.updateBrushSize(e.target.value);
    });

    document.getElementById('font-size').addEventListener('input', (e) => this.updateSelectedTextFontSize(e.target.value, false));
    document.getElementById('font-size').addEventListener('change', (e) => this.updateSelectedTextFontSize(e.target.value, true));
    document.getElementById('font-size-range').addEventListener('input', (e) => this.updateSelectedTextFontSize(e.target.value, false));
    document.getElementById('font-size-range').addEventListener('change', (e) => this.updateSelectedTextFontSize(e.target.value, true));

    document.getElementById('add-text-btn').addEventListener('click', () => this.startTextPlacement());

    document.getElementById('todo-mode').addEventListener('click', () => {
      if (this.currentTool === 'todo') {
        this.setActiveTool(null, '');
      } else {
        this.setActiveTool('todo', '添加待办项');
        this.todoColor = document.getElementById('todo-color').value;
      }
    });

    document.getElementById('add-todo-btn').addEventListener('click', () => this.startTodoPlacement());

    document.getElementById('schedule-mode').addEventListener('click', () => {
      if (this.currentTool === 'schedule') {
        this.setActiveTool(null, '');
      } else {
        this.loadScheduleFromLocalStorage();
        this.setActiveTool('schedule', '生成课表');
      }
    });

    document.getElementById('create-schedule-btn').addEventListener('click', () => this.createSchedule());
    document.getElementById('schedule-input-confirm-btn').addEventListener('click', () => this.confirmScheduleInput());
    document.getElementById('schedule-input-cancel-btn').addEventListener('click', () => this.cancelScheduleInput());

    document.getElementById('todo-bold').addEventListener('click', () => {
      this.todoBold = !this.todoBold;
      document.getElementById('todo-bold').classList.toggle('primary', this.todoBold);
      this.updateSelectedTodoStyle(true);
    });

    document.getElementById('todo-italic').addEventListener('click', () => {
      this.todoItalic = !this.todoItalic;
      document.getElementById('todo-italic').classList.toggle('primary', this.todoItalic);
      this.updateSelectedTodoStyle(true);
    });

    document.getElementById('todo-color').addEventListener('change', (e) => {
      this.todoColor = e.target.value;
      if (this.selectedTodoItem) {
        this.selectedTodoItem.color = this.todoColor;
        this.redrawAll();
        this.saveToHistory();
        this.markCanvasChanged();
      }
    });

    document.getElementById('todo-font-size').addEventListener('input', (e) => this.updateSelectedTodoFontSize(e.target.value, false));
    document.getElementById('todo-font-size').addEventListener('change', (e) => this.updateSelectedTodoFontSize(e.target.value, true));
    document.getElementById('todo-font-size-range').addEventListener('input', (e) => this.updateSelectedTodoFontSize(e.target.value, false));
    document.getElementById('todo-font-size-range').addEventListener('change', (e) => this.updateSelectedTodoFontSize(e.target.value, true));
    document.getElementById('font-family').addEventListener('change', () => this.updateSelectedTextStyle(true));
    document.getElementById('todo-font-family').addEventListener('change', () => this.updateSelectedTodoStyle(true));

    document.getElementById('toggle-todo-delete-btn').addEventListener('click', () => {
      this.showTodoDeleteButtons = !this.showTodoDeleteButtons;
      document.getElementById('toggle-todo-delete-btn').classList.toggle('primary', this.showTodoDeleteButtons);
      if (this.todoItems.length > 0) {
        this.ensureBaseImageData();
        this.redrawAll();
        this.markCanvasChanged();
      }
    });

    document.getElementById('toggle-schedule-cell-indicator-btn').addEventListener('click', () => {
      this.showScheduleCellIndicator = !this.showScheduleCellIndicator;
      document.getElementById('toggle-schedule-cell-indicator-btn').classList.toggle('primary', this.showScheduleCellIndicator);
      if (this.scheduleData) this.redrawAll();
      this.markCanvasChanged();
    });

    document.getElementById('schedule-font-increase-btn').addEventListener('click', () => this.adjustScheduleFontSize(1));
    document.getElementById('schedule-font-decrease-btn').addEventListener('click', () => this.adjustScheduleFontSize(-1));
    document.getElementById('schedule-font-size').addEventListener('change', (e) => this.setScheduleFontSize(parseInt(e.target.value, 10)));
    document.getElementById('schedule-color').addEventListener('change', (e) => {
      this.scheduleColor = e.target.value;
      if (this.scheduleData) this.redrawAll();
      this.markCanvasChanged();
    });
    document.getElementById('schedule-font-family').addEventListener('change', (e) => {
      this.scheduleFontFamily = e.target.value;
      if (this.scheduleData) this.redrawAll();
      this.markCanvasChanged();
    });

    document.getElementById('schedule-move-up-btn').addEventListener('click', () => this.moveSchedule(0, -10));
    document.getElementById('schedule-move-down-btn').addEventListener('click', () => this.moveSchedule(0, 10));
    document.getElementById('schedule-move-left-btn').addEventListener('click', () => this.moveSchedule(-10, 0));
    document.getElementById('schedule-move-right-btn').addEventListener('click', () => this.moveSchedule(10, 0));
    document.getElementById('schedule-zoom-in-btn').addEventListener('click', () => this.zoomSchedule(5));
    document.getElementById('schedule-zoom-out-btn').addEventListener('click', () => this.zoomSchedule(-5));

    // Add event listeners for bold and italic buttons
    document.getElementById('text-bold').addEventListener('click', () => {
      this.textBold = !this.textBold;
      document.getElementById('text-bold').classList.toggle('primary', this.textBold);
      this.updateSelectedTextStyle(true);
    });

    document.getElementById('text-italic').addEventListener('click', () => {
      this.textItalic = !this.textItalic;
      document.getElementById('text-italic').classList.toggle('primary', this.textItalic);
      this.updateSelectedTextStyle(true);
    });

    // Add undo/redo button listeners
    document.getElementById('undo-btn').addEventListener('click', () => this.undo());
    document.getElementById('redo-btn').addEventListener('click', () => this.redo());

    this.canvas.addEventListener('mousedown', this.startPaint);
    this.canvas.addEventListener('mousemove', this.paint);
    this.canvas.addEventListener('mouseup', this.endPaint);
    this.canvas.addEventListener('mouseleave', this.endPaint);
    this.canvas.addEventListener('click', this.handleCanvasClick);

    // Touch support
    this.canvas.addEventListener('touchstart', this.onTouchStart);
    this.canvas.addEventListener('touchmove', this.onTouchMove);
    this.canvas.addEventListener('touchend', this.onTouchEnd);

    // Keyboard shortcuts for undo/redo
    document.addEventListener('keydown', this.handleKeyboard);

    // Mouse move for brush cursor
    this.canvas.addEventListener('mouseenter', this.updateBrushCursor);
    this.canvas.addEventListener('mousemove', this.updateBrushCursor);

    // Create brush cursor element
    this.createBrushCursor();

    // Initialize history with blank canvas state
    this.saveToHistory();
  }

  handleKeyboard(e) {
    // Ctrl+Z or Cmd+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    }
    // Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z for redo
    else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault();
      this.redo();
    }
  }

  setActiveTool(tool, title) {
    setCanvasTitle(title);
    this.currentTool = tool;

    this.canvas.parentNode.classList.toggle('brush-mode', this.currentTool === 'brush');
    this.canvas.parentNode.classList.toggle('eraser-mode', this.currentTool === 'eraser');
    this.canvas.parentNode.classList.toggle('text-mode', this.currentTool === 'text');
    this.canvas.parentNode.classList.toggle('todo-mode', this.currentTool === 'todo');
    this.canvas.parentNode.classList.toggle('schedule-mode', this.currentTool === 'schedule');

    document.getElementById('brush-mode').classList.toggle('active', this.currentTool === 'brush');
    document.getElementById('eraser-mode').classList.toggle('active', this.currentTool === 'eraser');
    document.getElementById('text-mode').classList.toggle('active', this.currentTool === 'text');
    document.getElementById('todo-mode').classList.toggle('active', this.currentTool === 'todo');
    document.getElementById('schedule-mode').classList.toggle('active', this.currentTool === 'schedule');

    document.getElementById('brush-color').disabled = this.currentTool === 'eraser' || this.currentTool === 'todo' || this.currentTool === 'schedule';
    document.getElementById('brush-size').disabled = this.currentTool === 'text' || this.currentTool === 'todo' || this.currentTool === 'schedule';

    document.getElementById('undo-btn').classList.toggle('hide', this.currentTool === null);
    document.getElementById('redo-btn').classList.toggle('hide', this.currentTool === null);

    // Cancel any pending text placement
    this.cancelTextPlacement();
    this.cancelTodoPlacement();
    this.cancelScheduleInput(false);

    if (this.hasOverlayElements()) {
      this.redrawAll();
    }
  }

  createBrushCursor() {
    // Create a div element to show as brush cursor
    this.brushCursor = document.createElement('div');
    this.brushCursor.id = 'brush-cursor';
    this.brushCursor.style.position = 'fixed';
    this.brushCursor.style.border = '2px solid rgba(0, 0, 0, 0.5)';
    this.brushCursor.style.borderRadius = '50%';
    this.brushCursor.style.pointerEvents = 'none';
    this.brushCursor.style.display = 'none';
    this.brushCursor.style.zIndex = '10000';
    this.brushCursor.style.transform = 'translate(-50%, -50%)';
    this.brushCursor.style.willChange = 'transform';
    this.brushCursor.style.left = '0';
    this.brushCursor.style.top = '0';
    document.body.appendChild(this.brushCursor);
    this.updateBrushCursorSize();

    // For requestAnimationFrame throttling
    this.cursorUpdateScheduled = false;
    this.pendingCursorX = 0;
    this.pendingCursorY = 0;
  }

  updateBrushCursorSize() {
    if (!this.brushCursor) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.canvas.width;
    const scaleY = rect.height / this.canvas.height;
    const scale = Math.min(scaleX, scaleY);

    const size = this.brushSize * scale;
    this.brushCursor.style.width = size + 'px';
    this.brushCursor.style.height = size + 'px';
  }

  updateBrushCursor(e) {
    if (!this.brushCursor) return;

    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      // Check if mouse is within canvas bounds
      const rect = this.canvas.getBoundingClientRect();
      const isInCanvas = e.clientX >= rect.left && 
                         e.clientX <= rect.right && 
                         e.clientY >= rect.top && 
                         e.clientY <= rect.bottom;

      if (isInCanvas) {
        this.brushCursor.style.display = 'block';
        this.canvas.style.cursor = 'none';

        // Store the pending position
        this.pendingCursorX = e.clientX;
        this.pendingCursorY = e.clientY;

        // Schedule update using requestAnimationFrame for smooth movement
        if (!this.cursorUpdateScheduled) {
          this.cursorUpdateScheduled = true;
          requestAnimationFrame(() => {
            this.brushCursor.style.transform = `translate(${this.pendingCursorX}px, ${this.pendingCursorY}px) translate(-50%, -50%)`;
            this.cursorUpdateScheduled = false;
          });
        }

        // Update color to match brush or show white for eraser (only needs to happen once or when tool changes)
        if (this.currentTool === 'eraser') {
          if (this.brushCursor.getAttribute('data-tool') !== 'eraser') {
            this.brushCursor.style.border = '2px solid rgba(255, 0, 0, 0.7)';
            this.brushCursor.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            this.brushCursor.style.boxShadow = 'none';
            this.brushCursor.setAttribute('data-tool', 'eraser');
          }
        } else {
          if (this.brushCursor.getAttribute('data-tool') !== 'brush') {
            // Use a contrasting border - white with black outline for visibility
            this.brushCursor.style.border = '1px solid white';
            this.brushCursor.style.boxShadow = '0 0 0 1px black, inset 0 0 0 1px black';
            this.brushCursor.style.backgroundColor = 'transparent';
            this.brushCursor.setAttribute('data-tool', 'brush');
          }
        }
      } else {
        // Hide cursor when outside canvas
        this.brushCursor.style.display = 'none';
      }
    }
  }

  hideBrushCursor() {
    if (this.brushCursor) {
      this.brushCursor.style.display = 'none';
    }
    this.canvas.style.cursor = 'default';
  }

  startPaint(e) {
    if (!this.currentTool) return;

    if (this.currentTool === 'text') {
      const textElement = this.findTextElementAt(e);
      if (textElement) {
        this.selectTextElement(textElement);
        this.isDraggingText = true;

        const point = this.getCanvasPoint(e);

        // Calculate offset for smooth dragging
        this.dragOffsetX = textElement.x - point.x;
        this.dragOffsetY = textElement.y - point.y;
        this.draggingCanvasContext = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        return; // Don't start drawing
      }
    } else if (this.currentTool === 'todo') {
      const deleteButtonTodo = this.findTodoDeleteButtonAt(e);
      if (deleteButtonTodo) {
        this.deleteTodoItem(deleteButtonTodo);
        return;
      }

      const todoItem = this.findTodoItemAt(e);
      if (todoItem) {
        this.selectTodoItem(todoItem);
        this.isDraggingText = true;

        const point = this.getCanvasPoint(e);
        this.dragOffsetX = todoItem.x - point.x;
        this.dragOffsetY = todoItem.y - point.y;
        this.draggingCanvasContext = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        return;
      }
    } else if (this.currentTool === 'schedule') {
      return;
    } else {
      this.painting = true;
      this.draw(e);
    }
  }

  endPaint() {
    if (this.isDraggingText) {
      if (this.selectedTodoItem) this.redrawAll();
      this.saveToHistory();
      this.markCanvasChanged();
    } else if (this.painting) {
      this.saveToHistory(); // Save state after drawing or dragging text
      this.markCanvasChanged();
    }
    this.painting = false;
    this.isDraggingText = false;
    this.lastX = 0;
    this.lastY = 0;

    this.hideBrushCursor();
  }

  paint(e) {
    if (!this.currentTool) return;

    if (this.currentTool === 'text') {
      if (this.isDraggingText && this.selectedTextElement) {
        this.dragText(e);
      }
    } else if (this.currentTool === 'todo') {
      if (this.isDraggingText && this.selectedTodoItem) {
        this.dragTodo(e);
      }
    } else {
      if (this.painting) {
        this.draw(e);
      }
    }
  }

  draw(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = this.brushColor;
    this.ctx.lineWidth = this.brushSize;

    this.ctx.beginPath();

    if (this.lastX === 0 && this.lastY === 0) {
      // For the first point, just do a dot
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + 0.1, y + 0.1);

      // Store the dot for redrawing
      this.lineSegments.push({
        type: 'dot',
        x: x,
        y: y,
        color: this.brushColor,
        size: this.brushSize
      });
    } else {
      // Connect to the previous point
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(x, y);

      // Store the line segment for redrawing
      this.lineSegments.push({
        type: 'line',
        x1: this.lastX,
        y1: this.lastY,
        x2: x,
        y2: y,
        color: this.brushColor,
        size: this.brushSize
      });
    }

    this.ctx.stroke();

    this.lastX = x;
    this.lastY = y;
  }

  handleCanvasClick(e) {
    if (this.currentTool === 'text' && this.isTextPlacementMode) {
      this.placeText(e);
    } else if (this.currentTool === 'todo' && this.isTodoPlacementMode) {
      this.placeTodo(e);
    } else if (this.currentTool === 'schedule') {
      const cell = this.getScheduleCellAt(e);
      if (cell) {
        this.selectedScheduleCell = cell;
        document.getElementById('schedule-input').value = this.scheduleData[cell.row][cell.col];
        if (this.scheduleCellFontSizes) {
          document.getElementById('schedule-font-size').value = this.scheduleCellFontSizes[cell.row][cell.col];
        }
        document.querySelector('.schedule-input-tools').style.display = 'flex';
        document.getElementById('schedule-input').focus();
        this.redrawAll();
      }
    }
  }

  onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];

    // If in text placement mode, handle as a click
    if ((this.currentTool === 'text' && this.isTextPlacementMode) ||
        (this.currentTool === 'todo' && this.isTodoPlacementMode) ||
        this.currentTool === 'schedule') {
      const mouseEvent = new MouseEvent('click', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
      return;
    }

    // Otherwise handle as normal drawing
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    this.canvas.dispatchEvent(mouseEvent);
  }

  onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    this.canvas.dispatchEvent(mouseEvent);
  }

  onTouchEnd(e) {
    e.preventDefault();
    this.endPaint();
  }

  dragText(e) {
    const point = this.getCanvasPoint(e);

    // Update text position with offset
    this.selectedTextElement.x = point.x + this.dragOffsetX;
    this.selectedTextElement.y = point.y + this.dragOffsetY;

    this.redrawAll();
  }

  findTextElementAt(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Search through text elements in reverse order (top-most first)
    for (let i = this.textElements.length - 1; i >= 0; i--) {
      const text = this.textElements[i];

      // Calculate text dimensions
      this.ctx.font = text.font;
      const textWidth = this.ctx.measureText(text.text).width;

      // Extract font size correctly from the font string
      const fontSizeMatch = text.font.match(/(\d+)px/);
      const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]) : 14;
      const textHeight = fontSize * 1.2; // Approximate height

      // Check if click is within text bounds (allowing for some margin)
      const margin = 5;
      if (x >= text.x - margin &&
        x <= text.x + textWidth + margin &&
        y >= text.y - textHeight + margin &&
        y <= text.y + margin) {
        return text;
      }
    }

    return null;
  }

  markCanvasChanged() {
    if (typeof resetDitherPreviewSource === 'function') {
      resetDitherPreviewSource();
    }
  }

  getCanvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  getTextMetrics(text, font) {
    this.ctx.font = font;
    const width = this.ctx.measureText(text).width;
    const fontSizeMatch = font.match(/(\d+)px/);
    const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1], 10) : 14;
    return { width, height: fontSize * 1.2, fontSize };
  }

  cloneImageData(imageData) {
    return new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );
  }

  ensureBaseImageData() {
    if (!this.scheduleBaseImageData) {
      this.scheduleBaseImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  setBaseImageData() {
    this.scheduleBaseImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  hasOverlayElements() {
    return this.lineSegments.length > 0 ||
      this.textElements.length > 0 ||
      this.todoItems.length > 0 ||
      !!this.scheduleData;
  }

  getFontParts(font) {
    const match = font.match(/^(.*?)(\d+)px\s+(.+)$/);
    if (!match) return { prefix: '', size: 16, family: 'Arial' };
    return {
      prefix: match[1],
      size: parseInt(match[2], 10),
      family: match[3]
    };
  }

  withFontSize(font, size) {
    const parts = this.getFontParts(font);
    return `${parts.prefix}${size}px ${parts.family}`;
  }

  buildFont(size, family, bold, italic) {
    let fontStyle = '';
    if (italic) fontStyle += 'italic ';
    if (bold) fontStyle += 'bold ';
    return `${fontStyle}${size}px ${family}`;
  }

  syncRangeAndNumber(numberId, rangeId, value) {
    const numberInput = document.getElementById(numberId);
    const rangeInput = document.getElementById(rangeId);
    if (numberInput) numberInput.value = value;
    if (rangeInput) rangeInput.value = value;
  }

  updateBrushSize(value) {
    const size = Math.max(1, Math.min(100, parseInt(value, 10) || 1));
    this.brushSize = size;
    this.syncRangeAndNumber('brush-size', 'brush-size-range', size);
    this.updateBrushCursorSize();
  }

  selectTextElement(textElement) {
    this.selectedTextElement = textElement;
    this.selectedTodoItem = null;
    const parts = this.getFontParts(textElement.font);
    document.getElementById('text-input').value = textElement.text;
    document.getElementById('font-family').value = parts.family;
    this.syncRangeAndNumber('font-size', 'font-size-range', parts.size);
    this.textBold = /\bbold\b/.test(textElement.font);
    this.textItalic = /\bitalic\b/.test(textElement.font);
    document.getElementById('text-bold').classList.toggle('primary', this.textBold);
    document.getElementById('text-italic').classList.toggle('primary', this.textItalic);
    this.brushColor = textElement.color;
    const brushColor = document.getElementById('brush-color');
    if ([...brushColor.options].some(option => option.value === textElement.color)) {
      brushColor.value = textElement.color;
    }
    setCanvasTitle('已选中文字，可拖动滑条调整大小');
  }

  selectTodoItem(todoItem) {
    this.selectedTodoItem = todoItem;
    this.selectedTextElement = null;
    const parts = this.getFontParts(todoItem.font);
    document.getElementById('todo-input').value = todoItem.text;
    document.getElementById('todo-font-family').value = parts.family;
    this.syncRangeAndNumber('todo-font-size', 'todo-font-size-range', parts.size);
    this.todoBold = /\bbold\b/.test(todoItem.font);
    this.todoItalic = /\bitalic\b/.test(todoItem.font);
    document.getElementById('todo-bold').classList.toggle('primary', this.todoBold);
    document.getElementById('todo-italic').classList.toggle('primary', this.todoItalic);
    this.todoColor = todoItem.color;
    document.getElementById('todo-color').value = todoItem.color;
    setCanvasTitle('已选中待办，可拖动滑条调整大小');
  }

  updateSelectedTextFontSize(value, commitHistory) {
    const size = Math.max(1, Math.min(100, parseInt(value, 10) || 16));
    this.syncRangeAndNumber('font-size', 'font-size-range', size);
    if (!this.selectedTextElement) return;
    this.selectedTextElement.font = this.buildFont(size, document.getElementById('font-family').value, this.textBold, this.textItalic);
    this.redrawAll();
    this.markCanvasChanged();
    if (commitHistory) this.saveToHistory();
  }

  updateSelectedTodoFontSize(value, commitHistory) {
    const size = Math.max(8, Math.min(80, parseInt(value, 10) || 16));
    this.syncRangeAndNumber('todo-font-size', 'todo-font-size-range', size);
    if (!this.selectedTodoItem) return;
    this.selectedTodoItem.font = this.buildFont(size, document.getElementById('todo-font-family').value, this.todoBold, this.todoItalic);
    this.redrawAll();
    this.markCanvasChanged();
    if (commitHistory) this.saveToHistory();
  }

  updateSelectedTextStyle(commitHistory) {
    if (!this.selectedTextElement) return;
    const size = parseInt(document.getElementById('font-size').value, 10) || this.getFontParts(this.selectedTextElement.font).size;
    this.selectedTextElement.font = this.buildFont(size, document.getElementById('font-family').value, this.textBold, this.textItalic);
    this.redrawAll();
    this.markCanvasChanged();
    if (commitHistory) this.saveToHistory();
  }

  updateSelectedTodoStyle(commitHistory) {
    if (!this.selectedTodoItem) return;
    const size = parseInt(document.getElementById('todo-font-size').value, 10) || this.getFontParts(this.selectedTodoItem.font).size;
    this.selectedTodoItem.font = this.buildFont(size, document.getElementById('todo-font-family').value, this.todoBold, this.todoItalic);
    this.redrawAll();
    this.markCanvasChanged();
    if (commitHistory) this.saveToHistory();
  }

  cancelTodoPlacement() {
    this.isTodoPlacementMode = false;
    if (this.canvas) this.canvas.classList.remove('text-placement-mode');
  }

  startTodoPlacement() {
    const todo = document.getElementById('todo-input').value.trim();
    if (!todo) {
      alert('请输入待办项内容');
      return;
    }

    this.isTodoPlacementMode = true;
    setCanvasTitle('点击画布放置待办项');
    this.canvas.classList.add('text-placement-mode');
  }

  placeTodo(e) {
    const point = this.getCanvasPoint(e);
    const todo = document.getElementById('todo-input').value;
    const fontSize = document.getElementById('todo-font-size').value;
    const fontFamily = document.getElementById('todo-font-family').value;

    this.ensureBaseImageData();

    let fontStyle = '';
    if (this.todoItalic) fontStyle += 'italic ';
    if (this.todoBold) fontStyle += 'bold ';

    const newTodo = {
      text: todo,
      x: point.x,
      y: point.y,
      font: `${fontStyle}${fontSize}px ${fontFamily}`,
      color: this.todoColor,
      completed: false
    };

    this.todoItems.push(newTodo);
    this.selectedTodoItem = newTodo;
    this.selectTodoItem(newTodo);
    this.redrawAll();
    this.saveToHistory();
    this.markCanvasChanged();

    document.getElementById('todo-input').value = '';
    this.cancelTodoPlacement();
    setCanvasTitle('拖动待办项可调整位置，点击文字可切换完成状态');
  }

  drawTodoItem(todoItem) {
    this.ctx.font = todoItem.font;
    this.ctx.fillStyle = todoItem.color;
    this.ctx.fillText(todoItem.text, todoItem.x, todoItem.y);

    const metrics = this.getTextMetrics(todoItem.text, todoItem.font);
    if (todoItem.completed) {
      this.ctx.strokeStyle = todoItem.color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(todoItem.x, todoItem.y - metrics.fontSize * 0.35);
      this.ctx.lineTo(todoItem.x + metrics.width, todoItem.y - metrics.fontSize * 0.35);
      this.ctx.stroke();
    }

    if (this.showTodoDeleteButtons) {
      todoItem.deleteButtonCenterX = todoItem.x + metrics.width + 12;
      todoItem.deleteButtonCenterY = todoItem.y - metrics.fontSize * 0.45;
      todoItem.deleteButtonHitRadius = 10;
      this.ctx.font = 'bold 14px Arial';
      this.ctx.fillStyle = '#FF0000';
      this.ctx.fillText('x', todoItem.deleteButtonCenterX - 4, todoItem.deleteButtonCenterY + 5);
    } else {
      todoItem.deleteButtonCenterX = null;
      todoItem.deleteButtonCenterY = null;
      todoItem.deleteButtonHitRadius = null;
    }
  }

  redrawTodoItems() {
    this.todoItems.forEach(item => this.drawTodoItem(item));
  }

  findTodoItemAt(e) {
    const point = this.getCanvasPoint(e);
    for (let i = this.todoItems.length - 1; i >= 0; i--) {
      const todo = this.todoItems[i];
      const metrics = this.getTextMetrics(todo.text, todo.font);
      const margin = 6;
      if (point.x >= todo.x - margin &&
        point.x <= todo.x + metrics.width + margin &&
        point.y >= todo.y - metrics.height + margin &&
        point.y <= todo.y + margin) {
        return todo;
      }
    }
    return null;
  }

  findTodoDeleteButtonAt(e) {
    if (!this.showTodoDeleteButtons) return null;
    const point = this.getCanvasPoint(e);
    for (let i = this.todoItems.length - 1; i >= 0; i--) {
      const todo = this.todoItems[i];
      if (!todo.deleteButtonHitRadius) continue;
      const dx = point.x - todo.deleteButtonCenterX;
      const dy = point.y - todo.deleteButtonCenterY;
      if (Math.sqrt(dx * dx + dy * dy) <= todo.deleteButtonHitRadius) {
        return todo;
      }
    }
    return null;
  }

  deleteTodoItem(todoItem) {
    const index = this.todoItems.indexOf(todoItem);
    if (index < 0) return;
    this.todoItems.splice(index, 1);
    this.redrawAll();
    this.saveToHistory();
    this.markCanvasChanged();
  }

  dragTodo(e) {
    const point = this.getCanvasPoint(e);
    this.selectedTodoItem.x = point.x + this.dragOffsetX;
    this.selectedTodoItem.y = point.y + this.dragOffsetY;

    this.redrawAll();
  }

  redrawAll() {
    if (this.scheduleBaseImageData) {
      this.ctx.putImageData(this.scheduleBaseImageData, 0, 0);
    } else {
      this.ctx.fillStyle = 'white';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.redrawLineSegments();
    this.redrawTextElements();
    this.redrawTodoItems();
    this.drawSchedule();
  }

  createSchedule() {
    this.scheduleDays = parseInt(document.getElementById('schedule-days').value, 10);
    this.scheduleClasses = parseInt(document.getElementById('schedule-classes').value, 10);
    this.scheduleFontFamily = document.getElementById('schedule-font-family').value;
    this.scheduleFontSize = parseInt(document.getElementById('schedule-font-size').value, 10);
    this.scheduleColor = document.getElementById('schedule-color').value;
    this.ensureBaseImageData();
    this.calculateScheduleDimensions();

    this.scheduleData = [];
    this.scheduleCellFontSizes = [];
    for (let row = 0; row <= this.scheduleClasses; row++) {
      this.scheduleData[row] = [];
      this.scheduleCellFontSizes[row] = [];
      for (let col = 0; col <= this.scheduleDays; col++) {
        this.scheduleCellFontSizes[row][col] = this.scheduleFontSize;
        if (row === 0 && col === 0) this.scheduleData[row][col] = '';
        else if (row === 0) this.scheduleData[row][col] = this.weekDays[col - 1];
        else if (col === 0) this.scheduleData[row][col] = `第${row}节`;
        else this.scheduleData[row][col] = '';
      }
    }

    this.redrawAll();
    this.saveScheduleToLocalStorage();
    this.saveToHistory();
    this.markCanvasChanged();
  }

  calculateScheduleDimensions() {
    const padding = Math.max(8, Math.floor(Math.min(this.canvas.width, this.canvas.height) * 0.04));
    const availableWidth = this.canvas.width - padding * 2;
    const availableHeight = this.canvas.height - padding * 2;
    this.scheduleCellWidth = Math.max(30, Math.floor(availableWidth / (this.scheduleDays + 1)));
    this.scheduleCellHeight = Math.max(20, Math.floor(availableHeight / (this.scheduleClasses + 1)));
    this.scheduleStartX = padding;
    this.scheduleStartY = padding;
  }

  drawSchedule() {
    if (!this.scheduleData) return;

    const cellWidth = this.scheduleCellWidth;
    const cellHeight = this.scheduleCellHeight;
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1;

    for (let row = 0; row < this.scheduleData.length; row++) {
      for (let col = 0; col < this.scheduleData[row].length; col++) {
        const x = this.scheduleStartX + col * cellWidth;
        const y = this.scheduleStartY + row * cellHeight;
        this.ctx.strokeRect(x, y, cellWidth, cellHeight);

        const text = this.scheduleData[row][col];
        if (!text) continue;

        const fontSize = this.scheduleCellFontSizes && this.scheduleCellFontSizes[row]
          ? this.scheduleCellFontSizes[row][col]
          : this.scheduleFontSize;
        this.ctx.font = `${fontSize}px ${this.scheduleFontFamily}`;
        this.ctx.fillStyle = this.scheduleColor;

        const lines = text.split('\n');
        const lineHeight = fontSize * 1.2;
        const textStartY = y + (cellHeight - lines.length * lineHeight) / 2 + fontSize * 0.85;
        lines.forEach((line, lineIndex) => {
          const textX = x + (cellWidth - this.ctx.measureText(line).width) / 2;
          this.ctx.fillText(line, textX, textStartY + lineIndex * lineHeight);
        });
      }
    }

    if (this.showScheduleCellIndicator && this.selectedScheduleCell) {
      const x = this.scheduleStartX + this.selectedScheduleCell.col * cellWidth;
      const y = this.scheduleStartY + this.selectedScheduleCell.row * cellHeight;
      this.ctx.fillStyle = '#000000';
      this.ctx.beginPath();
      this.ctx.arc(x + cellWidth - 6, y + 6, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  getScheduleCellAt(e) {
    if (!this.scheduleData) return null;
    const point = this.getCanvasPoint(e);
    const col = Math.floor((point.x - this.scheduleStartX) / this.scheduleCellWidth);
    const row = Math.floor((point.y - this.scheduleStartY) / this.scheduleCellHeight);
    if (row >= 0 && col >= 0 && row <= this.scheduleClasses && col <= this.scheduleDays) {
      return { row, col };
    }
    return null;
  }

  confirmScheduleInput() {
    if (!this.selectedScheduleCell) return;
    const { row, col } = this.selectedScheduleCell;
    this.scheduleData[row][col] = document.getElementById('schedule-input').value;
    this.cancelScheduleInput(false);
    this.redrawAll();
    this.saveScheduleToLocalStorage();
    this.saveToHistory();
    this.markCanvasChanged();
  }

  cancelScheduleInput(redraw = true) {
    const inputTools = document.querySelector('.schedule-input-tools');
    if (inputTools) inputTools.style.display = 'none';
    const scheduleInput = document.getElementById('schedule-input');
    if (scheduleInput) scheduleInput.value = '';
    this.selectedScheduleCell = null;
    if (redraw && this.scheduleData) this.redrawAll();
  }

  adjustScheduleFontSize(delta) {
    const nextValue = parseInt(document.getElementById('schedule-font-size').value, 10) + delta;
    this.setScheduleFontSize(nextValue);
  }

  setScheduleFontSize(value) {
    const fontSize = Math.max(6, Math.min(32, Number.isFinite(value) ? value : this.scheduleFontSize));
    document.getElementById('schedule-font-size').value = fontSize;

    if (this.selectedScheduleCell && this.scheduleCellFontSizes) {
      const { row, col } = this.selectedScheduleCell;
      this.scheduleCellFontSizes[row][col] = fontSize;
    } else {
      this.scheduleFontSize = fontSize;
    }

    if (this.scheduleData) {
      this.redrawAll();
      this.saveScheduleToLocalStorage();
      this.markCanvasChanged();
    }
  }

  moveSchedule(dx, dy) {
    if (!this.scheduleData) return;
    const tableWidth = (this.scheduleDays + 1) * this.scheduleCellWidth;
    const tableHeight = (this.scheduleClasses + 1) * this.scheduleCellHeight;
    this.scheduleStartX = Math.max(0, Math.min(this.canvas.width - tableWidth, this.scheduleStartX + dx));
    this.scheduleStartY = Math.max(0, Math.min(this.canvas.height - tableHeight, this.scheduleStartY + dy));
    this.redrawAll();
    this.saveScheduleToLocalStorage();
    this.markCanvasChanged();
  }

  zoomSchedule(delta) {
    if (!this.scheduleData) return;
    this.scheduleCellWidth = Math.max(24, Math.min(220, this.scheduleCellWidth + delta));
    this.scheduleCellHeight = Math.max(18, Math.min(120, this.scheduleCellHeight + delta));
    this.moveSchedule(0, 0);
  }

  saveScheduleToLocalStorage() {
    try {
      localStorage.setItem('scheduleCache', JSON.stringify({
        scheduleData: this.scheduleData,
        scheduleDays: this.scheduleDays,
        scheduleClasses: this.scheduleClasses,
        scheduleFontFamily: this.scheduleFontFamily,
        scheduleFontSize: this.scheduleFontSize,
        scheduleColor: this.scheduleColor,
        scheduleStartX: this.scheduleStartX,
        scheduleStartY: this.scheduleStartY,
        scheduleCellWidth: this.scheduleCellWidth,
        scheduleCellHeight: this.scheduleCellHeight,
        scheduleCellFontSizes: this.scheduleCellFontSizes
      }));
    } catch (e) {
      console.error('Failed to save schedule cache:', e);
    }
  }

  loadScheduleFromLocalStorage() {
    try {
      const savedData = localStorage.getItem('scheduleCache');
      if (!savedData) return false;
      const scheduleCache = JSON.parse(savedData);
      this.scheduleData = scheduleCache.scheduleData;
      this.scheduleDays = scheduleCache.scheduleDays || this.scheduleDays;
      this.scheduleClasses = scheduleCache.scheduleClasses || this.scheduleClasses;
      this.scheduleFontFamily = scheduleCache.scheduleFontFamily || this.scheduleFontFamily;
      this.scheduleFontSize = scheduleCache.scheduleFontSize || this.scheduleFontSize;
      this.scheduleColor = scheduleCache.scheduleColor || this.scheduleColor;
      this.scheduleStartX = scheduleCache.scheduleStartX || this.scheduleStartX;
      this.scheduleStartY = scheduleCache.scheduleStartY || this.scheduleStartY;
      this.scheduleCellWidth = scheduleCache.scheduleCellWidth || this.scheduleCellWidth;
      this.scheduleCellHeight = scheduleCache.scheduleCellHeight || this.scheduleCellHeight;
      this.scheduleCellFontSizes = scheduleCache.scheduleCellFontSizes || null;
      if (this.scheduleData) this.redrawAll();
      return !!this.scheduleData;
    } catch (e) {
      console.error('Failed to load schedule cache:', e);
      return false;
    }
  }

  clearScheduleCache() {
    try {
      localStorage.removeItem('scheduleCache');
    } catch (e) {
      console.error('Failed to clear schedule cache:', e);
    }
  }

  startTextPlacement() {
    const text = document.getElementById('text-input').value.trim();
    if (!text) {
      alert('请输入文字内容');
      return;
    }

    this.isTextPlacementMode = true;

    // Add visual feedback
    setCanvasTitle('点击画布放置文字');
    this.canvas.classList.add('text-placement-mode');
  }

  cancelTextPlacement() {
    this.isTextPlacementMode = false;
    this.canvas.classList.remove('text-placement-mode');

    // reset dragging state
    this.isDraggingText = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.selectedTextElement = null;
    this.draggingCanvasContext = null;
  }

  placeText(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const text = document.getElementById('text-input').value;
    const fontFamily = document.getElementById('font-family').value;
    const fontSize = document.getElementById('font-size').value;

    // Build font style string
    let fontStyle = '';
    if (this.textItalic) fontStyle += 'italic ';
    if (this.textBold) fontStyle += 'bold ';

    // Create a new text element
    const newText = {
      text: text,
      x: x,
      y: y,
      font: `${fontStyle}${fontSize}px ${fontFamily}`,
      color: this.brushColor
    };

    // Add to our list of text elements
    this.textElements.push(newText);

    // Select this text element for immediate dragging
    this.selectedTextElement = newText;
    this.selectTextElement(newText);
    this.ensureBaseImageData();
    this.draggingCanvasContext = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    this.redrawAll();

    // Save to history after placing text
    this.saveToHistory();
    this.markCanvasChanged();

    // Reset
    document.getElementById('text-input').value = '';
    this.isTextPlacementMode = false;
    this.canvas.classList.remove('text-placement-mode');
    setCanvasTitle('拖动新添加文字可调整位置');
  }

  redrawTextElements() {
    // Redraw all text elements after dithering
    this.textElements.forEach(item => {
      this.ctx.font = item.font;
      this.ctx.fillStyle = item.color;
      this.ctx.fillText(item.text, item.x, item.y);
    });
  }

  redrawLineSegments() {
    // Redraw all line segments after dithering
    this.lineSegments.forEach(segment => {
      this.ctx.lineJoin = 'round';
      this.ctx.lineCap = 'round';
      this.ctx.strokeStyle = segment.color;
      this.ctx.lineWidth = segment.size;
      this.ctx.beginPath();

      if (segment.type === 'dot') {
        this.ctx.moveTo(segment.x, segment.y);
        this.ctx.lineTo(segment.x + 0.1, segment.y + 0.1);
      } else {
        this.ctx.moveTo(segment.x1, segment.y1);
        this.ctx.lineTo(segment.x2, segment.y2);
      }

      this.ctx.stroke();
    });
  }

  clearElements() {
    this.textElements = [];
    this.lineSegments = [];
    this.todoItems = [];
    this.scheduleData = null;
    this.scheduleCellFontSizes = null;
    this.scheduleBaseImageData = null;
    this.selectedTextElement = null;
    this.selectedTodoItem = null;
  }
}
