# main_app/views.py
import json
from django.shortcuts import get_object_or_404
from django.views.generic import ListView, CreateView, UpdateView, View
from django.http import JsonResponse, HttpResponse, HttpResponseForbidden, HttpResponseBadRequest
from django.urls import reverse_lazy
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.decorators import login_required
from django import forms
from django.template.loader import render_to_string
from .models import FlightRequest, RequestHistory, Object, ObjectType, TelegramUser
from main_app.models import User
from .forms import FlightRequestCreateForm, FlightRequestEditForm
from django.views.decorators.http import require_POST, require_GET
from django.utils.decorators import method_decorator
from .models import FlightRequest, FlightResultFile
from .upload_forms import OrthoUploadForm, LaserUploadForm, PanoramaUploadForm, OverviewUploadForm


# Список заявок
class FlightRequestListView(LoginRequiredMixin, ListView):
    model = FlightRequest
    template_name = 'main_app/requests_list.html'
    context_object_name = 'requests'

    def get_queryset(self):
        qs = FlightRequest.objects.all()

        # Фильтрация по GET-параметрам
        status = self.request.GET.get('status')
        object_type = self.request.GET.get('object_type')
        object_name = self.request.GET.get('object_name')
        shooting_type = self.request.GET.get('shooting_type')
        shoot_date_from = self.request.GET.get('shoot_date_from')
        shoot_date_to = self.request.GET.get('shoot_date_to')
        
        if status:
            qs = qs.filter(status=status)
        
        if object_type:
            qs = qs.filter(object_type_id=object_type)
        
        if object_name:
            qs = qs.filter(object_name_id=object_name)
        
        if shooting_type:
            # Предполагаем, что shooting_type соответствует имени булевого поля (например, 'laser')
            filter_kwargs = {shooting_type: True}
            qs = qs.filter(**filter_kwargs)
        
        # Фильтрация по диапазону дат съемки (интервалы пересекаются, если shoot_date_from(record) <= shoot_date_to(filter)
        # и shoot_date_to(record) >= shoot_date_from(filter))
        if shoot_date_from and shoot_date_to:
            qs = qs.filter(shoot_date_from__lte=shoot_date_to, shoot_date_to__gte=shoot_date_from)
        elif shoot_date_from:
            qs = qs.filter(shoot_date_to__gte=shoot_date_from)
        elif shoot_date_to:
            qs = qs.filter(shoot_date_from__lte=shoot_date_to)
        
        # Сортировка: получаем GET-параметры сортировки
        sort_field = self.request.GET.get('sort')
        order = self.request.GET.get('order', 'asc')  # по умолчанию 'asc'
        
        if sort_field == 'shoot_date':
            if order == 'desc':
                qs = qs.order_by('-shoot_date_to')
            else:
                qs = qs.order_by('shoot_date_from')
        else:
            allowed_sort_fields = {
                'status': 'status',
                'id': 'id',
                'object_type': 'object_type__type_name'
            }
            if sort_field in allowed_sort_fields:
                field_name = allowed_sort_fields[sort_field]
                if order == 'desc':
                    qs = qs.order_by('-' + field_name)
                else:
                    qs = qs.order_by(field_name)
            else:
                qs = qs.order_by('-created_at')
        
        return qs





    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        from .models import ObjectType
        context['object_types'] = ObjectType.objects.all()
        return context


