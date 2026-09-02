/**
 * Shared row shape for the admin approval queue/detail routes — the raw
 * row shape supabase-js gets back from GET /rest/v1/contractors (see
 * handleContractorsSearch() in supabase/local-dev/postgrest-shim.mjs),
 * mapped to the camelCase shape the admin UI components consume.
 */

export interface AdminGeoRef {
  id: number;
  name_th: string;
  slug: string;
}

export interface AdminCategoryRef {
  id: number;
  name_th: string;
  slug: string;
}

export interface AdminContractorDetail {
  id: string;
  userId: string;
  businessName: string;
  slug: string;
  description: string | null;
  phone: string | null;
  lineId: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  address: string | null;
  yearsExperience: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  verificationStatus: 'unverified' | 'verified';
  province: AdminGeoRef | null;
  district: AdminGeoRef | null;
  categories: AdminCategoryRef[];
  createdAt: string;
}

interface RawAdminContractorRow {
  id: string;
  user_id: string;
  business_name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  line_id: string | null;
  facebook_url: string | null;
  website_url: string | null;
  address: string | null;
  years_experience: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  verification_status: 'unverified' | 'verified';
  provinces: AdminGeoRef | null;
  districts: AdminGeoRef | null;
  contractor_categories: Array<{ categories: AdminCategoryRef | null }> | null;
  created_at: string;
}

export function mapAdminContractorRow(row: unknown): AdminContractorDetail {
  const r = row as RawAdminContractorRow;
  const categories: AdminCategoryRef[] = Array.isArray(r.contractor_categories)
    ? r.contractor_categories.map((cc) => cc.categories).filter((c): c is AdminCategoryRef => Boolean(c))
    : [];

  return {
    id: r.id,
    userId: r.user_id,
    businessName: r.business_name,
    slug: r.slug,
    description: r.description,
    phone: r.phone,
    lineId: r.line_id,
    facebookUrl: r.facebook_url,
    websiteUrl: r.website_url,
    address: r.address,
    yearsExperience: r.years_experience,
    status: r.status,
    verificationStatus: r.verification_status,
    province: r.provinces,
    district: r.districts,
    categories,
    createdAt: r.created_at,
  };
}
