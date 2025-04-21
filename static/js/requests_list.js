document.addEventListener('DOMContentLoaded', function() {
    // --- Восстановление состояния панелей фильтрации и сортировки из localStorage ---
    const filterPanel = document.getElementById('filterPanel');
    const sortPanel = document.getElementById('sortPanel');
    if (filterPanel && localStorage.getItem('filterPanelOpen') === 'true') {
        filterPanel.classList.add('show');
    }
    if (sortPanel && localStorage.getItem('sortPanelOpen') === 'true') {
        sortPanel.classList.add('show');
    }
    
    // --- Обработчики для обновления состояния панелей при их переключении ---
    $('#filterPanel').on('shown.bs.collapse hidden.bs.collapse', function () {
        localStorage.setItem('filterPanelOpen', $(this).hasClass('show'));
    });
    $('#sortPanel').on('shown.bs.collapse hidden.bs.collapse', function () {
        localStorage.setItem('sortPanelOpen', $(this).hasClass('show'));
    });
    
    
  // Обработчик для кнопок "Результат"
  document.querySelectorAll('.resultBtn').forEach(function(button) {
    button.addEventListener('click', function() {
      const requestId = button.getAttribute('data-request-id');
      console.log("Открываем модальное окно для заявки с ID:", requestId);
      
      // Открываем модальное окно (если используется Bootstrap, например, через jQuery)
      $('#resultModal').modal('show');
      
      // Если нужно динамически подгружать данные, можно вызвать функцию:
      loadResultData(requestId);
    });
  });

// Пример функции загрузки данных для модального окна (заглушка)
window.loadResultData = function(requestId) {
    const url = `/main_app/requests/get_results/?request_id=${requestId}`;
    console.log("Запрос результатов по URL:", url);
  
    fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' }})
      .then(response => {
        if (!response.ok) {
            throw new Error("Ошибка при загрузке данных результатов");
        }
        return response.json();
      })
      .then(data => {
        console.log("Получены данные результатов:", data);
        // populateResultModal(data) можно тоже сделать глобальной, если она в другом файле
        populateResultModal(data);
        // setRequestIdInForms(requestId) тоже будет работать, если она доступна
        setRequestIdInForms(requestId);
      })
      .catch(error => {
        console.error("Ошибка при загрузке результатов:", error);
        document.getElementById('resultContent').innerHTML = `<p style="color: red;">Ошибка загрузки результатов: ${error.message}</p>`;
      });
  };



// Словарь для хранения удалённых строк (mass delete)
const removedRows = {};

// Словарь для хранения старых статусов (mass status)
const statusActions = {};


// показываем кнопку «Отменить» внутри massUpdatePanel
function showUndoInPanel(actionId) {
    undoActive = true;                           // <<< включили блокировку выбора
    $('#massUpdatePanel').collapse('show');
  
    // спрячем дефолтные кнопки и сообщение
    document.getElementById('massUpdateMessage').innerHTML = '';
    document.getElementById('massUpdateButtons').innerHTML = '';
    document.getElementById('massResetButton').style.display = 'none';
    document.getElementById('massDeleteButton').style.display = 'none';
  
    // создаём Undo‑кнопку с таймером
    const undoBtn = document.createElement('button');
    undoBtn.className = 'btn btn-warning btn-sm';
    let timer = 5;
    undoBtn.textContent = `Отменить (${timer}s)`;
    document.getElementById('massUpdateButtons').appendChild(undoBtn);
  
    const intervalId = setInterval(() => {
        timer--;
        if (timer === 0) {
          clearInterval(intervalId);
          undoActive = false;  // снимаем блокировку выбора бейджей
      
          // плавно сворачиваем панель и после её скрытия восстанавливаем кнопки и бейджи
          $('#massUpdatePanel')
            .collapse('hide')
            .one('hidden.bs.collapse', function() {
              // восстанавливаем дефолтные кнопки
              document.getElementById('massResetButton').style.display = '';
              document.getElementById('massDeleteButton').style.display = '';
              // разблокируем бейджи
              enableAllBadges();
              // снимаем этот разовый обработчик
              $(this).off('hidden.bs.collapse');
            });
        } else {
          undoBtn.textContent = `Отменить (${timer}s)`; 
        }
      }, 1000);
  
    undoBtn.addEventListener('click', () => {
      clearInterval(intervalId);
      // плавно сворачиваем панель
      $('#massUpdatePanel')
        .collapse('hide')
        .one('hidden.bs.collapse', function() {
          // сбросим всё в дефолт
          undoActive = false;                               // <<< снимаем блокировку
          document.getElementById('massUpdateMessage').innerHTML = '';
          document.getElementById('massUpdateButtons').innerHTML = '';
          document.getElementById('massResetButton').style.display = '';
          document.getElementById('massDeleteButton').style.display = '';
          $(this).off('hidden.bs.collapse');
        });
      
      // AJAX‑отмена на сервере
      fetch(`/main_app/requests/undo/${actionId}/`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value,
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
        .then(r => r.json())
        .then(data => {
          if (!data.success) {
            return alert(data.error);
          }
      
          // 4a) Если были массовые удаления — восстанавливаем строки
          if (removedRows[actionId]) {
            const tbody = document.querySelector('tbody');
            removedRows[actionId].forEach(({ html, rowIndex }) => {
              const temp = document.createElement('tbody');
              temp.innerHTML = html;
              const newRow = temp.querySelector('tr');
              // вставляем на своё место
              const ref = tbody.children[rowIndex] || null;
              tbody.insertBefore(newRow, ref);
          
              // --- Очищаем эффект "нажатости" ---
              newRow.classList.remove('selected');
              const badge = newRow.querySelector('.selectable-status');
              if (badge) {
                badge.classList.remove('active', 'no-hover');
                // если нужно, можно ещё явно вернуть pointerEvents и opacity
                badge.style.pointerEvents = '';
                badge.style.opacity = '';
              }
            });
            delete removedRows[actionId];
          }
          
          
      
          // 4b) Если была массовая смена статуса — восстанавливаем бейджи
          if (statusActions[actionId]) {
            statusActions[actionId].forEach(({ id, oldStatus }) => {
              const badge = document.querySelector(`.selectable-status[data-request-id="${id}"]`);
              if (!badge) return;
              badge.textContent = oldStatus;
              badge.classList.remove('badge-success','badge-primary','badge-secondary');
              if (oldStatus === 'Новая')        badge.classList.add('badge-success');
              else if (oldStatus === 'В работе')  badge.classList.add('badge-primary');
              else if (oldStatus === 'Выполнена') badge.classList.add('badge-secondary');
            });
            delete statusActions[actionId];
          }
        })
        .catch(err => {
          console.error(err);
          alert('Не удалось отменить действие');
        });
      });  
  }
  

// Функция для установки data-request-id во все формы загрузки в модальном окне
function setRequestIdInForms(requestId) {
    ['ortho', 'laser', 'panorama', 'overview'].forEach(function(type) {
      var form = document.getElementById(type + "UploadForm");
      if (form) {
        form.setAttribute('data-request-id', requestId);
        console.log("Установили data-request-id =", requestId, "для формы", type + "UploadForm");
      }
    });
  }
  
    // --- Фильтрация: динамическая подгрузка названий объектов ---
    const objectTypeFilter = document.getElementById('objectTypeFilter');
    const objectNameFilterContainer = document.getElementById('objectNameFilterContainer');
    const objectNameFilter = document.getElementById('objectNameFilter');
    if (objectTypeFilter) {
        objectTypeFilter.addEventListener('change', function() {
            const selectedValue = this.value;
            console.log("Фильтр: выбран тип объекта:", selectedValue);
            if (selectedValue) {
                objectNameFilterContainer.style.display = 'block';
                if (!window.getObjectNamesUrl) {
                    console.error("window.getObjectNamesUrl не определена!");
                    return;
                }
                const url = window.getObjectNamesUrl + '?object_type=' + selectedValue;
                console.log("Отправка запроса для фильтра по URL:", url);
                fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Ошибка при запросе данных');
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log("Получены данные для фильтра:", data);
                        objectNameFilter.innerHTML = '<option value="">Выберите название</option>';
                        data.forEach(item => {
                            const option = document.createElement('option');
                            option.value = item.id;
                            option.textContent = item.object_name;
                            objectNameFilter.appendChild(option);
                        });
                    })
                    .catch(error => console.error('Ошибка при загрузке названий объектов:', error));
            } else {
                objectNameFilterContainer.style.display = 'none';
                objectNameFilter.innerHTML = '<option value="">Выберите название</option>';
            }
        });
    }
    
    // Инициализация Date Range Picker
    $('#dateRangeFilter').daterangepicker({
        autoApply: true,              // не требует кнопки "Apply"
        autoUpdateInput: false,       // поле заполняем вручную
        locale: {
            format: 'DD.MM.YYYY',     // виджет будет парсить/отображать этот формат
            cancelLabel: 'Очистить',
            applyLabel: 'Применить',
            daysOfWeek: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
            monthNames: [
                'Январь','Февраль','Март','Апрель','Май','Июнь',
                'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
            ]
        }
    });

    // Обработка события "apply"
    $('#dateRangeFilter').on('apply.daterangepicker', function(ev, picker) {
        // Формируем человекочитаемую строку
        const rangeText = picker.startDate.format('DD.MM.YYYY') + ' - ' + picker.endDate.format('DD.MM.YYYY');
        // Устанавливаем в поле
        $(this).val(rangeText);
        // Сохраняем в скрытых полях в формате "YYYY-MM-DD"
        document.getElementById('shoot_date_from').value = picker.startDate.format('YYYY-MM-DD');
        document.getElementById('shoot_date_to').value = picker.endDate.format('YYYY-MM-DD');
    });

    // Обработка события "cancel" (очистка)
    $('#dateRangeFilter').on('cancel.daterangepicker', function(ev, picker) {
        $(this).val('');
        document.getElementById('shoot_date_from').value = '';
        document.getElementById('shoot_date_to').value = '';
    });

    // --- Синхронизация при загрузке страницы ---
    const hiddenFrom = document.getElementById('shoot_date_from').value;
    const hiddenTo = document.getElementById('shoot_date_to').value;
    if (hiddenFrom && hiddenTo) {
        // Формируем строку для отображения в поле
        const formattedFrom = moment(hiddenFrom, 'YYYY-MM-DD').format('DD.MM.YYYY');
        const formattedTo = moment(hiddenTo, 'YYYY-MM-DD').format('DD.MM.YYYY');
        $('#dateRangeFilter').val(formattedFrom + ' - ' + formattedTo);

        // Синхронизируем внутреннее состояние виджета
        const picker = $('#dateRangeFilter').data('daterangepicker');
        if (picker) {
            picker.setStartDate(moment(hiddenFrom, 'YYYY-MM-DD'));
            picker.setEndDate(moment(hiddenTo, 'YYYY-MM-DD'));
        }
    }

    // --- Массовое обновление статуса заявок для администратора ---

    let selectedRequestIds = [];
    let selectedGroupStatus = null;
    let undoActive = false;

    function disableOppositeBadges(selectedStatus) {
        document.querySelectorAll('.selectable-status').forEach(function(badge) {
            const rowStatus = badge.textContent.trim();
            if (rowStatus !== selectedStatus) {
                badge.classList.add('disabled-badge');
                badge.style.pointerEvents = 'none';
                badge.style.opacity = '0.5';
                const row = badge.closest('tr');
                if (row) {
                    row.classList.add('disabled-row');
                }
            }
        });
    }

    function enableAllBadges() {
        document.querySelectorAll('.selectable-status').forEach(function(badge) {
            badge.classList.remove('disabled-badge');
            badge.style.pointerEvents = 'auto';
            badge.style.opacity = '1';
            const row = badge.closest('tr');
            if (row) {
                row.classList.remove('disabled-row');
            }
        });
    }

    function updateMassUpdatePanel(selectedStatus) {
        const massUpdateMessage = document.getElementById('massUpdateMessage');
        const buttonsContainer = document.getElementById('massUpdateButtons');
    
        // Очищаем контейнер кнопок
        buttonsContainer.innerHTML = '';
    
        // Формируем сообщение, например, "Выбраны 3 заявки со статусом «В работе». Выберите действие:"
        massUpdateMessage.innerHTML = `Выбраны ${selectedRequestIds.length} заявок со статусом <strong>${selectedStatus}</strong>. Выберите действие:`;
    
        // Дальше — генерируем кнопки для перевода статуса
        if (selectedStatus === "Новая") {
            const btnWork = document.createElement('button');
            btnWork.className = 'btn btn-primary mr-2';
            btnWork.innerHTML = "Перевести в <strong>'В работе'</strong>";
            btnWork.setAttribute('data-new-status', 'В работе');
            buttonsContainer.appendChild(btnWork);
        } 
        else if (selectedStatus === "В работе") {
            const btnDone = document.createElement('button');
            btnDone.className = 'btn btn-primary mr-2';
            btnDone.innerHTML = "Перевести в <strong>'Выполнена'</strong>";
            btnDone.setAttribute('data-new-status', 'Выполнена');
            buttonsContainer.appendChild(btnDone);
    
            const btnNew = document.createElement('button');
            btnNew.className = 'btn btn-primary mr-2';
            btnNew.innerHTML = "Перевести в <strong>'Новая'</strong>";
            btnNew.setAttribute('data-new-status', 'Новая');
            buttonsContainer.appendChild(btnNew);
        }
        else if (selectedStatus === "Выполнена") {
            const btnWork = document.createElement('button');
            btnWork.className = 'btn btn-primary mr-2';
            btnWork.innerHTML = "Перевести в <strong>'В работе'</strong>";
            btnWork.setAttribute('data-new-status', 'В работе');
            buttonsContainer.appendChild(btnWork);
    
            const btnNew = document.createElement('button');
            btnNew.className = 'btn btn-primary mr-2';
            btnNew.innerHTML = "Перевести в <strong>'Новая'</strong>";
            btnNew.setAttribute('data-new-status', 'Новая');
            buttonsContainer.appendChild(btnNew);
        }
    
        // Привязываем обработчики к этим кнопкам
        buttonsContainer.querySelectorAll('button').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const newStatus = btn.getAttribute('data-new-status');
                massUpdateStatusAjax(newStatus);
            });
        });
    }
    
    
