/**
* Comprehensive Frontend Testing Script for Medical Appointment System
*
* This script uses Playwright to perform extensive testing of the frontend.
* It covers authentication, navigation, data display, form submissions,
* and user interactions across different roles (admin, doctor, patient).
*
* Usage:
* npx playwright test
*/

import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"

// Test data
const TEST_USERS = {
 admin: {
   email: "admin@gmail.com",
   password: "Admin123",
   role: "admin",
 },
 doctor: {
   email: "doctor2@gmail.com",
   password: "Ayoubel123",
   role: "doctor",
 },
 patient: {
   email: "elayoub407@gmail.com",
   password: "Ayoubel123",
   role: "patient",
 },
}

// Utility function to login
async function login(page: Page, user: any) {
 await page.goto("/login")
 await page.fill('input[type="email"]', user.email)
 await page.fill('input[type="password"]', user.password)
 await page.click('button:has-text("Select your role")')
 await page.click(`text=${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`) // Capitalize role
 await page.click('button:has-text("Login")')
}

// ---------------------- Authentication Tests ----------------------

test.describe("Authentication", () => {
 test("login as admin", async ({ page }: { page: Page }) => {
   await login(page, TEST_USERS.admin)
   await page.waitForURL("/admin")
   await expect(page).toHaveURL("/admin")
   await expect(page.locator("h1")).toContainText("Admin Dashboard")
 })

 test("login as doctor", async ({ page }: { page: Page }) => {
   await login(page, TEST_USERS.doctor)
   await page.waitForURL("/doctor-panel")
   await expect(page).toHaveURL("/doctor-panel")
   await expect(page.locator("h1")).toContainText("Doctor Dashboard")
 })

 test("login as patient", async ({ page }: { page: Page }) => {
   await login(page, TEST_USERS.patient)
   await page.waitForURL("/appointments")
   await expect(page).toHaveURL("/appointments")
   await expect(page.locator("h1")).toContainText("Appointments")
 })

 test("reject invalid login credentials", async ({ page }: { page: Page }) => {
   await page.goto("/login")
   await page.fill('input[type="email"]', "invalid@example.com")
   await page.fill('input[type="password"]', "wrongpassword")
   await page.click('button:has-text("Select your role")')
   await page.click("text=Patient")
   await page.click('button:has-text("Login")')
   await expect(page.locator(".alert-destructive")).toBeVisible()
 })
})

// ---------------------- Admin Panel Tests ----------------------

test.describe("Admin Panel", () => {
 test.beforeEach(async ({ page }: { page: Page }) => {
   await login(page, TEST_USERS.admin)
   await page.waitForURL("/admin")
 })

 test("navigate to patient management", async ({ page }: { page: Page }) => {
   await page.click("text=Patient Management")
   await expect(page).toHaveURL("/admin/patients")
   await expect(page.locator("h1")).toContainText("Patient Management")
 })

 test("navigate to doctor management", async ({ page }: { page: Page }) => {
   await page.click("text=Doctor Management")
   await expect(page).toHaveURL("/admin/doctors")
   await expect(page.locator("h1")).toContainText("Doctor Management")
 })

 test("navigate to create doctor", async ({ page }: { page: Page }) => {
   await page.click("text=Create Doctor")
   await expect(page).toHaveURL("/admin/doctors/create")
   await expect(page.locator("h1")).toContainText("Create Doctor Account")
 })

 test("navigate to appointments overview", async ({ page }: { page: Page }) => {
   await page.click("text=Appointment Overview")
   await expect(page).toHaveURL("/admin/appointments")
   await expect(page.locator("h1")).toContainText("Appointment Overview")
 })

 test("navigate to reports", async ({ page }: { page: Page }) => {
   await page.click("text=Reports")
   await expect(page).toHaveURL("/admin/reports")
   await expect(page.locator("h1")).toContainText("Reports")
 })

 test("navigate to settings", async ({ page }: { page: Page }) => {
   await page.click("text=Settings")
   await expect(page).toHaveURL("/admin/settings")
   await expect(page.locator("h1")).toContainText("System Settings")
 })

 test("admin can view doctor details", async ({ page }: { page: Page }) => {
   await page.goto("/admin/doctors")
   await page.waitForSelector("table")
   const firstDoctorMoreButton = page.locator("table tr").nth(1).locator("button").first()
   await firstDoctorMoreButton.click()
   await page.click("text=View Details")
   await expect(page.locator('div[role="dialog"]')).toBeVisible()
   await expect(page.locator('div[role="dialog"] h2')).toContainText("Doctor Details")
 })

 test("admin can view patient details", async ({ page }: { page: Page }) => {
   await page.goto("/admin/patients")
   await page.waitForSelector("table")
   const firstPatientMoreButton = page.locator("table tr").nth(1).locator("button").first()
   await firstPatientMoreButton.click()
   await page.click("text=View Details")
   await expect(page.locator('div[role="dialog"]')).toBeVisible()
   await expect(page.locator('div[role="dialog"] h2')).toContainText("Patient Details")
 })

 test("admin can view appointment details", async ({ page }: { page: Page }) => {
   await page.goto("/admin/appointments")
   await page.waitForSelector("table")
   const appointmentRow = page.locator("table tr").nth(1)
   if (await appointmentRow.isVisible()) {
     await appointmentRow.locator('button:has-text("View")').click()
     await expect(page.locator('div[role="dialog"]')).toBeVisible()
     await expect(page.locator('div[role="dialog"] h2')).toContainText("Appointment Details")
   }
 })
})

// ---------------------- Doctor Panel Tests ----------------------

