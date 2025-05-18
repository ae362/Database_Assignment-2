import { Suspense } from "react"
import { PatientList } from "./patient-list"
import { Loading } from "@/components/loading"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export default function PatientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Patients</h1>
        <Button asChild>
          <Link href="/patients/new">
            <Plus className="mr-2 h-4 w-4" />
            New Patient
          </Link>
        </Button>
      </div>

      <Suspense fallback={<Loading />}>
        <PatientList />
      </Suspense>
    </div>
  )
}

