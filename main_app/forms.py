from django import forms
from django.utils import timezone
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
        super().__init__(*args, **kwargs)
        # Динамически настраиваем queryset для названия объекта
        if 'object_type' in self.data:
            try:
                object_type_id = int(self.data.get('object_type'))
                self.fields['object_name'].queryset = Object.objects.filter(object_type_id=object_type_id)
            except (ValueError, TypeError):
                self.fields['object_name'].queryset = Object.objects.none()
        elif self.instance.pk:
            # Если форма связана с уже сохранённым экземпляром
            self.fields['object_name'].queryset = self.instance.object_type.object_set.all()
        else:
            self.fields['object_name'].queryset = Object.objects.none()

        # Если выбран тип "ЖД" (id == "2"), скрываем поле "Название объекта"
        if self.data.get('object_type') == "2":
            self.fields['object_name'].required = False
            self.fields['object_name'].empty_label = "Нет названий"
            self.fields['object_name'].widget = forms.HiddenInput()

    def clean(self):
        cleaned_data = super().clean()

        object_type     = cleaned_data.get('object_type')
        object_name     = cleaned_data.get('object_name')
        piket_from      = cleaned_data.get('piket_from')
        piket_to        = cleaned_data.get('piket_to')
        shoot_date_from = cleaned_data.get('shoot_date_from')
        shoot_date_to   = cleaned_data.get('shoot_date_to')
        orthophoto      = cleaned_data.get('orthophoto')
        laser           = cleaned_data.get('laser')
        panorama        = cleaned_data.get('panorama')
        overview        = cleaned_data.get('overview')

        # 1. Тип объекта должен быть выбран.
        if not object_type:
            self.add_error('object_type', 'Пожалуйста, выберите тип объекта.')

        # 2. Если тип не "ЖД" (id == "2"), нужно выбрать название объекта.
        if object_type and str(object_type.id) != "2":
            if not object_name:
                self.add_error('object_name', 'Пожалуйста, выберите название объекта.')
        else:
            # Для типа "ЖД" игнорируем поле object_name
            cleaned_data['object_name'] = None

        # 3. Поля с датами не могут быть пустыми
        if not shoot_date_from:
            self.add_error('shoot_date_from', 'Дата съемки от обязательна для заполнения.')
        if not shoot_date_to:
            self.add_error('shoot_date_to', 'Дата съемки до обязательна для заполнения.')

        # 4. Поля с пикетами не могут быть пустыми, если тип объекта не "Городок" (id == "4")
        if object_type and str(object_type.id) != "4":
            if piket_from is None:
                self.add_error('piket_from', '"Пикет от" обязателен для заполнения.')
            if piket_to is None:
                self.add_error('piket_to', '"Пикет до" обязателен для заполнения.')

        # 5. Проверка значений пикетов
        if piket_from is not None:
            if piket_from < 0:
                self.add_error('piket_from', '"Пикет от" не может быть меньше 0.')
            if not isinstance(piket_from, int):
                self.add_error('piket_from', '"Пикет от" должен быть целым числом.')
        if piket_to is not None:
            if piket_to < 0:
                self.add_error('piket_to', '"Пикет до" не может быть меньше 0.')
            if not isinstance(piket_to, int):
                self.add_error('piket_to', '"Пикет до" должен быть целым числом.')

        if (piket_from is not None) and (piket_to is not None):
            if piket_from > piket_to:
                self.add_error('piket_from', '"Пикет от" не может быть больше "Пикета до".')
                self.add_error('piket_to', '"Пикет до" не может быть меньше "Пикета от".')

        # 6. Проверка дат съемки
        from django.utils import timezone
        today = timezone.now().date()
        if shoot_date_from and shoot_date_from < today:
            self.add_error('shoot_date_from', 'Дата съемки от не может быть в прошлом.')
        if shoot_date_to and shoot_date_to < today:
            self.add_error('shoot_date_to', 'Дата съемки до не может быть в прошлом.')

        if shoot_date_from and shoot_date_to:
            if shoot_date_from > shoot_date_to:
                self.add_error('shoot_date_from', '"Дата съемки от" не может быть позже "Даты съемки до".')
                self.add_error('shoot_date_to', '"Дата съемки до" не может быть раньше "Даты съемки от".')

        # 7. Должен быть выбран хотя бы один тип съемки.
        if not (orthophoto or laser or panorama or overview):
            error_msg = 'Пожалуйста, выберите хотя бы один тип съемки.'
            self.add_error('overview', error_msg)

        return cleaned_data


