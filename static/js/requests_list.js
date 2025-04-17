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
            hideMassUpdatePanel();
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
    document.querySelectorAll('.selectable-status').forEach(function(badge) {
        badge.addEventListener('click', function(event) {
            const requestId = badge.getAttribute('data-request-id');
            const row = badge.closest('tr');
            const rowStatus = badge.textContent.trim();
    
            if (!selectedGroupStatus) {
                selectedGroupStatus = rowStatus;
                disableOppositeBadges(selectedGroupStatus);
                updateMassUpdatePanel(selectedGroupStatus);
            }
    
            if (rowStatus !== selectedGroupStatus) {
                return;
            }
    
            if (row.classList.contains('selected')) {
                row.classList.remove('selected');
                selectedRequestIds = selectedRequestIds.filter(id => id !== requestId);
                badge.classList.remove('active');
                badge.classList.add('no-hover');
                setTimeout(function() {
                    badge.classList.remove('no-hover');
                }, 300);
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
    
            if (selectedRequestIds.length > 0) {
                showMassUpdatePanel();
                updateMassUpdatePanel(selectedGroupStatus);
            } else {
                hideMassUpdatePanel();
            }
        });
    });
    
    

    // Обработчик кнопки "Обновить статус"
    const massUpdateButton = document.getElementById('massUpdateButton');
    if (massUpdateButton) {
        massUpdateButton.addEventListener('click', function(event) {
            const newStatus = massUpdateButton.getAttribute('data-new-status');
            if (!newStatus) {
                alert('Невозможно определить новый статус.');
                return;
            }
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
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
                    selectedRequestIds.forEach(function(id) {
                        const badge = document.querySelector('.selectable-status[data-request-id="' + id + '"]');
                        if (badge) {
                            if (newStatus === 'Выполнена') {
                                badge.textContent = 'Выполнена';
                                badge.classList.remove('badge-success');
                                badge.classList.add('badge-secondary');
                            } else if (newStatus === 'В работе') {
                                badge.textContent = 'В работе';
                                badge.classList.remove('badge-secondary');
                                badge.classList.add('badge-success');
                            }
                            // Получаем строку через .closest('tr')
                            const row = badge.closest('tr');
                            row.classList.remove('selected');
                        }
                    });
                    // Сброс
                    selectedRequestIds = [];
                    selectedGroupStatus = null;
                    enableAllBadges();
                    hideMassUpdatePanel();
                } else {
                    alert('Ошибка обновления: ' + data.error);
                }
            })
            .catch(error => {
                console.error(error);
                alert('Произошла ошибка при обновлении статуса.');
            });
        });
    }

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
                            Swal.fire({
                                icon: 'success',
                                title: 'Заявки удалены',
                                showConfirmButton: false,
                                timer: 1500
                            }).then(() => {
                                location.reload();
                            });
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
