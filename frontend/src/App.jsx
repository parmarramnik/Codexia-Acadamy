import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

/* Layout */
import MainLayout from './components/layout/MainLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/common/ProtectedRoute';

/* Public Pages */
import Landing from './pages/Landing';
import About from './pages/About';
import Pricing from './pages/Pricing';
import Contact from './pages/Contact';
import FAQ from './pages/FAQ';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';

/* Protected Pages */
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import CourseDetails from './pages/CourseDetails';
import VideoPlayer from './pages/VideoPlayer';
import Quiz from './pages/Quiz';
import CodingPractice from './pages/CodingPractice';
import Notes from './pages/Notes';
import Flashcards from './pages/Flashcards';
import AITutor from './pages/AITutor';
import Certificates from './pages/Certificates';
import Analytics from './pages/Analytics';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import InstructorDashboard from './pages/InstructorDashboard';
import VerifyCertificate from './pages/VerifyCertificate';
import CareerDashboard from './pages/CareerDashboard';
import StudyPlanner from './pages/StudyPlanner';
import DiscussionForum from './pages/DiscussionForum';
import VerifyCertificatePublic from './pages/VerifyCertificatePublic';
import EnterpriseAI from './pages/EnterpriseAI';
import AdminPortal from './pages/AdminPortal';
import VerifyEmail from './pages/VerifyEmail';
import PublicPortfolio from './pages/PublicPortfolio';


function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#2D2D2D',
            color: '#F5F5F5',
            border: '1px solid #3C3C3C',
          },
        }}
      />
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
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:slug" element={<CourseDetails />} />
        </Route>

        {/* Public standalone verification & portfolio pages */}
        <Route path="/verify/:uid" element={<VerifyCertificate />} />
        <Route path="/verify-public/:uid" element={<VerifyCertificatePublic />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/portfolio/:userId" element={<PublicPortfolio />} />

        {/* Protected routes with dashboard layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/my-courses" element={<Courses />} />
            <Route path="/courses/:slug/learn/:lectureId" element={<VideoPlayer />} />
            <Route path="/quizzes/:id" element={<Quiz />} />
            <Route path="/coding" element={<CodingPractice />} />
            <Route path="/coding/:slug" element={<CodingPractice />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/ai-tutor" element={<AITutor />} />
            <Route path="/certificates" element={<Certificates />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/career" element={<CareerDashboard />} />
            <Route path="/planner" element={<StudyPlanner />} />
            <Route path="/discussion" element={<DiscussionForum />} />
            <Route path="/ai-workspace" element={<EnterpriseAI />} />
            <Route path="/admin-portal" element={<AdminPortal />} />

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
      </Routes>
    </Router>
  );
}

export default App;
