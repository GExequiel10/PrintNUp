/**
 * PrintNUp — app.js
 * Lógica principal: carga de archivos, grilla dinámica,
 * detección de orientación automática e impresión.
 *
 * Dependencias: PDF.js (CDN en index.html)
 */

/* ============================================================
   CONFIGURAR PDF.js worker
   ============================================================ */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';


/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
const state = {
  nup: 2,                   // páginas por hoja
  orientation: 'auto',      // 'auto' | 'portrait' | 'landscape'
  currentOrientation: 'portrait', // orientación actualmente activa
  showNumbers: false,
  showBorders: true,
  slots: [],                // array de { imageDataUrl, aspectRatio } | null
  pendingSlotIndex: null,   // slot que espera un archivo individual
};


/* ============================================================
   REFERENCIAS DOM
   ============================================================ */
const dom = {
  nupSelector:          document.getElementById('nupSelector'),
  orientationSelector:  document.getElementById('orientationSelector'),
  fileInput:            document.getElementById('fileInput'),
  slotFileInput:        document.getElementById('slotFileInput'),
  btnUpload:            document.getElementById('btnUpload'),
  btnClear:             document.getElementById('btnClear'),
  btnPrint:             document.getElementById('btnPrint'),
  showNumbers:          document.getElementById('showNumbers'),
  showBorders:          document.getElementById('showBorders'),
  sheet:                document.getElementById('sheet'),
  sheetGrid:            document.getElementById('sheetGrid'),
  orientBadge:          document.getElementById('orientBadge'),
  slotCount:            document.getElementById('slotCount'),
  loadingOverlay:       document.getElementById('loadingOverlay'),
  instructions:         document.getElementById('instructions'),
};


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
function init() {
  // Inicializar slots vacíos
  resetSlots();

  // Eventos de controles
  dom.nupSelector.addEventListener('click', onNupClick);
  dom.orientationSelector.addEventListener('click', onOrientClick);
  dom.btnUpload.addEventListener('click', () => dom.fileInput.click());
  dom.fileInput.addEventListener('change', onFileInputChange);
  dom.slotFileInput.addEventListener('change', onSlotFileInputChange);
  dom.btnClear.addEventListener('click', clearAll);
  dom.btnPrint.addEventListener('click', printSheet);
  dom.showNumbers.addEventListener('change', onToggleNumbers);
  dom.showBorders.addEventListener('change', onToggleBorders);

  // Drag & drop en el body
  document.body.addEventListener('dragover', e => e.preventDefault());
  document.body.addEventListener('drop', onBodyDrop);

  // Renderizar estado inicial
  render();
}


/* ============================================================
   GESTIÓN DE SLOTS
   ============================================================ */

/** Reinicia el array de slots según el nup actual */
function resetSlots() {
  state.slots = Array(state.nup).fill(null);
}

/** Llena los slots con las imágenes cargadas, preservando los ya existentes */
function fillSlotsWithImages(imageObjects) {
  // Busca slots vacíos y los va llenando
  let imgIndex = 0;
  for (let i = 0; i < state.slots.length && imgIndex < imageObjects.length; i++) {
    if (state.slots[i] === null) {
      state.slots[i] = imageObjects[imgIndex++];
    }
  }
  // Si sobran imágenes, ampliar los slots (siempre mantenemos exactamente `nup` slots)
  // Las imágenes extra se ignoran (ya se distribuyen en el primer ciclo)
}

/** Cambia el número de páginas por hoja preservando imágenes ya cargadas */
function changeNup(newNup) {
  const oldSlots = [...state.slots];
  state.nup = newNup;
  state.slots = Array(newNup).fill(null);
  // Re-distribuir imágenes existentes
  const images = oldSlots.filter(s => s !== null);
  images.forEach((img, i) => {
    if (i < newNup) state.slots[i] = img;
  });
}


/* ============================================================
   CÁLCULO DE ORIENTACIÓN
   ============================================================ */

