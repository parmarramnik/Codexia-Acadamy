/**
 * TanStack Query hooks for client-side data caching and instant UI transitions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

/* ==========================================================================
   Courses Queries & Mutations
   ========================================================================== */

export function useCourses(filters = {}) {
  const { page = 1, pageSize = 20, category, difficulty, search } = filters;
  return useQuery({
    queryKey: ['courses', { page, pageSize, category, difficulty, search }],
    queryFn: async () => {
      const params = new URLSearchParams({ page, page_size: pageSize });
      if (category) params.append('category', category);
      if (difficulty) params.append('difficulty', difficulty);
      if (search) params.append('search', search);

      const response = await api.get(`/courses?${params.toString()}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes fresh
  });
}

export function useCourse(slugOrId) {
  return useQuery({
    queryKey: ['course', slugOrId],
    queryFn: async () => {
      const response = await api.get(`/courses/${slugOrId}`);
      return response.data;
    },
    enabled: !!slugOrId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useMyEnrollments() {
  return useQuery({
    queryKey: ['my-enrollments'],
    queryFn: async () => {
      const response = await api.get('/courses/enrolled/me');
      return response.data || [];
    },
    staleTime: 1000 * 60 * 3,
  });
}

/* ==========================================================================
   Coding Practice & Hub Queries
   ========================================================================== */

export function useCodingProblems(filters = {}) {
  const { page = 1, pageSize = 100, difficulty, search } = filters;
  return useQuery({
    queryKey: ['coding-problems', { page, pageSize, difficulty, search }],
    queryFn: async () => {
      const params = new URLSearchParams({ page, page_size: pageSize });
      if (difficulty) params.append('difficulty', difficulty);
      if (search) params.append('search', search);

      const response = await api.get(`/coding/problems?${params.toString()}`);
      return response.data?.items || response.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCodingProblem(slugOrId) {
  return useQuery({
    queryKey: ['coding-problem', slugOrId],
    queryFn: async () => {
      const response = await api.get(`/coding/problems/${slugOrId}`);
      return response.data;
    },
    enabled: !!slugOrId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useDailyChallenge() {
  return useQuery({
    queryKey: ['coding-daily-challenge'],
    queryFn: async () => {
      const response = await api.get('/coding/daily-challenge');
      return response.data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useCodingStats() {
  return useQuery({
    queryKey: ['coding-statistics'],
    queryFn: async () => {
      const response = await api.get('/coding/statistics');
      return response.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

/* ==========================================================================
   Quizzes Queries
   ========================================================================== */

export function useQuizzes() {
  return useQuery({
    queryKey: ['quizzes-list'],
    queryFn: async () => {
      const response = await api.get('/quizzes');
      return Array.isArray(response.data) ? response.data : (response.data?.items || []);
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useQuiz(quizId) {
  return useQuery({
    queryKey: ['quiz-detail', quizId],
    queryFn: async () => {
      const response = await api.get(`/quizzes/${quizId}`);
      return response.data;
    },
    enabled: !!quizId,
    staleTime: 1000 * 60 * 10,
  });
}

/* ==========================================================================
   Dashboard & Analytics Queries
   ========================================================================== */

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/analytics/dashboard');
      return response.data;
    },
    staleTime: 1000 * 60 * 3, // 3 minutes fresh cache
  });
}

export function useStudentAnalytics() {
  return useQuery({
    queryKey: ['student-analytics'],
    queryFn: async () => {
      const response = await api.get('/analytics/student');
      return response.data;
    },
    staleTime: 1000 * 60 * 3,
  });
}

export function useStudySessions(days = 30) {
  return useQuery({
    queryKey: ['study-sessions', days],
    queryFn: async () => {
      const response = await api.get(`/analytics/sessions?days=${days}`);
      return response.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await api.get('/analytics/leaderboard');
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/* ==========================================================================
   Notes Queries
   ========================================================================== */

export function useNotes(filters = {}) {
  const { courseId, bookmarked, search } = filters;
  return useQuery({
    queryKey: ['notes', { courseId, bookmarked, search }],
    queryFn: async () => {
      const params = {};
      if (courseId) params.course_id = courseId;
      if (bookmarked) params.bookmarked = true;
      if (search) params.search = search;
      const response = await api.get('/notes', { params });
      return Array.isArray(response.data) ? response.data : [];
    },
    staleTime: 1000 * 60 * 3,
  });
}

/* ==========================================================================
   Flashcards Queries
   ========================================================================== */

export function useFlashcards(courseId = null) {
  return useQuery({
    queryKey: ['flashcards', { courseId }],
    queryFn: async () => {
      const params = {};
      if (courseId) params.course_id = courseId;
      const response = await api.get('/flashcards', { params });
      return Array.isArray(response.data) ? response.data : [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

/* ==========================================================================
   Certificates Queries
   ========================================================================== */

export function useCertificates() {
  return useQuery({
    queryKey: ['my-certificates'],
    queryFn: async () => {
      const response = await api.get('/certificates');
      return Array.isArray(response.data) ? response.data : [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

/* ==========================================================================
   Admin Portal Queries & Cache Invalidation Helper
   ========================================================================== */

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/dashboard/stats');
      return response.data;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useSystemSettings() {
  return useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const response = await api.get('/admin/settings');
      return response.data;
    },
    staleTime: 1000 * 60 * 15,
  });
}

export function useInvalidateCache() {
  const queryClient = useQueryClient();
  return {
    invalidateCourses: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
    invalidateEnrollments: () => queryClient.invalidateQueries({ queryKey: ['my-enrollments'] }),
    invalidateProblems: () => queryClient.invalidateQueries({ queryKey: ['coding-problems'] }),
    invalidateDailyChallenge: () => queryClient.invalidateQueries({ queryKey: ['coding-daily-challenge'] }),
    invalidateQuizzes: () => queryClient.invalidateQueries({ queryKey: ['quizzes-list'] }),
    invalidateQuizDetail: (id) => queryClient.invalidateQueries({ queryKey: ['quiz-detail', id] }),
    invalidateDashboard: () => queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
    invalidateAnalytics: () => {
      queryClient.invalidateQueries({ queryKey: ['student-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['study-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    invalidateNotes: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
    invalidateFlashcards: () => queryClient.invalidateQueries({ queryKey: ['flashcards'] }),
    invalidateCertificates: () => queryClient.invalidateQueries({ queryKey: ['my-certificates'] }),
  };
}
