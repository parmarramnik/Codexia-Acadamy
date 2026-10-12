/**
 * Light preparation of LLM Markdown before rendering. It never rewrites meaning:
 *  - \( … \) and \[ … \] (LaTeX delimiters some models emit) become $ … $ / $$ … $$ so the
 *    math renderer understands them;
 *  - a "$" that is clearly money ("costs $5 and $10") is escaped so it is not mistaken for math;
 *  - code (fenced or inline) is left byte-for-byte untouched.
 * Valid math such as $O(n)$, $2^4 = 16$ or $x$ is never changed.
 */

const CODE_SPLIT = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;
const NUMBER_AT_START = /^\d[\d,]*(?:\.\d+)?/;
const MATH_HINT = /[\\^_={}]|[+\-*/<>]\s*\S/;   // characters that mark real mathematics
const WORD = /[A-Za-z]{3,}/;

function escapeCurrency(text) {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== '$' || text[i - 1] === '\\' || text[i + 1] === '$' || text[i - 1] === '$') {
      out += ch;
      continue;
    }
    const number = NUMBER_AT_START.exec(text.slice(i + 1));
    if (!number) {
      out += ch;
      continue;
    }
    const after = text[i + 1 + number[0].length];
    const boundary = after === undefined || /[\s.,;:!?)\]/%-]/.test(after);
    if (!boundary) {           // "$2^4 = 16$": the number continues into math
      out += ch;
      continue;
    }
    const nextDollar = text.indexOf('$', i + 1);
    const paragraphEnd = text.indexOf('\n\n', i + 1);
    const closes = nextDollar !== -1 && (paragraphEnd === -1 || nextDollar < paragraphEnd);
    if (!closes) {             // nothing to pair with: it can only be money
      out += '\\$';
      continue;
    }
    const between = text.slice(i + 1, nextDollar);
    // Prose between the two dollars ("5 and ") means two prices; symbols/short terms mean math.
    out += WORD.test(between.replace(/\\[A-Za-z]+/g, '')) && !MATH_HINT.test(between.replace(/\s+/g, ' ').trim().slice(number[0].length)) ? '\\$' : ch;
  }
  return out;
}

function prepareProse(text) {
  return escapeCurrency(
    text
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `\n\n$$\n${m.trim()}\n$$\n\n`)
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => `$${m.trim()}$`),
  );
}

export function prepareMarkdown(input) {
  if (!input) return '';
  return String(input)
    .split(CODE_SPLIT)
    .map((part, index) => (index % 2 === 1 ? part : prepareProse(part)))
    .join('');
}

/** Map the language tags models use onto the Prism languages we bundle. */
const LANGUAGE_ALIASES = {
  py: 'python', python3: 'python', js: 'javascript', node: 'javascript', ts: 'typescript',
  'c++': 'cpp', sh: 'bash', shell: 'bash', zsh: 'bash', html: 'markup', xml: 'markup', yml: 'yaml',
  golang: 'go', text: 'text', plaintext: 'text', txt: 'text', '': 'text',
};

export function normalizeLanguage(lang) {
  const key = String(lang || '').toLowerCase();
  return LANGUAGE_ALIASES[key] ?? key;
}
