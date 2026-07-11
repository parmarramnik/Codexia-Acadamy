import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Custom hook for data fetching with loading, error, and refetch support.
 * @param {string} url - API endpoint
 * @param {object} options - { params, immediate }
 */
export default function useFetch(url, options = {}) {
  const { params = {}, immediate = true } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (overrideParams = null) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(url, { params: overrideParams || params });
      setData(response.data);
      return response.data;
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'An error occurred';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (immediate && url) {
      fetchData();
    }
  }, [url, immediate]);

  return { data, loading, error, refetch: fetchData, setData };
}
