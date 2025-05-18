"use client"

import { useEffect, useState } from "react"
import type { Patient } from "@/types"
import { ENDPOINTS } from "@/config/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function PatientList() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPatients() {
      try {
        const response = await fetch(ENDPOINTS.patients)
        if (!response.ok) throw new Error("Failed to fetch patients")
        const data = await response.json()
        setPatients(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      }
    }

    fetchPatients()
  }, [])

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
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Medical History</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => (
            <TableRow key={patient.id}>
              <TableCell className="font-medium">{patient.name}</TableCell>
              <TableCell>{patient.email}</TableCell>
              <TableCell>{patient.phone}</TableCell>
              <TableCell className="max-w-[300px] truncate">{patient.medical_history}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

