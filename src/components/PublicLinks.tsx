import { apiUrl } from '../services/api';

export function PublicLinks() {
  return <nav aria-label="Privacy and support" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20, padding: 20, fontSize: 14 }}>
    <a href={apiUrl('/privacy')} target="_blank" rel="noopener noreferrer">Privacy Policy</a>
    <a href="#support/">Support</a>
    <a href={apiUrl('/account-deletion')} target="_blank" rel="noopener noreferrer">Account deletion</a>
  </nav>;
}
