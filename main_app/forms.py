from django import forms
from .models import FlightRequest, Object, ObjectType

class FlightRequestCreateForm(forms.ModelForm):
    class Meta:
        model = FlightRequest
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

    def __init__(self, *args, **kwargs):
        super(FlightRequestCreateForm, self).__init__(*args, **kwargs)
        # Обновляем queryset для поля object_name, если передан выбранный тип объекта
        if 'object_type' in self.data:
            try:
                object_type_id = int(self.data.get('object_type'))
                self.fields['object_name'].queryset = Object.objects.filter(object_type_id=object_type_id)
            except (ValueError, TypeError):
                self.fields['object_name'].queryset = Object.objects.none()
        elif self.instance.pk:
            self.fields['object_name'].queryset = self.instance.object_type.object_set.all()
        else:
            self.fields['object_name'].queryset = Object.objects.none()

        # Если выбран тип "ЖД" (id == "2"), делаем поле не обязательным и скрываем его
        if self.data.get('object_type') == "2":
            self.fields['object_name'].required = False
            self.fields['object_name'].empty_label = "Нет названий"
            self.fields['object_name'].widget = forms.HiddenInput()

    def clean(self):
        cleaned_data = super().clean()
        object_type = cleaned_data.get('object_type')
        # Если выбран тип "ЖД", игнорируем поле object_name
        if object_type and str(object_type.id) == "2":
            cleaned_data['object_name'] = None
        else:
            if not cleaned_data.get('object_name'):
                self.add_error('object_name', "Выберите корректный вариант. Вашего варианта нет среди допустимых значений.")
        return cleaned_data



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
