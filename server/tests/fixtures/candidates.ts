import { candidates, type Candidate, type NewCandidate } from "../../src/db/schema";
import type { TestDb } from "../helpers/testDb";

// A realistic, deliberately messy set of applicants. Tests opt in with
// `await seedCandidates(db)` and should assert rules ("every result is in
// stage X"), not exact counts, so this list can grow without breaking them.
//
// Covers: every stage, archived and active, repeated roles (for role filters),
// distinct createdAt values (for sorting), non-ASCII and punctuated names,
// mixed-case email, missing optional fields, and short to long resumes.

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 9, 30)); // October 2026

export const fixtureCandidates: NewCandidate[] = [
  {
    name: "Siobhán O'Brien",
    email: "siobhan.obrien@example.ie",
    phone: "+353 87 123 4567",
    role: "Backend Engineer",
    source: "LinkedIn",
    stage: "interview",
    createdAt: day(1),
    resumeText: [
      "Backend engineer, 4 years.",
      "Built payment reconciliation services in Go and PostgreSQL at a fintech startup.",
      "Led migration from a monolith to three services; cut p95 latency from 900ms to 220ms.",
      "On-call lead, wrote the incident runbook. BSc Computer Science, UCD.",
    ].join("\n"),
  },
  {
    name: "José Núñez",
    email: "Jose.Nunez@Example.com",
    role: "Frontend Engineer",
    source: "Referral",
    stage: "applied",
    createdAt: day(2),
    resumeText:
      "React and TypeScript developer. Rebuilt a design system used by 40 engineers. " +
      "Strong on accessibility (WCAG 2.2 audits). Spanish and English.",
  },
  {
    name: "Mei-Ling Chen",
    email: "meiling.chen@example.com",
    phone: "(415) 555-0132",
    role: "Backend Engineer",
    stage: "screening",
    createdAt: day(3),
    resumeText:
      "Graduate software engineer. Final-year project: a distributed job queue in Rust. " +
      "Internship at a logistics company writing Python ETL jobs.",
  },
  {
    name: "Oluwaseun Adeyemi-Clarke",
    email: "seun.ac@example.co.uk",
    role: "Data Analyst",
    source: "Careers page",
    stage: "offer",
    createdAt: day(4),
    resumeText:
      "Data analyst, 3 years. SQL, dbt, Looker. Built the weekly revenue dashboard used by the exec team. " +
      "Reduced report generation time from 2 days to 2 hours.",
  },
  {
    name: "Liam Murphy",
    email: "liam.murphy@example.com",
    role: "Frontend Engineer",
    stage: "rejected",
    createdAt: day(5),
    resumeText: "Bootcamp graduate. Built a to-do app and a weather app with React.",
  },
  {
    name: "Aarav Sharma",
    email: "aarav.sharma@example.in",
    phone: "+91 98765 43210",
    role: "Backend Engineer",
    source: "LinkedIn",
    stage: "applied",
    createdAt: day(6),
    archivedAt: day(20),
    resumeText:
      "Java and Spring Boot developer, 6 years. Microservices on Kubernetes. " +
      "Withdrew application after accepting another offer.",
  },
  {
    name: "Zoë Van der Berg",
    email: "zoe.vdberg@example.nl",
    role: "Product Designer",
    source: "Referral",
    stage: "interview",
    createdAt: day(7),
    resumeText:
      "Product designer, 5 years. Figma, user research, prototyping.\n\n" +
      "   Led the redesign of a B2B onboarding flow; activation up 18%.   \n\n" +
      "Portfolio available on request.",
  },
  {
    name: "Kwame Mensah",
    email: "kwame.mensah@example.com",
    role: "Data Analyst",
    stage: "screening",
    createdAt: day(8),
    archivedAt: day(15),
    resumeText: "Excel, SQL, some Python. Looking to move from finance into analytics.",
  },
  {
    name: "Hannah Schmidt",
    email: "hannah.schmidt@example.de",
    phone: "+49 151 23456789",
    role: "Frontend Engineer",
    source: "Careers page",
    stage: "offer",
    createdAt: day(9),
    resumeText:
      "Senior frontend engineer, 8 years. Vue and React. Mentored 5 juniors. " +
      "Introduced end-to-end testing with Playwright; production bugs down 30%.",
  },
  {
    name: "Ana-Maria Popescu",
    email: "ana.popescu@example.ro",
    role: "Backend Engineer",
    stage: "rejected",
    createdAt: day(10),
    resumeText:
      "Node.js developer, 2 years. Express APIs, MongoDB. " +
      "Contributed to an open-source rate-limiting library.",
  },
  {
    name: "Tomás Ó Ceallaigh",
    email: "tomas.oceallaigh@example.ie",
    role: "Product Designer",
    stage: "applied",
    createdAt: day(11),
    resumeText: [
      "SUMMARY",
      "Designer with a background in architecture.",
      "",
      "EXPERIENCE",
      "2022–present  Junior Product Designer, Dublin agency",
      "  • Wireframes and prototypes for 6 client apps",
      "  • Ran 20+ usability sessions",
      "2019–2022  Architectural assistant",
      "",
      "SKILLS",
      "Figma · Sketch · HTML/CSS · Spatial reasoning",
    ].join("\n"),
  },
  {
    name: "Priya Patel",
    email: "priya.patel@example.com",
    phone: "07700 900123",
    role: "Data Analyst",
    source: "LinkedIn",
    stage: "interview",
    createdAt: day(12),
    resumeText: (
      "Analytics engineer with 7 years across retail and healthcare. " +
      "Designed a customer-churn model in Python (scikit-learn) that informed a retention campaign. " +
      "Owns the company's data quality checks; built alerting on 200+ dbt tests. "
    ).repeat(6).trim(),
  },
];

export async function seedCandidates(db: TestDb): Promise<Candidate[]> {
  return db.insert(candidates).values(fixtureCandidates).returning();
}
