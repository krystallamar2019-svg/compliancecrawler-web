import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const agreementReviewsRouter = Router();

const activityKeys = [
  'same_brand',
  'same_site',
  'same_social',
  'same_email_list',
  'cross_sell_owned_audience',
  'cross_sell_company_customers',
  'build_multiple_teams',
  'recruit_existing_downline',
  'recruit_same_prospect',
  'compare_products',
] as const;

const relationshipTypes = ['affiliate', 'direct_sales', 'network_marketing', 'referral', 'sponsor', 'other'] as const;
const customerSources = ['independently_owned', 'company_provided', 'mixed_or_unsure', 'not_applicable'] as const;

const partySchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  relationshipType: z.enum(relationshipTypes).default('affiliate'),
  agreementTitle: z.string().trim().max(300).optional(),
  agreementVersion: z.string().trim().max(120).optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sourceUrl: z.string().url().max(2_048).optional(),
  documentText: z.string().max(250_000).optional(),
});

const createReviewSchema = z.object({
  brandName: z.string().trim().min(1).max(200),
  intendedActivities: z.array(z.enum(activityKeys)).min(1).max(activityKeys.length),
  customerSource: z.enum(customerSources).default('mixed_or_unsure'),
  notes: z.string().trim().max(5_000).optional(),
  parties: z.array(partySchema).min(2).max(12),
});

const updatePartySchema = partySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

const topicPatterns: Record<string, RegExp[]> = {
  exclusivity: [/\bexclusive\b/i, /\bnon[- ]?compete\b/i, /\bcompeting (?:business|company|opportunit|product)/i, /\bother (?:direct[- ]?selling|network marketing|mlm)\b/i],
  cross_recruiting: [/cross[- ]?recruit/i, /\brecruit\b/i, /\benroll\b/i, /\bsponsor\b/i, /\bsolicit\b/i],
  non_solicit: [/non[- ]?solicit/i, /\bsolicit\b/i, /\binduce\b/i, /\bentice\b/i],
  customer_data: [/customer list/i, /customer data/i, /customer information/i, /confidential information/i, /proprietary information/i, /personal information/i],
  genealogy: [/genealog/i, /downline/i, /upline/i, /organization report/i, /team report/i],
  marketing: [/marketing material/i, /advertis/i, /promotion/i, /social media/i, /website/i, /email/i, /text message/i],
  trademark: [/trademark/i, /trade name/i, /logo/i, /brand asset/i, /intellectual property/i],
  comparative: [/comparative/i, /comparison/i, /competitor/i, /disparag/i],
  claims: [/income claim/i, /earnings claim/i, /health claim/i, /disease claim/i, /testimonial/i, /claim substanti/i],
  disclosure: [/disclos/i, /endorsement/i, /affiliate relationship/i],
};

const activityTopics: Record<(typeof activityKeys)[number], string[]> = {
  same_brand: ['trademark', 'marketing', 'exclusivity'],
  same_site: ['marketing', 'trademark', 'exclusivity'],
  same_social: ['marketing', 'trademark', 'exclusivity', 'disclosure'],
  same_email_list: ['marketing', 'customer_data', 'non_solicit'],
  cross_sell_owned_audience: ['marketing', 'disclosure', 'exclusivity'],
  cross_sell_company_customers: ['customer_data', 'non_solicit', 'cross_recruiting', 'genealogy'],
  build_multiple_teams: ['exclusivity', 'cross_recruiting', 'non_solicit'],
  recruit_existing_downline: ['cross_recruiting', 'non_solicit', 'genealogy'],
  recruit_same_prospect: ['cross_recruiting', 'non_solicit', 'exclusivity'],
  compare_products: ['comparative', 'trademark', 'claims'],
};

const activityLabels: Record<(typeof activityKeys)[number], string> = {
  same_brand: 'Place multiple offers under one personal or business brand',
  same_site: 'Promote multiple companies on the same website',
  same_social: 'Promote multiple companies from the same social accounts',
  same_email_list: 'Email the same audience about multiple companies',
  cross_sell_owned_audience: 'Cross-promote to an independently built audience',
  cross_sell_company_customers: 'Market another company to customers obtained through a company relationship',
  build_multiple_teams: 'Build active teams in multiple companies',
  recruit_existing_downline: 'Introduce an existing downline/team member to another opportunity',
  recruit_same_prospect: 'Present multiple opportunities to the same prospect',
  compare_products: 'Compare products or offers across companies',
};

