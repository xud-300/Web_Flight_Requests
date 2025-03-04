from django import forms
from .models import FlightRequest, Object, ObjectType

class FlightRequestCreateForm(forms.ModelForm):
    class Meta:
        model = FlightRequest
        fields = [
            'object_type',    # Тип объекта (загружается из БД)
            'object_name',    # Название объекта (будет фильтроваться по выбранному типу)
            'piket_from',     # Пикет "от"
            'piket_to',       # Пикет "до"
            'shoot_date_from',# Дата начала съемки
            'shoot_date_to',  # Дата окончания съемки
            'orthophoto',     # Тип съемки: ортофотоплан (флажок)
            'laser',          # Тип съемки: лазерное сканирование (флажок)
            'panorama',       # Тип съемки: панорама (флажок)
            'overview',       # Тип съемки: обзорные фото (флажок)
            'note',           # Примечание
        ]
        widgets = {
            'shoot_date_from': forms.DateInput(attrs={'type': 'date'}),
            'shoot_date_to': forms.DateInput(attrs={'type': 'date'}),
        }

    def __init__(self, *args, **kwargs):
        super(FlightRequestCreateForm, self).__init__(*args, **kwargs)
        # Изначально можно установить queryset для object_name как пустой,
        # чтобы далее динамически подгружать его через AJAX при выборе object_type.
        self.fields['object_name'].queryset = Object.objects.none()


class FlightRequestEditForm(forms.ModelForm):
    class Meta:
        model = FlightRequest
        # Для редактирования мы исключаем поле status для обычных пользователей.
        # Если редактирует администратор, его можно добавить динамически в представлении.
        fields = [
            'object_type',
            'object_name',
            'piket_from',
            'piket_to',
            'shoot_date_from',
            'shoot_date_to',
            'orthophoto',
            'laser',
            'panorama',
            'overview',
            'note',
        ]
        widgets = {
            'shoot_date_from': forms.DateInput(attrs={'type': 'date'}),
            'shoot_date_to': forms.DateInput(attrs={'type': 'date'}),
        }
