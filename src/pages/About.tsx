import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  BookOpen, User, ClipboardCheck, Target, Calendar, Zap, 
  GraduationCap, Users, Mail, ArrowLeft, Award, Globe, 
  Heart, Lightbulb, CheckCircle2, Star, HelpCircle
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Expert Tutoring",
    description: "One-on-one sessions with qualified teachers across multiple subjects including Math, Science, English, and more"
  },
  {
    icon: User,
    title: "Personalized Learning",
    description: "Customized lesson plans tailored to each student's unique learning style, needs, and academic goals"
  },
  {
    icon: ClipboardCheck,
    title: "Assignment Support",
    description: "Comprehensive homework help, assignment tracking, and timely submission management"
  },
  {
    icon: Target,
    title: "Progress Tracking",
    description: "Detailed attendance records, performance analytics, and regular progress reports for parents"
  },
  {
    icon: Calendar,
    title: "Flexible Scheduling",
    description: "Convenient online sessions that adapt to your timezone and busy family schedules"
  },
  {
    icon: Zap,
    title: "Interactive Platform",
    description: "Modern tools including live video sessions, file sharing, and real-time messaging"
  }
];

const coreValues = [
  {
    icon: Heart,
    title: "Student-Centered Approach",
    description: "Every decision we make puts the student's success and well-being first"
  },
  {
    icon: Award,
    title: "Excellence in Education",
    description: "We maintain the highest standards of teaching quality and academic rigor"
  },
  {
    icon: Globe,
    title: "Global Accessibility",
    description: "Breaking geographical barriers to provide quality education worldwide"
  },
  {
    icon: Lightbulb,
    title: "Innovative Methods",
    description: "Embracing modern technology and teaching techniques for better outcomes"
  }
];

const faqs = [
  {
    question: "How do online tutoring sessions work?",
    answer: "Our sessions are conducted via Zoom video calls. Each student receives a dedicated Zoom link for their classes. Teachers share their screen for explanations, use digital whiteboards, and interact with students in real-time just like an in-person session."
  },
  {
    question: "What grade levels do you support?",
    answer: "We support students from Kindergarten through 12th grade (K-12), as well as students preparing for standardized tests like SAT, ACT, and AP exams. Our teachers adapt their teaching style to match each student's age and learning level."
  },
  {
    question: "How are teachers selected and trained?",
    answer: "All our teachers undergo a rigorous selection process that includes background checks, subject matter expertise verification, and teaching demonstrations. They receive ongoing training to stay updated with curriculum changes and modern teaching techniques."
  },
  {
    question: "Can I schedule sessions according to my timezone?",
    answer: "Absolutely! We serve students across multiple countries and time zones. Our flexible scheduling system allows you to book sessions at times that work best for your family, including evenings and weekends."
  },
  {
    question: "How do I track my child's progress?",
    answer: "Parents receive regular progress updates through our platform. You can view attendance records, assignment completion status, and communicate directly with teachers. We also provide periodic progress reports highlighting areas of improvement and focus."
  },
  {
    question: "What if my child needs help with homework?",
    answer: "Homework help is a core part of our service! Students can bring their homework questions to sessions, and teachers will guide them through problems step-by-step, ensuring they understand the concepts rather than just getting answers."
  },
  {
    question: "How much do tutoring sessions cost?",
    answer: "Our rates vary based on the subject, grade level, and package chosen. We offer competitive pricing and flexible payment options. Contact us for a free consultation and personalized quote based on your child's needs."
  },
  {
    question: "Can I try a session before committing?",
    answer: "Yes! We offer a free demo session so you and your child can experience our teaching style and platform before making any commitment. This helps ensure we're the right fit for your child's learning needs."
  }
];

const subjects = [
  "Mathematics (All Levels)",
  "Physics",
  "Chemistry",
  "Biology",
  "English Language & Literature",
  "Social Studies",
  "Test Preparation (SAT, ACT, AP)",
  "Essay Writing & College Applications"
];

