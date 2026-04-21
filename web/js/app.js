var currentBrand = 'MARD';
var canvas, ctx;
var beadSize = 20;
var margin = 35;
var transparentPattern = null;
var zoomLevel = 1;
var originalCanvasWidth = 0;
var originalCanvasHeight = 0;
var gridMarkEnabled = false;
var gridMarkInterval = 5;
var spacePressed = false;
var isDragging = false;
var dragStartX = 0;
var dragStartY = 0;
var scrollLeft = 0;
var scrollTop = 0;
var canvasContainer = null;
var color_mapping = {};
var BRANDS = ['MARD', 'COCO', '漫漫', '盼盼', '咪小兔'];
var paletteBrand = 'MARD'; // 编辑面板独立的品牌选择
var selectedColor = null; // 当前选中的编辑颜色
var isEditMode = false; // 编辑模式开关

function populateBrandSelects() {
  var brandSelect = document.getElementById('brandSelect');
  var paletteSelect = document.getElementById('paletteBrandSelect');
  var html = '';
  BRANDS.forEach(function (b) {
    html += '<option value="' + b + '">' + b + '</option>';
  });
  if (brandSelect) brandSelect.innerHTML = html;
  if (paletteSelect) paletteSelect.innerHTML = html;
}
populateBrandSelects();
var MAX_HISTORY = 5;
var historyStack = [];
var redoStack = [];

// 批量绘制状态
var isBatchMode = false;
var isBatchPainting = false;
var batchPositions = []; // 当前批量绘制中所有被修改的格子
var batchPaintedSet = new Set(); // 去重，避免同一格重复记录
var colorsLoaded = false;
var legendBarCollapsed = false;

var cropModal, pixelAlignModal, confirmModal, previewModal;
var cropperInstance = null;
var currentCropFile = null;
var currentAlignFile = null;
var currentCropMode = 'normal'; // 'normal' | 'pixel'
var confirmCallback = null;
var showCode = false;

document.addEventListener('DOMContentLoaded', function () {
  cropModal = new bootstrap.Modal(document.getElementById('cropModal'));
  pixelAlignModal = new bootstrap.Modal(document.getElementById('pixelAlignModal'));
  confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
  previewModal = new bootstrap.Modal(document.getElementById('previewModal'));
});

function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toastContainer');
  var toast = document.createElement('div');
  toast.className = 'custom-toast ' + type;
  var iconClass =
    type === 'success' ? 'bi-check-circle-fill' : type === 'error' ? 'bi-x-circle-fill' : 'bi-info-circle-fill';
  toast.innerHTML = '<i class="bi ' + iconClass + '"></i><span>' + message + '</span>';
  container.appendChild(toast);
  setTimeout(function () {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3000);
}

function showConfirm(message, onConfirm) {
  document.getElementById('confirmModalBody').textContent = message;
  confirmCallback = onConfirm;
  confirmModal.show();
}

document.getElementById('confirmModalYes').addEventListener('click', function () {
  if (confirmCallback) confirmCallback();
  confirmModal.hide();
});

fetch('/colors')
  .then(function (response) {
    return response.json();
  })
  .then(function (data) {
    color_mapping = data;
    colorsLoaded = true;
  })
  .catch(function (error) {
    showToast('加载颜色数据失败: ' + error.message, 'error');
  });

