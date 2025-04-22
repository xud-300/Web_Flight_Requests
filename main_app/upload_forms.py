from django import forms 
from .models import FlightResultFile
import os

# Функция для проверки расширения файла
def validate_file_extension(value, allowed_extensions):
    ext = os.path.splitext(value.name)[1].lower()
    if ext.startswith('.'):
        ext = ext[1:]
    if ext not in allowed_extensions:
        raise forms.ValidationError(
            f"Файл с расширением .{ext} не разрешён. Допустимые расширения: {', '.join(allowed_extensions)}."
        )

class OrthoUploadForm(forms.Form):
    orthoFile = forms.FileField(label="Выберите файл для ортофотоплана")

    def clean_orthoFile(self):
        file = self.cleaned_data.get('orthoFile')
        allowed_extensions = ['dwg', 'dxf', 'tif', 'zip', 'rar', '7z', 'sit']
        validate_file_extension(file, allowed_extensions)
        # Проверка размера файла (5 ГБ)
        max_size = 5 * 1024 * 1024 * 1024
        if file.size > max_size:
            raise forms.ValidationError("Размер файла не должен превышать 5 ГБ.")
        return file

class LaserUploadForm(forms.Form):
    laserFile = forms.FileField(label="Выберите файл для лазерного сканирования")
    laserViewInput = forms.URLField(label="Ссылка для просмотра результата", required=False)

    def clean_laserFile(self):
        file = self.cleaned_data.get('laserFile')
        allowed_extensions = ['dwg', 'dxf', 'las', 'zip', 'rar', '7z', 'sit']
        validate_file_extension(file, allowed_extensions)
        max_size = 15 * 1024 * 1024 * 1024  # 15 ГБ
        if file.size > max_size:
            raise forms.ValidationError("Размер файла не должен превышать 15 ГБ.")
        return file

class PanoramaUploadForm(forms.Form):
    panoramaViewInput = forms.URLField(label="Ссылка для просмотра панорамы", required=True)


from django.forms.widgets import ClearableFileInput

class MultiFileInput(ClearableFileInput):
    allow_multiple_selected = True

class OverviewUploadForm(forms.Form):
    overviewFiles = forms.FileField(
        widget=forms.ClearableFileInput(),
        label="Выберите архив"
    )

    def clean_overviewFiles(self):
        # Получаем файл из запроса (т.к. множественный выбор отключён, используем get, а не getlist)
        file = self.files.get('overviewFiles')
        if not file:
            raise forms.ValidationError("Не выбран файл для загрузки.")
        
        # Устанавливаем допустимые расширения для архивов
        allowed_extensions = ['zip', 'rar', '7z', 'sit']
        ext = os.path.splitext(file.name)[1].lower()
        if ext.startswith('.'):
            ext = ext[1:]
        if ext not in allowed_extensions:
            raise forms.ValidationError(f"Файл {file.name} имеет недопустимое расширение.")
        
        # Проверяем размер файла: не должен превышать 2 ГБ
        max_size = 2 * 1024 * 1024 * 1024  # 2 ГБ
        if file.size > max_size:
            raise forms.ValidationError("Размер файла не должен превышать 2 ГБ.")
        
        return file
