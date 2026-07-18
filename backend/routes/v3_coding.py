"""
Competitive Programming & Saved Problems routes v3.0
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from auth.oauth2 import get_current_user
from models.user import User
from models.coding import CodingProblem, Submission, SubmissionStatus
from models.v3_models import Contest, ContestSubmission, SavedProblem

router = APIRouter(prefix="/coding", tags=["Competitive Programming"])


@router.get("/contests", response_model=List[dict])
def list_contests(db: Session = Depends(get_db)):
    """List competitive coding contests."""
    contests = db.query(Contest).order_by(Contest.start_time.desc()).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "start_time": c.start_time,
            "end_time": c.end_time,
            "submissions_count": len(c.submissions)
        } for c in contests
    ]


@router.get("/contests/{contest_id}/leaderboard")
def get_contest_leaderboard(contest_id: int, db: Session = Depends(get_db)):
    """Get the scoreboard ranking for a coding contest."""
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found")
        
    leaderboard = db.query(
        ContestSubmission.user_id,
        func.sum(ContestSubmission.points).label("total_points"),
        func.count(ContestSubmission.id).label("total_subs")
    ).filter(
        ContestSubmission.contest_id == contest_id
    ).group_by(
        ContestSubmission.user_id
    ).order_by(
        func.sum(ContestSubmission.points).desc()
    ).all()
    
    results = []
    for rank, row in enumerate(leaderboard, 1):
        user = db.query(User).filter(User.id == row[0]).first()
        results.append({
            "rank": rank,
            "user_id": row[0],
            "username": user.username if user else "Anonymous",
            "full_name": user.full_name if user else "User",
            "points": row[1],
            "submissions": row[2]
        })
    return results


@router.post("/problems/{problem_id}/favorite")
def toggle_favorite_problem(
    problem_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Toggle saving a problem to favorites."""
    existing = db.query(SavedProblem).filter(
        SavedProblem.user_id == current_user.id,
        SavedProblem.problem_id == problem_id
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        return {"status": "removed", "favorited": False}
        
    fav = SavedProblem(user_id=current_user.id, problem_id=problem_id)
    db.add(fav)
    db.commit()
    return {"status": "added", "favorited": True}


@router.get("/problems/favorites")
def list_favorite_problems(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List bookmarked/saved coding problems."""
    favs = db.query(SavedProblem).filter(SavedProblem.user_id == current_user.id).all()
    return [
        {
            "problem_id": f.problem_id,
            "title": f.problem.title if f.problem else "Unknown",
            "slug": f.problem.slug if f.problem else "",
            "difficulty": f.problem.difficulty if f.problem else "EASY"
        } for f in favs
    ]


@router.get("/statistics")
def get_coding_dashboard_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get metrics and statistics for solved coding problems distribution charts."""
    # Group user's submissions
    subs = db.query(Submission).filter(Submission.user_id == current_user.id).all()
    
    total_submissions = len(subs)
    accepted_subs = [s for s in subs if s.status == SubmissionStatus.ACCEPTED]
    solved_problem_ids = set(s.problem_id for s in accepted_subs)
    total_solved = len(solved_problem_ids)
    
    acceptance_rate = (
        round((len(accepted_subs) / total_submissions) * 100, 1)
        if total_submissions > 0 else 0.0
    )
    
    # Solved difficulty counts
    easy_count = 0
    medium_count = 0
    hard_count = 0
    
    for pid in solved_problem_ids:
        prob = db.query(CodingProblem).filter(CodingProblem.id == pid).first()
        if prob:
            diff = str(prob.difficulty).upper()
            if "EASY" in diff:
                easy_count += 1
            elif "MEDIUM" in diff:
                medium_count += 1
            elif "HARD" in diff:
                hard_count += 1

    return {
        "total_solved": total_solved,
        "total_submissions": total_submissions,
        "acceptance_rate": acceptance_rate,
        "difficulty_distribution": {
            "easy": easy_count,
            "medium": medium_count,
            "hard": hard_count
        },
        "language_usage": {
            "python": len([s for s in subs if s.language == "python"]),
            "cpp": len([s for s in subs if s.language == "cpp"]),
            "java": len([s for s in subs if s.language == "java"]),
            "javascript": len([s for s in subs if s.language == "javascript"])
        }
    }
