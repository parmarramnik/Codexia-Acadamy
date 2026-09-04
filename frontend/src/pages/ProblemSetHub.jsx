import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  FiSearch,
  FiShuffle,
  FiCheckCircle,
  FiClock,
  FiCode,
  FiChevronDown,
  FiChevronUp,
  FiStar,
  FiZap,
  FiTrendingUp,
  FiLayers,
  FiEdit2,
  FiX,
  FiPlus
} from 'react-icons/fi';
import { useCodingProblems, useDailyChallenge, useCodingStats, useInvalidateCache } from '../hooks/useQueries';

const ProblemMakerModal = lazy(() => import('../components/coding/ProblemMakerModal'));

const COLLAPSED_TAGS_COUNT = 7;

export default function ProblemSetHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAssignDaily = ['admin', 'super_admin', 'instructor'].includes(user?.role);

  const [problems, setProblems] = useState([]);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedProblemToAssign, setSelectedProblemToAssign] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [showProblemMaker, setShowProblemMaker] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL' | 'SOLVED' | 'UNSOLVED' | 'FAVORITES'
  const [selectedTag, setSelectedTag] = useState(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [isPickingRandom, setIsPickingRandom] = useState(false);

  // TanStack Query caching
  const { data: cachedProblems, isLoading: isProblemsLoading } = useCodingProblems();
  const { data: cachedDaily, isLoading: isDailyLoading } = useDailyChallenge();
  const { data: cachedStats } = useCodingStats();
  const { invalidateProblems, invalidateDailyChallenge } = useInvalidateCache();

  useEffect(() => {
    if (cachedProblems) setProblems(cachedProblems);
  }, [cachedProblems]);

  useEffect(() => {
    if (cachedDaily) setDailyChallenge(cachedDaily);
  }, [cachedDaily]);

  useEffect(() => {
    if (cachedStats) setUserStats(cachedStats);
  }, [cachedStats]);

  useEffect(() => {
    async function loadFavs() {
      try {
        const favRes = await api.get('/coding/problems/favorites');
        const favIds = (favRes.data || []).map(f => f.problem_id);
        setFavorites(favIds);
      } catch (e) {}
    }
    loadFavs();
  }, []);

  const loading = isProblemsLoading && problems.length === 0;

  // Pick a random problem
  const handlePickRandom = async () => {
    setIsPickingRandom(true);
    try {
      const res = await api.get('/coding/problems/random');
      if (res.data?.slug) {
        navigate(`/coding/${res.data.slug}`);
      } else if (problems.length > 0) {
        const randomProb = problems[Math.floor(Math.random() * problems.length)];
        navigate(`/coding/${randomProb.slug}`);
      }
    } catch (e) {
      if (problems.length > 0) {
        const randomProb = problems[Math.floor(Math.random() * problems.length)];
        navigate(`/coding/${randomProb.slug}`);
      } else {
        toast.error('No problems available');
      }
    } finally {
      setIsPickingRandom(false);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (e, problemId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await api.post(`/coding/problems/${problemId}/favorite`);
      if (res.data?.favorited) {
        setFavorites(prev => [...prev, problemId]);
        toast.success('Added to favorites');
      } else {
        setFavorites(prev => prev.filter(id => id !== problemId));
        toast.success('Removed from favorites');
      }
    } catch (err) {
      toast.error('Failed to update favorite');
    }
  };

  // Assign today's daily challenge (Instructors / Admins)
  const handleAssignDaily = async (problemId) => {
    if (!problemId) return;
    setIsAssigning(true);
    try {
      const res = await api.post('/coding/daily-challenge', { problem_id: parseInt(problemId) });
      toast.success(res.data?.message || "Today's daily challenge updated!");
      setShowAssignModal(false);
      const updated = await api.get('/coding/daily-challenge');
      setDailyChallenge(updated.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign daily challenge');
    } finally {
      setIsAssigning(false);
    }
  };

  // Refresh hub when a new problem is created
  const handleProblemCreated = async () => {
    try {
      const [probRes, statsRes, dailyRes] = await Promise.allSettled([
        api.get('/coding/problems?page_size=100'),
        api.get('/coding/statistics'),
        api.get('/coding/daily-challenge')
      ]);
      if (probRes.status === 'fulfilled') {
        const items = probRes.value.data?.items || probRes.value.data || [];
        setProblems(items);
      }
      if (statsRes.status === 'fulfilled') {
        setUserStats(statsRes.value.data);
      }
      if (dailyRes.status === 'fulfilled') {
        setDailyChallenge(dailyRes.value.data);
      }
    } catch (err) {
      console.error('Error refreshing problems:', err);
    }
  };

  // All solved problem IDs
  const solvedProblemIds = useMemo(() => {
    if (userStats?.solved_problem_ids && Array.isArray(userStats.solved_problem_ids)) {
      return userStats.solved_problem_ids;
    }
    return problems.filter(p => p.is_solved).map(p => p.id);
  }, [userStats, problems]);

  // Filter problems
  const filteredProblems = useMemo(() => {
    return problems.filter(p => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = (p.title || '').toLowerCase().includes(q);
        const matchesTags = (p.tags || '').toLowerCase().includes(q);
        const matchesDiff = (p.difficulty || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesTags && !matchesDiff) return false;
      }

      // Difficulty filter
      if (selectedDifficulty !== 'ALL') {
        if ((p.difficulty || '').toUpperCase() !== selectedDifficulty) return false;
      }

      // Topic tag filter
      if (selectedTag) {
        const pTags = (p.tags || '').toLowerCase();
        if (!pTags.includes(selectedTag.toLowerCase())) return false;
      }

      // Status filter
      const isSolved = solvedProblemIds.includes(p.id) || p.is_solved;
      if (selectedStatus === 'SOLVED') {
        if (!isSolved) return false;
      } else if (selectedStatus === 'UNSOLVED') {
        if (isSolved) return false;
      } else if (selectedStatus === 'FAVORITES') {
        if (!favorites.includes(p.id)) return false;
      }

      return true;
    });
  }, [problems, searchQuery, selectedDifficulty, selectedTag, selectedStatus, favorites, solvedProblemIds]);

  // Solved breakdown stats
  const totalCount = problems.length;
  const easyCount = problems.filter(p => (p.difficulty || '').toUpperCase() === 'EASY').length;
  const medCount = problems.filter(p => (p.difficulty || '').toUpperCase() === 'MEDIUM').length;
  const hardCount = problems.filter(p => (p.difficulty || '').toUpperCase() === 'HARD').length;

  const solvedEasy = useMemo(() => {
    if (userStats?.difficulty_distribution?.easy !== undefined) {
      return userStats.difficulty_distribution.easy;
    }
    return problems.filter(p => solvedProblemIds.includes(p.id) && (p.difficulty || '').toUpperCase() === 'EASY').length;
  }, [userStats, problems, solvedProblemIds]);

  const solvedMed = useMemo(() => {
    if (userStats?.difficulty_distribution?.medium !== undefined) {
      return userStats.difficulty_distribution.medium;
    }
    return problems.filter(p => solvedProblemIds.includes(p.id) && (p.difficulty || '').toUpperCase() === 'MEDIUM').length;
  }, [userStats, problems, solvedProblemIds]);

  const solvedHard = useMemo(() => {
    if (userStats?.difficulty_distribution?.hard !== undefined) {
      return userStats.difficulty_distribution.hard;
    }
    return problems.filter(p => solvedProblemIds.includes(p.id) && (p.difficulty || '').toUpperCase() === 'HARD').length;
  }, [userStats, problems, solvedProblemIds]);

  const totalSolved = solvedProblemIds.length || userStats?.total_solved || 0;

  // Dynamically extract true topic tags and counts strictly from active problems in database
  const dynamicTopicTags = useMemo(() => {
    const counts = {};
    problems.forEach(p => {
      const tagList = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      tagList.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });

    const list = Object.entries(counts).map(([name, count]) => ({ name, count }));
    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return list;
  }, [problems]);

  // Expand / Collapse tags strictly: first 7 tags when collapsed, all tags when expanded
  const visibleTags = tagsExpanded ? dynamicTopicTags : dynamicTopicTags.slice(0, COLLAPSED_TAGS_COUNT);

  return (
    <div style={styles.container}>
      {/* ── Daily Challenge Box ── */}
      <div style={styles.dailyCardContainer}>
        <div style={styles.dailyCard}>
          <div style={styles.dailyLeft}>
            <div style={styles.dailyHeaderRow}>
              <span style={styles.bannerBadgeGold}>
                <FiZap size={13} style={{ marginRight: '4px' }} /> DAILY CHALLENGE
              </span>
              <span style={styles.bannerDate}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {canAssignDaily && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProblemToAssign(dailyChallenge?.problem?.id || '');
                    setShowAssignModal(true);
                  }}
                  style={styles.adminAssignBtn}
                  title="Instructor/Admin: Assign or update today's daily challenge"
                >
                  <FiEdit2 size={12} style={{ marginRight: '4px' }} />
                  {dailyChallenge?.available ? 'Change Challenge' : 'Set Today’s Challenge'}
                </button>
              )}
            </div>

            {dailyChallenge?.available ? (
              <>
                <div style={styles.dailyTitleRow}>
                  <h3 style={styles.dailyTitle}>
                    {dailyChallenge.problem.title}
                  </h3>
                  <span style={{
                    ...styles.diffPill,
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    color: (dailyChallenge.problem.difficulty || '').toUpperCase() === 'EASY'
                      ? 'var(--color-success)'
                      : (dailyChallenge.problem.difficulty || '').toUpperCase() === 'MEDIUM'
                      ? 'var(--color-warning)'
                      : 'var(--color-error)',
                    backgroundColor: (dailyChallenge.problem.difficulty || '').toUpperCase() === 'EASY'
                      ? 'rgba(16, 185, 129, 0.12)'
                      : (dailyChallenge.problem.difficulty || '').toUpperCase() === 'MEDIUM'
                      ? 'rgba(245, 158, 11, 0.12)'
                      : 'rgba(239, 68, 68, 0.12)'
                  }}>
                    {dailyChallenge.problem.difficulty}
                  </span>
                </div>
                <p style={styles.dailySubtitle}>
                  Topics: {dailyChallenge.problem.tags || 'Algorithms'}
                </p>
              </>
            ) : (
              <>
                <div style={styles.dailyTitleRow}>
                  <h3 style={styles.dailyTitle}>Daily Coding Challenge</h3>
                  <span style={styles.notAvailableBadge}>Not available today</span>
                </div>
                <p style={styles.dailySubtitle}>
                  No daily challenge has been assigned for today by an instructor or administrator.
                  {canAssignDaily ? ' Click "+ Set Today’s Challenge" to designate today\'s problem.' : ''}
                </p>
              </>
            )}
          </div>

          <div style={styles.dailyRight}>
            {dailyChallenge?.available ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                {/* Solved or not in the box */}
                {dailyChallenge.is_solved ? (
                  <div style={styles.dailySolvedIndicator}>
                    <FiCheckCircle size={14} color="var(--color-success)" />
                    <span>Solved Today</span>
                  </div>
                ) : (
                  <div style={styles.dailyUnsolvedIndicator}>
                    <FiClock size={14} color="#F59E0B" />
                    <span>Not Solved Yet</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/coding/${dailyChallenge.problem.slug}`)}
                  style={dailyChallenge.is_solved ? styles.dailyReviewBtn : styles.dailySolveBtn}
                >
                  {dailyChallenge.is_solved ? 'Review Solution' : 'Solve Today’s Challenge'}
                </button>
              </div>
            ) : canAssignDaily ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedProblemToAssign('');
                  setShowAssignModal(true);
                }}
                style={styles.dailySolveBtn}
              >
                + Set Today’s Challenge
              </button>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Check back tomorrow
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Assign Daily Challenge Modal (Instructor / Admin) ── */}
      {showAssignModal && canAssignDaily && (
        <div style={styles.modalOverlay} onClick={() => setShowAssignModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                Set Today's Daily Coding Challenge
              </h3>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                style={styles.modalCloseBtn}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '8px 0 16px 0' }}>
              Select an existing problem to feature as today's challenge ({new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}).
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Select Problem from Catalog:
              </label>
              <select
                value={selectedProblemToAssign}
                onChange={(e) => setSelectedProblemToAssign(e.target.value)}
                style={styles.modalSelect}
              >
                <option value="">-- Choose a coding problem --</option>
                {problems.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} - {p.title} ({p.difficulty}) [{p.tags || 'General'}]
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                style={styles.modalCancelBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedProblemToAssign || isAssigning}
                onClick={() => handleAssignDaily(selectedProblemToAssign)}
                style={{
                  ...styles.modalSubmitBtn,
                  opacity: (!selectedProblemToAssign || isAssigning) ? 0.5 : 1,
                  cursor: (!selectedProblemToAssign || isAssigning) ? 'not-allowed' : 'pointer'
                }}
              >
                {isAssigning ? 'Saving...' : 'Assign Challenge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Problem Maker Modal (Instructor / Admin / Super Admin) ── */}
      {showProblemMaker && canAssignDaily && (
        <Suspense fallback={null}>
          <ProblemMakerModal
            isOpen={showProblemMaker}
            onClose={() => setShowProblemMaker(false)}
            onSuccess={handleProblemCreated}
          />
        </Suspense>
      )}

      {/* ── Topic Tag Cloud (Expand / Collapse Fixed) ── */}
      <div style={styles.tagCloudSection}>
        <div style={styles.tagCloudHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiLayers size={16} color="var(--accent-primary)" />
            <span style={styles.tagCloudTitle}>Topic Categories</span>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                style={styles.clearTagBtn}
              >
                Clear: {selectedTag} ✕
              </button>
            )}
          </div>
          {dynamicTopicTags.length > COLLAPSED_TAGS_COUNT && (
            <button
              onClick={() => setTagsExpanded(!tagsExpanded)}
              style={styles.expandTagsBtn}
            >
              {tagsExpanded ? (
                <>Collapse Tags <FiChevronUp size={14} /></>
              ) : (
                <>Expand All Tags ({dynamicTopicTags.length}) <FiChevronDown size={14} /></>
              )}
            </button>
          )}
        </div>

        <div style={styles.tagsContainer}>
          {visibleTags.map((tag) => {
            const isSelected = selectedTag === tag.name;
            return (
              <button
                key={tag.name}
                onClick={() => setSelectedTag(isSelected ? null : tag.name)}
                style={isSelected ? { ...styles.tagPill, ...styles.tagPillSelected } : styles.tagPill}
              >
                <span>{tag.name}</span>
                <span style={isSelected ? styles.tagBadgeSelected : styles.tagBadge}>
                  {tag.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Content Area: Problem Table + Stats Widget ── */}
      <div style={styles.mainGrid}>
        {/* Left / Center Column: Problems List & Filter Toolbar */}
        <div style={styles.problemsColumn}>
          {/* Status Filter Tabs (Quick 1-Click Access to Solved Questions) */}
          <div style={styles.statusTabsRow}>
            <button
              type="button"
              onClick={() => setSelectedStatus('ALL')}
              style={selectedStatus === 'ALL' ? styles.statusTabActive : styles.statusTab}
            >
              All Problems ({problems.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('SOLVED')}
              style={selectedStatus === 'SOLVED' ? styles.statusTabActiveSolved : styles.statusTab}
            >
              <FiCheckCircle size={13} style={{ marginRight: '4px' }} /> Solved ({solvedProblemIds.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('UNSOLVED')}
              style={selectedStatus === 'UNSOLVED' ? styles.statusTabActive : styles.statusTab}
            >
              Unsolved ({Math.max(0, problems.length - solvedProblemIds.length)})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('FAVORITES')}
              style={selectedStatus === 'FAVORITES' ? styles.statusTabActiveFav : styles.statusTab}
            >
              <FiStar size={13} style={{ marginRight: '4px' }} /> Starred ({favorites.length})
            </button>
          </div>

          {/* Active Filter Banner for Solved Questions */}
          {selectedStatus === 'SOLVED' && (
            <div style={styles.solvedActiveBanner}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiCheckCircle size={17} color="var(--color-success)" />
                <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  Showing all <strong>{filteredProblems.length}</strong> solved questions
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStatus('ALL')}
                style={styles.clearStatusFilterBtn}
              >
                View All Problems ✕
              </button>
            </div>
          )}

          {/* Controls & Search Filter Bar */}
          <div style={styles.filterToolbar}>
            {/* Search Input */}
            <div style={styles.searchBox}>
              <FiSearch size={16} style={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search problem title, tags, algorithm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={styles.searchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={styles.searchClearBtn}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Difficulty Filter */}
            <div style={styles.selectWrapper}>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                style={styles.selectInput}
              >
                <option value="ALL">All Difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            {/* Status Filter Dropdown */}
            <div style={styles.selectWrapper}>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={styles.selectInput}
              >
                <option value="ALL">All Status ({problems.length})</option>
                <option value="SOLVED">✓ Solved ({solvedProblemIds.length})</option>
                <option value="UNSOLVED">○ Unsolved ({Math.max(0, problems.length - solvedProblemIds.length)})</option>
                <option value="FAVORITES">★ Starred ({favorites.length})</option>
              </select>
            </div>

            {/* Pick Random Problem (Shuffle) */}
            <button
              onClick={handlePickRandom}
              disabled={isPickingRandom}
              style={styles.pickRandomBtn}
              title="Pick a random problem"
            >
              <FiShuffle size={15} />
              <span>{isPickingRandom ? 'Picking...' : 'Pick One'}</span>
            </button>

            {/* Instructor / Admin Problem Creator Button */}
            {canAssignDaily && (
              <button
                type="button"
                onClick={() => setShowProblemMaker(true)}
                style={styles.createProblemBtn}
                title="Create a new coding challenge"
              >
                <FiPlus size={15} />
                <span>+ Create Problem</span>
              </button>
            )}
          </div>

          {/* Table of Problems */}
          <div style={styles.tableCard}>
            <div style={styles.tableHeaderRow}>
              <div style={{ width: '45px', textAlign: 'center' }}>Status</div>
              <div style={{ width: '35px', textAlign: 'center' }}>#</div>
              <div style={{ flex: 1 }}>Title & Topics</div>
              <div style={{ width: '130px', textAlign: 'center' }}>Acceptance</div>
              <div style={{ width: '110px', textAlign: 'center' }}>Difficulty</div>
              <div style={{ width: '90px', textAlign: 'center' }}>Action</div>
            </div>

            {loading ? (
              <div style={styles.loadingContainer}>
                <div className="spinner" style={{ width: '28px', height: '28px', margin: '0 auto 12px auto' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading Codexia problems...</p>
              </div>
            ) : filteredProblems.length === 0 ? (
              <div style={styles.emptyContainer}>
                <FiCode size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                <h4 style={{ color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                  {selectedStatus === 'SOLVED' ? 'No solved questions yet' : 'No matching problems found'}
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                  {selectedStatus === 'SOLVED'
                    ? 'Start solving problems from the catalog to see them listed here.'
                    : 'Try changing your search terms, difficulty, or topic tag filters.'}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedDifficulty('ALL');
                    setSelectedTag(null);
                    setSelectedStatus('ALL');
                  }}
                  style={styles.resetFilterBtn}
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              filteredProblems.map((prob, index) => {
                const isFav = favorites.includes(prob.id);
                const isSolved = solvedProblemIds.includes(prob.id) || prob.is_solved;
                const diff = (prob.difficulty || 'EASY').toUpperCase();
                const diffColor =
                  diff === 'EASY'
                    ? 'var(--color-success)'
                    : diff === 'MEDIUM'
                    ? 'var(--color-warning)'
                    : 'var(--color-error)';
                const diffBg =
                  diff === 'EASY'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : diff === 'MEDIUM'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)';

                const tagsList = (prob.tags || '')
                  .split(',')
                  .map(t => t.trim())
                  .filter(Boolean);

                const acceptRate = prob.acceptance_rate || 0;

                return (
                  <div
                    key={prob.id}
                    style={styles.tableRow}
                    onClick={() => navigate(`/coding/${prob.slug}`)}
                  >
                    {/* Status Checkmark Column */}
                    <div style={{ width: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isSolved ? (
                        <span title="Solved" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--color-success)' }}>
                          <FiCheckCircle size={16} />
                        </span>
                      ) : (
                        <span title="Not solved" style={{ color: 'rgba(255, 255, 255, 0.2)', fontSize: '0.95rem' }}>
                          —
                        </span>
                      )}
                    </div>

                    {/* Favorite Star */}
                    <div style={{ width: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button
                        onClick={(e) => handleToggleFavorite(e, prob.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isFav ? '#F59E0B' : 'rgba(255, 255, 255, 0.2)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'color 0.2s'
                        }}
                        title={isFav ? 'Remove from favorites' : 'Star problem'}
                      >
                        <FiStar size={14} fill={isFav ? '#F59E0B' : 'none'} />
                      </button>
                    </div>

                    {/* Title & Tag Chips */}
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                      <div style={styles.probTitleRow}>
                        <span style={styles.probIndex}>{index + 1}.</span>
                        <span style={styles.probTitleText}>{prob.title}</span>
                      </div>
                      <div style={styles.probTagsRow}>
                        {tagsList.slice(0, 3).map((t, idx) => (
                          <span
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTag(t);
                            }}
                            style={styles.probTagBadge}
                          >
                            {t}
                          </span>
                        ))}
                        {tagsList.length > 3 && (
                          <span style={styles.probTagMore}>+{tagsList.length - 3}</span>
                        )}
                      </div>
                    </div>

                    {/* Acceptance Rate with Mini Bar */}
                    <div style={{ width: '130px', textAlign: 'center' }}>
                      <div style={{
                        fontSize: '0.82rem',
                        color: (prob.total_submissions > 0 || acceptRate > 0) ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontWeight: 500
                      }}>
                        {(prob.total_submissions > 0 || acceptRate > 0) ? `${acceptRate}%` : '—'}
                      </div>
                      <div style={styles.miniProgressBar}>
                        <div
                          style={{
                            ...styles.miniProgressFill,
                            width: `${(prob.total_submissions > 0 || acceptRate > 0) ? Math.min(Math.max(acceptRate, 5), 100) : 0}%`,
                            opacity: (prob.total_submissions > 0 || acceptRate > 0) ? 1 : 0.2
                          }}
                        />
                      </div>
                    </div>

                    {/* Difficulty Pill */}
                    <div style={{ width: '110px', display: 'flex', justifyContent: 'center' }}>
                      <span
                        style={{
                          ...styles.diffPill,
                          color: diffColor,
                          backgroundColor: diffBg,
                          borderColor: diffColor
                        }}
                      >
                        {diff.charAt(0) + diff.slice(1).toLowerCase()}
                      </span>
                    </div>

                    {/* Action Button */}
                    <div style={{ width: '90px', display: 'flex', justifyContent: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/coding/${prob.slug}`);
                        }}
                        style={isSolved ? styles.reviewBtn : styles.solveBtn}
                      >
                        {isSolved ? 'Review' : 'Solve'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: User Progress & Statistics Card */}
        <div style={styles.statsColumn}>
          {/* Progress Overview Card */}
          <div style={styles.statsCard}>
            <div style={styles.statsHeader}>
              <FiTrendingUp size={18} color="var(--accent-emerald)" />
              <h3 style={styles.statsTitle}>Session Progress</h3>
            </div>

            {/* Solved Dial / Number (Clickable to show all solved questions) */}
            <div
              style={{ ...styles.solvedDial, cursor: 'pointer' }}
              onClick={() => setSelectedStatus(selectedStatus === 'SOLVED' ? 'ALL' : 'SOLVED')}
              title="Click to view all solved questions"
            >
              <div style={styles.solvedNumber}>
                <span style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {totalSolved}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  /{totalCount}
                </span>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Questions Solved (Click to View)
              </span>
            </div>

            {/* Difficulty Breakdown Bars */}
            <div style={styles.breakdownList}>
              {/* Easy */}
              <div style={styles.breakdownItem}>
                <div style={styles.breakdownLabelRow}>
                  <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '0.82rem' }}>Easy</span>
                  <span style={styles.breakdownRatio}>{solvedEasy}/{easyCount}</span>
                </div>
                <div style={styles.statProgressBar}>
                  <div
                    style={{
                      ...styles.statProgressFill,
                      backgroundColor: 'var(--color-success)',
                      width: `${easyCount > 0 ? (solvedEasy / easyCount) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Medium */}
              <div style={styles.breakdownItem}>
                <div style={styles.breakdownLabelRow}>
                  <span style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: '0.82rem' }}>Medium</span>
                  <span style={styles.breakdownRatio}>{solvedMed}/{medCount}</span>
                </div>
                <div style={styles.statProgressBar}>
                  <div
                    style={{
                      ...styles.statProgressFill,
                      backgroundColor: 'var(--color-warning)',
                      width: `${medCount > 0 ? (solvedMed / medCount) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Hard */}
              <div style={styles.breakdownItem}>
                <div style={styles.breakdownLabelRow}>
                  <span style={{ color: 'var(--color-error)', fontWeight: 600, fontSize: '0.82rem' }}>Hard</span>
                  <span style={styles.breakdownRatio}>{solvedHard}/{hardCount}</span>
                </div>
                <div style={styles.statProgressBar}>
                  <div
                    style={{
                      ...styles.statProgressFill,
                      backgroundColor: 'var(--color-error)',
                      width: `${hardCount > 0 ? (solvedHard / hardCount) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Acceptance & Submissions Metrics */}
            <div style={styles.metricGrid}>
              <div style={styles.metricBox}>
                <span style={styles.metricVal}>
                  {(userStats?.total_submissions || 0) > 0 ? `${userStats.acceptance_rate || 0}%` : '0%'}
                </span>
                <span style={styles.metricLabel}>Acceptance</span>
              </div>
              <div style={styles.metricBox}>
                <span style={styles.metricVal}>{userStats?.total_submissions || 0}</span>
                <span style={styles.metricLabel}>Submissions</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px 32px',
    maxWidth: '1440px',
    margin: '0 auto',
    minHeight: '100vh',
    boxSizing: 'border-box'
  },
  dailyCardContainer: {
    marginBottom: '24px'
  },
  dailyCard: {
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(20, 24, 33, 0.95) 100%)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    borderRadius: '12px',
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
  },
  dailyLeft: {
    flex: 1,
    minWidth: 0
  },
  dailyHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
  },
  bannerBadgeGold: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#F59E0B',
    letterSpacing: '0.5px'
  },
  bannerDate: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 500
  },
  adminAssignBtn: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '0.72rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'all 0.2s'
  },
  dailyTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  dailyTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0
  },
  notAvailableBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 500
  },
  dailySubtitle: {
    fontSize: '0.84rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
    margin: '6px 0 0 0'
  },
  dailyRight: {
    flexShrink: 0
  },
  dailySolvedIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--color-success)',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    padding: '4px 10px',
    borderRadius: '16px'
  },
  dailyUnsolvedIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    padding: '4px 10px',
    borderRadius: '16px'
  },
  dailySolveBtn: {
    backgroundColor: '#F59E0B',
    color: '#0F1219',
    fontWeight: 700,
    fontSize: '0.85rem',
    padding: '9px 20px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    display: 'inline-flex',
    alignItems: 'center'
  },
  dailyReviewBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid var(--color-success)',
    color: 'var(--color-success)',
    fontWeight: 600,
    fontSize: '0.85rem',
    padding: '8px 18px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modalContent: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '520px',
    width: '100%',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px'
  },
  modalSelect: {
    width: '100%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box'
  },
  modalCancelBtn: {
    backgroundColor: 'transparent',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  modalSubmitBtn: {
    backgroundColor: '#F59E0B',
    color: '#0F1219',
    fontWeight: 700,
    border: 'none',
    padding: '8px 18px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  tagCloudSection: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '12px',
    padding: '16px 20px',
    marginBottom: '24px'
  },
  tagCloudHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px'
  },
  tagCloudTitle: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  clearTagBtn: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#F87171',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.72rem',
    fontWeight: 500,
    cursor: 'pointer'
  },
  expandTagsBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  tagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-primary)',
    borderRadius: '16px',
    padding: '4px 12px',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  tagPillSelected: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
    color: '#F59E0B',
    fontWeight: 600
  },
  tagBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: 'var(--text-muted)',
    fontSize: '0.68rem',
    padding: '1px 6px',
    borderRadius: '10px'
  },
  tagBadgeSelected: {
    backgroundColor: '#F59E0B',
    color: '#0F1219',
    fontWeight: 700,
    fontSize: '0.68rem',
    padding: '1px 6px',
    borderRadius: '10px'
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: '24px',
    alignItems: 'start'
  },
  problemsColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  statusTabsRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  statusTab: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'all 0.15s ease'
  },
  statusTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid var(--text-primary)',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '0.78rem',
    color: 'var(--text-primary)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  statusTabActiveSolved: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid var(--color-success)',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '0.78rem',
    color: 'var(--color-success)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  statusTabActiveFav: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid #F59E0B',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '0.78rem',
    color: '#F59E0B',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  solvedActiveBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '8px',
    padding: '10px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  clearStatusFilterBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-success)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0
  },
  filterToolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center'
  },
  searchBox: {
    position: 'relative',
    flex: 1,
    minWidth: '220px'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)'
  },
  searchInput: {
    width: '100%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    padding: '9px 32px 9px 36px',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box'
  },
  searchClearBtn: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '12px'
  },
  selectWrapper: {
    minWidth: '140px'
  },
  selectInput: {
    width: '100%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '0.82rem',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer'
  },
  pickRandomBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    cursor: 'pointer'
  },
  tableCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  tableHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-primary)',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-primary)',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease'
  },
  probTitleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    marginBottom: '4px'
  },
  probIndex: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    fontWeight: 500
  },
  probTitleText: {
    fontSize: '0.92rem',
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  probTagsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px'
  },
  probTagBadge: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: '1px 6px',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  probTagMore: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    padding: '1px 4px'
  },
  miniProgressBar: {
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '2px',
    width: '64px',
    margin: '4px auto 0 auto',
    overflow: 'hidden'
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: 'var(--color-success)',
    borderRadius: '2px'
  },
  diffPill: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: '12px',
    border: '1px solid',
    display: 'inline-block'
  },
  solveBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  reviewBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    color: 'var(--color-success)',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  loadingContainer: {
    padding: '48px 16px',
    textAlign: 'center'
  },
  emptyContainer: {
    padding: '48px 16px',
    textAlign: 'center'
  },
  resetFilterBtn: {
    marginTop: '12px',
    background: 'none',
    border: '1px solid var(--accent-primary)',
    color: 'var(--accent-primary)',
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  statsColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  statsCard: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '12px',
    padding: '20px',
    boxSizing: 'border-box'
  },
  statsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px'
  },
  statsTitle: {
    fontSize: '0.98rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0
  },
  solvedDial: {
    textAlign: 'center',
    padding: '16px 0',
    borderBottom: '1px solid var(--border-primary)',
    marginBottom: '16px',
    transition: 'background-color 0.15s ease',
    borderRadius: '8px'
  },
  solvedNumber: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '2px',
    marginBottom: '4px'
  },
  breakdownList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px'
  },
  breakdownItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  breakdownLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  breakdownRatio: {
    fontSize: '0.78rem',
    color: 'var(--text-secondary)',
    fontWeight: 500
  },
  statProgressBar: {
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '3px',
    overflow: 'hidden'
  },
  statProgressFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease'
  },
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '16px'
  },
  metricBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    padding: '10px',
    textAlign: 'center'
  },
  metricVal: {
    display: 'block',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '2px'
  },
  metricLabel: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)'
  },
  solvedFilterBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.25)',
    borderRadius: '8px',
    padding: '9px 12px',
    color: 'var(--color-success)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '8px',
    transition: 'all 0.15s ease'
  },
  solvedFilterActiveBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: 'var(--color-success)',
    border: '1px solid var(--color-success)',
    borderRadius: '8px',
    padding: '9px 12px',
    color: '#0F1219',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: '8px',
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
  },
  starredBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    padding: '9px 12px',
    color: 'var(--text-secondary)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  starredActiveBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    borderRadius: '8px',
    padding: '9px 12px',
    color: '#F59E0B',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  createProblemBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    padding: '7px 14px',
    fontSize: '0.82rem',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.15s ease',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
  }
};
