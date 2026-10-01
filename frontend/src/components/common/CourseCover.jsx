import { FiBookOpen, FiCode, FiCpu, FiDatabase, FiCloud, FiShield, FiLayout, FiBarChart2 } from 'react-icons/fi';

const ICONS = {
  web_development: FiLayout,
  programming: FiCode,
  dsa: FiCode,
  data_structures: FiCode,
  machine_learning: FiCpu,
  artificial_intelligence: FiCpu,
  data_science: FiBarChart2,
  databases: FiDatabase,
  cloud: FiCloud,
  devops: FiCloud,
  cyber_security: FiShield,
};

// A small set of restrained hues; picked deterministically per course.
const HUES = [239, 258, 199, 172, 222, 280];

function hashString(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * CourseCover — thumbnail image, or a generated cover when none is uploaded.
 */
export default function CourseCover({ src, title = '', category, height = 160, radius = 0 }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        style={{ width: '100%', height, objectFit: 'cover', borderRadius: radius, display: 'block' }}
      />
    );
  }
  const Icon = ICONS[category] || FiBookOpen;
  const hue = HUES[hashString(title || category) % HUES.length];
  return (
    <div className="course-cover" style={{ '--cover-h': hue, height, borderRadius: radius }} aria-hidden="true">
      <span className="course-cover-icon"><Icon size={22} /></span>
    </div>
  );
}
