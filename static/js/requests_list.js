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
});