/**
 * Detecta la mejor orientación según las imágenes cargadas.
 * @returns {'portrait'|'landscape'}
 */
function detectOrientation() {
  const filledSlots = state.slots.filter(s => s !== null);
  if (filledSlots.length === 0) return 'portrait'; // default

  let portraitCount = 0;
  let landscapeCount = 0;

  filledSlots.forEach(slot => {
    if (slot.aspectRatio < 1) portraitCount++;   // alto > ancho
    else if (slot.aspectRatio > 1) landscapeCount++;
    // aspectRatio === 1 → cuadrada, no cuenta
  });

  if (portraitCount === 0 && landscapeCount === 0) return 'portrait';

  if (portraitCount >= landscapeCount) {
    // Predominan verticales → portrait minimiza espacio vacío
    return bestOrientationForLayout('portrait');
  } else {
    // Predominan horizontales → landscape
    return bestOrientationForLayout('landscape');
  }
}

/**
 * Dado un sesgo, elige la orientación que mejor se adapta al layout.
 * Para 2, 3 páginas: la orientación del contenido suele ser óptima.
 * Para 4, 6, 8: la grilla es simétrica, el contenido decide.
 */
function bestOrientationForLayout(bias) {
  // Para NUP = 2 o 3 con imágenes landscape, landscape puede ser mejor
  if (state.nup === 2 && bias === 'landscape') return 'landscape';
  if (state.nup === 3 && bias === 'landscape') return 'landscape';
  return bias;
}

/** Actualiza la orientación activa */
function updateActiveOrientation() {
  if (state.orientation === 'auto') {
    state.currentOrientation = detectOrientation();
  } else {
    state.currentOrientation = state.orientation;
  }
}


/* ============================================================
   CÁLCULO DE LAYOUT DE GRILLA
   ============================================================ */

/**
 * Devuelve { cols, rows } según nup y orientación.
 */
function getGridLayout(nup, orientation) {
  const isLandscape = orientation === 'landscape';
  switch (nup) {
    case 2:  return isLandscape ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 };
    case 3:  return isLandscape ? { cols: 3, rows: 1 } : { cols: 1, rows: 3 };
    case 4:  return { cols: 2, rows: 2 }; // igual en ambas
    case 6:  return isLandscape ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
    case 8:  return isLandscape ? { cols: 4, rows: 2 } : { cols: 2, rows: 4 };
    default: return { cols: 2, rows: 2 };
  }
}


/* ============================================================
   RENDER PRINCIPAL
   ============================================================ */

function render() {
  updateActiveOrientation();
  renderSheet();
  renderGrid();
  renderIndicator();
  renderPrintCSS();
  toggleInstructions();
}

/** Aplica clases de orientación a la hoja */
function renderSheet() {
  dom.sheet.classList.toggle('landscape', state.currentOrientation === 'landscape');
  dom.sheet.classList.toggle('portrait-mode', state.currentOrientation === 'portrait');
}

/** Genera la grilla de slots */
function renderGrid() {
  const { cols, rows } = getGridLayout(state.nup, state.currentOrientation);
  dom.sheetGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  dom.sheetGrid.style.gridTemplateRows    = `repeat(${rows}, 1fr)`;
  dom.sheetGrid.innerHTML = '';

  for (let i = 0; i < state.nup; i++) {
    const slotEl = createSlotElement(i, state.slots[i]);
    dom.sheetGrid.appendChild(slotEl);
  }
}