# Создание заявки через модальное окно.
class FlightRequestCreateView(LoginRequiredMixin, CreateView):
    model = FlightRequest
    form_class = FlightRequestCreateForm
    template_name = 'modal_create.html'
    success_url = reverse_lazy('requests_list')

    def form_valid(self, form):
        # Попытка получить объект пользователя через TelegramUser
        try:
            user_obj = TelegramUser.objects.get(id=self.request.user.id)
        except TelegramUser.DoesNotExist:
            user_obj = TelegramUser.objects.create(
                id=self.request.user.id,
                telegram_id=getattr(self.request.user, 'telegram_id', 0),
                username=self.request.user.username or '',
                full_name=getattr(self.request.user, 'full_name', '')
            )
        form.instance.user = user_obj
        # Используем полное имя из профиля для отображения создателя
        form.instance.username = self.request.user.profile.full_name
        self.object = form.save()

        # Используем встроенную модель пользователя (AuthUser) напрямую: self.request.user
        RequestHistory.objects.create(
            flight_request=self.object,
            changed_by=self.request.user,
            changes=json.dumps({"created": ["", "Заявка создана"]}, ensure_ascii=False)
        )

        if self.request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'success': True, 'redirect_url': reverse_lazy('requests_list')})
        else:
            return super().form_valid(form)



    def form_invalid(self, form):
        if self.request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'errors': form.errors})
        else:
            return super().form_invalid(form)


# Редактирование заявки через модальное окно.
class FlightRequestUpdateView(LoginRequiredMixin, UpdateView):
    model = FlightRequest
    form_class = FlightRequestEditForm
    template_name = 'main_app/modal_edit.html'
    success_url = reverse_lazy('requests_list')

    def dispatch(self, request, *args, **kwargs):
        self.object = self.get_object()
        # Проверяем, является ли пользователь администратором через is_staff или через профиль
        if not (request.user.is_staff or (hasattr(request.user, 'profile') and request.user.profile.role == 'admin')):
            # Если пользователь не администратор, то он может редактировать только свою заявку
            if self.object.user_id != request.user.id:
                return HttpResponseForbidden("У вас нет прав для редактирования этой заявки.")
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['object_types'] = ObjectType.objects.all()
        context['object_names'] = Object.objects.filter(object_type=self.object.object_type)
        context['edit_url'] = reverse_lazy('request_edit', args=[self.object.id])
        # Вычисляем флаг редактируемости:
        # Если статус заявки "завершена" и пользователь не администратор, то редактирование запрещено.
        context['is_editable'] = (self.object.status != "Выполнена") or (self.request.user.is_staff or (hasattr(self.request.user, 'profile') and self.request.user.profile.role == 'admin'))
        return context

    def get(self, request, *args, **kwargs):
        self.object = self.get_object()
        context = self.get_context_data(object=self.object, form=self.get_form())
        if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.GET.get('ajax'):
            html = render_to_string("main_app/modal_edit.html", {**context, 'ajax': True}, request=request)
            return HttpResponse(html)
        return super().get(request, *args, **kwargs)

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        # Добавляем поле 'status' только для администраторов (через is_staff или профиль)
        if self.request.user.is_staff or (hasattr(self.request.user, 'profile') and self.request.user.profile.role == 'admin'):
            form.fields['status'] = forms.ChoiceField(
                choices=[('Новая', 'Новая'), ('В работе', 'В работе'), ('Выполнена', 'Выполнена')],
                initial=self.object.status,
                widget=forms.Select(attrs={'class': 'form-control', 'id': 'id_edit_status'})
            )
        return form

    def form_valid(self, form):
        response = super().form_valid(form)
        
        # Формируем словарь изменений, используя form.changed_data
        changes_dict = {}
        for field in form.changed_data:
            old_value = form.initial.get(field)
            new_value = form.cleaned_data.get(field)
            changes_dict[field] = [str(old_value), str(new_value)]
        
        # Используем self.request.user напрямую (это встроенная модель, связанная с accounts.Profile)
        RequestHistory.objects.create(
            flight_request=self.object,
            changed_by=self.request.user,
            changes=json.dumps(changes_dict, ensure_ascii=False)
        )
        
        if self.request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'success': True, 'redirect_url': reverse_lazy('requests_list')})
        else:
            return response



    def form_invalid(self, form):
        if self.request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'errors': form.errors})
        else:
            return super().form_invalid(form)




# AJAX-обработчик для динамической загрузки названий объектов по выбранному типу.
@login_required
def get_object_names(request):
    object_type_id = request.GET.get('object_type')
    data = []
    if object_type_id:
        objects = Object.objects.filter(object_type_id=object_type_id).values('id', 'object_name')
        data = list(objects)
    return JsonResponse(data, safe=False)