// Функция для отправки AJAX-запроса на массовое обновление статуса
function massUpdateStatusAjax(newStatus) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    // Схватим текущие статусы, чтобы потом восстановить
    const oldStatuses = selectedRequestIds.map(id => {
      const badge = document.querySelector(`.selectable-status[data-request-id="${id}"]`);
      return { id, oldStatus: badge ? badge.textContent.trim() : null };
    });
    fetch('/main_app/requests/mass_update_status/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
            request_ids: selectedRequestIds,
            new_status: newStatus
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Ошибка обновления статуса');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            statusActions[data.action_id] = oldStatuses;
            // Обновляем отображение статуса в таблице
            selectedRequestIds.forEach(function(id) {
                const badge = document.querySelector('.selectable-status[data-request-id="' + id + '"]');
                if (badge) {
                    if (newStatus === 'В работе') {
                        // Устанавливаем для "В работе" – синий
                        badge.textContent = 'В работе';
                        badge.classList.remove('badge-success', 'badge-secondary');
                        badge.classList.add('badge-primary');
                    } else if (newStatus === 'Выполнена') {
                        badge.textContent = 'Выполнена';
                        badge.classList.remove('badge-success', 'badge-primary');
                        badge.classList.add('badge-secondary');
                    } else if (newStatus === 'Новая') {
                        badge.textContent = 'Новая';
                        badge.classList.remove('badge-primary', 'badge-secondary');
                        badge.classList.add('badge-success');
                    }
                    
                    const row = badge.closest('tr');
                    if (row) {
                        row.classList.remove('selected');
                    }
                }
            });
            // Сброс выделения
            selectedRequestIds = [];
            selectedGroupStatus = null;
            enableAllBadges();
            showUndoInPanel(data.action_id);
        } else {
            alert('Ошибка обновления: ' + data.error);
        }
    })
    .catch(error => {
        console.error(error);
        alert('Произошла ошибка при обновлении статуса.');
    });
}
    

    // Показываем панель анимацией
    function showMassUpdatePanel() {
        $('#massUpdatePanel').collapse('show');
    }

    // Скрываем панель анимацией
    function hideMassUpdatePanel() {
        $('#massUpdatePanel').collapse('hide');
    }

    // При клике на бейдж статуса