/** Crea el elemento DOM para un slot */
function createSlotElement(index, slotData) {
  const slotEl = document.createElement('div');
  slotEl.className = 'slot';
  if (state.showBorders) slotEl.classList.add('has-border');
  slotEl.dataset.index = index;

  if (slotData) {
    // Slot con imagen
    slotEl.classList.add('filled');

    const img = document.createElement('img');
    img.src = slotData.imageDataUrl;
    img.alt = `Página ${index + 1}`;
    img.draggable = false;
    slotEl.appendChild(img);

    // Overlay de acciones
    const actionsEl = document.createElement('div');
    actionsEl.className = 'slot-actions';
    actionsEl.innerHTML = `
      <button class="slot-action-btn replace-btn" data-index="${index}">⇄ Reemplazar</button>
      <button class="slot-action-btn delete-btn" data-index="${index}">✕ Quitar</button>
    `;
    actionsEl.querySelector('.replace-btn').addEventListener('click', () => openSlotFilePicker(index));
    actionsEl.querySelector('.delete-btn').addEventListener('click', () => removeSlotImage(index));
    slotEl.appendChild(actionsEl);

  } else {
    // Slot vacío → botón "+"
    const addBtn = document.createElement('button');
    addBtn.className = 'slot-add-btn';
    addBtn.innerHTML = `<span class="plus-icon">+</span><span>Agregar</span>`;
    addBtn.addEventListener('click', () => openSlotFilePicker(index));
    slotEl.appendChild(addBtn);

    // Drag & drop individual por slot
    slotEl.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      slotEl.classList.add('drag-over');
    });
    slotEl.addEventListener('dragleave', () => slotEl.classList.remove('drag-over'));
    slotEl.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      slotEl.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) processFilesForSlot([files[0]], index);
    });
  }

  // Numeración opcional
  if (state.showNumbers) {
    const numEl = document.createElement('span');
    numEl.className = 'slot-number';
    numEl.textContent = index + 1;
    slotEl.appendChild(numEl);
  }

  return slotEl;
}

/** Actualiza el indicador de orientación y conteo */
function renderIndicator() {
  const icon = state.currentOrientation === 'landscape' ? '▭' : '▯';
  const name = state.currentOrientation === 'landscape' ? 'Horizontal' : 'Vertical';
  const modeTag = state.orientation === 'auto' ? ' — Auto' : '';
  dom.orientBadge.textContent = `${icon} ${name}${modeTag}`;

  const filled = state.slots.filter(s => s !== null).length;
  dom.slotCount.textContent = `${filled} / ${state.nup} espacios usados`;
}

/** Actualiza variables CSS de impresión */
function renderPrintCSS() {
  // Controla si se muestran números en impresión
  document.documentElement.style.setProperty(
    '--print-numbers',
    state.showNumbers ? 'block' : 'none'
  );
}

/** Muestra u oculta instrucciones */
function toggleInstructions() {
  const hasContent = state.slots.some(s => s !== null);
  dom.instructions.style.display = hasContent ? 'none' : 'flex';
}


/* ============================================================
   PROCESAMIENTO DE ARCHIVOS
   ============================================================ */

/** Evento: input[type=file] general */
async function onFileInputChange(e) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!files.length) return;
  await processFiles(files);
}

/** Evento: input[type=file] para slot individual */
async function onSlotFileInputChange(e) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!files.length || state.pendingSlotIndex === null) return;
  await processFilesForSlot(files, state.pendingSlotIndex);
  state.pendingSlotIndex = null;
}

/** Drop en el body (fuera de slots) */
async function onBodyDrop(e) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  if (!files.length) return;
  await processFiles(files);
}

/** Abre el selector de archivo para un slot específico */
function openSlotFilePicker(index) {
  state.pendingSlotIndex = index;
  dom.slotFileInput.click();
}

/**
 * Procesa archivos genéricos y los distribuye en slots vacíos.
 */
async function processFiles(files) {
  showLoading(true);
  try {
    const imageObjects = [];
    for (const file of files) {
      if (file.type === 'application/pdf') {
        const pages = await extractPdfPages(file);
        imageObjects.push(...pages);
      } else if (file.type.startsWith('image/')) {
        const imgObj = await loadImageFile(file);
        imageObjects.push(imgObj);
      }
    }
    fillSlotsWithImages(imageObjects);
    render();
  } catch (err) {
    console.error('Error procesando archivos:', err);
    alert('Hubo un error al procesar los archivos. Verificá que sean PDF o imágenes válidas.');
  } finally {
    showLoading(false);
  }
}

