(function(){
  'use strict';

  if(!window.L || !window.MAP) return;

  var map = window.MAP;
  var mapEl = document.getElementById('map');
  var locateButton = document.getElementById('geo-locate');
  var currentNoteButton = document.getElementById('note-current');
  var freeNoteButton = document.getElementById('note-free');
  var notesOpenButton = document.getElementById('notes-open');
  var notesCount = document.getElementById('notes-count');
  var toolsStatus = document.getElementById('field-tools-status');
  var notesToggle = document.getElementById('l-notes');

  var noteDialog = document.getElementById('field-note-dialog');
  var noteForm = document.getElementById('field-note-form');
  var noteTitle = document.getElementById('field-note-title');
  var noteLocation = document.getElementById('field-note-location');
  var noteText = document.getElementById('field-note-text');
  var noteCamera = document.getElementById('field-note-camera');
  var noteGallery = document.getElementById('field-note-gallery');
  var photoGrid = document.getElementById('field-photo-grid');
  var photoViewer = document.getElementById('field-photo-viewer');
  var photoViewerImage = document.getElementById('field-photo-viewer-image');
  var photoViewerCount = document.getElementById('field-photo-viewer-count');
  var photoDownload = document.getElementById('field-photo-download');
  var photoPrev = document.getElementById('field-photo-prev');
  var photoNext = document.getElementById('field-photo-next');
  var noteStatus = document.getElementById('field-note-status');
  var noteSave = document.getElementById('field-note-save');
  var noteDelete = document.getElementById('field-note-delete');

  var notesDialog = document.getElementById('field-notes-dialog');
  var notesList = document.getElementById('field-notes-list');

  var DB_NAME = 'mapa-horta-notes';
  var STORE_NAME = 'notes';
  var DB_VERSION = 1;
  var MAX_PHOTOS = 12;
  var dbPromise = null;
  var notes = [];
  var noteMarkers = {};
  var notesLayer = L.layerGroup().addTo(map);
  var locationLayer = L.layerGroup().addTo(map);
  var currentMarker = null;
  var accuracyCircle = null;
  var pickMode = false;
  var pickHint = null;
  var activeNoteId = null;
  var activePoint = null;
  var activePhotos = [];
  var previewUrls = [];
  var viewerUrl = null;
  var viewerIndex = 0;
  var editorGeneration = 0;

  function uid(){
    if(window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 11);
  }

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function findNote(id){
    for(var i = 0; i < notes.length; i++) if(notes[i].id === id) return notes[i];
    return null;
  }

  function sortNotes(){
    notes.sort(function(a,b){ return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
  }

  function formatDate(value){
    var date = new Date(value);
    if(isNaN(date.getTime())) return '';
    return date.toLocaleString('ca-ES', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function setToolsStatus(message, tone){
    toolsStatus.textContent = message || '';
    if(tone) toolsStatus.dataset.tone = tone;
    else delete toolsStatus.dataset.tone;
  }

  function setNoteStatus(message, tone){
    noteStatus.textContent = message || '';
    if(tone) noteStatus.dataset.tone = tone;
    else delete noteStatus.dataset.tone;
  }

  function storageMessage(error){
    if(error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')){
      return 'No hi ha prou espai al dispositiu. Elimina alguna fotografia o nota i torna-ho a provar.';
    }
    return 'No s\'ha pogut desar al dispositiu. Comprova que el navegador permet l\'emmagatzematge local.';
  }

  function openDb(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject){
      if(!window.indexedDB){ reject(new Error('IndexedDB no disponible')); return; }
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function(){
        var db = request.result;
        if(!db.objectStoreNames.contains(STORE_NAME)){
          var store = db.createObjectStore(STORE_NAME, {keyPath:'id'});
          store.createIndex('updatedAt', 'updatedAt', {unique:false});
        }
      };
      request.onsuccess = function(){ resolve(request.result); };
      request.onerror = function(){ reject(request.error || new Error('No es pot obrir la base local')); };
      request.onblocked = function(){ reject(new Error('La base local està blocada per una altra pestanya')); };
    });
    return dbPromise;
  }

  function readAllNotes(){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readonly');
        var request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = function(){ resolve(request.result || []); };
        request.onerror = function(){ reject(request.error); };
      });
    });
  }

  function writeNote(note){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(note);
        tx.oncomplete = function(){ resolve(note); };
        tx.onerror = function(){ reject(tx.error); };
        tx.onabort = function(){ reject(tx.error || new Error('Desament cancel·lat')); };
      });
    });
  }

  function removeNote(id){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = function(){ resolve(); };
        tx.onerror = function(){ reject(tx.error); };
        tx.onabort = function(){ reject(tx.error || new Error('Eliminació cancel·lada')); };
      });
    });
  }

  function noteIcon(){
    return L.divIcon({
      className:'map-note-icon',
      html:'<span class="map-note-pin"><span>N</span></span>',
      iconSize:[32,39],
      iconAnchor:[16,36],
      popupAnchor:[0,-32]
    });
  }

  function popupFor(note){
    var text = String(note.text || '').trim();
    var photos = (note.images || []).length;
    return '<article class="field-popup">' +
      '<h3 class="field-popup-title">Nota de camp</h3>' +
      '<p class="field-popup-text">' + esc(text || (photos ? 'Nota amb fotografies' : 'Nota sense text')) + '</p>' +
      '<p class="field-popup-meta">' + esc(formatDate(note.updatedAt)) +
      (photos ? ' · ' + photos + (photos === 1 ? ' foto' : ' fotos') : '') + '</p>' +
      '<button type="button" class="field-popup-open" data-field-note="' + esc(note.id) + '">Obre la nota</button>' +
      '</article>';
  }

  function renderMarkers(){
    notesLayer.clearLayers();
    noteMarkers = {};
    notes.forEach(function(note){
      if(!isFinite(note.lat) || !isFinite(note.lng)) return;
      var marker = L.marker([note.lat, note.lng], {
        icon:noteIcon(),
        title:'Nota de camp del ' + formatDate(note.updatedAt),
        keyboard:true
      });
      marker.bindPopup(popupFor(note), {maxWidth:280});
      marker.addTo(notesLayer);
      noteMarkers[note.id] = marker;
    });
    notesCount.textContent = String(notes.length);
  }

  function renderList(){
    if(!notes.length){
      notesList.innerHTML = '<p class="field-notes-empty">Encara no hi ha cap nota.<br>Marca un punt al mapa per crear-ne la primera.</p>';
      return;
    }
    notesList.innerHTML = notes.map(function(note){
      var text = String(note.text || '').trim();
      var photos = (note.images || []).length;
      return '<article class="field-note-row">' +
        '<div class="field-note-row-main">' +
          '<p class="field-note-row-text">' + esc(text || (photos ? 'Nota amb fotografies' : 'Nota sense text')) + '</p>' +
          '<p class="field-note-row-meta">' + esc(formatDate(note.updatedAt)) + ' · ' +
            Number(note.lat).toFixed(5) + ', ' + Number(note.lng).toFixed(5) +
            (photos ? ' · ' + photos + (photos === 1 ? ' foto' : ' fotos') : '') + '</p>' +
        '</div>' +
        '<div class="field-note-row-actions">' +
          '<button type="button" data-field-show="' + esc(note.id) + '">Mostra</button>' +
          '<button type="button" data-field-edit="' + esc(note.id) + '">Edita</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function ensureNotesVisible(){
    if(!map.hasLayer(notesLayer)) map.addLayer(notesLayer);
    notesToggle.checked = true;
  }

  function showOnMap(id){
    var note = findNote(id);
    if(!note) return;
    if(notesDialog.open) notesDialog.close();
    ensureNotesVisible();
    map.setView([note.lat, note.lng], Math.max(map.getZoom(), 17), {animate:true});
    setTimeout(function(){ if(noteMarkers[id]) noteMarkers[id].openPopup(); }, 260);
    setToolsStatus('Nota mostrada al mapa.');
  }

  function revokePreviewUrls(){
    previewUrls.forEach(function(url){ URL.revokeObjectURL(url); });
    previewUrls = [];
  }

  function photoSource(photo){
    if(photo && photo.blob instanceof Blob){
      var url = URL.createObjectURL(photo.blob);
      previewUrls.push(url);
      return url;
    }
    return photo && photo.data ? photo.data : '';
  }

  function revokeViewerUrl(){
    if(viewerUrl){ URL.revokeObjectURL(viewerUrl); viewerUrl = null; }
  }

  function showViewerPhoto(index){
    if(!activePhotos.length) return;
    viewerIndex = (index + activePhotos.length) % activePhotos.length;
    var photo = activePhotos[viewerIndex];
    revokeViewerUrl();
    if(photo && photo.blob instanceof Blob){
      viewerUrl = URL.createObjectURL(photo.blob);
      photoViewerImage.src = viewerUrl;
    } else {
      photoViewerImage.src = photo && photo.data ? photo.data : '';
    }
    photoViewerImage.alt = 'Fotografia ' + (viewerIndex + 1) + ' de ' + activePhotos.length + ' ampliada';
    photoViewerCount.textContent = (viewerIndex + 1) + ' de ' + activePhotos.length;
    photoDownload.href = photoViewerImage.src;
    photoDownload.download = photo && photo.name ? photo.name : 'fotografia-' + (viewerIndex + 1) + '.jpg';
    photoPrev.disabled = activePhotos.length < 2;
    photoNext.disabled = activePhotos.length < 2;
  }

  function openPhotoViewer(index){
    if(!activePhotos[index]) return;
    showViewerPhoto(index);
    if(!photoViewer.open) photoViewer.showModal();
  }

  function renderPhotos(){
    revokePreviewUrls();
    if(!activePhotos.length){
      photoGrid.innerHTML = '<p class="field-photo-empty">Cap fotografia adjunta</p>';
      return;
    }
    photoGrid.innerHTML = '';
    activePhotos.forEach(function(photo, index){
      var item = document.createElement('figure');
      item.className = 'field-photo-item';
      var image = document.createElement('img');
      image.src = photoSource(photo);
      image.alt = 'Fotografia ' + (index + 1) + ' de la nota';
      var open = document.createElement('button');
      open.type = 'button';
      open.className = 'field-photo-open';
      open.dataset.photoOpen = String(index);
      open.setAttribute('aria-label', 'Amplia la fotografia ' + (index + 1));
      open.appendChild(image);
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'field-photo-remove';
      remove.dataset.photoIndex = String(index);
      remove.setAttribute('aria-label', 'Treu la fotografia ' + (index + 1));
      remove.textContent = '×';
      item.appendChild(open);
      item.appendChild(remove);
      photoGrid.appendChild(item);
    });
  }

  function openEditor(point, note){
    stopPick(false);
    if(notesDialog.open) notesDialog.close();
    editorGeneration++;
    activeNoteId = note ? note.id : null;
    activePoint = {lat:Number(point.lat), lng:Number(point.lng)};
    activePhotos = note && note.images ? note.images.slice() : [];
    noteTitle.textContent = note ? 'Edita la nota' : 'Nova nota';
    noteText.value = note ? String(note.text || '') : '';
    noteLocation.textContent = 'Ubicació: ' + activePoint.lat.toFixed(5) + ', ' + activePoint.lng.toFixed(5) + ' (WGS84)';
    noteDelete.hidden = !note;
    noteCamera.value = '';
    noteGallery.value = '';
    setNoteStatus('');
    renderPhotos();
    if(!noteDialog.open) noteDialog.showModal();
    setTimeout(function(){ noteText.focus(); }, 30);
  }

  function openExisting(id){
    var note = findNote(id);
    if(note) openEditor({lat:note.lat,lng:note.lng}, note);
  }

  function setEditorBusy(busy){
    noteSave.disabled = busy;
    noteDelete.disabled = busy;
    noteCamera.disabled = busy;
    noteGallery.disabled = busy;
  }

  function compressPhoto(file){
    return new Promise(function(resolve, reject){
      if(!file || !/^image\//.test(file.type || '')){ reject(new Error('El fitxer no és una imatge')); return; }
      var source = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function(){
        try{
          var maxSide = 1600;
          var ratio = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
          canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function(blob){
            URL.revokeObjectURL(source);
            if(!blob){ reject(new Error('No s\'ha pogut preparar la imatge')); return; }
            resolve({id:uid(), name:file.name || 'fotografia.jpg', type:'image/jpeg', blob:blob});
          }, 'image/jpeg', 0.82);
        }catch(error){
          URL.revokeObjectURL(source);
          reject(error);
        }
      };
      image.onerror = function(){ URL.revokeObjectURL(source); reject(new Error('No s\'ha pogut llegir la imatge')); };
      image.src = source;
    });
  }

  function addPhotos(fileList){
    var files = Array.prototype.slice.call(fileList || []);
    var available = MAX_PHOTOS - activePhotos.length;
    if(available <= 0){
      setNoteStatus('La nota ja té el màxim de ' + MAX_PHOTOS + ' fotografies.', 'error');
      return;
    }
    if(files.length > available){
      files = files.slice(0, available);
      setNoteStatus('S\'afegiran les primeres ' + available + ' fotografies.', 'error');
    } else {
      setNoteStatus(files.length === 1 ? 'Preparant la fotografia…' : 'Preparant les fotografies…');
    }
    var generation = editorGeneration;
    setEditorBusy(true);
    Promise.all(files.map(function(file){
      return compressPhoto(file).catch(function(){ return null; });
    })).then(function(processed){
      if(generation !== editorGeneration) return;
      processed = processed.filter(Boolean);
      activePhotos = activePhotos.concat(processed);
      renderPhotos();
      setNoteStatus(processed.length === 1 ? 'Fotografia preparada.' : processed.length + ' fotografies preparades.');
      setEditorBusy(false);
      noteCamera.value = '';
      noteGallery.value = '';
    }, function(){
      if(generation !== editorGeneration) return;
      setNoteStatus('No s\'han pogut preparar les fotografies seleccionades.', 'error');
      setEditorBusy(false);
    });
  }

  function saveActiveNote(event){
    event.preventDefault();
    if(!activePoint) return;
    var text = noteText.value.trim();
    if(!text && !activePhotos.length){
      setNoteStatus('Escriu una nota o afegeix almenys una fotografia.', 'error');
      noteText.focus();
      return;
    }
    var existing = activeNoteId ? findNote(activeNoteId) : null;
    var now = new Date().toISOString();
    var record = {
      id:activeNoteId || uid(),
      lat:activePoint.lat,
      lng:activePoint.lng,
      text:text,
      images:activePhotos.map(function(photo){
        return {id:photo.id || uid(), name:photo.name || 'fotografia.jpg', type:photo.type || 'image/jpeg', blob:photo.blob, data:photo.data};
      }),
      createdAt:existing && existing.createdAt ? existing.createdAt : now,
      updatedAt:now
    };
    setEditorBusy(true);
    setNoteStatus('Desant la nota al dispositiu…');
    writeNote(record).then(function(){
      var replaced = false;
      notes = notes.map(function(note){
        if(note.id === record.id){ replaced = true; return record; }
        return note;
      });
      if(!replaced) notes.push(record);
      sortNotes();
      renderMarkers();
      renderList();
      ensureNotesVisible();
      noteDialog.close();
      map.panTo([record.lat, record.lng], {animate:true});
      setTimeout(function(){ if(noteMarkers[record.id]) noteMarkers[record.id].openPopup(); }, 220);
      setToolsStatus(existing ? 'Nota actualitzada.' : 'Nota desada al mapa.');
      setEditorBusy(false);
    }).catch(function(error){
      setNoteStatus(storageMessage(error), 'error');
      setEditorBusy(false);
    });
  }

  function deleteActiveNote(){
    if(!activeNoteId) return;
    if(!window.confirm('Vols eliminar aquesta nota i totes les fotografies que conté?')) return;
    var id = activeNoteId;
    setEditorBusy(true);
    setNoteStatus('Eliminant la nota…');
    removeNote(id).then(function(){
      notes = notes.filter(function(note){ return note.id !== id; });
      renderMarkers();
      renderList();
      noteDialog.close();
      setToolsStatus('Nota eliminada.');
      setEditorBusy(false);
    }).catch(function(error){
      setNoteStatus(storageMessage(error), 'error');
      setEditorBusy(false);
    });
  }

  function locationError(error){
    if(!window.isSecureContext && location.hostname !== 'localhost'){
      return 'Per obtenir la ubicació cal obrir l\'aplicació amb una connexió segura (https).';
    }
    if(error && error.code === 1) return 'No hi ha permís per accedir a la ubicació. Pots habilitar-lo als permisos del navegador.';
    if(error && error.code === 2) return 'Ara mateix no s\'ha pogut determinar la ubicació.';
    if(error && error.code === 3) return 'La ubicació ha trigat massa. Torna-ho a provar en un espai amb més cobertura.';
    return 'Aquest dispositiu no permet obtenir la ubicació.';
  }

  function requestLocation(){
    return new Promise(function(resolve, reject){
      if(!navigator.geolocation){ reject(new Error('Geolocalització no disponible')); return; }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy:true,
        timeout:15000,
        maximumAge:20000
      });
    });
  }

  function setGeoBusy(busy){
    locateButton.disabled = busy;
    currentNoteButton.disabled = busy;
  }

  function showCurrentPosition(position, centre){
    var point = {lat:position.coords.latitude, lng:position.coords.longitude};
    var accuracy = Math.max(1, Number(position.coords.accuracy) || 0);
    if(currentMarker) locationLayer.removeLayer(currentMarker);
    if(accuracyCircle) locationLayer.removeLayer(accuracyCircle);
    accuracyCircle = L.circle([point.lat, point.lng], {
      radius:accuracy,
      color:'#1677d2',
      weight:1,
      opacity:.7,
      fillColor:'#1677d2',
      fillOpacity:.11,
      interactive:false
    }).addTo(locationLayer);
    currentMarker = L.marker([point.lat, point.lng], {
      icon:L.divIcon({
        className:'map-current-icon',
        html:'<span class="map-current-dot"></span>',
        iconSize:[20,20],
        iconAnchor:[10,10]
      }),
      interactive:false
    }).addTo(locationLayer);
    if(centre) map.setView([point.lat, point.lng], Math.max(map.getZoom(), 17), {animate:true});
    setToolsStatus('Ubicació trobada · precisió aproximada ±' + Math.round(accuracy) + ' m.');
    return point;
  }

  function locate(openNote){
    stopPick(false);
    setGeoBusy(true);
    setToolsStatus('Buscant la teva ubicació…');
    requestLocation().then(function(position){
      var point = showCurrentPosition(position, true);
      setGeoBusy(false);
      if(openNote) openEditor(point, null);
    }).catch(function(error){
      setGeoBusy(false);
      setToolsStatus(locationError(error), 'error');
    });
  }

  function createPickHint(){
    var control = L.control({position:'bottomright'});
    control.onAdd = function(){
      var box = L.DomUtil.create('div', 'field-pick-hint');
      box.innerHTML = 'Toca el punt on vols crear la nota<small>Prem Esc o torna a prémer el botó per cancel·lar.</small>';
      L.DomEvent.disableClickPropagation(box);
      return box;
    };
    return control;
  }

  function startPick(){
    if(pickMode){ stopPick(true); return; }
    if(notesDialog.open) notesDialog.close();
    pickMode = true;
    freeNoteButton.setAttribute('aria-pressed', 'true');
    mapEl.classList.add('field-pick-active');
    pickHint = createPickHint();
    pickHint.addTo(map);
    setToolsStatus('Toca un punt del mapa per crear-hi una nota.');
  }

  function stopPick(cancelled){
    if(!pickMode) return;
    pickMode = false;
    freeNoteButton.setAttribute('aria-pressed', 'false');
    mapEl.classList.remove('field-pick-active');
    if(pickHint){ map.removeControl(pickHint); pickHint = null; }
    if(cancelled) setToolsStatus('Marcatge cancel·lat.');
  }

  locateButton.addEventListener('click', function(){ locate(false); });
  currentNoteButton.addEventListener('click', function(){ locate(true); });
  freeNoteButton.addEventListener('click', startPick);
  notesOpenButton.addEventListener('click', function(){ renderList(); notesDialog.showModal(); });

  map.on('click', function(event){
    if(!pickMode) return;
    stopPick(false);
    openEditor({lat:event.latlng.lat,lng:event.latlng.lng}, null);
  });

  document.addEventListener('keydown', function(event){
    if(event.key === 'Escape' && pickMode) stopPick(true);
  });

  document.addEventListener('click', function(event){
    var open = event.target.closest ? event.target.closest('[data-field-note]') : null;
    if(open){ openExisting(open.dataset.fieldNote); return; }
    var show = event.target.closest ? event.target.closest('[data-field-show]') : null;
    if(show){ showOnMap(show.dataset.fieldShow); return; }
    var edit = event.target.closest ? event.target.closest('[data-field-edit]') : null;
    if(edit) openExisting(edit.dataset.fieldEdit);
  });

  notesToggle.addEventListener('change', function(){
    if(this.checked) map.addLayer(notesLayer);
    else map.removeLayer(notesLayer);
  });

  noteCamera.addEventListener('change', function(){ addPhotos(this.files); });
  noteGallery.addEventListener('change', function(){ addPhotos(this.files); });
  photoGrid.addEventListener('click', function(event){
    var button = event.target.closest ? event.target.closest('[data-photo-index]') : null;
    if(button){
      activePhotos.splice(+button.dataset.photoIndex, 1);
      renderPhotos();
      setNoteStatus('Fotografia treta de la nota.');
      return;
    }
    var open = event.target.closest ? event.target.closest('[data-photo-open]') : null;
    if(open) openPhotoViewer(+open.dataset.photoOpen);
  });

  document.getElementById('field-photo-viewer-close').addEventListener('click', function(){ photoViewer.close(); });
  photoPrev.addEventListener('click', function(){ showViewerPhoto(viewerIndex - 1); });
  photoNext.addEventListener('click', function(){ showViewerPhoto(viewerIndex + 1); });
  photoViewer.addEventListener('keydown', function(event){
    if(event.key === 'ArrowLeft'){ event.preventDefault(); showViewerPhoto(viewerIndex - 1); }
    else if(event.key === 'ArrowRight'){ event.preventDefault(); showViewerPhoto(viewerIndex + 1); }
  });
  photoViewer.addEventListener('click', function(event){ if(event.target === photoViewer) photoViewer.close(); });
  photoViewer.addEventListener('close', revokeViewerUrl);

  noteForm.addEventListener('submit', saveActiveNote);
  noteDelete.addEventListener('click', deleteActiveNote);
  document.getElementById('field-note-close').addEventListener('click', function(){ noteDialog.close(); });
  document.getElementById('field-note-cancel').addEventListener('click', function(){ noteDialog.close(); });
  noteDialog.addEventListener('close', function(){
    if(photoViewer.open) photoViewer.close();
    editorGeneration++;
    revokePreviewUrls();
    activeNoteId = null;
    activePoint = null;
    activePhotos = [];
    setEditorBusy(false);
  });

  document.getElementById('field-notes-close').addEventListener('click', function(){ notesDialog.close(); });
  document.getElementById('field-notes-new').addEventListener('click', function(){ notesDialog.close(); startPick(); });

  readAllNotes().then(function(saved){
    notes = saved.filter(function(note){ return note && isFinite(note.lat) && isFinite(note.lng); });
    sortNotes();
    renderMarkers();
    renderList();
  }).catch(function(error){
    setToolsStatus(storageMessage(error), 'error');
  });
})();
