document.addEventListener('DOMContentLoaded', function() { 
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Функция для динамической подгрузки названий объектов
    function attachDynamicListeners() {
        const objectTypeSelect = document.getElementById('id_edit_object_type');
        const objectNameSelect = document.getElementById('id_edit_object_name');
        const piketFrom = document.getElementById('id_edit_piket_from');
        const piketTo = document.getElementById('id_edit_piket_to');
    
        if (!objectTypeSelect) return;
    
        objectTypeSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            console.log("Изменение типа объекта в edit modal:", selectedValue);
        
            // Сохраняем изначальное значение
            const storedInitialValue = objectNameSelect.getAttribute('data-initial-value');
        
            // Удаляем атрибут, чтобы не подставлять старое значение при последующих изменениях
            objectNameSelect.removeAttribute('data-initial-value');
        
            // Сбрасываем селект названия объекта до дефолтного значения
            objectNameSelect.innerHTML = '<option value="">Выберите название</option>';
            objectNameSelect.disabled = false;
        
            if (piketFrom) piketFrom.disabled = false;
            if (piketTo)   piketTo.disabled = false;
        
            if (!selectedValue) {
                return;
            }
        
            // Логика для "ЖД" (id = "2")
            if (selectedValue === "2") {
                objectNameSelect.disabled = true;
                objectNameSelect.innerHTML = '<option value="">Нет названий</option>';
                return;
            }
        
            // Логика для "Городок" (id = "4") — отключаем пикеты
            if (selectedValue === "4") {
                if (piketFrom) {
                    piketFrom.value = "";
                    piketFrom.placeholder = "";
                    piketFrom.disabled = true;
                }
                if (piketTo) {
                    piketTo.value = "";
                    piketTo.placeholder = "";
                    piketTo.disabled = true;
                }
            } else {
                // Для остальных типов включаем поля и возвращаем placeholder
                if (piketFrom) {
                    piketFrom.disabled = false;
                    piketFrom.placeholder = "0";
                }
                if (piketTo) {
                    piketTo.disabled = false;
                    piketTo.placeholder = "100";
                }
            }
        
            // Передаем сохранённое значение как дополнительный параметр в loadObjectNames
            loadObjectNames(selectedValue, objectNameSelect, storedInitialValue);
        });
        
        
        
        
    }
    
    
    
    // Вспомогательная функция для AJAX-загрузки названий
    function loadObjectNames(selectedValue, objectNameSelect, storedInitialValue) {
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
                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = item.object_name;
                    objectNameSelect.appendChild(option);
                });
                // Если сохранённое начальное значение существует — устанавливаем его
                if (storedInitialValue) {
                    objectNameSelect.value = storedInitialValue;
                }
            })
            .catch(error => console.error('Ошибка при загрузке названий объектов:', error));
    }
    
    
    
    
    
    
    

    function updateFormErrors(form, errors) {
        // Удаляем все элементы ошибок, кроме контейнера для пикетов
        const errorElements = form.querySelectorAll('.invalid-feedback');
        errorElements.forEach(el => {
            if (el.id !== 'piketErrorSpace') {
                el.remove();
            } else {
                // Если это контейнер для пикетов – просто очищаем его содержимое
                el.innerHTML = '';
            }
        });
        const invalidFields = form.querySelectorAll('.is-invalid');
        invalidFields.forEach(el => el.classList.remove('is-invalid'));
    
        for (let fieldName in errors) {
            // Если ошибка не привязана к конкретному полю
            if (fieldName === '__all__') {
                Swal.fire({
                    icon: 'error',
                    title: 'Ошибка',
                    html: errors[fieldName].join('<br>')
                });
                continue;
            }
            
    
            // Стандартная обработка для полей
            const field = form.querySelector('[name="' + fieldName + '"]');
            if (field) {
                field.classList.add('is-invalid');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'invalid-feedback';
                errorDiv.innerHTML = errors[fieldName].join('<br>');
                if (field.parentNode) {
                    field.parentNode.appendChild(errorDiv);
                }
            }
        }
    }
    


    // Функция для обработки отправки формы редактирования
    function attachEditFormSubmitHandler() {
        const editRequestForm = document.getElementById('editRequestForm');
        if (editRequestForm) {
            console.log("Action attribute before submission:", editRequestForm.action);
            editRequestForm.addEventListener('submit', function(event) {
                event.preventDefault();
                const formData = new FormData(editRequestForm);
                fetch(editRequestForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error("Ошибка при отправке данных формы");
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Заявка обновлена',
                            showConfirmButton: false,
                            timer: 1500
                        }).then(() => {
                            $('#editRequestModal').modal('hide');
                            location.reload();
                            });                        
                    } else {
                        updateFormErrors(editRequestForm, data.errors);
                    }
                })
                .catch(error => {
                    console.error("Ошибка при отправке формы редактирования:", error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Ошибка',
                        text: 'Произошла ошибка при отправке запроса.'
                    });
                });
            });
        }
    }
    
    function attachDeleteRequestHandler() {
        const deleteBtn = document.getElementById('deleteRequestBtn');
        console.log("Внутри attachDeleteRequestHandler, deleteBtn:", deleteBtn);
        if (!deleteBtn) {
            console.log("Кнопка удаления заявки не найдена.");
            return;
        }
        deleteBtn.addEventListener('click', function() {
            const requestId = this.getAttribute('data-request-id');
            console.log("Нажата кнопка удаления, requestId:", requestId);
            Swal.fire({
                title: 'Удалить заявку?',
                text: "Вы уверены, что хотите удалить эту заявку?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Да, удалить',
                cancelButtonText: 'Отмена'
            }).then((result) => {
                if (result.isConfirmed) {
                    const url = `/main_app/requests/delete/${requestId}/`;
                    console.log("Удаление заявки, URL:", url);
                    fetch(url, {
                        method: 'POST',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-CSRFToken': getCookie('csrftoken')
                        }
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error("Ошибка при удалении заявки");
                        }
                        return response.json();
                    })
                    .then(data => {
                        console.log("Ответ сервера при удалении:", data);
                        if (data.success) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Заявка удалена',
                                showConfirmButton: false,
                                timer: 1500
                            }).then(() => {
                                $('#editRequestModal').modal('hide');
                                location.reload();
                            });                            
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Ошибка',
                                text: data.error || "Не удалось удалить заявку."
                            });
                        }
                    })
                    .catch(error => {
                        console.error("Ошибка при удалении заявки:", error);
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


    // Функция для инициализации Date Range Picker в окне редактирования
    function attachEditDateRangePicker() {
        const editDateRangeInput = document.getElementById('id_edit_date_range');
        if (!editDateRangeInput) return;

        const shootDateFromEl = document.getElementById('id_edit_shoot_date_from');
        const shootDateToEl = document.getElementById('id_edit_shoot_date_to');
        let startDate = moment();
        let endDate = moment();

        if (shootDateFromEl && shootDateFromEl.value) {
            startDate = moment(shootDateFromEl.value, 'YYYY-MM-DD');
        }
        if (shootDateToEl && shootDateToEl.value) {
            endDate = moment(shootDateToEl.value, 'YYYY-MM-DD');
        }

        // Инициализация Date Range Picker с нужными опциями
        $('#id_edit_date_range').daterangepicker({
            autoApply: true,
            autoUpdateInput: false,
            startDate: startDate,
            endDate: endDate,
            locale: {
                format: 'DD.MM.YYYY',
                cancelLabel: 'Очистить',
                applyLabel: 'Применить',
                daysOfWeek: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
                monthNames: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
            }
        });

        // Обработчик события "apply": записываем выбранный диапазон в поле и скрытые поля
        $('#id_edit_date_range').on('apply.daterangepicker', function(ev, picker) {
            const rangeText = picker.startDate.format('DD.MM.YYYY') + ' - ' + picker.endDate.format('DD.MM.YYYY');
            $(this).val(rangeText);
            $('#id_edit_shoot_date_from').val(picker.startDate.format('YYYY-MM-DD'));
            $('#id_edit_shoot_date_to').val(picker.endDate.format('YYYY-MM-DD'));
            $(this).removeClass('is-invalid');
            $(this).closest('.form-group').find('.invalid-feedback').remove();
        });

        // Обработчик события "cancel": очищаем поле и скрытые поля
        $('#id_edit_date_range').on('cancel.daterangepicker', function(ev, picker) {
            $(this).val('');
            $('#id_edit_shoot_date_from').val('');
            $('#id_edit_shoot_date_to').val('');
            $(this).removeClass('is-invalid');
            $(this).closest('.form-group').find('.invalid-feedback').remove();
        });
    }
    function attachFieldErrorClearing(form) {
        // Находим все инпуты, селекты и текстовые поля
        const formElements = form.querySelectorAll('input, select, textarea');
        
        formElements.forEach(element => {
            element.addEventListener('input', function() {
                clearFieldError(element);
            });
            
            element.addEventListener('change', function() {
                clearFieldError(element);
            });
        });
    }
    
    function clearFieldError(field) {
        // Удаляем класс is-invalid
        field.classList.remove('is-invalid');
        // Удаляем блок с сообщением об ошибке, если он есть
        const errorDiv = field.parentNode.querySelector('.invalid-feedback');
        if (errorDiv) {
            errorDiv.remove();
        }
    }
        // Функция переключения истории
        function attachHistoryToggle() {
            const toggleBtn = $('#toggleHistoryBtn');
            const historyBlock = $('#requestHistory');
            const historyTitle = $('#historyTitle');
        
            historyTitle.hide();
            historyBlock.hide();
        
            toggleBtn.on('click', function() {
                // Плавно выезжает/уезжает заголовок
                historyTitle.slideToggle(200);
                // Плавно выезжает/уезжает сам блок истории
                historyBlock.slideToggle(200);
        
                // Меняем текст кнопки по состоянию:
                if (historyBlock.is(':visible')) {
                    toggleBtn.text('Показать историю изменений ▼');
                } else {
                    toggleBtn.text('Скрыть историю изменений ▲');
                }
            });
        }
        

    

// Делегируем клик по кнопкам редактирования заявок
document.body.addEventListener('click', function(event) {
    const btn = event.target.closest('.editRequestBtn');
    if (!btn) return;
  
    event.preventDefault();
    const requestId = btn.getAttribute('data-request-id');
    const url = `/main_app/requests/edit/${requestId}/?ajax=1`;
    console.log("Запрос редактирования по URL:", url);
  
    fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
      .then(response => {
        if (response.status === 403) {
          throw new Error("У вас нет прав для редактирования этой заявки.");
        }
        if (!response.ok) {
          throw new Error("Ошибка загрузки данных для редактирования");
        }
        return response.text();
      })
      .then(html => {
        const formContainer = document.getElementById('editRequestFormContainer');
        if (!formContainer) {
          console.error("Контейнер editRequestFormContainer не найден");
          return;
        }
  
        formContainer.innerHTML = html;
        // Инициализируем логику модалки заново
        attachDynamicListeners();
        attachEditFormSubmitHandler();
        attachDeleteRequestHandler();
        attachEditDateRangePicker();
        attachHistoryToggle();
  
        const editForm = document.getElementById('editRequestForm');
        if (editForm) {
          attachFieldErrorClearing(editForm);
  
          const isEditable = editForm.dataset.editable;
          console.log("Редактируемость формы:", isEditable);
          if (isEditable && isEditable.toLowerCase() === "false") {
            // Заблокировать все поля и кнопки
            editForm.querySelectorAll('input, select, textarea, button')
                    .forEach(el => el.disabled = true);
            const notice = document.createElement('p');
            notice.style.color = 'red';
            notice.textContent = 'Редактирование запрещено: заявка завершена.';
            editForm.insertBefore(notice, editForm.firstChild);
          } else {
            // Демо инит select-а, если нужно
            const objectTypeSelect = document.getElementById('id_edit_object_type');
            if (objectTypeSelect) {
              const initialType = objectTypeSelect.dataset.initialType;
              console.log("Initial type from dataset:", initialType);
              if (initialType === "2" || initialType === "4") {
                objectTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
          }
        }
  
        // Показываем сам модал
        $('#editRequestModal').modal('show');
      })
      .catch(error => {
        console.error("Ошибка при загрузке данных для редактирования:", error);
        Swal.fire({
          icon: 'error',
          title: 'Ошибка',
          text: error.message
        });
      });
  });
  
    

    // Обработчики закрытия модального окна
    const closeModalBtns = document.querySelectorAll('.modal .close');
    closeModalBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                $('#editRequestModal').modal('hide');

            }
        });
    });
});
