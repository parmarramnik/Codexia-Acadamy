import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  FiCode,
  FiCpu,
  FiAward,
  FiTrendingUp,
  FiCheckSquare,
  FiBookOpen,
  FiArrowRight,
} from 'react-icons/fi';
import '../styles/pages/landing.css';

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [realStats, setRealStats] = useState({
    coursesCount: 7,
    problemsCount: 15,
  });

  useEffect(() => {
    async function loadRealStats() {
      try {
        const [coursesRes, problemsRes] = await Promise.allSettled([
          api.get('/courses'),
          api.get('/coding/problems'),
        ]);

        const countCourses =
          coursesRes.status === 'fulfilled' && Array.isArray(coursesRes.value.data)
            ? coursesRes.value.data.length
            : 7;

        let countProblems = 15;
        if (problemsRes.status === 'fulfilled' && problemsRes.value.data) {
          const pData = problemsRes.value.data;
          countProblems = Array.isArray(pData)
            ? pData.length
            : Array.isArray(pData.items)
            ? pData.items.length
            : 15;
        }

        setRealStats({
          coursesCount: countCourses,
          problemsCount: countProblems,
        });
      } catch {
        // Fallback gracefully
      }
    }
    loadRealStats();
  }, []);

  const features = [
    {
      icon: FiCpu,
      title: 'AI Tutor Support',
      desc: 'Ask questions, explain complex concepts, and summarize lectures in real time using our RAG-enhanced AI assistant.',
    },
    {
      icon: FiCode,
      title: 'Interactive Coding Playground',
      desc: 'Practice programming in an integrated Monaco Editor with multi-language runtimes and real-time test verification.',
    },
    {
      icon: FiCheckSquare,
      title: 'Smart Quizzes',
      desc: 'Assess your skills with dynamic MCQs, programming validation, automatic evaluation, and time-limited tracking.',
    },
    {
      icon: FiAward,
      title: 'Verified Certificates',
      desc: 'Earn secure PDF course certificates featuring verifiable QR codes to showcase your achievements.',
    },
    {
      icon: FiTrendingUp,
      title: 'Learning Analytics',
      desc: 'Monitor study time, daily streaks, quiz accuracies, and pinpoint weak topics using dashboards.',
    },
    {
      icon: FiBookOpen,
      title: 'AI Flashcards & Notes',
      desc: 'Instantly generate high-quality markdown notes and active-recall flashcards from course lectures.',
    },
  ];

  const steps = [
    {
      num: '1',
      title: 'Enroll in a Course',
      desc: 'Select from our curated syllabus covering DSA, Web Development, Cloud, and Machine Learning.',
    },
    {
      num: '2',
      title: 'Learn & Practice',
      desc: 'Watch lectures, write code, solve exercises, and get instant feedback from the AI tutor.',
    },
    {
      num: '3',
      title: 'Earn Certificates',
      desc: 'Pass quizzes, hit coding milestones, and download unique verifiable PDF certificates.',
    },
  ];

  const ctaTo = isAuthenticated ? '/dashboard' : '/signup';

  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <span className="landing-pill">
            <span className="landing-pill-dot" aria-hidden="true" />
            AI mentorship for software engineers
          </span>
          <h1 className="landing-title">
            Learn smarter with <span className="landing-title-accent">AI-powered</span> education
          </h1>
          <p className="landing-lead">
            A comprehensive, developer-focused platform combining curriculum lectures,
            hands-on coding practice, dynamic quizzes, and an always-available AI tutor.
          </p>

          <div className="landing-cta-row">
            <Link to={ctaTo} className="btn btn-primary btn-lg">
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
              <FiArrowRight size={16} />
            </Link>
            <Link to="/courses" className="btn btn-secondary btn-lg">
              Explore Courses
            </Link>
          </div>
        </div>

        {/* Product preview */}
        <div className="landing-preview" aria-hidden="true">
          <div className="landing-preview-bar">
            <span /><span /><span />
            <em>two_sum.py</em>
          </div>
          <div className="landing-preview-body">
            <pre className="landing-code">
<span className="tok-k">class</span> <span className="tok-f">Solution</span>:{'\n'}
{'    '}<span className="tok-k">def</span> <span className="tok-f">twoSum</span>(self, nums, target):{'\n'}
{'        '}seen = {'{}'}{'\n'}
{'        '}<span className="tok-k">for</span> i, n <span className="tok-k">in</span> enumerate(nums):{'\n'}
{'            '}<span className="tok-k">if</span> target - n <span className="tok-k">in</span> seen:{'\n'}
{'                '}<span className="tok-k">return</span> [seen[target - n], i]{'\n'}
{'            '}seen[n] = i
            </pre>
            <div className="landing-preview-side">
              <div className="landing-preview-chip success">✓ 12 / 12 tests passed</div>
              <div className="landing-preview-ai">
                <span className="landing-preview-ai-head"><FiCpu size={13} /> AI Tutor</span>
                <p>Nice — a hash map turns this into a single pass. Time complexity is <code>O(n)</code>.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="landing-stats">
        {[
          { value: '10,000+', label: 'Active Students' },
          { value: `${realStats.coursesCount}+`, label: 'Total Courses' },
          { value: '98%', label: 'Completion Rate' },
          { value: `${realStats.problemsCount}+`, label: 'Coding Challenges' },
        ].map((stat) => (
          <div key={stat.label} className="landing-stat">
            <span className="landing-stat-value">{stat.value}</span>
            <span className="landing-stat-label">{stat.label}</span>
          </div>
        ))}
      </section>

      {/* Features */}
      <section className="landing-section">
        <div className="landing-section-head">
          <span className="page-eyebrow">Platform</span>
          <h2 className="landing-h2">Key features</h2>
          <p className="landing-sub">Everything you need to master modern software engineering concepts.</p>
        </div>

        <div className="landing-features">
          {features.map((feature) => (
            <div key={feature.title} className="landing-feature">
              <span className="landing-feature-icon"><feature.icon size={18} /></span>
              <h3 className="landing-feature-title">{feature.title}</h3>
              <p className="landing-feature-desc">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section">
        <div className="landing-section-head">
          <span className="page-eyebrow">Workflow</span>
          <h2 className="landing-h2">How it works</h2>
          <p className="landing-sub">Three simple steps to accelerate your programming career.</p>
        </div>

        <ol className="landing-steps">
          {steps.map((step) => (
            <li key={step.num} className="landing-step">
              <span className="landing-step-num">{step.num}</span>
              <h3 className="landing-feature-title">{step.title}</h3>
              <p className="landing-feature-desc">{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div className="landing-cta">
          <h2 className="landing-h2">Ready to transform your learning?</h2>
          <p className="landing-sub">Create your free account today and start mastering software development.</p>
          <Link to={ctaTo} className="btn btn-primary btn-lg" style={{ marginTop: '1.75rem' }}>
            {isAuthenticated ? 'Go to Dashboard' : 'Start Learning for Free'}
            <FiArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