# AJAX-обработчик для массового обновления статуса заявок.
@require_POST
@login_required
def mass_update_status(request):
    if not request.user.is_staff:
        return HttpResponseForbidden("Доступ запрещен")
    try:
        data = json.loads(request.body)
        request_ids = data.get('request_ids', [])
        new_status = data.get('new_status')
        
        # Допустимые варианты статуса:
        if not request_ids or new_status not in ['Новая', 'В работе', 'Выполнена']:
            return JsonResponse({'success': False, 'error': 'Неверные параметры'})
        
        qs = FlightRequest.objects.filter(id__in=request_ids)
        for flight_request in qs:
            old_status = flight_request.status
            flight_request.status = new_status
            flight_request.save(update_fields=['status'])
            
            RequestHistory.objects.create(
                flight_request=flight_request,
                changed_by=request.user,
                changes=json.dumps({'status': [old_status, new_status]}, ensure_ascii=False)
            )
        
        return JsonResponse({'success': True})
    
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# AJAX-обработчик для массового удаления заявок.
@require_POST
@login_required
def mass_delete_requests(request):
    if not request.user.is_staff:
        return HttpResponseForbidden("Доступ запрещен")
    try:
        data = json.loads(request.body)
        request_ids = data.get('request_ids', [])
        if not request_ids:
            return JsonResponse({'success': False, 'error': 'Нет заявок для удаления'})
        
        FlightRequest.objects.filter(id__in=request_ids).delete()
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})




# Заглушки для экспорта заявок в Excel.
class ExportExcelView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        if request.user.is_staff:
            qs = FlightRequest.objects.all()
        else:
            qs = FlightRequest.objects.filter(user_id=request.user.id)
        # Здесь можно использовать, например, openpyxl для формирования Excel-файла.
        response = HttpResponse("Excel export", content_type='application/vnd.ms-excel')
        response['Content-Disposition'] = 'attachment; filename="requests.xlsx"'
        return response