/**
 * Procesa archivos para un slot específico (reemplazar o agregar).
 */
async function processFilesForSlot(files, slotIndex) {
  showLoading(true);
  try {
    const imageObjects = [];
    for (const file of files) {
      if (file.type === 'application/pdf') {
        const pages = await extractPdfPages(file);
        imageObjects.push(...pages);
      } else if (file.type.startsWith('image/')) {
        const imgObj = await loadImageFile(file);
        imageObjects.push(imgObj);
      }
    }
    if (imageObjects.length > 0) {
      state.slots[slotIndex] = imageObjects[0]; // Solo la primera imagen
    }
    render();
  } catch (err) {
    console.error('Error en slot:', err);
    alert('Hubo un error al cargar el archivo.');
  } finally {
    showLoading(false);
  }
}

/**
 * Extrae todas las páginas de un PDF como imágenes.
 * @param {File} file
 * @returns {Promise<Array<{imageDataUrl, aspectRatio}>>}
 */
async function extractPdfPages(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  const scale = 2.0; // resolución para previsualización

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width  = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;

    pages.push({
      imageDataUrl: canvas.toDataURL('image/jpeg', 0.92),
      aspectRatio:  viewport.width / viewport.height,
    });
  }
  return pages;
}

/**
 * Carga una imagen y devuelve { imageDataUrl, aspectRatio }.
 * @param {File} file
 * @returns {Promise<{imageDataUrl, aspectRatio}>}
 */
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        resolve({
          imageDataUrl: dataUrl,
          aspectRatio:  img.naturalWidth / img.naturalHeight,
        });
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


/* ============================================================
   ACCIONES SOBRE SLOTS
   ============================================================ */

function removeSlotImage(index) {
  state.slots[index] = null;
  render();
}


/* ============================================================
   HANDLERS DE CONTROLES
   ============================================================ */

function onNupClick(e) {
  const btn = e.target.closest('.nup-btn');
  if (!btn) return;
  const newNup = parseInt(btn.dataset.nup, 10);
  if (newNup === state.nup) return;

  // Actualizar UI del selector
  dom.nupSelector.querySelectorAll('.nup-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  changeNup(newNup);
  render();
}

function onOrientClick(e) {
  const btn = e.target.closest('.orient-btn');
  if (!btn) return;
  const orient = btn.dataset.orient;
  state.orientation = orient;

  dom.orientationSelector.querySelectorAll('.orient-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  render();
}

function onToggleNumbers(e) {
  state.showNumbers = e.target.checked;
  render();
}

function onToggleBorders(e) {
  state.showBorders = e.target.checked;
  render();
}


/* ============================================================
   LIMPIAR TODO
   ============================================================ */

function clearAll() {
  if (!confirm('¿Querés limpiar todos los espacios?')) return;
  resetSlots();
  state.orientation = 'auto';

  // Resetear UI de orientación
  dom.orientationSelector.querySelectorAll('.orient-btn').forEach(b => b.classList.remove('active'));
  dom.orientationSelector.querySelector('[data-orient="auto"]').classList.add('active');

  render();
}


/* ============================================================
   IMPRESIÓN
   ============================================================ */

function printSheet() {
  // Actualizar @page según orientación activa
  injectPrintPageCSS(state.currentOrientation);
  window.print();
}

/**
 * Inyecta una regla @page dinámica antes de imprimir.
 */
function injectPrintPageCSS(orientation) {
  let styleEl = document.getElementById('dynamic-print-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-style';
    document.head.appendChild(styleEl);
  }
  const size = orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait';
  styleEl.textContent = `@page { size: ${size}; margin: 6mm; }`;
}


/* ============================================================
   UTILIDADES
   ============================================================ */

function showLoading(visible) {
  dom.loadingOverlay.style.display = visible ? 'flex' : 'none';
}


/* ============================================================
   ARRANQUE
   ============================================================ */
document.addEventListener('DOMContentLoaded', init);
