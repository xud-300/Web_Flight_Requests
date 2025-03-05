document.addEventListener('DOMContentLoaded', function() {
    // Открытие модального окна для создания заявки
    const createRequestBtn = document.getElementById('createRequestBtn');
    if (createRequestBtn) {
        createRequestBtn.addEventListener('click', function() {
            const modal = document.getElementById('createRequestModal');
            if (modal) {
                modal.style.display = 'block';
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

            // Если тип не выбран, сбрасываем состояние всех полей
            if (!selectedValue) {
                objectNameSelect.disabled = false;
                objectNameSelect.innerHTML = '<option value="">Выберите название</option>';
                if (piketFrom) piketFrom.disabled = false;
                if (piketTo) piketTo.disabled = false;
                return;
            }

            // Если выбран тип "ЖД" (object_type == 2), отключаем поле "Название объекта"
            if (selectedValue === "2") {
                objectNameSelect.disabled = true;
                objectNameSelect.innerHTML = '<option value="">Нет названий</option>';
            } else {
                objectNameSelect.disabled = false;
                // Выполняем AJAX-запрос для динамической подгрузки названий объектов
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

            // Если выбран тип "Городок" (object_type == 4), отключаем поля пикетов; иначе включаем их
            if (selectedValue === "4") {
                if (piketFrom) piketFrom.disabled = true;
                if (piketTo) piketTo.disabled = true;
            } else {
                if (piketFrom) piketFrom.disabled = false;
                if (piketTo) piketTo.disabled = false;
            }
        });
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
                            modal.style.display = 'none';
                        }
                        location.reload();
                    });
                } else {
                    // Если есть ошибки, показываем их
                    Swal.fire({
                        icon: 'error',
                        title: 'Ошибка создания заявки',
                        text: JSON.stringify(data.errors)
                    });
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
    }
});
