"""
Standalone script to seed 3 real coding problems.
Safe to run on existing database — deletes old problems first, then inserts new ones.
Does NOT touch users or courses.
"""

from database import SessionLocal, create_tables
from models.coding import CodingProblem, TestCase, ProblemDifficulty


def seed_coding_problems():
    create_tables()
    db = SessionLocal()

    try:
        # ── Wipe existing coding problems and their test cases ──────────
        existing = db.query(CodingProblem).all()
        if existing:
            print(f"Deleting {len(existing)} existing coding problem(s)...")
            for p in existing:
                db.delete(p)  # cascades to test_cases + submissions
            db.commit()

        # ════════════════════════════════════════════════════════════════
        # PROBLEM 1 — Two Sum  (Arrays / Hash Map — EASY)
        # ════════════════════════════════════════════════════════════════
        print("Seeding: Two Sum ...")
        two_sum = CodingProblem(
            title="Two Sum",
            slug="two-sum",
            description=(
                "Given an array of integers `nums` and an integer `target`, "
                "return the **indices** of the two numbers such that they add up to `target`.\n\n"
                "You may assume that each input would have **exactly one solution**, "
                "and you may not use the same element twice.\n\n"
                "You can return the answer in any order.\n\n"
                "---\n\n"
                "**Example 1**\n\n"
                "```\nInput:\nnums = [2, 7, 11, 15]\ntarget = 9\n\nOutput: 0 1\n"
                "Explanation: nums[0] + nums[1] = 2 + 7 = 9\n```\n\n"
                "**Example 2**\n\n"
                "```\nInput:\nnums = [3, 2, 4]\ntarget = 6\n\nOutput: 1 2\n```\n\n"
                "**Example 3**\n\n"
                "```\nInput:\nnums = [3, 3]\ntarget = 6\n\nOutput: 0 1\n```"
            ),
            difficulty=ProblemDifficulty.EASY,
            constraints=(
                "2 <= nums.length <= 10^4\n"
                "-10^9 <= nums[i] <= 10^9\n"
                "-10^9 <= target <= 10^9\n"
                "Only one valid answer exists."
            ),
            input_format="First line: space-separated integers (the array nums).\nSecond line: the integer target.",
            output_format="Two space-separated indices of the pair that sums to target.",
            tags="array,hash-table",
            hints="Use a hash map to store each number's index as you iterate. For each element, check if target - element already exists in the map.",
            solution=(
                "def solve(nums, target):\n"
                "    seen = {}\n"
                "    for i, n in enumerate(nums):\n"
                "        complement = target - n\n"
                "        if complement in seen:\n"
                "            return f'{seen[complement]} {i}'\n"
                "        seen[n] = i\n"
            ),
            starter_code_python=(
                "def solve(nums, target):\n"
                "    # Use a hash map for O(n) lookup\n"
                "    pass\n"
            ),
            starter_code_javascript=(
                "function solve(nums, target) {\n"
                "    // Use a Map for O(n) lookup\n"
                "}\n"
            ),
            starter_code_java=(
                "import java.util.*;\n\n"
                "public class Solution {\n"
                "    public static void main(String[] args) {\n"
                "        Scanner sc = new Scanner(System.in);\n"
                "        String[] parts = sc.nextLine().trim().split(\" \");\n"
                "        int[] nums = new int[parts.length];\n"
                "        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);\n"
                "        int target = Integer.parseInt(sc.nextLine().trim());\n"
                "        // Solve and print result\n"
                "    }\n"
                "}\n"
            ),
            starter_code_cpp=(
                "#include <iostream>\n"
                "#include <vector>\n"
                "#include <unordered_map>\n"
                "using namespace std;\n\n"
                "int main() {\n"
                "    // Read nums and target, solve Two Sum\n"
                "    return 0;\n"
                "}\n"
            ),
            is_published=True,
        )
        db.add(two_sum)
        db.flush()

        two_sum_cases = [
            # Visible
            TestCase(problem_id=two_sum.id, input_data="2 7 11 15\n9",  expected_output="0 1", is_hidden=False, order_index=0),
            TestCase(problem_id=two_sum.id, input_data="3 2 4\n6",      expected_output="1 2", is_hidden=False, order_index=1),
            # Hidden
            TestCase(problem_id=two_sum.id, input_data="3 3\n6",        expected_output="0 1", is_hidden=True,  order_index=2),
            TestCase(problem_id=two_sum.id, input_data="1 5 3 7 2\n9",  expected_output="1 2", is_hidden=True,  order_index=3),  # 5+3 ‒ but actually 5+3=8 not 9, let me fix: 7+2=9 → idx 3 4
        ]
        # Fix hidden case 4: 1 5 3 7 2, target 9 → 3+4 (7+2)
        two_sum_cases[3] = TestCase(problem_id=two_sum.id, input_data="1 5 3 7 2\n9", expected_output="3 4", is_hidden=True, order_index=3)
        two_sum_cases.append(
            TestCase(problem_id=two_sum.id, input_data="-1 -2 -3 -4 -5\n-8", expected_output="2 4", is_hidden=True, order_index=4)
        )
        db.add_all(two_sum_cases)

        # ════════════════════════════════════════════════════════════════
        # PROBLEM 2 — Valid Parentheses  (Stack — MEDIUM)
        # ════════════════════════════════════════════════════════════════
        print("Seeding: Valid Parentheses ...")
        valid_parens = CodingProblem(
            title="Valid Parentheses",
            slug="valid-parentheses",
            description=(
                "Given a string `s` containing just the characters "
                "`'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, "
                "determine if the input string is **valid**.\n\n"
                "An input string is valid if:\n\n"
                "1. Open brackets must be closed by the same type of brackets.\n"
                "2. Open brackets must be closed in the correct order.\n"
                "3. Every close bracket has a corresponding open bracket of the same type.\n\n"
                "---\n\n"
                "**Example 1**\n\n"
                "```\nInput: ()\nOutput: True\n```\n\n"
                "**Example 2**\n\n"
                "```\nInput: ()[]{}\nOutput: True\n```\n\n"
                "**Example 3**\n\n"
                "```\nInput: (]\nOutput: False\n```\n\n"
                "**Example 4**\n\n"
                "```\nInput: ([)]\nOutput: False\n```"
            ),
            difficulty=ProblemDifficulty.MEDIUM,
            constraints=(
                "1 <= s.length <= 10^4\n"
                "s consists of parentheses only: '()[]{}'"
            ),
            input_format="A single line containing the string s.",
            output_format="True if the string is valid, False otherwise.",
            tags="stack,string",
            hints="Use a stack. Push opening brackets, pop on closing brackets and check for match. If stack is empty at the end, it's valid.",
            solution=(
                "def solve(s):\n"
                "    stack = []\n"
                "    mapping = {')': '(', '}': '{', ']': '['}\n"
                "    for ch in s:\n"
                "        if ch in mapping:\n"
                "            top = stack.pop() if stack else '#'\n"
                "            if mapping[ch] != top:\n"
                "                return False\n"
                "        else:\n"
                "            stack.append(ch)\n"
                "    return len(stack) == 0\n"
            ),
            starter_code_python=(
                "def solve(s):\n"
                "    # Use a stack to match brackets\n"
                "    pass\n"
            ),
            starter_code_javascript=(
                "function solve(s) {\n"
                "    // Use a stack to match brackets\n"
                "}\n"
            ),
            starter_code_java=(
                "import java.util.*;\n\n"
                "public class Solution {\n"
                "    public static void main(String[] args) {\n"
                "        Scanner sc = new Scanner(System.in);\n"
                "        String s = sc.nextLine().trim();\n"
                "        // Solve and print True/False\n"
                "    }\n"
                "}\n"
            ),
            starter_code_cpp=(
                "#include <iostream>\n"
                "#include <stack>\n"
                "#include <string>\n"
                "using namespace std;\n\n"
                "int main() {\n"
                "    string s;\n"
                "    getline(cin, s);\n"
                "    // Solve and print True/False\n"
                "    return 0;\n"
                "}\n"
            ),
            is_published=True,
        )
        db.add(valid_parens)
        db.flush()

        valid_parens_cases = [
            # Visible
            TestCase(problem_id=valid_parens.id, input_data="()",     expected_output="True",  is_hidden=False, order_index=0),
            TestCase(problem_id=valid_parens.id, input_data="()[]{}", expected_output="True",  is_hidden=False, order_index=1),
            # Hidden
            TestCase(problem_id=valid_parens.id, input_data="(]",     expected_output="False", is_hidden=True,  order_index=2),
            TestCase(problem_id=valid_parens.id, input_data="([)]",   expected_output="False", is_hidden=True,  order_index=3),
            TestCase(problem_id=valid_parens.id, input_data="{[]}",   expected_output="True",  is_hidden=True,  order_index=4),
        ]
        db.add_all(valid_parens_cases)

        # ════════════════════════════════════════════════════════════════
        # PROBLEM 3 — Longest Common Subsequence  (DP — HARD)
        # ════════════════════════════════════════════════════════════════
        print("Seeding: Longest Common Subsequence ...")
        lcs = CodingProblem(
            title="Longest Common Subsequence",
            slug="longest-common-subsequence",
            description=(
                "Given two strings `text1` and `text2`, return the length of their "
                "**longest common subsequence**. If there is no common subsequence, return `0`.\n\n"
                "A **subsequence** of a string is a new string generated from the original string "
                "with some characters (can be none) deleted without changing the relative order of "
                "the remaining characters.\n\n"
                "For example, `\"ace\"` is a subsequence of `\"abcde\"`.\n\n"
                "A **common subsequence** of two strings is a subsequence that is common to both strings.\n\n"
                "---\n\n"
                "**Example 1**\n\n"
                "```\nInput:\ntext1 = abcde\ntext2 = ace\n\nOutput: 3\n"
                "Explanation: The longest common subsequence is \"ace\" and its length is 3.\n```\n\n"
                "**Example 2**\n\n"
                "```\nInput:\ntext1 = abc\ntext2 = abc\n\nOutput: 3\n```\n\n"
                "**Example 3**\n\n"
                "```\nInput:\ntext1 = abc\ntext2 = def\n\nOutput: 0\n```"
            ),
            difficulty=ProblemDifficulty.HARD,
            constraints=(
                "1 <= text1.length, text2.length <= 1000\n"
                "text1 and text2 consist of only lowercase English characters."
            ),
            input_format="First line: string text1.\nSecond line: string text2.",
            output_format="A single integer — the length of the longest common subsequence.",
            tags="dynamic-programming,string",
            hints="Build a 2D DP table of size (m+1) x (n+1). If characters match, dp[i][j] = dp[i-1][j-1] + 1. Otherwise dp[i][j] = max(dp[i-1][j], dp[i][j-1]).",
            solution=(
                "def solve(text1, text2):\n"
                "    m, n = len(text1), len(text2)\n"
                "    dp = [[0] * (n + 1) for _ in range(m + 1)]\n"
                "    for i in range(1, m + 1):\n"
                "        for j in range(1, n + 1):\n"
                "            if text1[i-1] == text2[j-1]:\n"
                "                dp[i][j] = dp[i-1][j-1] + 1\n"
                "            else:\n"
                "                dp[i][j] = max(dp[i-1][j], dp[i][j-1])\n"
                "    return dp[m][n]\n"
            ),
            starter_code_python=(
                "def solve(text1, text2):\n"
                "    # Use dynamic programming\n"
                "    pass\n"
            ),
            starter_code_javascript=(
                "function solve(text1, text2) {\n"
                "    // Use dynamic programming\n"
                "}\n"
            ),
            starter_code_java=(
                "import java.util.*;\n\n"
                "public class Solution {\n"
                "    public static void main(String[] args) {\n"
                "        Scanner sc = new Scanner(System.in);\n"
                "        String text1 = sc.nextLine().trim();\n"
                "        String text2 = sc.nextLine().trim();\n"
                "        // Solve and print result\n"
                "    }\n"
                "}\n"
            ),
            starter_code_cpp=(
                "#include <iostream>\n"
                "#include <vector>\n"
                "#include <string>\n"
                "#include <algorithm>\n"
                "using namespace std;\n\n"
                "int main() {\n"
                "    string text1, text2;\n"
                "    getline(cin, text1);\n"
                "    getline(cin, text2);\n"
                "    // Solve LCS and print result\n"
                "    return 0;\n"
                "}\n"
            ),
            is_published=True,
        )
        db.add(lcs)
        db.flush()

        lcs_cases = [
            # Visible
            TestCase(problem_id=lcs.id, input_data="abcde\nace",   expected_output="3", is_hidden=False, order_index=0),
            TestCase(problem_id=lcs.id, input_data="abc\nabc",     expected_output="3", is_hidden=False, order_index=1),
            # Hidden
            TestCase(problem_id=lcs.id, input_data="abc\ndef",     expected_output="0", is_hidden=True,  order_index=2),
            TestCase(problem_id=lcs.id, input_data="abcba\nabcbcba", expected_output="5", is_hidden=True, order_index=3),
            TestCase(problem_id=lcs.id, input_data="oxcpqrsvwf\nshmtulqrypy", expected_output="2", is_hidden=True, order_index=4),
        ]
        db.add_all(lcs_cases)

        db.commit()
        print("✅ Successfully seeded 3 coding problems with test cases!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding coding problems: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_coding_problems()
