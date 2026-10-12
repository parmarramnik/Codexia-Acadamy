// Renders real markdown through the real MarkdownContent component (server-side) and asserts on the HTML.
// Run: node scripts/render-check.mjs
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const sample = String.raw`### 3. Why Binary Search is so powerful

Compare Binary Search to **Linear Search** (checking every item, which is $O(n)$):

| Array Size ($n$) | Linear Search ($O(n)$) | Binary Search ($O(\log_2 n)$) |
| :--- | :--- | :--- |
| **16** | Up to 16 steps | Up to **4 steps** |
| **1,000,000** | Up to 1,000,000 steps | Up to **20 steps** |

It took only 4 steps: $2^4 = 16$, i.e. $\log_2(16) = 4$.

$$
T(n) = T(n/2) + O(1)
$$

It costs $5 and $10 in total.

~~~python
def search(xs, t):
    return xs.index(t)  # costs $5
~~~

<script>alert('xss')</script>
<img src=x onerror="alert(1)">
[bad](javascript:alert(1))
`;

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { default: MarkdownContent } = await server.ssrLoadModule('/src/components/common/MarkdownContent.jsx');
  const { ThemeProvider } = await server.ssrLoadModule('/src/context/ThemeContext.jsx');
  const html = renderToStaticMarkup(
    React.createElement(ThemeProvider, null, React.createElement(MarkdownContent, { content: sample })),
  );
  const checks = {
    'table is rendered as <table>': /<table>/.test(html) && /<th/.test(html),
    'table is wrapped in a scroll container': html.includes('md-table-scroll'),
    'math rendered by KaTeX': (html.match(/class="katex"/g) || []).length >= 6,
    'display math rendered': html.includes('katex-display'),
    'no raw $O(n)$ left in text': !html.includes('$O(n)$') && !html.includes('$n$'),
    'money kept as plain dollars': html.includes('It costs $5 and $10 in total.'),
    'code block has toolbar + copy': html.includes('md-code-bar') && html.includes('Copy'),
    'code keeps its own $ untouched': html.includes('costs $5'),
    'script tag is not executed/emitted': !/<script/i.test(html),
    'event-handler HTML is not emitted': !/<img[^>]*onerror/i.test(html),
    'javascript: links are neutralised': !/href="javascript:/i.test(html),
  };
  let failed = 0;
  for (const [name, ok] of Object.entries(checks)) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) failed += 1;
  }
  if (failed) console.log('\n' + html.slice(0, 3000));
  process.exitCode = failed ? 1 : 0;
} finally {
  await server.close();
}
