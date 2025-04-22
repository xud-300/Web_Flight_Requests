from django.db import models
from django.conf import settings

class ObjectType(models.Model):
    id = models.AutoField(primary_key=True)
    type_name = models.CharField(max_length=255, unique=True)

    class Meta:
        db_table = 'object_types'
        managed = False

    def __str__(self):
        return self.type_name

class Object(models.Model):
    id = models.AutoField(primary_key=True)
    object_type = models.ForeignKey(
        ObjectType,
        on_delete=models.CASCADE,
        db_column='object_type_id'
    )
    object_name = models.CharField(max_length=255)

    class Meta:
        db_table = 'objects'
        managed = False

    def __str__(self):
        return self.object_name

class User(models.Model):
    id = models.AutoField(primary_key=True)
    telegram_id = models.BigIntegerField(unique=True)
    username = models.TextField(null=True, blank=True)
    full_name = models.TextField(null=True, blank=True)
    approved = models.BooleanField(default=False)
    registration_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users'
        managed = False

    def __str__(self):
        return self.username or str(self.telegram_id)
    
class TelegramUser(models.Model):
    id = models.AutoField(primary_key=True)
    telegram_id = models.BigIntegerField(unique=True)
    username = models.TextField(null=True, blank=True)
    full_name = models.TextField(null=True, blank=True)
    approved = models.BooleanField(default=False)
    registration_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users'
        managed = False  # Существующая таблица; Django не будет её изменять

    def __str__(self):
        return self.username or str(self.telegram_id)
    
class FlightRequest(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(
        TelegramUser,
        on_delete=models.CASCADE,
        db_column='user_id'
    )
    username = models.TextField(null=True, blank=True)
    piket_from = models.IntegerField(null=True, blank=True)
    piket_to = models.IntegerField(null=True, blank=True)
    shoot_date_from = models.DateField(null=True, blank=True)
    shoot_date_to = models.DateField(null=True, blank=True)
    note = models.TextField(null=True, blank=True)
    kml_file_id = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=50, default='Новая')
    created_at = models.DateTimeField(auto_now_add=True)
    orthophoto = models.BooleanField(default=False)
    laser = models.BooleanField(default=False)
    panorama = models.BooleanField(default=False)
    overview = models.BooleanField(default=False)
    object_type = models.ForeignKey(
        ObjectType,
        on_delete=models.CASCADE,
        db_column='object_type'
    )
    object_name = models.ForeignKey(
        Object,
        on_delete=models.CASCADE,
        db_column='object_name'
    )

    class Meta:
        db_table = 'requests'
        managed = False

    def __str__(self):
        return f"Request {self.id}"


from django.db import models
from django.contrib.auth.models import User as AuthUser
from main_app.models import FlightRequest, ObjectType, Object
import json
# Модель для истории изменений
class RequestHistory(models.Model):
    id = models.AutoField(primary_key=True)
    flight_request = models.ForeignKey(
        FlightRequest,
        on_delete=models.CASCADE,
        related_name='history'
    )
    changed_by = models.ForeignKey(
        AuthUser,  # встроенная модель пользователя
        on_delete=models.SET_NULL,
        null=True
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    changes = models.TextField()  # JSON-строка со старыми и новыми значениями

    class Meta:
        db_table = 'request_history'
        managed = True

    def __str__(self):
        return f"History for Request {self.flight_request.id} at {self.timestamp}"

    # Словарь для отображения названий полей по-русски
    FIELD_LABELS = {
        "object_type": "Тип объекта",
        "object_name": "Название объекта",
        "shoot_date_from": "Дата съёмки (от)",
        "shoot_date_to": "Дата съёмки (до)",
        "piket_from": "Пикет от",
        "piket_to": "Пикет до",
        "orthophoto": "Ортофотоплан",
        "laser": "Лазерное сканирование",
        "panorama": "Панорама",
        "overview": "Обзорные фото",
        "note": "Примечание",
        "status": "Статус заявки",
    }

    def get_parsed_changes(self):
        """
        Возвращает список кортежей вида:
        [(label, old_value, new_value), ...]
        где label - человеко-читаемое название поля,
            old_value/new_value - преобразованные значения.
        """
        try:
            changes_dict = json.loads(self.changes)
        except json.JSONDecodeError:
            return []

        result = []
        for field, values in changes_dict.items():
            # values обычно выглядит как [старое, новое]
            old_val, new_val = values[0], values[1] if len(values) > 1 else ("", "")

            # 1) Подмена названия поля
            label = self.FIELD_LABELS.get(field, field)

            # 2) Преобразование булевых значений "True"/"False"
            if old_val == "True":
                old_val = "Да"
            elif old_val == "False":
                old_val = "Нет"
            if new_val == "True":
                new_val = "Да"
            elif new_val == "False":
                new_val = "Нет"

            # 3) Преобразование ID -> Название (для object_type, object_name)
            if field == "object_type":
                old_val = self._lookup_object_type(old_val)
                new_val = self._lookup_object_type(new_val)
            elif field == "object_name":
                old_val = self._lookup_object_name(old_val)
                new_val = self._lookup_object_name(new_val)


            result.append((label, old_val, new_val))

        return result

    def _lookup_object_type(self, val):
        """Пытается найти ObjectType по ID, вернуть type_name. Если не находит, вернуть исходное."""
        try:
            # Если val — строка, пробуем привести к int
            obj_type_id = int(val)
            obj_type = ObjectType.objects.get(pk=obj_type_id)
            return obj_type.type_name
        except (ValueError, ObjectType.DoesNotExist):
            return val

    def _lookup_object_name(self, val):
        """Пытается найти Object по ID, вернуть object_name. Если не находит, вернуть исходное."""
        try:
            obj_id = int(val)
            obj = Object.objects.get(pk=obj_id)
            return obj.object_name
        except (ValueError, Object.DoesNotExist):
            return val

class FlightResultFile(models.Model):
    RESULT_TYPE_CHOICES = [
        ('ortho', 'Ортофотоплан'),
        ('laser', 'Лазерное сканирование'),
        ('panorama', 'Панорама'),
        ('overview', 'Обзорные фото'),
    ]

    flight_request = models.ForeignKey('FlightRequest', on_delete=models.CASCADE, related_name='result_files')
    result_type = models.CharField(max_length=20, choices=RESULT_TYPE_CHOICES)
    # Для тех типов, где загружается файл:
    file = models.FileField(upload_to='flight_results/', blank=True, null=True)
    # Для тех, где вводится ссылка для просмотра:
    view_link = models.URLField(blank=True, null=True)
    file_size = models.PositiveBigIntegerField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_result_type_display()} for Request {self.flight_request.id}"
    
class TempResultFile(models.Model):
    """
    Модель для временного хранения файлов (до подтверждения пользователем).
    """
    # Используем стандартную модель пользователя (по умолчанию — auth.User)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    result_type = models.CharField(max_length=20)
    file = models.FileField(upload_to='temp_uploads/')
    view_link = models.URLField(blank=True, null=True)
    file_size = models.PositiveBigIntegerField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Temp file {self.file.name} (type={self.result_type})"


class UndoAction(models.Model):
    """
    Модель для отмены массовых действий
    """
    ACTION_TYPES = [
        ('mass_status', 'Массовое изменение статуса'),
        ('mass_delete', 'Массовое удаление'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    action_type = models.CharField(max_length=20, choices=ACTION_TYPES)
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'undo_actions'
        indexes = [
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"UndoAction {self.action_type} by {self.user} at {self.created_at}"
