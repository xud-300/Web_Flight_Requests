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
    
    // --- Закрытие модальных окон ---
    const closeModalBtns = document.querySelectorAll('.modal .close');
    closeModalBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(function(modal) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
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
        const massUpdateButton = document.getElementById('massUpdateButton');
        let newStatus = "";

        if (selectedStatus === "В работе") {
            newStatus = "завершена";
            massUpdateMessage.textContent = "Вы выбрали заявки со статусом 'В работе'. Нажмите кнопку, чтобы перевести их в статус 'Выполнена'.";
            massUpdateButton.textContent = "Перевести в Выполнена";
        } else if (selectedStatus === "Выполнена") {
            newStatus = "новая";
            massUpdateMessage.textContent = "Вы выбрали заявки со статусом 'Выполнена'. Нажмите кнопку, чтобы перевести их в статус 'В работе'.";
            massUpdateButton.textContent = "Перевести в В работе";
        }

        massUpdateButton.setAttribute('data-new-status', newStatus);
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
    
            // Переключаем выделение строки и класса "active" у бейджа
            if (row.classList.contains('selected')) {
                row.classList.remove('selected');
                selectedRequestIds = selectedRequestIds.filter(id => id !== requestId);
                badge.classList.remove('active');
                // Добавляем временно класс no-hover, чтобы убрать эффект hover после снятия выбора
                badge.classList.add('no-hover');
                setTimeout(function() {
                    badge.classList.remove('no-hover');
                }, 300);
                // Если больше ни одна заявка не выбрана, сбрасываем группу и скрываем панель
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
            
            // Показываем панель, если выбраны заявки; иначе — скрываем
            if (selectedRequestIds.length > 0) {
                showMassUpdatePanel();
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
                            if (newStatus === 'завершена') {
                                badge.textContent = 'Выполнена';
                                badge.classList.remove('badge-success');
                                badge.classList.add('badge-secondary');
                            } else if (newStatus === 'новая') {
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
    const massUpdateCancelButton = document.getElementById('massUpdateCancelButton');
    if (massUpdateCancelButton) {
        massUpdateCancelButton.addEventListener('click', function(event) {
            document.querySelectorAll('tr.selected').forEach(function(row) {
                row.classList.remove('selected');
            });
            selectedRequestIds = [];
            selectedGroupStatus = null;
            enableAllBadges();
            hideMassUpdatePanel();
        });
    }
});
