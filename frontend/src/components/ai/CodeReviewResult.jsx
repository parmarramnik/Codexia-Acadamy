import { FiAlertCircle, FiInfo } from 'react-icons/fi';
import MarkdownContent from '../common/MarkdownContent';

const CATEGORY_LABELS = {
  correctness: 'Correctness', bug: 'Bug', security: 'Security', performance: 'Performance', maintainability: 'Maintainability',
};
const SEVERITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral', info: 'neutral' };

function Finding({ finding }) {
  const isIssue = finding.kind === 'issue';
  return (
    <li className={`review-finding ${isIssue ? 'is-issue' : 'is-suggestion'}`}>
      <div className="review-finding-head">
        {isIssue ? <FiAlertCircle size={15} /> : <FiInfo size={15} />}
        <strong>{finding.title}</strong>
      </div>
      <div className="review-finding-tags">
        <span className="badge badge-neutral">{CATEGORY_LABELS[finding.category] || finding.category}</span>
        {isIssue && <span className={`badge badge-${SEVERITY_TONE[finding.severity] || 'neutral'}`}>{finding.severity}</span>}
        {finding.line && <span className="badge badge-neutral">Line {finding.line}</span>}
      </div>
      {finding.detail && <MarkdownContent content={finding.detail} />}
      {finding.suggestion && (
        <div className="review-fix"><span>Fix</span><MarkdownContent content={finding.suggestion} /></div>
      )}
    </li>
  );
}

/** Renders the validated review returned by /ai/coding/review. Shows only what the reviewer reported. */
export default function CodeReviewResult({ review, language }) {
  const issues = (review.findings || []).filter((f) => f.kind === 'issue');
  const suggestions = (review.findings || []).filter((f) => f.kind === 'suggestion');
  return (
    <div className="review">
      {review.summary && <MarkdownContent content={review.summary} />}

      {(review.quality_score !== null && review.quality_score !== undefined || review.time_complexity || review.space_complexity) && (
        <div className="review-stats">
          {review.quality_score !== null && review.quality_score !== undefined && (
            <div className="review-stat"><span>Quality (AI estimate)</span><strong>{review.quality_score}/100</strong></div>
          )}
          {review.time_complexity && <div className="review-stat"><span>Time</span><strong>{review.time_complexity}</strong></div>}
          {review.space_complexity && <div className="review-stat"><span>Space</span><strong>{review.space_complexity}</strong></div>}
        </div>
      )}

      <h4 className="review-heading">Issues</h4>
      {issues.length ? <ul className="review-list">{issues.map((f, i) => <Finding key={i} finding={f} />)}</ul>
        : <p className="review-none">The reviewer didn’t report any defects in this code.</p>}

      {suggestions.length > 0 && (
        <>
          <h4 className="review-heading">Suggestions</h4>
          <ul className="review-list">{suggestions.map((f, i) => <Finding key={i} finding={f} />)}</ul>
        </>
      )}

      {review.recommendations?.length > 0 && (
        <>
          <h4 className="review-heading">Next steps</h4>
          <MarkdownContent content={review.recommendations.map((r) => `1. ${r}`).join('\n')} />
        </>
      )}

      {review.corrected_code && (
        <>
          <h4 className="review-heading">Corrected code</h4>
          <MarkdownContent content={`\`\`\`${language || ''}\n${review.corrected_code}\n\`\`\``} />
        </>
      )}
    </div>
  );
}
