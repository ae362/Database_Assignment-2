import { Suspense } from "react"
import { DoctorList } from "./doctor-list"
import { Loading } from "@/components/loading"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

export default function DoctorsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Doctors</h1>
        <Button asChild>
          <Link href="/doctors/new">
            <Plus className="mr-2 h-4 w-4" />
            New Doctor
          </Link>
        </Button>
      </div>

      <Suspense fallback={<Loading />}>
        <DoctorList />
      </Suspense>
    </div>
  )
}

