/*************************************************************
 * 1. Правила валидации для каждого типа загрузки:
 *    (расширения, максимальный размер в МБ, максимальное кол-во файлов)
 *************************************************************/
const validationRules = {
    // Ортофотоплан
    ortho: {
      allowedExtensions: ['dwg', 'dxf', 'tif', 'zip', 'rar', '7z', 'sit'],
      maxSizeMB: 5120,  // 5 ГБ = 5120 МБ
      maxFiles: 1
    },
    // Лазерное сканирование
    laser: {
      allowedExtensions: ['dwg', 'dxf', 'las', 'zip', 'rar', '7z', 'sit'],
      maxSizeMB: 15360, // 15 ГБ = 15360 МБ
      maxFiles: 1
    },
    // Панорама (файлы не ожидаются)
    panorama: {
      allowedExtensions: [],
      maxSizeMB: 0,
      maxFiles: 0
    },
    // Обзорные фото
    overview: {
      allowedExtensions: ['mp4', 'mov', 'jpeg', 'jpg', 'png', 'webp'],
      maxSizeMB: 2048, // 2 ГБ = 2048 МБ
      maxFiles: 25
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
   * 2. Функция для Drag-and-Drop 
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
    // Убираем любые манипуляции с кнопками здесь!
  }
  
  
  
  /*************************************************************
   * 3. Функция uploadTempFileWithProgress — загрузка файла во временное хранилище с прогресс-баром
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
   * 4. Обработчик кнопки "Загрузить" (триггер) для показа/скрытия секции загрузки
   *************************************************************/
  $('.uploadBtn').on('click', function() {
    var type = $(this).data('type');
    $('#' + type + 'Upload').slideToggle(300);
  });

  
/*************************************************************
 * 6. Обработчик отправки формы — подтверждение сохранения файла
 *************************************************************/
['ortho', 'laser', 'panorama', 'overview'].forEach(function(type) { 
  var form = document.getElementById(type + "UploadForm");
  if (form) {
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      // Читаем requestId из data-request-id формы
      var requestId = form.getAttribute('data-request-id');
      
      // Если это панорама, обрабатываем отдельно
      if (type === 'panorama') {
        uploadPanorama(form, type, requestId);
        return;
      }
      
      // Если это обзорные фото (множественная загрузка), обрабатываем через отдельную функцию
      if (type === 'overview') {
        uploadOverviewFiles(form, type, requestId);
        return;
      }
      
      // Для остальных типов читаем временный id файла из data-атрибута формы
      var tempId = form.dataset.tempId;
      
      console.log("Форма для типа:", type);
      console.log("Получен requestId:", requestId);
      console.log("Получен tempId:", tempId);

      if (!tempId) {
        alert("Дождитесь завершения загрузки файла.");
        return;
      }
      
      // Для типа "laser" в этот момент считываем значение из поля ссылки
      if (type === 'laser') {
        var linkInput = document.getElementById('laserViewInput');
        var customViewLink = linkInput ? linkInput.value : '';
        confirmTempFile(tempId, requestId, customViewLink)
          .then(function(data) {
            console.log("Ответ от confirmTempFile:", data);
            alert("Файл и ссылка успешно сохранены.");
            form.reset();
            delete form.dataset.tempId;
            
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
            }

            console.log("Перезагружаем данные результата для requestId:", requestId);
            loadResultData(requestId);
          })
          .catch(function(error) {
            console.error("Ошибка при подтверждении файла:", error);
            alert("Ошибка при подтверждении файла: " + error.message);
          });
      } else {
        // Для остальных типов (например, "ortho") вызываем confirmTempFile без передачи ссылки,
        // и там значение берётся из поля, если есть.
        confirmTempFile(tempId, requestId)
          .then(function(data) {
            console.log("Ответ от confirmTempFile:", data);
            alert("Файл успешно сохранён.");
            form.reset();
            delete form.dataset.tempId;
            
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


function uploadOverviewFiles(form, uploadType, requestId) {
  var url = '/main_app/requests/upload_temp_file/';
  var csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
  var formData = new FormData(form);
  formData.append('upload_type', uploadType);

  fetch(url, {
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
      // Для overview ожидаем, что data.temp_id вернет JSON-строку с массивом ID
      form.dataset.tempIds = data.temp_id;  // сохраняем строку JSON
      // Вызываем функцию подтверждения для overview файлов
      confirmOverviewFiles(form.dataset.tempIds, requestId)
        .then(function(responseData) {
          alert("Файлы для обзорных фото успешно сохранены.");
          form.reset();
          delete form.dataset.tempIds;
          loadResultData(requestId);
        })
        .catch(function(error) {
          alert("Ошибка при подтверждении файлов: " + error.message);
        });
    } else {
      throw new Error(data.error);
    }
  })
  .catch(function(error) {
    alert("Ошибка при загрузке данных: " + error.message);
  });
}

function confirmOverviewFiles(tempIds, requestId) {
  const url = '/main_app/requests/confirm_temp_file/';
  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

  console.log("Отправляем запрос для overview. tempIds =", tempIds, ", requestId =", requestId);
  
  return fetch(url, {
    method: 'POST',
    headers: {
      'X-CSRFToken': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `temp_ids=${encodeURIComponent(tempIds)}&request_id=${encodeURIComponent(requestId)}`
  })
  .then(response => {
    if (!response.ok) {
      throw new Error("Ошибка подтверждения файлов. Код: " + response.status);
    }
    return response.json();
  })
  .then(data => {
    if (!data.success) {
      throw new Error(data.error || 'Неизвестная ошибка при подтверждении файлов');
    }
    return data;
  });
}


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
    alert("Панорама успешно сохранена.");
    form.reset();
    delete form.dataset.tempId;
    loadResultData(requestId);
  })
  .catch(function(error) {
    alert("Ошибка при сохранении панорамы: " + error.message);
  });
}

// Функция для подтверждения сохранения временного файла с поддержкой передачи кастомного view_link
function confirmTempFile(tempId, requestId) {
  const url = '/main_app/requests/confirm_temp_file/';
  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

  // Считываем текущее значение из поля для ссылки лазерного сканирования
  const linkInput = document.getElementById('laserViewInput');
  const viewLink = linkInput ? (linkInput.value || '') : '';

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
   * 7. Обработчик кнопки "Отмена" — отмена загрузки и очистка формы
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
          alert("Загрузка отменена, временный файл удалён.");
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
        return data; // возвращаем { success: true, message: ... }
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





/*************************************************************
 * Функция userIsAdmin
 * Определяет, является ли текущий пользователь администратором.
 * Для проверки используется data-атрибут <body data-user-role="admin">.
 *************************************************************/
function userIsAdmin() {
  return document.body.getAttribute('data-user-role') === 'admin';
}

/*************************************************************
 * 8. Функция populateResultModal — заполнение модального окна результатами
 *************************************************************/
function populateResultModal(data) {
  try {
    // --- Ортофотоплан ---
    var orthoSection = document.getElementById('orthoSection');
    if (orthoSection) {
      if (data.orthophoto) {
        orthoSection.style.display = 'block';
        var orthoLink = document.getElementById('orthoDownloadLink');
        // Проверяем наличие download_link
        if (data.orthophoto.download_link && data.orthophoto.download_link !== '#' && data.orthophoto.download_link !== '') {
          orthoLink.setAttribute('href', data.orthophoto.download_link);
          orthoLink.innerHTML = 'Архив: <span id="orthoArchiveName">' + (data.orthophoto.archive_name || 'Файл загружен') + '</span>';
          // Если пользователь админ и есть id файла — вставляем крестик
          if (userIsAdmin() && data.orthophoto.id) {
            var orthoDeleteContainer = document.getElementById('orthoDeleteIconContainer');
            if (orthoDeleteContainer) {
              orthoDeleteContainer.innerHTML = 
                '<span class="delete-btn" data-type="ortho" data-file-id="' + data.orthophoto.id + '" title="Удалить файл">' +
                  '<i class="fas fa-times deleteFile-icon"></i>' +
                '</span>';
            }
          } else {
            // Если файл не найден или пользователь не админ — убираем крестик
            var orthoDeleteContainer = document.getElementById('orthoDeleteIconContainer');
            if (orthoDeleteContainer) {
              orthoDeleteContainer.innerHTML = '';
            }
          }
        } else {
          // download_link пустой — файл не загружен
          orthoLink.removeAttribute('href');
          orthoLink.textContent = 'Файлы для скачивания ещё не добавлены';
          // Скрываем или очищаем иконку удаления
          var orthoDeleteContainer = document.getElementById('orthoDeleteIconContainer');
          if (orthoDeleteContainer) {
            orthoDeleteContainer.innerHTML = '';
          }
        }
      } else {
        // Нет данных по ортофотоплану — скрываем секцию
        orthoSection.style.display = 'none';
      }
    }
    
    // --- Лазерное сканирование ---
    var laserSection = document.getElementById('laserSection');
    if (laserSection) {
      if (data.laser) {
        laserSection.style.display = 'block';
        
        // 1. Архив (файл)
        var laserDownloadLink = document.getElementById('laserDownloadLink');
        if (laserDownloadLink) {
          if (data.laser.download_link && data.laser.download_link !== '#' && data.laser.download_link !== '') {
            // Есть ссылка на скачивание архива
            laserDownloadLink.setAttribute('href', data.laser.download_link);
            laserDownloadLink.innerHTML = 'Архив: <span id="laserArchiveName">' + (data.laser.archive_name || 'Файл загружен') + '</span>';
            
            // Если пользователь админ и есть ID файла, добавляем крестик
            if (userIsAdmin() && data.laser.id) {
              var laserDeleteContainer = document.getElementById('laserDeleteIconContainer');
              if (laserDeleteContainer) {
                laserDeleteContainer.innerHTML =
                  '<span class="delete-btn" data-type="laser" data-file-id="' + data.laser.id + '" title="Удалить архив">' +
                    '<i class="fas fa-times deleteFile-icon"></i>' +
                  '</span>';
              }             
            } else {
              // Не админ или нет ID — очищаем контейнер
              var laserDeleteContainer = document.getElementById('laserDeleteIconContainer');
              if (laserDeleteContainer) {
                laserDeleteContainer.innerHTML = '';
              }
            }
          } else {
            // Архив отсутствует
            laserDownloadLink.removeAttribute('href');
            laserDownloadLink.textContent = 'Файлы для скачивания ещё не добавлены';
            var laserDeleteContainer = document.getElementById('laserDeleteIconContainer');
            if (laserDeleteContainer) {
              laserDeleteContainer.innerHTML = '';
            }
          }
        }
        
        // 2. Ссылка на просмотр (view_link)
        var laserViewLink = document.getElementById('laserViewLink');
        if (laserViewLink) {
          if (data.laser.view_link && data.laser.view_link !== '#' && data.laser.view_link !== '') {
            laserViewLink.setAttribute('href', data.laser.view_link);
            laserViewLink.innerHTML = 'Просмотр результата';
            
            // Если пользователь админ и есть ID, вставляем крестик для ссылки
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
              if (laserViewDeleteContainer) {
                laserViewDeleteContainer.innerHTML = '';
              }
            }
          } else {
            // Ссылки нет
            laserViewLink.removeAttribute('href');
            laserViewLink.textContent = 'Ссылка на результат отсутствует';
            var laserViewDeleteContainer = document.getElementById('laserViewDeleteIconContainer');
            if (laserViewDeleteContainer) {
              laserViewDeleteContainer.innerHTML = '';
            }
          }
        }
        
      } else {
        // Данных по лазеру нет — скрываем секцию
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
            // Если нужен крестик для ссылки панорамы, делаем по аналогии
            if (userIsAdmin() && data.panorama.id) {
              var panoramaDeleteContainer = document.getElementById('panoramaDeleteIconContainer');
              if (panoramaDeleteContainer) {
                panoramaDeleteContainer.innerHTML =
                  '<span class="delete-btn" data-type="panorama" data-file-id="' + data.panorama.id + '" title="Удалить">' +
                    '<i class="fas fa-times deleteFile-icon"></i>' +
                  '</span>';
              }            
            }
          } else {
            panoramaViewLink.removeAttribute('href');
            panoramaViewLink.textContent = 'Ссылка на результат отсутствует';
            var panoramaDeleteContainer = document.getElementById('panoramaDeleteIconContainer');
            if (panoramaDeleteContainer) {
              panoramaDeleteContainer.innerHTML = '';
            }
          }
        }
      } else {
        panoramaSection.style.display = 'none';
      }
    }
    
    // --- Обзорные фото ---
    // Пока не изменяем, так как планируется отдельная переработка
    var overviewSection = document.getElementById('overviewSection');
    if (overviewSection) {
      if (data.overview) {
        overviewSection.style.display = 'block';
        var overviewDownloadLink = document.getElementById('overviewDownloadLink');
        if (overviewDownloadLink) {
          if (data.overview.download_link && data.overview.download_link !== '#' && data.overview.download_link !== '') {
            overviewDownloadLink.setAttribute('href', data.overview.download_link);
            overviewDownloadLink.innerHTML = 'Архив: <span id="overviewArchiveName">' + (data.overview.archive_name || 'Файл загружен') + '</span>';
          } else {
            overviewDownloadLink.removeAttribute('href');
            overviewDownloadLink.textContent = 'Файлы для скачивания ещё не добавлены';
          }
        }
        var overviewViewLink = document.getElementById('overviewViewLink');
        if (overviewViewLink) {
          if (data.overview.view_link && data.overview.view_link !== '#' && data.overview.view_link !== '') {
            overviewViewLink.setAttribute('href', data.overview.view_link);
            overviewViewLink.innerHTML = 'Просмотр фото';
          } else {
            overviewViewLink.removeAttribute('href');
            overviewViewLink.textContent = 'Фото отсутствуют';
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
 * 9. Функция удаления результатов съемки
 *************************************************************/
//При клике происходит подтверждение действия, и вызывается функция deleteFile().
document.addEventListener("click", function(event) {
  // Ищем ближайшего родителя с классом "delete-btn"
  var deleteEl = event.target.closest(".delete-btn");
  if (deleteEl) {
    // Считываем data-атрибуты из найденного элемента
    var fileId = deleteEl.getAttribute("data-file-id");
    var type = deleteEl.getAttribute("data-type"); // например, "ortho", "laser", "laser_view", "panorama"
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
          alert(data.message);
          // Обновляем DOM для нужной секции
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
    // Обновляем секцию Ортофотоплана: сбрасываем ссылку на файл,
    // активируем секцию загрузки для повторной загрузки и очищаем контейнер с крестиком.
    var orthoLink = document.getElementById("orthoDownloadLink");
    if (orthoLink) {
      orthoLink.removeAttribute("href");
      orthoLink.textContent = "Файлы для скачивания ещё не добавлены";
    }
    var orthoUpload = document.getElementById("orthoUpload");
    if (orthoUpload) {
      orthoUpload.style.display = "block";
    }
    var deleteIconContainer = document.getElementById("orthoDeleteIconContainer");
    if (deleteIconContainer) {
      deleteIconContainer.innerHTML = "";
    }
  } else if (type === "laser") {
    // Полное удаление архива лазера:
    // Сбрасываем ссылку для скачивания архива и очищаем контейнер для удаления.
    var laserLink = document.getElementById("laserDownloadLink");
    if (laserLink) {
      laserLink.removeAttribute("href");
      laserLink.textContent = "Файлы для скачивания ещё не добавлены";
    }
    var deleteIconContainer = document.getElementById("laserDeleteIconContainer");
    if (deleteIconContainer) {
      deleteIconContainer.innerHTML = "";
    }
  } else if (type === "laser_view") {
    // Удаление только ссылки просмотра лазера:
    // Сбрасываем href у ссылки просмотра и изменяем её текст,
    // а также очищаем контейнер для крестика удаления ссылки.
    var laserViewLink = document.getElementById("laserViewLink");
    if (laserViewLink) {
      laserViewLink.removeAttribute("href");
      laserViewLink.textContent = "Ссылка на результат отсутствует";
    }
    var laserViewDeleteContainer = document.getElementById("laserViewDeleteIconContainer");
    if (laserViewDeleteContainer) {
      laserViewDeleteContainer.innerHTML = "";
    }
  } else if (type === "panorama") {
    // Сброс секции Панорамы:
    // Убираем атрибут href у ссылки и изменяем текст, а затем очищаем контейнер с крестиком.
    var panoramaViewLink = document.getElementById("panoramaViewLink");
    if (panoramaViewLink) {
      panoramaViewLink.removeAttribute("href");
      panoramaViewLink.textContent = "Ссылка на результат отсутствует";
    }
    var panoramaDeleteContainer = document.getElementById("panoramaDeleteIconContainer");
    if (panoramaDeleteContainer) {
      panoramaDeleteContainer.innerHTML = "";
    }
  }
}