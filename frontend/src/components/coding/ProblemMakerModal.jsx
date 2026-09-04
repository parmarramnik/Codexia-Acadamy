import React, { useState } from 'react';
import { 
  FiX, FiPlus, FiTrash2, FiCode, FiFileText, FiLayers, 
  FiCheckCircle, FiCalendar, FiTag, FiZap 
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import codingService from '../../services/codingService';

export default function ProblemMakerModal({ isOpen, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'description' | 'templates' | 'testcases'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [tags, setTags] = useState('Algorithms, Data Structures');
  const [timeLimit, setTimeLimit] = useState(2.0);
  const [memoryLimit, setMemoryLimit] = useState(256);

  // Specs
  const [description, setDescription] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [constraints, setConstraints] = useState('1 <= n <= 10^5');
  const [hints, setHints] = useState('');

  // Multi-language Starter Code (Pure Scratch)
  const [activeLangTab, setActiveLangTab] = useState('python');
  const [starterCodes, setStarterCodes] = useState({
    python: '',
    javascript: '',
    cpp: '',
    c: '',
    java: '',
    go: '',
  });

  // Test cases
  const [testCases, setTestCases] = useState([
    { input_data: '', expected_output: '', is_hidden: false, order_index: 0 },
  ]);

  // Daily Challenge flag
  const [setAsDaily, setSetAsDaily] = useState(false);

  // Auto-generate slug and default boilerplate when title changes
  const handleTitleChange = (val) => {
    setTitle(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    setSlug(generatedSlug);
  };

  // Generate clean scratch boilerplates (NO pre-solved answers!)
  const generateScratchTemplates = () => {
    const rawFnName = slug ? slug.replace(/-/g, '_') : 'solve';
    const camelFnName = slug 
      ? slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      : 'solve';

    setStarterCodes({
      python: `import sys\n\ndef ${rawFnName}(*args):\n    # Write your solution here\n    pass\n\nif __name__ == '__main__':\n    lines = [l.strip() for l in sys.stdin.read().splitlines() if l.strip()]\n    if lines:\n        # Read input lines and invoke ${rawFnName}\n        print(${rawFnName}(lines))\n`,
      javascript: `const fs = require('fs');\n\nfunction ${camelFnName}(input) {\n    // Write your solution here\n    return null;\n}\n\nconst raw = fs.readFileSync(0, 'utf-8').trim();\nif (raw) {\n    const lines = raw.split('\\n').map(l => l.trim()).filter(Boolean);\n    console.log(${camelFnName}(lines));\n}\n`,
      cpp: `#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\nclass Solution {\npublic:\n    void ${camelFnName}() {\n        // Write your solution here\n    }\n};\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    Solution solver;\n    // Read input and execute\n    return 0;\n}\n`,
      c: `#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\n// Write your solution function here\n\nint main() {\n    // Read input and execute\n    return 0;\n}\n`,
      java: `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n`,
      go: `package main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n)\n\nfunc main() {\n    scanner := bufio.NewScanner(os.Stdin)\n    _ = scanner\n    // Write your solution here\n}\n`
    });
    toast.success('Generated clean scratch templates for 6 languages!');
  };

  const handleAddTestCase = () => {
    setTestCases(prev => [
      ...prev,
      { input_data: '', expected_output: '', is_hidden: false, order_index: prev.length }
    ]);
  };

  const handleRemoveTestCase = (index) => {
    if (testCases.length <= 1) {
      toast.error('At least one test case is required');
      return;
    }
    setTestCases(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleTestCaseChange = (index, field, value) => {
    setTestCases(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || title.trim().length < 3) {
      toast.error('Title must be at least 3 characters');
      setActiveTab('basic');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      toast.error('Description must be at least 10 characters');
      setActiveTab('description');
      return;
    }

    const validTestCases = testCases.filter(
      tc => tc.input_data.trim() !== '' || tc.expected_output.trim() !== ''
    );
    if (validTestCases.length === 0) {
      toast.error('Please provide at least one test case with input and expected output');
      setActiveTab('testcases');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || title.toLowerCase().replace(/\s+/g, '-'),
        difficulty: difficulty.toLowerCase(),
        tags: tags.trim(),
        description: description.trim(),
        constraints: constraints.trim() || null,
        input_format: inputFormat.trim() || null,
        output_format: outputFormat.trim() || null,
        hints: hints.trim() || null,
        starter_code_python: starterCodes.python || null,
        starter_code_javascript: starterCodes.javascript || null,
        starter_code_cpp: starterCodes.cpp || null,
        starter_code_c: starterCodes.c || null,
        starter_code_java: starterCodes.java || null,
        starter_code_go: starterCodes.go || null,
        test_cases: validTestCases.map((tc, idx) => ({
          input_data: tc.input_data,
          expected_output: tc.expected_output,
          is_hidden: tc.is_hidden,
          order_index: idx,
          time_limit_seconds: parseFloat(timeLimit) || 2.0,
          memory_limit_mb: parseInt(memoryLimit) || 256
        })),
        set_as_daily: setAsDaily
      };

      const res = await codingService.create(payload);
      toast.success(setAsDaily 
        ? `Problem '${title}' created and set as Today's Daily Challenge!` 
        : `Problem '${title}' created successfully!`
      );
      
      if (onSuccess) {
        onSuccess(res.data);
      }
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Failed to create problem';
      toast.error(`Error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        
        {/* Modal Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={styles.headerIconWrapper}>
              <FiCode size={22} style={{ color: '#3B82F6' }} />
            </div>
            <div>
              <h2 style={styles.title}>Create Coding Challenge</h2>
              <p style={styles.subtitle}>
                Author a new problem with pure scratch boilerplate templates, custom test cases, and daily challenge assignment.
              </p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Close">
            <FiX size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={styles.tabNav}>
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            style={activeTab === 'basic' ? { ...styles.tabBtn, ...styles.tabBtnActive } : styles.tabBtn}
          >
            <FiLayers /> 1. Basic Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('description')}
            style={activeTab === 'description' ? { ...styles.tabBtn, ...styles.tabBtnActive } : styles.tabBtn}
          >
            <FiFileText /> 2. Specifications & Hints
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            style={activeTab === 'templates' ? { ...styles.tabBtn, ...styles.tabBtnActive } : styles.tabBtn}
          >
            <FiCode /> 3. Scratch Templates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('testcases')}
            style={activeTab === 'testcases' ? { ...styles.tabBtn, ...styles.tabBtnActive } : styles.tabBtn}
          >
            <FiCheckCircle /> 4. Test Cases & Daily
          </button>
        </div>

        {/* Modal Body / Tab Content */}
        <form onSubmit={handleSubmit} style={styles.body}>
          
          {/* TAB 1: BASIC INFO */}
          {activeTab === 'basic' && (
            <div style={styles.tabContent}>
              <div style={styles.formGrid2}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Problem Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Invert Binary Tree"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Slug (Auto-generated)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. invert-binary-tree"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGrid3}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Difficulty *</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    style={styles.select}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Time Limit (sec)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="10.0"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Memory Limit (MB)</label>
                  <input
                    type="number"
                    step="16"
                    min="64"
                    max="1024"
                    value={memoryLimit}
                    onChange={(e) => setMemoryLimit(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Topic Tags (Comma-separated)</label>
                <div style={{ position: 'relative' }}>
                  <FiTag style={styles.inputIcon} />
                  <input
                    type="text"
                    placeholder="e.g. Array, Hash Table, Two Pointers, Dynamic Programming"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    style={{ ...styles.input, paddingLeft: '2.4rem' }}
                  />
                </div>
                <span style={styles.hintText}>Tags allow students to filter challenges by topic in the Problem Hub.</span>
              </div>
            </div>
          )}

          {/* TAB 2: SPECIFICATIONS & HINTS */}
          {activeTab === 'description' && (
            <div style={styles.tabContent}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Problem Description (Markdown supported) *</label>
                <textarea
                  rows={6}
                  required
                  placeholder="Describe the problem statement, context, and clear instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={styles.textarea}
                />
              </div>

              <div style={styles.formGrid2}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Input Format</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. First line contains integer N, second line contains N space-separated integers..."
                    value={inputFormat}
                    onChange={(e) => setInputFormat(e.target.value)}
                    style={styles.textarea}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Output Format</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Print the indices separated by a single space..."
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    style={styles.textarea}
                  />
                </div>
              </div>

              <div style={styles.formGrid2}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Constraints</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 <= nums.length <= 10^5, -10^9 <= target <= 10^9"
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Hints (Optional, comma or newline separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Try using a hash table for O(n) lookup."
                    value={hints}
                    onChange={(e) => setHints(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STARTER CODE (SCRATCH TEMPLATES) */}
          {activeTab === 'templates' && (
            <div style={styles.tabContent}>
              <div style={styles.templateNotice}>
                <div>
                  <h4 style={styles.noticeTitle}>
                    <FiZap style={{ color: '#F59E0B' }} /> Pure Scratch Starter Code
                  </h4>
                  <p style={styles.noticeText}>
                    Provide only clean starter signatures with <code># Write your solution here</code>. Never include pre-solved algorithms or answers!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={generateScratchTemplates}
                  style={styles.generateBtn}
                >
                  <FiZap /> Auto-Generate Boilerplates
                </button>
              </div>

              {/* Language Sub-tabs */}
              <div style={styles.langSubNav}>
                {['python', 'javascript', 'cpp', 'c', 'java', 'go'].map((langKey) => (
                  <button
                    key={langKey}
                    type="button"
                    onClick={() => setActiveLangTab(langKey)}
                    style={activeLangTab === langKey ? { ...styles.langSubBtn, ...styles.langSubBtnActive } : styles.langSubBtn}
                  >
                    {langKey === 'python' ? 'Python 3' :
                     langKey === 'javascript' ? 'JavaScript' :
                     langKey === 'cpp' ? 'C++' :
                     langKey === 'c' ? 'C' :
                     langKey === 'java' ? 'Java' : 'Go'}
                  </button>
                ))}
              </div>

              <div style={styles.formGroup}>
                <textarea
                  rows={10}
                  value={starterCodes[activeLangTab]}
                  onChange={(e) => setStarterCodes(prev => ({ ...prev, [activeLangTab]: e.target.value }))}
                  placeholder={`// Enter ${activeLangTab} starter boilerplate with empty body...`}
                  style={styles.codeTextarea}
                  spellCheck={false}
                />
              </div>
            </div>
          )}

          {/* TAB 4: TEST CASES & DAILY SETTING */}
          {activeTab === 'testcases' && (
            <div style={styles.tabContent}>
              
              {/* Daily Challenge Card Option */}
              <div style={styles.dailyCard}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                  <input
                    type="checkbox"
                    id="set-as-daily"
                    checked={setAsDaily}
                    onChange={(e) => setSetAsDaily(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <div>
                    <label htmlFor="set-as-daily" style={styles.dailyLabel}>
                      <FiCalendar style={{ color: '#F59E0B', marginRight: '0.4rem' }} />
                      Set as Today's Daily Coding Challenge
                    </label>
                    <p style={styles.dailyDescription}>
                      Check this to immediately feature this problem on the platform homepage and problem hub as today's daily coding challenge for all students.
                    </p>
                  </div>
                </div>
              </div>

              {/* Test Cases Builder */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, color: '#FFF', fontSize: '0.95rem' }}>Test Cases ({testCases.length})</h4>
                <button
                  type="button"
                  onClick={handleAddTestCase}
                  style={styles.addCaseBtn}
                >
                  <FiPlus /> Add Test Case
                </button>
              </div>

              <div style={styles.testCasesList}>
                {testCases.map((tc, index) => (
                  <div key={index} style={styles.testCaseItem}>
                    <div style={styles.testCaseItemHeader}>
                      <span style={styles.caseBadge}>
                        Case #{index + 1} {tc.is_hidden ? '(Hidden Evaluation Case)' : '(Public Sample)'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <label style={styles.hiddenCheckboxLabel}>
                          <input
                            type="checkbox"
                            checked={tc.is_hidden}
                            onChange={(e) => handleTestCaseChange(index, 'is_hidden', e.target.checked)}
                          />
                          Hidden Case
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveTestCase(index)}
                          style={styles.deleteCaseBtn}
                          title="Remove test case"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div style={styles.formGrid2}>
                      <div style={styles.formGroup}>
                        <label style={styles.miniLabel}>Input Data (stdin)</label>
                        <textarea
                          rows={3}
                          value={tc.input_data}
                          onChange={(e) => handleTestCaseChange(index, 'input_data', e.target.value)}
                          placeholder="e.g. 2 7 11 15\n9"
                          style={styles.codeMiniArea}
                          spellCheck={false}
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.miniLabel}>Expected Output (stdout)</label>
                        <textarea
                          rows={3}
                          value={tc.expected_output}
                          onChange={(e) => handleTestCaseChange(index, 'expected_output', e.target.value)}
                          placeholder="e.g. 0 1"
                          style={styles.codeMiniArea}
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div style={styles.footer}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {activeTab !== 'basic' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'testcases') setActiveTab('templates');
                    else if (activeTab === 'templates') setActiveTab('description');
                    else if (activeTab === 'description') setActiveTab('basic');
                  }}
                  style={styles.secondaryBtn}
                >
                  Previous Step
                </button>
              )}
              {activeTab !== 'testcases' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'basic') setActiveTab('description');
                    else if (activeTab === 'description') setActiveTab('templates');
                    else if (activeTab === 'templates') setActiveTab('testcases');
                  }}
                  style={styles.primaryBtn}
                >
                  Next Step
                </button>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={styles.cancelBtn}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={styles.publishBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Publishing Challenge...' : 'Publish Challenge'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1.5rem',
  },
  modal: {
    backgroundColor: '#18181B',
    border: '1px solid #27272A',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.75rem',
    borderBottom: '1px solid #27272A',
    backgroundColor: '#1F1F23',
  },
  headerIconWrapper: {
    width: '42px',
    height: '42px',
    borderRadius: '8px',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#FAFAFA',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: '#A1A1AA',
    margin: '0.25rem 0 0 0',
  },
  closeBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#71717A',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  tabNav: {
    display: 'flex',
    backgroundColor: '#141416',
    borderBottom: '1px solid #27272A',
    padding: '0 1.25rem',
    overflowX: 'auto',
  },
  tabBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#71717A',
    padding: '0.85rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    color: '#3B82F6',
    borderBottomColor: '#3B82F6',
    fontWeight: '600',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  tabContent: {
    padding: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  formGrid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.25rem',
  },
  formGrid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1.25rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#D4D4D8',
  },
  miniLabel: {
    fontSize: '0.75rem',
    fontWeight: '500',
    color: '#A1A1AA',
  },
  hintText: {
    fontSize: '0.75rem',
    color: '#71717A',
    marginTop: '0.2rem',
  },
  input: {
    backgroundColor: '#121214',
    border: '1px solid #27272A',
    borderRadius: '6px',
    padding: '0.625rem 0.85rem',
    color: '#FAFAFA',
    fontSize: '0.875rem',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  inputIcon: {
    position: 'absolute',
    left: '0.85rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#71717A',
  },
  select: {
    backgroundColor: '#121214',
    border: '1px solid #27272A',
    borderRadius: '6px',
    padding: '0.625rem 0.85rem',
    color: '#FAFAFA',
    fontSize: '0.875rem',
    outline: 'none',
    cursor: 'pointer',
  },
  textarea: {
    backgroundColor: '#121214',
    border: '1px solid #27272A',
    borderRadius: '6px',
    padding: '0.75rem 0.85rem',
    color: '#FAFAFA',
    fontSize: '0.875rem',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  codeTextarea: {
    backgroundColor: '#0F0F11',
    border: '1px solid #27272A',
    borderRadius: '6px',
    padding: '0.85rem',
    color: '#E4E4E7',
    fontSize: '0.8125rem',
    fontFamily: 'Fira Code, Consolas, Monaco, monospace',
    outline: 'none',
    resize: 'vertical',
    lineHeight: '1.5',
  },
  codeMiniArea: {
    backgroundColor: '#0F0F11',
    border: '1px solid #27272A',
    borderRadius: '4px',
    padding: '0.5rem 0.75rem',
    color: '#E4E4E7',
    fontSize: '0.8125rem',
    fontFamily: 'Fira Code, Consolas, Monaco, monospace',
    outline: 'none',
    resize: 'vertical',
  },
  templateNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    borderRadius: '8px',
    padding: '1rem 1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  noticeTitle: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#F59E0B',
    margin: '0 0 0.25rem 0',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  noticeText: {
    fontSize: '0.75rem',
    color: '#D4D4D8',
    margin: 0,
  },
  generateBtn: {
    backgroundColor: '#27272A',
    border: '1px solid #3F3F46',
    color: '#FAFAFA',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  langSubNav: {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid #27272A',
    paddingBottom: '0.5rem',
  },
  langSubBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#71717A',
    padding: '0.35rem 0.75rem',
    borderRadius: '4px',
    fontSize: '0.8125rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  langSubBtnActive: {
    backgroundColor: '#27272A',
    color: '#FAFAFA',
    fontWeight: '600',
  },
  dailyCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '8px',
    padding: '1.25rem',
    marginBottom: '0.5rem',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    marginTop: '0.15rem',
  },
  dailyLabel: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#F59E0B',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  dailyDescription: {
    fontSize: '0.8125rem',
    color: '#D4D4D8',
    margin: '0.25rem 0 0 0',
  },
  addCaseBtn: {
    backgroundColor: '#27272A',
    border: '1px solid #3F3F46',
    color: '#FAFAFA',
    padding: '0.4rem 0.85rem',
    borderRadius: '6px',
    fontSize: '0.8125rem',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  testCasesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  testCaseItem: {
    backgroundColor: '#141416',
    border: '1px solid #27272A',
    borderRadius: '8px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  testCaseItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #202024',
    paddingBottom: '0.5rem',
  },
  caseBadge: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  },
  hiddenCheckboxLabel: {
    fontSize: '0.75rem',
    color: '#A1A1AA',
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    cursor: 'pointer',
  },
  deleteCaseBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#EF4444',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
  },
  footer: {
    padding: '1.25rem 1.75rem',
    borderTop: '1px solid #27272A',
    backgroundColor: '#1F1F23',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: '#27272A',
    border: '1px solid #3F3F46',
    color: '#FAFAFA',
    padding: '0.5rem 1.25rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    border: '1px solid #27272A',
    color: '#A1A1AA',
    padding: '0.5rem 1.25rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#A1A1AA',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  publishBtn: {
    backgroundColor: '#10B981',
    border: 'none',
    color: '#FFF',
    padding: '0.55rem 1.5rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
};