# Заглушка для экспорта заявок в PDF.
class ExportPDFView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        if request.user.is_staff:
            qs = FlightRequest.objects.all()
        else:
            qs = FlightRequest.objects.filter(user_id=request.user.id)
        # Здесь можно использовать ReportLab, xhtml2pdf или другой инструмент для формирования PDF.
        response = HttpResponse("PDF export", content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="requests.pdf"'
        return response


@require_POST
def delete_flight_request(request, pk):
    # Получаем заявку по pk
    flight_request = get_object_or_404(FlightRequest, pk=pk)
    
    # Проверяем права: разрешаем удаление, если пользователь является администратором
    # или если пользователь является создателем заявки
    if not (request.user.is_staff or flight_request.user_id == request.user.id):
        return HttpResponseForbidden("У вас нет прав для удаления этой заявки.")
    
    flight_request.delete()
    return JsonResponse({'success': True})

import os
@require_GET
@login_required
def get_request_results(request):
    """
    Возвращает данные результатов съёмки для заявки.
    Если в заявке установлен тип съемки, но файлов нет – возвращаются заглушки.
    """
    request_id = request.GET.get('request_id')
    if not request_id:
        return HttpResponseBadRequest("request_id не указан")
    
    try:
        flight = FlightRequest.objects.get(id=request_id)
    except FlightRequest.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Заявка не найдена'}, status=404)
    
    data = {}

    # Ортофотоплан
    if flight.orthophoto:
        ortho_files = FlightResultFile.objects.filter(flight_request=flight, result_type='ortho')
        if ortho_files.exists():
            file_obj = ortho_files.first()
            data['orthophoto'] = {
                'id': file_obj.id,
                'download_link': file_obj.file.url if file_obj.file else '#',
                'archive_name': os.path.basename(file_obj.file.name) if file_obj.file else 'Файл не найден'
            }
        else:
            data['orthophoto'] = {
                'download_link': '#',
                'archive_name': 'Файлы для скачивания ещё не добавлены'
            }

    # Лазерное сканирование
    if flight.laser:
        laser_files = FlightResultFile.objects.filter(flight_request=flight, result_type='laser')
        if laser_files.exists():
            file_obj = laser_files.first()
            data['laser'] = {
                'id': file_obj.id,
                'download_link': file_obj.file.url if file_obj.file else '#',
                'archive_name': os.path.basename(file_obj.file.name) if file_obj.file else 'Файл не найден',
                'view_link': file_obj.view_link or '#'
            }
        else:
            data['laser'] = {
                'download_link': '#',
                'archive_name': 'Файлы для скачивания ещё не добавлены',
                'view_link': '#'
            }

    # Панорама
    if flight.panorama:
        panorama_files = FlightResultFile.objects.filter(flight_request=flight, result_type='panorama')
        if panorama_files.exists():
            file_obj = panorama_files.first()
            data['panorama'] = {
                'id': file_obj.id,
                'view_link': file_obj.view_link or '#'
            }
        else:
            data['panorama'] = {
                'view_link': '#'
            }

    # Обзорные фото
    if flight.overview:
        overview_files = FlightResultFile.objects.filter(flight_request=flight, result_type='overview')
        if overview_files.exists():
            file_obj = overview_files.first()
            data['overview'] = {
                'id': file_obj.id,
                'download_link': file_obj.file.url if file_obj.file else '#',
                'archive_name': os.path.basename(file_obj.file.name) if file_obj.file else 'Файл не найден',
                'view_link': file_obj.view_link or '#'
            }
        else:
            data['overview'] = {
                'download_link': '#',
                'archive_name': 'Файлы для скачивания ещё не добавлены',
                'view_link': '#'
            }

    return JsonResponse(data)


@method_decorator(login_required, name='dispatch')
class UploadResultView(View):
    """
    Обрабатывает загрузку результатов съемки.
    """
    def post(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return JsonResponse({'success': False, 'error': 'Доступ запрещен'}, status=403)
        
        upload_type = request.POST.get('upload_type')
        request_id = request.POST.get('request_id')
        if not upload_type or not request_id:
            return HttpResponseBadRequest("upload_type и request_id обязательны")
        
        try:
            flight = FlightRequest.objects.get(id=request_id)
        except FlightRequest.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Заявка не найдена'}, status=404)
        
        # Выбираем форму в зависимости от upload_type
        if upload_type == 'ortho':
            form = OrthoUploadForm(request.POST, request.FILES)
        elif upload_type == 'laser':
            form = LaserUploadForm(request.POST, request.FILES)
        elif upload_type == 'panorama':
            form = PanoramaUploadForm(request.POST)
        elif upload_type == 'overview':
            form = OverviewUploadForm(request.POST, request.FILES)
        else:
            return JsonResponse({'success': False, 'error': 'Неверный тип загрузки'}, status=400)

        if form.is_valid():
            if upload_type == 'ortho':
                # Используем новое имя поля "orthoFile"
                temp_file = form.cleaned_data['orthoFile']
                view_link = form.cleaned_data.get('view_link')
                temp_result = TempResultFile.objects.create(
                    uploaded_by=request.user,
                    result_type=upload_type,
                    file=temp_file,
                    view_link=view_link or '',
                    file_size=temp_file.size
                )
                temp_id = temp_result.id
            elif upload_type == 'laser':
                # Используем новое имя поля "laserFile"
                temp_file = form.cleaned_data['laserFile']
                view_link = form.cleaned_data.get('laserViewInput') or ''
                temp_result = TempResultFile.objects.create(
                    uploaded_by=request.user,
                    result_type=upload_type,
                    file=temp_file,
                    view_link=view_link,
                    file_size=temp_file.size
                )
                temp_id = temp_result.id
            elif upload_type == 'panorama':
                view_link = form.cleaned_data['panoramaViewInput']
                temp_result = TempResultFile.objects.create(
                    uploaded_by=request.user,
                    result_type=upload_type,
                    file=None,
                    view_link=view_link
                )
                temp_id = temp_result.id
            elif upload_type == 'overview':
                # Получаем список файлов из поля overviewFiles
                files = request.FILES.getlist('overviewFiles')
                if not files:
                    return JsonResponse({'success': False, 'error': 'Не выбраны файлы для загрузки.'}, status=400)
                created_ids = []
                for f in files:
                    temp_obj = TempResultFile.objects.create(
                        uploaded_by=request.user,
                        result_type=upload_type,
                        file=f,
                        file_size=f.size
                    )
                    created_ids.append(temp_obj.id)
                # Возвращаем список идентификаторов как строку JSON
                import json
                temp_id = json.dumps(created_ids)

            return JsonResponse({
                'success': True,
                'temp_id': temp_id
            })
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'error': errors}, status=400)



