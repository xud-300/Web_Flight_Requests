document.addEventListener('DOMContentLoaded', function() { 
    // Функция для динамической подгрузки названий объектов
    function attachDynamicListeners() {
        const objectTypeSelect = document.getElementById('id_edit_object_type');
        const objectNameSelect = document.getElementById('id_edit_object_name');
        const piketFrom = document.getElementById('id_edit_piket_from');
        const piketTo = document.getElementById('id_edit_piket_to');

        if (objectTypeSelect) {
            objectTypeSelect.addEventListener('change', function() {
                const selectedValue = this.value;
                console.log("Изменение типа объекта в edit modal, новое значение:", selectedValue);

                // Очистка выбранного значения и опций для Названия объекта
                objectNameSelect.value = "";
                objectNameSelect.innerHTML = '<option value="">Выберите название</option>';

                // Если тип не выбран – активируем все поля и выходим
                if (!selectedValue) {
                    objectNameSelect.disabled = false;
                    if (piketFrom) {
                        piketFrom.disabled = false;
                        piketFrom.value = "";
                    }
                    if (piketTo) {
                        piketTo.disabled = false;
                        piketTo.value = "";
                    }
                    return;
                }

                // Если выбран тип "ЖД" (например, id === "2")
                if (selectedValue === "2") {
                    objectNameSelect.disabled = true;
                    objectNameSelect.innerHTML = '<option value="">Нет названий</option>';
                } else {
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

                // Если выбран тип "Городок" (например, id === "4"), очищаем и отключаем поля пикетов
                if (selectedValue === "4") {
                    if (piketFrom) {
                        piketFrom.value = "";
                        piketFrom.disabled = true;
                    }
                    if (piketTo) {
                        piketTo.value = "";
                        piketTo.disabled = true;
                    }
                } else {
                    if (piketFrom) {
                        piketFrom.disabled = false;
                    }
                    if (piketTo) {
                        piketTo.disabled = false;
                    }
                }
            });
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
                        Swal.fire({
                            icon: 'error',
                            title: 'Ошибка обновления заявки',
                            text: JSON.stringify(data.errors)
                        });
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
