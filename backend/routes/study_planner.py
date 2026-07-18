"""
Study Planner routes — weekly goals, reminder tasks, calendar deadline feeds, and daily study streaking.
"""

from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from models.schedule import Reminder, StudyPlan
from models.analytics import StudySession
from models.course import Course, Enrollment


router = APIRouter()


class StudyPlanCreate(BaseModel):
    course_id: int
    target_hours_weekly: int
    daily_goal_minutes: int


class ReminderCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: datetime


class ReminderResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    due_date: datetime
    is_completed: bool

    class Config:
        from_attributes = True


def calculate_streak(db: Session, user_id: int) -> int:
    """Calculates consecutive days of study sessions ending today or yesterday."""
    sessions = (
        db.query(StudySession.date)
        .filter(StudySession.user_id == user_id)
        .order_by(StudySession.date.desc())
        .all()
    )
    
    if not sessions:
        return 0
        
    unique_dates = sorted(list(set(s[0].date() for s in sessions if s[0])), reverse=True)
    if not unique_dates:
        return 0
        
    today = date.today()
    # Check if the streak is broken (no activity today and none yesterday)
    if unique_dates[0] < today - timedelta(days=1):
        return 0
        
    streak = 1
    for i in range(len(unique_dates) - 1):
        delta = unique_dates[i] - unique_dates[i + 1]
        if delta == timedelta(days=1):
            streak += 1
        elif delta == timedelta(days=0):
            continue
        else:
            break
            
    return streak


@router.post("/plans")
def create_or_update_study_plan(
    data: StudyPlanCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update a student's weekly study goal for a course."""
    # Verify course exists
    course = db.query(Course).filter(Course.id == data.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    plan = (
        db.query(StudyPlan)
        .filter(StudyPlan.user_id == current_user.id, StudyPlan.course_id == data.course_id)
        .first()
    )

    if plan:
        plan.target_hours_weekly = data.target_hours_weekly
        plan.daily_goal_minutes = data.daily_goal_minutes
    else:
        plan = StudyPlan(
            user_id=current_user.id,
            course_id=data.course_id,
            target_hours_weekly=data.target_hours_weekly,
            daily_goal_minutes=data.daily_goal_minutes,
        )
        db.add(plan)

    db.commit()
    db.refresh(plan)
    return {
        "id": plan.id,
        "course_id": plan.course_id,
        "target_hours_weekly": plan.target_hours_weekly,
        "daily_goal_minutes": plan.daily_goal_minutes,
    }


@router.get("/calendar")
def get_planner_calendar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full deadline feeds, streak details, and study progress metrics."""
    # Current active streak
    streak = calculate_streak(db, current_user.id)
    
    # Active reminders
    reminders = db.query(Reminder).filter(
        Reminder.user_id == current_user.id,
        Reminder.is_completed == False
    ).order_by(Reminder.due_date.asc()).all()

    # Enrolled course progress deadlines (stubbed deadlines based on enrollment date)
    enrollments = db.query(Enrollment).filter(
        Enrollment.user_id == current_user.id,
        Enrollment.is_active == True
    ).all()

    course_deadlines = []
    for enroll in enrollments:
        course = enroll.course
        # Mock a deadline 4 weeks after enrollment
        deadline = enroll.enrolled_at + timedelta(days=28)
        course_deadlines.append({
            "course_id": course.id,
            "title": f"Complete {course.title}",
            "due_date": deadline,
            "completion_percentage": enroll.completion_percentage,
        })

    # Recent study sessions for heatmap (last 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    sessions = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.date >= thirty_days_ago
    ).order_by(StudySession.date.asc()).all()

    heatmap = [
        {
            "date": s.date.date().isoformat() if s.date else None,
            "duration_minutes": s.duration_minutes,
            "lectures_watched": s.lectures_watched,
            "problems_solved": s.problems_solved,
        }
        for s in sessions
    ]

    return {
        "streak_count": streak,
        "reminders": [
            {
                "id": r.id,
                "title": r.title,
                "description": r.description,
                "due_date": r.due_date,
            }
            for r in reminders
        ],
        "course_deadlines": course_deadlines,
        "heatmap": heatmap,
    }


@router.post("/reminders", response_model=ReminderResponse)
def create_reminder(
    data: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a calendar deadline/reminder item."""
    reminder = Reminder(
        user_id=current_user.id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
        is_completed=False,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.get("/reminders", response_model=List[ReminderResponse])
def list_reminders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all reminders for the current student."""
    return db.query(Reminder).filter(Reminder.user_id == current_user.id).order_by(Reminder.due_date.asc()).all()


@router.delete("/reminders/{reminder_id}")
def delete_reminder(
    reminder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete or dismiss a reminder item."""
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id, Reminder.user_id == current_user.id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
        
    db.delete(reminder)
    db.commit()
    return {"message": "Reminder dismissed successfully"}