from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import TempResultFile


@method_decorator(login_required, name='dispatch')
class UploadTempFileView(View):
    """
    Принимает файл, проверяет его (через формы или вручную),
    сохраняет во TempResultFile. Возвращает ID созданного TempResultFile.
    """

    def post(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return JsonResponse({'success': False, 'error': 'Доступ запрещен'}, status=403)

        upload_type = request.POST.get('upload_type')  # ortho, laser и т.д.
        if not upload_type:
            return HttpResponseBadRequest("upload_type обязателен")

        # Выбираем/создаем форму в зависимости от типа
        # Можно переиспользовать те же формы: OrthoUploadForm, LaserUploadForm...
        # но придется чуть адаптировать (т.к. там поля назваются по-другому).
        # Либо создать TempUploadForm, которая обрабатывает любой файл/ссылку.
        if upload_type == 'ortho':
            form = OrthoUploadForm(request.POST, request.FILES)
        elif upload_type == 'laser':
            form = LaserUploadForm(request.POST, request.FILES)
        elif upload_type == 'panorama':
            form = PanoramaUploadForm(request.POST)
        elif upload_type == 'overview':
            form = OverviewUploadForm(request.POST, request.FILES)
        else:
            return JsonResponse({'success': False, 'error': 'Неверный тип загрузки'}, status=400)

        if form.is_valid():
            if upload_type == 'ortho':
                # Используем ключ "orthoFile" вместо "file"
                temp_file = form.cleaned_data['orthoFile']
                view_link = form.cleaned_data.get('view_link')
                temp_result = TempResultFile.objects.create(
                    uploaded_by=request.user,
                    result_type=upload_type,
                    file=temp_file,
                    view_link=view_link or '',
                    file_size=temp_file.size
                )
                temp_id = temp_result.id
            elif upload_type == 'laser':
                # Используем ключ "laserFile" вместо "file"
                temp_file = form.cleaned_data['laserFile']
                view_link = form.cleaned_data.get('laserViewInput') or ''
                temp_result = TempResultFile.objects.create(
                    uploaded_by=request.user,
                    result_type=upload_type,
                    file=temp_file,
                    view_link=view_link or '',
                    file_size=temp_file.size
                )
                temp_id = temp_result.id
            elif upload_type == 'panorama':
                view_link = form.cleaned_data['panoramaViewInput']
                temp_result = TempResultFile.objects.create(
                    uploaded_by=request.user,
                    result_type=upload_type,
                    file=None,
                    view_link=view_link
                )
                temp_id = temp_result.id
            elif upload_type == 'overview':
                # Получаем список файлов из поля overviewFiles
                files = request.FILES.getlist('overviewFiles')
                if not files:
                    return JsonResponse({'success': False, 'error': 'Не выбраны файлы для загрузки.'}, status=400)
                created_ids = []
                for f in files:
                    temp_obj = TempResultFile.objects.create(
                        uploaded_by=request.user,
                        result_type=upload_type,
                        file=f,
                        file_size=f.size
                    )
                    created_ids.append(temp_obj.id)
                # Возвращаем список идентификаторов как строку JSON
                import json
                temp_id = json.dumps(created_ids)

            return JsonResponse({
                'success': True,
                'temp_id': temp_id
            })
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'error': errors}, status=400)



