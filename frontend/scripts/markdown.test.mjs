import { prepareMarkdown } from '../src/utils/markdown.js';

const cases = [
  ['It costs $5 and $10 in total.', 'It costs \\$5 and \\$10 in total.'],
  ['Mathematically, $2^4 = 16$, which is $\\log_2(16) = 4$.', 'Mathematically, $2^4 = 16$, which is $\\log_2(16) = 4$.'],
  ['Linear search is $O(n)$ and binary is $O(\\log n)$.', 'Linear search is $O(n)$ and binary is $O(\\log n)$.'],
  ['Step 2: Cut in half $\\rightarrow$ 4 left', 'Step 2: Cut in half $\\rightarrow$ 4 left'],
  ['The fee is $20.', 'The fee is \\$20.'],
  ['Pay $5.50 now', 'Pay \\$5.50 now'],
  ['Sum: $2 + 3$ equals 5', 'Sum: $2 + 3$ equals 5'],
  ['Value $16$ here', 'Value $16$ here'],
  ['Use `echo $5` and ```\nprice = "$5 and $10"\n``` ok', 'Use `echo $5` and ```\nprice = "$5 and $10"\n``` ok'],
  ['Inline \\(x^2\\) and display \\[a+b\\]', 'Inline $x^2$ and display \n\n$$\na+b\n$$\n\n'],
  ['Already escaped \\$5 stays', 'Already escaped \\$5 stays'],
  ['$$\nE = mc^2\n$$', '$$\nE = mc^2\n$$'],
  ['Between $5 and $15 dollars, pick one.', 'Between \\$5 and \\$15 dollars, pick one.'],
  // the exact text from the reported Study Assistant screenshot
  ['Compare to Linear Search (checking every item, which is $O(n)$): | Array Size ($n$) | Linear ($O(n)$) | Binary ($O(\\log_2 n)$) |',
   'Compare to Linear Search (checking every item, which is $O(n)$): | Array Size ($n$) | Linear ($O(n)$) | Binary ($O(\\log_2 n)$) |'],
];

let bad = 0;
for (const [input, want] of cases) {
  const got = prepareMarkdown(input);
  if (got !== want) {
    bad += 1;
    console.log('FAIL', JSON.stringify(input), '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want));
  }
}
console.log(bad ? `${bad} failed` : `all ${cases.length} passed`);
process.exit(bad ? 1 : 0);
