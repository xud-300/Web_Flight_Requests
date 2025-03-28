# main_app/urls.py

from django.urls import path
from .views import (
    FlightRequestListView,
    FlightRequestCreateView,
    FlightRequestUpdateView,
    get_object_names,
    ExportExcelView,
    ExportPDFView,
    delete_flight_request,
    mass_update_status,
    mass_delete_requests,
    get_request_results,
    UploadResultView,
    UploadTempFileView,
    ConfirmTempFileView,
    CancelTempFileView,
)

urlpatterns = [
    path('requests/', FlightRequestListView.as_view(), name='requests_list'),
    path('requests/create/', FlightRequestCreateView.as_view(), name='request_create'),
    path('requests/edit/<int:pk>/', FlightRequestUpdateView.as_view(), name='request_edit'),
    path('requests/get_object_names/', get_object_names, name='get_object_names'),
    path('requests/export/excel/', ExportExcelView.as_view(), name='export_excel'),
    path('requests/export/pdf/', ExportPDFView.as_view(), name='export_pdf'),
    path('requests/delete/<int:pk>/', delete_flight_request, name='request_delete'),
    path('requests/mass_update_status/', mass_update_status, name='mass_update_status'),
    path('requests/mass_delete/', mass_delete_requests, name='mass_delete_requests'),
    path('requests/get_results/', get_request_results, name='get_request_results'),
    path('requests/upload_result/', UploadResultView.as_view(), name='upload_result'),
    path('requests/upload_temp_file/', UploadTempFileView.as_view(), name='upload_temp_file'),
    path('requests/confirm_temp_file/', ConfirmTempFileView.as_view(), name='confirm_temp_file'),
    path('requests/cancel_temp_file/', CancelTempFileView.as_view(), name='cancel_temp_file'),

]
