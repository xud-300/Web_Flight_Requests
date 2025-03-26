// Функция загрузки данных результатов (loadResultData)
// Ее вставьте в том же файле modal_result.js, перед вызовом populateResultModal или как отдельную глобальную функцию
function loadResultData(requestId) {
    const resultContent = document.getElementById('resultContent');
    const loadingIndicator = document.getElementById('loadingIndicator');
    // Показываем индикатор загрузки, скрывая разделы результатов
    if (loadingIndicator) {
        document.querySelectorAll('.result-section').forEach(sec => sec.style.display = 'none');
        loadingIndicator.style.display = 'block';
    }
    
    const url = `/main_app/requests/get_results/?request_id=${requestId}`;
    console.log("Запрос результатов по URL:", url);
    
    fetch(url, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Ошибка при загрузке данных результатов");
        }
        return response.json();
    })
    .then(data => {
        console.log("Получены данные результатов:", data);
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        populateResultModal(data);
    })
    .catch(error => {
        console.error("Ошибка при загрузке результатов:", error);
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        resultContent.innerHTML = `<p style="color: red; text-align: center;">Ошибка загрузки результатов: ${error.message}</p>`;
    });
}


// Функция для заполнения модального окна "Результаты"
function populateResultModal(data) {
    // --- Раздел: Ортофотоплан ---
    var orthoSection = document.getElementById('orthoSection');
    if (data.orthophoto) {
        orthoSection.style.display = 'block';
        if (data.orthophoto.download_link && data.orthophoto.download_link !== '#' && data.orthophoto.download_link !== '') {
            document.getElementById('orthoDownloadLink').setAttribute('href', data.orthophoto.download_link);
            if (data.orthophoto.archive_name) {
                document.getElementById('orthoArchiveName').textContent = data.orthophoto.archive_name;
            }
        } else {
            document.getElementById('orthoDownloadLink').removeAttribute('href');
            document.getElementById('orthoDownloadLink').textContent = 'Файлы для скачивания еще не добавлены';
        }
    } else {
        orthoSection.style.display = 'none';
    }

    // --- Раздел: Лазерное сканирование ---
    var laserSection = document.getElementById('laserSection');
    if (data.laser) {
        laserSection.style.display = 'block';
        if (data.laser.download_link && data.laser.download_link !== '#' && data.laser.download_link !== '') {
            document.getElementById('laserDownloadLink').setAttribute('href', data.laser.download_link);
        } else {
            document.getElementById('laserDownloadLink').removeAttribute('href');
            document.getElementById('laserDownloadLink').textContent = 'Файлы для скачивания еще не добавлены';
        }
        if (data.laser.view_link && data.laser.view_link !== '#' && data.laser.view_link !== '') {
            document.getElementById('laserViewLink').setAttribute('href', data.laser.view_link);
        } else {
            document.getElementById('laserViewLink').removeAttribute('href');
            document.getElementById('laserViewLink').textContent = 'Ссылка на результат отсутствует';
        }
    } else {
        laserSection.style.display = 'none';
    }

    // --- Раздел: Панорама ---
    var panoramaSection = document.getElementById('panoramaSection');
    if (data.panorama) {
        panoramaSection.style.display = 'block';
        if (data.panorama.view_link && data.panorama.view_link !== '#' && data.panorama.view_link !== '') {
            document.getElementById('panoramaViewLink').setAttribute('href', data.panorama.view_link);
        } else {
            document.getElementById('panoramaViewLink').removeAttribute('href');
            document.getElementById('panoramaViewLink').textContent = 'Ссылка на результат отсутствует';
        }
    } else {
        panoramaSection.style.display = 'none';
    }

    // --- Раздел: Обзорные фото ---
    var overviewSection = document.getElementById('overviewSection');
    if (data.overview) {
        overviewSection.style.display = 'block';
        if (data.overview.download_link && data.overview.download_link !== '#' && data.overview.download_link !== '') {
            document.getElementById('overviewDownloadLink').setAttribute('href', data.overview.download_link);
        } else {
            document.getElementById('overviewDownloadLink').removeAttribute('href');
            document.getElementById('overviewDownloadLink').textContent = 'Файлы для скачивания еще не добавлены';
        }
        if (data.overview.view_link && data.overview.view_link !== '#' && data.overview.view_link !== '') {
            document.getElementById('overviewViewLink').setAttribute('href', data.overview.view_link);
        } else {
            document.getElementById('overviewViewLink').removeAttribute('href');
            document.getElementById('overviewViewLink').textContent = 'Фото отсутствуют';
        }
    } else {
        overviewSection.style.display = 'none';
    }

    // --- Обработчик для кнопок "Загрузить" (uploadBtn) ---
    document.querySelectorAll('.uploadBtn').forEach(function(btn) {
        btn.removeEventListener('click', uploadBtnClickHandler);
        btn.addEventListener('click', uploadBtnClickHandler);
    });

    function uploadBtnClickHandler() {
        const type = this.getAttribute('data-type');
        console.log("Открываем форму загрузки для типа:", type);
        const uploadSection = document.getElementById(type + "Upload");
        if (uploadSection) {
            uploadSection.style.display = 'block';
        }
    }

    // --- Обработчик для кнопок "Отмена" в формах загрузки (cancelUploadBtn) ---
    document.querySelectorAll('.cancelUploadBtn').forEach(function(btn) {
        btn.removeEventListener('click', cancelUploadBtnHandler);
        btn.addEventListener('click', cancelUploadBtnHandler);
    });

    function cancelUploadBtnHandler() {
        const type = this.getAttribute('data-type');
        console.log("Закрываем форму загрузки для типа:", type);
        const uploadSection = document.getElementById(type + "Upload");
        if (uploadSection) {
            uploadSection.style.display = 'none';
        }
    }

    // --- Обработчик отправки форм загрузки для каждого типа ---
    ['ortho', 'laser', 'panorama', 'overview'].forEach(function(type) {
        const form = document.getElementById(type + "UploadForm");
        if (form) {
            form.removeEventListener('submit', uploadFormHandler);
            form.addEventListener('submit', uploadFormHandler);
        }
        function uploadFormHandler(event) {
            event.preventDefault();
            const requestId = this.getAttribute('data-request-id');
            const formData = new FormData(this);
            formData.append('upload_type', type);
            formData.append('request_id', requestId);
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            fetch('/main_app/requests/upload_result/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Ошибка загрузки результатов');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    console.log("Результаты успешно загружены:", data.data);
                    const uploadSection = document.getElementById(type + "Upload");
                    if (uploadSection) {
                        uploadSection.style.display = 'none';
                    }
                    loadResultData(requestId);
                } else {
                    alert("Ошибка: " + data.error);
                }
            })
            .catch(error => {
                console.error(error);
                alert("Произошла ошибка при загрузке результатов.");
            });
        }
    });
}


