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
      color: 'var(--accent-purple)',
    },
    {
      icon: FiCode,
      title: 'Interactive Coding Playground',
      desc: 'Practice programming in an integrated Monaco Editor with multi-language runtimes and real-time test verification.',
      color: 'var(--accent-emerald)',
    },
    {
      icon: FiCheckSquare,
      title: 'Smart Quizzes',
      desc: 'Assess your skills with dynamic MCQs, programming validation, automatic evaluation, and time-limited tracking.',
      color: 'var(--accent-amber)',
    },
    {
      icon: FiAward,
      title: 'Verified Certificates',
      desc: 'Earn secure PDF course certificates featuring verifiable QR codes to showcase your achievements.',
      color: 'var(--accent-amber)',
    },
    {
      icon: FiTrendingUp,
      title: 'Learning Analytics',
      desc: 'Monitor study time, daily streaks, quiz accuracies, and pinpoint weak topics using dashboards.',
      color: 'var(--accent-rose)',
    },
    {
      icon: FiBookOpen,
      title: 'AI Flashcards & Notes',
      desc: 'Instantly generate high-quality markdown notes and active-recall flashcards from course lectures.',
      color: 'var(--accent-cyan)',
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

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      {/* Hero Section */}
      <section
        style={{
          padding: 'clamp(3rem, 6vw, 5rem) 1.5rem clamp(2.5rem, 5vw, 4rem)',
          textAlign: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.25rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: '1.25rem',
            }}
          >
            Learn Smarter with{' '}
            <span style={{ color: 'var(--accent-primary)' }}>AI-Powered</span>{' '}
            Education
          </h1>
          <p
            style={{
              fontSize: 'clamp(0.95rem, 1.5vw, 1.0625rem)',
              color: 'var(--text-secondary)',
              lineHeight: 1.65,
              maxWidth: '680px',
              margin: '0 auto 2rem',
            }}
          >
            A comprehensive, developer-focused platform combining curriculum lectures,
            hands-on coding practice, dynamic quizzes, and an always-available AI tutor.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to={isAuthenticated ? '/dashboard' : '/signup'}
              className="btn btn-primary btn-lg"
              style={{ gap: '0.5rem' }}
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
              <FiArrowRight size={16} />
            </Link>
            <Link
              to="/courses"
              className="btn btn-secondary btn-lg"
            >
              Explore Courses
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ padding: 'clamp(3rem, 5vw, 4.5rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, letterSpacing: '-0.015em', marginBottom: '0.5rem' }}>
            Key Features
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto' }}>
            Everything you need to master modern software engineering concepts.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="card"
              style={{
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-hover)',
                  border: '1px solid var(--border-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: feature.color,
                }}
              >
                <feature.icon size={22} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{feature.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-primary)',
          borderBottom: '1px solid var(--border-primary)',
          padding: 'clamp(2rem, 4vw, 3rem) 1.5rem',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '2rem',
            textAlign: 'center',
          }}
        >
          {[
            { value: '10,000+', label: 'Active Students' },
            { value: `${realStats.coursesCount}+`, label: 'Total Courses' },
            { value: '98%', label: 'Completion Rate' },
            { value: `${realStats.problemsCount}+`, label: 'Coding Challenges' },
          ].map((stat, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span
                style={{
                  fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
                  fontWeight: 800,
                  color: 'var(--accent-primary)',
                  letterSpacing: '-0.02em',
                }}
              >
                {stat.value}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section style={{ padding: 'clamp(3rem, 5vw, 4.5rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, letterSpacing: '-0.015em', marginBottom: '0.5rem' }}>
            How It Works
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto' }}>
            Three simple steps to accelerate your programming career.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="card"
              style={{
                padding: '2rem 1.5rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.85rem',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {step.num}
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>{step.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ padding: '2rem 1.5rem clamp(3rem, 5vw, 4.5rem)', maxWidth: '1200px', margin: '0 auto' }}>
        <div
          className="card"
          style={{
            padding: 'clamp(2rem, 4vw, 3.5rem) 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
              fontWeight: 800,
              marginBottom: '0.75rem',
              letterSpacing: '-0.015em',
            }}
          >
            Ready to Transform Your Learning?
          </h2>
          <p
            style={{
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              maxWidth: '540px',
              lineHeight: 1.6,
              marginBottom: '2rem',
            }}
          >
            Create your free account today and start mastering software development.
          </p>
          <Link
            to={isAuthenticated ? '/dashboard' : '/signup'}
            className="btn btn-primary btn-lg"
            style={{ gap: '0.5rem' }}
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Start Learning for Free'}
            <FiArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
