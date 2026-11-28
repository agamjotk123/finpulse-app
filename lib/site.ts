/**
 * Launch settings. Edit these before you deploy.
 * Leave contactEmail or linkedinUrl empty ('') to hide that link.
 */
export const SITE = {
  name: 'Benfora',
  ownerName: 'Agamjot',
  contactEmail: '', // e.g. 'amrit@example.com'
  linkedinUrl: '', // e.g. 'https://www.linkedin.com/in/your-profile'
  tagline: 'Find the numbers that don’t belong.',
  description:
    'Benfora scans financial spreadsheets for errors, duplicates and fraud patterns in seconds, and explains every flag in plain English. Files never leave your browser.',
};

export function contactHref(): string | null {
  if (SITE.contactEmail) return `mailto:${SITE.contactEmail}?subject=${encodeURIComponent('Benfora')}`;
  if (SITE.linkedinUrl) return SITE.linkedinUrl;
  return null;
}
