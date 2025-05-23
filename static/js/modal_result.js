/*************************************************************
 * Правила валидации для каждого типа загрузки:
 *    (расширения, максимальный размер в МБ, максимальное кол-во файлов)
 *************************************************************/
const validationRules = {
    // Ортофотоплан
    ortho: {
      allowedExtensions: ['dwg', 'dxf', 'tif', 'zip', 'rar', '7z', 'sit'],
      maxSizeMB: 5120,  // 5 ГБ 
      maxFiles: 1
    },
    // Лазерное сканирование
    laser: {
      allowedExtensions: ['dwg', 'dxf', 'las', 'zip', 'rar', '7z', 'sit'],
      maxSizeMB: 15360, // 15 ГБ 
      maxFiles: 1
    },
    // Панорама 
    panorama: {
      allowedExtensions: [],
      maxSizeMB: 0,
      maxFiles: 0
    },
    // Обзорные фото
    overview: {
      allowedExtensions: ['zip', 'rar', '7z', 'sit'],
      maxSizeMB: 2048, // 2 ГБ
      maxFiles: 1
    }
  };


  // Функция для клиентской валидации выбранных файлов
  function validateSelectedFiles(files, uploadType) {
    const rules = validationRules[uploadType];
    if (!rules) {
      return true;
    }
    if (rules.maxFiles === 0 && files.length > 0) {
      alert("Для данного типа съёмки файлы не требуются.");
      return false;
    }
    if (files.length > rules.maxFiles) {
      alert(`Вы выбрали слишком много файлов. Максимум: ${rules.maxFiles}`);
      return false;
    }
    let totalSize = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop().toLowerCase();
      if (rules.allowedExtensions.length > 0 && !rules.allowedExtensions.includes(ext)) {
        alert(`Файл "${file.name}" имеет недопустимое расширение (${ext}).`);
        return false;
      }
      totalSize += file.size;
    }
    const totalSizeMB = totalSize / (1024 * 1024);
    if (totalSizeMB > rules.maxSizeMB) {
      alert(`Суммарный размер файлов превышает ${rules.maxSizeMB} МБ.`);
      return false;
    }
    return true;
  }
  
  /*************************************************************
   *  Функция для Drag-and-Drop 
   *************************************************************/
  document.querySelectorAll(".drop-zone").forEach(dropZoneElement => {
    const inputElement = dropZoneElement.querySelector(".drop-zone__input");
  
    // Клик по зоне открывает input
    dropZoneElement.addEventListener("click", () => inputElement.click());
  
    // Обработка выбора файла через input
    inputElement.addEventListener("change", () => {
      updateDropZonePrompt(dropZoneElement, inputElement.files[0]);
  
      let form = dropZoneElement.closest('form');
      let uploadType = form.id.replace("UploadForm", "");
  
      if (validateSelectedFiles(inputElement.files, uploadType)) {
          uploadTempFileWithProgress(form, uploadType);
      } else {
          inputElement.value = '';
          updateDropZonePrompt(dropZoneElement, null);
      }
    });
  
    // Dragover
    dropZoneElement.addEventListener("dragover", e => {
      e.preventDefault();
      dropZoneElement.classList.add("drop-zone--active");
    });
  
    // Dragleave
    ["dragleave", "dragend"].forEach(type => {
      dropZoneElement.addEventListener(type, e => {
        dropZoneElement.classList.remove("drop-zone--active");
      });
    });
  
    // Drop
    dropZoneElement.addEventListener("drop", e => {
      e.preventDefault();
      dropZoneElement.classList.remove("drop-zone--active");
      if (e.dataTransfer.files.length) {
        inputElement.files = e.dataTransfer.files;
        updateDropZonePrompt(dropZoneElement, e.dataTransfer.files[0]);
  
        let form = dropZoneElement.closest('form');
        let uploadType = form.id.replace("UploadForm", "");
  
        if (validateSelectedFiles(inputElement.files, uploadType)) {
            uploadTempFileWithProgress(form, uploadType);
        } else {
            inputElement.value = '';
            updateDropZonePrompt(dropZoneElement, null);
        }
      }
    });
  });
  
  // Функция обновления DropZone
  function updateDropZonePrompt(dropZoneElement, file) {
    const prompt = dropZoneElement.querySelector(".drop-zone__prompt");
    prompt.textContent = file ? `Файл выбран: ${file.name}` : "Перетащите сюда файл или кликните для выбора";
  }
  
  

