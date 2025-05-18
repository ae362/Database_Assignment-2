"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ArrowLeft, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

// Form schema for email validation
const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requestSent, setRequestSent] = useState(false)

  // Initialize form with zod resolver
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  // Handle form submission
  async function onSubmit(data: ForgotPasswordFormValues) {
    setIsSubmitting(true)

    try {
      // Call the password reset request API
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/password-reset/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: data.email }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.message || "Failed to send reset code")
      }

      // Success - show confirmation and update UI
      setRequestSent(true)
      toast({
        title: "Reset code sent",
        description: "Please check your email for the password reset code",
      })
    } catch (error) {
      console.error("Password reset request error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send reset code",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md border-border/40 shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center">
            <Link href="/login" className="mr-2">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to login</span>
              </Button>
            </Link>
            <CardTitle className="text-2xl">Forgot Password</CardTitle>
          </div>
          <CardDescription>
            {requestSent
              ? "We've sent a verification code to your email address."
              : "Enter your email address and we'll send you a verification code."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requestSent ? (
            <Alert>
              <AlertDescription>
                Please check your email for the verification code. Once you receive it, you can proceed to verify and
                reset your password.
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Enter your email address"
                            className="pl-9"
                            {...field}
                            disabled={isSubmitting}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Code"
                  )}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          {requestSent ? (
            <Button variant="outline" className="w-full" onClick={() => router.push("/verify-reset-code")}>
              Continue to Verification
            </Button>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                Back to login
              </Link>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
