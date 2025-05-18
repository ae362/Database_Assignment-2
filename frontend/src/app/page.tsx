"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar,
  Users,
  UserCog,
  Shield,
  Clock,
  LineChartIcon as ChartLine,
  Heart,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Star,
  Stethoscope,
  UserCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"

// Define testimonials outside the component to avoid the reference error
const testimonials = [
  {
    name: "Dr. Sarah Johnson",
    role: "Cardiologist",
    initials: "SJ",
    color: "bg-gradient-to-br from-blue-500 to-blue-700",
    quote:
      "City Health Clinic has transformed how I manage my practice. The intuitive interface and powerful scheduling tools save me hours every week.",
  },
  {
    name: "James Wilson",
    role: "Patient",
    initials: "JW",
    color: "bg-gradient-to-br from-green-500 to-green-700",
    quote:
      "Booking appointments is now so simple. I love being able to see my medical history and communicate with my doctor all in one place.",
  },
  {
    name: "Dr. Michael Chen",
    role: "Pediatrician",
    initials: "MC",
    color: "bg-gradient-to-br from-purple-500 to-purple-700",
    quote:
      "The patient management features are exceptional. I can easily track treatments and maintain detailed records for all my patients.",
  },
]

// Function to generate avatar colors based on name
const generateAvatarColor = (name: string) => {
  const colors = [
    "from-blue-500 to-blue-700",
    "from-purple-500 to-purple-700",
    "from-green-500 to-green-700",
    "from-cyan-500 to-cyan-700",
    "from-amber-500 to-amber-700",
    "from-pink-500 to-pink-700",
  ]

  // Simple hash function to get consistent colors for the same name
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

// Function to get initials from a name
const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  useEffect(() => {
    setMounted(true)

    // Auto-rotate testimonials
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return null
  }

  // Sample user data for the testimonials section
  const userAvatars = [
    { name: "Alex Morgan", role: "Doctor", icon: <Stethoscope className="h-4 w-4" /> },
    { name: "Jamie Lee", role: "Patient", icon: <UserCheck className="h-4 w-4" /> },
    { name: "Taylor Kim", role: "Admin", icon: <UserCog className="h-4 w-4" /> },
    { name: "Casey Smith", role: "Doctor", icon: <Stethoscope className="h-4 w-4" /> },
  ]

  // Sample appointment data
  const appointments = [
    { name: "Emma Thompson", time: "10:00 AM", type: "Checkup", status: "Upcoming" },
    { name: "James Wilson", time: "11:30 AM", type: "Consultation", status: "Confirmed" },
    { name: "Sophia Martinez", time: "2:15 PM", type: "Follow-up", status: "Upcoming" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0d17] via-[#111827] to-[#0a0d17] text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full filter blur-[120px] opacity-20 animate-pulse"></div>
        <div
          className="absolute bottom-20 right-10 w-72 h-72 bg-purple-500 rounded-full filter blur-[120px] opacity-20 animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>

        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <div className="inline-block px-4 py-1 bg-blue-900/30 rounded-full text-blue-400 text-sm font-medium mb-6 border border-blue-800/50">
                Next Generation Healthcare Platform
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                  City Health Clinic
                </span>
                <br />
                <span className="text-white">Streamlined Healthcare</span>
              </h1>
              <p className="text-xl text-gray-300 mb-8 max-w-lg">
                Revolutionize your medical practice with our all-in-one platform for doctors, patients, and
                administrators.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 px-8 rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-blue-500/30"
                >
                  <Link href="/register">
                    Get Started <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-gray-700 hover:bg-gray-800 text-white px-8 rounded-lg font-medium transition-all"
                >
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>

              <div className="mt-12 flex items-center gap-6">
                <div className="flex -space-x-3">
                  {userAvatars.map((user, i) => (
                    <div
                      key={i}
                      className={`w-10 h-10 rounded-full border-2 border-[#0a0d17] flex items-center justify-center bg-gradient-to-br ${generateAvatarColor(user.name)}`}
                    >
                      {user.icon}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-400">Trusted by 1,000+ healthcare professionals</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl blur-3xl opacity-20"></div>
              <div className="relative bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-2 bg-gray-800/80 backdrop-blur-sm">
                  <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-800/50 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 hover:border-blue-500/50 transition-all group">
                      <Calendar className="h-6 w-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                      <div className="text-2xl font-bold">24</div>
                      <div className="text-xs text-gray-400">Appointments</div>
                    </div>
                    <div className="bg-gray-800/50 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 hover:border-green-500/50 transition-all group">
                      <Users className="h-6 w-6 text-green-400 mb-2 group-hover:scale-110 transition-transform" />
                      <div className="text-2xl font-bold">120</div>
                      <div className="text-xs text-gray-400">Patients</div>
                    </div>
                    <div className="bg-gray-800/50 backdrop-blur-sm p-4 rounded-xl border border-gray-700/50 hover:border-purple-500/50 transition-all group">
                      <UserCog className="h-6 w-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                      <div className="text-2xl font-bold">8</div>
                      <div className="text-xs text-gray-400">Doctors</div>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 backdrop-blur-sm p-5 rounded-xl border border-gray-700/50">
                    <div className="flex justify-between items-center mb-4">
                      <div className="font-medium">Upcoming Appointments</div>
                      <div className="text-xs text-blue-400 flex items-center">
                        View All <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                    {appointments.map((appointment, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 mb-4 last:mb-0 p-3 rounded-lg hover:bg-gray-700/30 transition-colors"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-gray-600 bg-gradient-to-br ${generateAvatarColor(appointment.name)}`}
                        >
                          <span className="font-semibold text-white text-sm">{getInitials(appointment.name)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{appointment.name}</div>
                          <div className="text-xs text-gray-400">
                            {appointment.time} - {appointment.type}
                          </div>
                        </div>
                        <div className="text-xs px-2 py-1 rounded-full bg-blue-900/50 text-blue-400 border border-blue-800/50">
                          {appointment.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-1 bg-purple-900/30 rounded-full text-purple-400 text-sm font-medium mb-4 border border-purple-800/50">
            Powerful Features
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Our comprehensive platform offers powerful tools to streamline your healthcare practice
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: <Calendar className="h-6 w-6" />,
              color: "blue",
              title: "Smart Scheduling",
              description: "Intelligent appointment management with automated reminders and conflict prevention.",
            },
            {
              icon: <Users className="h-6 w-6" />,
              color: "green",
              title: "Patient Management",
              description: "Comprehensive patient records with medical history, visit notes, and treatment plans.",
            },
            {
              icon: <UserCog className="h-6 w-6" />,
              color: "purple",
              title: "Doctor Dashboard",
              description: "Personalized dashboard for doctors to manage their schedule and patient load.",
            },
            {
              icon: <Shield className="h-6 w-6" />,
              color: "red",
              title: "HIPAA Compliant",
              description: "Enterprise-grade security with end-to-end encryption and compliance features.",
            },
            {
              icon: <Clock className="h-6 w-6" />,
              color: "amber",
              title: "Real-time Updates",
              description: "Instant notifications for appointment changes, test results, and messages.",
            },
            {
              icon: <ChartLine className="h-6 w-6" />,
              color: "cyan",
              title: "Advanced Analytics",
              description: "Powerful reporting tools to track practice performance and patient outcomes.",
            },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-${feature.color}-500/50 transition-all hover:shadow-lg hover:shadow-${feature.color}-500/10 group`}
            >
              <div
                className={`bg-${feature.color}-900/20 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4 text-${feature.color}-400 group-hover:scale-110 transition-transform`}
              >
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-400 transition-colors">
                {feature.title}
              </h3>
              <p className="text-gray-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-1 bg-green-900/30 rounded-full text-green-400 text-sm font-medium mb-4 border border-green-800/50">
            Testimonials
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">What Our Users Say</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Hear from healthcare professionals and patients who use City Health Clinic every day
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="relative h-80 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 overflow-hidden">
            <AnimatePresence mode="wait">
              {testimonials.map(
                (testimonial, index) =>
                  activeTestimonial === index && (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.5 }}
                      className="h-full flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-4xl text-blue-500 mb-4">"</div>
                        <p className="text-xl text-gray-300 italic mb-6">{testimonial.quote}</p>
                      </div>
                      <div className="flex items-center">
                        <div
                          className={`w-14 h-14 rounded-full flex items-center justify-center ${testimonial.color} mr-4 shadow-lg`}
                        >
                          <span className="text-white font-bold text-lg">{testimonial.initials}</span>
                        </div>
                        <div>
                          <h4 className="font-bold">{testimonial.name}</h4>
                          <p className="text-gray-400">{testimonial.role}</p>
                        </div>
                      </div>
                    </motion.div>
                  ),
              )}
            </AnimatePresence>

            <div className="absolute bottom-8 right-8 flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    activeTestimonial === index ? "bg-blue-500 w-6" : "bg-gray-600 hover:bg-gray-500"
                  }`}
                  aria-label={`View testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { number: "10k+", label: "Appointments", icon: <Calendar className="h-6 w-6" />, color: "blue" },
            { number: "500+", label: "Doctors", icon: <UserCog className="h-6 w-6" />, color: "purple" },
            { number: "20k+", label: "Patients", icon: <Users className="h-6 w-6" />, color: "green" },
            { number: "99.9%", label: "Uptime", icon: <CheckCircle className="h-6 w-6" />, color: "cyan" },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div
                className={`bg-${stat.color}-900/20 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4 text-${stat.color}-400 mx-auto`}
              >
                {stat.icon}
              </div>
              <div className="text-3xl md:text-4xl font-bold mb-1">{stat.number}</div>
              <div className="text-gray-400">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl"></div>
          <div className="absolute inset-0 opacity-10 mix-blend-overlay bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>

          <div className="relative p-8 md:p-12 text-center">
            <Heart className="h-12 w-12 text-white/80 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to transform your healthcare practice?</h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands of healthcare professionals who are streamlining their workflow with City Health Clinic.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="bg-white text-blue-600 hover:bg-gray-100 px-8 rounded-lg font-medium transition-all"
              >
                <Link href="/register">Get Started for Free</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="bg-blue-800/50 hover:bg-blue-800 text-white px-8 rounded-lg font-medium transition-all border border-blue-400/30"
              >
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Link
                href="/"
                className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600"
              >
                City Health Clinic
              </Link>
              <p className="text-gray-400 text-sm mt-2">Modern Healthcare Management Platform</p>
              <div className="flex gap-4 mt-4">
                {["twitter", "facebook", "instagram", "linkedin"].map((social) => (
                  <a key={social} href={`#${social}`} className="text-gray-400 hover:text-white transition-colors">
                    <span className="sr-only">{social}</span>
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700 transition-colors">
                      {social === "twitter" && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                        </svg>
                      )}
                      {social === "facebook" && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                        </svg>
                      )}
                      {social === "instagram" && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                        </svg>
                      )}
                      {social === "linkedin" && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                          <rect x="2" y="9" width="4" height="12"></rect>
                          <circle cx="4" cy="4" r="2"></circle>
                        </svg>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                {["Features", "Pricing", "Integrations", "Updates", "Security"].map((item) => (
                  <li key={item}>
                    <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                {["About", "Careers", "Blog", "Press", "Contact"].map((item) => (
                  <li key={item}>
                    <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                {["Documentation", "Help Center", "Community", "Partners", "Legal"].map((item) => (
                  <li key={item}>
                    <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} City Health Clinic</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <Link href="#" className="text-gray-500 hover:text-white text-sm transition-colors">
                Privacy Policy
              </Link>
              <Link href="#" className="text-gray-500 hover:text-white text-sm transition-colors">
                Terms of Service
              </Link>
              <Link href="#" className="text-gray-500 hover:text-white text-sm transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
