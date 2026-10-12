import { memo, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { FiCheck, FiCode, FiCopy } from 'react-icons/fi';
import 'katex/dist/katex.min.css';
import '../../styles/markdown.css';
import { useTheme } from '../../context/ThemeContext';
import { normalizeLanguage, prepareMarkdown } from '../../utils/markdown';

Object.entries({ python, javascript, typescript, jsx, java, c, cpp, go, bash, json, sql, markup, css, yaml })
  .forEach(([name, grammar]) => SyntaxHighlighter.registerLanguage(name, grammar));

const KNOWN_LANGUAGES = new Set(['python', 'javascript', 'typescript', 'jsx', 'java', 'c', 'cpp', 'go', 'bash',
  'json', 'sql', 'markup', 'css', 'yaml']);
const DISPLAY_NAMES = { cpp: 'C++', markup: 'HTML', javascript: 'JavaScript', typescript: 'TypeScript', jsx: 'JSX',
  json: 'JSON', sql: 'SQL', css: 'CSS', yaml: 'YAML', bash: 'Shell', go: 'Go', java: 'Java', c: 'C', python: 'Python',
  text: 'Text' };

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (insecure context / permissions): fall back to a hidden textarea.
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

function CodeBlock({ language, code, onOpenCanvas }) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const lang = normalizeLanguage(language);

  const handleCopy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div className="md-code">
      <div className="md-code-bar">
        <span className="md-code-lang">{DISPLAY_NAMES[lang] || lang || 'Text'}</span>
        <div className="md-code-actions">
          <button type="button" className="md-code-btn" onClick={handleCopy} aria-label="Copy code">
            {copied ? <FiCheck size={13} /> : <FiCopy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          {onOpenCanvas && (
            <button type="button" className="md-code-btn" onClick={() => onOpenCanvas(code, lang)}
              aria-label="Open code in canvas">
              <FiCode size={13} />
              <span>Canvas</span>
            </button>
          )}
        </div>
      </div>
      <div className="md-code-scroll">
        {KNOWN_LANGUAGES.has(lang) ? (
          <SyntaxHighlighter
            language={lang}
            style={theme === 'light' ? oneLight : oneDark}
            customStyle={{ margin: 0, padding: '0.9rem 1rem', background: 'transparent', fontSize: '0.84rem',
              lineHeight: 1.6, minWidth: 'max-content' }}
            codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
            wrapLongLines={false}
          >
            {code}
          </SyntaxHighlighter>
        ) : (
          <pre className="md-code-plain"><code>{code}</code></pre>
        )}
      </div>
    </div>
  );
}

/** Pull the language and raw text out of the <code> element react-markdown puts inside <pre>. */
function readCodeNode(node) {
  const codeEl = node?.children?.find((child) => child.tagName === 'code');
  const classes = codeEl?.properties?.className || [];
  const language = (classes.find((name) => String(name).startsWith('language-')) || '').replace('language-', '');
  const text = (codeEl?.children || []).map((child) => child.value || '').join('');
  return { language, code: text.replace(/\n$/, '') };
}

const REMARK_PLUGINS = [remarkGfm, [remarkMath, { singleDollarTextMath: true }]];
// throwOnError:false renders invalid LaTeX as its source (red) instead of crashing the message.
const REHYPE_PLUGINS = [[rehypeKatex, { throwOnError: false, strict: 'ignore' }]];

function MarkdownContent({ content, onOpenCanvas, className = '' }) {
  const prepared = useMemo(() => prepareMarkdown(content), [content]);
  const components = useMemo(() => ({
    // Fenced blocks arrive as <pre><code>; handled here so inline `code` stays a plain <code>.
    pre({ node }) {
      const { language, code } = readCodeNode(node);
      return <CodeBlock language={language} code={code} onOpenCanvas={onOpenCanvas} />;
    },
    code({ className: cls, children }) {
      return <code className={`md-inline-code ${cls || ''}`}>{children}</code>;
    },
    table({ children }) {
      return <div className="md-table-scroll"><table>{children}</table></div>;
    },
    a({ href, children }) {
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
  }), [onOpenCanvas]);

  // No rehype-raw: any HTML the model emits is shown as text, never executed.
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={components}>
        {prepared}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownContent);
