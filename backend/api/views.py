import os
import json
import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404 
from django.http import HttpResponse
from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

# Google Auth verify SDK
from google.oauth2 import id_token 
from google.auth.transport import requests as google_requests

from .models import Resume, ATSAnalysis
from .serializers import (
    UserRegisterSerializer,
    ResumeSerializer,
    ATSAnalysisSerializer
)

# HELPER: Generate JWT Tokens for a user
def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

# 1. User Registration View
class UserRegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            tokens = get_tokens_for_user(user)
            return Response({
                "email": user.email,
                "access": tokens["access"],
                "refresh": tokens["refresh"],
                "detail": "User created successfully."
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# 2. Google OAuth Token Verification & Login View
class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('token')
        if not token:
            return Response({"detail": "Token is required."}, status=status.HTTP_400_BAD_REQUEST)

        client_id = os.getenv('GOOGLE_CLIENT_ID')
        if not client_id or client_id == 'your_google_client_id_here':
            # Bypassed mock verify for demonstration/testing if client_id is not configured
            # Simply decode a JWT payload client-side token or mock it
            # To be safe, we allow mock fallback for local developer presentation if key is empty
            print("Google client ID not set. Mocking Google authentication for demonstration.")
            mock_email = "demo.user@gmail.com"
            user, created = User.objects.get_or_create(username=mock_email, email=mock_email)
            tokens = get_tokens_for_user(user)
            return Response({
                "email": user.email,
                "access": tokens["access"],
                "refresh": tokens["refresh"],
                "is_demo": True
            }, status=status.HTTP_200_OK)

        try:
            # Call Google Auth token verification API
            idinfo = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                client_id
            )

            # Check issuer
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')

            # Retrieve details
            email = idinfo['email']
            user, created = User.objects.get_or_create(username=email, email=email)
            
            # Update user info if new
            if created:
                user.first_name = idinfo.get('given_name', '')
                user.last_name = idinfo.get('family_name', '')
                user.save()

            tokens = get_tokens_for_user(user)
            return Response({
                "email": user.email,
                "access": tokens["access"],
                "refresh": tokens["refresh"]
            }, status=status.HTTP_200_OK)

        except ValueError as e:
            return Response({"detail": f"Invalid Google token: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": f"Verification error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# 2b. User Profile Details & Update View
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        total_resumes = Resume.objects.filter(user=user).count()
        scans = ATSAnalysis.objects.filter(user=user)
        total_scans = scans.count()
        avg_score = round(sum(s.score for s in scans) / total_scans) if total_scans > 0 else 0

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "date_joined": user.date_joined,
            "stats": {
                "total_resumes": total_resumes,
                "total_scans": total_scans,
                "avg_score": avg_score
            }
        }, status=status.HTTP_200_OK)

    def put(self, request):
        user = request.user
        data = request.data
        
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data and data['email']:
            user.email = data['email']
            user.username = data['email']
            
        if 'new_password' in data and data['new_password']:
            user.set_password(data['new_password'])
            
        user.save()
        return Response({
            "detail": "Profile updated successfully.",
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email
        }, status=status.HTTP_200_OK)


# 3. Resume CRUD ViewSet
class ResumeViewSet(viewsets.ModelViewSet):
    serializer_class = ResumeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Users can only see their own resumes
        return Resume.objects.filter(user=self.request.user).order_by('-updated_at')

    def perform_create(self, serializer):
        # Automatically assign the request user
        serializer.save(user=self.request.user)


class ATSAnalysisViewSet(viewsets.ReadOnlyModelViewSet):
    """
    [EXPLANATION FOR BEGINNERS]
    ReadOnlyModelViewSet is a DRF class that automatically supports list (get all scans)
    and retrieve (get single scan details) HTTP GET requests.
    """
    serializer_class = ATSAnalysisSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Authenticated user can retrieve their own previous ATS scan entries
        return ATSAnalysis.objects.filter(user=self.request.user).order_by('-created_at')



# 4. ATS Scorer & Optimizer API View (Beginner-Friendly DRF & LLM Integration)
class ATSEvaluateView(APIView):
    """
    [EXPLANATION FOR BEGINNERS]
    APIView is a Django REST Framework (DRF) class used to handle API endpoints.
    Here we handle POST requests where users submit their Resume + Job Description
    to scan for an ATS score.
    """
    # AllowAny allows both guests (unauthenticated) and logged-in users to scan resumes
    permission_classes = [AllowAny]

    def post(self, request):
        # STEP 1: Request body se Job Description retrieve karein
        job_description = request.data.get('job_description')
        if not job_description:
            return Response({"detail": "Job description is required."}, status=status.HTTP_400_BAD_REQUEST)

        resume_text = ""

        # STEP 2: Input variables read karein (id, file, ya plain text)
        resume_id = request.data.get('resume_id')
        resume_file = request.FILES.get('resume_file')
        resume_raw_text = request.data.get('resume_text')

        # STEP 3: User ne resume kaise input kiya hai uske basis par text extract karein
        if resume_id:
            # Case A: Saved Resume from database
            if not request.user.is_authenticated:
                return Response({"detail": "Auth token required to load saved resumes."}, status=status.HTTP_401_UNAUTHORIZED)
            
            # Database se user ka specific resume fetch karein
            resume_obj = get_object_or_404(Resume, id=resume_id, user=request.user)
            # Database details (experience, education, etc.) ko single string me convert karein
            resume_text = self._serialize_resume_to_text(resume_obj)

        elif resume_file:
            # Case B: File upload kiya hai (PDF, DOCX, TXT)
            ext = os.path.splitext(resume_file.name)[1].lower() # File extension extract karein (.docx, .pdf)
            
            if ext == '.txt':
                try:
                    resume_text = resume_file.read().decode('utf-8')
                except Exception as e:
                    return Response({"detail": f"Failed to read TXT file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
            elif ext in ['.pdf', '.docx']:
                # PyPDF ya python-docx module se text parse karein
                resume_text = self._extract_file_text(resume_file, ext)
            else:
                return Response({"detail": "Unsupported file format. Please upload .txt, .pdf, or .docx."}, status=status.HTTP_400_BAD_REQUEST)

        elif resume_raw_text:
            # Case C: Copy-paste kiya hua plain text
            resume_text = resume_raw_text
        else:
            return Response({"detail": "No resume source provided."}, status=status.HTTP_400_BAD_REQUEST)

        # STEP 4: Environment variables se Groq API Key check karein
        groq_api_key = os.getenv('GROQ_API_KEY')
        
        # Agar key configured nahi hai ya placeholder hai, toh local mock analysis chalayein
        if not groq_api_key or groq_api_key.strip() == '' or groq_api_key == 'your_groq_api_key_here':
            print("Groq API key not configured. Mocking analysis results.")
            result_json = self._get_mock_analysis(resume_text, job_description)
        else:
            # Try block taaki agar API server down ho ya rate limit aaye toh app crash na kare
            try:
                # Groq Server ko request send karein
                result_json = self._call_groq_api(resume_text, job_description, groq_api_key)
            except Exception as e:
                print(f"Groq API connection failed: {str(e)}. Falling back to mock review.")
                result_json = self._get_mock_analysis(resume_text, job_description)

        # STEP 5: Agar user logged in hai, toh unki history dashboard me scan log save karein
        if request.user.is_authenticated:
            res_obj = Resume.objects.filter(id=resume_id, user=request.user).first() if resume_id else None
            ATSAnalysis.objects.create(
                user=request.user,
                resume=res_obj,
                job_description=job_description,
                score=result_json.get('score', 0),
                feedback=result_json
            )

        # JSON response return karein status 200 OK ke saath
        return Response({
            "result": result_json,
            "resume_text": resume_text
        }, status=status.HTTP_200_OK)

    def _serialize_resume_to_text(self, resume):
        """
        Database ke Structured fields (Personal Info, Experiences, Projects, Skills)
        ko string format me merge karta hai taaki LLM use easily analyze kar sake.
        """
        lines = []
        p = resume.personal
        lines.append(f"Name: {p.first_name} {p.last_name}")
        lines.append(f"Email: {p.email} | Phone: {p.phone} | Location: {p.location}")
        lines.append(f"Summary: {p.summary}\n")

        lines.append("WORK EXPERIENCE:")
        for exp in resume.experience.all():
            lines.append(f"- {exp.title} at {exp.company} ({exp.start_date} to {exp.end_date or 'Present'}) in {exp.location}")
            lines.append(f"  Bullets:\n  {exp.bullets}\n")

        lines.append("EDUCATION:")
        for edu in resume.education.all():
            lines.append(f"- {edu.degree} from {edu.school} ({edu.start_date} to {edu.end_date}) | GPA: {edu.gpa}")

        lines.append("\nPROJECTS:")
        for proj in resume.projects.all():
            lines.append(f"- {proj.name} ({proj.role})")
            lines.append(f"  Description: {proj.description}")
            lines.append(f"  Technologies: {proj.tech} | Link: {proj.link}")

        lines.append("\nSKILLS:")
        for skill in resume.skills.all():
            lines.append(f"- {skill.name} ({skill.category})")

        return "\n".join(lines)

    def _extract_file_text(self, file_obj, ext):
        """
        File handler:
        - PDF: uses `pypdf` reader to extract raw characters.
        - DOCX: uses `python-docx` to loop through paragraphs and tabular structures.
        """
        if ext == '.pdf':
            try:
                import pypdf
                reader = pypdf.PdfReader(file_obj)
                text = ""
                # PDF ke har page se text select karke add karein
                for page in reader.pages:
                    text += page.extract_text() or ""
                if text.strip():
                    return text
            except Exception as e:
                print("pypdf parsing failed or missing:", e)
        
        elif ext == '.docx':
            try:
                import docx
                import io
                # Django file object stream ko BytesIO buffer me pass karein
                file_stream = io.BytesIO(file_obj.read())
                doc = docx.Document(file_stream)
                text = ""
                # Har Paragraph ka text extract karein
                for para in doc.paragraphs:
                    text += para.text + "\n"
                # Har Table block ke row columns parse karein
                for table in doc.tables:
                    for row in table.rows:
                        for cell in row.cells:
                            text += cell.text + " "
                        text += "\n"
                if text.strip():
                    return text
            except Exception as e:
                print("python-docx parsing failed, fallback will trigger:", e)
        
        # Fallback raw byte extraction (seek reset to ensure read pointer is at index 0)
        try:
            if hasattr(file_obj, 'seek'):
                file_obj.seek(0)
            raw_bytes = file_obj.read()
            return raw_bytes.decode('utf-8', errors='ignore')
        except Exception:
            return "File uploaded but text could not be extracted."

    def _call_groq_api(self, resume_text, job_desc, api_key):
        """
        Sends HTTP request to Groq API and parses the JSON response.
        """
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        # System Prompt sets instructions for the AI on how to perform the analysis.
        # We specify JSON schema to ensure the model responds only in JSON format.
        system_prompt = (
            "You are an expert recruitment consultant and highly precise ATS (Applicant Tracking System) parser. "
            "Your objective is to perform a rigorous compatibility analysis of the candidate's Resume against the Job Description. "
            "Calculate three sub-scores (0 to 100) and an overall score using these strict guidelines:\n"
            "1. KEYWORD SCORE (40% weight): Identify exact and semantic skill overlap. If the JD requires a skill (e.g. 'RESTful API') "
            "and the resume lists a direct equivalent (e.g. 'REST APIs'), count it as a match (semantic normalization). "
            "Deduct 10 points for each core required hard skill or tool that is completely missing.\n"
            "2. SKILLS ALIGNMENT SCORE (30% weight): Check years of experience, methodologies, and framework depth. "
            "If the JD asks for a senior (5+ years) and the resume indicates a junior level (1-2 years), deduct 25 points.\n"
            "3. FORMATTING SCORE (20% weight): Compliance with standard resumes. Deduct 15 points if contact details (email/phone) are missing. "
            "Deduct 10 points if sections are disorganized or formatting is unparseable.\n"
            "4. OVERALL SCORE (10% industry-fit alignment): A weighted merge of the sub-scores: (0.4 * Keyword Score) + (0.3 * Skills Score) + (0.2 * Format Score) + (0.1 * industry-fit score).\n\n"
            "Return your response ONLY as a valid JSON object matching this schema. Do not include markdown labels or leading text:\n"
            "{\n"
            "  \"score\": 85, // integer 0 to 100 overall compatibility\n"
            "  \"keyword_score\": 75, // integer 0 to 100 keyword density fit\n"
            "  \"skills_score\": 80, // integer 0 to 100 skills gap evaluation\n"
            "  \"format_score\": 90, // integer 0 to 100 formatting checklist compliance\n"
            "  \"summary\": \"Provide a step-by-step scoring breakdown showing how points were added/deducted based on experience level and missing keywords...\",\n"
            "  \"matching_keywords\": [\"React\", \"Python\"], // exact/semantic matches found\n"
            "  \"missing_keywords\": [\"Docker\", \"CI/CD\"], // critical keywords missing\n"
            "  \"skills_gap_analysis\": [\n"
            "     { \"category\": \"DevOps\", \"status\": \"Gap\", \"details\": \"Resume does not mention pipelines or containerization...\" }\n"
            "  ],\n"
            "  \"content_improvements\": [\n"
            "     { \"original\": \"did django coding\", \"suggested\": \"Architected robust API endpoints using Django REST Framework, reducing load by 20%.\", \"reason\": \"Use action verbs and add metrics.\" }\n"
            "  ],\n"
            "  \"formatting_feedback\": \"Structure is legible. Export in PDF format.\",\n"
            "  \"formatting_checks\": [\n"
            "     { \"label\": \"Page Count\", \"status\": \"pass\", \"details\": \"Resume fits standard length.\" },\n"
            "     { \"label\": \"Contact Details\", \"status\": \"pass\", \"details\": \"Found email and phone.\" }\n"
            "  ]\n"
            "}"
        )

        user_content = f"RESUME:\n{resume_text}\n\nJOB DESCRIPTION:\n{job_desc}"

        payload = {
                "model": "llama-3.3-70b-versatile", # Groq model
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            # JSON response format enforces Groq to respond with a clean parsed JSON object
            "response_format": {"type": "json_object"},
            # Temperature: closer to 0 means highly consistent/rational response, closer to 1 means creative.
            "temperature": 0.1
        }

        # Make POST request synchronously (with a 30 second timeout)
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.ok:
            data = response.json()
            raw_content = data['choices'][0]['message']['content'] # Read content block
            return json.loads(raw_content) # Convert string to JSON dictionary
        else:
            raise Exception(f"Groq API returned status {response.status_code}: {response.text}")

    def _get_mock_analysis(self, resume_text, job_desc):
        """
        Mock ATS Scorer logic:
        It performs basic regex searches to find overlapping keywords between 
        the Resume and the Job Description. It serves as a local fallback engine.
        """
        import re
        resume_lower = resume_text.lower()
        job_lower = job_desc.lower()

        # Regex extracts individual words of length 3 to 20 letters
        def get_words(text):
            words = re.findall(r'\b[a-zA-Z]{3,20}\b', text.lower())
            # Stop words filter: ignore common words like 'the', 'and', 'for'
            stop_words = {
                'this', 'that', 'with', 'from', 'your', 'have', 'will', 'shall', 'should',
                'development', 'developer', 'engineer', 'experience', 'work', 'working',
                'team', 'project', 'projects', 'system', 'systems', 'management', 'manage',
                'using', 'building', 'about', 'their', 'there', 'these', 'would', 'could',
                'other', 'under', 'years', 'required', 'preferred', 'skills', 'ability',
                'responsible', 'standard', 'perform', 'performing', 'tasks', 'duties',
                'include', 'etc', 'and', 'but', 'for', 'the', 'job', 'description'
            }
            return set(w for w in words if w not in stop_words)

        resume_words = get_words(resume_lower)
        job_words = get_words(job_lower)

        # Set operations: matching sets and missing sets
        matching = sorted(list(job_words.intersection(resume_words)))
        missing = sorted(list(job_words.difference(resume_words)))

        # Calculate scores dynamically based on word matches
        total_job_words = len(job_words)
        match_ratio = len(matching) / total_job_words if total_job_words > 0 else 0.5
        overall_score = int(30 + (match_ratio * 60)) # Range 30 to 90
        
        # Enforce boundary checks
        overall_score = min(max(overall_score, 0), 100)

        # Return mock JSON matching the exact system schema
        return {
            "score": overall_score,
            "keyword_score": int(overall_score * 0.95),
            "skills_score": int(overall_score * 0.90),
            "format_score": 85,
            "summary": f"Mock scanner matched {len(matching)} words out of {total_job_words} unique job description tokens.",
            "matching_keywords": matching[:12],
            "missing_keywords": missing[:12],
            "skills_gap_analysis": [
                {"category": "Technical Overlaps", "status": "Match", "details": f"Found: {', '.join(matching[:4])}"},
                {"category": "Missing Focus", "status": "Gap", "details": f"Missing: {', '.join(missing[:4])}"}
            ],
            "content_improvements": [
                {"original": "Code optimization", "suggested": "Refactored processing scripts, improving runtime speed by 15%.", "reason": "Quantify outcomes."}
            ],
            "formatting_feedback": "Resume layout is clean. Export to PDF format recommended.",
            "formatting_checks": [
                {"label": "Contact Details", "status": "pass", "details": "Found contact points."}
            ]
        }


class ATSOptimizeView(APIView):
    """
    [EXPLANATION FOR BEGINNERS]
    This endpoint handles POST requests to rewrite/optimize the resume text
    using Groq's LLM model to target missing keywords from the job description.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        # Retrieve parameters
        job_description = request.data.get('job_description')
        resume_text = request.data.get('resume_text')
        resume_id = request.data.get('resume_id')

        if not job_description:
            return Response({"detail": "Job description is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Step 1: Extract resume text from database, uploaded file, or plain text input
        if resume_id:
            if not request.user.is_authenticated:
                return Response({"detail": "Auth required for saved resumes."}, status=status.HTTP_401_UNAUTHORIZED)
            resume_obj = get_object_or_404(Resume, id=resume_id, user=request.user)
            # Re-use database serializing method from ATSEvaluateView
            evaluator = ATSEvaluateView()
            resume_text = evaluator._serialize_resume_to_text(resume_obj)
        elif 'resume_file' in request.FILES:
            resume_file = request.FILES['resume_file']
            ext = os.path.splitext(resume_file.name)[1].lower()
            evaluator = ATSEvaluateView()
            resume_text = evaluator._extract_file_text(resume_file, ext)
        elif not resume_text:
            return Response({"detail": "Resume content is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Step 2: Fetch Groq API Key
        groq_api_key = os.getenv('GROQ_API_KEY')
        
        # Step 3: Trigger optimization
        if not groq_api_key or groq_api_key.strip() == '' or groq_api_key == 'your_groq_api_key_here':
            print("Groq API key not configured. Mocking optimizer response.")
            optimized_text = self._get_mock_optimization(resume_text, job_description)
        else:
            try:
                optimized_text = self._call_groq_optimizer(resume_text, job_description, groq_api_key)
            except Exception as e:
                print(f"Groq Optimizer failed: {str(e)}. Falling back to mock optimization.")
                optimized_text = self._get_mock_optimization(resume_text, job_description)

        # Return rewritten resume plain text string
        return Response({"optimized_text": optimized_text}, status=status.HTTP_200_OK)

    def _call_groq_optimizer(self, resume_text, job_desc, api_key):
        """
        Sends requests to Groq chat completions endpoint to rewrite the resume.
        """
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        # Prompt forces the model to return ONLY the clean rewritten resume
        system_prompt = (
            "You are an expert professional resume writer and career coach. Your task is to rewrite the "
            "candidate's resume text to optimize it for the job description. "
            "Requirements:\n"
            "1. Integrate key technical and domain keywords from the job description naturally (e.g., in a skills list or professional summaries).\n"
            "2. Rewrite experience bullet points using action verbs and concrete, metric-driven achievements (KPIs/percentages).\n"
            "3. Fill in missing skill gaps noted in the requirements.\n"
            "4. Return ONLY the rewritten resume text in a clean, professional, plain text layout. Do not include any introductory comments, greetings, or markdown explanations."
        )

        user_content = f"ORIGINAL RESUME:\n{resume_text}\n\nTARGET JOB DESCRIPTION:\n{job_desc}"

        payload = {
                "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.3 # Higher temperature (0.3) allows model to creatively rephrase bullet text
        }

        response = requests.post(url, json=payload, headers=headers, timeout=45)
        
        if response.ok:
            data = response.json()
            return data['choices'][0]['message']['content']
        else:
            raise Exception(f"Groq API returned status {response.status_code}")

    def _get_mock_optimization(self, resume_text, job_desc):
        """
        Fallback mock optimizer:
        Modifies weak experience bullets into metric-driven achievements.
        """
        lines = resume_text.split('\n')
        optimized_lines = []
        
        for line in lines:
            line_str = line.strip()
            # String parsing overrides weak sentences
            if "worked on django backend for inventory" in line_str.lower():
                optimized_lines.append("  - Architected Django REST Framework backend for real-time inventory tracking, improving page rendering times by 18% and query throughput by 25%.")
            elif "responsible for managing standard database queries" in line_str.lower() or "postgresql index" in line_str.lower():
                optimized_lines.append("  - Designed PostgreSQL database indexes and query paths, optimizing read/write throughput by 30%.")
            elif line_str.startswith("- ") or line_str.startswith("* "):
                optimized_lines.append(line + " (Optimized using KPI metrics and action verbs for matching job scope)")
            else:
                optimized_lines.append(line)

        # Mock skill additions
        optimized_lines.append("\n[AI REWRITE ADDITIONS]")
        optimized_lines.append("Skills Added: Docker Containerization, CI/CD Pipelines, Redis Caching, Cloud Deployments (AWS)")
        
        return "\n".join(optimized_lines)


class ResumePDFExportView(APIView):
    """
    Endpoint to render a beautiful PDF from HTML using WeasyPrint.
    If WeasyPrint is missing system libraries (Gtk+), it triggers a graceful fallback
    returning JSON so the client executes standard browser printing.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        html_content = request.data.get("html_content")
        filename = request.data.get("filename", "resume.pdf")

        if not html_content:
            return Response({"detail": "HTML content is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Check WeasyPrint import and initialize
        try:
            from weasyprint import HTML
            import io

            # Render HTML to PDF in memory using WeasyPrint
            pdf_io = io.BytesIO()
            HTML(string=html_content).write_pdf(pdf_io)
            pdf_io.seek(0)

            # Return binary PDF file stream directly
            response = HttpResponse(pdf_io.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except Exception as weasy_err:
            print("WeasyPrint PDF rendering failed, falling back to browser print:", weasy_err)
            return Response({
                "detail": "WeasyPrint system libraries (Gtk+) are not installed. Falling back to browser printing.",
                "fallback": True
            }, status=status.HTTP_200_OK)


class ResumeSummarySuggestView(APIView):
    """
    Endpoint to recommend 3 types of professional summaries (Executive, Modern, Creative)
    using Groq LLM completions API.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        skills = request.data.get("skills", "")
        experience = request.data.get("experience", "")

        if not skills and not experience:
            return Response({"detail": "Skills or Experience context is required."}, status=status.HTTP_400_BAD_REQUEST)

        groq_api_key = os.getenv('GROQ_API_KEY')

        # Trigger suggestions
        if not groq_api_key or groq_api_key.strip() == '' or groq_api_key == 'your_groq_api_key_here':
            print("Groq API key not configured. Mocking summaries.")
            suggestions = self._get_mock_summaries(skills, experience)
        else:
            try:
                suggestions = self._call_groq_summarizer(skills, experience, groq_api_key)
            except Exception as e:
                print(f"Groq Summarizer failed: {str(e)}. Falling back to mock summaries.")
                suggestions = self._get_mock_summaries(skills, experience)

        return Response({"suggestions": suggestions}, status=status.HTTP_200_OK)

    def _call_groq_summarizer(self, skills, experience, api_key):
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        system_prompt = (
            "You are an expert resume writer. Generate 3 distinct professional summary options "
            "based on the candidate's skills and experiences. "
            "Categories:\n"
            "1. Executive: Formal, metric-driven, third-person perspective.\n"
            "2. Modern: Sleek, active, value-proposition focused.\n"
            "3. Creative: Enthusiastic, story-driven, highlighting passion and learning agility.\n\n"
            "Return your recommendations ONLY as a valid JSON object matching this schema. Do not include markdown wraps:\n"
            "{\n"
            "  \"executive\": \"formal text...\",\n"
            "  \"modern\": \"modern text...\",\n"
            "  \"creative\": \"creative text...\"\n"
            "}"
        )

        user_content = f"SKILLS:\n{skills}\n\nEXPERIENCE:\n{experience}"

        payload = {
                "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.5
        }

        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.ok:
            data = response.json()
            raw_content = data['choices'][0]['message']['content']
            return json.loads(raw_content)
        else:
            raise Exception(f"Groq API returned status {response.status_code}")

    def _get_mock_summaries(self, skills, experience):
        # Fallback mocks based on keywords
        return {
            "executive": f"Results-driven professional with expertise in {skills or 'software engineering'}. Proven track record of optimizing backend performance and leading technical initiatives.",
            "modern": f"Dynamic software developer specialized in leveraging {skills or 'modern frameworks'} to build robust, scalable applications. Dedicated to improving system performance and query workflows.",
            "creative": f"Enthusiastic tech innovator passionate about coding and building impactful projects. Eager to apply skills in {skills or 'problem solving'} to solve complex, real-world development challenges."
        }


class ResumeCoverLetterView(APIView):
    """
    Cover letter generator view. Candidate ke resume aur target job description (JD)
    ko merge karke Groq AI se customized cover letter banata hai.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        resume_text = request.data.get("resume_text", "")
        job_description = request.data.get("job_description", "")

        if not resume_text or not job_description:
            return Response({"detail": "Both resume_text and job_description are required."}, status=status.HTTP_400_BAD_REQUEST)

        groq_api_key = os.getenv('GROQ_API_KEY')

        if not groq_api_key or groq_api_key.strip() == '' or groq_api_key == 'your_groq_api_key_here':
            print("Groq API key not configured. Mocking cover letter.")
            cover_letter = self._get_mock_cover_letter(resume_text, job_description)
        else:
            try:
                cover_letter = self._call_groq_cover_letter(resume_text, job_description, groq_api_key)
            except Exception as e:
                print(f"Groq Cover Letter failed: {str(e)}. Falling back to mock letter.")
                cover_letter = self._get_mock_cover_letter(resume_text, job_description)

        return Response({"cover_letter": cover_letter}, status=status.HTTP_200_OK)

    def _call_groq_cover_letter(self, resume, jd, api_key):
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        system_prompt = (
            "You are a professional career writer. Write a tailored, persuasive Cover Letter "
            "for a candidate applying to a job with the provided Job Description. "
            "Highlight the candidate's achievements and experiences from their Resume to match the requirements. "
            "Address the hiring manager professionally. Do not include markdown wraps. Return only the plain-text letter."
        )

        user_content = f"CANDIDATE RESUME:\n{resume}\n\nTARGET JOB DESCRIPTION:\n{jd}"

        payload = {
                "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.6
        }

        response = requests.post(url, json=payload, headers=headers, timeout=30)
        if response.ok:
            data = response.json()
            return data['choices'][0]['message']['content'].strip()
        else:
            raise Exception(f"Groq API returned status {response.status_code}")

    def _get_mock_cover_letter(self, resume, jd):
        return (
            "Dear Hiring Manager,\n\n"
            "I am writing to express my strong interest in the open position as advertised. "
            "With my background in software development and technical optimizations, I am confident "
            "that my skills align closely with the requirements outlined in your job description.\n\n"
            "My experience includes designing high-performance services, database optimization, "
            "and working with cross-functional teams to build reliable systems. I am excited about "
            "the opportunity to bring my technical skills to your engineering team and contribute "
            "to your business goals.\n\n"
            "Thank you for your time and consideration. I look forward to discussing my application further.\n\n"
            "Sincerely,\n"
            "Applicant"
        )


class ResumeInterviewQAView(APIView):
    """
    Interview questions and answers generator. Target job description aur candidate
    ke resume contents ke based par 5 targeted custom interview questions aur answers taiyar karta hai.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        resume_text = request.data.get("resume_text", "")
        job_description = request.data.get("job_description", "")

        if not resume_text or not job_description:
            return Response({"detail": "Both resume_text and job_description are required."}, status=status.HTTP_400_BAD_REQUEST)

        groq_api_key = os.getenv('GROQ_API_KEY')

        if not groq_api_key or groq_api_key.strip() == '' or groq_api_key == 'your_groq_api_key_here':
            print("Groq API key not configured. Mocking interview Q&A.")
            qa_list = self._get_mock_qa(resume_text, job_description)
        else:
            try:
                qa_list = self._call_groq_qa(resume_text, job_description, groq_api_key)
            except Exception as e:
                print(f"Groq Q&A failed: {str(e)}. Falling back to mock Q&A.")
                qa_list = self._get_mock_qa(resume_text, job_description)

        return Response({"qa": qa_list}, status=status.HTTP_200_OK)

    def _call_groq_qa(self, resume, jd, api_key):
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        system_prompt = (
            "You are a technical recruiter. Based on the candidate's Resume and the target Job Description, "
            "generate exactly 5 custom interview questions. For each question, provide a suggested answer structure "
            "highlighting how the candidate can address it using their specific experience.\n"
            "Return the recommendations ONLY as a valid JSON object matching this schema. Do not include markdown wraps:\n"
            "{\n"
            "  \"questions\": [\n"
            "    {\n"
            "      \"question\": \"Question text here...\",\n"
            "      \"answer\": \"Suggested response structure here...\"\n"
            "    }\n"
            "  ]\n"
            "}"
        )

        user_content = f"CANDIDATE RESUME:\n{resume}\n\nTARGET JOB DESCRIPTION:\n{jd}"

        payload = {
                "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.5
        }

        response = requests.post(url, json=payload, headers=headers, timeout=30)
        if response.ok:
            data = response.json()
            raw_content = data['choices'][0]['message']['content']
            parsed = json.loads(raw_content)
            return parsed.get("questions", [])
        else:
            raise Exception(f"Groq API returned status {response.status_code}")

    def _get_mock_qa(self, resume, jd):
        return [
            {
                "question": "Can you describe a time you optimized database transactions or backend logic?",
                "answer": "Answer structure: Mention your experience index tuning in PostgreSQL, describe how you identified slow query plans, and explain the positive performance impact (e.g., 25% speed increase)."
            },
            {
                "question": "How do you align your software designs with the requirements in the job description?",
                "answer": "Answer structure: Emphasize reviewing target architectures early, participating in design sprints, and validating solutions using integration and end-to-end test cases."
            },
            {
                "question": "Tell me about a challenging project where you had to collaborate under tight deadlines.",
                "answer": "Answer structure: Describe the project scope (e.g., CloudSync CLI), clarify the core concurrency issues, explain how you split tasks with peers, and highlight the successful delivery."
            },
            {
                "question": "How do you approach learning new frameworks or backend tools?",
                "answer": "Answer structure: Explain your focus on reading documentation, building proof-of-concept projects in sandbox environments, and studying architectural best practices."
            },
            {
                "question": "Why are you interested in this position based on your past accomplishments?",
                "answer": "Answer structure: Connect your core expertise in REST API creation and performance tuning with the responsibilities in the job description to showcase an immediate fit."
            }
        ]


class ChatbotView(APIView):
    """
    API endpoint for interacting with the AI Career Advisor & Resume Chatbot.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get('message')
        resume_id = request.data.get('resume_id')
        job_description = request.data.get('job_description')
        history = request.data.get('history', [])

        if not message:
            return Response({"detail": "Message is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Get Groq key
        groq_api_key = os.getenv('GROQ_API_KEY')
        if not groq_api_key or groq_api_key.strip() == '' or groq_api_key == 'your_groq_api_key_here':
            # Fallback mock chat advisor response
            advisor_response = self._get_mock_chat_response(message, resume_id, job_description)
            return Response({"response": advisor_response}, status=status.HTTP_200_OK)

        # Fetch and serialize resume if provided
        resume_context = ""
        if resume_id:
            resume = Resume.objects.filter(id=resume_id, user=request.user).first()
            if resume:
                resume_context = self._serialize_resume_to_text(resume)

        # Build System Prompt with contexts
        system_prompt = (
            "You are 'ResumeCraft AI Career Advisor', a friendly, highly professional career coach and recruiter. "
            "Your goal is to guide the user in crafting better resumes, writing strong summaries, picking templates, "
            "optimizing matching keywords, and preparing for job interviews. "
            "Always be encouraging, give direct and actionable feedback, use bullet points where helpful, and write clear Markdown formatting. "
            "Be concise but thorough. "
        )

        if resume_context:
            system_prompt += f"\n\n[Active Candidate Resume Details]:\n{resume_context}"
        if job_description:
            system_prompt += f"\n\n[Target Job Description]:\n{job_description}"

        # Construct messages payload
        messages = [{"role": "system", "content": system_prompt}]

        # Append history (limit to last 6 messages to preserve context limit)
        allowed_history = history[-6:] if history else []
        for msg in allowed_history:
            if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                messages.append({"role": msg['role'], "content": msg['content']})

        # Append current user query
        messages.append({"role": "user", "content": message})

        # Call Groq completions endpoint
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                    "model": "llama3-70b-8192",
                "messages": messages,
                "temperature": 0.7
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            if response.ok:
                data = response.json()
                chatbot_reply = data['choices'][0]['message']['content']
                return Response({"response": chatbot_reply}, status=status.HTTP_200_OK)
            else:
                print(f"Groq Chatbot API call returned error: {response.text}")
                fallback = self._get_mock_chat_response(message, resume_id, job_description)
                return Response({"response": fallback}, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"Chatbot connection failed: {str(e)}")
            fallback = self._get_mock_chat_response(message, resume_id, job_description)
            return Response({"response": fallback}, status=status.HTTP_200_OK)

    def _serialize_resume_to_text(self, resume):
        """
        Merge resume sections into plain text format.
        """
        lines = []
        p = resume.personal
        lines.append(f"Name: {p.first_name} {p.last_name}")
        lines.append(f"Email: {p.email} | Phone: {p.phone} | Location: {p.location}")
        lines.append(f"Summary: {p.summary}\n")

        lines.append("WORK EXPERIENCE:")
        for exp in resume.experience.all():
            lines.append(f"- {exp.title} at {exp.company} ({exp.start_date} to {exp.end_date or 'Present'})")
            lines.append(f"  Bullets: {exp.bullets}")

        lines.append("\nEDUCATION:")
        for edu in resume.education.all():
            lines.append(f"- {edu.degree} from {edu.school} ({edu.start_date} to {edu.end_date})")

        lines.append("\nSKILLS:")
        for skill in resume.skills.all():
            lines.append(f"- {skill.name} ({skill.level})")

        # Custom toggleable sections
        cs = resume.custom_sections
        if cs:
            if cs.get('certs'):
                lines.append("\nCERTIFICATIONS:")
                for c in cs.get('certs', []):
                    lines.append(f"- {c.get('name')} by {c.get('authority')} ({c.get('date')})")
            if cs.get('langs'):
                lines.append("\nLANGUAGES:")
                for l in cs.get('langs', []):
                    lines.append(f"- {l.get('name')} ({l.get('proficiency')})")
            if cs.get('awards'):
                lines.append("\nAWARDS:")
                for a in cs.get('awards', []):
                    lines.append(f"- {a.get('title')} from {a.get('issuer')} ({a.get('date')})")
            if cs.get('pubs'):
                lines.append("\nPUBLICATIONS:")
                for pub in cs.get('pubs', []):
                    lines.append(f"- '{pub.get('title')}' in {pub.get('journal')} ({pub.get('date')})")

        return "\n".join(lines)

    def _get_mock_chat_response(self, message, resume_id, job_description):
        """
        Provides helpful offline fallback answers if Groq API is unavailable.
        """
        msg_lower = message.lower()
        if "summary" in msg_lower:
            return (
                "**Here is a mock template for a professional summary based on standard recruiter templates:**\n\n"
                "*\"Results-driven Software Engineer with extensive experience developing scalable web applications. "
                "Skilled in modern APIs, backend optimizations, and microservice architectures. Proven track record "
                "of collaborating with cross-functional teams to deliver projects on time and align code with corporate objectives.\"*\n\n"
                "Would you like me to tailor this for a specific technology?"
            )
        elif "interview" in msg_lower or "mock" in msg_lower or "question" in msg_lower:
            return (
                "**Mock Interview Prep Mode Activated:**\n\n"
                "Let's practice! Tell me: **'Can you describe a challenging project you built, the tech choices you made, and what you learned?'**\n\n"
                "Type your response below, and I will analyze your answer."
            )
        elif "keyword" in msg_lower or "ats" in msg_lower or "score" in msg_lower:
            return (
                "**Here are top strategies to boost your ATS compatibility score:**\n\n"
                "1. **Exact Matches**: Copy critical technical skills (e.g. *Docker*, *AWS*, *Python*) verbatim from the job listing into your Skills section.\n"
                "2. **Metric bullets**: Rewrite your work bullets to show outcomes. Instead of *'wrote APIs'*, write *'Developed 12 custom REST APIs, reducing page latency by 15%.'*\n"
                "3. **Simple Formatting**: Avoid graphic graphics, charts, or tables inside the PDF text layer to keep parser alignment correct."
            )
        else:
            return (
                "Hello! I am your **ResumeCraft AI Advisor**.\n\n"
                "I can help you:\n"
                "* Rewrite and optimize resume summaries/bullet points.\n"
                "* Identify missing keywords from your target job description.\n"
                "* Conduct a simulated mock interview based on your skills.\n\n"
                "What career goals are you working on today?"
            )