//Обработчик поля ввода для ссылки лазерного сканирования.
document.addEventListener("DOMContentLoaded", function() {
  var laserLinkInput = document.getElementById('laserViewInput');
  if (laserLinkInput) {
    laserLinkInput.addEventListener('input', function() {
      var form = this.closest('form');
      if (form) {
        var actionContainer = form.querySelector('.upload-actions');
        if (actionContainer) {
          actionContainer.style.display = 'flex';
          actionContainer.classList.remove('d-none');
          var saveBtn = actionContainer.querySelector('button[type="submit"]');
          if (saveBtn) {
            saveBtn.disabled = false;
          }
        }
      }
    });
  }
});



  /*************************************************************
   *  Функция uploadTempFileWithProgress — загрузка файла во временное хранилище с прогресс-баром
   *************************************************************/
  function uploadTempFileWithProgress(form, uploadType) {
    var xhr = new XMLHttpRequest();
    form.uploadXHR = xhr;
  
    var url = '/main_app/requests/upload_temp_file/';
    xhr.open('POST', url, true);
  
    var csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    xhr.setRequestHeader('X-CSRFToken', csrfToken);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  
    // Получаем элементы прогресса, кнопок и DropZone
    var progressContainer = form.querySelector('.upload-progress');
    var progressBar = form.querySelector('.upload-progress-bar');
    var progressText = form.querySelector('.upload-progress-text');
    var actionContainer = form.querySelector('.upload-actions');
    var dropZone = form.querySelector('.drop-zone');
  
    // Показываем и сбрасываем прогресс-бар
    if (progressContainer) {
      progressContainer.style.display = 'block';
    }
    if (progressBar) {
      progressBar.style.width = '0%';
    }
    if (progressText) {
      progressText.textContent = '';
    }
    
    // Показываем контейнер кнопок
    if (actionContainer) {
      actionContainer.classList.remove('d-none');
      actionContainer.style.display = 'flex';
    }
    
    // Блокируем кнопку "Сохранить" до завершения загрузки
    var saveBtn = actionContainer ? actionContainer.querySelector('button[type="submit"]') : null;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Сохранить";
    }
    
    // Делаем DropZone неактивной, чтобы предотвратить повторный выбор файла
    if (dropZone) {
      dropZone.classList.add('drop-zone--disabled');
    }
    
    // Отслеживание прогресса загрузки
    xhr.upload.onprogress = function(event) {
      if (event.lengthComputable) {
        var percentComplete = Math.round((event.loaded / event.total) * 100);
        var loadedMB = (event.loaded / 1024 / 1024).toFixed(1);
        var totalMB = (event.total / 1024 / 1024).toFixed(1);
    
        if (progressBar) {
          progressBar.style.width = percentComplete + '%';
        }
        if (progressText) {
          progressText.textContent = `Загружено ${percentComplete}% | ${loadedMB} из ${totalMB} МБ`;
        }
      }
    };
    
    xhr.onreadystatechange = function() {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        delete form.uploadXHR;
    
        // Восстанавливаем активность DropZone независимо от результата загрузки
        if (dropZone) {
          dropZone.classList.remove('drop-zone--disabled');
        }
    
        if (xhr.status === 0) {
          console.log("Загрузка отменена пользователем (status=0).");
          return;
        }
        if (xhr.status === 200) {
          try {
            var response = JSON.parse(xhr.responseText);
            if (response.success) {
              form.dataset.tempId = response.temp_id;
              if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = "Сохранить";
              }
              alert("Файл загружен во временное хранилище!");
            } else {
              alert("Ошибка при загрузке: " + response.error);
            }
          } catch (e) {
            alert("Ошибка обработки ответа от сервера.");
          }
        } else {
          alert("Ошибка загрузки файла. Код: " + xhr.status);
        }
      }
    };
    
    var formData = new FormData(form);
    formData.append('upload_type', uploadType);
    xhr.send(formData);
  }
  

  /*************************************************************
   * Обработчик кнопки "Загрузить" (триггер) для показа/скрытия секции загрузки
   *************************************************************/
  $('.uploadBtn').on('click', function() {
    var type = $(this).data('type');
    $('#' + type + 'Upload').slideToggle(300);
  });

  
/*************************************************************
 * Обработчик отправки формы — подтверждение сохранения файла
 *************************************************************/
