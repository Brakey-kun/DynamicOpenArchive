// Semester data types and interfaces

export interface File {
  id: string;
  title: string;
  link: string;
  available: boolean;
}

// Base interface for all elements (lessons and folders)
export interface BaseElement {
  id: string;
  title: string;
  number?: number; // For ordering
}

// Lesson element
export interface Lesson extends BaseElement {
  type?: 'lesson'; // Default type for backward compatibility
  link?: string;
  url?: string;
}

// Folder element
export interface Folder extends BaseElement {
  type: 'folder';
  url: string; // Google Drive folder link
}

// Union type for all elements
export type Element = Lesson | Folder;

export interface Subject {
  id: string;
  title: string;
  number?: number; // For ordering
  files?: File[];
  lessons?: Element[]; // Now supports both lessons and folders
}

export interface SemesterData {
  id: string;
  title: string;
  subjects: Subject[];
}

// Type guard functions
export const isFolder = (element: Element): element is Folder => {
  return element.type === 'folder';
};

export const isLesson = (element: Element): element is Lesson => {
  return !element.type || element.type === 'lesson';
};

// Function to get the correct archive link based on semester ID
export const getSemesterArchiveLink = (semesterId: string): string => {
  // Define a mapping of semester IDs to their archive URLs
  const archiveLinks: Record<string, string> = {
    '1': 'https://drive.google.com/drive/folders/1Z64EXes1cvoaV83YsjBjGdpkcBuBunnN?usp=drive_link',
    '2': 'https://drive.google.com/drive/folders/1qBPgJstw-C8Lsq-l1DY7drOkGO2MPYeo?usp=drive_link',
    '3': 'https://drive.google.com/drive/folders/1rQ4_JWINl9-j7Xd9RdY1iw4tyrjcseuo?usp=drive_link',
    '4': 'https://drive.google.com/drive/folders/1Rpv8zeTZzE1W34f4muDIzURkCBNuyxkC?usp=drive_link',
    '5': 'https://drive.google.com/drive/folders/1rgRzmZTcMGZNI4ZJDLZNp-bMtFJ65HhO?usp=drive_link',
    '6': '/',
    // Specialization IDs default to '/' for now; customize if needed
    's7_bigdata_ai': '/',
    's7_cybersecurity': '/',
    's7_cloud': '/',
    's7_software': '/',
    's8_bigdata_ai': '/',
    's8_cybersecurity': '/',
    's8_cloud': '/',
    's8_software': '/',
    '9': '/',
    '10': '/',
  };

  // Legacy fallback: map numeric 7/8 or 's7'/'s8' to default specialization
  if (semesterId === '7' || semesterId.toLowerCase() === 's7') return archiveLinks['s7_bigdata_ai'];
  if (semesterId === '8' || semesterId.toLowerCase() === 's8') return archiveLinks['s8_bigdata_ai'];

  // Return the corresponding link or a default one if not found
  return archiveLinks[semesterId] || '#';
}