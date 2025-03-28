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
   * 5. Обработчик кнопки "Отмена" — отмена загрузки и очистка формы
   *************************************************************/
  document.querySelectorAll('.cancelUploadBtn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var type = this.getAttribute('data-type');
      var form = document.getElementById(type + "UploadForm");
      if (form) {
        if (form.uploadXHR) {
          form.uploadXHR.abort();
          delete form.uploadXHR;
        }
        
        var tempId = form.dataset.tempId;
        if (tempId) {
          cancelTempFile(tempId)
            .then(function(data) {
              alert("Загрузка отменена, временный файл удалён.");
              form.reset();
              delete form.dataset.tempId;
            })
            .catch(function(error) {
              alert("Ошибка отмены загрузки: " + error.message);
            });
        } else {
          form.reset();
        }
    
        var progressContainer = form.querySelector('.upload-progress');
        var progressBar = form.querySelector('.upload-progress-bar');
        var progressText = form.querySelector('.upload-progress-text');
        if (progressContainer) {
          progressContainer.style.display = 'none';
        }
        if (progressBar) {
          progressBar.style.width = '0%';
        }
        if (progressText) {
          progressText.textContent = '';
        }
    
        var actionContainer = form.querySelector('.upload-actions');
        if (actionContainer) {
          actionContainer.classList.add('d-none');
          actionContainer.style.display = 'none';
        }
        
        var dropZonePrompt = form.querySelector('.drop-zone__prompt');
        if (dropZonePrompt) {
          dropZonePrompt.textContent = "Перетащите сюда файл или кликните для выбора";
        }
        
        // Восстанавливаем активность DropZone
        var dropZone = form.querySelector('.drop-zone');
        if (dropZone) {
          dropZone.classList.remove('drop-zone--disabled');
        }
      }
    });
  });
  
  
  
  
  /*************************************************************
   * 6. Новый обработчик отправки формы — подтверждение сохранения файла
   *************************************************************/
  ['ortho', 'laser', 'panorama', 'overview'].forEach(function(type) {
    var form = document.getElementById(type + "UploadForm");
    if (form) {
      form.addEventListener('submit', function(event) {
        event.preventDefault();
        var requestId = form.getAttribute('data-request-id');
        var tempId = form.dataset.tempId;
        if (!tempId) {
          alert("Дождитесь завершения загрузки файла.");
          return;
        }
        confirmTempFile(tempId, requestId)
          .then(function(data) {
            alert("Файл успешно сохранён.");
            form.reset();
            delete form.dataset.tempId;
  
            // После успешного сохранения тоже скрываем прогресс и кнопки:
            var progressContainer = form.querySelector('.upload-progress');
            var actionContainer = form.querySelector('.upload-actions');
            var progressBar = form.querySelector('.upload-progress-bar');
            var progressText = form.querySelector('.upload-progress-text');
  
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
  
            // Перезагрузка результатов после сохранения
            loadResultData(requestId);
          })
          .catch(function(error) {
            alert("Ошибка при подтверждении файла: " + error.message);
          });
      });
    }
  });
  
  
  /*************************************************************
   * 7. Функция loadResultData — загрузка данных результатов
   *************************************************************/
  document.querySelectorAll('.cancelUploadBtn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var type = this.getAttribute('data-type');
      var form = document.getElementById(type + "UploadForm");
      if (form) {
        // Прерываем загрузку, если она идёт
        if (form.uploadXHR) {
          form.uploadXHR.abort();
          delete form.uploadXHR;
        }
        
        var tempId = form.dataset.tempId;
        if (tempId) {
          cancelTempFile(tempId)
            .then(function(data) {
              alert("Загрузка отменена, временный файл удалён.");
              form.reset();
              delete form.dataset.tempId;
            })
            .catch(function(error) {
              alert("Ошибка отмены загрузки: " + error.message);
            });
        } else {
          form.reset();
        }
        
        // Сброс и скрытие прогресс-бара и текста
        var progressContainer = form.querySelector('.upload-progress');
        var progressBar = form.querySelector('.upload-progress-bar');
        var progressText = form.querySelector('.upload-progress-text');
        if (progressContainer) progressContainer.style.display = 'none';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '';
        
        // Скрываем контейнер кнопок (upload-actions)
        var actionContainer = form.querySelector('.upload-actions');
        if (actionContainer) {
          actionContainer.classList.add('d-none');
          actionContainer.style.display = 'none';
        }
        
        // Сброс текста в зоне Drag-and-Drop
        var dropZonePrompt = form.querySelector('.drop-zone__prompt');
        if (dropZonePrompt) {
          dropZonePrompt.textContent = "Перетащите сюда файл или кликните для выбора";
        }
        
        // Сброс значения поля файла, чтобы выбранный файл не сохранялся для повторной загрузки
        var fileInput = form.querySelector('.drop-zone__input');
        if (fileInput) {
          fileInput.value = "";
        }
      }
    });
  });
  
  
  
  /*************************************************************
   * 8. Функция populateResultModal — заполнение модального окна результатами
   *************************************************************/
  function populateResultModal(data) {
    // Ортофотоплан
    var orthoSection = document.getElementById('orthoSection');
    if (data.orthophoto) {
      orthoSection.style.display = 'block';
      if (data.orthophoto.download_link && data.orthophoto.download_link !== '#' && data.orthophoto.download_link !== '') {
        document.getElementById('orthoDownloadLink').setAttribute('href', data.orthophoto.download_link);
        if (data.orthophoto.archive_name) {
          document.getElementById('orthoArchiveName').textContent = data.orthophoto.archive_name;
        }
      } else {
        document.getElementById('orthoDownloadLink').removeAttribute('href');
        document.getElementById('orthoDownloadLink').textContent = 'Файлы для скачивания еще не добавлены';
      }
    } else {
      orthoSection.style.display = 'none';
    }
    // Лазерное сканирование
    var laserSection = document.getElementById('laserSection');
    if (data.laser) {
      laserSection.style.display = 'block';
      if (data.laser.download_link && data.laser.download_link !== '#' && data.laser.download_link !== '') {
        document.getElementById('laserDownloadLink').setAttribute('href', data.laser.download_link);
        if (data.laser.archive_name) {
          document.getElementById('laserArchiveName').textContent = data.laser.archive_name;
        }
      } else {
        document.getElementById('laserDownloadLink').removeAttribute('href');
        document.getElementById('laserDownloadLink').textContent = 'Файлы для скачивания еще не добавлены';
      }
      if (data.laser.view_link && data.laser.view_link !== '#' && data.laser.view_link !== '') {
        document.getElementById('laserViewLink').setAttribute('href', data.laser.view_link);
      } else {
        document.getElementById('laserViewLink').removeAttribute('href');
        document.getElementById('laserViewLink').textContent = 'Ссылка на результат отсутствует';
      }
    } else {
      laserSection.style.display = 'none';
    }
    // Панорама
    var panoramaSection = document.getElementById('panoramaSection');
    if (data.panorama) {
      panoramaSection.style.display = 'block';
      if (data.panorama.view_link && data.panorama.view_link !== '#' && data.panorama.view_link !== '') {
        document.getElementById('panoramaViewLink').setAttribute('href', data.panorama.view_link);
      } else {
        document.getElementById('panoramaViewLink').removeAttribute('href');
        document.getElementById('panoramaViewLink').textContent = 'Ссылка на результат отсутствует';
      }
    } else {
      panoramaSection.style.display = 'none';
    }
    // Обзорные фото
    var overviewSection = document.getElementById('overviewSection');
    if (data.overview) {
      overviewSection.style.display = 'block';
      if (data.overview.download_link && data.overview.download_link !== '#' && data.overview.download_link !== '') {
        document.getElementById('overviewDownloadLink').setAttribute('href', data.overview.download_link);
        if (data.overview.archive_name) {
          document.getElementById('overviewArchiveName').textContent = data.overview.archive_name;
        }
      } else {
        document.getElementById('overviewDownloadLink').removeAttribute('href');
        document.getElementById('overviewDownloadLink').textContent = 'Файлы для скачивания еще не добавлены';
      }
      if (data.overview.view_link && data.overview.view_link !== '#' && data.overview.view_link !== '') {
        document.getElementById('overviewViewLink').setAttribute('href', data.overview.view_link);
      } else {
        document.getElementById('overviewViewLink').removeAttribute('href');
        document.getElementById('overviewViewLink').textContent = 'Фото отсутствуют';
      }
    } else {
      overviewSection.style.display = 'none';
    }
  }
  