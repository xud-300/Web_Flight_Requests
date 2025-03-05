# main_app/views.py

from django.shortcuts import get_object_or_404
from django.views.generic import ListView, CreateView, UpdateView, View
from django.http import JsonResponse, HttpResponse, HttpResponseForbidden
from django.urls import reverse_lazy
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.decorators import login_required
from django import forms

from .models import FlightRequest, RequestHistory, Object, ObjectType
from .forms import FlightRequestCreateForm, FlightRequestEditForm


# Список заявок. Обычный пользователь видит только свои заявки,
# а администратор — все заявки.
class FlightRequestListView(LoginRequiredMixin, ListView):
    model = FlightRequest
    template_name = 'main_app/requests_list.html'
    context_object_name = 'requests'

    def get_queryset(self):
        if self.request.user.is_staff:
            return FlightRequest.objects.all().order_by('-created_at')
        else:
            return FlightRequest.objects.filter(user_id=self.request.user.id).order_by('-created_at')

    def get_context_data(self, **kwargs):
        # Получаем базовый контекст
        context = super().get_context_data(**kwargs)
        # Добавляем в контекст список типов объектов из модели ObjectType
        from .models import ObjectType  # или, если ObjectType уже импортирована, не нужно импортировать заново
        context['object_types'] = ObjectType.objects.all()
        return context


# Создание заявки через модальное окно.
class FlightRequestCreateView(LoginRequiredMixin, CreateView):
    model = FlightRequest
    form_class = FlightRequestCreateForm
    template_name = 'modal_create.html'
    success_url = reverse_lazy('requests_list')  # Имя маршрута для списка заявок

    def form_valid(self, form):
        # Устанавливаем текущего пользователя как создателя заявки.
        form.instance.user_id = self.request.user.id
        form.instance.username = self.request.user.username
        self.object = form.save()
        # Используем проверку заголовка, так как request.is_ajax() больше не поддерживается
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
    template_name = 'modal_edit.html'
    success_url = reverse_lazy('requests_list')

    def dispatch(self, request, *args, **kwargs):
        self.object = self.get_object()
        # Обычный пользователь может редактировать только свои заявки.
        if not request.user.is_staff and self.object.user_id != request.user.id:
            return HttpResponseForbidden("У вас нет прав для редактирования этой заявки.")
        return super().dispatch(request, *args, **kwargs)

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        # Если редактирует администратор, добавляем поле status динамически.
        if self.request.user.is_staff:
            form.fields['status'] = forms.CharField(initial=self.object.status)
        return form

    def form_valid(self, form):
        response = super().form_valid(form)
        # Сохраняем историю изменений: фиксируем какие поля были изменены.
        changes = "Изменены поля: " + ", ".join(form.changed_data)
        RequestHistory.objects.create(
            flight_request=self.object,
            changed_by=self.request.user,
            changes=changes,
        )
        return response


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
