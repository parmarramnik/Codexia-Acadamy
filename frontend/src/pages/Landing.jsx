import { Link } from 'react-router-dom';
import { FiCode, FiCpu, FiAward, FiTrendingUp, FiCheckSquare, FiBookOpen } from 'react-icons/fi';

export default function Landing() {
  const features = [
    {
      icon: <FiCpu size={24} style={styles.featureIcon} />,
      title: 'AI Tutor Support',
      desc: 'Ask questions, explain complex concepts, and summarize lectures in real time using our RAG-enhanced AI assistant.'
    },
    {
      icon: <FiCode size={24} style={styles.featureIcon} />,
      title: 'Interactive Coding Playground',
      desc: 'Practice programming directly in an integrated Monaco Editor with multi-language runtimes and real-time test verification.'
    },
    {
      icon: <FiCheckSquare size={24} style={styles.featureIcon} />,
      title: 'Smart Quizzes',
      desc: 'Assess your skills with dynamic MCQs, programming validation, automatic evaluation, and time-limited tracking.'
    },
    {
      icon: <FiAward size={24} style={styles.featureIcon} />,
      title: 'Verified Certificates',
      desc: 'Earn secure PDF course certificates featuring verifiable QR codes to showcase your technical achievements.'
    },
    {
      icon: <FiTrendingUp size={24} style={styles.featureIcon} />,
      title: 'Learning Analytics',
      desc: 'Monitor study time, daily streaks, quiz accuracies, and pinpoint weak topics using heatmaps and activity dashboards.'
    },
    {
      icon: <FiBookOpen size={24} style={styles.featureIcon} />,
      title: 'AI Flashcards & Notes',
      desc: 'Instantly generate high-quality markdown notes and active-recall flashcards from course lectures.'
    }
  ];

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>Learn Smarter with AI-Powered Education</h1>
          <p style={styles.heroSubtitle}>
            A comprehensive, developer-focused platform combining curriculum lectures, hands-on coding practice, dynamic quizzes, and an always-available AI tutor.
          </p>
          <div style={styles.heroActions}>
            <Link to="/signup" style={styles.primaryBtn}>Get Started Free</Link>
            <Link to="/courses" style={styles.secondaryBtn}>Explore Courses</Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section style={styles.featuresSection}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Key Features</h2>
          <p style={styles.sectionSubtitle}>Everything you need to master modern software engineering concepts.</p>
        </div>
        <div style={styles.grid}>
          {features.map((feature, idx) => (
            <div key={idx} style={styles.card}>
              <div style={styles.iconWrapper}>{feature.icon}</div>
              <h3 style={styles.cardTitle}>{feature.title}</h3>
              <p style={styles.cardDesc}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Counter Section */}
      <section style={styles.statsSection}>
        <div style={styles.statsContainer}>
          <div style={styles.statBox}>
            <h4 style={styles.statNumber}>10,000+</h4>
            <p style={styles.statLabel}>Active Students</p>
          </div>
          <div style={styles.statBox}>
            <h4 style={styles.statNumber}>500+</h4>
            <p style={styles.statLabel}>Total Courses</p>
          </div>
          <div style={styles.statBox}>
            <h4 style={styles.statNumber}>95%</h4>
            <p style={styles.statLabel}>Completion Rate</p>
          </div>
          <div style={styles.statBox}>
            <h4 style={styles.statNumber}>50+</h4>
            <p style={styles.statLabel}>Expert Instructors</p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section style={styles.howItWorksSection}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>How It Works</h2>
          <p style={styles.sectionSubtitle}>Three simple steps to accelerate your programming career.</p>
        </div>
        <div style={styles.stepsContainer}>
          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>1</div>
            <h3 style={styles.stepTitle}>Enroll in a Course</h3>
            <p style={styles.stepDesc}>Select from our curated syllabus covering DSA, Web Development, Cloud, and Machine Learning.</p>
          </div>
          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>2</div>
            <h3 style={styles.stepTitle}>Learn & Practice</h3>
            <p style={styles.stepDesc}>Watch high-quality lectures, write clean code, solve exercises, and get instant feedback from the AI tutor.</p>
          </div>
          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>3</div>
            <h3 style={styles.stepTitle}>Earn Certificates</h3>
            <p style={styles.stepDesc}>Successfully pass quizzes, hit coding milestones, and download unique verifiable PDF certificates.</p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section style={styles.ctaSection}>
        <h2 style={styles.ctaTitle}>Ready to Transform Your Learning?</h2>
        <p style={styles.ctaText}>Create your free account today and start mastering software development.</p>
        <Link to="/signup" style={styles.ctaBtn}>Start Learning for Free</Link>
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
  hero: {
    padding: '6rem 2rem',
    textAlign: 'center',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-primary)',
  },
  heroContent: {
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
  },
  heroTitle: {
    fontSize: '3rem',
    fontWeight: 'var(--fw-bold)',
    lineHeight: '1.2',
    color: 'var(--text-primary)',
  },
  heroSubtitle: {
    fontSize: '1.125rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    maxWidth: '650px',
  },
  heroActions: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem',
  },
  primaryBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.875rem 1.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    transition: 'background-color var(--transition-fast)',
  },
  secondaryBtn: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    padding: '0.875rem 1.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
  },
  featuresSection: {
    padding: '5rem 2rem',
    maxWidth: 'var(--max-content-width)',
    margin: '0 auto',
    width: '100%',
  },
  sectionHeader: {
    textAlign: 'center',
    marginBottom: '3.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  sectionTitle: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-semibold)',
  },
  sectionSubtitle: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    transition: 'all var(--transition-fast)',
  },
  iconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIcon: {
    color: 'var(--accent-primary)',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-medium)',
  },
  cardDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  statsSection: {
    backgroundColor: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-primary)',
    borderBottom: '1px solid var(--border-primary)',
    padding: '3rem 2rem',
  },
  statsContainer: {
    maxWidth: 'var(--max-content-width)',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '2rem',
    textAlign: 'center',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  statNumber: {
    fontSize: '2.5rem',
    fontWeight: 'var(--fw-bold)',
    color: 'var(--accent-primary)',
  },
  statLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  howItWorksSection: {
    padding: '5rem 2rem',
    maxWidth: 'var(--max-content-width)',
    margin: '0 auto',
    width: '100%',
  },
  stepsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '2rem',
    marginTop: '2rem',
  },
  stepCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2.5rem 2rem',
    textAlign: 'center',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  stepNumber: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-bold)',
    fontSize: '1.125rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-medium)',
  },
  stepDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  ctaSection: {
    backgroundColor: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-primary)',
    padding: '5rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
  },
  ctaTitle: {
    fontSize: '2.25rem',
    fontWeight: 'var(--fw-semibold)',
  },
  ctaText: {
    fontSize: '1.125rem',
    color: 'var(--text-secondary)',
    maxWidth: '500px',
  },
  ctaBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.875rem 2rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    transition: 'background-color var(--transition-fast)',
  }
};
