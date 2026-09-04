"""
Comprehensive Seeder for Codexia Coding Practice (LeetCode-Style DSA Library).
Includes complete, runnable templates for Python, JavaScript, C++, C, Java, and Go,
with realistic test cases and zero fake execution.
"""

import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import SessionLocal, create_tables
from models.coding import CodingProblem, TestCase, ProblemDifficulty


def get_dsa_problems():
    return [
        # ─────────────────────────────────────────────────────────────
        # 1. Two Sum
        # ─────────────────────────────────────────────────────────────
        {
            "title": "Two Sum",
            "slug": "two-sum",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "Array,Hash Table,Two Pointers",
            "description": (
                "Given an array of integers `nums` and an integer `target`, "
                "return the indices of the two numbers such that they add up to `target`.\n\n"
                "You may assume that each input would have **exactly one solution**, "
                "and you may not use the same element twice.\n\n"
                "Return the answer with the two indices separated by a single space.\n\n"
                "### Example 1:\n"
                "```text\nInput:\n2 7 11 15\n9\nOutput: 0 1\nExplanation: nums[0] + nums[1] = 2 + 7 = 9\n```\n\n"
                "### Example 2:\n"
                "```text\nInput:\n3 2 4\n6\nOutput: 1 2\n```\n\n"
                "### Example 3:\n"
                "```text\nInput:\n3 3\n6\nOutput: 0 1\n```"
            ),
            "constraints": "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.",
            "input_format": "Line 1: space-separated integers (nums)\nLine 2: single integer (target)",
            "output_format": "Two space-separated indices (e.g. 0 1)",
            "hints": "Use a hash map to record seen numbers and their indices. For each number x, check if target - x was seen.",
            "starter_code_python": '''def two_sum(nums: list[int], target: int) -> list[int]:
    # Write your solution here
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []

if __name__ == '__main__':
    import sys
    lines = [l.strip() for l in sys.stdin.read().splitlines() if l.strip()]
    if lines:
        nums = [int(x) for x in lines[0].split()]
        target = int(lines[1])
        res = two_sum(nums, target)
        print(" ".join(map(str, res)))
''',
            "starter_code_javascript": '''const fs = require('fs');

function twoSum(nums, target) {
    // Write your solution here
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const diff = target - nums[i];
        if (map.has(diff)) {
            return [map.get(diff), i];
        }
        map.set(nums[i], i);
    }
    return [];
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const lines = input.split('\\n').map(l => l.trim()).filter(Boolean);
    const nums = lines[0].split(/\\s+/).map(Number);
    const target = Number(lines[1]);
    const res = twoSum(nums, target);
    console.log(res.join(' '));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <unordered_map>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    // Write your solution here
    unordered_map<int, int> seen;
    for (int i = 0; i < nums.size(); ++i) {
        int diff = target - nums[i];
        if (seen.count(diff)) {
            return {seen[diff], i};
        }
        seen[nums[i]] = i;
    }
    return {};
}

int main() {
    string line;
    if (getline(cin, line)) {
        stringstream ss(line);
        vector<int> nums;
        int val;
        while (ss >> val) nums.push_back(val);
        int target;
        if (cin >> target) {
            vector<int> res = twoSum(nums, target);
            cout << res[0] << " " << res[1] << endl;
        }
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void twoSum(int* nums, int n, int target, int* out1, int* out2) {
    // Write your solution here
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            if (nums[i] + nums[j] == target) {
                *out1 = i;
                *out2 = j;
                return;
            }
        }
    }
}

int main() {
    char line[4096];
    if (fgets(line, sizeof(line), stdin)) {
        int nums[2000];
        int n = 0;
        char* token = strtok(line, " \\t\\r\\n");
        while (token) {
            nums[n++] = atoi(token);
            token = strtok(NULL, " \\t\\r\\n");
        }
        int target;
        if (scanf("%d", &target) == 1) {
            int a = 0, b = 0;
            twoSum(nums, n, target, &a, &b);
            printf("%d %d\\n", a, b);
        }
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int[] twoSum(int[] nums, int target) {
        // Write your solution here
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int diff = target - nums[i];
            if (map.containsKey(diff)) {
                return new int[]{map.get(diff), i};
            }
            map.put(nums[i], i);
        }
        return new int[]{};
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextLine()) return;
        String[] parts = sc.nextLine().trim().split("\\\\s+");
        int[] nums = new int[parts.length];
        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
        if (sc.hasNextInt()) {
            int target = sc.nextInt();
            int[] res = twoSum(nums, target);
            System.out.println(res[0] + " " + res[1]);
        }
    }
}
''',
            "starter_code_go": '''package main

import (
    "bufio"
    "fmt"
    "os"
    "strconv"
    "strings"
)

func twoSum(nums []int, target int) []int {
    // Write your solution here
    seen := make(map[int]int)
    for i, num := range nums {
        diff := target - num
        if idx, ok := seen[diff]; ok {
            return []int{idx, i}
        }
        seen[num] = i
    }
    return nil
}

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    if scanner.Scan() {
        fields := strings.Fields(scanner.Text())
        nums := make([]int, len(fields))
        for i, f := range fields {
            nums[i], _ = strconv.Atoi(f)
        }
        if scanner.Scan() {
            target, _ := strconv.Atoi(strings.TrimSpace(scanner.Text()))
            res := twoSum(nums, target)
            if len(res) == 2 {
                fmt.Printf("%d %d\\n", res[0], res[1])
            }
        }
    }
}
''',
            "test_cases": [
                {"input": "2 7 11 15\n9", "output": "0 1", "hidden": False},
                {"input": "3 2 4\n6", "output": "1 2", "hidden": False},
                {"input": "3 3\n6", "output": "0 1", "hidden": True},
            ]
        },

        # ─────────────────────────────────────────────────────────────
        # 2. Reverse String
        # ─────────────────────────────────────────────────────────────
        {
            "title": "Reverse String",
            "slug": "reverse-string",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "String,Two Pointers",
            "description": (
                "Write a function that reverses a string given as input.\n\n"
                "### Example 1:\n"
                "```text\nInput: hello\nOutput: olleh\n```\n\n"
                "### Example 2:\n"
                "```text\nInput: Hannah\nOutput: hannaH\n```"
            ),
            "constraints": "1 <= s.length <= 10^5\ns consists of printable ASCII characters.",
            "input_format": "Single line with string s",
            "output_format": "The reversed string on a single line",
            "hints": "Two pointers approach swapping elements from both ends towards the center.",
            "starter_code_python": '''def reverse_string(s: str) -> str:
    # Write your solution here
    return s[::-1]

if __name__ == '__main__':
    import sys
    inp = sys.stdin.read().rstrip('\\r\\n')
    print(reverse_string(inp))
''',
            "starter_code_javascript": '''const fs = require('fs');

function reverseString(s) {
    // Write your solution here
    return s.split('').reverse().join('');
}

const input = fs.readFileSync(0, 'utf-8').replace(/[\\r\\n]+$/, '');
console.log(reverseString(input));
''',
            "starter_code_cpp": '''#include <iostream>
#include <string>
#include <algorithm>
using namespace std;

string reverseString(string s) {
    reverse(s.begin(), s.end());
    return s;
}

int main() {
    string s;
    if (getline(cin, s)) {
        if (!s.empty() && s.back() == '\\r') s.pop_back();
        cout << reverseString(s) << endl;
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <string.h>

void reverseString(char* s) {
    int i = 0, j = strlen(s) - 1;
    while (i < j) {
        char temp = s[i];
        s[i++] = s[j];
        s[j--] = temp;
    }
}

int main() {
    char s[10000];
    if (fgets(s, sizeof(s), stdin)) {
        s[strcspn(s, "\\r\\n")] = '\\0';
        reverseString(s);
        printf("%s\\n", s);
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static String reverseString(String s) {
        return new StringBuilder(s).reverse().toString();
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextLine()) {
            System.out.println(reverseString(sc.nextLine()));
        }
    }
}
''',
            "starter_code_go": '''package main

import (
    "bufio"
    "fmt"
    "os"
)

func reverseString(s string) string {
    r := []rune(s)
    for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
        r[i], r[j] = r[j], r[i]
    }
    return string(r)
}

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    if scanner.Scan() {
        fmt.Println(reverseString(scanner.Text()))
    }
}
''',
            "test_cases": [
                {"input": "hello", "output": "olleh", "hidden": False},
                {"input": "Hannah", "output": "hannaH", "hidden": False},
                {"input": "Codexia", "output": "aixedoC", "hidden": True},
            ]
        },

        # ─────────────────────────────────────────────────────────────
        # 3. Valid Palindrome
        # ─────────────────────────────────────────────────────────────
        {
            "title": "Valid Palindrome",
            "slug": "valid-palindrome",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "Two Pointers,String",
            "description": (
                "A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters "
                "and removing all non-alphanumeric characters, it reads the same forward and backward.\n\n"
                "Return `true` if it is a palindrome, or `false` otherwise.\n\n"
                "### Example 1:\n"
                "```text\nInput: A man a plan a canal Panama\nOutput: true\n```\n\n"
                "### Example 2:\n"
                "```text\nInput: race a car\nOutput: false\n```"
            ),
            "constraints": "1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.",
            "input_format": "Single line string s",
            "output_format": "true or false",
            "hints": "Filter characters using alphanumeric check, convert to lowercase, then check equality with reverse.",
            "starter_code_python": '''def is_palindrome(s: str) -> bool:
    filtered = [c.lower() for c in s if c.isalnum()]
    return filtered == filtered[::-1]

if __name__ == '__main__':
    import sys
    inp = sys.stdin.read().rstrip('\\r\\n')
    print("true" if is_palindrome(inp) else "false")
''',
            "starter_code_javascript": '''const fs = require('fs');

function isPalindrome(s) {
    const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === clean.split('').reverse().join('');
}

const input = fs.readFileSync(0, 'utf-8').replace(/[\\r\\n]+$/, '');
console.log(isPalindrome(input) ? "true" : "false");
''',
            "starter_code_cpp": '''#include <iostream>
#include <string>
#include <cctype>
using namespace std;

bool isPalindrome(string s) {
    int l = 0, r = s.size() - 1;
    while (l < r) {
        while (l < r && !isalnum(s[l])) l++;
        while (l < r && !isalnum(s[r])) r--;
        if (tolower(s[l]) != tolower(s[r])) return false;
        l++;
        r--;
    }
    return true;
}

int main() {
    string s;
    if (getline(cin, s)) {
        if (!s.empty() && s.back() == '\\r') s.pop_back();
        cout << (isPalindrome(s) ? "true" : "false") << endl;
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <string.h>
#include <ctype.h>

int isPalindrome(const char* s) {
    int l = 0, r = strlen(s) - 1;
    while (l < r) {
        while (l < r && !isalnum(s[l])) l++;
        while (l < r && !isalnum(s[r])) r--;
        if (tolower(s[l]) != tolower(s[r])) return 0;
        l++;
        r--;
    }
    return 1;
}

int main() {
    char s[10000];
    if (fgets(s, sizeof(s), stdin)) {
        s[strcspn(s, "\\r\\n")] = '\\0';
        printf("%s\\n", isPalindrome(s) ? "true" : "false");
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static boolean isPalindrome(String s) {
        int l = 0, r = s.length() - 1;
        while (l < r) {
            while (l < r && !Character.isLetterOrDigit(s.charAt(l))) l++;
            while (l < r && !Character.isLetterOrDigit(s.charAt(r))) r--;
            if (Character.toLowerCase(s.charAt(l)) != Character.toLowerCase(s.charAt(r))) {
                return false;
            }
            l++;
            r--;
        }
        return true;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextLine()) {
            System.out.println(isPalindrome(sc.nextLine()) ? "true" : "false");
        }
    }
}
''',
            "starter_code_go": '''package main

import (
    "bufio"
    "fmt"
    "os"
    "unicode"
)

func isPalindrome(s string) bool {
    r := []rune(s)
    l, right := 0, len(r)-1
    for l < right {
        for l < right && !unicode.IsLetter(r[l]) && !unicode.IsDigit(r[l]) {
            l++
        }
        for l < right && !unicode.IsLetter(r[right]) && !unicode.IsDigit(r[right]) {
            right--
        }
        if unicode.ToLower(r[l]) != unicode.ToLower(r[right]) {
            return false
        }
        l++
        right--
    }
    return true
}

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    if scanner.Scan() {
        if isPalindrome(scanner.Text()) {
            fmt.Println("true")
        } else {
            fmt.Println("false")
        }
    }
}
''',
            "test_cases": [
                {"input": "A man a plan a canal Panama", "output": "true", "hidden": False},
                {"input": "race a car", "output": "false", "hidden": False},
                {"input": "Was it a car or a cat I saw", "output": "true", "hidden": True},
            ]
        },

        # ─────────────────────────────────────────────────────────────
        # 4. Maximum Subarray
        # ─────────────────────────────────────────────────────────────
        {
            "title": "Maximum Subarray",
            "slug": "maximum-subarray",
            "difficulty": ProblemDifficulty.MEDIUM,
            "tags": "Array,Dynamic Programming,Divide and Conquer",
            "description": (
                "Given an integer array `nums`, find the subarray with the largest sum, and return its sum.\n\n"
                "### Example 1:\n"
                "```text\nInput: -2 1 -3 4 -1 2 1 -5 4\nOutput: 6\nExplanation: The subarray [4, -1, 2, 1] has the largest sum 6.\n```\n\n"
                "### Example 2:\n"
                "```text\nInput: 1\nOutput: 1\n```\n\n"
                "### Example 3:\n"
                "```text\nInput: 5 4 -1 7 8\nOutput: 23\n```"
            ),
            "constraints": "1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4",
            "input_format": "Single line of space-separated integers",
            "output_format": "Single integer representing the maximum subarray sum",
            "hints": "Kadane's Algorithm: keep running sum; if running sum becomes negative, reset it to current element.",
            "starter_code_python": '''def max_sub_array(nums: list[int]) -> int:
    max_sum = current_sum = nums[0]
    for x in nums[1:]:
        current_sum = max(x, current_sum + x)
        max_sum = max(max_sum, current_sum)
    return max_sum

if __name__ == '__main__':
    import sys
    nums = [int(x) for x in sys.stdin.read().split()]
    print(max_sub_array(nums))
''',
            "starter_code_javascript": '''const fs = require('fs');

function maxSubArray(nums) {
    let maxSum = nums[0];
    let cur = nums[0];
    for (let i = 1; i < nums.length; i++) {
        cur = Math.max(nums[i], cur + nums[i]);
        maxSum = Math.max(maxSum, cur);
    }
    return maxSum;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const nums = input.split(/\\s+/).map(Number);
    console.log(maxSubArray(nums));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int maxSubArray(vector<int>& nums) {
    int max_s = nums[0], cur = nums[0];
    for (size_t i = 1; i < nums.size(); ++i) {
        cur = max(nums[i], cur + nums[i]);
        max_s = max(max_s, cur);
    }
    return max_s;
}

int main() {
    vector<int> nums;
    int x;
    while (cin >> x) nums.push_back(x);
    if (!nums.empty()) {
        cout << maxSubArray(nums) << endl;
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

int maxSubArray(int* nums, int n) {
    int max_s = nums[0], cur = nums[0];
    for (int i = 1; i < n; i++) {
        cur = (nums[i] > cur + nums[i]) ? nums[i] : (cur + nums[i]);
        if (cur > max_s) max_s = cur;
    }
    return max_s;
}

int main() {
    int nums[100000];
    int n = 0;
    while (scanf("%d", &nums[n]) == 1) n++;
    if (n > 0) {
        printf("%d\\n", maxSubArray(nums, n));
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int maxSubArray(int[] nums) {
        int max = nums[0], cur = nums[0];
        for (int i = 1; i < nums.length; i++) {
            cur = Math.max(nums[i], cur + nums[i]);
            max = Math.max(max, cur);
        }
        return max;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<Integer> list = new ArrayList<>();
        while (sc.hasNextInt()) list.add(sc.nextInt());
        int[] nums = list.stream().mapToInt(i -> i).toArray();
        System.out.println(maxSubArray(nums));
    }
}
''',
            "starter_code_go": '''package main

import (
    "bufio"
    "fmt"
    "os"
    "strconv"
    "strings"
)

func maxSubArray(nums []int) int {
    maxS := nums[0]
    cur := nums[0]
    for i := 1; i < len(nums); i++ {
        if nums[i] > cur+nums[i] {
            cur = nums[i]
        } else {
            cur = cur + nums[i]
        }
        if cur > maxS {
            maxS = cur
        }
    }
    return maxS
}

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    if scanner.Scan() {
        fields := strings.Fields(scanner.Text())
        nums := make([]int, len(fields))
        for i, f := range fields {
            nums[i], _ = strconv.Atoi(f)
        }
        fmt.Println(maxSubArray(nums))
    }
}
''',
            "test_cases": [
                {"input": "-2 1 -3 4 -1 2 1 -5 4", "output": "6", "hidden": False},
                {"input": "1", "output": "1", "hidden": False},
                {"input": "5 4 -1 7 8", "output": "23", "hidden": True},
            ]
        },

        # ─────────────────────────────────────────────────────────────
        # 5. Valid Parentheses
        # ─────────────────────────────────────────────────────────────
        {
            "title": "Valid Parentheses",
            "slug": "valid-parentheses",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "String,Stack",
            "description": (
                "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', "
                "determine if the input string is valid.\n\n"
                "An input string is valid if:\n"
                "1. Open brackets must be closed by the same type of brackets.\n"
                "2. Open brackets must be closed in the correct order.\n"
                "3. Every close bracket has a corresponding open bracket of the same type.\n\n"
                "### Example 1:\n```text\nInput: ()\nOutput: true\n```\n\n"
                "### Example 2:\n```text\nInput: ()[]{}\nOutput: true\n```\n\n"
                "### Example 3:\n```text\nInput: (]\nOutput: false\n```"
            ),
            "constraints": "1 <= s.length <= 10^4\ns consists of parentheses only '()[]{}'.",
            "input_format": "Single string containing brackets",
            "output_format": "true or false",
            "hints": "Push opening brackets onto a stack; for closing brackets, check if top of stack matches.",
            "starter_code_python": '''def is_valid(s: str) -> bool:
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    for char in s:
        if char in pairs:
            if not stack or stack.pop() != pairs[char]:
                return False
        else:
            stack.append(char)
    return len(stack) == 0

if __name__ == '__main__':
    import sys
    inp = sys.stdin.read().strip()
    print("true" if is_valid(inp) else "false")
''',
            "starter_code_javascript": '''const fs = require('fs');

function isValid(s) {
    const stack = [];
    const map = { ')': '(', '}': '{', ']': '[' };
    for (const ch of s) {
        if (map[ch]) {
            if (stack.pop() !== map[ch]) return false;
        } else {
            stack.push(ch);
        }
    }
    return stack.length === 0;
}

const input = fs.readFileSync(0, 'utf-8').trim();
console.log(isValid(input) ? "true" : "false");
''',
            "starter_code_cpp": '''#include <iostream>
#include <string>
#include <stack>
using namespace std;

bool isValid(string s) {
    stack<char> st;
    for (char c : s) {
        if (c == '(' || c == '{' || c == '[') {
            st.push(c);
        } else {
            if (st.empty()) return false;
            char top = st.top();
            st.pop();
            if (c == ')' && top != '(') return false;
            if (c == '}' && top != '{') return false;
            if (c == ']' && top != '[') return false;
        }
    }
    return st.empty();
}

int main() {
    string s;
    if (cin >> s) {
        cout << (isValid(s) ? "true" : "false") << endl;
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <string.h>

int isValid(const char* s) {
    char stack[10000];
    int top = -1;
    for (int i = 0; s[i]; i++) {
        char c = s[i];
        if (c == '(' || c == '{' || c == '[') {
            stack[++top] = c;
        } else if (c == ')' || c == '}' || c == ']') {
            if (top < 0) return 0;
            char o = stack[top--];
            if (c == ')' && o != '(') return 0;
            if (c == '}' && o != '{') return 0;
            if (c == ']' && o != '[') return 0;
        }
    }
    return top == -1;
}

int main() {
    char s[10000];
    if (scanf("%s", s) == 1) {
        printf("%s\\n", isValid(s) ? "true" : "false");
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static boolean isValid(String s) {
        Stack<Character> stack = new Stack<>();
        for (char c : s.toCharArray()) {
            if (c == '(') stack.push(')');
            else if (c == '{') stack.push('}');
            else if (c == '[') stack.push(']');
            else if (stack.isEmpty() || stack.pop() != c) return false;
        }
        return stack.isEmpty();
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNext()) {
            System.out.println(isValid(sc.next()) ? "true" : "false");
        }
    }
}
''',
            "starter_code_go": '''package main

import (
    "fmt"
)

func isValid(s string) bool {
    var stack []rune
    pairs := map[rune]rune{')': '(', '}': '{', ']': '['}
    for _, ch := range s {
        if open, ok := pairs[ch]; ok {
            if len(stack) == 0 || stack[len(stack)-1] != open {
                return false
            }
            stack = stack[:len(stack)-1]
        } else {
            stack = append(stack, ch)
        }
    }
    return len(stack) == 0
}

func main() {
    var s string
    if _, err := fmt.Scan(&s); err == nil {
        if isValid(s) {
            fmt.Println("true")
        } else {
            fmt.Println("false")
        }
    }
}
''',
            "test_cases": [
                {"input": "()", "output": "true", "hidden": False},
                {"input": "()[]{}", "output": "true", "hidden": False},
                {"input": "(]", "output": "false", "hidden": True},
            ]
        },

        # ─────────────────────────────────────────────────────────────
        # 6. Best Time to Buy and Sell Stock
        # ─────────────────────────────────────────────────────────────
        {
            "title": "Best Time to Buy and Sell Stock",
            "slug": "best-time-to-buy-and-sell-stock",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "Array,Dynamic Programming",
            "description": (
                "You are given an array `prices` where `prices[i]` is the price of a given stock on the `i-th` day.\n\n"
                "You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock.\n\n"
                "Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.\n\n"
                "### Example 1:\n```text\nInput: 7 1 5 3 6 4\nOutput: 5\nExplanation: Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6 - 1 = 5.\n```\n\n"
                "### Example 2:\n```text\nInput: 7 6 4 3 1\nOutput: 0\n```"
            ),
            "constraints": "1 <= prices.length <= 10^5\n0 <= prices[i] <= 10^4",
            "input_format": "Space-separated integers representing prices",
            "output_format": "Single integer of maximum profit",
            "hints": "Track minimum price seen so far, and max profit achievable at each step.",
            "starter_code_python": '''def max_profit(prices: list[int]) -> int:
    min_price = float('inf')
    max_p = 0
    for p in prices:
        if p < min_price:
            min_price = p
        elif p - min_price > max_p:
            max_p = p - min_price
    return max_p

if __name__ == '__main__':
    import sys
    prices = [int(x) for x in sys.stdin.read().split()]
    print(max_profit(prices))
''',
            "starter_code_javascript": '''const fs = require('fs');

function maxProfit(prices) {
    let minPrice = Infinity;
    let maxP = 0;
    for (const p of prices) {
        if (p < minPrice) minPrice = p;
        else if (p - minPrice > maxP) maxP = p - minPrice;
    }
    return maxP;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const prices = input.split(/\\s+/).map(Number);
    console.log(maxProfit(prices));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int maxProfit(vector<int>& prices) {
    int min_price = 1e9, max_p = 0;
    for (int p : prices) {
        min_price = min(min_price, p);
        max_p = max(max_p, p - min_price);
    }
    return max_p;
}

int main() {
    vector<int> prices;
    int p;
    while (cin >> p) prices.push_back(p);
    cout << maxProfit(prices) << endl;
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

int maxProfit(int* prices, int n) {
    int min_p = 1000000, max_profit = 0;
    for (int i = 0; i < n; i++) {
        if (prices[i] < min_p) min_p = prices[i];
        else if (prices[i] - min_p > max_profit) max_profit = prices[i] - min_p;
    }
    return max_profit;
}

int main() {
    int prices[100000];
    int n = 0;
    while (scanf("%d", &prices[n]) == 1) n++;
    printf("%d\\n", maxProfit(prices, n));
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int maxProfit(int[] prices) {
        int minPrice = Integer.MAX_VALUE;
        int maxP = 0;
        for (int p : prices) {
            if (p < minPrice) minPrice = p;
            else if (p - minPrice > maxP) maxP = p - minPrice;
        }
        return maxP;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<Integer> list = new ArrayList<>();
        while (sc.hasNextInt()) list.add(sc.nextInt());
        int[] prices = list.stream().mapToInt(i -> i).toArray();
        System.out.println(maxProfit(prices));
    }
}
''',
            "starter_code_go": '''package main

import (
    "bufio"
    "fmt"
    "os"
    "strconv"
    "strings"
)

func maxProfit(prices []int) int {
    minP := int(1e9)
    maxProf := 0
    for _, p := range prices {
        if p < minP {
            minP = p
        } else if p-minP > maxProf {
            maxProf = p - minP
        }
    }
    return maxProf
}

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    if scanner.Scan() {
        fields := strings.Fields(scanner.Text())
        prices := make([]int, len(fields))
        for i, f := range fields {
            prices[i], _ = strconv.Atoi(f)
        }
        fmt.Println(maxProfit(prices))
    }
}
''',
            "test_cases": [
                {"input": "7 1 5 3 6 4", "output": "5", "hidden": False},
                {"input": "7 6 4 3 1", "output": "0", "hidden": False},
                {"input": "2 4 1", "output": "2", "hidden": True},
            ]
        },

        # ─────────────────────────────────────────────────────────────
        # 7. Binary Search
        # ─────────────────────────────────────────────────────────────
        {
            "title": "Binary Search",
            "slug": "binary-search",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "Array,Binary Search",
            "description": (
                "Given an array of integers `nums` which is sorted in ascending order, and an integer `target`, "
                "write a function to search `target` in `nums`. If `target` exists, then return its index. "
                "Otherwise, return -1.\n\n"
                "You must write an algorithm with `O(log n)` runtime complexity.\n\n"
                "### Example 1:\n```text\nInput:\n-1 0 3 5 9 12\n9\nOutput: 4\n```\n\n"
                "### Example 2:\n```text\nInput:\n-1 0 3 5 9 12\n2\nOutput: -1\n```"
            ),
            "constraints": "1 <= nums.length <= 10^4\n-10^4 < nums[i], target < 10^4\nAll integers in nums are unique.",
            "input_format": "Line 1: space-separated sorted integers (nums)\nLine 2: target integer",
            "output_format": "Index of target or -1",
            "hints": "Maintain left and right boundaries, calculate mid, and divide search interval in half.",
            "starter_code_python": '''def binary_search(nums: list[int], target: int) -> int:
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

if __name__ == '__main__':
    import sys
    lines = [l.strip() for l in sys.stdin.read().splitlines() if l.strip()]
    nums = [int(x) for x in lines[0].split()]
    target = int(lines[1])
    print(binary_search(nums, target))
''',
            "starter_code_javascript": '''const fs = require('fs');

function binarySearch(nums, target) {
    let l = 0, r = nums.length - 1;
    while (l <= r) {
        const mid = Math.floor((l + r) / 2);
        if (nums[mid] === target) return mid;
        if (nums[mid] < target) l = mid + 1;
        else r = mid - 1;
    }
    return -1;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const lines = input.split('\\n').map(l => l.trim()).filter(Boolean);
    const nums = lines[0].split(/\\s+/).map(Number);
    const target = Number(lines[1]);
    console.log(binarySearch(nums, target));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
#include <sstream>
using namespace std;

int search(vector<int>& nums, int target) {
    int l = 0, r = nums.size() - 1;
    while (l <= r) {
        int mid = l + (r - l) / 2;
        if (nums[mid] == target) return mid;
        if (nums[mid] < target) l = mid + 1;
        else r = mid - 1;
    }
    return -1;
}

int main() {
    string line;
    if (getline(cin, line)) {
        stringstream ss(line);
        vector<int> nums;
        int x;
        while (ss >> x) nums.push_back(x);
        int target;
        if (cin >> target) {
            cout << search(nums, target) << endl;
        }
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int search(int* nums, int n, int target) {
    int l = 0, r = n - 1;
    while (l <= r) {
        int mid = l + (r - l) / 2;
        if (nums[mid] == target) return mid;
        if (nums[mid] < target) l = mid + 1;
        else r = mid - 1;
    }
    return -1;
}

int main() {
    char line[4096];
    if (fgets(line, sizeof(line), stdin)) {
        int nums[10000];
        int n = 0;
        char* token = strtok(line, " \\t\\r\\n");
        while (token) {
            nums[n++] = atoi(token);
            token = strtok(NULL, " \\t\\r\\n");
        }
        int target;
        if (scanf("%d", &target) == 1) {
            printf("%d\\n", search(nums, n, target));
        }
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int search(int[] nums, int target) {
        int l = 0, r = nums.length - 1;
        while (l <= r) {
            int mid = l + (r - l) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) l = mid + 1;
            else r = mid - 1;
        }
        return -1;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextLine()) {
            String[] parts = sc.nextLine().trim().split("\\\\s+");
            int[] nums = new int[parts.length];
            for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
            if (sc.hasNextInt()) {
                int target = sc.nextInt();
                System.out.println(search(nums, target));
            }
        }
    }
}
''',
            "starter_code_go": '''package main

import (
    "bufio"
    "fmt"
    "os"
    "strconv"
    "strings"
)

func search(nums []int, target int) int {
    l, r := 0, len(nums)-1
    for l <= r {
        mid := l + (r-l)/2
        if nums[mid] == target {
            return mid
        }
        if nums[mid] < target {
            l = mid + 1
        } else {
            r = mid - 1
        }
    }
    return -1
}

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    if scanner.Scan() {
        fields := strings.Fields(scanner.Text())
        nums := make([]int, len(fields))
        for i, f := range fields {
            nums[i], _ = strconv.Atoi(f)
        }
        if scanner.Scan() {
            target, _ := strconv.Atoi(strings.TrimSpace(scanner.Text()))
            fmt.Println(search(nums, target))
        }
    }
}
''',
            "test_cases": [
                {"input": "-1 0 3 5 9 12\n9", "output": "4", "hidden": False},
                {"input": "-1 0 3 5 9 12\n2", "output": "-1", "hidden": False},
                {"input": "5\n5", "output": "0", "hidden": True},
            ]
        },

        # ─────────────────────────────────────────────────────────────
        # 8. Climbing Stairs
        # ─────────────────────────────────────────────────────────────
        {
            "title": "Climbing Stairs",
            "slug": "climbing-stairs",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "Dynamic Programming,Math,Memoization",
            "description": (
                "You are climbing a staircase. It takes `n` steps to reach the top.\n\n"
                "Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?\n\n"
                "### Example 1:\n```text\nInput: 2\nOutput: 2\nExplanation: There are two ways: 1 step + 1 step, or 2 steps.\n```\n\n"
                "### Example 2:\n```text\nInput: 3\nOutput: 3\nExplanation: Three ways: 1+1+1, 1+2, or 2+1.\n```"
            ),
            "constraints": "1 <= n <= 45",
            "input_format": "Single integer n",
            "output_format": "Single integer count of distinct ways",
            "hints": "Notice this is the Fibonacci sequence: ways(n) = ways(n-1) + ways(n-2).",
            "starter_code_python": '''def climb_stairs(n: int) -> int:
    if n <= 2: return n
    a, b = 1, 2
    for _ in range(3, n + 1):
        a, b = b, a + b
    return b

if __name__ == '__main__':
    import sys
    n = int(sys.stdin.read().strip())
    print(climb_stairs(n))
''',
            "starter_code_javascript": '''const fs = require('fs');

function climbStairs(n) {
    if (n <= 2) return n;
    let a = 1, b = 2;
    for (let i = 3; i <= n; i++) {
        const temp = a + b;
        a = b;
        b = temp;
    }
    return b;
}

const input = fs.readFileSync(0, 'utf-8').trim();
console.log(climbStairs(Number(input)));
''',
            "starter_code_cpp": '''#include <iostream>
using namespace std;

int climbStairs(int n) {
    if (n <= 2) return n;
    int a = 1, b = 2;
    for (int i = 3; i <= n; ++i) {
        int temp = a + b;
        a = b;
        b = temp;
    }
    return b;
}

int main() {
    int n;
    if (cin >> n) {
        cout << climbStairs(n) << endl;
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

int climbStairs(int n) {
    if (n <= 2) return n;
    int a = 1, b = 2;
    for (int i = 3; i <= n; i++) {
        int t = a + b;
        a = b;
        b = t;
    }
    return b;
}

int main() {
    int n;
    if (scanf("%d", &n) == 1) {
        printf("%d\\n", climbStairs(n));
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int climbStairs(int n) {
        if (n <= 2) return n;
        int a = 1, b = 2;
        for (int i = 3; i <= n; i++) {
            int t = a + b;
            a = b;
            b = t;
        }
        return b;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            System.out.println(climbStairs(sc.nextInt()));
        }
    }
}
''',
            "starter_code_go": '''package main

import (
    "fmt"
)

func climbStairs(n int) int {
    if n <= 2 {
        return n
    }
    a, b := 1, 2
    for i := 3; i <= n; i++ {
        a, b = b, a+b
    }
    return b
}

func main() {
    var n int
    if _, err := fmt.Scan(&n); err == nil {
        fmt.Println(climbStairs(n))
    }
}
''',
            "test_cases": [
                {"input": "2", "output": "2", "hidden": False},
                {"input": "3", "output": "3", "hidden": False},
                {"input": "5", "output": "8", "hidden": True},
            ]
        },

        # ─────────────────────────────────────────────────────────────
        # 9. Merge Two Sorted Lists
        # ─────────────────────────────────────────────────────────────
        {
            "title": "Merge Two Sorted Lists",
            "slug": "merge-two-sorted-lists",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "Linked List,Recursion,Two Pointers",
            "description": (
                "You are given the heads of two sorted lists `list1` and `list2`.\n\n"
                "Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists.\n\n"
                "Return the merged sorted list as space-separated integers.\n\n"
                "### Example 1:\n```text\nInput:\n1 2 4\n1 3 4\nOutput: 1 1 2 3 4 4\n```\n\n"
                "### Example 2:\n```text\nInput:\n2 5 7\n1 3 8 9\nOutput: 1 2 3 5 7 8 9\n```"
            ),
            "constraints": "The number of nodes in both lists is in the range [0, 50].\n-100 <= Node.val <= 100\nBoth list1 and list2 are sorted in non-decreasing order.",
            "input_format": "Line 1: space-separated integers for list1\nLine 2: space-separated integers for list2",
            "output_format": "Space-separated merged sorted integers",
            "hints": "Two pointer traversal comparing the heads of both lists.",
            "starter_code_python": '''def merge_two_lists(l1: list[int], l2: list[int]) -> list[int]:
    res = []
    i = j = 0
    while i < len(l1) and j < len(l2):
        if l1[i] <= l2[j]:
            res.append(l1[i])
            i += 1
        else:
            res.append(l2[j])
            j += 1
    res.extend(l1[i:])
    res.extend(l2[j:])
    return res

if __name__ == '__main__':
    import sys
    lines = [l.strip() for l in sys.stdin.read().splitlines() if l.strip()]
    l1 = [int(x) for x in lines[0].split()] if len(lines) > 0 else []
    l2 = [int(x) for x in lines[1].split()] if len(lines) > 1 else []
    print(" ".join(map(str, merge_two_lists(l1, l2))))
''',
            "starter_code_javascript": '''const fs = require('fs');

function mergeTwoLists(l1, l2) {
    const res = [];
    let i = 0, j = 0;
    while (i < l1.length && j < l2.length) {
        if (l1[i] <= l2[j]) res.push(l1[i++]);
        else res.push(l2[j++]);
    }
    while (i < l1.length) res.push(l1[i++]);
    while (j < l2.length) res.push(l2[j++]);
    return res;
}

const input = fs.readFileSync(0, 'utf-8').trim();
const lines = input.split('\\n').map(l => l.trim()).filter(Boolean);
const l1 = lines[0] ? lines[0].split(/\\s+/).map(Number) : [];
const l2 = lines[1] ? lines[1].split(/\\s+/).map(Number) : [];
console.log(mergeTwoLists(l1, l2).join(' '));
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
#include <sstream>
using namespace std;

vector<int> mergeTwoLists(vector<int>& l1, vector<int>& l2) {
    vector<int> res;
    size_t i = 0, j = 0;
    while (i < l1.size() && j < l2.size()) {
        if (l1[i] <= l2[j]) res.push_back(l1[i++]);
        else res.push_back(l2[j++]);
    }
    while (i < l1.size()) res.push_back(l1[i++]);
    while (j < l2.size()) res.push_back(l2[j++]);
    return res;
}

int main() {
    string line1, line2;
    vector<int> l1, l2;
    if (getline(cin, line1)) {
        stringstream ss(line1);
        int x;
        while (ss >> x) l1.push_back(x);
    }
    if (getline(cin, line2)) {
        stringstream ss(line2);
        int x;
        while (ss >> x) l2.push_back(x);
    }
    vector<int> res = mergeTwoLists(l1, l2);
    for (size_t i = 0; i < res.size(); ++i) {
        cout << res[i] << (i + 1 < res.size() ? " " : "");
    }
    cout << endl;
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    char line1[2048], line2[2048];
    int l1[1000], l2[1000];
    int n1 = 0, n2 = 0;
    if (fgets(line1, sizeof(line1), stdin)) {
        char* tok = strtok(line1, " \\t\\r\\n");
        while (tok) { l1[n1++] = atoi(tok); tok = strtok(NULL, " \\t\\r\\n"); }
    }
    if (fgets(line2, sizeof(line2), stdin)) {
        char* tok = strtok(line2, " \\t\\r\\n");
        while (tok) { l2[n2++] = atoi(tok); tok = strtok(NULL, " \\t\\r\\n"); }
    }
    int i = 0, j = 0, first = 1;
    while (i < n1 && j < n2) {
        if (!first) printf(" ");
        first = 0;
        if (l1[i] <= l2[j]) printf("%d", l1[i++]);
        else printf("%d", l2[j++]);
    }
    while (i < n1) {
        if (!first) printf(" ");
        first = 0;
        printf("%d", l1[i++]);
    }
    while (j < n2) {
        if (!first) printf(" ");
        first = 0;
        printf("%d", l2[j++]);
    }
    printf("\\n");
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static List<Integer> merge(int[] l1, int[] l2) {
        List<Integer> res = new ArrayList<>();
        int i = 0, j = 0;
        while (i < l1.length && j < l2.length) {
            if (l1[i] <= l2[j]) res.add(l1[i++]);
            else res.add(l2[j++]);
        }
        while (i < l1.length) res.add(l1[i++]);
        while (j < l2.length) res.add(l2[j++]);
        return res;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int[] l1 = new int[0];
        int[] l2 = new int[0];
        if (sc.hasNextLine()) {
            String s1 = sc.nextLine().trim();
            if (!s1.isEmpty()) {
                String[] p = s1.split("\\\\s+");
                l1 = new int[p.length];
                for (int i = 0; i < p.length; i++) l1[i] = Integer.parseInt(p[i]);
            }
        }
        if (sc.hasNextLine()) {
            String s2 = sc.nextLine().trim();
            if (!s2.isEmpty()) {
                String[] p = s2.split("\\\\s+");
                l2 = new int[p.length];
                for (int i = 0; i < p.length; i++) l2[i] = Integer.parseInt(p[i]);
            }
        }
        List<Integer> res = merge(l1, l2);
        for (int i = 0; i < res.size(); i++) {
            System.out.print(res.get(i) + (i + 1 < res.size() ? " " : ""));
        }
        System.out.println();
    }
}
''',
            "starter_code_go": '''package main

import (
    "bufio"
    "fmt"
    "os"
    "strconv"
    "strings"
)

func merge(l1, l2 []int) []int {
    var res []int
    i, j := 0, 0
    for i < len(l1) && j < len(l2) {
        if l1[i] <= l2[j] {
            res = append(res, l1[i])
            i++
        } else {
            res = append(res, l2[j])
            j++
        }
    }
    res = append(res, l1[i:]...)
    res = append(res, l2[j:]...)
    return res
}

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    var l1, l2 []int
    if scanner.Scan() {
        for _, f := range strings.Fields(scanner.Text()) {
            v, _ := strconv.Atoi(f)
            l1 = append(l1, v)
        }
    }
    if scanner.Scan() {
        for _, f := range strings.Fields(scanner.Text()) {
            v, _ := strconv.Atoi(f)
            l2 = append(l2, v)
        }
    }
    res := merge(l1, l2)
    for i, v := range res {
        if i > 0 {
            fmt.Print(" ")
        }
        fmt.Print(v)
    }
    fmt.Println()
}
''',
            "test_cases": [
                {"input": "1 2 4\n1 3 4", "output": "1 1 2 3 4 4", "hidden": False},
                {"input": "2 5 7\n1 3 8 9", "output": "1 2 3 5 7 8 9", "hidden": False},
                {"input": "10\n20", "output": "10 20", "hidden": True},
            ]
        },

        # ─────────────────────────────────────────────────────────────
        # 10. Longest Substring Without Repeating Characters
        # ─────────────────────────────────────────────────────────────
        {
            "title": "Longest Substring Without Repeating Characters",
            "slug": "longest-substring-without-repeating-characters",
            "difficulty": ProblemDifficulty.MEDIUM,
            "tags": "Hash Table,String,Sliding Window",
            "description": (
                "Given a string `s`, find the length of the **longest substring** without repeating characters.\n\n"
                "### Example 1:\n```text\nInput: abcabcbb\nOutput: 3\nExplanation: The answer is \"abc\", with the length of 3.\n```\n\n"
                "### Example 2:\n```text\nInput: bbbbb\nOutput: 1\nExplanation: The answer is \"b\", with the length of 1.\n```\n\n"
                "### Example 3:\n```text\nInput: pwwkew\nOutput: 3\nExplanation: The answer is \"wke\", with the length of 3.\n```"
            ),
            "constraints": "0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.",
            "input_format": "Single string s",
            "output_format": "Single integer of maximum length",
            "hints": "Use a sliding window with a hash set or last-seen index map.",
            "starter_code_python": '''def length_of_longest_substring(s: str) -> int:
    seen = {}
    left = 0
    max_len = 0
    for right, c in enumerate(s):
        if c in seen and seen[c] >= left:
            left = seen[c] + 1
        seen[c] = right
        max_len = max(max_len, right - left + 1)
    return max_len

if __name__ == '__main__':
    import sys
    s = sys.stdin.read().rstrip('\\r\\n')
    print(length_of_longest_substring(s))
''',
            "starter_code_javascript": '''const fs = require('fs');

function lengthOfLongestSubstring(s) {
    const seen = new Map();
    let left = 0, maxLen = 0;
    for (let right = 0; right < s.length; right++) {
        const c = s[right];
        if (seen.has(c) && seen.get(c) >= left) {
            left = seen.get(c) + 1;
        }
        seen.set(c, right);
        maxLen = Math.max(maxLen, right - left + 1);
    }
    return maxLen;
}

const input = fs.readFileSync(0, 'utf-8').replace(/[\\r\\n]+$/, '');
console.log(lengthOfLongestSubstring(input));
''',
            "starter_code_cpp": '''#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;

int lengthOfLongestSubstring(string s) {
    vector<int> last(256, -1);
    int left = 0, max_len = 0;
    for (int right = 0; right < s.size(); ++right) {
        unsigned char c = s[right];
        if (last[c] >= left) left = last[c] + 1;
        last[c] = right;
        max_len = max(max_len, right - left + 1);
    }
    return max_len;
}

int main() {
    string s;
    if (getline(cin, s)) {
        if (!s.empty() && s.back() == '\\r') s.pop_back();
        cout << lengthOfLongestSubstring(s) << endl;
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <string.h>

int lengthOfLongestSubstring(const char* s) {
    int last[256];
    memset(last, -1, sizeof(last));
    int left = 0, max_len = 0;
    for (int right = 0; s[right]; right++) {
        unsigned char c = (unsigned char)s[right];
        if (last[c] >= left) left = last[c] + 1;
        last[c] = right;
        int len = right - left + 1;
        if (len > max_len) max_len = len;
    }
    return max_len;
}

int main() {
    char s[10000];
    if (fgets(s, sizeof(s), stdin)) {
        s[strcspn(s, "\\r\\n")] = '\\0';
        printf("%d\\n", lengthOfLongestSubstring(s));
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int lengthOfLongestSubstring(String s) {
        int[] last = new int[256];
        Arrays.fill(last, -1);
        int left = 0, maxLen = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            if (last[c] >= left) left = last[c] + 1;
            last[c] = right;
            maxLen = Math.max(maxLen, right - left + 1);
        }
        return maxLen;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextLine()) {
            System.out.println(lengthOfLongestSubstring(sc.nextLine()));
        }
    }
}
''',
            "starter_code_go": '''package main

import (
    "bufio"
    "fmt"
    "os"
)

func lengthOfLongestSubstring(s string) int {
    seen := make(map[rune]int)
    left, maxLen := 0, 0
    for right, c := range s {
        if idx, ok := seen[c]; ok && idx >= left {
            left = idx + 1
        }
        seen[c] = right
        if right-left+1 > maxLen {
            maxLen = right - left + 1
        }
    }
    return maxLen
}

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    if scanner.Scan() {
        fmt.Println(lengthOfLongestSubstring(scanner.Text()))
    }
}
''',
            "test_cases": [
                {"input": "abcabcbb", "output": "3", "hidden": False},
                {"input": "bbbbb", "output": "1", "hidden": False},
                {"input": "pwwkew", "output": "3", "hidden": True},
            ]
        },

        # ─────────────────────────────────────────────────────────────
        # 11. Container With Most Water
        # ─────────────────────────────────────────────────────────────
        {
            "title": "Container With Most Water",
            "slug": "container-with-most-water",
            "difficulty": ProblemDifficulty.MEDIUM,
            "tags": "Array,Two Pointers,Greedy",
            "description": (
                "You are given an integer array `height` of length `n`. There are `n` vertical lines drawn such that the two endpoints of the `i-th` line are `(i, 0)` and `(i, height[i])`.\n\n"
                "Find two lines that together with the x-axis form a container, such that the container contains the most water.\n\n"
                "Return the maximum amount of water a container can store.\n\n"
                "### Example 1:\n```text\nInput: 1 8 6 2 5 4 8 3 7\nOutput: 49\nExplanation: The vertical lines are [1, 8, 6, 2, 5, 4, 8, 3, 7]. Max area is 49.\n```\n\n"
                "### Example 2:\n```text\nInput: 1 1\nOutput: 1\n```"
            ),
            "constraints": "n == height.length\n2 <= n <= 10^5\n0 <= height[i] <= 10^4",
            "input_format": "Single line with space-separated integers",
            "output_format": "Single integer representing max water area",
            "hints": "Two pointers from the ends: always advance the pointer pointing to the shorter line.",
            "starter_code_python": '''def max_area(height: list[int]) -> int:
    l, r = 0, len(height) - 1
    max_w = 0
    while l < r:
        h = min(height[l], height[r])
        max_w = max(max_w, h * (r - l))
        if height[l] < height[r]:
            l += 1
        else:
            r -= 1
    return max_w

if __name__ == '__main__':
    import sys
    h = [int(x) for x in sys.stdin.read().split()]
    print(max_area(h))
''',
            "starter_code_javascript": '''const fs = require('fs');

function maxArea(height) {
    let l = 0, r = height.length - 1, maxW = 0;
    while (l < r) {
        const h = Math.min(height[l], height[r]);
        maxW = Math.max(maxW, h * (r - l));
        if (height[l] < height[r]) l++;
        else r--;
    }
    return maxW;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const h = input.split(/\\s+/).map(Number);
    console.log(maxArea(h));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int maxArea(vector<int>& height) {
    int l = 0, r = height.size() - 1, max_w = 0;
    while (l < r) {
        int h = min(height[l], height[r]);
        max_w = max(max_w, h * (r - l));
        if (height[l] < height[r]) l++;
        else r--;
    }
    return max_w;
}

int main() {
    vector<int> h;
    int x;
    while (cin >> x) h.push_back(x);
    cout << maxArea(h) << endl;
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

int maxArea(int* height, int n) {
    int l = 0, r = n - 1, max_w = 0;
    while (l < r) {
        int h = (height[l] < height[r]) ? height[l] : height[r];
        int area = h * (r - l);
        if (area > max_w) max_w = area;
        if (height[l] < height[r]) l++;
        else r--;
    }
    return max_w;
}

int main() {
    int h[100000];
    int n = 0;
    while (scanf("%d", &h[n]) == 1) n++;
    printf("%d\\n", maxArea(h, n));
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int maxArea(int[] height) {
        int l = 0, r = height.length - 1, maxW = 0;
        while (l < r) {
            int h = Math.min(height[l], height[r]);
            maxW = Math.max(maxW, h * (r - l));
            if (height[l] < height[r]) l++;
            else r--;
        }
        return maxW;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<Integer> list = new ArrayList<>();
        while (sc.hasNextInt()) list.add(sc.nextInt());
        int[] h = list.stream().mapToInt(i -> i).toArray();
        System.out.println(maxArea(h));
    }
}
''',
            "starter_code_go": '''package main

import (
    "bufio"
    "fmt"
    "os"
    "strconv"
    "strings"
)

func maxArea(height []int) int {
    l, r := 0, len(height)-1
    maxW := 0
    for l < r {
        h := height[l]
        if height[r] < h {
            h = height[r]
        }
        area := h * (r - l)
        if area > maxW {
            maxW = area
        }
        if height[l] < height[r] {
            l++
        } else {
            r--
        }
    }
    return maxW
}

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    if scanner.Scan() {
        fields := strings.Fields(scanner.Text())
        h := make([]int, len(fields))
        for i, f := range fields {
            h[i], _ = strconv.Atoi(f)
        }
        fmt.Println(maxArea(h))
    }
}
''',
            "test_cases": [
                {"input": "1 8 6 2 5 4 8 3 7", "output": "49", "hidden": False},
                {"input": "1 1", "output": "1", "hidden": False},
                {"input": "4 3 2 1 4", "output": "16", "hidden": True},
            ]
        },

        # ─────────────────────────────────────────────────────────────
        # 12. 3Sum
        # ─────────────────────────────────────────────────────────────
        {
            "title": "3Sum",
            "slug": "3sum",
            "difficulty": ProblemDifficulty.MEDIUM,
            "tags": "Array,Two Pointers,Sorting",
            "description": (
                "Given an integer array `nums`, return the number of unique triplets `[nums[i], nums[j], nums[k]]` such that `i != j`, `i != k`, and `j != k`, and `nums[i] + nums[j] + nums[k] == 0`.\n\n"
                "Notice that the solution set must not contain duplicate triplets.\n\n"
                "Return the count of unique triplets found.\n\n"
                "### Example 1:\n```text\nInput: -1 0 1 2 -1 -4\nOutput: 2\nExplanation: The unique triplets are [-1, -1, 2] and [-1, 0, 1]. Count = 2.\n```\n\n"
                "### Example 2:\n```text\nInput: 0 1 1\nOutput: 0\n```\n\n"
                "### Example 3:\n```text\nInput: 0 0 0\nOutput: 1\n```"
            ),
            "constraints": "3 <= nums.length <= 3000\n-10^5 <= nums[i] <= 10^5",
            "input_format": "Single line of space-separated integers",
            "output_format": "Count of unique triplets summing to 0",
            "hints": "Sort the array first. Loop through element i, and use two pointers for j and k while skipping duplicates.",
            "starter_code_python": '''def three_sum_count(nums: list[int]) -> int:
    nums.sort()
    count = 0
    n = len(nums)
    for i in range(n - 2):
        if i > 0 and nums[i] == nums[i - 1]:
            continue
        l, r = i + 1, n - 1
        while l < r:
            s = nums[i] + nums[l] + nums[r]
            if s == 0:
                count += 1
                while l < r and nums[l] == nums[l + 1]: l += 1
                while l < r and nums[r] == nums[r - 1]: r -= 1
                l += 1
                r -= 1
            elif s < 0:
                l += 1
            else:
                r -= 1
    return count

if __name__ == '__main__':
    import sys
    nums = [int(x) for x in sys.stdin.read().split()]
    print(three_sum_count(nums))
''',
            "starter_code_javascript": '''const fs = require('fs');

function threeSumCount(nums) {
    nums.sort((a, b) => a - b);
    let count = 0;
    for (let i = 0; i < nums.length - 2; i++) {
        if (i > 0 && nums[i] === nums[i - 1]) continue;
        let l = i + 1, r = nums.length - 1;
        while (l < r) {
            const sum = nums[i] + nums[l] + nums[r];
            if (sum === 0) {
                count++;
                while (l < r && nums[l] === nums[l + 1]) l++;
                while (l < r && nums[r] === nums[r - 1]) r--;
                l++;
                r--;
            } else if (sum < 0) {
                l++;
            } else {
                r--;
            }
        }
    }
    return count;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const nums = input.split(/\\s+/).map(Number);
    console.log(threeSumCount(nums));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int threeSumCount(vector<int>& nums) {
    sort(nums.begin(), nums.end());
    int count = 0;
    int n = nums.size();
    for (int i = 0; i < n - 2; ++i) {
        if (i > 0 && nums[i] == nums[i - 1]) continue;
        int l = i + 1, r = n - 1;
        while (l < r) {
            int s = nums[i] + nums[l] + nums[r];
            if (s == 0) {
                count++;
                while (l < r && nums[l] == nums[l + 1]) l++;
                while (l < r && nums[r] == nums[r - 1]) r--;
                l++;
                r--;
            } else if (s < 0) {
                l++;
            } else {
                r--;
            }
        }
    }
    return count;
}

int main() {
    vector<int> nums;
    int x;
    while (cin >> x) nums.push_back(x);
    cout << threeSumCount(nums) << endl;
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <stdlib.h>

int cmp(const void* a, const void* b) {
    return (*(int*)a - *(int*)b);
}

int threeSumCount(int* nums, int n) {
    qsort(nums, n, sizeof(int), cmp);
    int count = 0;
    for (int i = 0; i < n - 2; i++) {
        if (i > 0 && nums[i] == nums[i - 1]) continue;
        int l = i + 1, r = n - 1;
        while (l < r) {
            int s = nums[i] + nums[l] + nums[r];
            if (s == 0) {
                count++;
                while (l < r && nums[l] == nums[l + 1]) l++;
                while (l < r && nums[r] == nums[r - 1]) r--;
                l++;
                r--;
            } else if (s < 0) {
                l++;
            } else {
                r--;
            }
        }
    }
    return count;
}

int main() {
    int nums[5000];
    int n = 0;
    while (scanf("%d", &nums[n]) == 1) n++;
    printf("%d\\n", threeSumCount(nums, n));
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int threeSumCount(int[] nums) {
        Arrays.sort(nums);
        int count = 0;
        for (int i = 0; i < nums.length - 2; i++) {
            if (i > 0 && nums[i] == nums[i - 1]) continue;
            int l = i + 1, r = nums.length - 1;
            while (l < r) {
                int s = nums[i] + nums[l] + nums[r];
                if (s == 0) {
                    count++;
                    while (l < r && nums[l] == nums[l + 1]) l++;
                    while (l < r && nums[r] == nums[r - 1]) r--;
                    l++;
                    r--;
                } else if (s < 0) {
                    l++;
                } else {
                    r--;
                }
            }
        }
        return count;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<Integer> list = new ArrayList<>();
        while (sc.hasNextInt()) list.add(sc.nextInt());
        int[] nums = list.stream().mapToInt(i -> i).toArray();
        System.out.println(threeSumCount(nums));
    }
}
''',
            "starter_code_go": '''package main

import (
    "bufio"
    "fmt"
    "os"
    "sort"
    "strconv"
    "strings"
)

func threeSumCount(nums []int) int {
    sort.Ints(nums)
    count := 0
    n := len(nums)
    for i := 0; i < n-2; i++ {
        if i > 0 && nums[i] == nums[i-1] {
            continue
        }
        l, r := i+1, n-1
        for l < r {
            s := nums[i] + nums[l] + nums[r]
            if s == 0 {
                count++
                for l < r && nums[l] == nums[l+1] {
                    l++
                }
                for l < r && nums[r] == nums[r-1] {
                    r--
                }
                l++
                r--
            } else if s < 0 {
                l++
            } else {
                r--
            }
        }
    }
    return count
}

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    if scanner.Scan() {
        fields := strings.Fields(scanner.Text())
        nums := make([]int, len(fields))
        for i, f := range fields {
            nums[i], _ = strconv.Atoi(f)
        }
        fmt.Println(threeSumCount(nums))
    }
}
''',
            "test_cases": [
                {"input": "-1 0 1 2 -1 -4", "output": "2", "hidden": False},
                {"input": "0 1 1", "output": "0", "hidden": False},
                {"input": "0 0 0", "output": "1", "hidden": True},
            ]
        }
    ]


