// File type utilities and previewer logic

export interface PreviewerState {
  isOpen: boolean;
  fileUrl: string;
  fileType: string;
  fileName: string;
}

// Function to determine file type from URL
export const getFileType = (url: string): string => {
  const extension = url.split('.').pop()?.toLowerCase() || '';
  
  if (extension === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(extension)) return 'doc';
  if (['ppt', 'pptx'].includes(extension)) return 'ppt';
  if (['xls', 'xlsx'].includes(extension)) return 'excel';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) return 'image';
  
  return 'unknown';
};

// Function to create initial previewer state
export const createInitialPreviewerState = (): PreviewerState => ({
  isOpen: false,
  fileUrl: '',
  fileType: '',
  fileName: ''
});

// Function to open the file previewer
export const createPreviewerState = (fileUrl: string, fileName: string): PreviewerState => {
  // Determine file type from URL or extension
  const fileType = getFileType(fileUrl);
  
  return {
    isOpen: true,
    fileUrl,
    fileType,
    fileName
  };
};

// Function to create closed previewer state
export const createClosedPreviewerState = (): PreviewerState => ({
  isOpen: false,
  fileUrl: '',
  fileType: '',
  fileName: ''
});