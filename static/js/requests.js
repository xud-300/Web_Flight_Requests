document.addEventListener('DOMContentLoaded', function() {
    // Динамическая подгрузка названий объектов при выборе типа
    const objectTypeSelect = document.getElementById('id_object_type');
    if (objectTypeSelect) {
        objectTypeSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            if (!selectedValue) return;  // Если тип не выбран, ничего не делаем

            const url = window.getObjectNamesUrl + '?object_type=' + selectedValue;

            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Ошибка при запросе данных');
                    }
                    return response.json();
                })
                .then(data => {
                    const objectNameSelect = document.getElementById('id_object_name');
                    // Очищаем предыдущие варианты
                    objectNameSelect.innerHTML = '<option value="">Выберите название</option>';
                    data.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item.id;
                        option.textContent = item.object_name;
                        objectNameSelect.appendChild(option);
                    });
                })
                .catch(error => console.error('Ошибка при загрузке названий объектов:', error));
        });
    }

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

    // Закрытие модального окна при клике на элемент с классом .close
    const closeModalBtns = document.querySelectorAll('.modal .close');
    closeModalBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Дополнительно можно добавить закрытие модального окна по клику вне его содержимого:
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(function(modal) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Если хотите реализовать отправку формы через AJAX, можно добавить обработчик события submit для формы
    // Например:
    /*
    const createRequestForm = document.getElementById('createRequestForm');
    if (createRequestForm) {
        createRequestForm.addEventListener('submit', function(event) {
            event.preventDefault(); // отменяем стандартную отправку формы
            const formData = new FormData(this);
            fetch(this.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Перезагрузить страницу или обновить таблицу заявок динамически
                    window.location.reload();
                } else {
                    alert(data.message);
                }
            })
            .catch(error => console.error('Ошибка при отправке формы:', error));
        });
    }
    */
});
