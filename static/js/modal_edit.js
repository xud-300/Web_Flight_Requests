document.addEventListener('DOMContentLoaded', function() {
    // Открытие модального окна для редактирования заявки
    const editButtons = document.querySelectorAll('.editRequestBtn');
    editButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            const requestId = this.getAttribute('data-request-id');
            // Здесь можно реализовать AJAX-запрос для загрузки данных заявки и истории изменений,
            // затем заполнить поля формы в окне редактирования.
            const editModal = document.getElementById('editRequestModal');
            if (editModal) {
                // Пример: устанавливаем action формы, если требуется
                // document.getElementById('editRequestForm').action = `/main_app/requests/edit/${requestId}/`;
                editModal.style.display = 'block';
            }
        });
    });
});