const prohibitionPattern = /\b(shall not|may not|must not|cannot|can not|prohibit(?:ed|s)?|forbid(?:den)?|not permitted|not allowed|is restricted from|are restricted from)\b/i;
const conditionalPattern = /\b(subject to|prior written approval|written consent|only if|must obtain|shall obtain|restricted|limitation|limitations)\b/i;
const permissionPattern = /\b(non[- ]?exclusive|may participate|may promote|may market|may engage|is permitted to|are permitted to|may represent|may sell)\b/i;

function cleanText(value: string): string {
  return value.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function clauses(text: string): string[] {
  const normalized = cleanText(text);
  if (!normalized) return [];
  return normalized
    .split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 24)
    .slice(0, 3_000);
}

function topicMatches(clause: string, topics: string[]): string[] {
  return topics.filter((topic) => (topicPatterns[topic] ?? []).some((pattern) => pattern.test(clause)));
}

function saferStructure(activity: (typeof activityKeys)[number], customerSource: string): string {
  if (activity === 'cross_sell_company_customers' || activity === 'recruit_existing_downline') {
    return 'Keep company-provided customer, distributor, genealogy, and team records separate. Do not cross-solicit them unless the current agreement clearly permits it or qualified counsel confirms the activity.';
  }
  if (activity === 'build_multiple_teams') {
    return 'Use separate company-specific recruiting paths and disclosures. Do not use one company’s downline, genealogy, customer records, training channels, or branded assets to build another team.';
  }
  if (activity === 'same_site' || activity === 'same_brand' || activity === 'same_social') {
    return 'Keep each company clearly separated inside the larger personal-brand ecosystem. Use company-specific disclosures, approved assets, and landing paths, and do not imply that the companies are affiliated with one another.';
  }
  if (activity === 'same_email_list') {
    return customerSource === 'independently_owned'
      ? 'Use only contacts you independently collected with appropriate consent. Keep company-provided lists and genealogy records out of cross-promotion unless expressly permitted.'
      : 'Separate independently owned contacts from company-provided customers, distributors, and genealogy records before cross-promoting.';
  }
  if (activity === 'compare_products') {
    return 'Avoid unsupported superiority, health, earnings, or competitor claims. Use accurate source-supported comparisons and each company’s approved brand assets.';
  }
  return 'Keep the companies, claims, disclosures, customer sources, and recruiting paths clearly separated until the current agreements support combining them.';
}

function analyzePartyActivity(
  text: string | null,
  activity: (typeof activityKeys)[number],
  customerSource: string,
) {
  if (!text?.trim()) {
    return {
      risk_level: 'cannot_determine' as const,
      clause_topic: activityTopics[activity][0],
      clause_reference: null,
      evidence_excerpt: null,
      explanation: `Current agreement text is required before BrandedAlign can evaluate: ${activityLabels[activity]}.`,
      safer_structure: saferStructure(activity, customerSource),
      confidence: 0,
    };
  }

  const relevantTopics = activityTopics[activity];
  const matched = clauses(text)
    .map((clause) => ({ clause, topics: topicMatches(clause, relevantTopics) }))
    .filter((item) => item.topics.length > 0);

  if (!matched.length) {
    return {
      risk_level: 'cannot_determine' as const,
      clause_topic: relevantTopics[0],
      clause_reference: null,
      evidence_excerpt: null,
      explanation: `No clause was confidently identified for ${activityLabels[activity].toLowerCase()}. Absence of a detected clause is not treated as permission.`,
      safer_structure: saferStructure(activity, customerSource),
      confidence: 0.25,
    };
  }

  const prohibited = matched.find((item) => prohibitionPattern.test(item.clause));
  if (prohibited) {
    return {
      risk_level: 'red' as const,
      clause_topic: prohibited.topics[0],
      clause_reference: null,
      evidence_excerpt: prohibited.clause.slice(0, 650),
      explanation: `Potential prohibition or restriction detected for ${activityLabels[activity].toLowerCase()}. Professional review is advised before proceeding.`,
      safer_structure: saferStructure(activity, customerSource),
      confidence: 0.9,
    };
  }

  const conditional = matched.find((item) => conditionalPattern.test(item.clause));
  if (conditional) {
    return {
      risk_level: 'yellow' as const,
      clause_topic: conditional.topics[0],
      clause_reference: null,
      evidence_excerpt: conditional.clause.slice(0, 650),
      explanation: `Conditional or approval-based language was detected for ${activityLabels[activity].toLowerCase()}. Review the full section before relying on it.`,
      safer_structure: saferStructure(activity, customerSource),
      confidence: 0.78,
    };
  }

  const permitted = matched.find((item) => permissionPattern.test(item.clause));
  if (permitted) {
    return {
      risk_level: 'green' as const,
      clause_topic: permitted.topics[0],
      clause_reference: null,
      evidence_excerpt: permitted.clause.slice(0, 650),
      explanation: `Potentially permissive language was identified for ${activityLabels[activity].toLowerCase()}. This means no conflict was found in the detected clause, not that BrandedAlign is certifying legal compliance.`,
      safer_structure: saferStructure(activity, customerSource),
      confidence: 0.72,
    };
  }

  const first = matched[0];
  return {
    risk_level: 'yellow' as const,
    clause_topic: first.topics[0],
    clause_reference: null,
    evidence_excerpt: first.clause.slice(0, 650),
    explanation: `Relevant agreement language was found for ${activityLabels[activity].toLowerCase()}, but it is not clear enough for a safe yes/no conclusion.`,
    safer_structure: saferStructure(activity, customerSource),
    confidence: 0.58,
  };
}

