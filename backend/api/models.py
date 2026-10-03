from django.db import models
from django.contrib.auth.models import User

class Resume(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='resumes', null=True, blank=True)
    title = models.CharField(max_length=255, default='My Resume')
    template_style = models.CharField(max_length=50, default='modern')
    accent_color = models.CharField(max_length=7, default='#0056b3')
    font_family = models.CharField(max_length=50, default='Inter')
    custom_sections = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.title} - {self.user.email if self.user else 'Guest'}"

class PersonalInfo(models.Model):
    resume = models.OneToOneField(Resume, on_delete=models.CASCADE, related_name='personal')
    first_name = models.CharField(max_length=100, blank=True, default='')
    last_name = models.CharField(max_length=100, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='')
    location = models.CharField(max_length=255, blank=True, default='')
    website = models.CharField(max_length=255, blank=True, default='')
    linkedin = models.CharField(max_length=255, blank=True, default='')
    github = models.CharField(max_length=255, blank=True, default='')
    summary = models.TextField(blank=True, default='')

class Experience(models.Model):
    resume = models.ForeignKey(Resume, on_delete=models.CASCADE, related_name='experience')
    title = models.CharField(max_length=255, blank=True, default='')
    company = models.CharField(max_length=255, blank=True, default='')
    location = models.CharField(max_length=255, blank=True, default='')
    start_date = models.CharField(max_length=7, blank=True, default='')  # YYYY-MM
    end_date = models.CharField(max_length=7, blank=True, default='')    # YYYY-MM
    current = models.BooleanField(default=False)
    bullets = models.TextField(blank=True, default='')  # Newline-separated bullets

class Education(models.Model):
    resume = models.ForeignKey(Resume, on_delete=models.CASCADE, related_name='education')
    degree = models.CharField(max_length=255, blank=True, default='')
    school = models.CharField(max_length=255, blank=True, default='')
    location = models.CharField(max_length=255, blank=True, default='')
    start_date = models.CharField(max_length=7, blank=True, default='')  # YYYY-MM
    end_date = models.CharField(max_length=7, blank=True, default='')    # YYYY-MM
    gpa = models.CharField(max_length=50, blank=True, default='')

class Project(models.Model):
    resume = models.ForeignKey(Resume, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=255, blank=True, default='')
    role = models.CharField(max_length=255, blank=True, default='')
    description = models.TextField(blank=True, default='')
    link = models.CharField(max_length=255, blank=True, default='')
    tech = models.CharField(max_length=255, blank=True, default='')

class Skill(models.Model):
    resume = models.ForeignKey(Resume, on_delete=models.CASCADE, related_name='skills')
    name = models.CharField(max_length=100, blank=True, default='')
    category = models.CharField(max_length=100, blank=True, default='')

class ATSAnalysis(models.Model):
    resume = models.ForeignKey(Resume, on_delete=models.SET_NULL, null=True, blank=True, related_name='analyses')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analyses', null=True, blank=True)
    job_description = models.TextField()
    score = models.IntegerField()
    feedback = models.JSONField()  # Groq analysis schema stored directly
    created_at = models.DateTimeField(auto_now_add=True)
