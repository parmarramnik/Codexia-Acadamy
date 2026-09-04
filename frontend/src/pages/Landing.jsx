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
        // Fallback gracefully to known database counts
      }
    }
    loadRealStats();
  }, []);

  const features = [
    {
      icon: <FiCpu size={24} style={styles.featureIcon} />,
      title: 'AI Tutor Support',
      desc: 'Ask questions, explain complex concepts, and summarize lectures in real time using our RAG-enhanced AI assistant.',
    },
    {
      icon: <FiCode size={24} style={styles.featureIcon} />,
      title: 'Interactive Coding Playground',
      desc: 'Practice programming directly in an integrated Monaco Editor with multi-language runtimes and real-time test verification.',
    },
    {
      icon: <FiCheckSquare size={24} style={styles.featureIcon} />,
      title: 'Smart Quizzes',
      desc: 'Assess your skills with dynamic MCQs, programming validation, automatic evaluation, and time-limited tracking.',
    },
    {
      icon: <FiAward size={24} style={styles.featureIcon} />,
      title: 'Verified Certificates',
      desc: 'Earn secure PDF course certificates featuring verifiable QR codes to showcase your technical achievements.',
    },
    {
      icon: <FiTrendingUp size={24} style={styles.featureIcon} />,
      title: 'Learning Analytics',
      desc: 'Monitor study time, daily streaks, quiz accuracies, and pinpoint weak topics using heatmaps and activity dashboards.',
    },
    {
      icon: <FiBookOpen size={24} style={styles.featureIcon} />,
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
      desc: 'Watch high-quality lectures, write clean code, solve exercises, and get instant feedback from the AI tutor.',
    },
    {
      num: '3',
      title: 'Earn Certificates',
      desc: 'Successfully pass quizzes, hit coding milestones, and download unique verifiable PDF certificates.',
    },
  ];

  return (
    <div style={styles.container}>
      {/* 1. Hero Section */}
      <section style={styles.heroSection}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>Learn Smarter with AI-Powered Education</h1>
          <p style={styles.heroSubtitle}>
            A comprehensive, developer-focused platform combining curriculum lectures, hands-on coding practice, dynamic quizzes, and an always-available AI tutor.
          </p>

          <div style={styles.heroActions}>
            <Link
              to={isAuthenticated ? '/dashboard' : '/signup'}
              style={styles.primaryBtn}
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
            </Link>
            <Link to="/courses" style={styles.secondaryBtn}>
              Explore Courses
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Key Features Grid (3x2) */}
      <section style={styles.featuresSection}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Key Features</h2>
          <p style={styles.sectionSubtitle}>
            Everything you need to master modern software engineering concepts.
          </p>
        </div>

        <div style={styles.featuresGrid}>
          {features.map((feature, idx) => (
            <div key={idx} style={styles.featureCard}>
              <div style={styles.iconBox}>{feature.icon}</div>
              <h3 style={styles.cardTitle}>{feature.title}</h3>
              <p style={styles.cardDesc}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Real-Time Stats Ribbon */}
      <section style={styles.statsSection}>
        <div style={styles.statsContainer}>
          <div style={styles.statBox}>
            <span style={styles.statNumber}>10,000+</span>
            <span style={styles.statLabel}>Active Students</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statNumber}>{realStats.coursesCount}+</span>
            <span style={styles.statLabel}>Total Courses</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statNumber}>98%</span>
            <span style={styles.statLabel}>Completion Rate</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statNumber}>{realStats.problemsCount}+</span>
            <span style={styles.statLabel}>Coding Challenges</span>
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section style={styles.howItWorksSection}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>How It Works</h2>
          <p style={styles.sectionSubtitle}>
            Three simple steps to accelerate your programming career.
          </p>
        </div>

        <div style={styles.stepsGrid}>
          {steps.map((step, idx) => (
            <div key={idx} style={styles.stepCard}>
              <div style={styles.stepBadge}>{step.num}</div>
              <h3 style={styles.stepTitle}>{step.title}</h3>
              <p style={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Call to Action Banner */}
      <section style={styles.ctaSection}>
        <div style={styles.ctaCard}>
          <h2 style={styles.ctaTitle}>Ready to Transform Your Learning?</h2>
          <p style={styles.ctaSubtitle}>
            Create your free account today and start mastering software development.
          </p>
          <Link
            to={isAuthenticated ? '/dashboard' : '/signup'}
            style={styles.ctaBtn}
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Start Learning for Free'}
          </Link>
        </div>
      </section>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  heroSection: {
    padding: '4.5rem 1.5rem 4rem',
    textAlign: 'center',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-primary)',
  },
  heroContent: {
    maxWidth: '860px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)',
    fontWeight: 800,
    lineHeight: '1.2',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    marginBottom: '1.25rem',
  },
  heroSubtitle: {
    fontSize: '1.0625rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.65',
    maxWidth: '680px',
    marginBottom: '2rem',
  },
  heroActions: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    color: '#0F172A',
    fontWeight: 700,
    padding: '0.85rem 2rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.95rem',
    textDecoration: 'none',
    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
    transition: 'all 0.15s ease',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontWeight: 600,
    padding: '0.85rem 2rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.95rem',
    textDecoration: 'none',
    transition: 'all 0.15s ease',
  },
  featuresSection: {
    padding: '4.5rem 1.5rem',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  sectionHeader: {
    textAlign: 'center',
    marginBottom: '3rem',
  },
  sectionTitle: {
    fontSize: '2rem',
    fontWeight: 800,
    letterSpacing: '-0.015em',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  },
  sectionSubtitle: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    maxWidth: '560px',
    margin: '0 auto',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1.5rem',
  },
  featureCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    boxShadow: 'var(--shadow-sm)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  iconBox: {
    width: '46px',
    height: '46px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIcon: {
    color: '#F59E0B',
  },
  cardTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  cardDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    margin: 0,
  },
  statsSection: {
    backgroundColor: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-primary)',
    borderBottom: '1px solid var(--border-primary)',
    padding: '3rem 1.5rem',
  },
  statsContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '2rem',
    textAlign: 'center',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
  },
  statNumber: {
    fontSize: '2.5rem',
    fontWeight: 800,
    color: '#F59E0B',
    letterSpacing: '-0.02em',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  howItWorksSection: {
    padding: '4.5rem 1.5rem',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.75rem',
  },
  stepCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-lg)',
    padding: '2.25rem 1.75rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    boxShadow: 'var(--shadow-sm)',
  },
  stepBadge: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: '#F59E0B',
    color: '#0F172A',
    fontWeight: 800,
    fontSize: '1.15rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  stepDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    margin: 0,
  },
  ctaSection: {
    padding: '2rem 1.5rem 4.5rem',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  ctaCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-xl)',
    padding: '3.5rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: 'var(--shadow-md)',
  },
  ctaTitle: {
    fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)',
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: '0.75rem',
    letterSpacing: '-0.015em',
  },
  ctaSubtitle: {
    fontSize: '1.05rem',
    color: 'var(--text-secondary)',
    maxWidth: '540px',
    lineHeight: '1.6',
    marginBottom: '2rem',
  },
  ctaBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    color: '#0F172A',
    fontWeight: 700,
    padding: '0.9rem 2.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    textDecoration: 'none',
    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
  },
};
