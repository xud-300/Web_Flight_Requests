from django.db import models

class ObjectType(models.Model):
    id = models.AutoField(primary_key=True)
    type_name = models.CharField(max_length=255, unique=True)

    class Meta:
        db_table = 'object_types'
        managed = False  # уже существует в БД

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

from django.contrib.auth.models import User as AuthUser  # импортируем встроенную модель

# Новая модель для истории изменений
class RequestHistory(models.Model):
    id = models.AutoField(primary_key=True)
    flight_request = models.ForeignKey(
        FlightRequest,
        on_delete=models.CASCADE,
        related_name='history'
    )
    changed_by = models.ForeignKey(
        AuthUser,  # теперь используем встроенную модель пользователя
        on_delete=models.SET_NULL,
        null=True
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    changes = models.TextField()  # можно использовать JSONField для структурированного хранения

    class Meta:
        db_table = 'request_history'
        managed = True

    def __str__(self):
        return f"History for Request {self.flight_request.id} at {self.timestamp}"

