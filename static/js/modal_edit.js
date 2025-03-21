document.addEventListener('DOMContentLoaded', function() { 
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Проверяем, начинается ли cookie с нужного имени
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
    
            // Сбрасываем поля по умолчанию
            objectNameSelect.disabled = false;
            objectNameSelect.innerHTML = '<option value="">Выберите название</option>';
            if (piketFrom) {
                piketFrom.disabled = false;
            }
            if (piketTo) {
                piketTo.disabled = false;
            }
    
            // Если тип не выбран – просто очищаем поля и выходим
            if (!selectedValue) {
                return;
            }
    
            // --- 1. Логика для "ЖД" (id = "2") ---
            if (selectedValue === "2") {
                // Отключаем и очищаем "Название объекта"
                objectNameSelect.disabled = true;
                objectNameSelect.innerHTML = '<option value="">Нет названий</option>';
                // Пикеты при "ЖД" остаются включёнными
                return;
            }
    
            // --- 2. Логика для "Городок" (id = "4") ---
            // Отличается только тем, что отключаем пикеты
            if (selectedValue === "4") {
                if (piketFrom) {
                    piketFrom.value = "";
                    piketFrom.disabled = true;
                }
                if (piketTo) {
                    piketTo.value = "";
                    piketTo.disabled = true;
                }
            }
    
            // --- 3. Общая логика для "Городок" ИЛИ "прочие" ---
            // Вызываем AJAX, чтобы подгрузить/обновить список названий
            loadObjectNames(selectedValue, objectNameSelect);
        });
    }
    
    
    // Вспомогательная функция для AJAX-загрузки названий
    function loadObjectNames(selectedValue, objectNameSelect) {
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
                // Если задан data-initial-value, устанавливаем выбранное значение
                const initialValue = objectNameSelect.getAttribute('data-initial-value');
                if (initialValue) {
                    objectNameSelect.value = initialValue;
                }
            })
            .catch(error => console.error('Ошибка при загрузке названий объектов:', error));
    }
    
    
    

    function updateFormErrors(form, errors) {
        // Убираем предыдущие ошибки
        const errorElements = form.querySelectorAll('.invalid-feedback');
        errorElements.forEach(el => el.remove());
        const invalidFields = form.querySelectorAll('.is-invalid');
        invalidFields.forEach(el => el.classList.remove('is-invalid'));
    
        // Для каждого поля с ошибками
        for (let fieldName in errors) {
            // Находим поле по имени
            const field = form.querySelector('[name="' + fieldName + '"]');
            if (field) {
                field.classList.add('is-invalid');
                // Создаем контейнер для ошибки
                const errorDiv = document.createElement('div');
                errorDiv.className = 'invalid-feedback';
                errorDiv.innerHTML = errors[fieldName].join('<br>');
                // Вставляем контейнер сразу после поля
                if (field.parentNode) {
                    // Если родитель - элемент формы, добавляем после самого поля
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
                            const editModal = document.getElementById('editRequestModal');
                            if (editModal) editModal.style.display = 'none';
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
                                const editModal = document.getElementById('editRequestModal');
                                if (editModal) editModal.style.display = 'none';
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
    
    // Обработчик для всех кнопок редактирования заявки
    const editButtons = document.querySelectorAll('.editRequestBtn');
    editButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            const requestId = this.getAttribute('data-request-id');
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
                if (formContainer) {
                    formContainer.innerHTML = html;
                    attachDynamicListeners();
                    attachEditFormSubmitHandler();
                    // Привязываем обработчик удаления после вставки HTML
                    attachDeleteRequestHandler();
            
                    const editForm = document.getElementById('editRequestForm');
                    if (editForm) {
                        const isEditable = editForm.dataset.editable;
                        console.log("Редактируемость формы:", isEditable);
                        if (isEditable && isEditable.toLowerCase() === "false") {
                            // Если редактирование запрещено, отключаем все поля и кнопки
                            const elements = editForm.querySelectorAll('input, select, textarea, button');
                            elements.forEach(el => {
                                el.disabled = true;
                            });
                            // Добавляем уведомление в начале формы
                            const notice = document.createElement('p');
                            notice.style.color = 'red';
                            notice.textContent = 'Редактирование запрещено: заявка завершена.';
                            editForm.insertBefore(notice, editForm.firstChild);
                        } else {
                            // Если редактирование разрешено, инициируем обработку типа объекта
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
                } else {
                    console.error("Контейнер editRequestFormContainer не найден");
                }
                const editModal = document.getElementById('editRequestModal');
                if (editModal) {
                    editModal.style.display = 'block';
                }
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
    });
    

    // Обработчики закрытия модального окна
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
});
