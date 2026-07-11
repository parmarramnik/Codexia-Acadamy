"""
Database seeding script.
Populates roles, default test users, course syllabus, and coding practice problems.
"""

from datetime import datetime, timezone
from database import SessionLocal, create_tables
from models.user import User, UserRole
from models.course import Course, Module, Lecture, CourseCategory, CourseDifficulty
from models.coding import CodingProblem, TestCase, ProblemDifficulty
from auth.password import hash_password

def seed_database():
    print("Ensuring database tables are created...")
    create_tables()

    db = SessionLocal()
    try:
        # Check if users already exist
        existing_user = db.query(User).first()
        if existing_user:
            print("Database already contains data. Skipping seeding to prevent duplicates.")
            return

        print("Seeding default users...")
        default_users = [
            User(
                email="student@gmail.com",
                username="student",
                password_hash=hash_password("Password123!"),
                full_name="Student Account",
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True
            ),
            User(
                email="instructor@gmail.com",
                username="instructor",
                password_hash=hash_password("Password123!"),
                full_name="Instructor Account",
                role=UserRole.INSTRUCTOR,
                is_active=True,
                is_verified=True
            ),
            User(
                email="admin@gmail.com",
                username="admin",
                password_hash=hash_password("Password123!"),
                full_name="Admin Account",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True
            )
        ]
        
        for u in default_users:
            db.add(u)
        db.commit()

        # Retrieve instructor ID for course creation
        instructor = db.query(User).filter(User.role == UserRole.INSTRUCTOR).first()
        instructor_id = instructor.id

        print("Seeding default courses and lectures...")
        course1 = Course(
            title="Full-Stack Web Development",
            slug="full-stack-web-development",
            description="A comprehensive guide to modern full-stack web development using React, Node.js, and FastAPI.",
            short_description="Learn to build modern web applications from scratch.",
            instructor_id=instructor_id,
            category=CourseCategory.WEB_DEVELOPMENT,
            difficulty=CourseDifficulty.BEGINNER,
            duration_hours=10.5,
            total_lectures=2,
            is_published=True,
            is_approved=True,
            price=0.0,
            learning_objectives="Build React UIs\nCreate REST APIs in FastAPI\nManage SQL Databases"
        )
        db.add(course1)
        db.commit()

        # Add Module and Lectures
        module1 = Module(
            course_id=course1.id,
            title="Module 1: Getting Started",
            description="Introduction to the web and fundamental technologies.",
            order_index=0
        )
        db.add(module1)
        db.commit()

        lecture1 = Lecture(
            module_id=module1.id,
            title="Introduction to HTML & CSS",
            description="Learn how to structure and style web pages.",
            order_index=0,
            duration_seconds=300,
            is_preview=True
        )
        lecture2 = Lecture(
            module_id=module1.id,
            title="JavaScript Essentials",
            description="Learn variable declaration, control flow, loops, and DOM manipulation.",
            order_index=1,
            duration_seconds=450,
            is_preview=False
        )
        db.add(lecture1)
        db.add(lecture2)
        db.commit()

        print("Seeding default coding problems and test cases...")
        
        # 1. Two Sum
        two_sum = CodingProblem(
            title="Two Sum",
            slug="two-sum",
            description="Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
            difficulty=ProblemDifficulty.EASY,
            constraints="2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
            input_format="First line contains space-separated integers for nums. Second line contains the target integer.",
            output_format="Indices of the two numbers separated by a space.",
            starter_code_python="def solve(nums, target):\n    # Write your Python code here\n    pass\n",
            starter_code_javascript="function solve(nums, target) {\n    // Write your JavaScript code here\n}\n",
            is_published=True
        )
        db.add(two_sum)
        db.commit()

        tc1 = TestCase(problem_id=two_sum.id, input_data="2 7 11 15\n9", expected_output="0 1", is_hidden=False, order_index=0, time_limit_seconds=2.0, memory_limit_mb=256)
        tc2 = TestCase(problem_id=two_sum.id, input_data="3 2 4\n6", expected_output="1 2", is_hidden=False, order_index=1, time_limit_seconds=2.0, memory_limit_mb=256)
        tc3 = TestCase(problem_id=two_sum.id, input_data="3 3\n6", expected_output="0 1", is_hidden=True, order_index=2, time_limit_seconds=2.0, memory_limit_mb=256)
        db.add(tc1)
        db.add(tc2)
        db.add(tc3)

        # 2. Reverse a String
        rev_str = CodingProblem(
            title="Reverse a String",
            slug="reverse-string",
            description="Write a function solve(s) that reverses a given string.",
            difficulty=ProblemDifficulty.EASY,
            constraints="0 <= s.length <= 10^5",
            input_format="A single line containing the string s.",
            output_format="The reversed string.",
            starter_code_python="def solve(s):\n    # Write your Python code here\n    pass\n",
            starter_code_javascript="function solve(s) {\n    // Write your JavaScript code here\n}\n",
            is_published=True
        )
        db.add(rev_str)
        db.commit()

        tc4 = TestCase(problem_id=rev_str.id, input_data="hello", expected_output="olleh", is_hidden=False, order_index=0, time_limit_seconds=2.0, memory_limit_mb=256)
        tc5 = TestCase(problem_id=rev_str.id, input_data="Hannah", expected_output="hannaH", is_hidden=False, order_index=1, time_limit_seconds=2.0, memory_limit_mb=256)
        tc6 = TestCase(problem_id=rev_str.id, input_data="Codexia", expected_output="aixedoC", is_hidden=True, order_index=2, time_limit_seconds=2.0, memory_limit_mb=256)
        db.add(tc4)
        db.add(tc5)
        db.add(tc6)

        # 3. Fibonacci Number
        fib = CodingProblem(
            title="Fibonacci Number",
            slug="fibonacci-number",
            description="The Fibonacci numbers, commonly denoted F(n) form a sequence, called the Fibonacci sequence, such that each number is the sum of the two preceding ones, starting from 0 and 1. Given n, calculate F(n).",
            difficulty=ProblemDifficulty.EASY,
            constraints="0 <= n <= 30",
            input_format="An integer n.",
            output_format="The Fibonacci number F(n).",
            starter_code_python="def solve(n):\n    # Write your Python code here\n    pass\n",
            starter_code_javascript="function solve(n) {\n    // Write your JavaScript code here\n}\n",
            is_published=True
        )
        db.add(fib)
        db.commit()

        tc7 = TestCase(problem_id=fib.id, input_data="2", expected_output="1", is_hidden=False, order_index=0, time_limit_seconds=2.0, memory_limit_mb=256)
        tc8 = TestCase(problem_id=fib.id, input_data="3", expected_output="2", is_hidden=False, order_index=1, time_limit_seconds=2.0, memory_limit_mb=256)
        tc9 = TestCase(problem_id=fib.id, input_data="9", expected_output="34", is_hidden=True, order_index=2, time_limit_seconds=2.0, memory_limit_mb=256)
        db.add(tc7)
        db.add(tc8)
        db.add(tc9)

        db.commit()
        print("Database seeded successfully with users, courses, and coding problems!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
