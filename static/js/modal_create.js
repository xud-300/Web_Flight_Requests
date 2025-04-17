document.addEventListener('DOMContentLoaded', function() {
    // Открытие модального окна для создания заявки
    const createRequestBtn = document.getElementById('createRequestBtn');
    if (createRequestBtn) {
        createRequestBtn.addEventListener('click', function() {
            const modal = document.getElementById('createRequestModal');
            if (modal) {
                $('#createRequestModal').modal('show');

            }
        });
    }

    // Элементы формы для динамической логики
    const objectTypeSelect = document.getElementById('id_object_type');
    const objectNameSelect = document.getElementById('id_object_name');
    const piketFrom = document.getElementById('id_piket_from');
    const piketTo = document.getElementById('id_piket_to');    

    // Динамическая подгрузка названий объектов и логика исключений
    if (objectTypeSelect) {
        objectTypeSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            console.log("Выбран тип объекта:", selectedValue);
    
            // Сброс состояния: делаем поле "Название объекта" активным и устанавливаем дефолтный текст
            objectNameSelect.disabled = false;
            objectNameSelect.innerHTML = '<option value="">Выберите название</option>';
            // Включаем поля пикетов и устанавливаем стандартные placeholder
            if (piketFrom) {
                piketFrom.disabled = false;
                piketFrom.placeholder = "0";
            }
            if (piketTo) {
                piketTo.disabled = false;
                piketTo.placeholder = "100";
            }
    
            // Если тип не выбран – выходим
            if (!selectedValue) {
                return;
            }
    
            // Если выбран тип "ЖД" (object_type == "2")
            if (selectedValue === "2") {
                objectNameSelect.disabled = true;
                objectNameSelect.innerHTML = '<option value="">Нет названий</option>';
                objectNameSelect.classList.remove('is-invalid');
                $(objectNameSelect).closest('.form-group').find('.invalid-feedback').remove();
            } else {
                // Для остальных типов делаем AJAX-подгрузку названий
                objectNameSelect.disabled = false;
                if (!window.getObjectNamesUrl) {
                    console.error("window.getObjectNamesUrl не определена!");
                    return;
                }
                const url = window.getObjectNamesUrl + '?object_type=' + selectedValue;
                console.log("Отправка запроса по URL:", url);
                fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Ошибка при запросе данных');
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log("Получены данные:", data);
                        objectNameSelect.innerHTML = '<option value="">Выберите название</option>';
                        data.forEach(item => {
                            const option = document.createElement('option');
                            option.value = item.id;
                            option.textContent = item.object_name;
                            objectNameSelect.appendChild(option);
                        });
                    })
                    .catch(error => console.error('Ошибка при загрузке названий объектов:', error));
            }
    
            // Если выбран тип "Городок" (object_type == "4"), отключаем поля пикетов; иначе, включаем их
            if (selectedValue === "4") {
                if (piketFrom) {
                    piketFrom.disabled = true;
                    piketFrom.value = "";
                    piketFrom.placeholder = "";
                }
                if (piketTo) {
                    piketTo.disabled = true;
                    piketTo.value = "";
                    piketTo.placeholder = "";
                }
                // Вместо полной перезаписи контейнера удаляем только ошибку
                const errorSpace = document.getElementById('piketErrorSpace');
                if (errorSpace) {
                    errorSpace.innerHTML = "";
                }
            } else {
                if (piketFrom) {
                    piketFrom.disabled = false;
                    piketFrom.placeholder = "0";
                }
                if (piketTo) {
                    piketTo.disabled = false;
                    piketTo.placeholder = "100";
                }
            }
        });
    }
    


    const createDateRangeInput = document.getElementById('id_create_date_range');
    if (createDateRangeInput) {
        $('#id_create_date_range').daterangepicker({
            autoApply: true,
            autoUpdateInput: false,
            minDate: moment(),
            locale: {
                format: 'DD.MM.YYYY',
                cancelLabel: 'Очистить',
                applyLabel: 'Применить',
                daysOfWeek: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
                monthNames: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
            }
        });
        

        $('#id_create_date_range').on('apply.daterangepicker', function(ev, picker) {
            const rangeText = picker.startDate.format('DD.MM.YYYY') + ' - ' + picker.endDate.format('DD.MM.YYYY');
            $(this).val(rangeText);
            $('#id_shoot_date_from').val(picker.startDate.format('YYYY-MM-DD'));
            $('#id_shoot_date_to').val(picker.endDate.format('YYYY-MM-DD'));
            
            // Убираем класс is-invalid и удаляем все элементы с ошибками в ближайшем контейнере .form-group
            $(this).removeClass('is-invalid');
            $(this).closest('.form-group').find('.invalid-feedback').remove();
        });
        
        $('#id_create_date_range').on('cancel.daterangepicker', function(ev, picker) {
            $(this).val('');
            $('#id_shoot_date_from').val('');
            $('#id_shoot_date_to').val('');
            
            $(this).removeClass('is-invalid');
            $(this).closest('.form-group').find('.invalid-feedback').remove();
        });
        

    }

    // Функция для обновления ошибок формы: удаляет старые сообщения, добавляет класс is-invalid и вставляет новые сообщения
    function updateFormErrors(form, errors) {
        // Удаляем старые ошибки: убираем все элементы .invalid-feedback
        const errorElements = form.querySelectorAll('.invalid-feedback');
        errorElements.forEach(el => el.remove());
        // Убираем класс is-invalid со всех полей
        const invalidFields = form.querySelectorAll('.is-invalid');
        invalidFields.forEach(el => el.classList.remove('is-invalid'));
        
        for (let fieldName in errors) {
            // Если это неполевая ошибка (возвращается как __all__)
            if (fieldName === '__all__') {
                const piketContainer = document.getElementById('piketContainer');
                if (piketContainer) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'invalid-feedback d-block';
                    // Выравниваем текст справа
                    errorDiv.style.textAlign = 'left';
                    errorDiv.innerHTML = errors[fieldName].join('<br>');
                    // Добавляем ошибку после блока с полями (но в пределах контейнера)
                    piketContainer.appendChild(errorDiv);
                }
                continue;
            }
            // Стандартная обработка для полей
            const field = form.querySelector('[name="' + fieldName + '"]');
            if (field) {
                field.classList.add('is-invalid');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'invalid-feedback';
                errorDiv.innerHTML = errors[fieldName].join('<br>');
                field.parentNode.appendChild(errorDiv);
            }
        }
    }
    
    

    // Функция для очистки ошибок формы
    function clearFormErrors(form) {
        // Убираем все элементы с классом invalid-feedback
        const errorElements = form.querySelectorAll('.invalid-feedback');
        errorElements.forEach(el => el.remove());
        // Убираем класс is-invalid со всех полей
        const invalidFields = form.querySelectorAll('.is-invalid');
        invalidFields.forEach(el => el.classList.remove('is-invalid'));
    }


    // Обработка отправки формы создания заявки через AJAX
    const createRequestForm = document.getElementById('createRequestForm');
    if (createRequestForm) {
        createRequestForm.addEventListener('submit', function(event) {
            event.preventDefault(); // Отменяем стандартную отправку формы
            const formData = new FormData(createRequestForm);
            fetch(createRequestForm.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Если заявка успешно создана, закрываем модальное окно и обновляем страницу
                    Swal.fire({
                        icon: 'success',
                        title: 'Заявка создана',
                        showConfirmButton: false,
                        timer: 1500
                    }).then(() => {
                        const modal = document.getElementById('createRequestModal');
                        if (modal) {
                            $('#createRequestModal').modal('hide');
                        }
                        location.reload();
                    });
                } else {
                    // Обновляем форму: подсвечиваем поля с ошибками и выводим сообщения под ними
                    updateFormErrors(createRequestForm, data.errors);
                }
            })
            .catch(error => {
                console.error('Ошибка при отправке формы:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Ошибка',
                    text: 'Произошла ошибка при отправке запроса.'
                });
            });
        });

        // --- Шаг 2: Обработчик "input" для очистки ошибок при вводе ---
        const formElements = createRequestForm.querySelectorAll('input, textarea, select');
        formElements.forEach(element => {
            element.addEventListener('input', function() {
                this.classList.remove('is-invalid');
                const errorDiv = this.parentNode.querySelector('.invalid-feedback');
                if (errorDiv) {
                    errorDiv.remove();
                }
            });
        });

        // --- Шаг 3: Обработчик для кнопки "Отменить" ---
        function clearFormErrors(form) {
            const errorElements = form.querySelectorAll('.invalid-feedback');
            errorElements.forEach(el => el.remove());
            const invalidFields = form.querySelectorAll('.is-invalid');
            invalidFields.forEach(el => el.classList.remove('is-invalid'));
        }

        const cancelBtn = document.getElementById('cancelCreateBtn');
        const createModal = document.getElementById('createRequestModal');
        if (cancelBtn && createRequestForm && createModal) {
            cancelBtn.addEventListener('click', function() {
                // Очищаем ошибки из формы
                clearFormErrors(createRequestForm);
                
                // Сбрасываем форму
                createRequestForm.reset();
                
                // Если используется Date Range Picker, очищаем и поле выбора диапазона
                const createDateRangeInput = document.getElementById('id_create_date_range');
                if (createDateRangeInput) {
                    $(createDateRangeInput).val('');
                }

                // Возвращаем поле "Название объекта" в активное состояние
                const objectNameSelect = document.getElementById('id_object_name');
                if (objectNameSelect) {
                    objectNameSelect.disabled = false;
                    objectNameSelect.innerHTML = '<option value="">Выберите название</option>';
                }
                
                // Закрываем модальное окно
                $('#createRequestModal').modal('hide');
            });
        }
    }

});

