# main_app/urls.py

from django.urls import path
from .views import (
    FlightRequestListView,
    FlightRequestCreateView,
    FlightRequestUpdateView,
    get_object_names,
    ExportExcelView,
    ExportPDFView,
)

urlpatterns = [
    path('requests/', FlightRequestListView.as_view(), name='requests_list'),
    path('requests/create/', FlightRequestCreateView.as_view(), name='request_create'),
    path('requests/edit/<int:pk>/', FlightRequestUpdateView.as_view(), name='request_edit'),
    path('requests/get_object_names/', get_object_names, name='get_object_names'),
    path('requests/export/excel/', ExportExcelView.as_view(), name='export_excel'),
    path('requests/export/pdf/', ExportPDFView.as_view(), name='export_pdf'),
]