const About = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <Navbar showAboutLink={false} />

      {/* Back to Home Button */}
      <section className="pt-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </section>

      {/* Hero */}
      <section className="pt-8 pb-12 px-6 text-center">
        <div className="mb-6">
          <Logo size="lg" className="mx-auto" />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
          About Shobs Academy
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Empowering Education, One Student at a Time
        </p>
      </section>

      {/* Gold Gradient Divider */}
      <div className="w-full h-1" style={{ background: 'linear-gradient(90deg, transparent, hsl(43 74% 49%), transparent)' }} />

      {/* Mission & Vision Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Mission */}
            <div className="p-8 rounded-2xl bg-card border border-border/50 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-display font-bold text-foreground">Our Mission</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                To provide accessible, high-quality, personalized education that empowers students 
                to achieve their full academic potential. We believe every student deserves 
                individual attention and a learning experience tailored to their unique needs.
              </p>
            </div>

            {/* Vision */}
            <div className="p-8 rounded-2xl bg-card border border-border/50 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Star className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-2xl font-display font-bold text-foreground">Our Vision</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                To become the leading global online tutoring platform, recognized for transforming 
                students' academic journeys through innovative teaching methods, dedicated mentorship, 
                and a commitment to excellence in education.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-background to-muted/30 border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-center mb-8 text-foreground">
            Our Story
          </h2>
          <div className="prose prose-lg max-w-none text-muted-foreground space-y-4">
            <p className="leading-relaxed">
              Shobs Academy was founded with a simple yet powerful vision: to make quality education 
              accessible to students regardless of their geographic location. What started as a small 
              tutoring initiative in Coimbatore, India, has grown into an international education 
              platform serving students across the USA, Canada, Australia, UK, Singapore, Dubai, and beyond.
            </p>
            <p className="leading-relaxed">
              Our founder recognized that many students struggle in traditional classroom settings 
              where individual attention is limited. By leveraging technology and assembling a team 
              of passionate educators, Shobs Academy bridges the gap between students and personalized 
              learning experiences that truly make a difference.
            </p>
            <p className="leading-relaxed">
              Today, we're proud to have helped hundreds of students improve their grades, build 
              confidence, and develop a genuine love for learning. Our success is measured not just 
              in academic achievements, but in the lasting impact we have on each student's educational journey.
            </p>
          </div>
        </div>
      </section>

      {/* Gold Gradient Divider */}
      <div className="w-full h-1" style={{ background: 'linear-gradient(90deg, transparent, hsl(43 74% 49%), transparent)' }} />

      {/* Core Values Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-center mb-12 text-foreground">
            Our Core Values
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreValues.map((value, idx) => (
              <div
                key={value.title}
                className="text-center p-6 rounded-2xl bg-card border border-border/50 shadow-md hover:shadow-lg transition-shadow animate-fade-in"
                style={{ animationDelay: `${0.1 * idx}s` }}
              >
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <value.icon className="h-7 w-7 text-primary" />
                </div>
                <h4 className="font-semibold text-lg text-foreground mb-2">{value.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-background to-muted/30 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-center mb-4 text-foreground">
            What We Offer
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Comprehensive educational support designed to help students succeed at every level
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div
                key={feature.title}
                className="feature-card animate-fade-in"
                style={{ animationDelay: `${0.1 * idx}s` }}
              >
                <div className="feature-icon-wrapper">
                  <feature.icon className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-lg text-foreground mb-2">{feature.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subjects Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-muted/30 to-background border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-center mb-4 text-foreground">
            Subjects We Teach
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Expert tutoring across a wide range of academic subjects for K-12 and beyond
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {subjects.map((subject, idx) => (
              <div
                key={subject}
                className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 animate-fade-in"
                style={{ animationDelay: `${0.05 * idx}s` }}
              >
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="text-foreground font-medium">{subject}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gold Gradient Divider */}
      <div className="w-full h-1" style={{ background: 'linear-gradient(90deg, transparent, hsl(43 74% 49%), transparent)' }} />

      {/* Who We Serve Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-center mb-12 text-foreground">
            Who We Serve
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Students Card */}
            <div className="serve-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="serve-icon-wrapper">
                <GraduationCap className="h-10 w-10 text-student" />
              </div>
              <h4 className="text-xl font-bold text-foreground mb-4">Students</h4>
              <ul className="serve-list space-y-3">
                <li>
                  <span className="serve-check">✓</span>
                  K-12 students seeking academic support
                </li>
                <li>
                  <span className="serve-check">✓</span>
                  Students preparing for standardized tests (SAT, ACT, AP)
                </li>
                <li>
                  <span className="serve-check">✓</span>
                  Learners who benefit from one-on-one attention
                </li>
                <li>
                  <span className="serve-check">✓</span>
                  Students needing help with specific subjects
                </li>
                <li>
                  <span className="serve-check">✓</span>
                  Those looking to get ahead or catch up in school
                </li>
              </ul>
            </div>

            {/* Parents Card */}
            <div className="serve-card animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="serve-icon-wrapper">
                <Users className="h-10 w-10 text-teacher" />
              </div>
              <h4 className="text-xl font-bold text-foreground mb-4">Parents</h4>
              <ul className="serve-list space-y-3">
                <li>
                  <span className="serve-check">✓</span>
                  Parents looking for quality tutoring services
                </li>
                <li>
                  <span className="serve-check">✓</span>
                  Families wanting to track their child's progress
                </li>
                <li>
                  <span className="serve-check">✓</span>
                  Those seeking flexible, online learning options
                </li>
                <li>
                  <span className="serve-check">✓</span>
                  Parents who value personalized education
                </li>
                <li>
                  <span className="serve-check">✓</span>
                  Families in different time zones worldwide
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-muted/30 to-background border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-center mb-12 text-foreground">
            Why Choose Shobs Academy?
          </h2>
          <div className="grid gap-4">
            {[
              "Experienced and qualified teachers with proven track records",
              "Personalized curriculum adapted to each student's learning pace",
              "Flexible scheduling to accommodate students across time zones",
              "Regular progress reports and parent-teacher communication",
              "Affordable rates without compromising on quality",
              "Modern technology platform for seamless online learning",
              "Commitment to student success and continuous improvement"
            ].map((reason, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50 animate-fade-in"
                style={{ animationDelay: `${0.05 * idx}s` }}
              >
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">{idx + 1}</span>
                </div>
                <p className="text-foreground">{reason}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gold Gradient Divider */}
      <div className="w-full h-1" style={{ background: 'linear-gradient(90deg, transparent, hsl(43 74% 49%), transparent)' }} />

      {/* FAQ Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              Frequently Asked Questions
            </h2>
          </div>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Find answers to common questions about our tutoring services
          </p>
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, idx) => (
              <AccordionItem
                key={idx}
                value={`item-${idx}`}
                className="bg-card border border-border/50 rounded-xl px-6 shadow-sm"
              >
                <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Get In Touch Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-background to-muted/30 border-t border-border/50">
        <div className="max-w-3xl mx-auto">
          <div className="get-in-touch-container text-center p-8 rounded-2xl bg-card border border-border/50 shadow-lg">
            <h2 className="text-2xl font-bold text-foreground mb-4">Get In Touch</h2>
            <p className="text-muted-foreground mb-8">
              Ready to start your child's journey to academic success? Contact us today for a free consultation!
            </p>
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="contact-item flex items-center gap-3">
                <Mail className="h-6 w-6 text-primary" />
                <span className="text-muted-foreground font-medium">
                  shobaraju@shobsacademy.com
                </span>
              </div>
              <div className="contact-item flex items-center gap-3">
                <Mail className="h-6 w-6 text-primary" />
                <span className="text-muted-foreground font-medium">
                  shobsacademy@gmail.com
                </span>
              </div>
            </div>
            <div className="mt-8">
              <Link to="/">
                <Button size="lg" className="gap-2">
                  Book a Free Demo
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background text-center py-10">
        <p className="text-sm opacity-80">
          © {new Date().getFullYear()} Shobs Academy. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default About;
