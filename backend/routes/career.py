"""
Career development routes — handles achievements, portfolios, and AI-powered resume gap analysis.
"""

from typing import List, Optional
import json
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from models.career import Portfolio, Resume
from models.course import Course
from ai.generator import initialize_gemini, GEMINI_AVAILABLE, settings

try:
    import google.generativeai as genai
except ImportError:
    pass


router = APIRouter()


class PortfolioUpdate(BaseModel):
    title: Optional[str] = None
    bio: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    website_url: Optional[str] = None
    projects_json: Optional[str] = None  # JSON string representing projects
    skills_json: Optional[str] = None    # JSON string representing skills


class ResumeAnalyzeRequest(BaseModel):
    resume_text: str


@router.get("/portfolio")
def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve the current user's portfolio."""
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio:
        # Auto-create blank portfolio
        portfolio = Portfolio(user_id=current_user.id, title="My Learning Portfolio")
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
        
    return {
        "id": portfolio.id,
        "title": portfolio.title,
        "bio": portfolio.bio,
        "github_url": portfolio.github_url,
        "linkedin_url": portfolio.linkedin_url,
        "website_url": portfolio.website_url,
        "projects": json.loads(portfolio.projects_json) if portfolio.projects_json else [],
        "skills": json.loads(portfolio.skills_json) if portfolio.skills_json else [],
    }


@router.put("/portfolio")
def update_portfolio(
    data: PortfolioUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user's visual portfolio details."""
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    if not portfolio:
        portfolio = Portfolio(user_id=current_user.id)
        db.add(portfolio)

    if data.title is not None:
        portfolio.title = data.title
    if data.bio is not None:
        portfolio.bio = data.bio
    if data.github_url is not None:
        portfolio.github_url = data.github_url
    if data.linkedin_url is not None:
        portfolio.linkedin_url = data.linkedin_url
    if data.website_url is not None:
        portfolio.website_url = data.website_url
    if data.projects_json is not None:
        portfolio.projects_json = data.projects_json
    if data.skills_json is not None:
        portfolio.skills_json = data.skills_json

    db.commit()
    db.refresh(portfolio)
    return {"message": "Portfolio updated successfully"}



@router.post("/resume/analyze")
def analyze_resume(
    data: ResumeAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Parses student resume text and returns matching course recommendations from active catalog."""
    # 1. Fetch available course catalog
    courses = db.query(Course).filter(Course.is_published == True).all()
    course_list = [f"ID {c.id}: {c.title} (Category: {c.category.value})" for c in courses]
    
    # Check if Gemini is available
    if not GEMINI_AVAILABLE or not settings.GEMINI_API_KEY:
        # Offline mock response
        return {
            "extracted_skills": ["Coding", "Problem Solving"],
            "skill_gaps": ["React", "FastAPI"],
            "recommendations": [
                {"id": c.id, "title": c.title, "category": c.category.value}
                for c in courses[:2]
            ]
        }

    initialize_gemini()
    try:
        model = genai.GenerativeModel(settings.GEMINI_MODEL)
        
        prompt = f"""
        You are an expert career counselor and technology recruiter.
        Analyze the following student resume text:
        ---
        {data.resume_text}
        ---

        We offer the following course ids and titles in our active catalog:
        {chr(10).join(course_list)}

        Identify:
        1. The core skills present in the resume.
        2. Missing skills/gaps based on modern software engineering standards.
        3. Recommendations: Select up to 3 course IDs from our list above that would best help the student bridge those gaps.

        You must format the response as a single, valid JSON object matching this structure EXACTLY. Do not add any text before or after the JSON:
        {{
            "extracted_skills": ["skill1", "skill2"],
            "skill_gaps": ["gap1", "gap2"],
            "recommended_course_ids": [id1, id2]
        }}
        """
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean markdown codeblocks if wrapped
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            
        analysis = json.loads(text)
        
        # Resolve recommended course IDs into actual objects from DB
        recommended_ids = analysis.get("recommended_course_ids", [])
        recommendations = []
        for cid in recommended_ids:
            course = db.query(Course).filter(Course.id == int(cid)).first()
            if course:
                recommendations.append({
                    "id": course.id,
                    "title": course.title,
                    "category": course.category.value,
                    "slug": course.slug,
                })
                
        # Save resume text in user record
        resume = db.query(Resume).filter(Resume.user_id == current_user.id).first()
        if not resume:
            resume = Resume(user_id=current_user.id)
            db.add(resume)
            
        resume.raw_text = data.resume_text
        resume.education_json = json.dumps([])
        resume.experience_json = json.dumps([])
        resume.skills_json = json.dumps(analysis.get("extracted_skills", []))
        db.commit()

        return {
            "extracted_skills": analysis.get("extracted_skills", []),
            "skill_gaps": analysis.get("skill_gaps", []),
            "recommendations": recommendations,
        }
        
    except Exception as e:
        print(f"[AI Error] career resume analyze failed: {str(e)}")
        # Fallback offline simulation
        return {
            "extracted_skills": ["Software Development", "Problem Solving", "Web Architecture"],
            "skill_gaps": ["Modern React Frameworks", "High Performance Backend Design", "Cloud Infrastructure"],
            "recommendations": [
                {
                    "id": c.id,
                    "title": c.title,
                    "category": c.category.value,
                    "slug": c.slug,
                }
                for c in courses[:3]
            ]
        }
