"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ArrowLeft, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useToast } from "@/hooks/use-toast"

// Form schema for verification code
const verifyCodeSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  code: z.string().min(6, "Verification code must be at least 6 characters"),
})

type VerifyCodeFormValues = z.infer<typeof verifyCodeSchema>

export default function VerifyResetCodePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize form with zod resolver
  const form = useForm<VerifyCodeFormValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: {
      email: searchParams?.get("email") || "",
      code: "",
    },
  })

  // Handle form submission
  async function onSubmit(data: VerifyCodeFormValues) {
    setIsSubmitting(true)

    try {
      // Call the verify code API
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/verify-reset-code/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: data.email,
            code: data.code,
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.message || "Invalid verification code")
      }

      // Get the token from the response
      const responseData = await response.json()
      const resetToken = responseData.token

      // Success - redirect to reset password page with token
      toast({
        title: "Code verified",
        description: "You can now reset your password",
      })

      // Navigate to reset password page with token and email
      router.push(`/reset-password?token=${resetToken}&email=${encodeURIComponent(data.email)}`)
    } catch (error) {
      console.error("Code verification error:", error)
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Failed to verify code",
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
            <Link href="/forgot-password" className="mr-2">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to forgot password</span>
              </Button>
            </Link>
            <CardTitle className="text-2xl">Verify Reset Code</CardTitle>
          </div>
          <CardDescription>Enter the verification code sent to your email address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your email address"
                        {...field}
                        disabled={isSubmitting || !!searchParams?.get("email")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Enter verification code"
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
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            Didn't receive a code?{" "}
            <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
              Request again
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
