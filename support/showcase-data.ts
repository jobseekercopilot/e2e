import type { DemoUser } from './world';

export type ShowcaseEvidenceCategory =
  | 'EMPLOYMENT'
  | 'EDUCATION'
  | 'QUALIFICATION_TRAINING'
  | 'PROJECT';

export interface ShowcaseEvidence {
  category: ShowcaseEvidenceCategory;
  cardText: string;
  roleTitle?: string;
  organisation?: string;
  programme?: string;
  institution?: string;
  qualificationTitle?: string;
  issuer?: string;
  heading?: string;
  projectRole?: string;
  description: string;
  responsibilities?: string;
  achievements?: string;
  startDate?: string;
  endDate?: string;
  issueDate?: string;
  ongoing?: boolean;
  demonstratedSkills: string[];
}

export interface ShowcaseCandidate extends DemoUser {
  noticePeriodDays: number;
  commuteDistanceMiles: number;
  maximumDrivingMinutes: number;
  maximumTransitMinutes: number;
  evidence: ShowcaseEvidence[];
  selectedJob: {
    title: string;
    company: string;
    canonicalJobId?: string;
    provider?: string;
  };
}

export function showcaseCandidate(email: string): ShowcaseCandidate {
  return {
    fullName: 'Alex Taylor',
    email,
    password: 'PublicTestPassword123!',
    skills: [
      'Java',
      'Spring Boot',
      'Angular',
      'TypeScript',
      'REST APIs',
      'Microservices',
      'PostgreSQL',
      'Docker',
      'AWS',
      'CI/CD',
      'Automated Testing',
      'Agile Delivery'
    ],
    targetRoles: [
      'Java Software Developer',
      'Backend Engineer',
      'Full Stack Developer'
    ],
    weeklyHours: 'Full-Time (35-40 hours)',
    qualification: {
      name: 'BSc Computer Science',
      institution: 'University of Birmingham',
      grade: '2:1',
      completed: '2021'
    },
    workHistory: [
      {
        jobTitle: 'Software Developer',
        employer: 'BrightTech Solutions',
        from: 'July 2021',
        to: 'Present',
        description: 'Builds Java and Spring Boot services with Angular interfaces for a cloud delivery platform.'
      },
      {
        jobTitle: 'Software Engineering Intern',
        employer: 'CodeBridge Ltd',
        from: 'June 2020',
        to: 'August 2020',
        description: 'Delivered tested frontend features and API integrations in an Agile engineering team.'
      }
    ],
    homeLocation: 'SW1A 1AA',
    commuteRange: 'Within 25 miles',
    noticePeriodDays: 30,
    commuteDistanceMiles: 25,
    maximumDrivingMinutes: 45,
    maximumTransitMinutes: 60,
    selectedJob: {
      title: 'Java Software Developer',
      company: 'Northstar Digital Labs'
    },
    evidence: [
      {
        category: 'EMPLOYMENT',
        cardText: 'Software Developer',
        roleTitle: 'Software Developer',
        organisation: 'BrightTech Solutions',
        description: 'Develops accessible cloud products used by operations teams to manage customer services.',
        responsibilities: 'Designs Java and Spring Boot microservices, builds Angular features, reviews code and works with product teams to turn user needs into reliable releases.',
        achievements: 'Reduced deployment time by 40%, introduced contract testing across six services and helped the team cut escaped defects by a third.',
        startDate: '2021-07-01',
        ongoing: true,
        demonstratedSkills: ['Java', 'Spring Boot', 'Angular', 'REST APIs', 'Microservices', 'Mentoring']
      },
      {
        category: 'EMPLOYMENT',
        cardText: 'Software Engineering Intern',
        roleTitle: 'Software Engineering Intern',
        organisation: 'CodeBridge Ltd',
        description: 'Worked in a cross-functional Agile team delivering improvements to a customer-support platform.',
        responsibilities: 'Implemented TypeScript components, fixed defects, added API integration tests and supported sprint demonstrations.',
        achievements: 'Automated a repetitive regression check and shortened the team release checklist by two hours.',
        startDate: '2020-06-01',
        endDate: '2020-08-31',
        demonstratedSkills: ['TypeScript', 'Automated Testing', 'Git', 'Agile Delivery']
      },
      {
        category: 'EDUCATION',
        cardText: 'BSc Computer Science',
        programme: 'BSc Computer Science',
        institution: 'University of Birmingham',
        description: 'Graduated with a 2:1 after specialising in distributed systems, databases and human-computer interaction.',
        issueDate: '2021-06-30',
        demonstratedSkills: ['Java', 'SQL', 'Distributed Systems', 'User-centred Design']
      },
      {
        category: 'QUALIFICATION_TRAINING',
        cardText: 'AWS Certified Developer',
        qualificationTitle: 'AWS Certified Developer – Associate',
        issuer: 'Amazon Web Services',
        description: 'Validated practical knowledge of developing, deploying and troubleshooting cloud applications.',
        issueDate: '2025-04-12',
        demonstratedSkills: ['AWS', 'Docker', 'CI/CD', 'Cloud Operations']
      },
      {
        category: 'PROJECT',
        cardText: 'Application Delivery Platform',
        heading: 'Application Delivery Platform',
        projectRole: 'Lead developer',
        description: 'Led a five-person project that joined Java services, Angular workflows and deployment telemetry into one secure delivery platform.',
        achievements: 'Delivered the first release on schedule, added accessible keyboard workflows and achieved 85% automated test coverage.',
        startDate: '2024-01-01',
        endDate: '2025-06-30',
        demonstratedSkills: ['Java', 'Spring Boot', 'Angular', 'PostgreSQL', 'Docker', 'Leadership']
      }
    ]
  };
}
