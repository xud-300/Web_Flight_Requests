# main_app/views.py
import json
from django.shortcuts import get_object_or_404
from django.views.generic import ListView, CreateView, UpdateView, View
from django.http import JsonResponse, HttpResponse, HttpResponseForbidden
from django.urls import reverse_lazy
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.decorators import login_required
from django import forms
from django.template.loader import render_to_string
from .models import FlightRequest, RequestHistory, Object, ObjectType, TelegramUser
from main_app.models import User
from .forms import FlightRequestCreateForm, FlightRequestEditForm
from django.views.decorators.http import require_POST


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
        context['is_editable'] = (self.object.status != "завершена") or (self.request.user.is_staff or (hasattr(self.request.user, 'profile') and self.request.user.profile.role == 'admin'))
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
                choices=[('новая', 'Новая'), ('завершена', 'Завершена')],
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