['ortho', 'laser', 'panorama', 'overview'].forEach(function(type) {
  var form = document.getElementById(type + "UploadForm");
  if (form) {
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      
      // Получаем идентификатор заявки из data-request-id формы
      var requestId = form.getAttribute('data-request-id');
      
      // Специальная обработка для панорамы
      if (type === 'panorama') {
        uploadPanorama(form, type, requestId);
        return;
      }
      
      // Если тип лазерный, проверяем, выбран ли новый файл
      if (type === 'laser') {
        var fileInput = form.querySelector('input[type="file"]');
        var newFileSelected = fileInput && fileInput.files && fileInput.files.length > 0;
        if (!newFileSelected) {
          // Нет нового файла: пользователь обновляет только ссылку
          var linkInput = document.getElementById('laserViewInput');
          var customViewLink = linkInput ? linkInput.value : '';
          confirmTempFile("", requestId, customViewLink)
            .then(function(data) {
              console.log("Ответ от confirmTempFile (без файла):", data);
              form.reset();
              delete form.dataset.tempId;
              
              // Сбрасываем элементы прогресса и скрываем контейнер кнопок
              var progressContainer = form.querySelector('.upload-progress');
              var progressBar = form.querySelector('.upload-progress-bar');
              var progressText = form.querySelector('.upload-progress-text');
              var actionContainer = form.querySelector('.upload-actions');
              if (progressContainer) { progressContainer.style.display = 'none'; }
              if (progressBar) { progressBar.style.width = '0%'; }
              if (progressText) { progressText.textContent = ''; }
              if (actionContainer) {
                actionContainer.classList.add('d-none');
                actionContainer.style.setProperty('display', 'none', 'important');
              }
              
              // Сбрасываем текст в drop‑зоне
              var dropZone = form.querySelector('.drop-zone');
              if (dropZone) {
                updateDropZonePrompt(dropZone, null);
              }
              
              console.log("Перезагружаем данные результата для requestId:", requestId);
              loadResultData(requestId);
            })
            .catch(function(error) {
              console.error("Ошибка при подтверждении ссылки:", error);
              alert("Ошибка при подтверждении ссылки: " + error.message);
            });
          return;
        }
      }
      
      // Стандартная логика — получаем временный идентификатор файла
      var tempId = form.dataset.tempId;
      console.log("Форма для типа:", type);
      console.log("Получен requestId:", requestId);
      console.log("Получен tempId:", tempId);
      
      if (!tempId) {
        alert("Дождитесь завершения загрузки файла.");
        return;
      }
      
      if (type === 'laser') {
        // Для лазера считываем актуальное значение поля "laserViewInput"
        var linkInput = document.getElementById('laserViewInput');
        var customViewLink = linkInput ? linkInput.value : '';
        if (customViewLink.trim() === "") {
          customViewLink = "";
        }
        confirmTempFile(tempId, requestId, customViewLink)
          .then(function(data) {
            console.log("Ответ от confirmTempFile:", data);
            form.reset();
            delete form.dataset.tempId;
            
            var progressContainer = form.querySelector('.upload-progress');
            var progressBar = form.querySelector('.upload-progress-bar');
            var progressText = form.querySelector('.upload-progress-text');
            var actionContainer = form.querySelector('.upload-actions');
            if (progressContainer) { progressContainer.style.display = 'none'; }
            if (progressBar) { progressBar.style.width = '0%'; }
            if (progressText) { progressText.textContent = ''; }
            if (actionContainer) {
              actionContainer.classList.add('d-none');
              actionContainer.style.setProperty('display', 'none', 'important');
            }
  
            // Сброс drop‑зоны
            var dropZone = form.querySelector('.drop-zone');
            if (dropZone) {
              updateDropZonePrompt(dropZone, null);
            }
  
            console.log("Перезагружаем данные результата для requestId:", requestId);
            loadResultData(requestId);
          })
          .catch(function(error) {
            console.error("Ошибка при подтверждении файла:", error);
            alert("Ошибка при подтверждении файла: " + error.message);
          });
      } else {
        // Для остальных типов
        confirmTempFile(tempId, requestId)
          .then(function(data) {
            console.log("Ответ от confirmTempFile:", data);
            form.reset();
            delete form.dataset.tempId;
            
            var progressContainer = form.querySelector('.upload-progress');
            var progressBar = form.querySelector('.upload-progress-bar');
            var progressText = form.querySelector('.upload-progress-text');
            var actionContainer = form.querySelector('.upload-actions');
            if (progressContainer) { progressContainer.style.display = 'none'; }
            if (progressBar) { progressBar.style.width = '0%'; }
            if (progressText) { progressText.textContent = ''; }
            if (actionContainer) {
              actionContainer.classList.add('d-none');
              actionContainer.style.setProperty('display', 'none', 'important');
            }
  
            // Сброс drop‑зоны
            var dropZone = form.querySelector('.drop-zone');
            if (dropZone) {
              updateDropZonePrompt(dropZone, null);
            }
  
            console.log("Перезагружаем данные результата для requestId:", requestId);
            loadResultData(requestId);
          })
          .catch(function(error) {
            console.error("Ошибка при подтверждении файла:", error);
            alert("Ошибка при подтверждении файла: " + error.message);
          });
      }
    });
  }
});






// Функция для обработки загрузки панорамы (без файла)
function uploadPanorama(form, uploadType, requestId) {
  var url = '/main_app/requests/upload_temp_file/';
  var csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
  var formData = new FormData(form);
  formData.append('upload_type', uploadType);
  
  return fetch(url, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: formData
  })
  .then(function(response) {
    if (!response.ok) {
      throw new Error("Ошибка загрузки данных. Код: " + response.status);
    }
    return response.json();
  })
  .then(function(data) {
    if (data.success) {
      form.dataset.tempId = data.temp_id;
      // Получаем значение ссылки из поля для панорамы.
      var panoramaLinkInput = document.getElementById('panoramaViewInput');
      var viewLink = panoramaLinkInput ? (panoramaLinkInput.value || '') : '';
      // Вызываем confirmTempFile с переданным значением ссылки
      return confirmTempFile(data.temp_id, requestId, viewLink);
    } else {
      throw new Error(data.error);
    }
  })
  .then(function(data) {
    form.reset();
    delete form.dataset.tempId;
    loadResultData(requestId);
  })
  .catch(function(error) {
    alert("Ошибка при сохранении панорамы: " + error.message);
  });
}

