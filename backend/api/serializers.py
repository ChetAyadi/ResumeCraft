from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Resume, PersonalInfo, Experience, Education, Project, Skill, ATSAnalysis

# User Registration Serializer
class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ('email', 'password')

    def create(self, validated_data):
        email = validated_data['email']
        password = validated_data['password']
        
        # Check if user already exists
        if User.objects.filter(username=email).exists():
            raise serializers.ValidationError({"detail": "User with this email already exists."})
            
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password
        )
        return user


# Nested Resume Fields Serializers
class PersonalInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalInfo
        exclude = ('resume',)

class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        exclude = ('resume',)

class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        exclude = ('resume',)

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        exclude = ('resume',)

class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        exclude = ('resume',)


# Top Level Resume Serializer with Nested Reads & Writes
class ResumeSerializer(serializers.ModelSerializer):
    personal = PersonalInfoSerializer(required=False)
    experience = ExperienceSerializer(many=True, required=False, default=[])
    education = EducationSerializer(many=True, required=False, default=[])
    projects = ProjectSerializer(many=True, required=False, default=[])
    skills = SkillSerializer(many=True, required=False, default=[])
    updated_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Resume
        fields = ('id', 'title', 'template_style', 'accent_color', 'font_family', 'custom_sections', 'personal', 'experience', 'education', 'projects', 'skills', 'updated_at')

    def create(self, validated_data):
        # Extract nested relations
        personal_data = validated_data.pop('personal', {})
        experience_data = validated_data.pop('experience', [])
        education_data = validated_data.pop('education', [])
        projects_data = validated_data.pop('projects', [])
        skills_data = validated_data.pop('skills', [])

        # Create base resume
        resume = Resume.objects.create(**validated_data)

        # Create Personal Info
        PersonalInfo.objects.create(resume=resume, **personal_data)

        # Bulk create experience, education, projects, skills
        for exp in experience_data:
            Experience.objects.create(resume=resume, **exp)
        for edu in education_data:
            Education.objects.create(resume=resume, **edu)
        for proj in projects_data:
            Project.objects.create(resume=resume, **proj)
        for skill in skills_data:
            Skill.objects.create(resume=resume, **skill)

        return resume

    def update(self, instance, validated_data):
        # Update base properties
        instance.title = validated_data.get('title', instance.title)
        instance.template_style = validated_data.get('template_style', instance.template_style)
        instance.accent_color = validated_data.get('accent_color', instance.accent_color)
        instance.font_family = validated_data.get('font_family', instance.font_family)
        instance.custom_sections = validated_data.get('custom_sections', instance.custom_sections)
        instance.save()

        # Update PersonalInfo
        personal_data = validated_data.pop('personal', {})
        if personal_data:
            personal_instance, _ = PersonalInfo.objects.get_or_create(resume=instance)
            for attr, value in personal_data.items():
                setattr(personal_instance, attr, value)
            personal_instance.save()

        # Update Experience (Re-create strategy)
        if 'experience' in validated_data:
            instance.experience.all().delete()
            for exp in validated_data.pop('experience', []):
                Experience.objects.create(resume=instance, **exp)

        # Update Education (Re-create strategy)
        if 'education' in validated_data:
            instance.education.all().delete()
            for edu in validated_data.pop('education', []):
                Education.objects.create(resume=instance, **edu)

        # Update Projects (Re-create strategy)
        if 'projects' in validated_data:
            instance.projects.all().delete()
            for proj in validated_data.pop('projects', []):
                Project.objects.create(resume=instance, **proj)

        # Update Skills (Re-create strategy)
        if 'skills' in validated_data:
            instance.skills.all().delete()
            for skill in validated_data.pop('skills', []):
                Skill.objects.create(resume=instance, **skill)

        return instance


# ATS Analysis History Serializer
class ATSAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = ATSAnalysis
        fields = ('id', 'resume', 'job_description', 'score', 'feedback', 'created_at')
