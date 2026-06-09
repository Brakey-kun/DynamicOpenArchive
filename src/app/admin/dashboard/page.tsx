'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminDashboard() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Check if admin is authenticated
    const adminAuth = localStorage.getItem('adminAuthenticated')
    
    if (adminAuth !== 'true') {
      router.push('/admin')
      return
    }
    
    setIsAuthenticated(true)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('adminAuthenticated')
    router.push('/admin')
  }

  if (!isAuthenticated) {
    return <div className="p-8">Checking authentication...</div>
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700"
          >
            Logout
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link 
            href="/admin/semester/1" 
            className="p-6 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-semibold">Manage Semester 1</h2>
            
          </Link>
          
          <Link 
            href="/admin/semester/2" 
            className="p-6 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-semibold">Manage Semester 2</h2>
            
          </Link>
          
          <Link 
            href="/admin/semester/3" 
            className="p-6 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-semibold">Manage Semester 3</h2>
            
          </Link>
          
          <Link 
            href="/admin/semester/4" 
            className="p-6 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-xl font-semibold">Manage Semester 4</h2>
            
          </Link>
          
          {/* More semesters can be added */}
        </div>
        
        <div className="mt-8">
          <Link 
            href="/" 
            className="text-blue-600 hover:underline"
          >
            View Public Site
          </Link>
        </div>
      </div>
    </main>
  )
}