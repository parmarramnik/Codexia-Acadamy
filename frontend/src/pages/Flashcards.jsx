import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { FiPlus, FiStar, FiCheck, FiRefreshCw, FiBookOpen, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import LoadingButton from '../components/common/LoadingButton';

export default function Flashcards() {
  const [cards, setCards] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [showCreate, setShowCreate] = useState(false);
  const [newCard, setNewCard] = useState({ question: '', answer: '', course_id: '' });
  const [isSaving, setIsSaving] = useState(false);

  async function loadData() {
    setIsLoading(true);
    try {
      const params = {};
      if (selectedCourse) params.course_id = selectedCourse;

      const [cardsRes, coursesRes] = await Promise.all([
        api.get('/flashcards', { params }),
        api.get('/courses')
      ]);

      setCards(cardsRes.data || []);
      setCourses(coursesRes.data.items || []);
      if (coursesRes.data.items?.length > 0 && !newCard.course_id) {
        setNewCard(prev => ({ ...prev, course_id: coursesRes.data.items[0].id }));
      }
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      toast.error('Failed to load flashcards');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedCourse]);

  const handleCreateCard = async (e) => {
    e.preventDefault();
    if (!newCard.question || !newCard.answer || !newCard.course_id) {
      toast.error('Please enter a question, answer and select a course');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/flashcards', {
        question: newCard.question,
        answer: newCard.answer,
        course_id: parseInt(newCard.course_id)
      });
      toast.success('Flashcard added successfully!');
      setShowCreate(false);
      setNewCard({ question: '', answer: '', course_id: courses[0]?.id || '' });
      loadData();
    } catch (err) {
      toast.error('Failed to add flashcard');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFavorite = async (cardId, currentStatus) => {
    try {
      await api.patch(`/flashcards/${cardId}`, {
        is_favorite: !currentStatus
      });
      toast.success(!currentStatus ? 'Added to favorites' : 'Removed from favorites');
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, is_favorite: !currentStatus } : c));
    } catch (err) {
      toast.error('Failed to update flashcard');
    }
  };

  const handleToggleLearned = async (cardId, currentStatus) => {
    try {
      await api.patch(`/flashcards/${cardId}`, {
        is_learned: !currentStatus
      });
      toast.success(!currentStatus ? 'Marked as learned' : 'Marked as unlearned');
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, is_learned: !currentStatus } : c));
    } catch (err) {
      toast.error('Failed to update flashcard');
    }
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    toast.success('Flashcards shuffled!');
  };

  if (isLoading && cards.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Fetching deck stack...</p>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Active Recall Flashcards</h1>
        <p style={styles.subtitle}>Test your recall accuracy step-by-step using randomized memory card stacks.</p>
      </div>

      <div style={styles.actionRow}>
        <div style={styles.filterBar}>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            style={styles.select}
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <button onClick={handleShuffle} disabled={cards.length === 0} style={styles.secondaryBtn}>
            <FiRefreshCw /> Shuffle Deck
          </button>
        </div>

        <button onClick={() => setShowCreate(!showCreate)} style={styles.createBtn}>
          <FiPlus /> Add Card
        </button>
      </div>

      {/* Main interface layout */}
      <div style={styles.workspaceGrid}>
        {showCreate ? (
          <form onSubmit={handleCreateCard} style={styles.formCard}>
            <h3 style={styles.sectionHeading}>Add a Flashcard</h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>Select Course</label>
              <select
                value={newCard.course_id}
                onChange={(e) => setNewCard({ ...newCard, course_id: e.target.value })}
                style={styles.selectInput}
                required
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Front (Question)</label>
              <input
                type="text"
                placeholder="e.g. What is the average time complexity of Mergesort?"
                value={newCard.question}
                onChange={(e) => setNewCard({ ...newCard, question: e.target.value })}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Back (Answer)</label>
              <input
                type="text"
                placeholder="e.g. O(N log N) in all cases (best, average, worst)."
                value={newCard.answer}
                onChange={(e) => setNewCard({ ...newCard, answer: e.target.value })}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.btnRow}>
              <LoadingButton type="submit" loading={isSaving} loadingText="Saving..." style={styles.saveBtn}>Save Card</LoadingButton>
              <button type="button" onClick={() => setShowCreate(false)} style={styles.cancelBtn}>Cancel</button>
            </div>
          </form>
        ) : cards.length === 0 ? (
          <div style={styles.emptyCardState}>
            <FiBookOpen size={48} />
            <h3>No Flashcards Available</h3>
            <p>Select another course or create a new card above.</p>
          </div>
        ) : (
          <div style={styles.cardViewer}>
            {/* Flashcard wrapper */}
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              style={isFlipped ? { ...styles.flashCard, ...styles.flashCardFlipped } : styles.flashCard}
            >
              <div style={styles.cardHeader}>
                <span style={styles.deckCount}>Card {currentIndex + 1} of {cards.length}</span>
                <div style={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleFavorite(currentCard.id, currentCard.is_favorite)}
                    style={currentCard.is_favorite ? { ...styles.actionBtn, ...styles.favActive } : styles.actionBtn}
                  >
                    <FiStar />
                  </button>
                  <button
                    onClick={() => handleToggleLearned(currentCard.id, currentCard.is_learned)}
                    style={currentCard.is_learned ? { ...styles.actionBtn, ...styles.learnedActive } : styles.actionBtn}
                  >
                    <FiCheckCircle />
                  </button>
                </div>
              </div>

              <div style={styles.cardContent}>
                {isFlipped ? currentCard.answer : currentCard.question}
              </div>

              <div style={styles.cardFooter}>
                Click card to flip
              </div>
            </div>

            {/* Navigation row */}
            <div style={styles.navigationRow}>
              <button
                onClick={() => {
                  setCurrentIndex((prev) => Math.max(0, prev - 1));
                  setIsFlipped(false);
                }}
                disabled={currentIndex === 0}
                style={currentIndex === 0 ? { ...styles.navBtn, ...styles.navBtnDisabled } : styles.navBtn}
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setCurrentIndex((prev) => Math.min(cards.length - 1, prev + 1));
                  setIsFlipped(false);
                }}
                disabled={currentIndex === cards.length - 1}
                style={currentIndex === cards.length - 1 ? { ...styles.navBtn, ...styles.navBtnDisabled } : styles.navBtn}
              >
                Next <FiArrowRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    maxWidth: 'var(--max-content-width)',
    margin: '0 auto',
    width: '100%',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
  },
  loadingText: {
    color: 'var(--text-secondary)',
  },
  header: {
    marginBottom: '2.5rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'var(--fw-semibold)',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1.5rem',
    marginBottom: '2.5rem',
    flexWrap: 'wrap',
  },
  filterBar: {
    display: 'flex',
    gap: '1rem',
  },
  select: {
    padding: '0.625rem 1rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  secondaryBtn: {
    padding: '0.625rem 1rem',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  createBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  workspaceGrid: {
    display: 'flex',
    justifyContent: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: '500px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  sectionHeading: {
    fontSize: '1.125rem',
    fontWeight: 'var(--fw-medium)',
    borderBottom: '1px solid var(--border-primary)',
    paddingBottom: '0.5rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 'var(--fw-medium)',
  },
  selectInput: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  input: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
  },
  btnRow: {
    display: 'flex',
    gap: '1rem',
    marginTop: '0.5rem',
  },
  saveBtn: {
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 'var(--fw-semibold)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
  },
  cancelBtn: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    padding: '0.625rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
  },
  emptyCardState: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '5rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    width: '100%',
    maxWidth: '500px',
    color: 'var(--text-secondary)',
  },
  cardViewer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    width: '100%',
    maxWidth: '500px',
  },
  flashCard: {
    height: '280px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'all var(--transition-base)',
  },
  flashCardFlipped: {
    borderColor: 'var(--accent-primary)',
    backgroundColor: 'var(--bg-secondary)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deckCount: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  cardActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0.25rem',
  },
  favActive: {
    color: 'var(--accent-primary)',
  },
  learnedActive: {
    color: 'var(--color-success)',
  },
  cardContent: {
    fontSize: '1.25rem',
    fontWeight: 'var(--fw-medium)',
    lineHeight: '1.5',
    textAlign: 'center',
    padding: '1rem 0',
  },
  cardFooter: {
    textAlign: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  navigationRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  navBtn: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    color: 'var(--text-primary)',
    fontWeight: 'var(--fw-medium)',
    padding: '0.625rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  navBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