// Функция для подтверждения сохранения временного файла с поддержкой передачи кастомного view_link
function confirmTempFile(tempId, requestId, customViewLink) {
  const url = '/main_app/requests/confirm_temp_file/';
  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
  
  // Если customViewLink передан, используем его; иначе – считываем значение из поля "laserViewInput"
  let viewLink = '';
  if (typeof customViewLink !== 'undefined') {
      viewLink = customViewLink;
  } else {
      const linkInput = document.getElementById('laserViewInput');
      viewLink = linkInput ? (linkInput.value || '') : '';
  }
  
  console.log("Отправляем запрос по URL:", url);
  console.log("Параметры запроса: temp_id =", tempId, ", request_id =", requestId, ", view_link =", viewLink);
  
  return fetch(url, {
      method: 'POST',
      headers: {
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `temp_id=${encodeURIComponent(tempId)}&request_id=${encodeURIComponent(requestId)}&view_link=${encodeURIComponent(viewLink)}`
  })
  .then(response => {
      console.log("Статус ответа:", response.status);
      if (!response.ok) {
          throw new Error(`Ошибка подтверждения файла. Код: ${response.status}`);
      }
      return response.json();
  })
  .then(data => {
      console.log("Полученные данные:", data);
      if (!data.success) {
          throw new Error(data.error || 'Неизвестная ошибка при подтверждении файла');
      }
      return data;
  });
}


  /*************************************************************
   * Обработчик кнопки "Отмена" — отмена загрузки и очистка формы
   *************************************************************/
// Функция для скрытия контейнера кнопок и сброса прогресс-бара
function hideUploadControls(form) {
  var progressContainer = form.querySelector('.upload-progress');
  var progressBar = form.querySelector('.upload-progress-bar');
  var progressText = form.querySelector('.upload-progress-text');
  var actionContainer = form.querySelector('.upload-actions');
  
  if (progressContainer) {
    progressContainer.style.display = 'none';
  }
  if (progressBar) {
    progressBar.style.width = '0%';
  }
  if (progressText) {
    progressText.textContent = '';
  }
  if (actionContainer) {
    actionContainer.classList.add('d-none');
    actionContainer.style.setProperty('display', 'none', 'important');
  }
  
}

// Обработчик кнопки "Отмена" — отмена загрузки и очистка формы
document.querySelectorAll('.cancelUploadBtn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var type = this.getAttribute('data-type');
    var form = document.getElementById(type + "UploadForm");
    if (!form) return;
    
    // Прерываем текущую загрузку, если она идёт
    if (form.uploadXHR) {
      form.uploadXHR.abort();
      delete form.uploadXHR;
    }
    
    // Если есть временный файл, пытаемся его удалить
    var tempId = form.dataset.tempId;
    if (tempId) {
      cancelTempFile(tempId)
        .then(function(data) {
          form.reset();
          delete form.dataset.tempId;
          hideUploadControls(form); // скрываем кнопки и прогрессбар
        })
        .catch(function(error) {
          alert("Ошибка отмены загрузки: " + error.message);
        });
    } else {
      form.reset();
      hideUploadControls(form); // скрываем кнопки и прогрессбар
    }
    
    // Сброс текста в зоне Drag-and-Drop
    var dropZonePrompt = form.querySelector('.drop-zone__prompt');
    if (dropZonePrompt) {
      dropZonePrompt.textContent = "Перетащите сюда файл или кликните для выбора";
    }
    
    // Очищаем значение поля файла
    var fileInput = form.querySelector('.drop-zone__input');
    if (fileInput) {
      fileInput.value = "";
    }
    
    // Восстанавливаем активность DropZone
    var dropZone = form.querySelector('.drop-zone');
    if (dropZone) {
      dropZone.classList.remove('drop-zone--disabled');
    }
  });
});

  
  
    //фунция для удалняя временного файла
    function cancelTempFile(tempId) {
      const url = '/main_app/requests/cancel_temp_file/';
      const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
      return fetch(url, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `temp_id=${encodeURIComponent(tempId)}`
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Ошибка при удалении временного файла: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (!data.success) {
          throw new Error(data.error || 'Неизвестная ошибка при удалении временного файла');
        }
        return data;
      });
    }
  
  
  // Обработчик закрытия модального окна: сбрасываем состояние всех форм загрузки
