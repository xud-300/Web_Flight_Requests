from django.db.models.signals import pre_delete
from django.dispatch import receiver
from .models import FlightResultFile

@receiver(pre_delete, sender=FlightResultFile)
def delete_flight_result_file(sender, instance, **kwargs):
    # Если у записи есть файл — удаляем его из хранилища
    if instance.file:
        instance.file.delete(save=False)
