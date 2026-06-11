// Notepad utilities and logic

export interface NotepadState {
  isOpen: boolean;
  content: string;
  position: {
    x: number;
    y: number;
  };
}

// Function to create initial notepad state
export const createInitialNotepadState = (): NotepadState => ({
  isOpen: false,
  content: '',
  position: {
    x: 100,
    y: 100
  }
});

// Function to calculate centered position for notepad
export const calculateCenteredPosition = (
  viewportWidth: number, 
  viewportHeight: number,
  elementWidth: number = 300,
  elementHeight: number = 200
) => {
  const centerX = Math.max(0, (viewportWidth / 2) - (elementWidth / 2));
  const centerY = Math.max(0, (viewportHeight / 2) - (elementHeight / 2));
  
  return { x: centerX, y: centerY };
};

// Function to generate notepad HTML content for fullscreen mode
export const generateNotepadHTML = (notepadId: string, fileName: string, content: string, origin: string = '*'): string => {
  return `
    <html>
      <head>
        <title>Notepad - ${fileName || 'Notes'}</title>
        <style>
          body { 
            margin: 0; 
            font-family: sans-serif;
            transition: background-color 0.3s, color 0.3s;
          }
          
          body.light-theme {
            background-color: #f0f0f0; 
            color: #333;
          }
          
          body.dark-theme {
            background-color: #222; 
            color: #eee;
          }
          
          body {
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
          }
          
          .notepad-header {
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background-color 0.3s;
          }
          
          .light-theme .notepad-header {
            background-color: #333;
            color: white;
          }
          
          .dark-theme .notepad-header {
            background-color: #111;
            color: #eee;
          }
          
          .notepad-controls {
            display: flex;
            gap: 10px;
            border-radius: 10px;
          }
          
          
          button {
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
          }
          
          .light-theme button {
            background-color: #555;
            color: white;
            border-radius: 10px;
          }
          
          .light-theme button:hover {
            background-color: #777;
            transform: scale(1.03)
          }
          
          .dark-theme button {
            background-color: #444;
            color: #eee;
            border-radius: 10px;
          }
          
          .dark-theme button:hover {
            background-color: #666;
            transform: scale(1.03)
          }
          
          textarea {
            flex: 1;
            width: 100%;
            padding: 20px;
            font-size: 16px;
            box-sizing: border-box;
            border: none;
            outline: none;
            resize: none;
            transition: background-color 0.3s, color 0.3s;
          }
          
          .light-theme textarea {
            background-color: #fff;
            color: #333;
          }
          
          .dark-theme textarea {
            background-color: #333;
            color: #eee;
          }
        </style>
      </head>
      <body class="dark-theme">
        <div class="notepad-header">
          <h3>Notes for ${fileName || 'Document'} <span id="imported-filename" style="font-size:12px; opacity:0.8; margin-left:8px;"></span></h3>
          <div class="notepad-controls">
            <button id="theme-toggle">Light Theme</button>
            <button id="import-button">Import File</button>
            <button id="download-button">Download as TXT</button>
            <button id="home-button">Home</button>
            <input type="file" id="file-input" accept=".json,.dat,.txt" style="display:none" />
          </div>
        </div>
        <textarea id="${notepadId}">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea>
        
        <script>
          // Get references to elements
          const textarea = document.getElementById('${notepadId}');
          const downloadButton = document.getElementById('download-button');
          const themeToggle = document.getElementById('theme-toggle');
          const importButton = document.getElementById('import-button');
          const fileInput = document.getElementById('file-input');
          const importedFilename = document.getElementById('imported-filename');
          const homeButton = document.getElementById('home-button');
          const body = document.body;
          
          // Set focus to the textarea
          textarea.focus();
          
          // Theme toggle functionality
          themeToggle.addEventListener('click', () => {
            if (body.classList.contains('dark-theme')) {
              body.classList.remove('dark-theme');
              body.classList.add('light-theme');
              themeToggle.textContent = 'Dark Theme';
            } else {
              body.classList.remove('light-theme');
              body.classList.add('dark-theme');
              themeToggle.textContent = 'Light Theme';
            }
          });

          // Import file functionality
          importButton.addEventListener('click', () => {
            fileInput.click();
          });

          fileInput.addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const text = typeof reader.result === 'string' ? reader.result : '';
                textarea.value = text;
                importedFilename.textContent = '(Imported: ' + file.name + ')';
                // Notify parent of content change immediately
                if (window.opener && !window.opener.closed) {
                  window.opener.postMessage({ type: 'notepad-content', content: textarea.value }, '${origin}');
                }
                alert('File imported successfully.');
              } catch (e) {
                console.error('Error processing file:', e);
                alert('Failed to import file. Ensure it is UTF-8 text.');
              }
            };
            reader.onerror = () => {
              alert('Error reading file. Please try another file.');
            };
            reader.readAsText(file, 'UTF-8');
          });

          // Function to send content back to parent window
          function saveContent() {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({
                type: 'notepad-content',
                content: textarea.value
              }, '${origin}');
            }
          }
          
          // Function to download content as text file
          function downloadContent() {
            const fileName = '${fileName || 'notes'}_notes.txt';
            const blob = new Blob([textarea.value], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
          
          // Add event listeners
          downloadButton.addEventListener('click', downloadContent);
          homeButton.addEventListener('click', () => {
            window.location.href = '/DynamicOpenArchive/';
          });
          
          // Auto-save periodically
          setInterval(saveContent, 5000);
          
          // Save when closing the window
          window.addEventListener('beforeunload', saveContent);
        </script>
      </body>
    </html>
  `;
};

// Function to save notepad content as a text file
export const saveNotepadContent = (content: string, fileName: string): void => {
  if (!content.trim()) {
    alert('Notepad is empty. Please add some notes before saving.');
    return;
  }
  
  const fileNameWithExt = `${fileName}_notes.txt`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = fileNameWithExt;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};