async function requireActiveMembership(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('subscription_status,billing_blocked')
    .eq('id', organizationId)
    .single();
  if (error) throw error;
  return !data.billing_blocked && ['active', 'trialing'].includes(String(data.subscription_status));
}

async function loadOwnedReview(reviewId: string, organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from('agreement_reviews')
    .select('*')
    .eq('id', reviewId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function analyzeReview(reviewId: string, organizationId: string) {
  const review = await loadOwnedReview(reviewId, organizationId);
  if (!review) return null;

  const { data: parties, error: partyError } = await supabaseAdmin
    .from('agreement_parties')
    .select('*')
    .eq('review_id', reviewId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });
  if (partyError) throw partyError;

  await supabaseAdmin
    .from('agreement_findings')
    .delete()
    .eq('review_id', reviewId)
    .eq('organization_id', organizationId);

  const activities = (Array.isArray(review.intended_activities) ? review.intended_activities : [])
    .filter((value): value is (typeof activityKeys)[number] => activityKeys.includes(value));

  const findings = [];
  for (const party of parties ?? []) {
    for (const activity of activities) {
      findings.push({
        organization_id: organizationId,
        review_id: reviewId,
        party_id: party.id,
        activity_key: activity,
        ...analyzePartyActivity(party.document_text, activity, review.customer_source),
      });
    }
  }

  if (findings.length) {
    const { error: findingError } = await supabaseAdmin.from('agreement_findings').insert(findings);
    if (findingError) throw findingError;
  }

  const missingDocuments = (parties ?? []).some((party) => !String(party.document_text ?? '').trim());
  const status = missingDocuments ? 'needs_documents' : 'completed';
  const { error: reviewError } = await supabaseAdmin
    .from('agreement_reviews')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', reviewId)
    .eq('organization_id', organizationId);
  if (reviewError) throw reviewError;

  return { status, findings };
}

agreementReviewsRouter.get('/', async (req, res, next) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).auth;
    const { data, error } = await supabaseAdmin
      .from('agreement_reviews')
      .select('id,brand_name,status,customer_source,intended_activities,created_at,updated_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ reviews: data ?? [] });
  } catch (error) {
    next(error);
  }
});

agreementReviewsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_AGREEMENT_REVIEW', details: parsed.error.flatten() });
      return;
    }

    const { organizationId, userId } = (req as AuthenticatedRequest).auth;
    if (!(await requireActiveMembership(organizationId))) {
      res.status(402).json({ error: 'ACTIVE_SUBSCRIPTION_REQUIRED' });
      return;
    }

    const { data: review, error: reviewError } = await supabaseAdmin
      .from('agreement_reviews')
      .insert({
        organization_id: organizationId,
        created_by: userId,
        brand_name: parsed.data.brandName,
        intended_activities: parsed.data.intendedActivities,
        customer_source: parsed.data.customerSource,
        notes: parsed.data.notes ?? null,
        status: 'draft',
      })
      .select('*')
      .single();
    if (reviewError) throw reviewError;

    const rows = parsed.data.parties.map((party) => ({
      organization_id: organizationId,
      review_id: review.id,
      company_name: party.companyName,
      relationship_type: party.relationshipType,
      agreement_title: party.agreementTitle || null,
      agreement_version: party.agreementVersion || null,
      effective_date: party.effectiveDate || null,
      source_url: party.sourceUrl || null,
      document_text: party.documentText?.trim() || null,
      document_status: party.documentText?.trim() ? 'text_provided' : party.sourceUrl ? 'source_link' : 'missing',
    }));

    const { data: parties, error: partyError } = await supabaseAdmin
      .from('agreement_parties')
      .insert(rows)
      .select('*');
    if (partyError) throw partyError;

    const analysis = await analyzeReview(review.id, organizationId);
    res.status(201).json({ review: { ...review, status: analysis?.status ?? review.status }, parties, findings: analysis?.findings ?? [] });
  } catch (error) {
    next(error);
  }
});

agreementReviewsRouter.get('/:id', async (req, res, next) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).auth;
    const review = await loadOwnedReview(req.params.id, organizationId);
    if (!review) {
      res.status(404).json({ error: 'AGREEMENT_REVIEW_NOT_FOUND' });
      return;
    }

    const [{ data: parties, error: partyError }, { data: findings, error: findingError }] = await Promise.all([
      supabaseAdmin.from('agreement_parties').select('*').eq('review_id', review.id).eq('organization_id', organizationId).order('created_at', { ascending: true }),
      supabaseAdmin.from('agreement_findings').select('*').eq('review_id', review.id).eq('organization_id', organizationId).order('created_at', { ascending: true }),
    ]);
    if (partyError) throw partyError;
    if (findingError) throw findingError;

    res.json({ review, parties: parties ?? [], findings: findings ?? [] });
  } catch (error) {
    next(error);
  }
});

agreementReviewsRouter.patch('/:id/parties/:partyId', async (req, res, next) => {
  try {
    const parsed = updatePartySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'INVALID_AGREEMENT_PARTY_UPDATE', details: parsed.error.flatten() });
      return;
    }

    const { organizationId } = (req as AuthenticatedRequest).auth;
    const review = await loadOwnedReview(req.params.id, organizationId);
    if (!review) {
      res.status(404).json({ error: 'AGREEMENT_REVIEW_NOT_FOUND' });
      return;
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.companyName !== undefined) update.company_name = parsed.data.companyName;
    if (parsed.data.relationshipType !== undefined) update.relationship_type = parsed.data.relationshipType;
    if (parsed.data.agreementTitle !== undefined) update.agreement_title = parsed.data.agreementTitle || null;
    if (parsed.data.agreementVersion !== undefined) update.agreement_version = parsed.data.agreementVersion || null;
    if (parsed.data.effectiveDate !== undefined) update.effective_date = parsed.data.effectiveDate || null;
    if (parsed.data.sourceUrl !== undefined) update.source_url = parsed.data.sourceUrl || null;
    if (parsed.data.documentText !== undefined) {
      update.document_text = parsed.data.documentText?.trim() || null;
      update.document_status = parsed.data.documentText?.trim() ? 'text_provided' : parsed.data.sourceUrl ? 'source_link' : 'missing';
    }

    const { data: party, error } = await supabaseAdmin
      .from('agreement_parties')
      .update(update)
      .eq('id', req.params.partyId)
      .eq('review_id', review.id)
      .eq('organization_id', organizationId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!party) {
      res.status(404).json({ error: 'AGREEMENT_PARTY_NOT_FOUND' });
      return;
    }

    const analysis = await analyzeReview(review.id, organizationId);
    res.json({ party, status: analysis?.status, findings: analysis?.findings ?? [] });
  } catch (error) {
    next(error);
  }
});

agreementReviewsRouter.post('/:id/analyze', async (req, res, next) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).auth;
    if (!(await requireActiveMembership(organizationId))) {
      res.status(402).json({ error: 'ACTIVE_SUBSCRIPTION_REQUIRED' });
      return;
    }
    const analysis = await analyzeReview(req.params.id, organizationId);
    if (!analysis) {
      res.status(404).json({ error: 'AGREEMENT_REVIEW_NOT_FOUND' });
      return;
    }
    res.json(analysis);
  } catch (error) {
    next(error);
  }
});
