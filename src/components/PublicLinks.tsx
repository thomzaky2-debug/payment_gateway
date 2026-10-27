import { apiUrl } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export function PublicLinks() {
  const { isDark } = useTheme();
  const { isRtl } = useLanguage();

  const links = [
    {
      label: isRtl ? 'سياسة الخصوصية' : 'Privacy Policy',
      href: apiUrl('/privacy'),
      external: true,
    },
    {
      label: isRtl ? 'الدعم الفني' : 'Support',
      href: '#support/',
      external: false,
    },
    {
      label: isRtl ? 'حذف الحساب والبيانات' : 'Account deletion',
      href: apiUrl('/account-deletion'),
      external: true,
    },
  ];

  const baseColor = isDark ? '#94a3b8' : '#64748b';
  const hoverColor = isDark ? '#f8fafc' : '#0f172a';

  return (
    <nav
      aria-label="Privacy and support"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '18px 20px',
        marginTop: '12px',
        borderTop: isDark ? '1px solid rgba(51, 65, 85, 0.35)' : '1px solid rgba(226, 232, 240, 0.8)',
        fontSize: '12px',
        fontWeight: 500,
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      {links.map((item, idx) => (
        <span key={item.href} style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
          <a
            href={item.href}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener noreferrer' : undefined}
            style={{
              color: baseColor,
              textDecoration: 'none',
              transition: 'color 0.18s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = hoverColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = baseColor;
            }}
          >
            {item.label}
          </a>
          {idx < links.length - 1 && (
            <span aria-hidden="true" style={{ color: isDark ? '#334155' : '#cbd5e1', userSelect: 'none' }}>
              •
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
