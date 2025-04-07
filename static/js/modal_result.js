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
  
  /**
   * Функция для клиентской валидации выбранных файлов
   * @param {FileList} files - список файлов
   * @param {string} uploadType - тип загрузки (ortho/laser/panorama/overview)
   * @returns {boolean} - прошли ли файлы проверку
   */
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
      
      // Для остальных типов читаем временный id файла из data-атрибута формы
      var tempId = form.dataset.tempId;

      console.log("Форма для типа:", type);
      console.log("Получен requestId:", requestId);
      console.log("Получен tempId:", tempId);

      if (!tempId) {
        alert("Дождитесь завершения загрузки файла.");
        return;
      }
      // Передаём параметры в confirmTempFile
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
function confirmTempFile(tempId, requestId, customViewLink) {
  const url = '/main_app/requests/confirm_temp_file/';
  const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

  // Если customViewLink передан, используем его; иначе, для лазера ищем поле "laserViewInput"
  let viewLink = '';
  if (customViewLink !== undefined) {
    viewLink = customViewLink;
  } else {
    const linkInput = document.getElementById('laserViewInput');
    if (linkInput) {
      viewLink = linkInput.value || '';
    }
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
          if (data.orthophoto.download_link && data.orthophoto.download_link !== '#' && data.orthophoto.download_link !== '') {
            orthoLink.setAttribute('href', data.orthophoto.download_link);
            // Полностью перерисовываем содержимое ссылки с вложенным span
            orthoLink.innerHTML = 'Архив: <span id="orthoArchiveName">' + (data.orthophoto.archive_name || 'Файл загружен') + '</span>';
          } else {
            orthoLink.removeAttribute('href');
            orthoLink.textContent = 'Файлы для скачивания ещё не добавлены';
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
          var laserDownloadLink = document.getElementById('laserDownloadLink');
          if (data.laser.download_link && data.laser.download_link !== '#' && data.laser.download_link !== '') {
            laserDownloadLink.setAttribute('href', data.laser.download_link);
            // Обновляем содержимое ссылки с вложенным span для имени файла
            laserDownloadLink.innerHTML = 'Архив: <span id="laserArchiveName">' + (data.laser.archive_name || 'Файл загружен') + '</span>';
          } else {
            laserDownloadLink.removeAttribute('href');
            laserDownloadLink.textContent = 'Файлы для скачивания ещё не добавлены';
          }
          var laserViewLink = document.getElementById('laserViewLink');
          if (laserViewLink) {
            if (data.laser.view_link && data.laser.view_link !== '#' && data.laser.view_link !== '') {
              laserViewLink.setAttribute('href', data.laser.view_link);
              // Можно, если нужно, задать содержимое ссылки для просмотра
              laserViewLink.innerHTML = 'Просмотр результата';
            } else {
              laserViewLink.removeAttribute('href');
              laserViewLink.textContent = 'Ссылка на результат отсутствует';
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
              // Задаём содержимое ссылки для просмотра панорамы
              panoramaViewLink.innerHTML = 'Перейти к просмотру панорамы';
            } else {
              panoramaViewLink.removeAttribute('href');
              panoramaViewLink.textContent = 'Ссылка на результат отсутствует';
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
          if (data.overview.download_link && data.overview.download_link !== '#' && data.overview.download_link !== '') {
            overviewDownloadLink.setAttribute('href', data.overview.download_link);
            // Полностью перерисовываем содержимое ссылки
            overviewDownloadLink.innerHTML = 'Архив: <span id="overviewArchiveName">' + (data.overview.archive_name || 'Файл загружен') + '</span>';
          } else {
            overviewDownloadLink.removeAttribute('href');
            overviewDownloadLink.textContent = 'Файлы для скачивания ещё не добавлены';
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
  
  
  
  
  