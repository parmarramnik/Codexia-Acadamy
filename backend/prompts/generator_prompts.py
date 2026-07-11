"""
Content generation prompt templates for notes, flashcards, and quizzes.
"""

NOTES_PROMPT = """Generate comprehensive, well-structured notes on the topic: {topic}
Course: {course_title}

Requirements:
- Use markdown formatting
- Include clear headings and subheadings
- Add code examples where relevant
- Include key definitions and concepts
- Add practical tips and best practices
- Keep it educational and easy to understand
- Use bullet points for clarity
- Include a summary at the end"""


FLASHCARD_PROMPT = """Generate {count} flashcards on the topic: {topic}

Requirements:
- Each flashcard should have a clear question and concise answer
- Cover key concepts, definitions, and important facts
- Vary the difficulty from basic to advanced
- Make questions specific and testable

Respond ONLY with a JSON array in this exact format:
[
    {{"question": "What is...", "answer": "It is..."}},
    {{"question": "Explain...", "answer": "..."}}
]"""


QUIZ_PROMPT = """Generate {count} multiple choice quiz questions on the topic: {topic}
Difficulty: {difficulty}

Requirements:
- Each question should have 4 options (A, B, C, D)
- Exactly one option should be correct
- Include a brief explanation for the correct answer
- Questions should test understanding, not just memorization

Respond ONLY with a JSON array in this exact format:
[
    {{
        "question": "What is...",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_index": 0,
        "explanation": "This is correct because..."
    }}
]"""
