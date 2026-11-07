/**
 * Launch settings. Edit these before you deploy.
 * Leave contactEmail or linkedinUrl empty ('') to hide that link.
 */
export const SITE = {
  name: 'FinPulse Analytics',
  ownerName: 'Agamjot Kaur',
  contactEmail: 'agamkalsi07@gmail.com', // e.g. 'amrit@example.com'
  linkedinUrl: 'www.linkedin.com/in/agamjot-kaur-190261335', // e.g. 'https://www.linkedin.com/in/your-profile'
  tagline: 'Find the numbers that don’t belong.',
  description:
    'FinPulse scans financial spreadsheets for errors, duplicates and fraud patterns in seconds, and explains every flag in plain English. Files never leave your browser.',
};

export function contactHref(): string | null {
  if (SITE.contactEmail) return `mailto:${SITE.contactEmail}?subject=${encodeURIComponent('FinPulse')}`;
  if (SITE.linkedinUrl) return SITE.linkedinUrl;
  return null;
}