$('#resultModal').on('hidden.bs.modal', function () {
  // Перебираем все формы загрузки внутри модального окна
  document.querySelectorAll('#resultModal form').forEach(function(form) {
    // Если идет загрузка, прерываем её
    if (form.uploadXHR) {
      form.uploadXHR.abort();
      delete form.uploadXHR;
    }
    
    // Если имеется временный файл, пытаемся его удалить через cancelTempFile
    var tempId = form.dataset.tempId;
    if (tempId) {
      cancelTempFile(tempId)
        .then(function(data) {
          console.log("Временный файл удалён при закрытии модального окна:", data);
          form.reset();
          delete form.dataset.tempId;
          hideUploadControls(form);
        })
        .catch(function(error) {
          console.error("Ошибка отмены загрузки при закрытии модального окна:", error);
          form.reset();
          hideUploadControls(form);
        });
    } else {
      form.reset();
      hideUploadControls(form);
    }
    
    // Сброс текста в зоне Drag-and-Drop
    var dropZonePrompt = form.querySelector('.drop-zone__prompt');
    if (dropZonePrompt) {
      dropZonePrompt.textContent = "Перетащите сюда файл или кликните для выбора";
    }
    
    // Очищаем значение поля файла
    var fileInput = form.querySelector('.drop-zone__input');
    if (fileInput) {
      fileInput.value = "";
    }
    
    // Восстанавливаем активность DropZone (убираем класс disabled)
    var dropZone = form.querySelector('.drop-zone');
    if (dropZone) {
      dropZone.classList.remove('drop-zone--disabled');
    }
    
    // Скрываем секцию загрузки, если она отображается
    var uploadSection = form.closest('.upload-section');
    if (uploadSection) {
      uploadSection.style.display = 'none';
    }
  });
});


// Определяет роль пользователя
function userIsAdmin() {
  return document.body.getAttribute('data-user-role') === 'admin';
}

/*************************************************************
 * Функция populateResultModal — заполнение модального окна результатами
 *************************************************************/