// 加载可用模型列表
(function loadModels() {
  var select = document.getElementById('bgModelSelect');
  var descDiv = document.getElementById('bgModelDesc');
  if (!select) {
    console.error('bgModelSelect not found');
    return;
  }

  function setFallback() {
    select.innerHTML = '<option value="u2net">U2-Net 通用</option>';
    if (descDiv) descDiv.textContent = '通用场景分割模型 (离线默认)';
  }

  // 5秒超时保护
  var timeoutId = setTimeout(function () {
    console.warn('模型列表加载超时，使用默认模型');
    setFallback();
  }, 5000);

  fetch('/api/models')
    .then(function (response) {
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (data) {
      if (!data.models || data.models.length === 0) {
        setFallback();
        return;
      }
      select.innerHTML = '';
      data.models.forEach(function (model) {
        var opt = document.createElement('option');
        opt.value = model.name;
        opt.textContent = model.label;
        if (model.name === data.default) opt.selected = true;
        select.appendChild(opt);
      });
      function updateDesc() {
        var selected = null;
        for (var i = 0; i < data.models.length; i++) {
          if (data.models[i].name === select.value) {
            selected = data.models[i];
            break;
          }
        }
        if (selected && descDiv) {
          var tagsHtml = '';
          if (selected.tags && selected.tags.length) {
            for (var j = 0; j < selected.tags.length; j++) {
              tagsHtml +=
                '<span class="badge bg-secondary" style="font-size:10px;font-weight:400;margin-right:3px;">' +
                selected.tags[j] +
                '</span>';
            }
          }
          descDiv.innerHTML =
            (selected.desc || '') +
            ' ' +
            tagsHtml +
            ' <span style="color:#999">' +
            (selected.size_mb || '') +
            '</span>';
        }
      }
      select.addEventListener('change', updateDesc);
      updateDesc();
      console.log('模型列表加载成功:', data.models.length, '个模型');
    })
    .catch(function (error) {
      clearTimeout(timeoutId);
      console.error('模型列表加载失败:', error);
      setFallback();
    });
})();

function bindSlider(rangeId, numberId, callback) {
  var range = document.getElementById(rangeId);
  var number = document.getElementById(numberId);
  range.addEventListener('input', function () {
    number.value = this.value;
    if (callback) callback(this.value);
  });
  number.addEventListener('input', function () {
    var val = parseInt(this.value);
    var min = parseInt(range.min);
    var max = parseInt(range.max);
    if (isNaN(val)) return;
    if (val < min) val = min;
    if (val > max) val = max;
    this.value = val;
    range.value = val;
    if (callback) callback(val);
  });
}

bindSlider('gridSizeRange', 'gridSize');
bindSlider('colorSimplifyRange', 'colorSimplify');
bindSlider('linesEnhanceRange', 'linesEnhance');
bindSlider('removeBgThresholdRange', 'removeBgThreshold');
bindSlider('gridMarkIntervalRange', 'gridMarkInterval', function (val) {
  gridMarkInterval = parseInt(val);
  if (gridMarkEnabled) drawGrid();
});

// 标识线pill 开关
document.getElementById('gridMarkPill').addEventListener('click', function () {
  gridMarkEnabled = !gridMarkEnabled;
  var pill = document.getElementById('gridMarkPill');
  var sliderWrap = document.getElementById('gridMarkSliderWrap');
  if (gridMarkEnabled) {
    pill.classList.add('active');
    sliderWrap.style.display = 'flex';
  } else {
    pill.classList.remove('active');
    sliderWrap.style.display = 'none';
  }
  drawGrid();
});

// 图例栏折叠
document.getElementById('legendBarHeader').addEventListener('click', function () {
  legendBarCollapsed = !legendBarCollapsed;
  var bar = document.getElementById('legendBar');
  var icon = document.getElementById('legendBarIcon');
  if (legendBarCollapsed) {
    bar.classList.add('collapsed');
    icon.style.transform = 'rotate(180deg)';
  } else {
    bar.classList.remove('collapsed');
    icon.style.transform = 'rotate(0deg)';
  }
});

// 拖拽上传
function setupDragUpload(zoneId, inputId) {
  var zone = document.getElementById(zoneId);
  var input = document.getElementById(inputId);

  zone.addEventListener('click', function (e) {
    if (e.target === zone || e.target.closest('.upload-zone') === zone) {
      input.click();
    }
  });

  zone.addEventListener('dragover', function (e) {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', function (e) {
    e.preventDefault();
    zone.classList.remove('drag-over');
    var files = e.dataTransfer.files;
    if (files && files[0]) {
      input.files = files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

setupDragUpload('uploadZone', 'imageInput');
setupDragUpload('pixelUploadZone', 'pixelUploadInput');

// 上传按钮点击
document
  .getElementById('uploadZone')
  .querySelector('.upload-icon')
  .addEventListener('click', function (e) {
    e.stopPropagation();
    document.getElementById('imageInput').click();
  });

document
  .getElementById('pixelUploadZone')
  .querySelector('.upload-icon')
  .addEventListener('click', function (e) {
    e.stopPropagation();
    document.getElementById('pixelUploadInput').click();
  });

document.getElementById('imageInput').addEventListener('change', function () {
  if (this.files && this.files[0]) {
    var originalFile = this.files[0];
    var reader = new FileReader();
    reader.onload = function (e) {
      openCropper(e.target.result, originalFile);
    };
    reader.readAsDataURL(originalFile);
  }
});

function openCropper(dataUrl, originalFile) {
  currentCropMode = 'normal';
  currentCropFile = originalFile;
  var image = document.getElementById('cropImage');
  image.src = dataUrl;
  cropModal.show();
  var modalEl = document.getElementById('cropModal');
  function onShown() {
    modalEl.removeEventListener('shown.bs.modal', onShown);
    if (cropperInstance) cropperInstance.destroy();
    cropperInstance = new Cropper(image, {
      viewMode: 1,
      dragMode: 'crop',
      autoCropArea: 0.8,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      background: false,
    });
  }
  modalEl.addEventListener('shown.bs.modal', onShown);
}

function openPixelCropper(dataUrl) {
  currentCropMode = 'pixel';
  currentCropFile = currentAlignFile;
  var image = document.getElementById('cropImage');
  image.src = dataUrl;
  cropModal.show();
  var modalEl = document.getElementById('cropModal');
  function onShown() {
    modalEl.removeEventListener('shown.bs.modal', onShown);
    if (cropperInstance) cropperInstance.destroy();
    cropperInstance = new Cropper(image, {
      viewMode: 1,
      dragMode: 'crop',
      autoCropArea: 0.9,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      background: false,
    });
  }
  modalEl.addEventListener('shown.bs.modal', onShown);
}

document.getElementById('cropConfirmBtn').addEventListener('click', function () {
  if (!cropperInstance) return;
  var croppedCanvas = cropperInstance.getCroppedCanvas();
  if (!croppedCanvas) {
    showToast('请先选择裁剪区域', 'info');
    return;
  }
  if (currentCropMode === 'pixel') {
    // 像素图模式：替换 currentAlignFile 和预览图
    croppedCanvas.toBlob(function (blob) {
      currentAlignFile = new File([blob], currentCropFile.name, { type: currentCropFile.type });
      var dataUrl = croppedCanvas.toDataURL();
      pixelPreviewImg = new Image();
      pixelPreviewImg.onload = function () {
        createPixelPreview();
        drawPixelPreview();
        bindPreviewInteractions();
        updatePixelEstimate();
        enterManualCropMode();
      };
      pixelPreviewImg.src = dataUrl;
      cropperInstance.destroy();
      cropperInstance = null;
      cropModal.hide();
      showToast('已裁剪并更新预览', 'success');
    }, currentCropFile.type);
  } else {
    // 普通模式：替换 selectedFile
    croppedCanvas.toBlob(function (blob) {
      selectedFile = new File([blob], currentCropFile.name, { type: currentCropFile.type });
      var fileNameEl = document.getElementById('fileName');
      fileNameEl.innerHTML = '<div class="file-tag"><i class="bi bi-file-image"></i> ' + selectedFile.name + '</div>';
      var thumbnailContainer = document.getElementById('thumbnailContainer');
      var thumbnail = document.getElementById('thumbnail');
      thumbnail.src = croppedCanvas.toDataURL();
      thumbnailContainer.style.display = 'block';
      thumbnail.onclick = function () {
        document.getElementById('previewImage').src = croppedCanvas.toDataURL();
        previewModal.show();
      };
      cropperInstance.destroy();
      cropperInstance = null;
      cropModal.hide();
      showToast('图片已裁剪并选择', 'success');
    }, currentCropFile.type);
  }
});

document.getElementById('cropCancelBtn').addEventListener('click', function () {
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
  document.getElementById('imageInput').value = '';
  selectedFile = null;
});

// ========== 模式切换 ==========
var currentMode = 'normal';
document.getElementById('tabNormal').addEventListener('click', function () {
  switchMode('normal');
});
document.getElementById('tabPixel').addEventListener('click', function () {
  switchMode('pixel');
});
function switchMode(mode) {
  currentMode = mode;
  document.getElementById('tabNormal').classList.toggle('active', mode === 'normal');
  document.getElementById('tabPixel').classList.toggle('active', mode === 'pixel');
  document.getElementById('modeNormal').classList.toggle('active', mode === 'normal');
  document.getElementById('modePixel').classList.toggle('active', mode === 'pixel');
}

// ========== 像素图预览画布==========
var pixelPreviewImg = null;
var pixelPreviewCanvas = null;
var isPreviewDragging = false;
var previewDragStartX = 0,
  previewDragStartY = 0;
var previewOffsetStartX = 0,
  previewOffsetStartY = 0;

function createPixelPreview() {
  var wrap = document.getElementById('pixelPreviewWrap');
  wrap.innerHTML = '';
  pixelPreviewCanvas = document.createElement('canvas');
  wrap.appendChild(pixelPreviewCanvas);
}

function drawPixelPreview() {
  if (!pixelPreviewImg || !pixelPreviewCanvas) return;
  var pixelSize = parseInt(document.getElementById('pixelSize').value) || 16;
  var isUneven = document.getElementById('pixelSizeUneven').checked;
  var psW = isUneven ? (parseInt(document.getElementById('pixelSizeW').value) || pixelSize) : pixelSize;
  var psH = isUneven ? (parseInt(document.getElementById('pixelSizeH').value) || pixelSize) : pixelSize;
  var offsetX = parseInt(document.getElementById('pixelOffsetX').value) || 0;
  var offsetY = parseInt(document.getElementById('pixelOffsetY').value) || 0;
  var maxW = 280;
  var scale = Math.min(maxW / pixelPreviewImg.width, 1);
  var w = Math.floor(pixelPreviewImg.width * scale);
  var h = Math.floor(pixelPreviewImg.height * scale);
  pixelPreviewCanvas.width = w;
  pixelPreviewCanvas.height = h;
  var ctx = pixelPreviewCanvas.getContext('2d');
  ctx.drawImage(pixelPreviewImg, 0, 0, w, h);
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
  ctx.lineWidth = 1;
  var sW = psW * scale;
  var sH = psH * scale;
  var modOx = ((offsetX % psW) + psW) % psW;
  var modOy = ((offsetY % psH) + psH) % psH;
  var ox = modOx * scale;
  var oy = modOy * scale;
  for (var x = ox; x <= w; x += sW) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (var y = oy; y <= h; y += sH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

// 像素图上传- 内联预览
document.getElementById('pixelUploadInput').addEventListener('change', function () {
  if (this.files && this.files[0]) {
    var file = this.files[0];
    currentAlignFile = file;
    var fileNameEl = document.getElementById('pixelFileName');
    fileNameEl.innerHTML = '<div class="file-tag"><i class="bi bi-file-image"></i> ' + file.name + '</div>';
    document.getElementById('pixelCropBtn').style.display = 'block';
    var reader = new FileReader();
    reader.onload = function (e) {
      pixelPreviewImg = new Image();
      pixelPreviewImg.onload = function () {
        createPixelPreview();
        drawPixelPreview();
        bindPreviewInteractions();
        updatePixelEstimate();
        enterManualCropMode();
      };
      pixelPreviewImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
});



// 像素参数变化时实时刷新预览
['pixelSizeRange', 'pixelSize', 'pixelOffsetX', 'pixelOffsetY', 'pixelSizeW', 'pixelSizeH', 'boardWidth', 'boardHeight'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('input', function () {
    drawPixelPreview();
    updatePixelEstimate();
    if (manualCropState.active) drawManualCrop();
  });
});

// 长宽不一致开关
var pixelSizeUnevenEl = document.getElementById('pixelSizeUneven');
if (pixelSizeUnevenEl) {
  pixelSizeUnevenEl.addEventListener('change', function () {
    document.getElementById('unevenSizeRow').style.display = this.checked ? 'flex' : 'none';
    drawPixelPreview();
    updatePixelEstimate();
  });
}

bindSlider('pixelSizeRange', 'pixelSize', function () {
  drawPixelPreview();
  updatePixelEstimate();
});
bindSlider('pixelBgThresholdRange', 'pixelBgThreshold');
bindSlider('pixelColorQuantizeRange', 'pixelColorQuantize');

// 预估拆分尺寸计算
function updatePixelEstimate() {
  if (!pixelPreviewImg) return;
  var pixelSize = parseInt(document.getElementById('pixelSize').value) || 16;
  var isUneven = document.getElementById('pixelSizeUneven').checked;
  var psW = isUneven ? (parseInt(document.getElementById('pixelSizeW').value) || pixelSize) : pixelSize;
  var psH = isUneven ? (parseInt(document.getElementById('pixelSizeH').value) || pixelSize) : pixelSize;
  var offsetX = parseInt(document.getElementById('pixelOffsetX').value) || 0;
  var offsetY = parseInt(document.getElementById('pixelOffsetY').value) || 0;
  var cols = Math.max(1, Math.ceil((pixelPreviewImg.width - offsetX) / psW));
  var rows = Math.max(1, Math.ceil((pixelPreviewImg.height - offsetY) / psH));
  document.getElementById('pixelEstimate').textContent = '预估拆分: ' + cols + ' x ' + rows + ' 格';
}

// 将 gridData 嵌入到指定大小的画板中（居中，不足补透明）
function embedGridToBoard(gridData, boardCols, boardRows) {
  var dataRows = gridData.length;
  var dataCols = gridData[0] ? gridData[0].length : 0;
  var startX = Math.floor((boardCols - dataCols) / 2);
  var startY = Math.floor((boardRows - dataRows) / 2);
  var newGrid = [];
  for (var y = 0; y < boardRows; y++) {
    var row = [];
    for (var x = 0; x < boardCols; x++) {
      var dx = x - startX;
      var dy = y - startY;
      if (dx >= 0 && dx < dataCols && dy >= 0 && dy < dataRows) {
        var cell = gridData[dy][dx];
        row.push({ x: x, y: y, color: cell.color, codes: cell.codes });
      } else {
        row.push({ x: x, y: y, color: 'transparent', codes: {} });
      }
    }
    newGrid.push(row);
  }
  return newGrid;
}

function bindPreviewInteractions() {
  if (!pixelPreviewCanvas) return;
  // 滚轮调pixel_size
  pixelPreviewCanvas.addEventListener(
    'wheel',
    function (e) {
      e.preventDefault();
      var ps = parseInt(document.getElementById('pixelSize').value) || 16;
      if (e.deltaY < 0) ps++;
      else ps--;
      ps = Math.max(1, Math.min(200, ps));
      document.getElementById('pixelSize').value = ps;
      document.getElementById('pixelSizeRange').value = Math.min(ps, 64);
      drawPixelPreview();
    },
    { passive: false }
  );
  // 空格+拖拽调offset
  pixelPreviewCanvas.addEventListener('mousedown', function (e) {
    if (spacePressed && e.button === 0) {
      isPreviewDragging = true;
      previewDragStartX = e.clientX;
      previewDragStartY = e.clientY;
      previewOffsetStartX = parseInt(document.getElementById('pixelOffsetX').value) || 0;
      previewOffsetStartY = parseInt(document.getElementById('pixelOffsetY').value) || 0;
      pixelPreviewCanvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });
}

document.addEventListener('mousemove', function (e) {
  if (isPreviewDragging && pixelPreviewCanvas && pixelPreviewImg) {
    var dx = e.clientX - previewDragStartX;
    var dy = e.clientY - previewDragStartY;
    var maxW = 280;
    var scale = Math.min(maxW / pixelPreviewImg.width, 1);
    var ps = parseInt(document.getElementById('pixelSize').value) || 16;
    var newOx = (previewOffsetStartX + Math.round(dx / scale)) % ps;
    var newOy = (previewOffsetStartY + Math.round(dy / scale)) % ps;
    if (newOx < 0) newOx += ps;
    if (newOy < 0) newOy += ps;
    document.getElementById('pixelOffsetX').value = newOx;
    document.getElementById('pixelOffsetY').value = newOy;
    drawPixelPreview();
  }
});

document.addEventListener('mouseup', function () {
  if (isPreviewDragging) {
    isPreviewDragging = false;
    if (pixelPreviewCanvas) pixelPreviewCanvas.style.cursor = spacePressed ? 'grab' : 'crosshair';
  }
});

// ========== 手工裁剪模式 ==========
var manualCropState = {
  active: false,
  img: null,
  canvas: null,
  ctx: null,
  zoom: 1
};

function enterManualCropMode() {
  if (!pixelPreviewImg) {
    showToast('请先上传像素图', 'info');
    return;
  }
  manualCropState.active = true;
  manualCropState.img = pixelPreviewImg;
  manualCropState.zoom = 1;

  // Hide normal canvas UI
  document.getElementById('mainCanvas').style.display = 'none';
  document.getElementById('canvasToolbar').style.display = 'none';
  document.getElementById('legendBar').style.display = 'none';
  document.getElementById('floatingControls').style.display = 'none';

  // Show overlay
  var overlay = document.getElementById('manualCropOverlay');
  overlay.classList.add('active');
  manualCropState.canvas = document.getElementById('manualCropCanvas');
  manualCropState.ctx = manualCropState.canvas.getContext('2d');

  // Sync toolbar display
  var isUneven = document.getElementById('pixelSizeUneven').checked;
  document.getElementById('mcUnevenControls').style.display = isUneven ? 'flex' : 'none';

  drawManualCrop();
  bindManualCropEvents();
}

function exitManualCropMode() {
  manualCropState.active = false;
  var overlay = document.getElementById('manualCropOverlay');
  overlay.classList.remove('active');

  // Restore normal canvas UI
  document.getElementById('mainCanvas').style.display = 'block';
  if (gridData) {
    document.getElementById('canvasToolbar').style.display = 'flex';
    document.getElementById('legendBar').style.display = 'block';
    document.getElementById('floatingControls').style.display = 'flex';
    drawGrid();
  }
}

// 手工裁剪模式按钮
document.getElementById('pixelCropBtn').addEventListener('click', function () {
  if (!pixelPreviewImg) {
    showToast('请先上传像素图', 'info');
    return;
  }
  enterManualCropMode();
});

function drawManualCrop() {
  var state = manualCropState;
  if (!state.img || !state.canvas) return;

  // 实时从左侧参数面板读取
  var pixelSize = parseInt(document.getElementById('pixelSize').value) || 16;
  var isUneven = document.getElementById('pixelSizeUneven').checked;
  var psW = isUneven ? (parseInt(document.getElementById('pixelSizeW').value) || pixelSize) : pixelSize;
  var psH = isUneven ? (parseInt(document.getElementById('pixelSizeH').value) || pixelSize) : pixelSize;
  var offsetX = parseInt(document.getElementById('pixelOffsetX').value) || 0;
  var offsetY = parseInt(document.getElementById('pixelOffsetY').value) || 0;

  var wrap = document.querySelector('.manual-crop-canvas-wrap');
  var maxW = wrap.clientWidth - 40;
  var maxH = wrap.clientHeight - 40;
  var scale = Math.min(maxW / state.img.width, maxH / state.img.height, 1) * state.zoom;
  var w = Math.floor(state.img.width * scale);
  var h = Math.floor(state.img.height * scale);
  state.canvas.width = w;
  state.canvas.height = h;
  state.canvas.style.width = w + 'px';
  state.canvas.style.height = h + 'px';

  var ctx = state.ctx;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(state.img, 0, 0, w, h);

  ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
  ctx.lineWidth = 1;
  var sW = psW * scale;
  var sH = psH * scale;
  var modOx = ((offsetX % psW) + psW) % psW;
  var modOy = ((offsetY % psH) + psH) % psH;
  var ox = modOx * scale;
  var oy = modOy * scale;

  for (var x = ox; x <= w; x += sW) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (var y = oy; y <= h; y += sH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  document.getElementById('mcOffsetDisplay').textContent = offsetX + ',' + offsetY;
  // Sync toolbar inputs for display
  document.getElementById('mcPixelSize').value = pixelSize;
  document.getElementById('mcPixelSizeW').value = psW;
  document.getElementById('mcPixelSizeH').value = psH;
}

function bindManualCropEvents() {
  if (manualCropState._eventsBound) return;
  manualCropState._eventsBound = true;

  document.getElementById('mcPixelSize').addEventListener('input', function () {
    document.getElementById('pixelSize').value = parseInt(this.value) || 16;
    document.getElementById('pixelSizeRange').value = Math.min(parseInt(this.value) || 16, 64);
    drawPixelPreview();
    updatePixelEstimate();
    drawManualCrop();
  });
  document.getElementById('mcPixelSizeW').addEventListener('input', function () {
    document.getElementById('pixelSizeW').value = parseInt(this.value) || 16;
    drawPixelPreview();
    updatePixelEstimate();
    drawManualCrop();
  });
  document.getElementById('mcPixelSizeH').addEventListener('input', function () {
    document.getElementById('pixelSizeH').value = parseInt(this.value) || 16;
    drawPixelPreview();
    updatePixelEstimate();
    drawManualCrop();
  });

  document.getElementById('mcConfirm').addEventListener('click', function () {
    var img = manualCropState.img;
    var pixelSize = parseInt(document.getElementById('pixelSize').value) || 16;
    var isUneven = document.getElementById('pixelSizeUneven').checked;
    var psW = isUneven ? (parseInt(document.getElementById('pixelSizeW').value) || pixelSize) : pixelSize;
    var psH = isUneven ? (parseInt(document.getElementById('pixelSizeH').value) || pixelSize) : pixelSize;
    var offsetX = parseInt(document.getElementById('pixelOffsetX').value) || 0;
    var offsetY = parseInt(document.getElementById('pixelOffsetY').value) || 0;

    var cols = Math.max(1, Math.floor((img.width - offsetX) / psW));
    var rows = Math.max(1, Math.floor((img.height - offsetY) / psH));
    var cropW = cols * psW;
    var cropH = rows * psH;
    cropW = Math.min(cropW, img.width - offsetX);
    cropH = Math.min(cropH, img.height - offsetY);

    if (cropW <= 0 || cropH <= 0) {
      showToast('裁剪区域无效，请调整偏移', 'error');
      return;
    }

    var cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    var cctx = cropCanvas.getContext('2d');
    cctx.drawImage(img, -offsetX, -offsetY, img.width, img.height);

    cropCanvas.toBlob(function (blob) {
      currentAlignFile = new File([blob], currentAlignFile ? currentAlignFile.name : 'cropped.png', { type: 'image/png' });
      pixelPreviewImg = new Image();
      pixelPreviewImg.onload = function () {
        createPixelPreview();
        drawPixelPreview();
        bindPreviewInteractions();
        updatePixelEstimate();
        enterManualCropMode();
      };
      pixelPreviewImg.src = cropCanvas.toDataURL();
      exitManualCropMode();
      showToast('已按网格裁剪并更新', 'success');
    }, 'image/png');
  });

  document.getElementById('mcCancel').addEventListener('click', function () {
    exitManualCropMode();
  });

  // Wheel zoom on manual crop canvas
  manualCropState.canvas.addEventListener('wheel', function (e) {
    if (!manualCropState.active) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      if (manualCropState.zoom < 3) manualCropState.zoom += 0.1;
    } else {
      if (manualCropState.zoom > 0.5) manualCropState.zoom -= 0.1;
    }
    drawManualCrop();
  }, { passive: false });

  // Keyboard arrow keys to move offset
  document.addEventListener('keydown', function (e) {
    if (!manualCropState.active) return;
    var changed = false;
    var offsetX = parseInt(document.getElementById('pixelOffsetX').value) || 0;
    var offsetY = parseInt(document.getElementById('pixelOffsetY').value) || 0;
    if (e.key === 'ArrowUp') {
      offsetY = Math.max(0, offsetY - 1);
      changed = true;
    } else if (e.key === 'ArrowDown') {
      offsetY++;
      changed = true;
    } else if (e.key === 'ArrowLeft') {
      offsetX = Math.max(0, offsetX - 1);
      changed = true;
    } else if (e.key === 'ArrowRight') {
      offsetX++;
      changed = true;
    }
    if (changed) {
      e.preventDefault();
      document.getElementById('pixelOffsetX').value = offsetX;
      document.getElementById('pixelOffsetY').value = offsetY;
      drawPixelPreview();
      updatePixelEstimate();
      drawManualCrop();
    }
  });
}

// 自动检测像素大小
document.getElementById('autoDetectPixelSize').addEventListener('click', function () {
  if (!currentAlignFile) {
    showToast('请先上传像素图', 'info');
    return;
  }
  var btn = this;
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> 检测中';
  var formData = new FormData();
  formData.append('image', currentAlignFile);
  fetch('/api/detect-pixel', { method: 'POST', body: formData })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-magic"></i> 自动';
      if (data.success) {
        document.getElementById('pixelSize').value = data.pixel_size;
        document.getElementById('pixelSizeRange').value = data.pixel_size;
        if (data.offset_x >= 0) {
          document.getElementById('pixelOffsetX').value = data.offset_x;
        }
        if (data.offset_y >= 0) {
          document.getElementById('pixelOffsetY').value = data.offset_y;
        }
        drawPixelPreview();
        showToast('检测到像素大小: ' + data.pixel_size + 'px', 'success');
      } else {
        showToast('检测失败: ' + (data.error || '未知错误'), 'error');
      }
    })
    .catch(function (error) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-magic"></i> 自动';
      showToast('检测失败: ' + error.message, 'error');
    });
});

// 像素图生成按钮
document.getElementById('generatePixelBtn').addEventListener('click', function () {
  if (!colorsLoaded) {
    showToast('颜色数据加载中，请稍候', 'info');
    return;
  }
  if (!currentAlignFile) {
    showToast('请先上传像素图', 'info');
    return;
  }
  var loading = document.getElementById('loading');
  loading.style.display = 'block';
  var pixelSize = parseInt(document.getElementById('pixelSize').value) || 16;
  var isUneven = document.getElementById('pixelSizeUneven').checked;
  var psW = isUneven ? (parseInt(document.getElementById('pixelSizeW').value) || pixelSize) : pixelSize;
  var psH = isUneven ? (parseInt(document.getElementById('pixelSizeH').value) || pixelSize) : pixelSize;
  var offsetX = parseInt(document.getElementById('pixelOffsetX').value) || 0;
  var offsetY = parseInt(document.getElementById('pixelOffsetY').value) || 0;
  var boardW = parseInt(document.getElementById('boardWidth').value) || 50;
  var boardH = parseInt(document.getElementById('boardHeight').value) || 50;

  var cols = Math.max(1, Math.ceil((pixelPreviewImg.width - offsetX) / psW));
  var rows = Math.max(1, Math.ceil((pixelPreviewImg.height - offsetY) / psH));
  if (cols > boardW || rows > boardH) {
    loading.style.display = 'none';
    showToast('拆分后尺寸(' + cols + 'x' + rows + ')超出画板(' + boardW + 'x' + boardH + ')，请扩大画板或调整像素大小', 'error');
    return;
  }

  var formData = new FormData();
  formData.append('image', currentAlignFile);
  formData.append('pixel_size', pixelSize);
  if (isUneven) {
    formData.append('pixel_size_w', psW);
    formData.append('pixel_size_h', psH);
  }
  formData.append('offset_x', offsetX);
  formData.append('offset_y', offsetY);
  formData.append('sampling_mode', document.getElementById('pixelSamplingMode').value);
  formData.append('remove_bg', document.getElementById('pixelRemoveBg').checked);
  formData.append('bg_threshold', document.getElementById('pixelBgThreshold').value);
  formData.append('color_quantize', document.getElementById('pixelColorQuantize').value);
  fetch('/upload-pixel', { method: 'POST', body: formData })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      loading.style.display = 'none';
      if (data.success) {
        selectedFile = currentAlignFile;
        var rawGrid = data.result.grid_data;
        colorList = data.result.color_list;
        var gc = data.result.cols || data.result.grid_size;
        var gr = data.result.rows || data.result.grid_size;
        if (gc < boardW || gr < boardH) {
          gridData = embedGridToBoard(rawGrid, boardW, boardH);
        } else {
          gridData = rawGrid;
        }
        initCanvas(boardW, boardH);
        drawGrid();
        updateColorPalette();
        updateLegend();
        showCanvasUI();
        showToast('像素图生成成功！', 'success');
      } else {
        showToast('生成失败: ' + (data.error || '未知错误'), 'error');
      }
    })
    .catch(function (error) {
      loading.style.display = 'none';
      showToast('生成失败: ' + error.message, 'error');
    });
});

function showCanvasUI() {
  document.getElementById('canvasToolbar').style.display = 'flex';
  document.getElementById('floatingControls').style.display = 'flex';
  document.getElementById('legendBar').style.display = 'block';
}

// 生成拼豆图案
document.getElementById('generateBtn').addEventListener('click', function () {
  if (!colorsLoaded) {
    showToast('颜色数据加载中，请稍候', 'info');
    return;
  }
  if (!selectedFile) {
    showToast('请先上传图片', 'info');
    return;
  }
  var loading = document.getElementById('loading');
  loading.style.display = 'block';
  var removeBgChecked = document.getElementById('removeBg').checked;
  var formData = new FormData();
  formData.append('image', selectedFile);
  formData.append('grid_size', document.getElementById('gridSize').value);
  formData.append('remove_bg', removeBgChecked);
  formData.append('color_simplify', document.getElementById('colorSimplify').value);
  formData.append('enhance_lines_strength', document.getElementById('linesEnhance').value);
  formData.append('remove_bg_threshold', document.getElementById('removeBgThreshold').value);
  formData.append('bg_model', document.getElementById('bgModelSelect').value);
  fetch('/upload', { method: 'POST', body: formData })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      loading.style.display = 'none';
      if (data.success) {
        gridData = data.result.grid_data;
        colorList = data.result.color_list;
        initCanvas(data.result.grid_size);
        drawGrid();
        updateColorPalette();
        updateLegend();
        showCanvasUI();
        showToast('生成成功！', 'success');
      } else {
        showToast('生成失败: ' + (data.error || '未知错误'), 'error');
      }
    })
    .catch(function (error) {
      loading.style.display = 'none';
      showToast('生成失败: ' + error.message, 'error');
    });
});

function initCanvas(cols, rows) {
  // 兼容旧调用：如果只传一个数字，当作正方形
  if (rows === undefined) {
    rows = cols;
  }
  canvas = document.getElementById('mainCanvas');
  ctx = canvas.getContext('2d');
  canvasContainer = document.querySelector('.canvas-container');
  if (!canvasContainer.dataset.mouseEventsBound) {
    var wheelRafId = null;
    var lastWheelTime = 0;
    canvasContainer.addEventListener(
      'wheel',
      function (e) {
        e.preventDefault();
        var now = Date.now();
        if (now - lastWheelTime < 50) return;
        lastWheelTime = now;
        if (wheelRafId) cancelAnimationFrame(wheelRafId);
        wheelRafId = requestAnimationFrame(function () {
          wheelRafId = null;
          if (e.deltaY < 0) {
            if (zoomLevel < 5) {
              zoomLevel += 0.1;
              updateCanvasSize();
            }
          } else {
            if (zoomLevel > 0.5) {
              zoomLevel -= 0.1;
              updateCanvasSize();
            }
          }
        });
      },
      { passive: false }
    );
    canvasContainer.addEventListener('mousedown', function (e) {
      if (spacePressed && e.button === 0) {
        isDragging = true;
        canvasContainer.style.cursor = 'grabbing';
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        scrollLeft = canvasContainer.scrollLeft;
        scrollTop = canvasContainer.scrollTop;
        e.preventDefault();
      }
    });
    canvasContainer.addEventListener('mouseup', function () {
      if (isDragging) {
        isDragging = false;
        canvasContainer.style.cursor = spacePressed ? 'grab' : 'default';
      }
    });
    canvasContainer.addEventListener('mousemove', function (e) {
      if (isDragging) {
        canvasContainer.scrollLeft = scrollLeft - (e.clientX - dragStartX);
        canvasContainer.scrollTop = scrollTop - (e.clientY - dragStartY);
      }
    });
    canvasContainer.dataset.mouseEventsBound = '1';
  }
  var totalWidth = cols * beadSize + 2 * margin;
  var totalHeight = rows * beadSize + 2 * margin;
  originalCanvasWidth = totalWidth;
  originalCanvasHeight = totalHeight;
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  updateCanvasSize();
}

function updateCanvasSize() {
  canvas.style.width = originalCanvasWidth * zoomLevel + 'px';
  canvas.style.height = originalCanvasHeight * zoomLevel + 'px';
  document.getElementById('zoomLevel').textContent = Math.round(zoomLevel * 100) + '%';
  drawGrid();
}

function createTransparentPattern(context) {
  var pCanvas = document.createElement('canvas');
  pCanvas.width = 8;
  pCanvas.height = 8;
  var pCtx = pCanvas.getContext('2d');
  pCtx.fillStyle = '#fff';
  pCtx.fillRect(0, 0, 8, 8);
  pCtx.fillStyle = '#ddd';
  pCtx.fillRect(0, 0, 4, 4);
  pCtx.fillRect(4, 4, 4, 4);
  return context.createPattern(pCanvas, 'repeat');
}

function getBrightness(hexColor) {
  if (hexColor === 'transparent') return 255;
  if (hexColor._brightness !== undefined) return hexColor._brightness;
  var b =
    (parseInt(hexColor.substr(1, 2), 16) + parseInt(hexColor.substr(3, 2), 16) + parseInt(hexColor.substr(5, 2), 16)) /
    3;
  hexColor._brightness = b;
  return b;
}

function drawGrid() {
  if (!gridData) return;
  var rows = gridData.length;
  var cols = gridData[0] ? gridData[0].length : 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!transparentPattern) transparentPattern = createTransparentPattern(ctx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '14px Arial';
  ctx.fillStyle = '#333';
  for (var i = 0; i < cols; i++) {
    ctx.fillText((i + 1).toString(), margin + i * beadSize + beadSize / 2, margin / 2);
  }
  for (var i = 0; i < rows; i++) {
    ctx.fillText((i + 1).toString(), margin / 2, margin + i * beadSize + beadSize / 2);
  }
  for (var y = 0; y < rows; y++) {
    for (var x = 0; x < cols; x++) {
      var cell = gridData[y][x];
      var px = margin + x * beadSize;
      var py = margin + y * beadSize;
      if (cell.color === 'transparent') {
        ctx.fillStyle = transparentPattern;
        ctx.fillRect(px, py, beadSize, beadSize);
      } else {
        ctx.fillStyle = cell.color;
        ctx.fillRect(px, py, beadSize, beadSize);
      }
      if (showCode && cell.codes && cell.codes[currentBrand]) {
        var code = cell.codes[currentBrand];
        ctx.fillStyle = getBrightness(cell.color) > 128 ? '#000' : '#fff';
        ctx.fillText(code, px + beadSize / 2, py + beadSize / 2);
      }
    }
  }
  for (var i = 0; i <= rows; i++) {
    if (gridMarkEnabled && i > 0 && i % gridMarkInterval === 0) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.moveTo(margin, margin + i * beadSize);
    ctx.lineTo(margin + cols * beadSize, margin + i * beadSize);
    ctx.stroke();
  }
  for (var i = 0; i <= cols; i++) {
    if (gridMarkEnabled && i > 0 && i % gridMarkInterval === 0) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.moveTo(margin + i * beadSize, margin);
    ctx.lineTo(margin + i * beadSize, margin + rows * beadSize);
    ctx.stroke();
  }
}

function updateColorPalette() {
  var palette = document.getElementById('colorPalette');
  palette.innerHTML = '';
  var eraser = document.createElement('div');
  eraser.className = 'color-item eraser-item';
  eraser.title = '橡皮擦（透明）';
  eraser.textContent = '橡皮擦';
  if (selectedColor && selectedColor.hex === 'transparent') eraser.classList.add('selected');
  eraser.addEventListener('click', function () {
    document.querySelectorAll('.color-item').forEach(function (el) {
      el.classList.remove('selected');
    });
    eraser.classList.add('selected');
    selectedColor = { hex: 'transparent', codes: {}, isEraser: true };
  });
  palette.appendChild(eraser);
  var allColors = Object.keys(color_mapping).map(function (hex) {
    return { hex: hex, codes: color_mapping[hex], count: 0 };
  });
  // 按当前paletteBrand 分组排序
  allColors.sort(function (a, b) {
    var aCode = a.codes[paletteBrand] || '';
    var bCode = b.codes[paletteBrand] || '';
    var aLetter = aCode.charAt(0);
    var bLetter = bCode.charAt(0);
    if (aLetter !== bLetter) return aLetter.localeCompare(bLetter);
    return (parseInt(aCode.substring(1)) || 0) - (parseInt(bCode.substring(1)) || 0);
  });
  if (colorList) {
    var colorMap = {};
    colorList.forEach(function (c) {
      colorMap[c.hex] = c.count;
    });
    allColors.forEach(function (c) {
      c.count = colorMap[c.hex] || 0;
    });
  }
  var currentLetter = '';
  allColors.forEach(function (colorInfo, index) {
    var brandCode = colorInfo.codes[paletteBrand] || '';
    var letter = brandCode.charAt(0);
    if (letter !== currentLetter) {
      currentLetter = letter;
      var letterHeader = document.createElement('div');
      letterHeader.className = 'letter-header';
      letterHeader.textContent = letter;
      letterHeader.style.cssText = 'flex-basis: 100%;';
      palette.appendChild(letterHeader);
    }
    var item = document.createElement('div');
    item.className = 'color-item';
    item.style.backgroundColor = colorInfo.hex;
    item.dataset.color = colorInfo.hex;
    item.dataset.index = index;
    var code = colorInfo.codes[paletteBrand] || '';
    if (code) item.textContent = code;
    if (colorInfo.count > 0) {
      var countSpan = document.createElement('span');
      countSpan.className = 'color-item-count';
      countSpan.textContent = colorInfo.count;
      item.appendChild(countSpan);
    }
    item.addEventListener('click', function () {
      document.querySelectorAll('.color-item').forEach(function (el) {
        el.classList.remove('selected');
      });
      item.classList.add('selected');
      selectedColor = colorInfo;
    });
    palette.appendChild(item);
  });
  if (allColors.length > 0 && !selectedColor) {
    var firstColorItem = palette.querySelector('.color-item:not(.eraser-item)');
    if (firstColorItem) firstColorItem.classList.add('selected');
    selectedColor = allColors[0];
  }
}

function updateLegend() {
  if (!colorList) return;
  var legend = document.getElementById('legendPanel');
  legend.innerHTML = '';
  colorList.sort(function (a, b) {
    return b.count - a.count;
  });
  colorList.forEach(function (colorInfo) {
    var item = document.createElement('div');
    item.className = 'legend-item';
    var colorBox = document.createElement('div');
    colorBox.className = 'legend-color';
    colorBox.style.backgroundColor = colorInfo.hex;
    var text = document.createElement('div');
    text.className = 'legend-text';
    var code = colorInfo.codes[currentBrand] || 'N/A';
    text.textContent = code + ' x' + colorInfo.count;
    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'legend-delete-btn';
    deleteBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
    deleteBtn.title = '删除此颜色';
    deleteBtn.onclick = function () {
      showConfirm('确定要删除颜色 ' + code + ' 吗？删除后该颜色对应的网格将变为透明', function () {
        removeColorFromGrid(colorInfo.hex);
      });
    };
    item.appendChild(colorBox);
    item.appendChild(text);
    item.appendChild(deleteBtn);
    legend.appendChild(item);
  });
  document.getElementById('legendCount').textContent = colorList.length > 0 ? '（' + colorList.length + ' 种）' : '';
}

function pushHistory(action) {
  historyStack.push(action);
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  redoStack = [];
  updateHistoryButtons();
  updateHistoryPanel();
}

function updateHistoryButtons() {
  var undoBtn = document.getElementById('undoBtn');
  var redoBtn = document.getElementById('redoBtn');
  undoBtn.disabled = historyStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

function updateHistoryPanel() {
  var body = document.getElementById('historyPanelBody');
  if (!body) return;
  if (historyStack.length === 0) {
    body.innerHTML = '<div class="history-empty">暂无操作记录</div>';
    return;
  }
  var html = '';
  for (var i = historyStack.length - 1; i >= 0; i--) {
    var action = historyStack[i];
    var idx = historyStack.length - i;
    var color = '';
    var text = '';
    if (action.type === 'paint') {
      color = action.newColor;
      text = '涂色 (' + action.x + ',' + action.y + ')';
    } else if (action.type === 'delete_color') {
      color = action.color;
      text = '删除颜色 ' + action.positions.length + ' 个';
    } else if (action.type === 'batch_paint') {
      color = action.newColor || action.positions[0].newColor;
      text = '批量涂色 ' + action.positions.length + ' 个';
    }
    var colorStyle =
      color === 'transparent' ? 'background:repeating-conic-gradient(#ccc 0 25%,#fff 0 50%)' : 'background:' + color;
    html +=
      '<div class="history-item">' +
      '<span class="history-item-index">#' +
      idx +
      '</span>' +
      '<span class="history-item-color" style="' +
      colorStyle +
      '"></span>' +
      '<span class="history-item-text">' +
      text +
      '</span>' +
      '</div>';
  }
  body.innerHTML = html;
}

function getGridXYFromEvent(e) {
  if (!gridData || !gridData.length) return null;
  var clientX = e.clientX,
    clientY = e.clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  }
  var rect = canvas.getBoundingClientRect();
  var scaleX = canvas.width / rect.width;
  var scaleY = canvas.height / rect.height;
  var canvasX = (clientX - rect.left) * scaleX;
  var canvasY = (clientY - rect.top) * scaleY;
  var x = Math.floor((canvasX - margin) / beadSize);
  var y = Math.floor((canvasY - margin) / beadSize);
  if (x >= 0 && x < gridData[0].length && y >= 0 && y < gridData.length) {
    return { x: x, y: y };
  }
  return null;
}

function paintCell(x, y, colorObj) {
  var cell = gridData[y][x];
  var oldColor = cell.color;
  var oldCodes = JSON.parse(JSON.stringify(cell.codes || {}));
  if (oldColor === colorObj.hex) return false;
  cell.color = colorObj.hex;
  cell.codes = colorObj.codes || {};
  return {
    x: x,
    y: y,
    oldColor: oldColor,
    oldCodes: oldCodes,
    newColor: colorObj.hex,
    newCodes: JSON.parse(JSON.stringify(colorObj.codes || {})),
  };
}

function undo() {
  if (historyStack.length === 0) return;
  var action = historyStack.pop();
  redoStack.push(action);
  if (action.type === 'paint') {
    gridData[action.y][action.x].color = action.oldColor;
    gridData[action.y][action.x].codes = action.oldCodes;
  } else if (action.type === 'delete_color') {
    action.positions.forEach(function (pos) {
      gridData[pos.y][pos.x].color = pos.oldColor;
      gridData[pos.y][pos.x].codes = pos.oldCodes;
    });
  } else if (action.type === 'batch_paint') {
    action.positions.forEach(function (pos) {
      gridData[pos.y][pos.x].color = pos.oldColor;
      gridData[pos.y][pos.x].codes = pos.oldCodes;
    });
  }
  drawGrid();
  updateColorStatistics();
  updateHistoryButtons();
  updateHistoryPanel();
  showToast('已撤销', 'info');
}

function redo() {
  if (redoStack.length === 0) return;
  var action = redoStack.pop();
  historyStack.push(action);
  if (action.type === 'paint') {
    gridData[action.y][action.x].color = action.newColor;
    gridData[action.y][action.x].codes = action.newCodes;
  } else if (action.type === 'delete_color') {
    action.positions.forEach(function (pos) {
      gridData[pos.y][pos.x].color = 'transparent';
      gridData[pos.y][pos.x].codes = {};
    });
  } else if (action.type === 'batch_paint') {
    action.positions.forEach(function (pos) {
      gridData[pos.y][pos.x].color = pos.newColor;
      gridData[pos.y][pos.x].codes = pos.newCodes;
    });
  }
  drawGrid();
  updateColorStatistics();
  updateHistoryButtons();
  updateHistoryPanel();
  showToast('已重做', 'info');
}

function removeColorFromGrid(colorToRemove) {
  if (!gridData) return;
  var positions = [];
  for (var y = 0; y < gridData.length; y++) {
    for (var x = 0; x < gridData[y].length; x++) {
      if (gridData[y][x].color === colorToRemove) {
        positions.push({
          x: x,
          y: y,
          oldColor: gridData[y][x].color,
          oldCodes: JSON.parse(JSON.stringify(gridData[y][x].codes)),
        });
        gridData[y][x].color = 'transparent';
        gridData[y][x].codes = {};
      }
    }
  }
  if (positions.length > 0) {
    pushHistory({
      type: 'delete_color',
      color: colorToRemove,
      positions: positions,
    });
  }
  drawGrid();
  updateColorStatistics();
  showToast('颜色已删除', 'success');
}

function updateColorStatistics() {
  if (!gridData || !colorList) return;
  var colorStats = {};
  var usedColors = new Set();
  for (var y = 0; y < gridData.length; y++) {
    for (var x = 0; x < gridData[y].length; x++) {
      var color = gridData[y][x].color;
      if (color !== '#FFFFFF' && color !== 'transparent') {
        usedColors.add(color);
        colorStats[color] = (colorStats[color] || 0) + 1;
      }
    }
  }
  var newColorList = [];
  colorList.forEach(function (colorInfo) {
    if (usedColors.has(colorInfo.hex)) {
      colorInfo.count = colorStats[colorInfo.hex] || 0;
      newColorList.push(colorInfo);
    }
  });
  colorList = newColorList;
  updateColorPalette();
  updateLegend();
}

document.getElementById('showCodeSwitch').addEventListener('change', function () {
  showCode = this.checked;
  drawGrid();
});

document.getElementById('brandSelect').addEventListener('change', function () {
  currentBrand = this.value;
  updateColorPalette();
  updateLegend();
  drawGrid();
});

document.getElementById('paletteBrandSelect').addEventListener('change', function () {
  paletteBrand = this.value;
  updateColorPalette();
});

function setEditMode(active) {
  isEditMode = active;
  var btn = document.getElementById('editModeBtn');
  var rightPanel = document.getElementById('rightEditPanel');
  if (isEditMode) {
    btn.className = 'btn btn-sm btn-warning';
    btn.innerHTML = '<i class="bi bi-x-lg"></i> 退出';
    canvas.style.cursor = 'crosshair';
    rightPanel.classList.add('active');
    document.getElementById('floatingControls').style.right = '300px';
    showToast('进入编辑模式，选择色板颜色后点击网格替换', 'info');
  } else {
    btn.className = 'btn btn-sm btn-outline-primary';
    btn.innerHTML = '<i class="bi bi-pencil"></i> 编辑';
    canvas.style.cursor = 'default';
    rightPanel.classList.remove('active');
    document.getElementById('floatingControls').style.right = '20px';
  }
}

document.getElementById('editModeBtn').addEventListener('click', function () {
  setEditMode(!isEditMode);
});

document.getElementById('exitEditBtn').addEventListener('click', function () {
  setEditMode(false);
});

document.getElementById('collapseBtn').addEventListener('click', function () {
  var leftPanel = document.getElementById('leftPanel');
  var collapseIcon = document.getElementById('collapseIcon');
  var isCollapsed = leftPanel.classList.contains('collapsed');
  if (isCollapsed) {
    leftPanel.classList.remove('collapsed');
    collapseIcon.className = 'bi bi-chevron-left';
  } else {
    leftPanel.classList.add('collapsed');
    collapseIcon.className = 'bi bi-chevron-right';
  }
});

// 批量模式开关
document.getElementById('batchModeSwitch').addEventListener('change', function () {
  isBatchMode = this.checked;
  showToast(isBatchMode ? '批量绘制已开启：长按左键拖动批量涂色' : '批量绘制已关闭', 'info');
});

// 历史记录面板展开/折叠
document.getElementById('historyPanelHeader').addEventListener('click', function () {
  var body = document.getElementById('historyPanelBody');
  var icon = document.getElementById('historyPanelIcon');
  body.classList.toggle('collapsed');
  if (body.classList.contains('collapsed')) {
    icon.className = 'bi bi-chevron-down';
  } else {
    icon.className = 'bi bi-chevron-up';
  }
});

// 单击涂色（批量模式关闭时）
document.getElementById('mainCanvas').addEventListener('click', function (e) {
  if (e.button !== 0) return;
  if (!isEditMode || !selectedColor || isBatchMode) return;
  var pos = getGridXYFromEvent(e);
  if (!pos) return;
  var x = pos.x,
    y = pos.y;
  var oldColor = gridData[y][x].color;
  if (oldColor !== selectedColor.hex) {
    pushHistory({
      type: 'paint',
      x: x,
      y: y,
      oldColor: oldColor,
      oldCodes: JSON.parse(JSON.stringify(gridData[y][x].codes)),
      newColor: selectedColor.hex,
      newCodes: JSON.parse(JSON.stringify(selectedColor.codes)),
    });
    gridData[y][x].color = selectedColor.hex;
    gridData[y][x].codes = selectedColor.codes;
    drawGrid();
    updateColorStatistics();
    showToast(selectedColor.hex === 'transparent' ? '已擦除' : '颜色替换成功', 'success');
  }
});

// 批量绘制：mousedown 开始
document.getElementById('mainCanvas').addEventListener('mousedown', function (e) {
  if (!isEditMode || !selectedColor || !isBatchMode) return;
  if (spacePressed) return; // Space 拖拽平移时不绘制
  if (e.button !== 0) return; // 只响应左键            isBatchPainting = true;
  batchPositions = [];
  batchPaintedSet.clear();
  var pos = getGridXYFromEvent(e);
  if (pos) {
    var key = pos.x + ',' + pos.y;
    if (!batchPaintedSet.has(key)) {
      var record = paintCell(pos.x, pos.y, selectedColor);
      if (record) {
        batchPositions.push(record);
        batchPaintedSet.add(key);
      }
    }
  }
  e.preventDefault();
});

// 批量绘制：mousemove / touchmove 持续
function handleBatchMove(e) {
  if (!isBatchPainting || !isEditMode || !selectedColor) return;
  var target = e.target;
  if (target.id !== 'mainCanvas') return;
  e.preventDefault();
  var pos = getGridXYFromEvent(e);
  if (pos) {
    var key = pos.x + ',' + pos.y;
    if (!batchPaintedSet.has(key)) {
      var record = paintCell(pos.x, pos.y, selectedColor);
      if (record) {
        batchPositions.push(record);
        batchPaintedSet.add(key);
        drawGrid();
        updateColorStatistics();
      }
    }
  }
}
document.addEventListener('mousemove', handleBatchMove);
document.addEventListener('touchmove', handleBatchMove, { passive: false });

// 批量绘制：mouseup / touchend 结束并提交历史记录
function handleBatchEnd(e) {
  if (!isBatchPainting) return;
  isBatchPainting = false;
  if (batchPositions.length > 0) {
    pushHistory({
      type: 'batch_paint',
      positions: batchPositions,
    });
    showToast('批量涂色 ' + batchPositions.length + ' 个', 'success');
  }
  batchPositions = [];
  batchPaintedSet.clear();
}
document.addEventListener('mouseup', handleBatchEnd);
document.addEventListener('touchend', handleBatchEnd);

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);

document.getElementById('zoomInBtn').addEventListener('click', function () {
  if (zoomLevel < 5) {
    zoomLevel += 0.1;
    updateCanvasSize();
  }
});

document.getElementById('zoomOutBtn').addEventListener('click', function () {
  if (zoomLevel > 0.5) {
    zoomLevel -= 0.1;
    updateCanvasSize();
  }
});

document.getElementById('zoomResetBtn').addEventListener('click', function () {
  zoomLevel = 1;
  updateCanvasSize();
});

document.addEventListener('keydown', function (e) {
  if (e.code === 'Space') {
    var tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    spacePressed = true;
    if (canvasContainer && !isDragging) canvasContainer.style.cursor = 'grab';
    if (pixelPreviewCanvas && !isPreviewDragging) pixelPreviewCanvas.style.cursor = 'grab';
    e.preventDefault();
  }
});

document.addEventListener('keyup', function (e) {
  if (e.code === 'Space') {
    spacePressed = false;
    isDragging = false;
    isPreviewDragging = false;
    if (canvasContainer) canvasContainer.style.cursor = 'default';
    if (pixelPreviewCanvas) pixelPreviewCanvas.style.cursor = 'crosshair';
  }
});

window.addEventListener('blur', function () {
  spacePressed = false;
  isDragging = false;
  isPreviewDragging = false;
  if (isBatchPainting) {
    isBatchPainting = false;
    batchPositions = [];
    batchPaintedSet.clear();
  }
  if (canvasContainer) canvasContainer.style.cursor = 'default';
  if (pixelPreviewCanvas) pixelPreviewCanvas.style.cursor = 'crosshair';
});

document.getElementById('exportBtn').addEventListener('click', function () {
  if (!gridData) {
    showToast('请先生成图案', 'info');
    return;
  }
  exportCanvasWithLegend();
});

function exportCanvasWithLegend() {
  var payload = {
    grid_data: gridData,
    color_list: colorList,
    brand: currentBrand,
    show_code: showCode,
  };
  fetch('/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(function (response) {
      if (!response.ok) {
        return response.json().then(function (err) {
          throw new Error(err.error || '导出失败');
        });
      }
      return response.blob();
    })
    .then(function (blob) {
      var url = window.URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = '拼豆图案.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('图片已导出', 'success');
    })
    .catch(function (error) {
      showToast('导出失败: ' + error.message, 'error');
    });
}
