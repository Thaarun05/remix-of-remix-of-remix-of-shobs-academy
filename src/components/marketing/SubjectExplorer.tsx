import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DemoRequestForm } from "@/components/DemoRequestForm";
import { cn } from "@/lib/utils";
import {
  Sigma, Atom, FlaskConical, Leaf, BookOpenText, Laptop2, Globe2, Calculator,
} from "lucide-react";

type Subject = {
  name: string;
  icon: typeof Sigma;
  blurb: string;
  topics: string[];
};

const grades = Array.from({ length: 12 }, (_, i) => i + 1);

const primary: Subject[] = [
  { name: "Mathematics", icon: Calculator, blurb: "Number sense, times tables and problem solving built one step at a time.", topics: ["Place value", "Fractions", "Word problems", "Mental maths"] },
  { name: "Science", icon: Leaf, blurb: "Curiosity-led lessons with everyday demonstrations and simple experiments.", topics: ["Living things", "Materials", "Forces", "Our planet"] },
  { name: "English", icon: BookOpenText, blurb: "Reading fluency, comprehension and confident written expression.", topics: ["Phonics", "Comprehension", "Grammar", "Creative writing"] },
  { name: "Computing", icon: Laptop2, blurb: "Safe, playful first steps into logic, typing and block-based coding.", topics: ["Digital safety", "Scratch basics", "Keyboard skills", "Logic puzzles"] },
];

const middle: Subject[] = [
  { name: "Mathematics", icon: Sigma, blurb: "Algebraic thinking and geometry taught with worked examples and practice sets.", topics: ["Algebra", "Ratio & proportion", "Geometry", "Data handling"] },
  { name: "Physics", icon: Atom, blurb: "Concept-first physics with diagrams, derivations and numericals.", topics: ["Motion", "Light", "Electricity", "Energy"] },
  { name: "Chemistry", icon: FlaskConical, blurb: "Structured chemistry from atomic structure through to reactions.", topics: ["Atomic structure", "Periodic table", "Acids & bases", "Reactions"] },
  { name: "Biology", icon: Leaf, blurb: "Clear diagrams and recall practice for the whole life-sciences syllabus.", topics: ["Cells", "Human body", "Genetics basics", "Ecology"] },
  { name: "English", icon: BookOpenText, blurb: "Literature analysis, essay structure and precise grammar work.", topics: ["Literature", "Essay writing", "Grammar", "Vocabulary"] },
  { name: "Social Studies", icon: Globe2, blurb: "History, geography and civics with source-based practice.", topics: ["History", "Geography", "Civics", "Map skills"] },
];

const senior: Subject[] = [
  { name: "Mathematics", icon: Sigma, blurb: "Board and exam-focused maths with past-paper drilling every week.", topics: ["Calculus", "Trigonometry", "Vectors", "Probability"] },
  { name: "Physics", icon: Atom, blurb: "Derivations, numericals and exam technique for senior physics.", topics: ["Mechanics", "Electromagnetism", "Optics", "Modern physics"] },
  { name: "Chemistry", icon: FlaskConical, blurb: "Physical, organic and inorganic chemistry with mechanism practice.", topics: ["Organic", "Physical", "Inorganic", "Equilibrium"] },
  { name: "Biology", icon: Leaf, blurb: "High-yield biology revision with structured answers for long questions.", topics: ["Genetics", "Physiology", "Evolution", "Biotechnology"] },
  { name: "English", icon: BookOpenText, blurb: "Advanced comprehension, analytical essays and exam-length writing.", topics: ["Critical reading", "Argument essays", "Précis", "Exam writing"] },
  { name: "Computer Science", icon: Laptop2, blurb: "Programming fundamentals, data structures and project support.", topics: ["Python", "Data structures", "Databases", "Projects"] },
];

const bandFor = (grade: number) => (grade <= 5 ? "Primary" : grade <= 8 ? "Middle school" : "Senior school");
const subjectsFor = (grade: number) => (grade <= 5 ? primary : grade <= 8 ? middle : senior);

/** Grade picker that reveals the subjects and topics taught at that level. */
export const SubjectExplorer = () => {
  const [grade, setGrade] = useState(8);
  const subjects = useMemo(() => subjectsFor(grade), [grade]);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Choose a grade"
        className="surface-glass flex flex-wrap gap-1.5 p-2"
      >
        {grades.map((g) => (
          <button
            key={g}
            role="tab"
            aria-selected={grade === g}
            onClick={() => setGrade(g)}
            className={cn(
              "min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-300",
              grade === g
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-indigo)]"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {g}
          </button>
        ))}
      </div>

      <p className="mt-5 text-sm font-medium text-muted-foreground">
        Grade {grade} · <span className="text-primary">{bandFor(grade)}</span> · {subjects.length} subjects available
      </p>

      <div key={grade} className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map(({ name, icon: Icon, blurb, topics }, i) => (
          <article
            key={name}
            className="surface-rim glow-hover animate-fade-in rounded-2xl border border-border/70 bg-card p-6"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">{name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{blurb}</p>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {topics.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-border/70 bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                >
                  {t}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <DemoRequestForm />
        <span className="text-sm text-muted-foreground">
          Book a free demo for Grade {grade} — no card required.
        </span>
      </div>
    </div>
  );
};

export default SubjectExplorer;
