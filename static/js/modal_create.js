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

    // Динамическая подгрузка названий объектов при выборе типа в окне создания заявки
    const objectTypeSelect = document.getElementById('id_object_type');
    if (objectTypeSelect) {
        objectTypeSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            if (!selectedValue) return; // Если тип не выбран, выходим

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
});