// При клике на бейдж статуса
document.querySelectorAll('.selectable-status').forEach(function(badge) {
    badge.addEventListener('click', function(event) {
        // 0) Если сейчас активен Undo — ничего не делаем
        if (undoActive) return;

        const requestId = badge.getAttribute('data-request-id');
        const row = badge.closest('tr');
        const rowStatus = badge.textContent.trim();

        // 1) Если ещё не задана группа — начинаем выбор
        if (!selectedGroupStatus) {
            selectedGroupStatus = rowStatus;
            disableOppositeBadges(selectedGroupStatus);
            updateMassUpdatePanel(selectedGroupStatus);
        }

        // 2) Если кликнули по статусу не из текущей группы — игнорируем
        if (rowStatus !== selectedGroupStatus) {
            return;
        }

        // 3) Переключаем выделение этой строки
        if (row.classList.contains('selected')) {
            row.classList.remove('selected');
            selectedRequestIds = selectedRequestIds.filter(id => id !== requestId);
            badge.classList.remove('active');
            badge.classList.add('no-hover');
            setTimeout(() => badge.classList.remove('no-hover'), 300);

            // Если больше ничего не выделено — сбрасываем всё
            if (selectedRequestIds.length === 0) {
                selectedGroupStatus = null;
                enableAllBadges();
                hideMassUpdatePanel();
            }
        } else {
            row.classList.add('selected');
            selectedRequestIds.push(requestId);
            badge.classList.add('active');
        }

        // 4) Показываем или скрываем панель в зависимости от наличия выделений
        if (selectedRequestIds.length > 0) {
            showMassUpdatePanel();
            updateMassUpdatePanel(selectedGroupStatus);
        } else {
            hideMassUpdatePanel();
        }
    });
});

    
    

 

    // Обработчик кнопки "Сбросить выбор"
    const massResetButton = document.getElementById('massResetButton');
    if (massResetButton) {
        massResetButton.addEventListener('click', function(event) {
            // 1. Убираем класс 'selected' у всех строк
            document.querySelectorAll('tr.selected').forEach(function(row) {
                row.classList.remove('selected');
            });
            // 2. Убираем класс 'active' у всех бейджей
            document.querySelectorAll('.selectable-status.active').forEach(function(badge) {
                badge.classList.remove('active');
            });
            // 3. Сбрасываем массив выбранных заявок и статус группы
            selectedRequestIds = [];
            selectedGroupStatus = null;
            // 4. Восстанавливаем кликабельность всех бейджей
            enableAllBadges();
            // 5. Скрываем панель массового обновления
            hideMassUpdatePanel();
        });
    }
    

    // Пример JS-обработчика
    const massDeleteButton = document.getElementById('massDeleteButton');
    if (massDeleteButton) {
        massDeleteButton.addEventListener('click', function() {
            // 1. Проверяем, выбраны ли заявки
            if (selectedRequestIds.length === 0) {
                Swal.fire({
                    icon: 'info',
                    title: 'Ничего не выбрано',
                    text: 'Вы не выбрали ни одной заявки для удаления.'
                });
                return;
            }

            // 2. Показываем окно подтверждения
            Swal.fire({
                title: 'Удалить заявки?',
                text: "Вы уверены, что хотите удалить выбранные заявки?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Да, удалить',
                cancelButtonText: 'Отмена'
            }).then((result) => {
                if (result.isConfirmed) {
                    // 3. Если пользователь нажал "Да, удалить", отправляем запрос
                    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
                    fetch('/main_app/requests/mass_delete/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken,
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        body: JSON.stringify({ request_ids: selectedRequestIds })
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Ошибка при удалении заявок');
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.success) {
                          // 1) Собираем удаляемые строки в память
                          removedRows[data.action_id] = selectedRequestIds.map(id => {
                            const row   = document.querySelector(`.selectable-status[data-request-id="${id}"]`).closest('tr');
                            const html  = row.outerHTML;
                            const tbody = row.parentNode;
                            // запоминаем индекс строки внутри <tbody>
                            const rowIndex = Array.prototype.indexOf.call(tbody.children, row);
                            row.remove();
                            return { id, html, rowIndex };
                          });
                          
                      
                          // 2) Сбрасываем текущее выделение
                          selectedRequestIds = [];
                          selectedGroupStatus = null;
                          enableAllBadges();
                      
                          // 3) Показываем Undo‑кнопку
                          showUndoInPanel(data.action_id);
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Ошибка',
                                text: data.error || "Не удалось удалить заявки."
                            });
                        }
                    })
                    .catch(error => {
                        console.error("Ошибка при удалении заявок:", error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Ошибка',
                            text: error.message
                        });
                    });
                }
            });
        });
    }


});
