"use client"

import { useEffect, useState } from "react"
import type { Doctor } from "@/types"
import { ENDPOINTS } from "@/config/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchWithAuth } from "@/utils/api"
import { useAuth } from "@/hooks/useAuth"

export function DoctorList() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [error, setError] = useState<string | null>(null)
  const { isAuthenticated, isLoading: authIsLoading } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      fetchDoctors()
    }
  }, [isAuthenticated])

  async function fetchDoctors() {
    try {
      const response = await fetchWithAuth(ENDPOINTS.doctors())
      if (!response.ok) throw new Error("Failed to fetch doctors")
      const data = await response.json()
      setDoctors(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  if (authIsLoading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return null
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/15 p-4">
        <div className="text-sm text-destructive">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Specialization</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {doctors.map((doctor) => (
            <TableRow key={doctor.id}>
              <TableCell className="font-medium">Dr. {doctor.name}</TableCell>
              <TableCell>{doctor.specialization}</TableCell>
              <TableCell>{doctor.email}</TableCell>
              <TableCell>{doctor.phone}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

