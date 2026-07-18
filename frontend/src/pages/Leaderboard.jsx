import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiAward, FiTrendingUp, FiUser, FiActivity } from 'react-icons/fi';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await api.get('/users/leaderboard/top');
        setLeaderboard(res.data || []);
      } catch (err) {
        toast.error('Failed to load leaderboard data');
      } finally {
        setIsLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleWrapper}>
          <FiAward size={36} style={styles.headerIcon} />
          <div>
            <h1 style={styles.title}>Global Leaderboard</h1>
            <p style={styles.subtitle}>See how you compare with other learners solving coding problems in real-time.</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={styles.loadingContainer}>
          <p style={styles.loadingText}>Fetching leaderboard data...</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div style={styles.emptyState}>
          <FiTrendingUp size={48} style={styles.emptyIcon} />
          <h3 style={styles.emptyTitle}>No Rankings Yet</h3>
          <p style={styles.emptySubtitle}>Start solving programming exercises to top the charts!</p>
        </div>
      ) : (
        <div style={styles.boardCard}>
          <div style={styles.tableHeader}>
            <span style={styles.colRank}>Rank</span>
            <span style={styles.colUser}>User</span>
            <span style={styles.colScore}>Problems Solved</span>
          </div>

          <div style={styles.list}>
            {leaderboard.map((row, index) => {
              const isTop3 = row.rank <= 3;
              const medalColor = row.rank === 1 ? '#ffd700' : row.rank === 2 ? '#c0c0c0' : '#cd7f32';
              const isLast = index === leaderboard.length - 1;

              return (
                <div
                  key={row.user_id}
                  style={{
                    ...styles.row,
                    borderBottom: isLast ? 'none' : '1px solid var(--border-primary)',
                  }}
                >
                  <div style={styles.colRank}>
                    {isTop3 ? (
                      <span style={{ ...styles.medal, backgroundColor: medalColor }}>
                        {row.rank}
                      </span>
                    ) : (
                      <span style={styles.rankNumber}>{row.rank}</span>
                    )}
                  </div>

                  <div style={styles.colUser}>
                    <div style={styles.avatar}>
                      <FiUser size={16} />
                    </div>
                    <div>
                      <div style={styles.fullName}>{row.full_name || 'Anonymous Solver'}</div>
                      <div style={styles.username}>@{row.username}</div>
                    </div>
                  </div>

                  <div style={styles.colScore}>
                    <div style={styles.solvedBadge}>
                      <FiActivity size={12} />
                      <span>{row.solved_count} solved</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  header: {
    marginBottom: '2.5rem',
  },
  titleWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  headerIcon: {
    color: '#ffd700',
    filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.4))',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.25rem',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '300px',
  },
  loadingText: {
    color: 'var(--text-secondary)',
  },
  emptyState: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '4rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  emptyIcon: {
    color: 'var(--text-secondary)',
    marginBottom: '0.5rem',
  },
  emptyTitle: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-medium)',
  },
  emptySubtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  boardCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--border-primary)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    fontWeight: 'var(--fw-bold)',
    letterSpacing: '0.05em',
  },
  colRank: {
    width: '60px',
    display: 'flex',
    alignItems: 'center',
  },
  colUser: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  colScore: {
    width: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  row: {
    display: 'flex',
    padding: '1.25rem 1.5rem',
    alignItems: 'center',
    transition: 'background-color var(--transition-fast)',
  },
  medal: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    color: '#000000',
    fontSize: '0.75rem',
    fontWeight: 'bold',
  },
  rankNumber: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
    paddingLeft: '0.25rem',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
  },
  fullName: {
    fontSize: '0.925rem',
    fontWeight: 'var(--fw-medium)',
  },
  username: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  solvedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    padding: '0.25rem 0.625rem',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.75rem',
    fontWeight: 'var(--fw-medium)',
  },
};
