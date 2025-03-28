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


@require_GET
@login_required
def get_request_results(request):
    """
    Возвращает данные результатов съёмки для заявки.
    Ожидается GET параметр request_id.
    Если заявка не найдена или request_id не передан, возвращает ошибку.
    """
    request_id = request.GET.get('request_id')
    if not request_id:
        return HttpResponseBadRequest("request_id не указан")
    
    try:
        flight = FlightRequest.objects.get(id=request_id)
    except FlightRequest.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Заявка не найдена'}, status=404)
    
    # Формируем объект данных для каждого типа съемки,
    # если соответствующий флаг (orthophoto, laser, panorama, overview) установлен в заявке.
    data = {}
    
    # Безопасная функция для получения атрибутов (чтобы не вызывать ошибку, если поля нет)
    def safe_getattr(obj, attr_name, default=None):
        return getattr(obj, attr_name, default)

    # Ортофотоплан
    if getattr(flight, 'orthophoto', False):
        data['orthophoto'] = {
            'download_link': safe_getattr(flight, 'ortho_archive_url', '#'),
            'archive_name': safe_getattr(flight, 'ortho_archive_name', 'ortho_archive.zip')
        }
    
    # Лазерное сканирование
    if getattr(flight, 'laser', False):
        data['laser'] = {
            'download_link': safe_getattr(flight, 'laser_archive_url', '#'),
            'view_link': safe_getattr(flight, 'laser_view_url', '#')
        }
    
    # Панорама
    if getattr(flight, 'panorama', False):
        data['panorama'] = {
            'view_link': safe_getattr(flight, 'panorama_view_url', '#')
        }
    
    # Обзорные фото
    if getattr(flight, 'overview', False):
        data['overview'] = {
            'download_link': safe_getattr(flight, 'overview_archive_url', '#'),
            'view_link': safe_getattr(flight, 'overview_view_url', '#')
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
            if upload_type in ['ortho', 'laser']:
                # Сохраняем один файл
                file = form.cleaned_data.get('file')
                view_link = form.cleaned_data.get('view_link') if upload_type == 'laser' else None
                result_file = FlightResultFile.objects.create(
                    flight_request=flight,
                    result_type=upload_type,
                    file=file,
                    view_link=view_link,
                    file_size=file.size
                )
            elif upload_type == 'panorama':
                # Только ссылка
                view_link = form.cleaned_data.get('view_link')
                result_file = FlightResultFile.objects.create(
                    flight_request=flight,
                    result_type=upload_type,
                    view_link=view_link
                )
            elif upload_type == 'overview':
                files = request.FILES.getlist('files')
                created_files = []
                for f in files:
                    rf = FlightResultFile.objects.create(
                        flight_request=flight,
                        result_type=upload_type,
                        file=f,
                        file_size=f.size
                    )
                    created_files.append(rf)
            # Формируем dummy-ответ, можно вернуть актуальные ссылки, если они вычисляются
            dummy_result = {
                upload_type: {
                    "download_link": f"/media/flight_results/{upload_type}_archive_updated.zip",  # или вычислить по-новому
                    "view_link": f"/results/{upload_type}_view/?id={request_id}",
                    "archive_name": f"{upload_type}_archive_updated.zip"
                }
            }
            return JsonResponse({'success': True, 'data': dummy_result})
        else:
            errors = form.errors.as_json()
            return JsonResponse({'success': False, 'error': errors})


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
            # Сохраняем во временной модели
            if upload_type in ['ortho', 'laser']:
                temp_file = form.cleaned_data['file']
                view_link = form.cleaned_data.get('view_link')
                temp_result = TempResultFile.objects.create(
                    uploaded_by=request.user,
                    result_type=upload_type,
                    file=temp_file,
                    view_link=view_link or '',
                    file_size=temp_file.size
                )
                temp_id = temp_result.id
            elif upload_type == 'panorama':
                view_link = form.cleaned_data['view_link']
                temp_result = TempResultFile.objects.create(
                    uploaded_by=request.user,
                    result_type=upload_type,
                    file=None,
                    view_link=view_link
                )
                temp_id = temp_result.id
            elif upload_type == 'overview':
                # Если у нас множественная загрузка
                # Можно хранить несколько записей TempResultFile (по одной на файл) или один архив
                files = request.FILES.getlist('files')
                # Для упрощения предполагаем, что пользователь загружает сразу все
                # Можно вернуть список ID, если нужно
                created_ids = []
                for f in files:
                    temp_obj = TempResultFile.objects.create(
                        uploaded_by=request.user,
                        result_type=upload_type,
                        file=f,
                        file_size=f.size
                    )
                    created_ids.append(temp_obj.id)
                # Возвращаем, например, список
                temp_id = created_ids

            return JsonResponse({
                'success': True,
                'temp_id': temp_id
            })
        else:
            return JsonResponse({'success': False, 'error': form.errors}, status=400)


@method_decorator(login_required, name='dispatch')
class ConfirmTempFileView(View):
    """
    Принимает temp_id и request_id.
    Переносит файл(ы) из TempResultFile -> FlightResultFile.
    Удаляет запись(и) из TempResultFile.
    """
    def post(self, request, *args, **kwargs):
        if not request.user.is_staff:
            return JsonResponse({'success': False, 'error': 'Доступ запрещен'}, status=403)

        temp_id = request.POST.get('temp_id')       # может быть список или одно число
        request_id = request.POST.get('request_id')
        if not temp_id or not request_id:
            return HttpResponseBadRequest("temp_id и request_id обязательны")

        try:
            flight = FlightRequest.objects.get(pk=request_id)
        except FlightRequest.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Заявка не найдена'}, status=404)

        # Забираем объекты из TempResultFile
        # Возможно, temp_id - это список (особенно для overview)
        # тогда можно сделать temp_id_list = json.loads(temp_id), если фронт так отправляет
        # или передавать несколько temp_id[]=... в POST.
        # Предположим, что у нас одна запись (ortho, laser, panorama) для простоты:
        try:
            temp_file = TempResultFile.objects.get(pk=temp_id, uploaded_by=request.user)
        except TempResultFile.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Temp file не найден'}, status=404)

        # "Переносим" файл
        # Самый простой способ: создаём FlightResultFile, указываем flight_request, type, file, view_link
        # Когда мы делаем .save(), Django не физически перемещает файл, а просто сохраняет путь.
        # Но если надо именно физически переместить - придётся дописывать логику вручную.
        final_obj = FlightResultFile.objects.create(
            flight_request=flight,
            result_type=temp_file.result_type,
            file=temp_file.file,
            view_link=temp_file.view_link,
            file_size=temp_file.file_size
        )

        # Удаляем temp_file (физически файл тоже удалится, если не включена опция keep_files)
        temp_file.delete()

        return JsonResponse({'success': True, 'message': 'Файл подтверждён и перемещён'})


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

