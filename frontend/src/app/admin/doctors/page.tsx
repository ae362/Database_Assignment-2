"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { ENDPOINTS } from "@/config/api"
import { fetchWithAuth } from "@/utils/api"
import Link from "next/link"
import { Plus, MoreHorizontal, Loader2, Search, RefreshCw } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Doctor {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string
  specialization: string
  qualification: string
  experience_years: string
  consultation_fee: string
  available_days: string
  bio: string
  status: "active" | "inactive"
  medical_center?: number
  medical_center_name?: string
  emergency_available?: boolean
  daily_patient_limit?: number
  is_available?: boolean
  booking_history?: string
}

const specializations = [
  "General Medicine",
  "Pediatrics",
  "Cardiology",
  "Dermatology",
  "Orthopedics",
  "Neurology",
  "Psychiatry",
  "Gynecology",
  "Ophthalmology",
  "ENT",
  "Other",
]

export default function DoctorsManagementPage() {
  const { toast } = useToast()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedDoctor, setEditedDoctor] = useState<Partial<Doctor>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([])

  useEffect(() => {
    fetchDoctors()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      const filtered = doctors.filter(
        (doctor) =>
          doctor.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doctor.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doctor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doctor.specialization?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      setFilteredDoctors(filtered)
    } else {
      setFilteredDoctors(doctors)
    }
  }, [searchTerm, doctors])

  async function fetchDoctors() {
    try {
      const response = await fetchWithAuth(ENDPOINTS.doctors())
      if (!response.ok) throw new Error("Failed to fetch doctors")
      const data = await response.json()
      setDoctors(data)
      setFilteredDoctors(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load doctors",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = async (doctorId: number, newStatus: "active" | "inactive") => {
    try {
      const response = await fetchWithAuth(`${ENDPOINTS.doctors(doctorId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error("Failed to update status")

      setDoctors(doctors.map((doctor) => (doctor.id === doctorId ? { ...doctor, status: newStatus } : doctor)))

      toast({
        title: "Success",
        description: "Doctor status updated successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update doctor status",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async () => {
    if (!selectedDoctor) return

    setIsSubmitting(true)
    try {
      const response = await fetchWithAuth(`${ENDPOINTS.doctors(selectedDoctor.id)}`, {
        method: "PATCH",
        body: JSON.stringify(editedDoctor),
      })

      if (!response.ok) throw new Error("Failed to update doctor")

      const updatedDoctor = await response.json()
      setDoctors(doctors.map((doctor) => (doctor.id === selectedDoctor.id ? { ...doctor, ...updatedDoctor } : doctor)))

      setIsEditing(false)
      setSelectedDoctor(null)
      setEditedDoctor({})

      toast({
        title: "Success",
        description: "Doctor information updated successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update doctor information",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (doctorId: number) => {
    try {
      const response = await fetchWithAuth(`${ENDPOINTS.doctors(doctorId)}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete doctor")

      setDoctors(doctors.filter((doctor) => doctor.id !== doctorId))
      toast({
        title: "Success",
        description: "Doctor deleted successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete doctor",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Doctor Management</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDoctors} className="h-9">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button asChild size="sm" className="h-9">
            <Link href="/admin/doctors/create">
              <Plus className="h-4 w-4 mr-2" />
              Create Doctor
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search doctors by name, email or specialization..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 max-w-md"
        />
      </div>

      <Card className="border-border/40 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle>All Doctors</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-240px)]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead className="hidden lg:table-cell">Medical Center</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDoctors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        No doctors found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDoctors.map((doctor) => (
                      <TableRow key={doctor.id} className="hover:bg-muted/40">
                        <TableCell className="font-medium">{doctor.id}</TableCell>
                        <TableCell>{`Dr. ${doctor.first_name} ${doctor.last_name}`}</TableCell>
                        <TableCell className="hidden md:table-cell">{doctor.email}</TableCell>
                        <TableCell className="hidden md:table-cell">{doctor.phone || "—"}</TableCell>
                        <TableCell>{doctor.specialization}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {doctor.medical_center_name || "Not assigned"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={doctor.status === "active" ? "default" : "secondary"} className="capitalize">
                            {doctor.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedDoctor(doctor)
                                  setIsEditing(false)
                                }}
                              >
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedDoctor(doctor)
                                  setEditedDoctor({ ...doctor })
                                  setIsEditing(true)
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleStatusChange(doctor.id, doctor.status === "active" ? "inactive" : "active")
                                }
                              >
                                {doctor.status === "active" ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                    Delete
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the doctor&apos;s
                                      account and remove their data from the system.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(doctor.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedDoctor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDoctor(null)
            setIsEditing(false)
            setEditedDoctor({})
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Doctor Information" : "Doctor Details"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the doctor's information using the form below."
                : "View detailed information about the doctor."}
            </DialogDescription>
          </DialogHeader>

          {selectedDoctor && (
            <ScrollArea className="h-[calc(90vh-200px)] pr-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={isEditing ? editedDoctor.first_name : selectedDoctor.first_name}
                      onChange={(e) => setEditedDoctor({ ...editedDoctor, first_name: e.target.value })}
                      readOnly={!isEditing}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={isEditing ? editedDoctor.last_name : selectedDoctor.last_name}
                      onChange={(e) => setEditedDoctor({ ...editedDoctor, last_name: e.target.value })}
                      readOnly={!isEditing}
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={isEditing ? editedDoctor.email : selectedDoctor.email}
                    onChange={(e) => setEditedDoctor({ ...editedDoctor, email: e.target.value })}
                    readOnly={!isEditing}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={isEditing ? editedDoctor.phone : selectedDoctor.phone}
                    onChange={(e) => setEditedDoctor({ ...editedDoctor, phone: e.target.value })}
                    readOnly={!isEditing}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialization">Specialization</Label>
                  {isEditing ? (
                    <Select
                      value={editedDoctor.specialization}
                      onValueChange={(value) => setEditedDoctor({ ...editedDoctor, specialization: value })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select specialization" />
                      </SelectTrigger>
                      <SelectContent>
                        {specializations.map((spec) => (
                          <SelectItem key={spec} value={spec}>
                            {spec}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="specialization"
                      value={selectedDoctor.specialization}
                      readOnly
                      className="bg-background"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualification">Qualification</Label>
                  <Input
                    id="qualification"
                    value={isEditing ? editedDoctor.qualification : selectedDoctor.qualification}
                    onChange={(e) => setEditedDoctor({ ...editedDoctor, qualification: e.target.value })}
                    readOnly={!isEditing}
                    className="bg-background"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="experience_years">Years of Experience</Label>
                    <Input
                      id="experience_years"
                      type="number"
                      value={isEditing ? editedDoctor.experience_years : selectedDoctor.experience_years}
                      onChange={(e) => setEditedDoctor({ ...editedDoctor, experience_years: e.target.value })}
                      readOnly={!isEditing}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="consultation_fee">Consultation Fee</Label>
                    <Input
                      id="consultation_fee"
                      type="number"
                      value={isEditing ? editedDoctor.consultation_fee : selectedDoctor.consultation_fee}
                      onChange={(e) => setEditedDoctor({ ...editedDoctor, consultation_fee: e.target.value })}
                      readOnly={!isEditing}
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medical_center">Medical Center</Label>
                  <Input
                    id="medical_center"
                    value={selectedDoctor.medical_center_name || "Not assigned"}
                    readOnly
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daily_patient_limit">Daily Patient Limit</Label>
                  <Input
                    id="daily_patient_limit"
                    type="number"
                    value={isEditing ? editedDoctor.daily_patient_limit : selectedDoctor.daily_patient_limit}
                    onChange={(e) =>
                      setEditedDoctor({ ...editedDoctor, daily_patient_limit: Number.parseInt(e.target.value) })
                    }
                    readOnly={!isEditing}
                    className="bg-background"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergency_available">Emergency Available</Label>
                    <Select
                      value={
                        isEditing
                          ? editedDoctor.emergency_available
                            ? "true"
                            : "false"
                          : selectedDoctor.emergency_available
                            ? "true"
                            : "false"
                      }
                      onValueChange={(value) =>
                        setEditedDoctor({
                          ...editedDoctor,
                          emergency_available: value === "true",
                        })
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select availability" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="is_available">Currently Available</Label>
                    <Select
                      value={
                        isEditing
                          ? editedDoctor.is_available
                            ? "true"
                            : "false"
                          : selectedDoctor.is_available
                            ? "true"
                            : "false"
                      }
                      onValueChange={(value) =>
                        setEditedDoctor({
                          ...editedDoctor,
                          is_available: value === "true",
                        })
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select availability" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="available_days">Available Days</Label>
                  <Input
                    id="available_days"
                    value={isEditing ? editedDoctor.available_days : selectedDoctor.available_days}
                    onChange={(e) => setEditedDoctor({ ...editedDoctor, available_days: e.target.value })}
                    readOnly={!isEditing}
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="booking_history">Booking History</Label>
                  <Textarea
                    id="booking_history"
                    value={isEditing ? editedDoctor.booking_history : selectedDoctor.booking_history}
                    onChange={(e) => setEditedDoctor({ ...editedDoctor, booking_history: e.target.value })}
                    readOnly={!isEditing}
                    className="bg-background min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Professional Bio</Label>
                  <Textarea
                    id="bio"
                    value={isEditing ? editedDoctor.bio : selectedDoctor.bio}
                    onChange={(e) => setEditedDoctor({ ...editedDoctor, bio: e.target.value })}
                    readOnly={!isEditing}
                    className="bg-background min-h-[100px]"
                  />
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    setEditedDoctor({})
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleEdit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedDoctor(null)
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setIsEditing(true)
                    setEditedDoctor({ ...selectedDoctor })
                  }}
                >
                  Edit
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