class FlightRequestEditForm(forms.ModelForm):
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
            'object_type': forms.Select(attrs={'class': 'form-control', 'id': 'id_edit_object_type'}),
            'object_name': forms.Select(attrs={'class': 'form-control', 'id': 'id_edit_object_name'}),
            'piket_from': forms.NumberInput(attrs={'class': 'form-control', 'id': 'id_edit_piket_from'}),
            'piket_to': forms.NumberInput(attrs={'class': 'form-control', 'id': 'id_edit_piket_to'}),
            'shoot_date_from': forms.DateInput(attrs={'type': 'date', 'class': 'form-control', 'id': 'id_edit_shoot_date_from'}),
            'shoot_date_to': forms.DateInput(attrs={'type': 'date', 'class': 'form-control', 'id': 'id_edit_shoot_date_to'}),
            'orthophoto': forms.CheckboxInput(attrs={'class': 'form-check-input', 'id': 'id_edit_orthophoto'}),
            'laser': forms.CheckboxInput(attrs={'class': 'form-check-input', 'id': 'id_edit_laser'}),
            'panorama': forms.CheckboxInput(attrs={'class': 'form-check-input', 'id': 'id_edit_panorama'}),
            'overview': forms.CheckboxInput(attrs={'class': 'form-check-input', 'id': 'id_edit_overview'}),
            'note': forms.Textarea(attrs={'class': 'form-control', 'id': 'id_edit_note', 'rows': 3}),
        }
    
    def __init__(self, *args, **kwargs):
        super(FlightRequestEditForm, self).__init__(*args, **kwargs)
        # Если у редактируемой заявки выбран тип "ЖД" (id == "2"), отключаем поле "object_name"
        if self.instance and self.instance.object_type and str(self.instance.object_type.id) == "2":
            self.fields['object_name'].required = False
            self.fields['object_name'].widget = forms.HiddenInput()
            # Можно также сбросить queryset, если он не нужен:
            self.fields['object_name'].queryset = Object.objects.none()

    def clean(self):
        cleaned_data = super().clean()

        object_type     = cleaned_data.get('object_type')
        object_name     = cleaned_data.get('object_name')
        piket_from      = cleaned_data.get('piket_from')
        piket_to        = cleaned_data.get('piket_to')
        shoot_date_from = cleaned_data.get('shoot_date_from')
        shoot_date_to   = cleaned_data.get('shoot_date_to')
        orthophoto      = cleaned_data.get('orthophoto')
        laser           = cleaned_data.get('laser')
        panorama        = cleaned_data.get('panorama')
        overview        = cleaned_data.get('overview')

        # 1. Тип объекта должен быть выбран.
        if not object_type:
            self.add_error('object_type', 'Пожалуйста, выберите тип объекта.')

        # 2. Если тип не "ЖД" (id == "2"), нужно выбрать название объекта.
        if object_type and str(object_type.id) != "2":
            if not object_name:
                self.add_error('object_name', 'Пожалуйста, выберите название объекта.')

        # 3. Проверка обязательности полей с датами.
        if not shoot_date_from:
            self.add_error('shoot_date_from', 'Дата съемки от обязательна для заполнения.')
        if not shoot_date_to:
            self.add_error('shoot_date_to', 'Дата съемки до обязательна для заполнения.')

        # 4. Если тип не "Городок" (id == "4"), поля пикетов обязательны.
        if object_type and str(object_type.id) != "4":
            if piket_from is None:
                self.add_error('piket_from', '"Пикет от" обязателен для заполнения.')
            if piket_to is None:
                self.add_error('piket_to', '"Пикет до" обязателен для заполнения.')

        # 5. Проверка значений пикетов
        if piket_from is not None:
            if piket_from < 0:
                self.add_error('piket_from', '"Пикет от" не может быть меньше 0.')
            if not isinstance(piket_from, int):
                self.add_error('piket_from', '"Пикет от" должен быть целым числом.')
        if piket_to is not None:
            if piket_to < 0:
                self.add_error('piket_to', '"Пикет до" не может быть меньше 0.')
            if not isinstance(piket_to, int):
                self.add_error('piket_to', '"Пикет до" должен быть целым числом.')

        if piket_from is not None and piket_to is not None:
            if piket_from > piket_to:
                self.add_error('piket_from', '"Пикет от" не может быть больше "Пикета до".')
                self.add_error('piket_to', '"Пикет до" не может быть меньше "Пикета от".')

        # 6. Проверка дат съемки
        from django.utils import timezone
        today = timezone.now().date()
        if shoot_date_from and shoot_date_from < today:
            self.add_error('shoot_date_from', 'Дата съемки от не может быть в прошлом.')
        if shoot_date_to and shoot_date_to < today:
            self.add_error('shoot_date_to', 'Дата съемки до не может быть в прошлом.')

        if shoot_date_from and shoot_date_to:
            if shoot_date_from > shoot_date_to:
                self.add_error('shoot_date_from', '"Дата съемки от" не может быть позже "Даты съемки до".')
                self.add_error('shoot_date_to', '"Дата съемки до" не может быть раньше "Даты съемки от".')

        # 7. Должен быть выбран хотя бы один тип съемки.
        if not (orthophoto or laser or panorama or overview):
            error_msg = 'Пожалуйста, выберите хотя бы один тип съемки.'
            self.add_error('overview', error_msg)

        return cleaned_data


    def save(self, commit=True):
        instance = super().save(commit=False)
        # Если поле 'status' присутствует (у администратора), устанавливаем его значение
        if 'status' in self.cleaned_data:
            instance.status = self.cleaned_data['status']
        if commit:
            instance.save()
        return instance

