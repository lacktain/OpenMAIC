import type { SceneOutline } from '@/lib/types/generation';

export interface CloudCurriculumStrand {
  id: string;
  title: string;
  rationale: string;
  keywords: string[];
  outcomes: string[];
  prerequisites: string[];
}

export const CLOUD_CURRICULUM_STRANDS: CloudCurriculumStrand[] = [
  {
    id: 'cloud_architecture_foundations',
    title: 'Cloud architecture and service foundations',
    rationale:
      'Establishes the architectural principles, delivery choices, and foundational concepts learners need before implementation work.',
    keywords: [
      'architecture',
      'delivery model',
      'cloud principles',
      'foundations',
      'management mechanisms',
    ],
    outcomes: [
      'has knowledge of cloud architecture and infrastructure, and its place in society and working life',
      'can explain vocational choices related to cloud architecture, setup, management and monitoring',
    ],
    prerequisites: [
      'Basic familiarity with core cloud service models and deployment concepts',
      'Readiness to compare architectural trade-offs instead of memorising a single cloud pattern',
    ],
  },
  {
    id: 'hybrid_network_balancing_compliance',
    title: 'Hybrid networking, balancing and compliance',
    rationale:
      'Connects network design decisions to resilience, regulation, and stable service delivery in real cloud environments.',
    keywords: [
      'hybrid network',
      'network balancing',
      'load balancing',
      'vpn',
      'direct connect',
      'latency',
      'compliance',
      'regulation',
      'sla',
      'service quality',
    ],
    outcomes: [
      'has knowledge about network balancing and hybrid network connections',
      'can setup network balancing and hybrid network connections',
      'has insights into relevant regulations, standards, agreements and quality requirements in cloud infrastructures',
    ],
    prerequisites: [
      'Comfort reading basic network topologies and traffic paths',
      'Awareness that cloud network decisions must satisfy both technical and regulatory constraints',
    ],
  },
  {
    id: 'storage_and_data_lifecycle',
    title: 'Storage optimisation and data lifecycle management',
    rationale:
      'Frames storage as a design space involving performance, cost, access control, and lifecycle choices.',
    keywords: [
      'storage',
      'storage tier',
      'data lifecycle',
      'availability',
      'backup',
      'archive',
      'access control',
      'blob',
      'object storage',
    ],
    outcomes: [
      'has knowledge of common ways to optimise storage alternatives and services',
      'can setup and optimise cloud storage, and manage availability and access control',
    ],
    prerequisites: [
      'Basic understanding of different storage types and why access patterns matter',
      'Readiness to compare performance, durability, and cost in storage choices',
    ],
  },
  {
    id: 'scalability_and_serverless',
    title: 'Scalability, autoscaling and serverless operations',
    rationale:
      'Moves learners from static infrastructure thinking toward elastic scaling decisions and operational trade-offs.',
    keywords: [
      'scalability',
      'autoscaling',
      'auto scaling',
      'serverless',
      'vm set',
      'node cluster',
      'scale out',
      'scale in',
      'threshold',
    ],
    outcomes: [
      'has knowledge of common ways to handle scalability in virtual machine sets, node-clusters, containers and serverless technologies',
      'can assess their own work related to applicable norms and requirements for a stable and scalable cloud infrastructure solution',
      'can explain their vocational choices related to the setup, management and monitoring of cloud technologies and elements',
    ],
    prerequisites: [
      'Basic familiarity with compute resources, workload variation, and performance signals',
      'Willingness to compare cost, responsiveness, and operational risk in scaling decisions',
    ],
  },
  {
    id: 'containers_and_microservices',
    title: 'Containers, orchestration and microservices',
    rationale:
      'Links container deployment, networking, and service decomposition to operationally realistic cloud practice.',
    keywords: [
      'container',
      'containers',
      'kubernetes',
      'orchestration',
      'microservices',
      'microservice',
      'event-driven',
      'container networking',
      'container security',
    ],
    outcomes: [
      'masters relevant vocational tools to interact with and manage cloud storage and container technologies',
      'can develop work methods, products and/or services of relevance to cloud design, infrastructure and best practices',
    ],
    prerequisites: [
      'Basic understanding of application packaging and service boundaries',
      'Readiness to reason about deployment, networking, and security together',
    ],
  },
  {
    id: 'migration_and_multicloud',
    title: 'Migration, interoperability and multi-cloud strategy',
    rationale:
      'Helps learners reason about platform movement, lock-in, and interoperability instead of treating one provider as the whole discipline.',
    keywords: [
      'multi-cloud',
      'multicloud',
      'interoperability',
      'vendor lock-in',
      'lock-in',
      'migration',
      'modernization',
      'monolith',
      'legacy',
    ],
    outcomes: [
      'can carry out work based on the needs of the users of cloud-based services',
      'can carry out work with cloud-based services based on business needs',
      'can exchange points of view with others and participate in discussions about the development of good practice',
    ],
    prerequisites: [
      'Basic understanding of application dependencies and operational context',
      'Readiness to weigh user needs, business needs, and platform constraints together',
    ],
  },
  {
    id: 'observability_resilience_and_incident_response',
    title: 'Observability, resilience and incident response',
    rationale:
      'Positions monitoring, logging, alerting, and disaster recovery as a connected operational practice rather than isolated tools.',
    keywords: [
      'monitoring',
      'logging',
      'observability',
      'alerting',
      'incident',
      'incident response',
      'disaster recovery',
      'dr',
      'siem',
      'log analytics',
      'benchmarking',
      'performance',
    ],
    outcomes: [
      'masters relevant vocational tools to monitor cloud network traffic and manage logs',
      'can apply vocational knowledge to troubleshoot cloud infrastructure and security solutions',
      'can reflect over cloud configurations and settings and adjust them under supervision',
    ],
    prerequisites: [
      'Basic familiarity with system health signals, logs, and operational feedback loops',
      'Readiness to trace incidents from symptom to likely cause',
    ],
  },
  {
    id: 'iac_governance_and_security',
    title: 'Infrastructure as Code, governance and secure operations',
    rationale:
      'Connects automation, policy, RBAC, and ethical handling of data to responsible cloud infrastructure practice.',
    keywords: [
      'terraform',
      'arm',
      'infrastructure as code',
      'iac',
      'governance',
      'policy',
      'rbac',
      'role-based access control',
      'security',
      'compliance automation',
      'ethical',
      'data protection',
    ],
    outcomes: [
      'can plan and carry out cloud design, infrastructure and services alone or as part of a group and in accordance with ethical requirements and principles',
      'can reflect over settings, rules and regulations related to security in the cloud, and adjust them under supervision',
      'understands the ethical principles that apply when working with personal and corporate data in the cloud',
    ],
    prerequisites: [
      'Basic familiarity with permissions, identities, and repeatable deployment workflows',
      'Awareness that automation and access control choices carry security and ethical consequences',
    ],
  },
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function keywordScore(text: string, keywords: string[]): number {
  const normalized = normalizeText(text);
  return keywords.reduce(
    (score, keyword) => (normalized.includes(normalizeText(keyword)) ? score + 1 : score),
    0,
  );
}

export function isCloudCurriculumContext(requirement: string, outlines: SceneOutline[]): boolean {
  const combined = normalizeText(
    `${requirement} ${outlines.map((outline) => `${outline.title} ${outline.description} ${outline.keyPoints.join(' ')}`).join(' ')}`,
  );
  return /(cloud|azure|aws|gcp|kubernetes|terraform|serverless|container|containers|infrastructure|rbac|compliance|observability)/.test(
    combined,
  );
}

export function matchCloudCurriculumStrands(
  requirement: string,
  outlines: SceneOutline[],
): CloudCurriculumStrand[] {
  if (!isCloudCurriculumContext(requirement, outlines)) return [];

  const corpus = `${requirement}\n${outlines.map((outline) => `${outline.title}\n${outline.description}\n${outline.keyPoints.join('\n')}`).join('\n')}`;
  const scored = CLOUD_CURRICULUM_STRANDS.map((strand) => ({
    strand,
    score: keywordScore(corpus, strand.keywords),
  }))
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.strand.title.localeCompare(right.strand.title),
    );

  if (scored.length === 0) {
    return [CLOUD_CURRICULUM_STRANDS[0], CLOUD_CURRICULUM_STRANDS[3]].filter(Boolean);
  }

  return scored.slice(0, 3).map((entry) => entry.strand);
}

export function matchCloudCurriculumStrandForOutline(
  outline: SceneOutline,
  matchedStrands: CloudCurriculumStrand[],
): CloudCurriculumStrand | undefined {
  const candidates = matchedStrands.length > 0 ? matchedStrands : CLOUD_CURRICULUM_STRANDS;
  const corpus = `${outline.title}\n${outline.description}\n${outline.keyPoints.join('\n')}`;

  const scored = candidates
    .map((strand) => ({ strand, score: keywordScore(corpus, strand.keywords) }))
    .sort(
      (left, right) =>
        right.score - left.score || left.strand.title.localeCompare(right.strand.title),
    );

  if (!scored[0] || scored[0].score === 0) {
    return matchedStrands[0];
  }

  return scored[0].strand;
}

export function getCloudCurriculumStrandById(strandId: string): CloudCurriculumStrand | undefined {
  return CLOUD_CURRICULUM_STRANDS.find((strand) => strand.id === strandId);
}