def seed():
    create_tables()
    db = SessionLocal()
    try:
        # Wipe old problems to ensure fresh, consistent problem bank with all 6 languages
        existing = db.query(CodingProblem).all()
        print(f"Clearing {len(existing)} existing problem(s)...")
        for p in existing:
            db.delete(p)
        db.commit()

        problems_data = get_dsa_problems()
        print(f"Seeding {len(problems_data)} comprehensive LeetCode-style DSA problems...")

        for data in problems_data:
            prob = CodingProblem(
                title=data["title"],
                slug=data["slug"],
                difficulty=data["difficulty"],
                tags=data["tags"],
                description=data["description"],
                constraints=data["constraints"],
                input_format=data["input_format"],
                output_format=data["output_format"],
                hints=data["hints"],
                starter_code_python=data["starter_code_python"],
                starter_code_javascript=data["starter_code_javascript"],
                starter_code_cpp=data["starter_code_cpp"],
                starter_code_c=data["starter_code_c"],
                starter_code_java=data["starter_code_java"],
                starter_code_go=data["starter_code_go"],
                is_published=True,
                total_submissions=0,
                accepted_submissions=0
            )
            db.add(prob)
            db.flush()

            for idx, tc in enumerate(data["test_cases"]):
                test_case = TestCase(
                    problem_id=prob.id,
                    input_data=tc["input"],
                    expected_output=tc["output"],
                    is_hidden=tc["hidden"],
                    order_index=idx,
                    time_limit_seconds=3.0,
                    memory_limit_mb=256
                )
                db.add(test_case)

            print(f"  ✓ Seeded '{prob.title}' with {len(data['test_cases'])} test cases across 6 languages")

        db.commit()
        print("Successfully seeded all 12 problems!")

        # Sync with Elasticsearch
        try:
            from services.search_service import index_all_coding_problems
            count = index_all_coding_problems(db)
            print(f"  ✓ Indexed {count} problems in Elasticsearch 'codexia_coding'")
        except Exception as es_err:
            print(f"  ! Elasticsearch indexing note: {es_err}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding problems: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