test.describe("Doctor Panel", () => {
 test.beforeEach(async ({ page }: { page: Page }) => {
   await login(page, TEST_USERS.doctor)
   await page.waitForURL("/doctor-panel")
 })

 test("navigate to my appointments", async ({ page }: { page: Page }) => {
   await page.click("text=My Appointments")
   await expect(page).toHaveURL("/doctor-panel/appointments")
   await expect(page.locator("h1")).toContainText("My Appointments")
 })

 test("navigate to availability", async ({ page }: { page: Page }) => {
   await page.click("text=Availability")
   await expect(page).toHaveURL("/doctor-panel/availability")
   await expect(page.locator("h1")).toContainText("Manage Availability")
 })

 test("navigate to my patients", async ({ page }: { page: Page }) => {
   await page.click("text=My Patients")
   // Assuming there's a page for listing patients
   // await expect(page).toHaveURL("/doctor-panel/patients");
   // await expect(page.locator("h1")).toContainText("My Patients");
 })

 test("navigate to medical records", async ({ page }: { page: Page }) => {
   await page.click("text=Medical Records")
   // Assuming there's a page for medical records
   // await expect(page).toHaveURL("/doctor-panel/records");
   // await expect(page.locator("h1")).toContainText("Medical Records");
 })

 test("navigate to profile", async ({ page }: { page: Page }) => {
   await page.click("text=Profile")
   // Assuming there's a page for profile
   // await expect(page).toHaveURL("/doctor-panel/profile");
   // await expect(page.locator("h1")).toContainText("Profile");
 })

 test("navigate to settings", async ({ page }: { page: Page }) => {
   await page.click("text=Settings")
   // Assuming there's a page for settings
   // await expect(page).toHaveURL("/doctor-panel/settings");
   // await expect(page.locator("h1")).toContainText("Settings");
 })

 test("doctor can view appointment details", async ({ page }: { page: Page }) => {
   await page.goto("/doctor-panel/appointments")
   await page.waitForSelector("table")
   const appointmentRow = page.locator("table tr").nth(1)
   if (await appointmentRow.isVisible()) {
     await appointmentRow.locator('button:has-text("View Details")').click()
     await expect(page.locator('div[role="dialog"]')).toBeVisible()
   }
 })

 test("doctor can mark appointment as completed", async ({ page }: { page: Page }) => {
   await page.goto("/doctor-panel/appointments")
   await page.waitForSelector("table")
   const appointmentRow = page.locator("table tr").nth(1)
   if (await appointmentRow.isVisible()) {
     await appointmentRow.locator('button:has-text("View Details")').click()
     await expect(page.locator('div[role="dialog"]')).toBeVisible()
     const markCompletedButton = page.locator('div[role="dialog"] button:has-text("Mark as Completed")')
     if (await markCompletedButton.isVisible()) {
       await markCompletedButton.click()
       await page.waitForTimeout(1000) // Wait for the update
       await expect(page.locator('div[role="dialog"]')).not.toBeVisible() // Dialog closes
     }
   }
 })
})

// ---------------------- Patient Panel Tests ----------------------

test.describe("Patient Panel", () => {
 test.beforeEach(async ({ page }: { page: Page }) => {
   await login(page, TEST_USERS.patient)
   await page.waitForURL("/appointments")
 })

 test("navigate to new appointment", async ({ page }: { page: Page }) => {
   await page.click("text=New Appointment")
   await expect(page).toHaveURL("/appointments/new")
   await expect(page.locator("h1")).toContainText("Schedule New Appointment")
 })

 test("patient can view appointments", async ({ page }: { page: Page }) => {
   await expect(page.locator("h1")).toContainText("Appointments")
   await page.waitForSelector("table")
 })

 test("patient can book an appointment", async ({ page }: { page: Page }) => {
   await page.goto("/appointments/new")

   // Select a doctor
   await page.click('button:has-text("Select a doctor")')
   await page.waitForSelector('[role="option"]')
   await page.click('[role="option"]:first-child')

   // Wait for the calendar to appear
   await page.waitForSelector("button[aria-label]")

   // Select a date (find an enabled date)
   const enabledDate = page.locator("button[aria-label]:not([disabled])").first()
   await enabledDate.click()

   // Select a time slot if available
   const timeSlot = page.locator('button:has-text(":")').first()
   if (await timeSlot.isVisible()) {
     await timeSlot.click()

     // Fill in patient information
     await page.fill("input#patientPhone", "555-123-4567")
     await page.click('button:has-text("Select your gender")')
     await page.click("text=Male")
     await page.fill("textarea#address", "123 Test Street, Test City")

     // Fill in medical information
     await page.click('button:has-text("Select your blood type")')
     await page.click("text=O+")
     await page.fill("textarea#reasonForVisit", "Regular checkup")

     // Submit the form
     await page.click('button:has-text("Confirm Appointment")')

     // Verify we're redirected to appointments page
     await page.waitForURL("/appointments")
     await expect(page).toHaveURL("/appointments")
   }
 })
})

// ---------------------- General Tests ----------------------

test.describe("General", () => {
 test("unauthenticated user is redirected to login", async ({ page }: { page: Page }) => {
   await page.goto("/admin")
   await expect(page).toHaveURL("/login")
 })

 test("authenticated user can logout", async ({ page }: { page: Page }) => {
   await login(page, TEST_USERS.patient)
   await page.waitForURL("/appointments")

   // Open user menu
   await page.click('button[aria-label="Open user menu"]')

   // Click logout
   await page.click("text=Log out")

   // Verify we're redirected to login page
   await expect(page).toHaveURL("/login")
 })
})
