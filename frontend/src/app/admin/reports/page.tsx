"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Download, FileSpreadsheet, FileText } from "lucide-react"

export default function ReportsPage() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Reports</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appointment Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Time Period</Label>
              <Select defaultValue="month">
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                  <SelectItem value="quarter">Last Quarter</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Generate Excel Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Doctor Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Doctor</Label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  <SelectItem value="1">Dr. John Smith</SelectItem>
                  <SelectItem value="2">Dr. Sarah Johnson</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full">
              <FileText className="mr-2 h-4 w-4" />
              Generate PDF Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Patient Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select defaultValue="demographics">
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demographics">Demographics</SelectItem>
                  <SelectItem value="visits">Visit Frequency</SelectItem>
                  <SelectItem value="conditions">Common Conditions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

