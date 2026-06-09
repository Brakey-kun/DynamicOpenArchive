'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Element, Lesson, Folder, isFolder, isLesson } from '@/app/api/semesters/types'

interface File {
  id: string;
  title: string;
  link: string;
  available: boolean;
}

interface Subject {
  id: string;
  title: string;
  files?: File[];
  lessons?: Element[]; // Updated to support both lessons and folders
}

interface SemesterData {
  id: string;
  title: string;
  subjects: Subject[];
}

export default function AdminPage() {
  const downloadJSON = (filename: string, data: any) => {
    try {
      const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Backup download failed:', e);
    }
  };
  const timestamp = () => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };
  const router = useRouter();
  const [userSession, setUserSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [semesters, setSemesters] = useState<SemesterData[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('1');
  const [currentSemesterData, setCurrentSemesterData] = useState<SemesterData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [newElementType, setNewElementType] = useState<'lesson' | 'folder'>('lesson');
  // Dev Notes editor state
  const [devNotesRaw, setDevNotesRaw] = useState('');
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesMessage, setNotesMessage] = useState('');

  // Data source removed: use local files only

  useEffect(() => {
    // Check if user is logged in and is admin
    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        setUserSession(session);

        if (!session.isAdmin) {
          // Redirect non-admin users
          router.push('/');
        }
      } catch (error) {
        console.error("Error parsing user session:", error);
        router.push('/');
      }
    } else {
      // Redirect if not logged in
      router.push('/');
    }

    // Fetch available semesters
    const fetchSemesters = async () => {
      try {
        // Updated to include semesters 1-9 with specializations for S7, S8, and S9
        const semestersList = [
          { id: '1', title: 'Semester 1', subjects: [] },
          { id: '2', title: 'Semester 2', subjects: [] },
          { id: '3', title: 'Semester 3', subjects: [] },
          { id: '4', title: 'Semester 4', subjects: [] },
          { id: '5', title: 'Semester 5', subjects: [] },
          { id: '6', title: 'Semester 6', subjects: [] },
          // Semester 7 specializations
          { id: 's7_bigdata_ai', title: 'S7 - Big Data & AI', subjects: [] },
          { id: 's7_cybersecurity', title: 'S7 - Cybersecurity', subjects: [] },
          { id: 's7_cloud', title: 'S7 - Cloud', subjects: [] },
          { id: 's7_software', title: 'S7 - Software Engineering', subjects: [] },
          // Semester 8 specializations
          { id: 's8_bigdata_ai', title: 'S8 - Big Data & AI', subjects: [] },
          { id: 's8_cybersecurity', title: 'S8 - Cybersecurity', subjects: [] },
          { id: 's8_cloud', title: 'S8 - Cloud', subjects: [] },
          { id: 's8_software', title: 'S8 - Software Engineering', subjects: [] },
          // Semester 9 specializations
          { id: 's9_bigdata_ai', title: 'S9 - Big Data & AI', subjects: [] },
          { id: 's9_cybersecurity', title: 'S9 - Cybersecurity', subjects: [] },
          { id: 's9_cloud', title: 'S9 - Cloud', subjects: [] },
          { id: 's9_software', title: 'S9 - Software Engineering', subjects: [] }
        ];

        setSemesters(semestersList);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching semesters:", error);
        setLoading(false);
      }
    };

    fetchSemesters();
  }, [router]);

  // Fetch semester data when selected semester changes
  useEffect(() => {
    if (selectedSemester) {
      const controller = new AbortController();
      const fetchSemesterData = async () => {
        try {
          const response = await fetch(`/api/semesters/${selectedSemester}`, {
            headers: {
              ...(userSession?.token ? { Authorization: `Bearer ${userSession.token}` } : {}),
            },
            signal: controller.signal,
          });

          if (response.ok) {
            const data = await response.json();
            setCurrentSemesterData(data);
          } else {
            // If semester doesn't exist yet, create an empty one
            const semesterTitle = semesters.find(s => s.id === selectedSemester)?.title || `Semester ${selectedSemester}`;
            setCurrentSemesterData({
              id: selectedSemester,
              title: semesterTitle,
              subjects: []
            });
          }
        } catch (error: any) {
          if (error?.name !== 'AbortError') {
            console.error("Error fetching semester data:", error);
          }
          // Create empty semester data
          const semesterTitle = semesters.find(s => s.id === selectedSemester)?.title || `Semester ${selectedSemester}`;
          setCurrentSemesterData({
            id: selectedSemester,
            title: semesterTitle,
            subjects: []
          });
        }
      };

      fetchSemesterData();
      return () => {
        try { controller.abort(); } catch { }
      };
    }
  }, [selectedSemester]);

  // Load existing dev notes for editor
  useEffect(() => {
    const loadNotes = async () => {
      const controller = new AbortController();
      try {
        const res = await fetch('/api/devnotes', {
          headers: {
            ...(userSession?.token ? { Authorization: `Bearer ${userSession.token}` } : {}),
          },
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setDevNotesRaw(JSON.stringify(data, null, 2));
        } else {
          setDevNotesRaw('// No notes found. Start typing JSON here.');
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Failed to load dev notes:', err);
        }
        setDevNotesRaw('// Error loading notes. Start typing JSON here.');
      } finally {
        setNotesLoading(false);
      }
    };
    loadNotes();
    return () => {
      try { /* abort if in-flight */ } catch { }
    };
  }, []);



  // Function to add a new subject
  const addSubject = () => {
    if (!currentSemesterData) return;

    const newSubject: Subject = {
      id: Date.now().toString(),
      title: 'New Subject',
      files: [],
      lessons: []
    };

    setCurrentSemesterData({
      ...currentSemesterData,
      subjects: [...currentSemesterData.subjects, newSubject]
    });
  };

  // Function to update subject title
  const updateSubjectTitle = (subjectId: string, newTitle: string) => {
    if (!currentSemesterData) return;

    const updatedSubjects = currentSemesterData.subjects.map(subject => {
      if (subject.id === subjectId) {
        return { ...subject, title: newTitle };
      }
      return subject;
    });

    setCurrentSemesterData({
      ...currentSemesterData,
      subjects: updatedSubjects
    });
  };

  // Save Dev Notes to blob via API
  const saveDevNotes = async () => {
    setNotesSaving(true);
    setNotesMessage('');
    try {
      let payload: any = {};
      try {
        payload = JSON.parse(devNotesRaw || '{}');
      } catch (e) {
        setNotesMessage('Invalid JSON. Please fix and try again.');
        setNotesSaving(false);
        return;
      }

      const response = await fetch('/api/devnotes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(userSession?.token ? { Authorization: `Bearer ${userSession.token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setNotesMessage('Dev notes saved successfully!');
        // Download backup of saved dev notes
        downloadJSON(`dev-notes-backup-${timestamp()}.json`, payload);
      } else {
        const data = await response.json();
        setNotesMessage(`Error: ${data.error || 'Failed to save dev notes'}`);
      }
    } catch (error) {
      console.error('Error saving dev notes:', error);
      setNotesMessage('Error: Failed to save dev notes. Check console for details.');
    } finally {
      setNotesSaving(false);
      setTimeout(() => setNotesMessage(''), 3000);
    }
  };

  // Function to add a file to a subject
  const addFile = (subjectId: string) => {
    if (!currentSemesterData) return;

    const updatedSubjects = currentSemesterData.subjects.map(subject => {
      if (subject.id === subjectId) {
        const newFile: File = {
          id: Date.now().toString(),
          title: 'New File',
          link: '',
          available: true
        };

        return {
          ...subject,
          files: [...(subject.files || []), newFile]
        };
      }
      return subject;
    });

    setCurrentSemesterData({
      ...currentSemesterData,
      subjects: updatedSubjects
    });
  };

  // Function to add a lesson or folder to a subject
  const addElement = (subjectId: string) => {
    if (!currentSemesterData) return;

    const updatedSubjects = currentSemesterData.subjects.map(subject => {
      if (subject.id === subjectId) {
        const newElement: Element = newElementType === 'folder'
          ? {
            id: Date.now().toString(),
            title: 'New Folder',
            type: 'folder',
            url: ''
          } as Folder
          : {
            id: Date.now().toString(),
            title: 'New Lesson',
            link: ''
          } as Lesson;

        return {
          ...subject,
          lessons: [...(subject.lessons || []), newElement]
        };
      }
      return subject;
    });

    setCurrentSemesterData({
      ...currentSemesterData,
      subjects: updatedSubjects
    });

    // Reset editing state
    setEditingSubject(null);
  };

  // Function to update file details
  const updateFile = (subjectId: string, fileId: string, field: keyof File, value: any) => {
    if (!currentSemesterData) return;

    const updatedSubjects = currentSemesterData.subjects.map(subject => {
      if (subject.id === subjectId && subject.files) {
        const updatedFiles = subject.files.map(file => {
          if (file.id === fileId) {
            return { ...file, [field]: value };
          }
          return file;
        });

        return { ...subject, files: updatedFiles };
      }
      return subject;
    });

    setCurrentSemesterData({
      ...currentSemesterData,
      subjects: updatedSubjects
    });
  };

  // Function to update lesson details
  const updateLesson = (subjectId: string, lessonId: string, field: string, value: any) => {
    if (!currentSemesterData) return;

    const updatedSubjects = currentSemesterData.subjects.map(subject => {
      if (subject.id === subjectId && subject.lessons) {
        const updatedLessons = subject.lessons.map(lesson => {
          if (lesson.id === lessonId) {
            if (isFolder(lesson)) {
              // Handle folder properties
              if (field === 'url' || field === 'title' || field === 'number') {
                return { ...lesson, [field]: value };
              }
            } else {
              // Handle lesson properties
              if (field === 'title' || field === 'link' || field === 'url' || field === 'number') {
                return { ...lesson, [field]: value };
              }
            }
          }
          return lesson;
        });

        return { ...subject, lessons: updatedLessons };
      }
      return subject;
    });

    setCurrentSemesterData({
      ...currentSemesterData,
      subjects: updatedSubjects
    });
  };

  // Function to delete a subject
  const deleteSubject = (subjectId: string) => {
    if (!currentSemesterData) return;

    const updatedSubjects = currentSemesterData.subjects.filter(
      subject => subject.id !== subjectId
    );

    setCurrentSemesterData({
      ...currentSemesterData,
      subjects: updatedSubjects
    });
  };

  // Function to delete a file
  const deleteFile = (subjectId: string, fileId: string) => {
    if (!currentSemesterData) return;

    const updatedSubjects = currentSemesterData.subjects.map(subject => {
      if (subject.id === subjectId && subject.files) {
        const updatedFiles = subject.files.filter(file => file.id !== fileId);
        return { ...subject, files: updatedFiles };
      }
      return subject;
    });

    setCurrentSemesterData({
      ...currentSemesterData,
      subjects: updatedSubjects
    });
  };

  // Function to delete a lesson
  const deleteLesson = (subjectId: string, lessonId: string) => {
    if (!currentSemesterData) return;

    const updatedSubjects = currentSemesterData.subjects.map(subject => {
      if (subject.id === subjectId && subject.lessons) {
        const updatedLessons = subject.lessons.filter(lesson => lesson.id !== lessonId);
        return { ...subject, lessons: updatedLessons };
      }
      return subject;
    });

    setCurrentSemesterData({
      ...currentSemesterData,
      subjects: updatedSubjects
    });
  };

  // Function to move a subject up in the list
  const moveSubjectUp = (subjectId: string) => {
    if (!currentSemesterData) return;

    const subjects = [...currentSemesterData.subjects];
    const index = subjects.findIndex(subject => subject.id === subjectId);

    if (index > 0) {
      // Swap with the previous item
      [subjects[index], subjects[index - 1]] = [subjects[index - 1], subjects[index]];

      setCurrentSemesterData({
        ...currentSemesterData,
        subjects
      });
    }
  };

  // Function to move a subject down in the list
  const moveSubjectDown = (subjectId: string) => {
    if (!currentSemesterData) return;

    const subjects = [...currentSemesterData.subjects];
    const index = subjects.findIndex(subject => subject.id === subjectId);

    if (index < subjects.length - 1) {
      // Swap with the next item
      [subjects[index], subjects[index + 1]] = [subjects[index + 1], subjects[index]];

      setCurrentSemesterData({
        ...currentSemesterData,
        subjects
      });
    }
  };

  // Function to move a lesson up in the list
  const moveLessonUp = (subjectId: string, lessonId: string) => {
    if (!currentSemesterData) return;

    const updatedSubjects = currentSemesterData.subjects.map(subject => {
      if (subject.id === subjectId && subject.lessons) {
        const lessons = [...subject.lessons];
        const index = lessons.findIndex(lesson => lesson.id === lessonId);

        if (index > 0) {
          // Swap with the previous item
          [lessons[index], lessons[index - 1]] = [lessons[index - 1], lessons[index]];
          return { ...subject, lessons };
        }
      }
      return subject;
    });

    setCurrentSemesterData({
      ...currentSemesterData,
      subjects: updatedSubjects
    });
  };

  // Function to move a lesson down in the list
  const moveLessonDown = (subjectId: string, lessonId: string) => {
    if (!currentSemesterData) return;

    const updatedSubjects = currentSemesterData.subjects.map(subject => {
      if (subject.id === subjectId && subject.lessons) {
        const lessons = [...subject.lessons];
        const index = lessons.findIndex(lesson => lesson.id === lessonId);

        if (index < lessons.length - 1) {
          // Swap with the next item
          [lessons[index], lessons[index + 1]] = [lessons[index + 1], lessons[index]];
          return { ...subject, lessons };
        }
      }
      return subject;
    });

    setCurrentSemesterData({
      ...currentSemesterData,
      subjects: updatedSubjects
    });
  };

  // Function to save semester data to the server
  const saveSemesterData = async () => {
    if (!currentSemesterData) return;

    setSaving(true);
    setSaveMessage('');

    try {
      const response = await fetch(`/api/semesters/${selectedSemester}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(userSession?.token ? { Authorization: `Bearer ${userSession.token}` } : {}),
        },
        body: JSON.stringify(currentSemesterData),
      });

      if (response.ok) {
        setSaveMessage('Semester data saved successfully!');
        // Also save to localStorage as a backup
        localStorage.setItem(`semester_${selectedSemester}`, JSON.stringify(currentSemesterData));
        // Download backup of saved semester data
        downloadJSON(`semester-${selectedSemester}-backup-${timestamp()}.json`, currentSemesterData);
      } else {
        const data = await response.json();
        setSaveMessage(`Error: ${data.error || 'Failed to save data'}`);
      }
    } catch (error) {
      console.error("Error saving semester data:", error);
      setSaveMessage('Error: Failed to save data. Check console for details.');
    } finally {
      setSaving(false);

      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!userSession || !userSession.isAdmin) {
    return <div>Access denied. Admin privileges required.</div>;
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Admin Panel</h1>
        <Link href="/" className="back-link">Back to Home</Link>
      </header>

      {/* Dev Notes Editor */}
      <div className="devnotes-editor">
        <div className="devnotes-header">
          <h2>Dev Notes Editor</h2>
          <div className="devnotes-actions">
            <button
              onClick={saveDevNotes}
              className="save-button"
              disabled={notesSaving}
            >
              {notesSaving ? 'Saving...' : 'Save Dev Notes'}
            </button>
          </div>
        </div>
        <p className="devnotes-help">Edit the JSON used by the Dev Notes viewer. Keep keys like `title`, `lastUpdated`, `version`, `sections`, and optional `topnote`.</p>
        {notesLoading ? (
          <div className="save-message">Loading dev notes...</div>
        ) : (
          <textarea
            className="devnotes-textarea"
            value={devNotesRaw}
            onChange={(e) => setDevNotesRaw(e.target.value)}
            rows={18}
            spellCheck={false}
          />
        )}
        {notesMessage && <div className="save-message">{notesMessage}</div>}
      </div>



      <div className="semester-selector">
        <label htmlFor="semester-select">Select Semester:</label>
        <select
          id="semester-select"
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
        >
          {semesters.map(semester => (
            <option key={semester.id} value={semester.id}>
              {semester.title}
            </option>
          ))}
        </select>
      </div>

      {currentSemesterData && (
        <div className="semester-editor">
          <h2>Editing {currentSemesterData.title}</h2>
          {/* Source badge removed; editor is now local-only */}

          <div className="subjects-container">
            {currentSemesterData.subjects.map(subject => (
              <div key={subject.id} className="subject-card">
                <div className="subject-header">
                  <input
                    type="text"
                    value={subject.title}
                    onChange={(e) => updateSubjectTitle(subject.id, e.target.value)}
                    className="subject-title-input"
                  />
                  <div className="subject-actions">
                    <div className="order-controls">
                      <input
                        type="number"
                        min="1"
                        max={currentSemesterData.subjects.length}
                        value={currentSemesterData.subjects.findIndex(s => s.id === subject.id) + 1}
                        onChange={(e) => {
                          const newIndex = parseInt(e.target.value) - 1;
                          const currentIndex = currentSemesterData.subjects.findIndex(s => s.id === subject.id);
                          if (newIndex >= 0 && newIndex < currentSemesterData.subjects.length && newIndex !== currentIndex) {
                            const newSubjects = [...currentSemesterData.subjects];
                            const [movedItem] = newSubjects.splice(currentIndex, 1);
                            newSubjects.splice(newIndex, 0, movedItem);
                            setCurrentSemesterData({
                              ...currentSemesterData,
                              subjects: newSubjects
                            });
                          }
                        }}
                        className="order-input"
                      />
                      <button
                        onClick={() => moveSubjectUp(subject.id)}
                        className="order-button"
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveSubjectDown(subject.id)}
                        className="order-button"
                        title="Move Down"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      onClick={() => deleteSubject(subject.id)}
                      className="delete-button"
                    >
                      Delete Subject
                    </button>
                  </div>
                </div>

                <div className="subject-content">
                  <div className="lessons-section">
                    <h4>Lessons</h4>
                    {subject.lessons && subject.lessons.map(lesson => (
                      <div key={lesson.id} className="lesson-editor">
                        <input
                          type="text"
                          value={lesson.title}
                          onChange={(e) => updateLesson(subject.id, lesson.id, 'title', e.target.value)}
                          placeholder={isFolder(lesson) ? "Folder Title" : "Lesson Title"}
                          className="lesson-input"
                        />
                        {isFolder(lesson) ? (
                          <input
                            type="text"
                            value={lesson.url || ''}
                            onChange={(e) => updateLesson(subject.id, lesson.id, 'url', e.target.value)}
                            placeholder="Folder URL"
                            className="lesson-input"
                          />
                        ) : (
                          <input
                            type="text"
                            value={lesson.link || ''}
                            onChange={(e) => updateLesson(subject.id, lesson.id, 'link', e.target.value)}
                            placeholder="Lesson Link"
                            className="lesson-input"
                          />
                        )}
                        <div className="lesson-actions">
                          <div className="order-controls">
                            <input
                              type="number"
                              min="1"
                              max={subject.lessons?.length || 0}
                              value={(subject.lessons && subject.lessons.findIndex(l => l.id === lesson.id) + 1) || 1}
                              onChange={(e) => {
                                const newIndex = parseInt(e.target.value) - 1;
                                const currentIndex = subject.lessons?.findIndex(l => l.id === lesson.id) || 0;
                                if (subject.lessons && newIndex >= 0 && newIndex < subject.lessons.length && newIndex !== currentIndex) {
                                  const newLessons = [...subject.lessons];
                                  const [movedItem] = newLessons.splice(currentIndex, 1);
                                  newLessons.splice(newIndex, 0, movedItem);

                                  const updatedSubjects = currentSemesterData.subjects.map(s => {
                                    if (s.id === subject.id) {
                                      return { ...s, lessons: newLessons };
                                    }
                                    return s;
                                  });

                                  setCurrentSemesterData({
                                    ...currentSemesterData,
                                    subjects: updatedSubjects
                                  });
                                }
                              }}
                              className="order-input small"
                            />
                            <button
                              onClick={() => moveLessonUp(subject.id, lesson.id)}
                              className="order-button small"
                              title="Move Up"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveLessonDown(subject.id, lesson.id)}
                              className="order-button small"
                              title="Move Down"
                            >
                              ↓
                            </button>
                          </div>
                          <button
                            onClick={() => deleteLesson(subject.id, lesson.id)}
                            className="delete-button small"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}

                    {editingSubject === subject.id ? (
                      <div className="add-element-form">
                        <div className="element-type-selection">
                          <label>
                            <input
                              type="radio"
                              name={`elementType-${subject.id}`}
                              value="lesson"
                              checked={newElementType === 'lesson'}
                              onChange={(e) => setNewElementType(e.target.value as 'lesson' | 'folder')}
                            />
                            Lesson
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`elementType-${subject.id}`}
                              value="folder"
                              checked={newElementType === 'folder'}
                              onChange={(e) => setNewElementType(e.target.value as 'lesson' | 'folder')}
                            />
                            Folder
                          </label>
                        </div>
                        <div className="form-buttons">
                          <button
                            onClick={() => addElement(subject.id)}
                            className="add-button"
                          >
                            Add {newElementType === 'folder' ? 'Folder' : 'Lesson'}
                          </button>
                          <button
                            onClick={() => setEditingSubject(null)}
                            className="cancel-button"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingSubject(subject.id)}
                        className="add-button"
                      >
                        Add Lesson/Folder
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addSubject}
              className="add-subject-button"
            >
              Add New Subject
            </button>
          </div>

          <div className="save-section">
            <button
              onClick={saveSemesterData}
              className="save-button"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saveMessage && <div className="save-message">{saveMessage}</div>}
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          color: white;
          background-color: #121212;
          min-height: 100vh;
        }

        .devnotes-editor {
          background-color: #1e1e1e;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 24px;
          border: 1px solid #333;
        }
        .devnotes-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .devnotes-help {
          color: #aaa;
          margin: 8px 0 12px;
          font-size: 14px;
        }
        .devnotes-textarea {
          width: 100%;
          background-color: #111;
          color: #e6e6e6;
          border: 1px solid #444;
          border-radius: 6px;
          padding: 12px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 14px;
        }
        
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 1px solid #333;
        }
        
        .back-link {
          color: #4a90e2;
          text-decoration: none;
        }
        
        .back-link:hover {
          text-decoration: underline;
        }
        
        .semester-selector {
          margin-bottom: 20px;
        }
        
        select {
          padding: 8px;
          margin-left: 10px;
          background-color: #333;
          color: white;
          border: 1px solid #555;
          border-radius: 4px;
        }
        
        .semester-editor {
          background-color: #1e1e1e;
          padding: 20px;
          border-radius: 8px;
        }
        
        .subjects-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-top: 20px;
        }
        
        .subject-card {
          background-color: #2a2a2a;
          border-radius: 6px;
          padding: 15px;
        }
        
        .subject-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .subject-title-input {
          font-size: 18px;
          padding: 8px;
          background-color: #333;
          color: white;
          border: 1px solid #555;
          border-radius: 4px;
          width: 60%;
        }
        
        .subject-content {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        
        .lessons-section {
          background-color: #222;
          padding: 20px;
          border-radius: 6px;
          width: 100%;
        }
        
        .lesson-editor {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 15px;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #444;
          align-items: center;
        }
        
        .lesson-input {
          padding: 12px;
          background-color: #333;
          color: white;
          border: 1px solid #555;
          border-radius: 4px;
          width: 100%;
          font-size: 15px;
          min-height: 42px;
        }
        
        .lesson-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: flex-end;
          white-space: nowrap;
        }
        
        .order-controls {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .order-input {
          width: 50px;
          padding: 4px;
          text-align: center;
          background-color: #333;
          color: white;
          border: 1px solid #555;
          border-radius: 4px;
        }
        
        .order-input.small {
          width: 40px;
          padding: 2px;
          font-size: 12px;
        }
        
        
        
        .lessons-section {
          background-color: #222;
          padding: 15px;
          border-radius: 6px;
        }
        
        .lesson-editor {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #444;
        }
        
         .lesson-input {
          padding: 8px;
          background-color: #333;
          color: white;
          border: 1px solid #555;
          border-radius: 4px;
          flex: 1;
          min-width: 150px;
        }
        
        
        .add-button, .delete-button, .add-subject-button, .save-button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        
        .add-button {
          background-color: #4a90e2;
          color: white;
        }
        
        .add-button:hover {
          background-color: #357ab8;
        }
        
        .delete-button {
          background-color: #e25c5c;
          color: white;
        }
        
        .delete-button:hover {
          background-color: #c04545;
        }
        
        .delete-button.small {
          padding: 4px 8px;
          font-size: 12px;
        }
        
        .add-subject-button {
          background-color: #50c878;
          color: white;
          margin-top: 20px;
          padding: 12px;
          font-size: 16px;
        }
        
        .add-subject-button:hover {
          background-color: #3da05e;
        }
        
        .save-section {
          margin-top: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .save-button {
          background-color: #50c878;
          color: white;
          padding: 12px 24px;
          font-size: 16px;
        }
        
        .save-button:hover:not(:disabled) {
          background-color: #3da05e;
        }
        
        .save-button:disabled {
          background-color: #555;
          cursor: not-allowed;
        }
        
        .save-message {
          margin-top: 10px;
          padding: 8px 16px;
          background-color: #333;
          border-radius: 4px;
        }
        

                  .subject-actions, .lesson-actions {
          display: flex;
          gap: 5px;
          align-items: center;
        }
        
        .order-button {
          background-color: #4a90e2;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .order-button:hover {
          background-color: #357ab8;
        }
        
        .order-button.small {
          width: 24px;
          height: 24px;
          font-size: 12px;
        }
        
        .save-button:disabled {
          background-color: #555;
          cursor: not-allowed;
        }
        
        .save-message {
          margin-top: 10px;
          padding: 8px 16px;
          background-color: #333;
          border-radius: 4px;
        }
      
        .devnotes-textarea {
          width: 100%;
          background-color: #1e1e1e;
          color: #d4d4d4;
          border: 1px solid #333;
          border-radius: 4px;
          padding: 10px;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 14px;
          line-height: 1.5;
          resize: vertical;
        }

        @media (max-width: 768px) {
          .admin-container {
            padding: 10px;
          }
          
          .subject-header, .lesson-editor {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          
          .subject-actions, .lesson-actions {
            width: 100%;
            justify-content: space-between;
            margin-top: 5px;
          }
          
          .order-controls {
            flex-grow: 1;
          }
          
          .subject-title-input, .lesson-input {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}