from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserRegisterView,
    GoogleAuthView,
    UserProfileView,
    ResumeViewSet,
    ATSAnalysisViewSet,
    ATSEvaluateView,
    ATSOptimizeView,
    ResumePDFExportView,
    ResumeSummarySuggestView,
    ResumeCoverLetterView,
    ResumeInterviewQAView,
    ChatbotView
)

# Initialize DRF Router for Viewsets
router = DefaultRouter()
router.register(r'resumes', ResumeViewSet, basename='resume')
router.register(r'scans', ATSAnalysisViewSet, basename='scan')


urlpatterns = [
    # ViewSet routes
    path('', include(router.urls)),
    
    # Auth endpoints
    path('auth/register/', UserRegisterView.as_view(), name='auth_register'),
    path('auth/google/', GoogleAuthView.as_view(), name='auth_google'),
    path('auth/profile/', UserProfileView.as_view(), name='auth_profile'),
    
    # ATS optimization scanner endpoint
    path('ats/evaluate/', ATSEvaluateView.as_view(), name='ats_evaluate'),
    path('ats/optimize/', ATSOptimizeView.as_view(), name='ats_optimize'),
    
    # PDF export and Summary helper endpoints
    path('ats/export-pdf/', ResumePDFExportView.as_view(), name='resume_export_pdf'),
    path('ats/suggest-summary/', ResumeSummarySuggestView.as_view(), name='resume_suggest_summary'),
    path('ats/generate-cover-letter/', ResumeCoverLetterView.as_view(), name='resume_generate_cover_letter'),
    path('ats/generate-interview-qa/', ResumeInterviewQAView.as_view(), name='resume_generate_interview_qa'),
    
    # AI Chatbot endpoint
    path('chatbot/chat/', ChatbotView.as_view(), name='chatbot_chat'),
]
