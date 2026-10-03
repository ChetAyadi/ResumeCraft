from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase
from api.models import Resume

class AuthTests(APITestCase):
    def test_user_registration(self):
        url = reverse('auth_register')
        data = {
            'email': 'testuser@example.com',
            'password': 'testpassword123'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['email'], 'testuser@example.com')

    def test_user_login(self):
        # Create user
        User.objects.create_user(
            username='loginuser@example.com',
            email='loginuser@example.com',
            password='loginpassword123'
        )
        url = reverse('token_obtain_pair')
        data = {
            'username': 'loginuser@example.com',
            'password': 'loginpassword123'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

class ATSEvaluationTests(APITestCase):
    def setUp(self):
        self.job_description = (
            "Looking for a Python Developer experienced with Django and PostgreSQL. "
            "Familiarity with Docker containers and Git version control is required."
        )
        self.resume_text = (
            "John Doe. Software Developer with experience in Python, Django, and SQL databases. "
            "Experienced in Git version control."
        )

    def test_evaluate_guest_resume_text(self):
        url = reverse('ats_evaluate')
        data = {
            'job_description': self.job_description,
            'resume_text': self.resume_text
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('result', response.data)
        
        result = response.data['result']
        self.assertIn('score', result)
        self.assertIn('matching_keywords', result)
        self.assertIn('missing_keywords', result)
        self.assertIn('content_improvements', result)
        
        # Verify it matched keywords
        matching_lower = [k.lower() for k in result['matching_keywords']]
        self.assertIn('python', matching_lower)
        self.assertIn('django', matching_lower)
        
        # Verify it caught missing keywords from the JD
        missing_lower = [k.lower() for k in result['missing_keywords']]
        self.assertIn('docker', missing_lower)

    def test_optimize_resume_text(self):
        url = reverse('ats_optimize')
        data = {
            'job_description': self.job_description,
            'resume_text': self.resume_text
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('optimized_text', response.data)
        self.assertTrue(len(response.data['optimized_text']) > 50)

    def test_optimize_resume_file(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        url = reverse('ats_optimize')
        resume_file = SimpleUploadedFile("resume.txt", b"Worked on Django backend for inventory. Knows PostgreSQL and Python.")
        data = {
            'job_description': self.job_description,
            'resume_file': resume_file
        }
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('optimized_text', response.data)
        self.assertTrue(len(response.data['optimized_text']) > 50)

    def test_evaluate_docx_file(self):
        import docx
        import io
        from django.core.files.uploadedfile import SimpleUploadedFile
        
        # Create docx in memory
        doc = docx.Document()
        doc.add_paragraph("Worked on Django backend for inventory. Experienced Python developer.")
        
        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        
        docx_file = SimpleUploadedFile("resume.docx", buffer.read(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        
        url = reverse('ats_evaluate')
        data = {
            'job_description': self.job_description,
            'resume_file': docx_file
        }
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('result', response.data)
        self.assertTrue(response.data['result']['score'] > 0)

    def test_suggest_summary(self):
        url = reverse('resume_suggest_summary')
        data = {
            'skills': 'Python, Django REST Framework, Postgres, Git',
            'experience': 'Senior developer at TechCorp, managed inventory backends.'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('suggestions', response.data)
        self.assertIn('executive', response.data['suggestions'])
        self.assertIn('modern', response.data['suggestions'])
        self.assertIn('creative', response.data['suggestions'])

    def test_export_pdf_fallback(self):
        url = reverse('resume_export_pdf')
        data = {
            'html_content': '<html><body><h1>Resume of John</h1></body></html>',
            'filename': 'john_resume.pdf'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        if hasattr(response, 'data') and response.data and 'fallback' in response.data:
            self.assertTrue(response.data['fallback'])
        else:
            self.assertEqual(response['Content-Type'], 'application/pdf')

    def test_scans_list_unauthorized(self):
        url = '/api/scans/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_scans_list_authenticated(self):
        user = User.objects.create_user(
            username='dashboarduser@example.com',
            email='dashboarduser@example.com',
            password='password123'
        )
        self.client.force_authenticate(user=user)
        
        from api.models import ATSAnalysis
        ATSAnalysis.objects.create(
            user=user,
            job_description="Python coding",
            score=82,
            feedback={"score": 82}
        )
        
        url = '/api/scans/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['score'], 82)


class AdvancedFeaturesTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='advanceduser@example.com',
            email='advanceduser@example.com',
            password='advancedpassword123'
        )
        self.client.force_authenticate(user=self.user)

    def test_save_resume_with_custom_styling_and_sections(self):
        url = '/api/resumes/'
        data = {
            'title': 'Stunning Modern Resume',
            'template_style': 'modern',
            'accent_color': '#ff5733',
            'font_family': 'Outfit',
            'custom_sections': {
                'certifications': [{'name': 'AWS Solutions Architect', 'authority': 'AWS', 'date': '2025'}],
                'languages': [{'name': 'Hindi', 'proficiency': 'Native'}],
                'awards': [{'title': 'Hackathon Winner', 'issuer': 'Google', 'date': '2024'}],
                'publications': [{'title': 'Scaling APIs', 'publisher': 'Medium', 'date': '2026', 'link': 'https://medium.com'}]
            },
            'personal': {
                'first_name': 'Vivek',
                'last_name': 'Sharma',
                'email': 'vivek@example.com',
                'phone': '1234567890',
                'location': 'Delhi, India',
                'website': 'viveksharma.dev',
                'summary': 'Full stack developer.'
            },
            'experience': [],
            'education': [],
            'projects': [],
            'skills': []
        }
        
        # Save resume
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        
        resume_id = response.data['id']
        
        # Retrieve resume
        get_response = self.client.get(f'/api/resumes/{resume_id}/')
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data['accent_color'], '#ff5733')
        self.assertEqual(get_response.data['font_family'], 'Outfit')
        self.assertIn('certifications', get_response.data['custom_sections'])
        self.assertEqual(get_response.data['custom_sections']['languages'][0]['name'], 'Hindi')

    def test_generate_cover_letter(self):
        url = reverse('resume_generate_cover_letter')
        data = {
            'resume_text': 'Software engineer experienced in Python and Django.',
            'job_description': 'Looking for a Python Django backend developer.'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('cover_letter', response.data)
        self.assertTrue(len(response.data['cover_letter']) > 20)

    def test_generate_interview_qa(self):
        url = reverse('resume_generate_interview_qa')
        data = {
            'resume_text': 'Software engineer experienced in Python and Django.',
            'job_description': 'Looking for a Python Django backend developer.'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('qa', response.data)
        self.assertEqual(len(response.data['qa']), 5)


class ChatbotTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='chatbotuser@example.com',
            email='chatbotuser@example.com',
            password='password123'
        )
        self.client.force_authenticate(user=self.user)

    def test_chatbot_without_message(self):
        url = reverse('chatbot_chat')
        data = {}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)

    def test_chatbot_completions_fallback(self):
        url = reverse('chatbot_chat')
        data = {
            'message': 'Tell me about ATS keyword optimization advice.',
            'history': [
                {'role': 'user', 'content': 'Hello'},
                {'role': 'assistant', 'content': 'Hi there!'}
            ]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('response', response.data)
        self.assertIn('ats', response.data['response'].lower())


class UserProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='profileuser@example.com',
            email='profileuser@example.com',
            password='password123',
            first_name='Alex',
            last_name='Morgan'
        )
        self.client.force_authenticate(user=self.user)

    def test_get_user_profile(self):
        url = reverse('auth_profile')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'profileuser@example.com')
        self.assertEqual(response.data['first_name'], 'Alex')
        self.assertIn('stats', response.data)
        self.assertEqual(response.data['stats']['total_resumes'], 0)

    def test_update_user_profile(self):
        url = reverse('auth_profile')
        data = {
            'first_name': 'Alexander',
            'last_name': 'Smith',
            'email': 'alexander.smith@example.com'
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['first_name'], 'Alexander')
        self.assertEqual(response.data['email'], 'alexander.smith@example.com')




