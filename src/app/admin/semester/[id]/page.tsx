'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'

// Import updated types
import { Element, Lesson, Folder, isFolder, isLesson } from '@/app/api/semesters/types'

interface Subject {
  id: string;
  title: string;
  lessons: Element[]; // Now supports both lessons and folders
}

interface SemesterData {
  id: string;
  title: string;
  subjects: Subject[];
}

export default function AdminSemesterPage({ params }: { params: { id: string } }) {
  const router = useRouter()
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
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [semesterData, setSemesterData] = useState<SemesterData>({
    id: params.id,
    title: `Semester ${params.id}`,
    subjects: []
  })
  const [newSubjectTitle, setNewSubjectTitle] = useState('')
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [newElementTitle, setNewElementTitle] = useState('')
  const [newElementLink, setNewElementLink] = useState('')
  const [newElementType, setNewElementType] = useState<'lesson' | 'folder'>('lesson')

  useEffect(() => {
    // Check if admin is authenticated
    const adminAuth = localStorage.getItem('adminAuthenticated')
    
    if (adminAuth !== 'true') {
      router.push('/admin')
      return
    }
    
    setIsAuthenticated(true)
    
    // Load semester data
    const storedData = localStorage.getItem(`semester_${params.id}`)
    
    if (storedData) {
      setSemesterData(JSON.parse(storedData))
    }
  }, [params.id, router])

  const saveSemesterData = (data: SemesterData) => {
    localStorage.setItem(`semester_${params.id}`, JSON.stringify(data))
    setSemesterData(data)
    // Download backup of saved semester data
    downloadJSON(`semester-${params.id}-backup-${timestamp()}.json`, data)
  }

  const addSubject = () => {
    if (!newSubjectTitle.trim()) return
    
    const updatedData = {
      ...semesterData,
      subjects: [
        ...semesterData.subjects,
        {
          id: uuidv4(),
          title: newSubjectTitle,
          lessons: []
        }
      ]
    }
    
    saveSemesterData(updatedData)
    setNewSubjectTitle('')
  }

  const addElement = (subjectId: string) => {
    if (!newElementTitle.trim() || !newElementLink.trim()) return
    
    const newElement: Element = newElementType === 'folder' 
      ? {
          id: uuidv4(),
          title: newElementTitle,
          type: 'folder',
          url: newElementLink
        } as Folder
      : {
          id: uuidv4(),
          title: newElementTitle,
          type: 'lesson',
          link: newElementLink
        } as Lesson
    
    const updatedData = {
      ...semesterData,
      subjects: semesterData.subjects.map(subject => {
        if (subject.id === subjectId) {
          return {
            ...subject,
            lessons: [
              ...subject.lessons,
              newElement
            ]
          }
        }
        return subject
      })
    }
    
    saveSemesterData(updatedData)
    setNewElementTitle('')
    setNewElementLink('')
    setEditingSubject(null)
  }

  const removeSubject = (subjectId: string) => {
    const updatedData = {
      ...semesterData,
      subjects: semesterData.subjects.filter(subject => subject.id !== subjectId)
    }
    
    saveSemesterData(updatedData)
  }

  const removeElement = (subjectId: string, elementId: string) => {
    const updatedData = {
      ...semesterData,
      subjects: semesterData.subjects.map(subject => {
        if (subject.id === subjectId) {
          return {
            ...subject,
            lessons: subject.lessons.filter(element => element.id !== elementId)
          }
        }
        return subject
      })
    }
    
    saveSemesterData(updatedData)
  }

  const moveSubject = (subjectId: string, direction: 'up' | 'down') => {
    const subjectIndex = semesterData.subjects.findIndex(s => s.id === subjectId)
    if (
      (direction === 'up' && subjectIndex === 0) || 
      (direction === 'down' && subjectIndex === semesterData.subjects.length - 1)
    ) {
      return
    }
    
    const newSubjects = [...semesterData.subjects]
    const targetIndex = direction === 'up' ? subjectIndex - 1 : subjectIndex + 1
    
    // Swap positions using a temporary variable instead of destructuring
    const temp = newSubjects[subjectIndex];
    newSubjects[subjectIndex] = newSubjects[targetIndex];
    newSubjects[targetIndex] = temp;
    
    saveSemesterData({
      ...semesterData,
      subjects: newSubjects
    })
  }

  const moveElement = (subjectId: string, elementId: string, direction: 'up' | 'down') => {
    const updatedData = {
      ...semesterData,
      subjects: semesterData.subjects.map(subject => {
        if (subject.id === subjectId) {
          const elementIndex = subject.lessons.findIndex(l => l.id === elementId)
          if (
            (direction === 'up' && elementIndex === 0) || 
            (direction === 'down' && elementIndex === subject.lessons.length - 1)
          ) {
            return subject
          }
          
          const newElements = [...subject.lessons]
          const targetIndex = direction === 'up' ? elementIndex - 1 : elementIndex + 1
          
          // Swap positions using a temporary variable instead of destructuring
          const temp = newElements[elementIndex];
          newElements[elementIndex] = newElements[targetIndex];
          newElements[targetIndex] = temp;
          
          return {
            ...subject,
            lessons: newElements
          }
        }
        return subject
      })
    }
    
    saveSemesterData(updatedData)
  }

  if (!isAuthenticated) {
    return <div className="p-8">Checking authentication...</div>
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Manage {semesterData.title}</h1>
          <Link href="/admin/dashboard" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
        
        <div className="mb-8 p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Add New Subject</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSubjectTitle}
              onChange={(e) => setNewSubjectTitle(e.target.value)}
              placeholder="Subject Title"
              className="flex-1 p-2 border rounded-md"
            />
            <button
              onClick={addSubject}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
            >
              Add Subject
            </button>
          </div>
        </div>
        
        <div className="space-y-8">
          {semesterData.subjects.map((subject, index) => (
            <div key={subject.id} className="border rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{subject.title}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => moveSubject(subject.id, 'up')}
                    disabled={index === 0}
                    className={`py-1 px-3 rounded-md ${
                      index === 0 ? 'bg-gray-300' : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveSubject(subject.id, 'down')}
                    disabled={index === semesterData.subjects.length - 1}
                    className={`py-1 px-3 rounded-md ${
                      index === semesterData.subjects.length - 1 
                        ? 'bg-gray-300' 
                        : 'bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeSubject(subject.id)}
                    className="bg-red-600 text-white py-1 px-3 rounded-md hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <h3 className="font-medium mb-2">Lessons & Folders:</h3>
                {subject.lessons.length === 0 ? (
                  <p className="text-gray-500">No lessons or folders yet</p>
                ) : (
                  <ul className="space-y-2">
                    {subject.lessons.map((element, elementIndex) => (
                      <li key={element.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            isFolder(element) 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {isFolder(element) ? 'FOLDER' : 'LESSON'}
                          </span>
                          <span className="font-medium">{element.title}</span>
                          <span className="text-gray-500 text-sm ml-2">
                            ({isFolder(element) ? element.url : (element as Lesson).link})
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => moveElement(subject.id, element.id, 'up')}
                            disabled={elementIndex === 0}
                            className={`py-1 px-2 rounded-md ${
                              elementIndex === 0 ? 'bg-gray-300' : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveElement(subject.id, element.id, 'down')}
                            disabled={elementIndex === subject.lessons.length - 1}
                            className={`py-1 px-2 rounded-md ${
                              elementIndex === subject.lessons.length - 1 
                                ? 'bg-gray-300' 
                                : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removeElement(subject.id, element.id)}
                            className="bg-red-600 text-white py-1 px-2 rounded-md hover:bg-red-700 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {editingSubject === subject.id ? (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h3 className="font-medium mb-2">Add New Element</h3>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`elementType_${subject.id}`}
                          value="lesson"
                          checked={newElementType === 'lesson'}
                          onChange={(e) => setNewElementType(e.target.value as 'lesson' | 'folder')}
                        />
                        Lesson
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`elementType_${subject.id}`}
                          value="folder"
                          checked={newElementType === 'folder'}
                          onChange={(e) => setNewElementType(e.target.value as 'lesson' | 'folder')}
                        />
                        Folder
                      </label>
                    </div>
                    <input
                      type="text"
                      value={newElementTitle}
                      onChange={(e) => setNewElementTitle(e.target.value)}
                      placeholder={`${newElementType === 'folder' ? 'Folder' : 'Lesson'} Title`}
                      className="w-full p-2 border rounded-md"
                    />
                    <input
                      type="text"
                      value={newElementLink}
                      onChange={(e) => setNewElementLink(e.target.value)}
                      placeholder={newElementType === 'folder' ? 'Google Drive Folder URL' : 'Lesson File Link'}
                      className="w-full p-2 border rounded-md"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => addElement(subject.id)}
                        className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
                      >
                        Add {newElementType === 'folder' ? 'Folder' : 'Lesson'}
                      </button>
                      <button
                        onClick={() => setEditingSubject(null)}
                        className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingSubject(subject.id)
                    setNewElementType('lesson') // Reset to default
                  }}
                  className="mt-2 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
                >
                  Add Lesson/Folder
                </button>
              )}
            </div>
          ))}
        </div>
        
        {semesterData.subjects.length === 0 && (
          <div className="text-center p-12 border rounded-lg bg-gray-50">
            <p className="text-gray-500">No subjects added yet. Add your first subject above.</p>
          </div>
        )}
        
        <div className="mt-8">
          <Link 
            href={`/semester/${params.id}`} 
            className="text-blue-600 hover:underline"
            target="_blank"
          >
            View Public Semester Page
          </Link>
        </div>
      </div>
    </main>
  )
}