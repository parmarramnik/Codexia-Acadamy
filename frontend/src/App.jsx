import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useTheme } from './context/ThemeContext';

/* Query & Notification Providers */
import QueryProvider from './context/QueryProvider';
import { NotificationProvider } from './context/NotificationContext';

/* Layouts & Common */
import MainLayout from './components/layout/MainLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import PageLoader from './components/common/PageLoader';

/* Lazy Loaded Public Pages (Code Splitting for Ultra Fast Initial Load) */
const Landing = lazy(() => import('./pages/Landing'));
const About = lazy(() => import('./pages/About'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Contact = lazy(() => import('./pages/Contact'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseDetails = lazy(() => import('./pages/CourseDetails'));

/* Lazy Loaded Verification & Public Standalone Pages */
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate'));
const VerifyCertificatePublic = lazy(() => import('./pages/VerifyCertificatePublic'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));

/* Lazy Loaded Protected Student & Platform Pages */
const Dashboard = lazy(() => import('./pages/Dashboard'));
const VideoPlayer = lazy(() => import('./pages/VideoPlayer'));
const QuizHub = lazy(() => import('./pages/QuizHub'));
const Quiz = lazy(() => import('./pages/Quiz'));
const ProblemSetHub = lazy(() => import('./pages/ProblemSetHub'));
const CodingPractice = lazy(() => import('./pages/CodingPractice'));
const Notes = lazy(() => import('./pages/Notes'));
const Flashcards = lazy(() => import('./pages/Flashcards'));
const AITutor = lazy(() => import('./pages/AITutor'));
const Certificates = lazy(() => import('./pages/Certificates'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const DiscussionForum = lazy(() => import('./pages/DiscussionForum'));
const EnterpriseAI = lazy(() => import('./pages/EnterpriseAI'));

/* Lazy Loaded Role-Specific Portals */
const InstructorDashboard = lazy(() => import('./pages/InstructorDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminPortal = lazy(() => import('./pages/AdminPortal'));

function AppContent() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2500,
          style: {
            background: isDark ? '#1D222E' : '#FFFFFF',
            color: isDark ? '#F8FAFC' : '#0F172A',
            border: `1px solid ${isDark ? '#283040' : '#E2E8F0'}`,
            borderRadius: '10px',
            fontSize: '0.875rem',
            boxShadow: isDark
              ? '0 8px 24px rgba(0, 0, 0, 0.4)'
              : '0 8px 24px rgba(0, 0, 0, 0.1)',
          },
          success: {
            iconTheme: { primary: '#10B981', secondary: isDark ? '#1D222E' : '#FFFFFF' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: isDark ? '#1D222E' : '#FFFFFF' },
          },
        }}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes with main layout */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>

          {/* Public standalone verification pages */}
          <Route path="/verify/:uid" element={<VerifyCertificate />} />
          <Route path="/verify-public/:uid" element={<VerifyCertificatePublic />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/verify-otp" element={<VerifyEmail />} />

          {/* Protected routes with dashboard layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:slug" element={<CourseDetails />} />
              <Route path="/my-courses" element={<Courses />} />
              <Route path="/courses/:slug/learn/:lectureId" element={<VideoPlayer />} />
              <Route path="/quizzes" element={<QuizHub />} />
              <Route path="/quizzes/:id" element={<Quiz />} />
              <Route path="/coding" element={<ProblemSetHub />} />
              <Route path="/coding/:slug" element={<CodingPractice />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/ai-tutor" element={<AITutor />} />
              <Route path="/certificates" element={<Certificates />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/discussion" element={<DiscussionForum />} />
              <Route path="/ai-workspace" element={<EnterpriseAI />} />
            </Route>
          </Route>

          {/* Instructor restricted routes */}
          <Route element={<ProtectedRoute allowedRoles={['instructor', 'admin', 'super_admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/instructor" element={<InstructorDashboard />} />
            </Route>
          </Route>

          {/* Admin restricted routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'super_admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>
          </Route>

          {/* Super Admin exclusive routes */}
          <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/admin-portal" element={<AdminPortal />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

function App() {
  return (
    <QueryProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </QueryProvider>
  );
}

export default App;