function populateResultModal(data) {
  try {
    // --- Ортофотоплан ---
    var orthoSection = document.getElementById('orthoSection');
    if (orthoSection) {
      if (data.orthophoto) {
        orthoSection.style.display = 'block';
        var orthoLink = document.getElementById('orthoDownloadLink');
        // Если файл загружен (наличие download_link)
        if (data.orthophoto.download_link && data.orthophoto.download_link !== '#' && data.orthophoto.download_link !== '') {
          orthoLink.setAttribute('href', data.orthophoto.download_link);
          orthoLink.innerHTML = '<span id="orthoArchiveName">' + (data.orthophoto.archive_name || 'Файл загружен') + '</span>';
          
          // Отключаем все input-элементы в форме загрузки ортофотоплана (делаем форму неактивной)
          var orthoUploadForm = document.getElementById('orthoUploadForm');
          if (orthoUploadForm) {
            orthoUploadForm.querySelectorAll('input').forEach(function(input) {
              input.disabled = true;
            });
          }
          
          // Блокируем дроп-зону ортофотоплана, чтобы она оставалась неактивной (если файл подтверждён)
          var orthoDropZone = document.getElementById('orthoDropZone');
          if (orthoDropZone) {
            orthoDropZone.classList.add("drop-zone--disabled");
          }
          
          // Если пользователь админ и id файла присутствует – вставляем кнопку удаления
          if (userIsAdmin() && data.orthophoto.id) {
            var orthoDeleteContainer = document.getElementById('orthoDeleteIconContainer');
            if (orthoDeleteContainer) {
              orthoDeleteContainer.innerHTML =
                '<span class="delete-btn" data-type="ortho" data-file-id="' + data.orthophoto.id + '" title="Удалить файл">' +
                  '<i class="fas fa-times deleteFile-icon"></i>' +
                '</span>';
            }
          } else {
            var orthoDeleteContainer = document.getElementById('orthoDeleteIconContainer');
            if (orthoDeleteContainer) { orthoDeleteContainer.innerHTML = ''; }
          }
        } else {
          // Если файл отсутствует – сбрасываем ссылку и активируем форму загрузки
          orthoLink.removeAttribute('href');
          orthoLink.textContent = 'Файлы для скачивания ещё не добавлены';
          var orthoDeleteContainer = document.getElementById('orthoDeleteIconContainer');
          if (orthoDeleteContainer) { orthoDeleteContainer.innerHTML = ''; }
          var orthoUploadForm = document.getElementById('orthoUploadForm');
          if (orthoUploadForm) {
            orthoUploadForm.querySelectorAll('input').forEach(function(input) {
              input.disabled = false;
            });
          }
          // Снимаем класс с дроп-зоны, чтобы она стала активной
          var orthoDropZone = document.getElementById('orthoDropZone');
          if (orthoDropZone) {
            orthoDropZone.classList.remove("drop-zone--disabled");
          }
        }
      } else {
        orthoSection.style.display = 'none';
      }
    }
    
    // --- Лазерное сканирование ---
    var laserSection = document.getElementById('laserSection');
    if (laserSection) {
      if (data.laser) {
        laserSection.style.display = 'block';
        
        // 1. Обработка архивной части (файл)
        var laserDownloadLink = document.getElementById('laserDownloadLink');
        if (laserDownloadLink) {
          if (data.laser.download_link && data.laser.download_link !== '#' && data.laser.download_link !== '') {
            laserDownloadLink.setAttribute('href', data.laser.download_link);
            laserDownloadLink.innerHTML = '<span id="laserArchiveName">' + (data.laser.archive_name || 'Файл загружен') + '</span>';
            
            // Блокируем все input-элементы в форме загрузки лазера (файл)
            var laserUploadForm = document.getElementById('laserUploadForm');
            if (laserUploadForm) {
              laserUploadForm.querySelectorAll('input').forEach(function(input) {
                input.disabled = true;
              });
            }
            // Блокируем дроп-зону лазера
            var laserDropZone = document.getElementById('laserDropZone');
            if (laserDropZone) {
              laserDropZone.classList.add("drop-zone--disabled");
            }
            // Если пользователь админ и id файла присутствует – вставляем кнопку удаления
            if (userIsAdmin() && data.laser.id) {
              var laserDeleteContainer = document.getElementById('laserDeleteIconContainer');
              if (laserDeleteContainer) {
                laserDeleteContainer.innerHTML =
                  '<span class="delete-btn" data-type="laser" data-file-id="' + data.laser.id + '" title="Удалить архив">' +
                    '<i class="fas fa-times deleteFile-icon"></i>' +
                  '</span>';
              }
            } else {
              var laserDeleteContainer = document.getElementById('laserDeleteIconContainer');
              if (laserDeleteContainer) { 
                laserDeleteContainer.innerHTML = ''; 
              }
            }
          } else {
            // Файл отсутствует — активируем форму загрузки
            laserDownloadLink.removeAttribute('href');
            laserDownloadLink.textContent = 'Файлы для скачивания ещё не добавлены';
            var laserDeleteContainer = document.getElementById('laserDeleteIconContainer');
            if (laserDeleteContainer) { laserDeleteContainer.innerHTML = ''; }
            var laserUploadForm = document.getElementById('laserUploadForm');
            if (laserUploadForm) {
              laserUploadForm.querySelectorAll('input').forEach(function(input) {
                input.disabled = false;
              });
            }
            // Снимаем класс с дроп-зоны, чтобы сделать её активной
            var laserDropZone = document.getElementById('laserDropZone');
            if (laserDropZone) {
              laserDropZone.classList.remove("drop-zone--disabled");
            }
          }
        }
        
        // 2. Обработка ссылки просмотра (view_link)
        var laserViewLink = document.getElementById('laserViewLink');
        if (laserViewLink) {
          if (data.laser.view_link && data.laser.view_link !== '#' && data.laser.view_link !== '') {
            laserViewLink.setAttribute('href', data.laser.view_link);
            laserViewLink.innerHTML = 'Смотреть результат лазерного сканирования';
            
            // Блокируем поле ввода ссылки, так как ссылка подтверждена
            var laserViewInput = document.getElementById('laserViewInput');
            if (laserViewInput) {
              laserViewInput.disabled = true;
            }
            
            if (userIsAdmin() && data.laser.id) {
              var laserViewDeleteContainer = document.getElementById('laserViewDeleteIconContainer');
              if (laserViewDeleteContainer) {
                laserViewDeleteContainer.innerHTML =
                  '<span class="delete-btn" data-type="laser_view" data-file-id="' + data.laser.id + '" title="Удалить ссылку">' +
                    '<i class="fas fa-times deleteFile-icon"></i>' +
                  '</span>';
              }
            } else {
              var laserViewDeleteContainer = document.getElementById('laserViewDeleteIconContainer');
              if (laserViewDeleteContainer) { laserViewDeleteContainer.innerHTML = ''; }
            }
          } else {
            laserViewLink.removeAttribute('href');
            laserViewLink.textContent = 'Ссылка на результат отсутствует';
            var laserViewDeleteContainer = document.getElementById('laserViewDeleteIconContainer');
            if (laserViewDeleteContainer) { laserViewDeleteContainer.innerHTML = ''; }
            var laserViewInput = document.getElementById('laserViewInput');
            if (laserViewInput) {
              laserViewInput.disabled = false;
              laserViewInput.value = "";
            }
          }
        }
        
      } else {
        laserSection.style.display = 'none';
      }
    }
    
    // --- Панорама ---
    var panoramaSection = document.getElementById('panoramaSection');
    if (panoramaSection) {
      if (data.panorama) {
        panoramaSection.style.display = 'block';
        var panoramaViewLink = document.getElementById('panoramaViewLink');
        if (panoramaViewLink) {
          if (data.panorama.view_link && data.panorama.view_link !== '#' && data.panorama.view_link !== '') {
            panoramaViewLink.setAttribute('href', data.panorama.view_link);
            panoramaViewLink.innerHTML = 'Перейти к просмотру панорамы';
            // Блокируем все input-элементы в форме панорамы (если она есть)
            var panoramaUploadForm = document.getElementById('panoramaUploadForm');
            if (panoramaUploadForm) {
              panoramaUploadForm.querySelectorAll('input').forEach(function(input) {
                input.disabled = true;
              });
            }
            if (userIsAdmin() && data.panorama.id) {
              var panoramaDeleteContainer = document.getElementById('panoramaDeleteIconContainer');
              if (panoramaDeleteContainer) {
                panoramaDeleteContainer.innerHTML =
                  '<span class="delete-btn" data-type="panorama" data-file-id="' + data.panorama.id + '" title="Удалить">' +
                    '<i class="fas fa-times deleteFile-icon"></i>' +
                  '</span>';
              }
            } else {
              var panoramaDeleteContainer = document.getElementById('panoramaDeleteIconContainer');
              if (panoramaDeleteContainer) { panoramaDeleteContainer.innerHTML = ''; }
            }
          } else {
            panoramaViewLink.removeAttribute('href');
            panoramaViewLink.textContent = 'Ссылка на результат отсутствует';
            var panoramaDeleteContainer = document.getElementById('panoramaDeleteIconContainer');
            if (panoramaDeleteContainer) { panoramaDeleteContainer.innerHTML = ''; }
            var panoramaUploadForm = document.getElementById('panoramaUploadForm');
            if (panoramaUploadForm) {
              panoramaUploadForm.querySelectorAll('input').forEach(function(input) {
                input.disabled = false;
              });
            }
          }
        }
      } else {
        panoramaSection.style.display = 'none';
      }
    }
    
    // --- Обзорные фото ---
    var overviewSection = document.getElementById('overviewSection');
    if (overviewSection) {
      if (data.overview) {
        overviewSection.style.display = 'block';
        var overviewDownloadLink = document.getElementById('overviewDownloadLink');
        if (overviewDownloadLink) {
          if (data.overview.download_link && data.overview.download_link !== '#' && data.overview.download_link !== '') {
            // Обновляем ссылку для скачивания
            overviewDownloadLink.setAttribute('href', data.overview.download_link);
            overviewDownloadLink.innerHTML = '<span id="overviewArchiveName">' + (data.overview.archive_name || 'Файл загружен') + '</span>';
            
            // Если пользователь — администратор и файл загружен, добавляем кнопку удаления
            if (userIsAdmin() && data.overview.id) {
              var overviewDeleteContainer = document.getElementById('overviewDeleteIconContainer');
              if (overviewDeleteContainer) {
                overviewDeleteContainer.innerHTML =
                  '<span class="delete-btn" data-type="overview" data-file-id="' + data.overview.id + '" title="Удалить архив">' +
                    '<i class="fas fa-times deleteFile-icon"></i>' +
                  '</span>';
              }
            } else {
              var overviewDeleteContainer = document.getElementById('overviewDeleteIconContainer');
              if (overviewDeleteContainer) { overviewDeleteContainer.innerHTML = ''; }
            }
            
            var overviewUploadForm = document.getElementById('overviewUploadForm');
            if (overviewUploadForm) {
              // Отключаем все input-элементы формы
              overviewUploadForm.querySelectorAll('input').forEach(function(input) {
                input.disabled = true;
              });
            }
            // Блокируем drop‑зону
            var overviewDropZone = document.getElementById('overviewDropZone');
            if (overviewDropZone) {
              overviewDropZone.classList.add("drop-zone--disabled");
            }
            
          } else {
            // Если файла нет – сбрасываем ссылку и очищаем контейнер удаления
            overviewDownloadLink.removeAttribute('href');
            overviewDownloadLink.textContent = 'Файлы для скачивания ещё не добавлены';
            var overviewDeleteContainer = document.getElementById('overviewDeleteIconContainer');
            if (overviewDeleteContainer) {
              overviewDeleteContainer.innerHTML = '';
            }
          }
        }
      } else {
        overviewSection.style.display = 'none';
      }
    }
   
  } catch (error) {
    console.error("Ошибка в populateResultModal:", error);
  }
}


