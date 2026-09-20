(function () {
  'use strict';

  var MAX_FRAMES = 1024;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    status: $('status'), start: $('start'), dropzone: $('dropzone'), fileInput: $('fileInput'),
    sampleBtn: $('sampleBtn'), workspace: $('workspace'),
    gridFields: $('gridFields'), sizeFields: $('sizeFields'),
    cols: $('cols'), rows: $('rows'), frameW: $('frameW'), frameH: $('frameH'),
    margin: $('margin'), spacing: $('spacing'), manifest: $('manifest'),
    summary: $('summary'), exportBtn: $('exportBtn'), newBtn: $('newBtn'),
    sheet: $('sheet'), frames: $('frames'),
    inspect: $('inspect'), inspectInfo: $('inspectInfo'), downloadFrameBtn: $('downloadFrameBtn')
  };

  var state = {
    img: null,
    name: 'spritesheet',
    mode: 'grid',
    layout: null,      // last valid layout: { frames, cols, rows, fw, fh }
    selected: -1
  };

  /* ---------- helpers ---------- */

  function setStatus(msg, isError) {
    els.status.textContent = msg || '';
    els.status.classList.toggle('error', !!isError);
  }

  function intOf(input) {
    var n = parseInt(input.value, 10);
    return isNaN(n) ? 0 : n;
  }

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) { s = '0' + s; }
    return s;
  }

  function frameFileName(index) {
    var width = Math.max(3, String(state.layout ? state.layout.frames.length : 3).length);
    return state.name + '_' + pad(index + 1, width) + '.png';
  }

  function frameCanvas(f) {
    var c = document.createElement('canvas');
    c.width = f.w;
    c.height = f.h;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(state.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    return c;
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) { resolve(blob); } else { reject(new Error('Could not encode a frame as PNG.')); }
      }, 'image/png');
    });
  }

  function download(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* ---------- loading images ---------- */

  function loadFile(file) {
    if (!file) { return; }
    if (!/^image\//.test(file.type)) {
      setStatus('That file is not an image. Choose a PNG, JPG, GIF or WebP file.', true);
      return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      setImage(img, file.name.replace(/\.[^.]+$/, '') || 'spritesheet');
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      setStatus('That image could not be read. Try a different file.', true);
    };
    img.src = url;
  }

  function setImage(img, name, defaults) {
    var W = img.naturalWidth, H = img.naturalHeight;
    state.img = img;
    state.name = name.replace(/[^\w\-]+/g, '_') || 'spritesheet';
    state.selected = -1;

    defaults = defaults || {};
    els.cols.value = defaults.cols || 4;
    els.rows.value = defaults.rows || 4;
    els.frameW.value = defaults.frameW || Math.min(32, W);
    els.frameH.value = defaults.frameH || Math.min(32, H);
    els.margin.value = 0;
    els.spacing.value = 0;
    setMode('grid');

    els.sheet.width = W;
    els.sheet.height = H;

    els.start.hidden = true;
    els.workspace.hidden = false;
    fitSheet();
    setStatus('Loaded ' + state.name + ' (' + W + ' x ' + H + ' px). Adjust the settings to line the grid up with your frames.');
    update();
  }

  /* ---------- slicing ---------- */

  function computeLayout() {
    var W = state.img.naturalWidth, H = state.img.naturalHeight;
    var m = Math.max(0, intOf(els.margin));
    var sp = Math.max(0, intOf(els.spacing));
    var cols, rows, fw, fh;

    if (state.mode === 'grid') {
      cols = intOf(els.cols);
      rows = intOf(els.rows);
      if (cols < 1 || rows < 1) { return { error: 'Columns and rows must both be at least 1.' }; }
      fw = Math.floor((W - 2 * m - sp * (cols - 1)) / cols);
      fh = Math.floor((H - 2 * m - sp * (rows - 1)) / rows);
    } else {
      fw = intOf(els.frameW);
      fh = intOf(els.frameH);
      if (fw < 1 || fh < 1) { return { error: 'Frame width and height must both be at least 1.' }; }
      cols = Math.floor((W - 2 * m + sp) / (fw + sp));
      rows = Math.floor((H - 2 * m + sp) / (fh + sp));
    }

    if (fw < 1 || fh < 1 || cols < 1 || rows < 1) {
      return { error: 'These settings leave no room for frames. Lower the margin, the spacing or the frame count.' };
    }
    if (cols * rows > MAX_FRAMES) {
      return { error: 'That would make ' + (cols * rows) + ' frames. The limit is ' + MAX_FRAMES + '.' };
    }

    var frames = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        frames.push({
          index: frames.length, row: r, col: c,
          x: m + c * (fw + sp), y: m + r * (fh + sp), w: fw, h: fh
        });
      }
    }
    return { frames: frames, cols: cols, rows: rows, fw: fw, fh: fh };
  }

  function setMode(mode) {
    state.mode = mode;
    var radios = document.querySelectorAll('input[name="mode"]');
    for (var i = 0; i < radios.length; i++) { radios[i].checked = radios[i].value === mode; }
    els.gridFields.hidden = mode !== 'grid';
    els.sizeFields.hidden = mode !== 'size';
  }

  function update() {
    if (!state.img) { return; }
    var result = computeLayout();

    if (result.error) {
      state.layout = null;
      state.selected = -1;
      els.summary.textContent = result.error;
      els.summary.classList.add('error');
      els.exportBtn.disabled = true;
      els.frames.textContent = '';
      drawSheet();
      renderInspector();
      return;
    }

    state.layout = result;
    els.summary.classList.remove('error');
    els.summary.textContent = result.frames.length + ' frames (' + result.cols + ' x ' + result.rows + '), each ' + result.fw + ' x ' + result.fh + ' px';
    els.exportBtn.disabled = false;
    if (state.selected >= result.frames.length) { state.selected = -1; }

    drawSheet();
    renderThumbs();
    renderInspector();
  }

  /* ---------- drawing ---------- */

  function fitSheet() {
    var canvas = els.sheet;
    if (!state.img) { return; }
    var wrap = canvas.parentElement;
    var avail = wrap.clientWidth;
    var W = canvas.width;
    if (avail > 0 && W < avail) {
      // Small sheets are shown at a whole-number zoom so pixel art stays crisp.
      canvas.style.width = (W * Math.max(1, Math.floor(avail / W))) + 'px';
    } else {
      canvas.style.width = '100%';
    }
  }

  function drawSheet() {
    var canvas = els.sheet;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(state.img, 0, 0);

    if (!state.layout) { return; }
    var line = Math.max(1, Math.round(W / 700));
    var frames = state.layout.frames;

    if (state.selected >= 0) {
      var s = frames[state.selected];
      ctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }

    ctx.lineWidth = line;
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.95)';
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      ctx.strokeRect(f.x + line / 2, f.y + line / 2, Math.max(1, f.w - line), Math.max(1, f.h - line));
    }

    if (state.selected >= 0) {
      var sel = frames[state.selected];
      ctx.lineWidth = line * 2;
      ctx.strokeStyle = '#fbbf24';
      ctx.strokeRect(sel.x + line, sel.y + line, Math.max(1, sel.w - line * 2), Math.max(1, sel.h - line * 2));
    }
  }

  function renderThumbs() {
    var frag = document.createDocumentFragment();
    state.layout.frames.forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb' + (f.index === state.selected ? ' selected' : '');
      btn.setAttribute('aria-label', 'Frame ' + (f.index + 1) + ', row ' + (f.row + 1) + ', column ' + (f.col + 1));
      btn.dataset.index = String(f.index);
      var n = document.createElement('span');
      n.className = 'n';
      n.textContent = String(f.index + 1);
      btn.appendChild(frameCanvas(f));
      btn.appendChild(n);
      frag.appendChild(btn);
    });
    els.frames.textContent = '';
    els.frames.appendChild(frag);
  }

  function renderInspector() {
    var canvas = els.inspect;
    var ctx = canvas.getContext('2d');

    if (!state.layout || state.selected < 0) {
      canvas.width = 1;
      canvas.height = 1;
      ctx.clearRect(0, 0, 1, 1);
      canvas.style.width = '1px';
      els.inspectInfo.textContent = 'Click a frame to inspect it.';
      els.downloadFrameBtn.disabled = true;
      return;
    }

    var f = state.layout.frames[state.selected];
    canvas.width = f.w;
    canvas.height = f.h;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, f.w, f.h);
    ctx.drawImage(state.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    var scale = Math.max(1, Math.floor(240 / Math.max(f.w, f.h)));
    canvas.style.width = (f.w * scale) + 'px';
    els.inspectInfo.textContent = 'Frame ' + (f.index + 1) + ' of ' + state.layout.frames.length +
      ' (row ' + (f.row + 1) + ', column ' + (f.col + 1) + ') at x ' + f.x + ', y ' + f.y + ', ' + f.w + ' x ' + f.h + ' px';
    els.downloadFrameBtn.disabled = false;
  }

  function select(index) {
    if (!state.layout) { return; }
    state.selected = index;
    var thumbs = els.frames.children;
    for (var i = 0; i < thumbs.length; i++) {
      thumbs[i].classList.toggle('selected', i === index);
    }
    drawSheet();
    renderInspector();
  }

  /* ---------- export ---------- */

  function downloadSelectedFrame() {
    if (!state.layout || state.selected < 0) { return; }
    var f = state.layout.frames[state.selected];
    toBlob(frameCanvas(f)).then(function (blob) {
      download(blob, frameFileName(f.index));
    }).catch(function (err) { setStatus(err.message, true); });
  }

  async function exportZip() {
    if (!state.layout) { return; }
    if (typeof JSZip === 'undefined') {
      setStatus('The ZIP library could not be loaded. Check your internet connection and reload the page.', true);
      return;
    }
    els.exportBtn.disabled = true;
    try {
      var zip = new JSZip();
      var frames = state.layout.frames;
      for (var i = 0; i < frames.length; i++) {
        var blob = await toBlob(frameCanvas(frames[i]));
        zip.file(frameFileName(i), blob);
        if (i % 16 === 0) {
          setStatus('Packing frame ' + (i + 1) + ' of ' + frames.length + '...');
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      }
      if (els.manifest.checked) {
        var manifest = {
          source: state.name,
          sheetWidth: state.img.naturalWidth,
          sheetHeight: state.img.naturalHeight,
          frameWidth: state.layout.fw,
          frameHeight: state.layout.fh,
          columns: state.layout.cols,
          rows: state.layout.rows,
          frames: frames.map(function (f) {
            return { file: frameFileName(f.index), index: f.index, row: f.row, col: f.col, x: f.x, y: f.y, w: f.w, h: f.h };
          })
        };
        zip.file('frames.json', JSON.stringify(manifest, null, 2));
      }
      setStatus('Creating ZIP file...');
      var content = await zip.generateAsync({ type: 'blob' });
      download(content, state.name + '_frames.zip');
      setStatus('Exported ' + frames.length + ' frames to ' + state.name + '_frames.zip.');
    } catch (err) {
      setStatus('Export failed: ' + err.message, true);
    } finally {
      els.exportBtn.disabled = !state.layout;
    }
  }

  /* ---------- sample sheet ---------- */

  function makeSample() {
    var cols = 4, rows = 2, fw = 64, fh = 64;
    var c = document.createElement('canvas');
    c.width = cols * fw;
    c.height = rows * fh;
    var ctx = c.getContext('2d');

    for (var i = 0; i < cols * rows; i++) {
      var cx = (i % cols) * fw + fw / 2;
      var top = Math.floor(i / cols) * fh;
      var t = i / (cols * rows - 1);
      var height = 4 * t * (1 - t);          // 0 on the ground, 1 at the top of the bounce
      var squash = 1 - height;               // 1 on the ground, 0 at the top
      var rx = 13 + squash * 6;
      var ry = 13 - squash * 5;
      var ground = top + 54;
      var cy = ground - ry - height * 26;

      ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.15 + squash * 0.25) + ')';
      ctx.beginPath();
      ctx.ellipse(cx, ground + 2, 10 + squash * 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#2dd4bf';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.35, cy - ry * 0.4, rx * 0.25, ry * 0.2, -0.5, 0, Math.PI * 2);
      ctx.fill();

    }

    var img = new Image();
    img.onload = function () { setImage(img, 'sample-bounce', { cols: cols, rows: rows, frameW: fw, frameH: fh }); };
    img.src = c.toDataURL('image/png');
  }

  /* ---------- events ---------- */

  els.dropzone.addEventListener('click', function () { els.fileInput.click(); });
  els.fileInput.addEventListener('change', function () {
    loadFile(els.fileInput.files[0]);
    els.fileInput.value = '';
  });
  els.sampleBtn.addEventListener('click', makeSample);
  els.newBtn.addEventListener('click', function () {
    state.img = null;
    state.layout = null;
    els.workspace.hidden = true;
    els.start.hidden = false;
    setStatus('');
  });

  ['cols', 'rows', 'frameW', 'frameH', 'margin', 'spacing'].forEach(function (id) {
    els[id].addEventListener('input', update);
  });

  var radios = document.querySelectorAll('input[name="mode"]');
  Array.prototype.forEach.call(radios, function (radio) {
    radio.addEventListener('change', function () {
      // Carry the current layout over so switching modes keeps the same grid.
      if (state.layout) {
        els.cols.value = state.layout.cols;
        els.rows.value = state.layout.rows;
        els.frameW.value = state.layout.fw;
        els.frameH.value = state.layout.fh;
      }
      setMode(radio.value);
      update();
    });
  });

  els.frames.addEventListener('click', function (e) {
    var btn = e.target.closest('.thumb');
    if (btn) { select(parseInt(btn.dataset.index, 10)); }
  });

  els.sheet.addEventListener('click', function (e) {
    if (!state.layout) { return; }
    var rect = els.sheet.getBoundingClientRect();
    var px = (e.clientX - rect.left) * (els.sheet.width / rect.width);
    var py = (e.clientY - rect.top) * (els.sheet.height / rect.height);
    var frames = state.layout.frames;
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (px >= f.x && px < f.x + f.w && py >= f.y && py < f.y + f.h) { select(i); return; }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!state.layout || state.selected < 0) { return; }
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT') { return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      var step = e.key === 'ArrowRight' ? 1 : -1;
      var n = state.layout.frames.length;
      select((state.selected + step + n) % n);
      els.frames.children[state.selected].focus();
      e.preventDefault();
    }
  });

  window.addEventListener('resize', fitSheet);
  els.exportBtn.addEventListener('click', exportZip);
  els.downloadFrameBtn.addEventListener('click', downloadSelectedFrame);

  // Drag and drop anywhere on the page
  ['dragenter', 'dragover'].forEach(function (evt) {
    window.addEventListener(evt, function (e) {
      e.preventDefault();
      els.dropzone.classList.add('drag');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    window.addEventListener(evt, function (e) {
      e.preventDefault();
      els.dropzone.classList.remove('drag');
    });
  });
  window.addEventListener('drop', function (e) {
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    loadFile(file);
  });
})();
