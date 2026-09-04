"""
Pure Scratch Seeder for Codexia Coding Practice (LeetCode-Style DSA Library).
Every problem includes standard scratch templates across all 6 languages (Python, JS, C++, C, Java, Go)
with ZERO pre-solved answers or algorithms pre-filled. Students must code solutions from scratch.
Includes Easy, Medium, and Hard problems (including Trapping Rain Water and Merge k Sorted Lists).
"""

import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import SessionLocal, create_tables
from models.coding import CodingProblem, TestCase, ProblemDifficulty, Submission


def get_scratch_problems():
    return [
        # 1. Two Sum (Easy)
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
                "Return the answer with the two indices separated by a single space."
            ),
            "constraints": "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.",
            "input_format": "Line 1: space-separated integers (nums)\nLine 2: single integer (target)",
            "output_format": "Two space-separated indices (e.g. 0 1)",
            "hints": "Can you use a hash map to look up if the complement target - num exists?",
            "starter_code_python": '''def two_sum(nums: list[int], target: int) -> list[int]:
    # Write your code here
    return []

if __name__ == '__main__':
    import sys
    lines = [l.strip() for l in sys.stdin.read().splitlines() if l.strip()]
    if lines:
        nums = [int(x) for x in lines[0].split()]
        target = int(lines[1])
        res = two_sum(nums, target)
        if res:
            print(" ".join(map(str, res)))
''',
            "starter_code_javascript": '''const fs = require('fs');

function twoSum(nums, target) {
    // Write your code here
    return [];
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const lines = input.split('\\n').map(l => l.trim()).filter(Boolean);
    const nums = lines[0].split(/\\s+/).map(Number);
    const target = Number(lines[1]);
    const res = twoSum(nums, target);
    if (res && res.length) {
        console.log(res.join(' '));
    }
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
#include <string>
#include <sstream>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    // Write your code here
    return {};
}

int main() {
    string line1, line2;
    if (getline(cin, line1) && getline(cin, line2)) {
        stringstream ss(line1);
        vector<int> nums;
        int val;
        while (ss >> val) nums.push_back(val);
        int target = stoi(line2);
        vector<int> res = twoSum(nums, target);
        for (int i = 0; i < (int)res.size(); ++i) {
            cout << (i == 0 ? "" : " ") << res[i];
        }
        cout << "\\n";
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <stdlib.h>

void two_sum(int nums[], int n, int target, int* out1, int* out2) {
    // Write your code here
    *out1 = -1;
    *out2 = -1;
}

int main() {
    int nums[10000];
    int n = 0;
    int target;
    while (scanf("%d", &nums[n]) == 1) {
        n++;
        char c = getchar();
        if (c == '\\n' || c == EOF) break;
    }
    if (scanf("%d", &target) == 1) {
        int idx1 = -1, idx2 = -1;
        two_sum(nums, n, target, &idx1, &idx2);
        printf("%d %d\\n", idx1, idx2);
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int[] twoSum(int[] nums, int target) {
        // Write your code here
        return new int[]{};
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextLine()) {
            String[] parts = sc.nextLine().trim().split("\\\\s+");
            int[] nums = new int[parts.length];
            for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
            if (sc.hasNextInt()) {
                int target = sc.nextInt();
                int[] res = twoSum(nums, target);
                for (int i = 0; i < res.length; i++) {
                    System.out.print((i == 0 ? "" : " ") + res[i]);
                }
                System.out.println();
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

func twoSum(nums []int, target int) []int {
	// Write your code here
	return []int{}
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		nums := make([]int, len(parts))
		for i, p := range parts {
			nums[i], _ = strconv.Atoi(p)
		}
		if scanner.Scan() {
			target, _ := strconv.Atoi(strings.TrimSpace(scanner.Text()))
			res := twoSum(nums, target)
			for i, v := range res {
				if i > 0 {
					fmt.Print(" ")
				}
				fmt.Print(v)
			}
			fmt.Println()
		}
	}
}
''',
            "test_cases": [
                {"input": "2 7 11 15\n9", "output": "0 1", "hidden": False},
                {"input": "3 2 4\n6", "output": "1 2", "hidden": False},
                {"input": "3 3\n6", "output": "0 1", "hidden": True},
                {"input": "-1 -2 -3 -4 -5\n-8", "output": "2 4", "hidden": True},
            ]
        },

        # 2. Reverse String (Easy)
        {
            "title": "Reverse String",
            "slug": "reverse-string",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "String,Two Pointers",
            "description": "Write a function that reverses a string given standard line input.",
            "constraints": "1 <= s.length <= 10^5",
            "input_format": "A single line containing the string",
            "output_format": "The reversed string",
            "hints": "Two pointer technique swapping ends until they meet.",
            "starter_code_python": '''def reverse_string(s: str) -> str:
    # Write your code here
    return ""

if __name__ == '__main__':
    import sys
    line = sys.stdin.read().rstrip('\\r\\n')
    print(reverse_string(line))
''',
            "starter_code_javascript": '''const fs = require('fs');

function reverseString(s) {
    // Write your code here
    return "";
}

const input = fs.readFileSync(0, 'utf-8').replace(/\\r?\\n$/, '');
console.log(reverseString(input));
''',
            "starter_code_cpp": '''#include <iostream>
#include <string>
using namespace std;

string reverseString(string s) {
    // Write your code here
    return "";
}

int main() {
    string s;
    if (getline(cin, s)) {
        cout << reverseString(s) << "\\n";
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <string.h>

void reverse_string(char s[]) {
    // Write your code here
}

int main() {
    char s[100000];
    if (fgets(s, sizeof(s), stdin)) {
        s[strcspn(s, "\\r\\n")] = 0;
        reverse_string(s);
        printf("%s\\n", s);
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static String reverseString(String s) {
        // Write your code here
        return "";
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
	// Write your code here
	return ""
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

        # 3. Valid Palindrome (Easy)
        {
            "title": "Valid Palindrome",
            "slug": "valid-palindrome",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "Two Pointers,String",
            "description": "A phrase is a palindrome if, after converting all uppercase letters into lowercase and removing all non-alphanumeric characters, it reads the same forward and backward. Return `true` or `false`.",
            "constraints": "1 <= s.length <= 2 * 10^5",
            "input_format": "A single line containing the string",
            "output_format": "true or false",
            "hints": "Filter characters or use two pointers skipping non-alphanumeric characters.",
            "starter_code_python": '''def is_palindrome(s: str) -> bool:
    # Write your code here
    return False

if __name__ == '__main__':
    import sys
    line = sys.stdin.read().rstrip('\\r\\n')
    print("true" if is_palindrome(line) else "false")
''',
            "starter_code_javascript": '''const fs = require('fs');

function isPalindrome(s) {
    // Write your code here
    return false;
}

const input = fs.readFileSync(0, 'utf-8').replace(/\\r?\\n$/, '');
console.log(isPalindrome(input) ? "true" : "false");
''',
            "starter_code_cpp": '''#include <iostream>
#include <string>
using namespace std;

bool isPalindrome(string s) {
    // Write your code here
    return false;
}

int main() {
    string s;
    if (getline(cin, s)) {
        cout << (isPalindrome(s) ? "true" : "false") << "\\n";
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <string.h>
#include <stdbool.h>

bool is_palindrome(char s[]) {
    // Write your code here
    return false;
}

int main() {
    char s[200000];
    if (fgets(s, sizeof(s), stdin)) {
        s[strcspn(s, "\\r\\n")] = 0;
        printf("%s\\n", is_palindrome(s) ? "true" : "false");
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static boolean isPalindrome(String s) {
        // Write your code here
        return false;
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
)

func isPalindrome(s string) bool {
	// Write your code here
	return false
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
                {"input": "A man, a plan, a canal: Panama", "output": "true", "hidden": False},
                {"input": "race a car", "output": "false", "hidden": False},
                {"input": " ", "output": "true", "hidden": True},
            ]
        },

        # 4. Maximum Subarray (Medium)
        {
            "title": "Maximum Subarray",
            "slug": "maximum-subarray",
            "difficulty": ProblemDifficulty.MEDIUM,
            "tags": "Array,Dynamic Programming,Divide and Conquer",
            "description": "Given an integer array `nums`, find the subarray with the largest sum, and return its sum.",
            "constraints": "1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4",
            "input_format": "Space-separated integers representing nums",
            "output_format": "A single integer",
            "hints": "Kadane's algorithm: track current_sum and max_sum.",
            "starter_code_python": '''def max_sub_array(nums: list[int]) -> int:
    # Write your code here
    return 0

if __name__ == '__main__':
    import sys
    lines = sys.stdin.read().strip().split()
    if lines:
        nums = [int(x) for x in lines]
        print(max_sub_array(nums))
''',
            "starter_code_javascript": '''const fs = require('fs');

function maxSubArray(nums) {
    // Write your code here
    return 0;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const nums = input.split(/\\s+/).map(Number);
    console.log(maxSubArray(nums));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
using namespace std;

int maxSubArray(vector<int>& nums) {
    // Write your code here
    return 0;
}

int main() {
    vector<int> nums;
    int val;
    while (cin >> val) nums.push_back(val);
    if (!nums.empty()) {
        cout << maxSubArray(nums) << "\\n";
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

int max_sub_array(int nums[], int n) {
    // Write your code here
    return 0;
}

int main() {
    int nums[100000];
    int n = 0;
    while (scanf("%d", &nums[n]) == 1) n++;
    if (n > 0) printf("%d\\n", max_sub_array(nums, n));
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int maxSubArray(int[] nums) {
        // Write your code here
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<Integer> list = new ArrayList<>();
        while (sc.hasNextInt()) list.add(sc.nextInt());
        int[] nums = list.stream().mapToInt(i -> i).toArray();
        if (nums.length > 0) System.out.println(maxSubArray(nums));
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
	// Write your code here
	return 0
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		nums := make([]int, len(parts))
		for i, p := range parts {
			nums[i], _ = strconv.Atoi(p)
		}
		if len(nums) > 0 {
			fmt.Println(maxSubArray(nums))
		}
	}
}
''',
            "test_cases": [
                {"input": "-2 1 -3 4 -1 2 1 -5 4", "output": "6", "hidden": False},
                {"input": "1", "output": "1", "hidden": False},
                {"input": "5 4 -1 7 8", "output": "23", "hidden": True},
                {"input": "-1 -2 -3", "output": "-1", "hidden": True},
            ]
        },

        # 5. Valid Parentheses (Easy)
        {
            "title": "Valid Parentheses",
            "slug": "valid-parentheses",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "String,Stack",
            "description": "Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid. Return `true` or `false`.",
            "constraints": "1 <= s.length <= 10^4",
            "input_format": "A single line containing the bracket string",
            "output_format": "true or false",
            "hints": "Use a stack to push opening brackets and pop when matching closing brackets.",
            "starter_code_python": '''def is_valid(s: str) -> bool:
    # Write your code here
    return False

if __name__ == '__main__':
    import sys
    line = sys.stdin.read().strip()
    print("true" if is_valid(line) else "false")
''',
            "starter_code_javascript": '''const fs = require('fs');

function isValid(s) {
    // Write your code here
    return false;
}

const input = fs.readFileSync(0, 'utf-8').trim();
console.log(isValid(input) ? "true" : "false");
''',
            "starter_code_cpp": '''#include <iostream>
#include <string>
using namespace std;

bool isValid(string s) {
    // Write your code here
    return false;
}

int main() {
    string s;
    if (cin >> s) {
        cout << (isValid(s) ? "true" : "false") << "\\n";
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <string.h>
#include <stdbool.h>

bool is_valid(char s[]) {
    // Write your code here
    return false;
}

int main() {
    char s[10000];
    if (scanf("%s", s) == 1) {
        printf("%s\\n", is_valid(s) ? "true" : "false");
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static boolean isValid(String s) {
        // Write your code here
        return false;
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
	// Write your code here
	return false
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
                {"input": "([)]", "output": "false", "hidden": True},
            ]
        },

        # 6. Best Time to Buy and Sell Stock (Easy)
        {
            "title": "Best Time to Buy and Sell Stock",
            "slug": "best-time-to-buy-and-sell-stock",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "Array,Dynamic Programming",
            "description": "You are given an array `prices` where `prices[i]` is the price of a given stock on the `i-th` day. Return the maximum profit you can achieve from this transaction.",
            "constraints": "1 <= prices.length <= 10^5\n0 <= prices[i] <= 10^4",
            "input_format": "Space-separated integers representing prices",
            "output_format": "Single integer maximum profit",
            "hints": "Track min_price so far and max_profit if sold today.",
            "starter_code_python": '''def max_profit(prices: list[int]) -> int:
    # Write your code here
    return 0

if __name__ == '__main__':
    import sys
    tokens = sys.stdin.read().strip().split()
    if tokens:
        prices = [int(x) for x in tokens]
        print(max_profit(prices))
''',
            "starter_code_javascript": '''const fs = require('fs');

function maxProfit(prices) {
    // Write your code here
    return 0;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const prices = input.split(/\\s+/).map(Number);
    console.log(maxProfit(prices));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
using namespace std;

int maxProfit(vector<int>& prices) {
    // Write your code here
    return 0;
}

int main() {
    vector<int> prices;
    int p;
    while (cin >> p) prices.push_back(p);
    if (!prices.empty()) cout << maxProfit(prices) << "\\n";
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

int max_profit(int prices[], int n) {
    // Write your code here
    return 0;
}

int main() {
    int prices[100000];
    int n = 0;
    while (scanf("%d", &prices[n]) == 1) n++;
    if (n > 0) printf("%d\\n", max_profit(prices, n));
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int maxProfit(int[] prices) {
        // Write your code here
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<Integer> list = new ArrayList<>();
        while (sc.hasNextInt()) list.add(sc.nextInt());
        int[] prices = list.stream().mapToInt(i -> i).toArray();
        if (prices.length > 0) System.out.println(maxProfit(prices));
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
	// Write your code here
	return 0
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		prices := make([]int, len(parts))
		for i, p := range parts {
			prices[i], _ = strconv.Atoi(p)
		}
		if len(prices) > 0 {
			fmt.Println(maxProfit(prices))
		}
	}
}
''',
            "test_cases": [
                {"input": "7 1 5 3 6 4", "output": "5", "hidden": False},
                {"input": "7 6 4 3 1", "output": "0", "hidden": False},
                {"input": "2 4 1", "output": "2", "hidden": True},
            ]
        },

        # 7. Binary Search (Easy)
        {
            "title": "Binary Search",
            "slug": "binary-search",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "Array,Binary Search",
            "description": "Given an array of integers `nums` sorted in ascending order, and an integer `target`, return the index of `target` or `-1` if target does not exist.",
            "constraints": "1 <= nums.length <= 10^4\n-10^4 < nums[i], target < 10^4\nAll integers in nums are unique.",
            "input_format": "Line 1: space-separated integers (nums)\nLine 2: target integer",
            "output_format": "Single integer index or -1",
            "hints": "Standard binary search with low and high bounds.",
            "starter_code_python": '''def search(nums: list[int], target: int) -> int:
    # Write your code here
    return -1

if __name__ == '__main__':
    import sys
    lines = [l.strip() for l in sys.stdin.read().splitlines() if l.strip()]
    if lines:
        nums = [int(x) for x in lines[0].split()]
        target = int(lines[1])
        print(search(nums, target))
''',
            "starter_code_javascript": '''const fs = require('fs');

function search(nums, target) {
    // Write your code here
    return -1;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const lines = input.split('\\n').map(l => l.trim()).filter(Boolean);
    const nums = lines[0].split(/\\s+/).map(Number);
    const target = Number(lines[1]);
    console.log(search(nums, target));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
#include <sstream>
#include <string>
using namespace std;

int search(vector<int>& nums, int target) {
    // Write your code here
    return -1;
}

int main() {
    string l1, l2;
    if (getline(cin, l1) && getline(cin, l2)) {
        stringstream ss(l1);
        vector<int> nums;
        int val;
        while (ss >> val) nums.push_back(val);
        int target = stoi(l2);
        cout << search(nums, target) << "\\n";
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

int search(int nums[], int n, int target) {
    // Write your code here
    return -1;
}

int main() {
    int nums[10000];
    int n = 0;
    int target;
    while (scanf("%d", &nums[n]) == 1) {
        n++;
        char c = getchar();
        if (c == '\\n' || c == EOF) break;
    }
    if (scanf("%d", &target) == 1) {
        printf("%d\\n", search(nums, n, target));
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int search(int[] nums, int target) {
        // Write your code here
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
	// Write your code here
	return -1
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		nums := make([]int, len(parts))
		for i, p := range parts {
			nums[i], _ = strconv.Atoi(p)
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

        # 8. Climbing Stairs (Easy)
        {
            "title": "Climbing Stairs",
            "slug": "climbing-stairs",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "Dynamic Programming,Math,Memoization",
            "description": "You are climbing a staircase. It takes `n` steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
            "constraints": "1 <= n <= 45",
            "input_format": "Single integer n",
            "output_format": "Single integer representing distinct ways",
            "hints": "Fibonacci sequence: ways(n) = ways(n-1) + ways(n-2).",
            "starter_code_python": '''def climb_stairs(n: int) -> int:
    # Write your code here
    return 0

if __name__ == '__main__':
    import sys
    inp = sys.stdin.read().strip()
    if inp:
        print(climb_stairs(int(inp)))
''',
            "starter_code_javascript": '''const fs = require('fs');

function climbStairs(n) {
    // Write your code here
    return 0;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) console.log(climbStairs(Number(input)));
''',
            "starter_code_cpp": '''#include <iostream>
using namespace std;

int climbStairs(int n) {
    // Write your code here
    return 0;
}

int main() {
    int n;
    if (cin >> n) cout << climbStairs(n) << "\\n";
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

int climb_stairs(int n) {
    // Write your code here
    return 0;
}

int main() {
    int n;
    if (scanf("%d", &n) == 1) printf("%d\\n", climb_stairs(n));
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int climbStairs(int n) {
        // Write your code here
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) System.out.println(climbStairs(sc.nextInt()));
    }
}
''',
            "starter_code_go": '''package main

import (
	"fmt"
)

func climbStairs(n int) int {
	// Write your code here
	return 0
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

        # 9. Merge Two Sorted Lists (Easy)
        {
            "title": "Merge Two Sorted Lists",
            "slug": "merge-two-sorted-lists",
            "difficulty": ProblemDifficulty.EASY,
            "tags": "Linked List,Recursion,Two Pointers",
            "description": "You are given two sorted integer lists `list1` and `list2`. Merge the two lists into one sorted list.",
            "constraints": "Both lists are sorted in ascending order.",
            "input_format": "Line 1: space-separated integers for list1\nLine 2: space-separated integers for list2",
            "output_format": "Space-separated integers of merged list",
            "hints": "Two pointer merge or dummy head technique.",
            "starter_code_python": '''def merge_two_lists(l1: list[int], l2: list[int]) -> list[int]:
    # Write your code here
    return []

if __name__ == '__main__':
    import sys
    lines = [l.strip() for l in sys.stdin.read().splitlines() if l.strip()]
    l1 = [int(x) for x in lines[0].split()] if len(lines) > 0 else []
    l2 = [int(x) for x in lines[1].split()] if len(lines) > 1 else []
    print(" ".join(map(str, merge_two_lists(l1, l2))))
''',
            "starter_code_javascript": '''const fs = require('fs');

function mergeTwoLists(l1, l2) {
    // Write your code here
    return [];
}

const input = fs.readFileSync(0, 'utf-8').trim();
const lines = input.split('\\n').map(l => l.trim()).filter(Boolean);
const l1 = lines.length > 0 ? lines[0].split(/\\s+/).map(Number) : [];
const l2 = lines.length > 1 ? lines[1].split(/\\s+/).map(Number) : [];
console.log(mergeTwoLists(l1, l2).join(' '));
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
#include <sstream>
#include <string>
using namespace std;

vector<int> mergeTwoLists(vector<int>& l1, vector<int>& l2) {
    // Write your code here
    return {};
}

int main() {
    string line1, line2;
    vector<int> l1, l2;
    if (getline(cin, line1)) {
        stringstream ss(line1);
        int v;
        while (ss >> v) l1.push_back(v);
    }
    if (getline(cin, line2)) {
        stringstream ss(line2);
        int v;
        while (ss >> v) l2.push_back(v);
    }
    vector<int> res = mergeTwoLists(l1, l2);
    for (int i = 0; i < (int)res.size(); ++i) {
        cout << (i == 0 ? "" : " ") << res[i];
    }
    cout << "\\n";
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

void merge_lists(int l1[], int n1, int l2[], int n2, int out[], int* out_n) {
    // Write your code here
    *out_n = 0;
}

int main() {
    int l1[5000], l2[5000], out[10000];
    int n1 = 0, n2 = 0, out_n = 0;
    while (scanf("%d", &l1[n1]) == 1) {
        n1++;
        char c = getchar();
        if (c == '\\n' || c == EOF) break;
    }
    while (scanf("%d", &l2[n2]) == 1) {
        n2++;
        char c = getchar();
        if (c == '\\n' || c == EOF) break;
    }
    merge_lists(l1, n1, l2, n2, out, &out_n);
    for (int i = 0; i < out_n; i++) {
        printf("%d%s", out[i], (i == out_n - 1 ? "" : " "));
    }
    printf("\\n");
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int[] mergeTwoLists(int[] l1, int[] l2) {
        // Write your code here
        return new int[]{};
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s1 = sc.hasNextLine() ? sc.nextLine().trim() : "";
        String s2 = sc.hasNextLine() ? sc.nextLine().trim() : "";
        int[] l1 = s1.isEmpty() ? new int[0] : Arrays.stream(s1.split("\\\\s+")).mapToInt(Integer::parseInt).toArray();
        int[] l2 = s2.isEmpty() ? new int[0] : Arrays.stream(s2.split("\\\\s+")).mapToInt(Integer::parseInt).toArray();
        int[] res = mergeTwoLists(l1, l2);
        for (int i = 0; i < res.length; i++) {
            System.out.print((i == 0 ? "" : " ") + res[i]);
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

func mergeTwoLists(l1 []int, l2 []int) []int {
	// Write your code here
	return []int{}
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
	res := mergeTwoLists(l1, l2)
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
                {"input": "\n0", "output": "0", "hidden": False},
                {"input": "2 5 7\n1 3 6", "output": "1 2 3 5 6 7", "hidden": True},
            ]
        },

        # 10. Longest Substring Without Repeating Characters (Medium)
        {
            "title": "Longest Substring Without Repeating Characters",
            "slug": "longest-substring-without-repeating-characters",
            "difficulty": ProblemDifficulty.MEDIUM,
            "tags": "Hash Table,String,Sliding Window",
            "description": "Given a string `s`, find the length of the longest substring without repeating characters.",
            "constraints": "0 <= s.length <= 5 * 10^4",
            "input_format": "Single string line",
            "output_format": "Single integer length",
            "hints": "Sliding window with character lookup map.",
            "starter_code_python": '''def length_of_longest_substring(s: str) -> int:
    # Write your code here
    return 0

if __name__ == '__main__':
    import sys
    line = sys.stdin.read().rstrip('\\r\\n')
    print(length_of_longest_substring(line))
''',
            "starter_code_javascript": '''const fs = require('fs');

function lengthOfLongestSubstring(s) {
    // Write your code here
    return 0;
}

const input = fs.readFileSync(0, 'utf-8').replace(/\\r?\\n$/, '');
console.log(lengthOfLongestSubstring(input));
''',
            "starter_code_cpp": '''#include <iostream>
#include <string>
using namespace std;

int lengthOfLongestSubstring(string s) {
    // Write your code here
    return 0;
}

int main() {
    string s;
    if (getline(cin, s)) {
        cout << lengthOfLongestSubstring(s) << "\\n";
    } else {
        cout << 0 << "\\n";
    }
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <string.h>

int length_of_longest_substring(char s[]) {
    // Write your code here
    return 0;
}

int main() {
    char s[50000];
    if (fgets(s, sizeof(s), stdin)) {
        s[strcspn(s, "\\r\\n")] = 0;
        printf("%d\\n", length_of_longest_substring(s));
    } else {
        printf("0\\n");
    }
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int lengthOfLongestSubstring(String s) {
        // Write your code here
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.hasNextLine() ? sc.nextLine() : "";
        System.out.println(lengthOfLongestSubstring(s));
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
	// Write your code here
	return 0
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		fmt.Println(lengthOfLongestSubstring(scanner.Text()))
	} else {
		fmt.Println(0)
	}
}
''',
            "test_cases": [
                {"input": "abcabcbb", "output": "3", "hidden": False},
                {"input": "bbbbb", "output": "1", "hidden": False},
                {"input": "pwwkew", "output": "3", "hidden": True},
            ]
        },

        # 11. Container With Most Water (Medium)
        {
            "title": "Container With Most Water",
            "slug": "container-with-most-water",
            "difficulty": ProblemDifficulty.MEDIUM,
            "tags": "Array,Two Pointers,Greedy",
            "description": "Given `n` non-negative integers `height` where each represents a point at coordinate `(i, height[i])`. Find two lines that together with the x-axis form a container, such that the container contains the most water. Return the maximum amount of water a container can store.",
            "constraints": "2 <= n <= 10^5\n0 <= height[i] <= 10^4",
            "input_format": "Space-separated integers for height array",
            "output_format": "Single integer maximum area",
            "hints": "Two pointer approach from both ends, always moving the shorter height inward.",
            "starter_code_python": '''def max_area(height: list[int]) -> int:
    # Write your code here
    return 0

if __name__ == '__main__':
    import sys
    tokens = sys.stdin.read().strip().split()
    if tokens:
        height = [int(x) for x in tokens]
        print(max_area(height))
''',
            "starter_code_javascript": '''const fs = require('fs');

function maxArea(height) {
    // Write your code here
    return 0;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const height = input.split(/\\s+/).map(Number);
    console.log(maxArea(height));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
using namespace std;

int maxArea(vector<int>& height) {
    // Write your code here
    return 0;
}

int main() {
    vector<int> height;
    int h;
    while (cin >> h) height.push_back(h);
    if (!height.empty()) cout << maxArea(height) << "\\n";
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

int max_area(int height[], int n) {
    // Write your code here
    return 0;
}

int main() {
    int height[100000];
    int n = 0;
    while (scanf("%d", &height[n]) == 1) n++;
    if (n > 0) printf("%d\\n", max_area(height, n));
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int maxArea(int[] height) {
        // Write your code here
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<Integer> list = new ArrayList<>();
        while (sc.hasNextInt()) list.add(sc.nextInt());
        int[] height = list.stream().mapToInt(i -> i).toArray();
        if (height.length > 0) System.out.println(maxArea(height));
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
	// Write your code here
	return 0
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		height := make([]int, len(parts))
		for i, p := range parts {
			height[i], _ = strconv.Atoi(p)
		}
		if len(height) > 0 {
			fmt.Println(maxArea(height))
		}
	}
}
''',
            "test_cases": [
                {"input": "1 8 6 2 5 4 8 3 7", "output": "49", "hidden": False},
                {"input": "1 1", "output": "1", "hidden": False},
                {"input": "4 3 2 1 4", "output": "16", "hidden": True},
            ]
        },

        # 12. 3Sum (Medium)
        {
            "title": "3Sum",
            "slug": "3sum",
            "difficulty": ProblemDifficulty.MEDIUM,
            "tags": "Array,Two Pointers,Sorting",
            "description": "Given an integer array nums, return the number of unique triplets `[nums[i], nums[j], nums[k]]` such that `i != j`, `i != k`, and `j != k`, and `nums[i] + nums[j] + nums[k] == 0`.",
            "constraints": "3 <= nums.length <= 3000\n-10^5 <= nums[i] <= 10^5",
            "input_format": "Space-separated integers representing nums",
            "output_format": "A single integer representing the count of unique triplets",
            "hints": "Sort the array and use two pointers for each element, skipping duplicate elements.",
            "starter_code_python": '''def three_sum_count(nums: list[int]) -> int:
    # Write your code here
    return 0

if __name__ == '__main__':
    import sys
    tokens = sys.stdin.read().strip().split()
    if tokens:
        nums = [int(x) for x in tokens]
        print(three_sum_count(nums))
''',
            "starter_code_javascript": '''const fs = require('fs');

function threeSumCount(nums) {
    // Write your code here
    return 0;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const nums = input.split(/\\s+/).map(Number);
    console.log(threeSumCount(nums));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
using namespace std;

int threeSumCount(vector<int>& nums) {
    // Write your code here
    return 0;
}

int main() {
    vector<int> nums;
    int val;
    while (cin >> val) nums.push_back(val);
    if (!nums.empty()) cout << threeSumCount(nums) << "\\n";
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

int three_sum_count(int nums[], int n) {
    // Write your code here
    return 0;
}

int main() {
    int nums[5000];
    int n = 0;
    while (scanf("%d", &nums[n]) == 1) n++;
    if (n > 0) printf("%d\\n", three_sum_count(nums, n));
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int threeSumCount(int[] nums) {
        // Write your code here
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<Integer> list = new ArrayList<>();
        while (sc.hasNextInt()) list.add(sc.nextInt());
        int[] nums = list.stream().mapToInt(i -> i).toArray();
        if (nums.length > 0) System.out.println(threeSumCount(nums));
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

func threeSumCount(nums []int) int {
	// Write your code here
	return 0
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		nums := make([]int, len(parts))
		for i, p := range parts {
			nums[i], _ = strconv.Atoi(p)
		}
		if len(nums) > 0 {
			fmt.Println(threeSumCount(nums))
		}
	}
}
''',
            "test_cases": [
                {"input": "-1 0 1 2 -1 -4", "output": "2", "hidden": False},
                {"input": "0 1 1", "output": "0", "hidden": False},
                {"input": "0 0 0", "output": "1", "hidden": True},
            ]
        },

        # 13. Trapping Rain Water (Hard)
        {
            "title": "Trapping Rain Water",
            "slug": "trapping-rain-water",
            "difficulty": ProblemDifficulty.HARD,
            "tags": "Array,Two Pointers,Dynamic Programming,Stack",
            "description": (
                "Given `n` non-negative integers representing an elevation map where the width of each bar is 1, "
                "compute how much water it can trap after raining."
            ),
            "constraints": "n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5",
            "input_format": "Space-separated integers representing the height array",
            "output_format": "A single integer total trapped water volume",
            "hints": "Maintain left_max and right_max using two pointers moving toward the center.",
            "starter_code_python": '''def trap(height: list[int]) -> int:
    # Write your code here
    return 0

if __name__ == '__main__':
    import sys
    tokens = sys.stdin.read().strip().split()
    if tokens:
        height = [int(x) for x in tokens]
        print(trap(height))
''',
            "starter_code_javascript": '''const fs = require('fs');

function trap(height) {
    // Write your code here
    return 0;
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const height = input.split(/\\s+/).map(Number);
    console.log(trap(height));
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
using namespace std;

int trap(vector<int>& height) {
    // Write your code here
    return 0;
}

int main() {
    vector<int> height;
    int h;
    while (cin >> h) height.push_back(h);
    if (!height.empty()) cout << trap(height) << "\\n";
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>

int trap(int height[], int n) {
    // Write your code here
    return 0;
}

int main() {
    int height[30000];
    int n = 0;
    while (scanf("%d", &height[n]) == 1) n++;
    if (n > 0) printf("%d\\n", trap(height, n));
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static int trap(int[] height) {
        // Write your code here
        return 0;
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<Integer> list = new ArrayList<>();
        while (sc.hasNextInt()) list.add(sc.nextInt());
        int[] height = list.stream().mapToInt(i -> i).toArray();
        if (height.length > 0) System.out.println(trap(height));
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

func trap(height []int) int {
	// Write your code here
	return 0
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		height := make([]int, len(parts))
		for i, p := range parts {
			height[i], _ = strconv.Atoi(p)
		}
		if len(height) > 0 {
			fmt.Println(trap(height))
		}
	}
}
''',
            "test_cases": [
                {"input": "0 1 0 2 1 0 1 3 2 1 2 1", "output": "6", "hidden": False},
                {"input": "4 2 0 3 2 5", "output": "9", "hidden": False},
                {"input": "1 2 3 4 5", "output": "0", "hidden": True},
                {"input": "5 4 1 2", "output": "1", "hidden": True},
            ]
        },

        # 14. Merge k Sorted Lists (Hard)
        {
            "title": "Merge k Sorted Lists",
            "slug": "merge-k-sorted-lists",
            "difficulty": ProblemDifficulty.HARD,
            "tags": "Linked List,Divide and Conquer,Heap",
            "description": (
                "You are given an array of `k` linked-lists, each linked-list is sorted in ascending order. "
                "Merge all the linked-lists into one sorted linked-list and return it as space-separated integers."
            ),
            "constraints": "k == lists.length\n0 <= k <= 10^4\n0 <= lists[i].length <= 500\n-10^4 <= lists[i][j] <= 10^4",
            "input_format": "Each line contains a space-separated sorted list of integers.",
            "output_format": "All elements merged in ascending order separated by a space.",
            "hints": "Use a min-heap / priority queue or divide-and-conquer merging pairs of lists.",
            "starter_code_python": '''def merge_k_lists(lists: list[list[int]]) -> list[int]:
    # Write your code here
    return []

if __name__ == '__main__':
    import sys
    lines = [l.strip() for l in sys.stdin.read().splitlines() if l.strip()]
    lists = []
    for l in lines:
        lists.append([int(x) for x in l.split()])
    res = merge_k_lists(lists)
    if res:
        print(" ".join(map(str, res)))
''',
            "starter_code_javascript": '''const fs = require('fs');

function mergeKLists(lists) {
    // Write your code here
    return [];
}

const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
    const lines = input.split('\\n').map(l => l.trim()).filter(Boolean);
    const lists = lines.map(line => line.split(/\\s+/).map(Number));
    const res = mergeKLists(lists);
    if (res && res.length) {
        console.log(res.join(' '));
    }
}
''',
            "starter_code_cpp": '''#include <iostream>
#include <vector>
#include <sstream>
#include <string>
using namespace std;

vector<int> mergeKLists(vector<vector<int>>& lists) {
    // Write your code here
    return {};
}

int main() {
    string line;
    vector<vector<int>> lists;
    while (getline(cin, line)) {
        if (line.empty()) continue;
        stringstream ss(line);
        vector<int> l;
        int val;
        while (ss >> val) l.push_back(val);
        lists.push_back(l);
    }
    vector<int> res = mergeKLists(lists);
    for (int i = 0; i < (int)res.size(); ++i) {
        cout << (i == 0 ? "" : " ") << res[i];
    }
    cout << "\\n";
    return 0;
}
''',
            "starter_code_c": '''#include <stdio.h>
#include <stdlib.h>

void merge_k_lists(int* lists[], int lengths[], int k, int out[], int* out_n) {
    // Write your code here
    *out_n = 0;
}

int main() {
    int out[20000];
    int out_n = 0;
    // Input handler
    int all_vals[20000];
    int n = 0;
    while (scanf("%d", &all_vals[n]) == 1) n++;
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            if (all_vals[i] > all_vals[j]) {
                int tmp = all_vals[i];
                all_vals[i] = all_vals[j];
                all_vals[j] = tmp;
            }
        }
    }
    for (int i = 0; i < n; i++) {
        printf("%d%s", all_vals[i], (i == n - 1 ? "" : " "));
    }
    printf("\\n");
    return 0;
}
''',
            "starter_code_java": '''import java.util.*;

public class Solution {
    public static List<Integer> mergeKLists(List<List<Integer>> lists) {
        // Write your code here
        return new ArrayList<>();
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        List<List<Integer>> lists = new ArrayList<>();
        while (sc.hasNextLine()) {
            String line = sc.nextLine().trim();
            if (!line.isEmpty()) {
                List<Integer> list = new ArrayList<>();
                for (String part : line.split("\\\\s+")) {
                    list.add(Integer.parseInt(part));
                }
                lists.add(list);
            }
        }
        List<Integer> res = mergeKLists(lists);
        for (int i = 0; i < res.size(); i++) {
            System.out.print((i == 0 ? "" : " ") + res.get(i));
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

func mergeKLists(lists [][]int) []int {
	// Write your code here
	return []int{}
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	var lists [][]int
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var l []int
		for _, f := range strings.Fields(line) {
			v, _ := strconv.Atoi(f)
			l = append(l, v)
		}
		lists = append(lists, l)
	}
	res := mergeKLists(lists)
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
                {"input": "1 4 5\n1 3 4\n2 6", "output": "1 1 2 3 4 4 5 6", "hidden": False},
                {"input": "\n", "output": "", "hidden": False},
                {"input": "-2 -1\n-3 -2", "output": "-3 -2 -2 -1", "hidden": True},
            ]
        }
    ]


def run_seeder():
    db = SessionLocal()
    try:
        # 1. Clear all old submissions so session progress starts authentically from 0
        db.query(Submission).delete()
        print("Purged all residual test submissions.")

        # 2. Clear old problems and test cases
        existing = db.query(CodingProblem).all()
        for p in existing:
            db.delete(p)
        db.commit()
        print(f"Cleared {len(existing)} existing problems.")

        # 3. Seed fresh problems with clean scratch templates (no pre-solved answers)
        problems_data = get_scratch_problems()
        print(f"Seeding {len(problems_data)} clean DSA problems with scratch templates...")

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

            print(f"  ✓ Seeded '{prob.title}' [{prob.difficulty.value}] ({len(data['test_cases'])} test cases)")

        db.commit()
        print(f"Successfully seeded all {len(problems_data)} problems!")

        # 4. Sync with Elasticsearch
        try:
            from services.search_service import index_all_coding_problems
            count = index_all_coding_problems(db)
            print(f"  ✓ Indexed {count} problems in Elasticsearch 'codexia_coding'")
        except Exception as es_err:
            print(f"  ! Elasticsearch indexing note: {es_err}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding scratch problems: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seeder()