/*************************************************************
 * Функция удаления результатов съемки
 *************************************************************/
//При клике происходит подтверждение действия, и вызывается функция deleteFile().
document.addEventListener("click", function(event) {
  // Ищем ближайшего родителя с классом "delete-btn"
  var deleteEl = event.target.closest(".delete-btn");
  if (deleteEl) {
    // Считываем data-атрибуты из найденного элемента
    var fileId = deleteEl.getAttribute("data-file-id");
    var type = deleteEl.getAttribute("data-type"); 
    if (confirm("Вы действительно хотите удалить этот элемент?")) {
      deleteFile(fileId, type);
    }
  }
});


//Отправляет AJAX-запрос на сервер для удаления файла/ссылки по fileId
function deleteFile(fileId, type) {
  var csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
  var url = '/main_app/requests/delete_result_file/' + fileId + '/';
  
  // Формируем данные для отправки, включая элемент, который хотим удалить.
  var data = new URLSearchParams();
  data.append('element_type', type);
  
  fetch(url, {
      method: 'POST',
      headers: {
          'X-CSRFToken': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: data.toString()
  })
  .then(function(response) {
      if (!response.ok) {
          throw new Error("Ошибка удаления элемента. Код: " + response.status);
      }
      return response.json();
  })
  .then(function(data) {
      if (data.success) {
          updateSectionAfterDeletion(type);
      } else {
          alert("Ошибка: " + data.error);
      }
  })
  .catch(function(error) {
      alert("Ошибка при удалении: " + error.message);
  });
}

//Обновляет внешний вид (DOM) для нужной секции после удаления элемента, сбрасывая содержимое ссылки и очищая контейнер для крестика.
function updateSectionAfterDeletion(type) {
  if (type === "ortho") {
    // Сбрасываем ссылку для ортофотоплана
    var orthoLink = document.getElementById("orthoDownloadLink");
    if (orthoLink) {
      orthoLink.removeAttribute("href");
      orthoLink.textContent = "Файлы для скачивания ещё не добавлены";
    }
    // Очищаем контейнер кнопки удаления
    var orthoDeleteContainer = document.getElementById("orthoDeleteIconContainer");
    if (orthoDeleteContainer) {
      orthoDeleteContainer.innerHTML = "";
    }
    // Активируем форму загрузки: разблокируем все input-элементы
    var orthoUploadForm = document.getElementById("orthoUploadForm");
    if (orthoUploadForm) {
      orthoUploadForm.querySelectorAll('input').forEach(function(input) {
        input.disabled = false;
      });
    }
    // Активируем drop‑зону: снимаем класс блокировки
    var orthoDropZone = document.getElementById("orthoDropZone");
    if (orthoDropZone) {
      orthoDropZone.classList.remove("drop-zone--disabled");
    }
  } else if (type === "laser") {
    // Сбрасываем ссылку для архива лазера
    var laserLink = document.getElementById("laserDownloadLink");
    if (laserLink) {
      laserLink.removeAttribute("href");
      laserLink.textContent = "Файлы для скачивания ещё не добавлены";
    }
    // Очищаем контейнер кнопки удаления для архива
    var laserDeleteContainer = document.getElementById("laserDeleteIconContainer");
    if (laserDeleteContainer) {
      laserDeleteContainer.innerHTML = "";
    }
    // Активируем форму загрузки лазера: разблокируем все input-элементы
    var laserUploadForm = document.getElementById("laserUploadForm");
    if (laserUploadForm) {
      laserUploadForm.querySelectorAll('input').forEach(function(input) {
        input.disabled = false;
      });
    }
    // Активируем drop‑зону лазера
    var laserDropZone = document.getElementById("laserDropZone");
    if (laserDropZone) {
      laserDropZone.classList.remove("drop-zone--disabled");
    }
  } else if (type === "laser_view") {
    // Сбрасываем ссылку просмотра лазера
    var laserViewLink = document.getElementById("laserViewLink");
    if (laserViewLink) {
      laserViewLink.removeAttribute("href");
      laserViewLink.textContent = "Ссылка на результат отсутствует";
    }
    // Очищаем контейнер кнопки удаления ссылки просмотра
    var laserViewDeleteContainer = document.getElementById("laserViewDeleteIconContainer");
    if (laserViewDeleteContainer) {
      laserViewDeleteContainer.innerHTML = "";
    }
    // Разблокируем и очищаем поле ввода ссылки просмотра
    var laserViewInput = document.getElementById("laserViewInput");
    if (laserViewInput) {
      laserViewInput.disabled = false;
      laserViewInput.value = "";
    }
  } else if (type === "panorama") {
    // Сбрасываем ссылку для панорамы
    var panoramaViewLink = document.getElementById("panoramaViewLink");
    if (panoramaViewLink) {
      panoramaViewLink.removeAttribute("href");
      panoramaViewLink.textContent = "Ссылка на результат отсутствует";
    }
    // Очищаем контейнер кнопки удаления для панорамы
    var panoramaDeleteContainer = document.getElementById("panoramaDeleteIconContainer");
    if (panoramaDeleteContainer) {
      panoramaDeleteContainer.innerHTML = "";
    }
    // Активируем форму загрузки панорамы: разблокируем все input-элементы
    var panoramaUploadForm = document.getElementById("panoramaUploadForm");
    if (panoramaUploadForm) {
      panoramaUploadForm.querySelectorAll('input').forEach(function(input) {
        input.disabled = false;
      });
    }
    // Активируем drop‑зону панорамы (если она есть)
    var panoramaDropZone = document.getElementById("panoramaDropZone");
    if (panoramaDropZone) {
      panoramaDropZone.classList.remove("drop-zone--disabled");
    }
  } else if (type === "overview") {
  // Сбрасываем ссылку для обзора архивного файла (Overview)
  var overviewLink = document.getElementById("overviewDownloadLink");
  if (overviewLink) {
    overviewLink.removeAttribute("href");
    overviewLink.textContent = "Файлы для скачивания ещё не добавлены";
  }
  // Очищаем контейнер кнопки удаления для overview
  var overviewDeleteContainer = document.getElementById("overviewDeleteIconContainer");
  if (overviewDeleteContainer) {
    overviewDeleteContainer.innerHTML = "";
  }
  // Активируем форму загрузки: разблокируем все input-элементы
  var overviewUploadForm = document.getElementById("overviewUploadForm");
  if (overviewUploadForm) {
    overviewUploadForm.querySelectorAll('input').forEach(function(input) {
      input.disabled = false;
    });
  }
  // Активируем drop‑зону: снимаем класс блокировки
  var overviewDropZone = document.getElementById("overviewDropZone");
  if (overviewDropZone) {
    overviewDropZone.classList.remove("drop-zone--disabled");
  }
}

  
}