@method_decorator(login_required, name='dispatch')
class ConfirmTempFileView(View):
    """
    Принимает temp_id (для одиночных файлов) или temp_ids (для множественной загрузки Overview файлов)
    вместе с request_id и view_link.
    Переносит файл(ы) из TempResultFile -> FlightResultFile.
    Удаляет TempResultFile.
    """
    def post(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return JsonResponse({'success': False, 'error': 'Доступ запрещен'}, status=403)

        request_id = request.POST.get('request_id')
        if not request_id:
            return HttpResponseBadRequest("request_id обязательны.")

        try:
            flight = FlightRequest.objects.get(pk=request_id)
        except FlightRequest.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Заявка не найдена'}, status=404)

        # --- Обработка множественной загрузки (overview) ---
        temp_ids_json = request.POST.get('temp_ids')
        if temp_ids_json:
            import json
            try:
                temp_ids = json.loads(temp_ids_json)
            except json.JSONDecodeError:
                return JsonResponse({'success': False, 'error': 'Неверный формат temp_ids'}, status=400)

            # Считываем view_link из POST. Если оно не пустое, то используем его, иначе — значение из TempResultFile.
            view_link = request.POST.get('view_link', '')
            for tid in temp_ids:
                try:
                    temp_file = TempResultFile.objects.get(pk=tid, uploaded_by=request.user)
                except TempResultFile.DoesNotExist:
                    continue  # Можно добавить обработку ошибки
                final_obj = FlightResultFile(
                    flight_request=flight,
                    result_type=temp_file.result_type,
                    view_link = view_link if view_link.strip() != '' else temp_file.view_link,
                    file_size=temp_file.file_size
                )
                if temp_file.file:
                    import os
                    filename = os.path.basename(temp_file.file.name)
                    with temp_file.file.open('rb') as f:
                        final_obj.file.save(filename, f, save=False)
                final_obj.save()
                if temp_file.file:
                    temp_file.file.delete(save=False)
                temp_file.delete()
            return JsonResponse({'success': True, 'message': 'Файлы подтверждены и перемещены'})

        # --- Обработка одиночного файла (ortho, laser, panorama) ---
        # Получаем temp_id и очищаем пробелы
        temp_id = request.POST.get('temp_id', '').strip()
        # Получаем актуальное значение ссылки из POST
        view_link_param = request.POST.get('view_link', '').strip()

        # Если temp_id отсутствует, но передана ссылка, обновляем только поле view_link в существующей записи
        if not temp_id and view_link_param:
            # Попытка найти существующую запись для данной заявки и типа "laser" (или другого, если применяется)
            # Здесь предполагается, что именно для обновления ссылки без нового файла temp_id не передаётся
            existing_obj = FlightResultFile.objects.filter(
                flight_request=flight,
                result_type='laser'  # Если нужна универсальность, можно ориентироваться на дополнительный параметр
            ).first()
            if existing_obj:
                existing_obj.view_link = view_link_param
                existing_obj.save()
                return JsonResponse({'success': True, 'message': 'Ссылка успешно обновлена'})
            else:
                return JsonResponse({'success': False, 'error': 'Запись для обновления ссылки не найдена'}, status=404)

        # Если по-прежнему нет temp_id, выдаём ошибку (т.е. новый файл ещё не загружен)
        if not temp_id:
            return HttpResponseBadRequest("temp_id обязательны.")

        try:
            temp_file = TempResultFile.objects.get(pk=temp_id, uploaded_by=request.user)
        except TempResultFile.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Temp file не найден'}, status=404)

        # Определяем итоговое значение ссылки: если значение в POST не пустое, используем его;
        # иначе оставляем значение, сохранённое во временной записи.
        final_view_link = view_link_param if view_link_param != '' else temp_file.view_link

        # Попытка найти существующую запись для этой заявки и данного типа
        existing_obj = FlightResultFile.objects.filter(
            flight_request=flight,
            result_type=temp_file.result_type
        ).first()

        if existing_obj:
            # Обновляем существующую запись: сохраняем новое значение ссылки (если оно пришло)
            existing_obj.view_link = final_view_link
            # Если у временной записи есть файл, обновляем его в существующем объекте
            if temp_file.file:
                import os
                filename = os.path.basename(temp_file.file.name)
                if existing_obj.file:
                    existing_obj.file.delete(save=False)
                with temp_file.file.open('rb') as f:
                    existing_obj.file.save(filename, f, save=False)
                existing_obj.file_size = temp_file.file.size
            existing_obj.save()
            final_obj = existing_obj
        else:
            # Если записи нет, создаём новую
            final_obj = FlightResultFile(
                flight_request=flight,
                result_type=temp_file.result_type,
                view_link = final_view_link,
                file_size=temp_file.file_size
            )
            if temp_file.file:
                import os
                filename = os.path.basename(temp_file.file.name)
                with temp_file.file.open('rb') as f:
                    final_obj.file.save(filename, f, save=False)
            final_obj.save()

        if temp_file.file:
            temp_file.file.delete(save=False)
        temp_file.delete()

        return JsonResponse({'success': True, 'message': 'Файл (и/или ссылка) успешно сохранены'})







@method_decorator(login_required, name='dispatch')
class CancelTempFileView(View):
    """
    Удаляет временный файл (при отмене).
    """
    def post(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return JsonResponse({'success': False, 'error': 'Доступ запрещен'}, status=403)

        temp_id = request.POST.get('temp_id')
        if not temp_id:
            return HttpResponseBadRequest("temp_id обязателен")

        try:
            temp_file = TempResultFile.objects.get(pk=temp_id, uploaded_by=request.user)
            # Удаляем физический файл из хранилища
            if temp_file.file:
                temp_file.file.delete(save=False)
            temp_file.delete()
            return JsonResponse({'success': True, 'message': 'Временный файл удалён'})
        except TempResultFile.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Temp file не найден'}, status=404)

@method_decorator(login_required, name='dispatch')
class DeleteResultFileView(View):
    """
    Представление для удаления подтверждённого файла (или ссылки)
    из постоянного хранилища.
    """
    def post(self, request, file_id, *args, **kwargs):
        if not request.user.is_staff:
            return JsonResponse({'success': False, 'error': 'Доступ запрещен'}, status=403)

        element_type = request.POST.get('element_type', 'full')
        
        try:
            file_obj = FlightResultFile.objects.get(pk=file_id)
        except FlightResultFile.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Файл не найден'}, status=404)
        
        # 1. Если удаляем только ссылку для просмотра лазера:
        if element_type == "laser_view":
            file_obj.view_link = ""
            file_obj.save()
            # Если в записи после удаления ссылки нет файла, удалим запись полностью.
            if not file_obj.file:
                file_obj.delete()
                return JsonResponse({'success': True, 'message': 'Ссылка удалена, запись пуста – удалена полностью'})
            return JsonResponse({'success': True, 'message': 'Ссылка удалена'})
        
        # 2. Если удаляем файл лазерного сканирования
        if element_type == "laser":
            if file_obj.view_link and file_obj.view_link.strip() != "":
                # Если ссылка сохранена, удаляем только файл
                if file_obj.file:
                    file_obj.file.delete(save=False)
                file_obj.file = None
                file_obj.file_size = None
                file_obj.save()
                return JsonResponse({'success': True, 'message': 'Файл удалён, ссылка сохранена'})
        
        # 3. Для остальных случаев (или если для лазера ссылка отсутствует) – удаляем полностью:
        if file_obj.file:
            file_obj.file.delete(save=False)
        file_obj.delete()
        return JsonResponse({'success': True, 'message': 'Элемент удалён'})

