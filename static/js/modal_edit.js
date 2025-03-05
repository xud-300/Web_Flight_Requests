document.addEventListener('DOMContentLoaded', function() {
    // Обработчик для всех кнопок редактирования заявки
    const editButtons = document.querySelectorAll('.editRequestBtn');
    editButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            const requestId = this.getAttribute('data-request-id');
            // Формируем URL для запроса с параметром ajax=1
            const url = `/main_app/requests/edit/${requestId}/?ajax=1`;
            console.log("Запрос редактирования по URL:", url);
            fetch(url, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error("Ошибка загрузки данных для редактирования");
                }
                return response.text();
            })
            .then(html => {
                // Вставляем полученный HTML в контейнер с id "editRequestFormContainer"
                const formContainer = document.getElementById('editRequestFormContainer');
                if (formContainer) {
                    formContainer.innerHTML = html;
                } else {
                    console.error("Контейнер editRequestFormContainer не найден");
                }
                // Открываем модальное окно
                const editModal = document.getElementById('editRequestModal');
                if (editModal) {
                    editModal.style.display = 'block';
                }
            })
            .catch(error => {
                console.error("Ошибка при загрузке данных для редактирования:", error);
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
