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
        error_messages = {
            'object_type': {
                'required': 'Пожалуйста, выберите тип объекта.'
            },
            'object_name': {
                'required': 'Пожалуйста, выберите название объекта.'
            }
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

        # Если тип "ЖД" (id == 2), игнорируем поле object_name
        if object_type and str(object_type.id) == "2":
            cleaned_data['object_name'] = None

        # 3. Поля с датами не могут быть пустыми
        missing_from = not shoot_date_from
        missing_to = not shoot_date_to

        if missing_from and missing_to:
            # Привязываем одну общую ошибку к полю shoot_date_from
            self.add_error('shoot_date_from', 'Пожалуйста, выберите диапазон дат съёмки.')

        else:
            # Если только одно поле пустое, выводим конкретную ошибку
            if missing_from:
                self.add_error('shoot_date_from', 'Дата съемки от обязательна для заполнения.')
            if missing_to:
                self.add_error('shoot_date_to', 'Дата съемки до обязательна для заполнения.')


        piket_errors = []

        # Если тип != "Городок" (id != "4"), тогда проверяем поля
        if object_type and str(object_type.id) != "4":
            # 1) Проверка на пустые поля
            if piket_from is None:
                piket_errors.append('"Пикет от" обязателен для заполнения.')
            if piket_to is None:
                piket_errors.append('"Пикет до" обязателен для заполнения.')

            # 2) Проверка на отрицательные значения, нецелые и т.д.
            if piket_from is not None:
                if piket_from < 0:
                    piket_errors.append('"Пикет от" не может быть меньше 0.')
                if not isinstance(piket_from, int):
                    piket_errors.append('"Пикет от" должен быть целым числом.')

            if piket_to is not None:
                if piket_to < 0:
                    piket_errors.append('"Пикет до" не может быть меньше 0.')
                if not isinstance(piket_to, int):
                    piket_errors.append('"Пикет до" должен быть целым числом.')

            # 3) Сравнение "Пикет от" > "Пикет до"
            if (piket_from is not None) and (piket_to is not None):
                if piket_from > piket_to:
                    piket_errors.append('"Пикет от" не может быть больше "Пикета до".')

        # Если в итоге есть какие-то ошибки по пикетам:
        if piket_errors:
            # Привязываем их к None => Django запишет их как __all__
            # Соединяем в один текст через <br> (или '\n')
            self.add_error(None, '<br>'.join(piket_errors))


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
        super().__init__(*args, **kwargs)
        # Динамически настраиваем queryset для названия объекта
        if 'object_type' in self.data:
            try:
                object_type_id = int(self.data.get('object_type'))
                self.fields['object_name'].queryset = Object.objects.filter(object_type_id=object_type_id)
                # Если тип выбран и он не "ЖД", переопределяем сообщение об обязательном поле
                if self.data.get('object_type') != "2":
                    self.fields['object_name'].error_messages = {
                        'required': 'Пожалуйста, выберите название объекта.'
                    }
            except (ValueError, TypeError):
                self.fields['object_name'].queryset = Object.objects.none()
        elif self.instance.pk:
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

        # Если тип объекта не выбран – ошибка для него будет показана, поэтому для object_name не добавляем дополнительную ошибку.
        if object_type:
            if str(object_type.id) != "2":
                if not object_name and 'object_name' not in self._errors:
                    self.add_error('object_name', 'Пожалуйста, выберите название объекта.')
        else:
            # Если объект не выбран, то ошибка для object_type уже должна появиться.
            pass

        # Далее – остальные проверки (даты, пикеты и т.д.) остаются без изменений
        missing_from = not shoot_date_from
        missing_to = not shoot_date_to

        # Проверка наличия дат съемки
        if not shoot_date_from and not shoot_date_to:
            self.add_error('shoot_date_from', 'Пожалуйста, выберите диапазон дат съёмки.')
        elif not shoot_date_from:
            self.add_error('shoot_date_from', 'Дата съемки от обязательна для заполнения.')
        elif not shoot_date_to:
            self.add_error('shoot_date_to', 'Дата съемки до обязательна для заполнения.')

        # Если обе даты указаны, проверяем корректность диапазона
        if shoot_date_from and shoot_date_to:
            if shoot_date_from > shoot_date_to:
                self.add_error('shoot_date_from', '"Дата съемки от" не может быть позже "Даты съемки до".')
                self.add_error('shoot_date_to', '"Дата съемки до" не может быть раньше "Даты съемки от".')


        piket_errors = []

        # Если тип объекта не "Городок" (id != "4"), тогда проверяем поля
        if object_type and str(object_type.id) != "4":
            # 1) Проверка на пустые поля
            if piket_from is None:
                piket_errors.append('"Пикет от" обязателен для заполнения.')
            if piket_to is None:
                piket_errors.append('"Пикет до" обязателен для заполнения.')

            # 2) Проверка на отрицательные значения и тип данных
            if piket_from is not None:
                if piket_from < 0:
                    piket_errors.append('"Пикет от" не может быть меньше 0.')
                if not isinstance(piket_from, int):
                    piket_errors.append('"Пикет от" должен быть целым числом.')
            if piket_to is not None:
                if piket_to < 0:
                    piket_errors.append('"Пикет до" не может быть меньше 0.')
                if not isinstance(piket_to, int):
                    piket_errors.append('"Пикет до" должен быть целым числом.')

            # 3) Проверка, что "Пикет от" не больше "Пикета до"
            if (piket_from is not None) and (piket_to is not None):
                if piket_from > piket_to:
                    piket_errors.append('"Пикет от" не может быть больше "Пикета до".')
                # 4) Проверка, что оба поля не равны нулю одновременно
                if piket_from == 0 and piket_to == 0:
                    piket_errors.append('Оба поля "Пикет от" и "Пикет до" не могут одновременно равняться нулю.')

        if piket_errors:
            self.add_error(None, '<br>'.join(piket_errors))

        
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


