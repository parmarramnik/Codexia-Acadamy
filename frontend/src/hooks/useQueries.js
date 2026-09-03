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
      return response.data;
    },
    staleTime: 1000 * 60 * 3,
  });
}

/* ==========================================================================
   Coding Practice Queries
   ========================================================================== */

export function useCodingProblems(filters = {}) {
  const { page = 1, pageSize = 20, difficulty, search } = filters;
  return useQuery({
    queryKey: ['coding-problems', { page, pageSize, difficulty, search }],
    queryFn: async () => {
      const params = new URLSearchParams({ page, page_size: pageSize });
      if (difficulty) params.append('difficulty', difficulty);
      if (search) params.append('search', search);

      const response = await api.get(`/coding/problems?${params.toString()}`);
      return response.data;
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
    staleTime: 1000 * 60 * 2, // 2 minutes
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
   Admin Portal Queries & Cache Invalidation
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
    invalidateDashboard: () => queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
  };
}
