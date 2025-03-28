# main_app/upload_forms.py
from django import forms
from .models import FlightResultFile

import os

# Функция для проверки расширения файла
def validate_file_extension(value, allowed_extensions):
    ext = os.path.splitext(value.name)[1].lower()
    if ext.startswith('.'):
        ext = ext[1:]
    if ext not in allowed_extensions:
        raise forms.ValidationError(f"Файл с расширением .{ext} не разрешён. Допустимые расширения: {', '.join(allowed_extensions)}.")

class OrthoUploadForm(forms.Form):
    # Только загрузка файла
    file = forms.FileField(label="Выберите файл для ортофотоплана")

    def clean_file(self):
        file = self.cleaned_data.get('file')
        allowed_extensions = ['dwg', 'dxf', 'tif', 'zip', 'rar', '7z', 'sit']
        validate_file_extension(file, allowed_extensions)
        # Проверка размера файла (5 ГБ = 5*1024*1024*1024 байт)
        max_size = 5 * 1024 * 1024 * 1024
        if file.size > max_size:
            raise forms.ValidationError("Размер файла не должен превышать 5 ГБ.")
        return file

class LaserUploadForm(forms.Form):
    file = forms.FileField(label="Выберите файл для лазерного сканирования")
    view_link = forms.URLField(label="Ссылка для просмотра результата", required=True)

    def clean_file(self):
        file = self.cleaned_data.get('file')
        allowed_extensions = ['dwg', 'dxf', 'las', 'zip', 'rar', '7z', 'sit']
        validate_file_extension(file, allowed_extensions)
        max_size = 15 * 1024 * 1024 * 1024  # 15 ГБ
        if file.size > max_size:
            raise forms.ValidationError("Размер файла не должен превышать 15 ГБ.")
        return file

class PanoramaUploadForm(forms.Form):
    # Только ссылка для просмотра панорамы
    view_link = forms.URLField(label="Ссылка для просмотра панорамы", required=True)


from django.forms.widgets import ClearableFileInput

class MultiFileInput(ClearableFileInput):
    allow_multiple_selected = True

class OverviewUploadForm(forms.Form):
    # Мультизагрузка файлов
    files = forms.FileField(
        widget=MultiFileInput(attrs={'multiple': True}),
        label="Выберите фотографии и/или видео"
    )

    
    def clean_files(self):
        files = self.files.getlist('files')
        if not files:
            raise forms.ValidationError("Не выбраны файлы для загрузки.")
        if len(files) > 25:
            raise forms.ValidationError("Максимальное количество файлов – 25.")
        allowed_extensions = ['mp4', 'mov', 'jpeg', 'jpg', 'png', 'webp']
        total_size = 0
        for f in files:
            ext = os.path.splitext(f.name)[1].lower()
            if ext.startswith('.'):
                ext = ext[1:]
            if ext not in allowed_extensions:
                raise forms.ValidationError(f"Файл {f.name} имеет недопустимое расширение.")
            total_size += f.size
        max_total_size = 2 * 1024 * 1024 * 1024  # 2 ГБ
        if total_size > max_total_size:
            raise forms.ValidationError("Общий объём файлов не должен превышать 2 ГБ.")
        return files
