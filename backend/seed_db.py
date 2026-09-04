"""
Database seeding script.
Populates roles, default test users, course syllabus, and coding practice problems.
"""

from datetime import datetime, timezone
from database import SessionLocal, create_tables
from models.user import User, UserRole, Role, Permission, RolePermission
from models.course import Course, Module, Lecture, CourseCategory, CourseDifficulty
from models.content import Video
from models.coding import CodingProblem, TestCase, ProblemDifficulty
from auth.password import hash_password

def seed_database():
    print("Ensuring database tables are created...")
    create_tables()

    db = SessionLocal()
    try:
        # Seed RBAC Roles & Permissions if missing
        print("Seeding RBAC Roles & Permissions...")
        roles_dict = {}
        for r_enum in UserRole:
            role_obj = db.query(Role).filter(Role.name == r_enum.value).first()
            if not role_obj:
                role_obj = Role(name=r_enum.value, description=f"{r_enum.value.replace('_', ' ').title()} Role")
                db.add(role_obj)
                db.flush()
            roles_dict[r_enum.value] = role_obj

        perms_list = ["user_suspend", "user_delete", "course_publish", "analytics_view", "system_settings_edit"]
        perms_dict = {}
        for p_name in perms_list:
            p_obj = db.query(Permission).filter(Permission.name == p_name).first()
            if not p_obj:
                p_obj = Permission(name=p_name, description=f"Permission for {p_name}")
                db.add(p_obj)
                db.flush()
            perms_dict[p_name] = p_obj

        # Assign permissions to Admin & Super Admin roles
        for r_name in ["admin", "super_admin"]:
            r_obj = roles_dict.get(r_name)
            if r_obj:
                for p_obj in perms_dict.values():
                    rp_exists = db.query(RolePermission).filter(
                        RolePermission.role_id == r_obj.id,
                        RolePermission.permission_id == p_obj.id
                    ).first()
                    if not rp_exists:
                        db.add(RolePermission(role_id=r_obj.id, permission_id=p_obj.id))
        db.commit()

        # Seed default users
        print("Seeding default users...")
        default_users_data = [
            ("student@gmail.com", "student", "Student Account", UserRole.STUDENT, None, None),
            ("instructor@gmail.com", "instructor", "Alex Rivers", UserRole.INSTRUCTOR, "Staff Site Reliability Engineer & Principal Cloud Architect with 12+ years building high-throughput distributed systems. Former Infrastructure Lead at Red Hat.", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80"),
            ("admin@gmail.com", "admin", "Dr. Sarah Chen, Ph.D.", UserRole.ADMIN, "Distinguished AI Researcher & Former MIT CS Faculty. Author of 'Practical Neural Systems' and competitive programming grandmaster.", "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80"),
            ("sadmin@gmail.com", "sadmin", "Marcus Vance", UserRole.SUPER_ADMIN, "Principal Systems Architect & Executive Dean of Technology at Codexia Academy.", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80"),
        ]

        for email, username, full_name, role, bio, avatar_url in default_users_data:
            existing = db.query(User).filter((User.email == email) | (User.username == username)).first()
            if not existing:
                u = User(
                    email=email,
                    username=username,
                    password_hash=hash_password("123456"),
                    full_name=full_name,
                    bio=bio,
                    avatar_url=avatar_url,
                    role=role,
                    is_active=True,
                    is_verified=True
                )
                db.add(u)
            else:
                existing.full_name = full_name
                existing.bio = bio
                existing.avatar_url = avatar_url
                existing.password_hash = hash_password("123456")
                existing.role = role
                existing.is_active = True
                existing.is_verified = True
        db.commit()

        # Retrieve instructor ID for course creation
        instructor = db.query(User).filter(User.role == UserRole.INSTRUCTOR).first()
        instructor_id = instructor.id

        print("Seeding 5 default courses, topics, and video lectures...")
        default_courses_data = [
            {
                "title": "Full-Stack Web Development Mastery: Modern React 19 & FastAPI",
                "slug": "full-stack-web-development-mastery",
                "category": CourseCategory.WEB_DEVELOPMENT,
                "difficulty": CourseDifficulty.BEGINNER,
                "short_description": "Architect, build, and deploy production-grade web applications with React 19, asynchronous FastAPI, and PostgreSQL.",
                "description": "Master modern full-stack engineering from architecture to production. Learn reactive component patterns, TanStack Query caching, asynchronous Python microservices with FastAPI and Pydantic V2, robust relational modeling in PostgreSQL, and Docker container orchestration with continuous delivery pipelines.",
                "duration_hours": 2.5,
                "learning_objectives": "Build responsive, high-performance user interfaces with React 19 and modern CSS\nArchitect scalable, asynchronous REST API microservices using FastAPI and Python\nDesign normalized relational database schemas and indexed queries in PostgreSQL\nContainerize services with Docker Compose and implement production-ready CI/CD workflows",
                "prerequisites": "Basic familiarity with HTML, CSS, and basic JavaScript or Python syntax.",
                "thumbnail_url": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80",
                "modules": [
                    {
                        "title": "Module 1: Modern Frontend Architecture",
                        "description": "Core concepts of responsive component architecture and state management.",
                        "lectures": [
                            {
                                "title": "1. Modern Web Ecosystem & React Overview",
                                "description": "Deconstructing single-page applications, the DOM, and reactive state systems.",
                                "duration_seconds": 620,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                                "is_preview": True,
                            },
                            {
                                "title": "2. State, Hooks, & Component Lifecycles",
                                "description": "Hands-on state management using useState, useEffect, and custom hooks.",
                                "duration_seconds": 780,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                    {
                        "title": "Module 2: High-Performance Backend APIs",
                        "description": "Designing asynchronous microservices with FastAPI and Pydantic validation.",
                        "lectures": [
                            {
                                "title": "3. REST API Design & Request Validation",
                                "description": "Structuring endpoints, request parsing, and error-handling middleware.",
                                "duration_seconds": 840,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                                "is_preview": False,
                            },
                            {
                                "title": "4. Secure Authentication & JWT Tokens",
                                "description": "Implementing OAuth2 password flows, bcrypt hashing, and token lifespans.",
                                "duration_seconds": 910,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                    {
                        "title": "Module 3: Database Modeling & Deployment",
                        "description": "Connecting databases, migrations, and containerizing with Docker.",
                        "lectures": [
                            {
                                "title": "5. PostgreSQL & SQLAlchemy ORM Mastery",
                                "description": "Creating robust schemas, indexing, relationships, and queries.",
                                "duration_seconds": 750,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
                                "is_preview": False,
                            },
                            {
                                "title": "6. Full-Stack Production Deployment",
                                "description": "Containerizing services, configuring reverse proxies, and continuous delivery.",
                                "duration_seconds": 980,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                ],
            },
            {
                "title": "Data Structures & Algorithms Masterclass: Pattern-Based Problem Solving",
                "slug": "data-structures-and-algorithms-masterclass",
                "category": CourseCategory.DSA,
                "difficulty": CourseDifficulty.INTERMEDIATE,
                "short_description": "Crack technical interviews with comprehensive pattern-based DSA problem solving, Big-O analysis, and dynamic programming.",
                "description": "Ace high-stakes technical coding interviews and develop foundational problem-solving intuition. Master algorithmic complexity analysis, two-pointer and sliding window heuristics, graph traversals, and dynamic programming memoization with real-world interview patterns.",
                "duration_hours": 2.8,
                "learning_objectives": "Analyze asymptotic time and space complexities with rigorous Big-O notation\nMaster array manipulation, two-pointer, and sliding window heuristics\nNavigate trees, graphs, topological sorts, and shortest-path graph algorithms\nFormulate optimal dynamic programming memoization and tabulation solutions",
                "prerequisites": "Basic understanding of Python, JavaScript, C++, or Java syntax.",
                "thumbnail_url": "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1200&auto=format&fit=crop&q=80",
                "modules": [
                    {
                        "title": "Module 1: Complexity Analysis & Pointers",
                        "description": "Algorithmic thinking, Big-O metrics, and foundational memory techniques.",
                        "lectures": [
                            {
                                "title": "1. Big-O Complexity & Memory Layout",
                                "description": "Understanding time complexity, space tradeoffs, and CPU caching behavior.",
                                "duration_seconds": 710,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
                                "is_preview": True,
                            },
                            {
                                "title": "2. Two-Pointer & Sliding Window Patterns",
                                "description": "Solving sub-array and string window problems in linear O(N) time.",
                                "duration_seconds": 860,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                    {
                        "title": "Module 2: Trees, Graphs & Recursion",
                        "description": "Hierarchical structures, tree traversals, and graph connectivity.",
                        "lectures": [
                            {
                                "title": "3. Binary Search Trees & Balanced Heaps",
                                "description": "In-order, pre-order, post-order traversals and priority queue architectures.",
                                "duration_seconds": 920,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4",
                                "is_preview": False,
                            },
                            {
                                "title": "4. Breadth-First & Depth-First Graph Search",
                                "description": "Topological sorting, cycle detection, and Dijkstra's algorithm.",
                                "duration_seconds": 990,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                    {
                        "title": "Module 3: Dynamic Programming Strategies",
                        "description": "Deconstructing optimal substructure and overlapping subproblems.",
                        "lectures": [
                            {
                                "title": "5. Top-Down Memoization Techniques",
                                "description": "Transforming exponential recursive trees into linear polynomial solutions.",
                                "duration_seconds": 880,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
                                "is_preview": False,
                            },
                            {
                                "title": "6. Bottom-Up Tabulation & State Machines",
                                "description": "Building iterative state transition arrays with O(1) space optimization.",
                                "duration_seconds": 1050,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                ],
            },
            {
                "title": "Machine Learning & Modern AI Engineering: PyTorch, Transformers & RAG",
                "slug": "machine-learning-and-modern-ai-engineering",
                "category": CourseCategory.MACHINE_LEARNING,
                "difficulty": CourseDifficulty.ADVANCED,
                "short_description": "Train deep neural networks, build Transformer attention mechanisms, and engineer hallucination-resistant RAG systems.",
                "description": "Explore the complete artificial intelligence lifecycle. From mathematical fundamentals of gradient descent and PyTorch neural networks to Transformer self-attention architectures and retrieval-augmented generation (RAG) using modern vector databases.",
                "duration_hours": 3.2,
                "learning_objectives": "Understand vector mathematics, loss surfaces, and backpropagation mechanics\nTrain deep neural networks using PyTorch with custom datasets\nBuild self-attention mechanisms and Transformer layers from first principles\nDevelop production RAG systems with vector embeddings and prompt engineering",
                "prerequisites": "Intermediate Python proficiency and foundational linear algebra or calculus concepts.",
                "thumbnail_url": "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&auto=format&fit=crop&q=80",
                "modules": [
                    {
                        "title": "Module 1: Statistical Learning & Gradient Descent",
                        "description": "Mathematical mechanics of loss minimization and predictive modeling.",
                        "lectures": [
                            {
                                "title": "1. Mathematical Foundations of Deep Learning",
                                "description": "Tensors, autograd systems, learning rates, and optimizer dynamics.",
                                "duration_seconds": 890,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                                "is_preview": True,
                            },
                            {
                                "title": "2. Building Neural Networks with PyTorch",
                                "description": "Constructing multi-layer perceptrons, activations, and regularization.",
                                "duration_seconds": 960,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                    {
                        "title": "Module 2: Transformers & Attention Mechanisms",
                        "description": "The architectural engine behind modern Large Language Models.",
                        "lectures": [
                            {
                                "title": "3. Scaled Dot-Product Attention from Scratch",
                                "description": "Queries, Keys, Values, and Multi-Head Attention equations in code.",
                                "duration_seconds": 1150,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                                "is_preview": False,
                            },
                            {
                                "title": "4. Fine-Tuning & Quantization Techniques (LoRA)",
                                "description": "Parameter-efficient fine-tuning methods on open-source foundation models.",
                                "duration_seconds": 1020,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                    {
                        "title": "Module 3: Production AI & RAG Architecture",
                        "description": "Connecting LLMs to proprietary knowledge graphs and vector databases.",
                        "lectures": [
                            {
                                "title": "5. Vector Embeddings & Similarity Search",
                                "description": "High-dimensional vector indexing, cosine similarity, and chunking heuristics.",
                                "duration_seconds": 870,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
                                "is_preview": False,
                            },
                            {
                                "title": "6. Production Retrieval-Augmented Generation (RAG)",
                                "description": "Building hallucination-resistant LLM agents with automated context retrieval.",
                                "duration_seconds": 940,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                ],
            },
            {
                "title": "DevOps, Docker & Cloud Architecture: Kubernetes, CI/CD & AWS Infrastructure",
                "slug": "devops-docker-and-cloud-architecture",
                "category": CourseCategory.DEVOPS,
                "difficulty": CourseDifficulty.INTERMEDIATE,
                "short_description": "Master industrial DevOps workflows: containerize microservices with Docker, automate CI/CD pipelines, and deploy to Kubernetes.",
                "description": "Learn industrial DevOps workflows. Containerize microservices with Docker, automate testing and vulnerability scans with GitHub Actions CI/CD pipelines, manage resilient clusters on Kubernetes, and provision cloud infrastructure reliably using modern GitOps practices.",
                "duration_hours": 2.4,
                "learning_objectives": "Write optimized, secure multi-stage Dockerfiles\nAutomate unit testing, linting, and image builds with GitHub Actions\nDeploy microservices across Kubernetes clusters with rolling updates\nImplement zero-downtime blue/green deployment strategies",
                "prerequisites": "Basic Linux command line knowledge and terminal familiarity.",
                "thumbnail_url": "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=1200&auto=format&fit=crop&q=80",
                "modules": [
                    {
                        "title": "Module 1: Production Containerization",
                        "description": "Building lightweight, production-hardened container images.",
                        "lectures": [
                            {
                                "title": "1. Docker Internals, Namespaces & Cgroups",
                                "description": "How the Linux kernel isolates processes, networks, and storage.",
                                "duration_seconds": 720,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
                                "is_preview": True,
                            },
                            {
                                "title": "2. Multi-Stage Dockerfile Optimization",
                                "description": "Minimizing attack surface and image size by 90% using builder patterns.",
                                "duration_seconds": 810,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                    {
                        "title": "Module 2: CI/CD & Kubernetes Orchestration",
                        "description": "Automated deployments and resilient distributed infrastructure.",
                        "lectures": [
                            {
                                "title": "3. Automated GitHub Actions Workflows",
                                "description": "Triggering test matrices, security linters, and automatic registry pushes.",
                                "duration_seconds": 790,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4",
                                "is_preview": False,
                            },
                            {
                                "title": "4. Kubernetes Pods, Ingress & Deployments",
                                "description": "Self-healing deployments, service meshes, and automated horizontal pod autoscaling.",
                                "duration_seconds": 960,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                ],
            },
            {
                "title": "Cybersecurity & Ethical Hacking Essentials: Network Defense & Pen-Testing",
                "slug": "cybersecurity-and-ethical-hacking-essentials",
                "category": CourseCategory.CYBER_SECURITY,
                "difficulty": CourseDifficulty.BEGINNER,
                "short_description": "Analyze network traffic, probe attack vectors with ethical penetration testing tools, and defend against OWASP Top 10 vulnerabilities.",
                "description": "Step into cyber defense and ethical penetration testing. Discover how modern security professionals analyze network protocols, perform reconnaissance with Nmap and Wireshark, exploit and patch OWASP Top 10 vulnerabilities, and implement defense-in-depth cryptographic security against contemporary cyber threats.",
                "duration_hours": 2.2,
                "learning_objectives": "Analyze network traffic and packet structures with Wireshark\nPerform vulnerability scanning and reconnaissance with Nmap\nIdentify, exploit, and mitigate OWASP Top 10 web vulnerabilities\nConfigure defense-in-depth firewalls, secure headers, and cryptographic protections",
                "prerequisites": "Basic understanding of networking concepts and web protocols (HTTP/DNS).",
                "thumbnail_url": "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&auto=format&fit=crop&q=80",
                "modules": [
                    {
                        "title": "Module 1: Reconnaissance & Network Defense",
                        "description": "Network scanning, packet sniffing, and identifying attack surfaces.",
                        "lectures": [
                            {
                                "title": "1. Network Protocols, Packet Capture & Wireshark",
                                "description": "Inspecting TCP handshakes, TLS certificates, and DNS traffic.",
                                "duration_seconds": 690,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
                                "is_preview": True,
                            },
                            {
                                "title": "2. Nmap Port Scanning & Threat Enumeration",
                                "description": "Discovering live hosts, open ports, and operating system fingerprints.",
                                "duration_seconds": 780,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                    {
                        "title": "Module 2: Web Application Penetration Testing",
                        "description": "Exploitation techniques and mitigation for critical web vulnerabilities.",
                        "lectures": [
                            {
                                "title": "3. SQL Injection & Cross-Site Scripting (XSS)",
                                "description": "Input sanitation, parameterized queries, and Content Security Policies.",
                                "duration_seconds": 910,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                                "is_preview": False,
                            },
                            {
                                "title": "4. Authentication Bypass & Session Security",
                                "description": "Preventing token leakage, securing cookies with HttpOnly, and Rate Limiting.",
                                "duration_seconds": 850,
                                "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                                "is_preview": False,
                            },
                        ],
                    },
                ],
            },
        ]

        for c_data in default_courses_data:
            course = db.query(Course).filter(Course.slug == c_data["slug"]).first()
            if not course:
                # Check for legacy slug
                if c_data["slug"] == "full-stack-web-development-mastery":
                    old_c = db.query(Course).filter(Course.slug == "full-stack-web-development").first()
                    if old_c:
                        course = old_c
                        course.title = c_data["title"]
                        course.slug = c_data["slug"]

            total_lectures = sum(len(m["lectures"]) for m in c_data["modules"])
            if not course:
                course = Course(
                    title=c_data["title"],
                    slug=c_data["slug"],
                    description=c_data["description"],
                    short_description=c_data["short_description"],
                    instructor_id=instructor_id,
                    category=c_data["category"],
                    difficulty=c_data["difficulty"],
                    duration_hours=c_data["duration_hours"],
                    total_lectures=total_lectures,
                    is_published=True,
                    is_approved=True,
                    price=0.0,
                    learning_objectives=c_data["learning_objectives"],
                    prerequisites=c_data["prerequisites"],
                    thumbnail_url=c_data["thumbnail_url"],
                )
                db.add(course)
                db.flush()
            else:
                course.title = c_data["title"]
                course.description = c_data["description"]
                course.short_description = c_data["short_description"]
                course.category = c_data["category"]
                course.difficulty = c_data["difficulty"]
                course.duration_hours = c_data["duration_hours"]
                course.total_lectures = total_lectures
                course.is_published = True
                course.is_approved = True
                course.price = 0.0
                course.learning_objectives = c_data["learning_objectives"]
                course.prerequisites = c_data["prerequisites"]
                course.thumbnail_url = c_data["thumbnail_url"]
                db.flush()

            for m_idx, m_data in enumerate(c_data["modules"]):
                module = db.query(Module).filter(
                    Module.course_id == course.id,
                    Module.title == m_data["title"]
                ).first()
                if not module:
                    module = Module(
                        course_id=course.id,
                        title=m_data["title"],
                        description=m_data["description"],
                        order_index=m_idx
                    )
                    db.add(module)
                    db.flush()
                else:
                    module.description = m_data["description"]
                    module.order_index = m_idx
                    db.flush()

                for l_idx, l_data in enumerate(m_data["lectures"]):
                    lecture = db.query(Lecture).filter(
                        Lecture.module_id == module.id,
                        Lecture.title == l_data["title"]
                    ).first()
                    if not lecture:
                        lecture = Lecture(
                            module_id=module.id,
                            title=l_data["title"],
                            description=l_data["description"],
                            order_index=l_idx,
                            duration_seconds=l_data["duration_seconds"],
                            is_preview=l_data["is_preview"]
                        )
                        db.add(lecture)
                        db.flush()
                    else:
                        lecture.description = l_data["description"]
                        lecture.order_index = l_idx
                        lecture.duration_seconds = l_data["duration_seconds"]
                        lecture.is_preview = l_data["is_preview"]
                        db.flush()

                    if l_data.get("video_url"):
                        video = db.query(Video).filter(Video.lecture_id == lecture.id).first()
                        if not video:
                            video = Video(
                                lecture_id=lecture.id,
                                file_url=l_data["video_url"],
                                file_name=f"Video - {lecture.title}",
                                duration_seconds=l_data["duration_seconds"],
                                mime_type="video/mp4"
                            )
                            db.add(video)
                        else:
                            video.file_url = l_data["video_url"]
                            video.duration_seconds = l_data["duration_seconds"]
            db.commit()

        print("Seeding default coding problems and test cases...")
        existing_problem = db.query(CodingProblem).first()
        if not existing_problem:
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
