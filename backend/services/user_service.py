"""
User service — business logic for user management.
"""

from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.user import User, UserRole
from auth.password import hash_password, verify_password
from schemas.user import UserCreate, UserUpdate
from utils.helpers import paginate_query, PaginatedResponse


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Fetch a user by their primary key."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Fetch a user by their email address."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Fetch a user by their username."""
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, user_data: UserCreate) -> User:
    """
    Create a new user account.
    Raises ValueError if email or username already exists.
    """
    if get_user_by_email(db, user_data.email):
        raise ValueError("An account with this email already exists")
    if get_user_by_username(db, user_data.username):
        raise ValueError("This username is already taken")

    # Set user role based on input
    assigned_role = UserRole.STUDENT
    if user_data.role == "instructor":
        assigned_role = UserRole.INSTRUCTOR
    elif user_data.role == "admin":
        assigned_role = UserRole.ADMIN
    elif user_data.role == "super_admin":
        assigned_role = UserRole.SUPER_ADMIN

    import secrets
    user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        password_hash=hash_password(user_data.password),
        role=assigned_role,
        is_active=True,
        is_verified=True,
        verification_token=secrets.token_urlsafe(32),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user_profile(db: Session, user: User, update_data: UserUpdate) -> User:
    """Update a user's profile information."""
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def change_user_password(
    db: Session, user: User, current_password: str, new_password: str
) -> bool:
    """Change a user's password after verifying the current one."""
    if not verify_password(current_password, user.password_hash):
        raise ValueError("Current password is incorrect")
    user.password_hash = hash_password(new_password)
    db.commit()
    return True


def list_users(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    role: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> PaginatedResponse:
    """List users with filtering, search, and pagination."""
    query = db.query(User)

    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                User.full_name.ilike(search_term),
                User.email.ilike(search_term),
                User.username.ilike(search_term),
            )
        )

    total = query.count()
    query = query.order_by(User.created_at.desc())
    users = paginate_query(query, page, page_size).all()

    return PaginatedResponse(items=users, total=total, page=page, page_size=page_size)


def toggle_user_active(db: Session, user_id: int) -> User:
    """Activate or deactivate a user account."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user


def update_user_role(db: Session, user_id: int, new_role: UserRole) -> User:
    """Change a user's role (super admin only)."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")
    user.role = new_role
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    """Permanently delete a user account."""
    user = get_user_by_id(db, user_id)
    if not user:
        raise ValueError("User not found")
    db.delete(user)
    db.commit()
    return True


def get_user_stats(db: Session) -> dict:
    """Get user count statistics for admin dashboard."""
    total = db.query(User).count()
    active = db.query(User).filter(User.is_active == True).count()
    students = db.query(User).filter(User.role == UserRole.STUDENT).count()
    instructors = db.query(User).filter(User.role == UserRole.INSTRUCTOR).count()
    admins = db.query(User).filter(
        User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
    ).count()

    return {
        "total_users": total,
        "active_users": active,
        "students": students,
        "instructors": instructors,
        "admins": admins,
    }
