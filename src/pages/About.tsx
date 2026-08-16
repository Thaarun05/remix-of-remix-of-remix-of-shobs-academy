import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, User, ClipboardCheck, Target, Calendar, Zap, 
  GraduationCap, Users, Mail, ArrowLeft, ArrowRight, Award, Globe, 
  Heart, Lightbulb, CheckCircle2, Star, Phone
} from "lucide-react";
import { Seo } from "@/components/Seo";
import { SiteFooter } from "@/components/SiteFooter";
import { Reveal } from "@/components/Reveal";

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
    <div className="flex min-h-dvh flex-col bg-background">
      <Seo
        title="About Shobs Academy — Our Mission & Vision"
        description="Learn about Shobs Academy: our mission to deliver personalized K-12 tutoring, our teaching approach, subjects offered, and the team empowering students worldwide."
        path="/about"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About Shobs Academy",
          url: "https://learn-together-hub-16.lovable.app/about",
        }}
      />
      <Navbar showAboutLink={false} />

      <main id="main-content">
      {/* Back to Home Button */}
      <section className="pt-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/">
            <Button variant="outline" size="sm" className="group gap-2">
              <ArrowLeft className="arrow-travel arrow-travel-back h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </section>

      {/* Hero */}
      <section className="pt-8 pb-12 px-6 text-center">
        <div className="mb-6">
          <Logo size="lg" className="mx-auto float-slow" />
        </div>
        <Reveal>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-foreground mb-4">
            About Shobs Academy
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Empowering Education, One Student at a Time
          </p>
        </Reveal>
      </section>

      {/* Mission & Vision Section */}
      <section className="py-16 px-6 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Mission */}
            <Reveal className="p-8 rounded-2xl bg-card border border-border/50 shadow-lg lift-hover">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-serif font-bold text-foreground">Our Mission</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                To provide accessible, high-quality, personalized education that empowers students 
                to achieve their full academic potential. We believe every student deserves 
                individual attention and a learning experience tailored to their unique needs.
              </p>
            </Reveal>

            {/* Vision */}
            <Reveal delay={120} className="p-8 rounded-2xl bg-card border border-border/50 shadow-lg lift-hover">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Star className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-serif font-bold text-foreground">Our Vision</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                To become the leading global online tutoring platform, recognized for transforming 
                students' academic journeys through innovative teaching methods, dedicated mentorship, 
                and a commitment to excellence in education.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-16 px-6 bg-secondary/60 border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-center mb-8 text-foreground">
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

      {/* Core Values Section */}
      <section className="py-16 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-center mb-12 text-foreground">
            Our Core Values
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreValues.map((value, idx) => (
              <Reveal
                key={value.title}
                delay={idx * 90}
                className="group text-center p-6 rounded-2xl bg-card border border-border/50 shadow-md hover:shadow-lg lift-hover"
              >
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 transition-colors duration-300 group-hover:bg-primary/20">
                  <value.icon className="h-7 w-7 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h4 className="font-semibold text-lg text-foreground mb-2">{value.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 bg-secondary/60 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-center mb-4 text-foreground">
            What We Offer
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Comprehensive educational support designed to help students succeed at every level
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <Reveal
                key={feature.title}
                delay={idx * 80}
                className="feature-card group lift-hover"
              >
                <div className="feature-icon-wrapper">
                  <feature.icon className="h-8 w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h4 className="font-semibold text-lg text-foreground mb-2">{feature.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Subjects Section */}
      <section className="py-16 px-6 bg-background border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-center mb-4 text-foreground">
            Subjects We Teach
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Expert tutoring across a wide range of academic subjects for K-12 and beyond
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {subjects.map((subject, idx) => (
              <Reveal
                key={subject}
                delay={idx * 55}
                className="group flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50 lift-hover"
              >
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 transition-transform duration-300 group-hover:scale-110" />
                <span className="text-foreground font-medium">{subject}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Serve Section */}
      <section className="py-16 px-6 bg-secondary/60">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-center mb-12 text-foreground">
            Who We Serve
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Students Card */}
            <Reveal className="serve-card lift-hover" delay={80}>
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
            </Reveal>

            {/* Parents Card */}
            <Reveal className="serve-card lift-hover" delay={180}>
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
            </Reveal>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 px-6 bg-background border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-center mb-12 text-foreground">
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
              <Reveal
                key={idx}
                delay={idx * 55}
                className="group flex items-start gap-4 p-4 rounded-xl bg-card border border-border/50 lift-hover"
              >
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-300 group-hover:scale-110">
                  <span className="text-primary font-bold text-sm">{idx + 1}</span>
                </div>
                <p className="text-foreground">{reason}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Get In Touch Section */}
      <section className="py-16 px-6 bg-secondary/60 border-t border-border/50">
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
                <Button size="lg" className="group gap-2 cta-motion">
                  Book a Free Demo
                  <ArrowRight className="arrow-travel h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      </main>

      <SiteFooter />
    </div>
  );
};

export default About;
