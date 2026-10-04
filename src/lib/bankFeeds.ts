/**
 * Bank Feeds — connect African bank and mobile-money accounts and pull their
 * transactions into the books.
 *
 * The app ships without live banking credentials, so a connection is
 * *simulated*: choosing a provider and an institution creates a feed, and
 * syncing generates the statement lines that provider would return. Everything
 * is stored locally (this browser) under `fitpro_bank_feeds_v1`, and the
 * accepted lines become ordinary receipt / payment vouchers, so the rest of the
 * accounting module (cash book, ledgers, reconciliation) sees them as normal.
 */

export type FeedStatus = 'connected' | 'needs_attention' | 'disconnected'
export type FeedTxnStatus = 'new' | 'accepted' | 'excluded'

export interface BankFeed {
  id: string
  /** Aggregator used for the connection (Mono, Okra, Stitch…). */
  providerId: string
  institutionId: string
  institutionName: string
  countryCode: string
  /** Account holder name as returned by the bank. */
  accountName: string
  /** Last four digits only — full numbers are never stored. */
  accountMask: string
  currency: string
  /** Chart-of-accounts bank account the feed posts to. */
  ledgerAccountId: string
  status: FeedStatus
  /** How often the provider refreshes the feed. */
  frequency: 'manual' | 'daily' | 'hourly'
  lastSyncAt?: string
  createdAt: string
  /** True when the feed talks to a real provider API (no generated lines). */
  live?: boolean
  /** Last balance read from the provider, when the feed is live. */
  liveBalance?: { amount: string; currency: string; fetchedAt: string }
  /** Provider-side account id, so Sync can pull this account automatically. */
  externalAccountId?: string
}

export interface FeedTxn {
  id: string
  feedId: string
  date: string
  description: string
  reference: string
  /** Positive = money in, negative = money out. */
  amount: number
  /** Running balance reported by the bank. */
  balance: number
  status: FeedTxnStatus
  /** Voucher created (or matched) when the line was accepted. */
  voucherNo?: string
  /** True when the line was matched to a voucher that already existed. */
  matched?: boolean
  /** Suggested posting account (set by the simple rules engine). */
  suggestedAccountId?: string
}

/** Keyword → posting account, applied to new feed lines automatically. */
export interface FeedRule {
  id: string
  /** Case-insensitive text that must appear in the bank description. */
  contains: string
  /** Only apply to money in (+), money out (−) or both. */
  direction: 'any' | 'in' | 'out'
  accountId: string
  createdAt: string
}

export interface FeedState {
  feeds: BankFeed[]
  txns: FeedTxn[]
  rules?: FeedRule[]
}

/** The first rule that matches a line, if any. */
export const matchRule = (rules: FeedRule[], description: string, amount: number): FeedRule | undefined =>
  rules.find((r) => {
    if (!r.contains.trim()) return false
    if (r.direction === 'in' && amount < 0) return false
    if (r.direction === 'out' && amount >= 0) return false
    return description.toLowerCase().includes(r.contains.trim().toLowerCase())
  })

export interface FeedProvider {
  id: string
  name: string
  blurb: string
  /** Countries the aggregator covers (ISO-2). */
  countries: string[]
  /** Account kinds the provider can link. */
  kinds: ('bank' | 'momo')[]
}

/** Open-banking aggregators and payment gateways used across Africa. */
export const FEED_PROVIDERS: FeedProvider[] = [
  { id: 'mono', name: 'Mono', blurb: 'Open banking for Nigeria, Ghana, Kenya and South Africa.', countries: ['NG', 'GH', 'KE', 'ZA'], kinds: ['bank'] },
  { id: 'okra', name: 'Okra', blurb: 'Bank data and payments across Nigeria, Kenya and South Africa.', countries: ['NG', 'KE', 'ZA'], kinds: ['bank'] },
  { id: 'stitch', name: 'Stitch', blurb: 'Bank linking and pay-by-bank for South Africa and Nigeria.', countries: ['ZA', 'NG'], kinds: ['bank'] },
  { id: 'pngme', name: 'Pngme', blurb: 'Bank and mobile-money data for Nigeria, Kenya and Ghana.', countries: ['NG', 'KE', 'GH'], kinds: ['bank', 'momo'] },
  { id: 'onepipe', name: 'OnePipe', blurb: 'Banking APIs for Nigerian institutions.', countries: ['NG'], kinds: ['bank'] },
  { id: 'momo', name: 'MTN MoMo Open API', blurb: 'Mobile-money wallets in Ghana, Uganda, Cameroon, Rwanda and more.', countries: ['GH', 'UG', 'CM', 'RW', 'CI', 'ZM'], kinds: ['momo'] },
  { id: 'flutterwave', name: 'Flutterwave', blurb: 'Settlement and wallet feeds across 30+ African markets.', countries: ['NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'EG', 'CI', 'SN', 'ZM'], kinds: ['bank', 'momo'] },
  { id: 'paystack', name: 'Paystack', blurb: 'Settlement feeds for Nigeria, Ghana, South Africa and Kenya.', countries: ['NG', 'GH', 'ZA', 'KE'], kinds: ['bank'] },
  // ---- global aggregators ----
  { id: 'plaid', name: 'Plaid', blurb: 'Bank connections across North America and Western Europe.', countries: ['US', 'CA', 'GB', 'IE', 'FR', 'ES', 'NL', 'DE'], kinds: ['bank'] },
  { id: 'yodlee', name: 'Envestnet | Yodlee', blurb: 'Account aggregation in 50+ countries worldwide.', countries: ['US', 'CA', 'GB', 'IE', 'DE', 'FR', 'ES', 'NL', 'IT', 'SE', 'AU', 'NZ', 'IN', 'SG', 'ZA', 'AE', 'JP', 'BR', 'MX'], kinds: ['bank'] },
  { id: 'truelayer', name: 'TrueLayer', blurb: 'Open banking for the UK, Ireland and the European Union.', countries: ['GB', 'IE', 'DE', 'FR', 'ES', 'NL', 'IT', 'PL'], kinds: ['bank'] },
  { id: 'tink', name: 'Tink (Visa)', blurb: 'Open banking across the EU, the Nordics and the UK.', countries: ['GB', 'DE', 'FR', 'ES', 'NL', 'IT', 'SE', 'PL', 'IE'], kinds: ['bank'] },
  { id: 'gocardless', name: 'GoCardless Bank Account Data', blurb: 'Formerly Nordigen — free bank data across the EEA and UK.', countries: ['GB', 'IE', 'DE', 'FR', 'ES', 'NL', 'IT', 'SE', 'PL'], kinds: ['bank'] },
  { id: 'saltedge', name: 'Salt Edge', blurb: 'Connections to 5,000+ banks in Europe, Asia and the Americas.', countries: ['GB', 'DE', 'FR', 'ES', 'NL', 'IT', 'SE', 'PL', 'US', 'CA', 'AE', 'SA', 'TR', 'IN', 'SG', 'MY', 'ID', 'PH', 'BR', 'MX', 'CO', 'AU', 'NZ', 'JP', 'CN'], kinds: ['bank'] },
  { id: 'finicity', name: 'Finicity (Mastercard)', blurb: 'Bank data for the United States and Canada.', countries: ['US', 'CA'], kinds: ['bank'] },
  { id: 'belvo', name: 'Belvo', blurb: 'Open finance for Latin America.', countries: ['BR', 'MX', 'CO'], kinds: ['bank'] },
  { id: 'brankas', name: 'Brankas', blurb: 'Open banking across South-East Asia.', countries: ['ID', 'PH', 'MY', 'SG'], kinds: ['bank', 'momo'] },
  { id: 'basiq', name: 'Basiq', blurb: 'Consumer Data Right connections in Australia and New Zealand.', countries: ['AU', 'NZ'], kinds: ['bank'] },
  { id: 'wise', name: 'Wise Business', blurb: 'Multi-currency balances and statement feeds worldwide.', countries: ['US', 'CA', 'GB', 'IE', 'DE', 'FR', 'ES', 'NL', 'IT', 'SE', 'PL', 'AE', 'IN', 'SG', 'MY', 'AU', 'NZ', 'JP', 'BR', 'MX', 'ZA', 'NG', 'GH', 'KE'], kinds: ['bank'] },
  { id: 'revolut', name: 'Revolut Business', blurb: 'Business account feeds for the UK, EEA, US and Singapore.', countries: ['GB', 'IE', 'DE', 'FR', 'ES', 'NL', 'IT', 'PL', 'SE', 'US', 'SG', 'AU'], kinds: ['bank'] },
]

export interface FeedInstitution {
  id: string
  name: string
  countryCode: string
  kind: 'bank' | 'momo'
}

/** Banks and wallets selectable when linking an account, by country. */
export const FEED_INSTITUTIONS: FeedInstitution[] = [
  // Ghana
  { id: 'gh_gcb', name: 'GCB Bank', countryCode: 'GH', kind: 'bank' },
  { id: 'gh_ecobank', name: 'Ecobank Ghana', countryCode: 'GH', kind: 'bank' },
  { id: 'gh_absa', name: 'Absa Bank Ghana', countryCode: 'GH', kind: 'bank' },
  { id: 'gh_stanbic', name: 'Stanbic Bank Ghana', countryCode: 'GH', kind: 'bank' },
  { id: 'gh_fidelity', name: 'Fidelity Bank Ghana', countryCode: 'GH', kind: 'bank' },
  { id: 'gh_calbank', name: 'CalBank', countryCode: 'GH', kind: 'bank' },
  { id: 'gh_nib', name: 'National Investment Bank', countryCode: 'GH', kind: 'bank' },
  { id: 'gh_cbg', name: 'Consolidated Bank Ghana', countryCode: 'GH', kind: 'bank' },
  { id: 'gh_mtn', name: 'MTN Mobile Money (Ghana)', countryCode: 'GH', kind: 'momo' },
  { id: 'gh_telecel', name: 'Telecel Cash', countryCode: 'GH', kind: 'momo' },
  { id: 'gh_at', name: 'AT Money', countryCode: 'GH', kind: 'momo' },
  // Nigeria
  { id: 'ng_gtb', name: 'Guaranty Trust Bank', countryCode: 'NG', kind: 'bank' },
  { id: 'ng_zenith', name: 'Zenith Bank', countryCode: 'NG', kind: 'bank' },
  { id: 'ng_access', name: 'Access Bank', countryCode: 'NG', kind: 'bank' },
  { id: 'ng_uba', name: 'United Bank for Africa', countryCode: 'NG', kind: 'bank' },
  { id: 'ng_first', name: 'First Bank of Nigeria', countryCode: 'NG', kind: 'bank' },
  { id: 'ng_kuda', name: 'Kuda Bank', countryCode: 'NG', kind: 'bank' },
  { id: 'ng_opay', name: 'OPay Wallet', countryCode: 'NG', kind: 'momo' },
  // Kenya
  { id: 'ke_kcb', name: 'KCB Bank Kenya', countryCode: 'KE', kind: 'bank' },
  { id: 'ke_equity', name: 'Equity Bank Kenya', countryCode: 'KE', kind: 'bank' },
  { id: 'ke_coop', name: 'Co-operative Bank of Kenya', countryCode: 'KE', kind: 'bank' },
  { id: 'ke_absa', name: 'Absa Bank Kenya', countryCode: 'KE', kind: 'bank' },
  { id: 'ke_mpesa', name: 'M-Pesa (Safaricom)', countryCode: 'KE', kind: 'momo' },
  // South Africa
  { id: 'za_standard', name: 'Standard Bank', countryCode: 'ZA', kind: 'bank' },
  { id: 'za_fnb', name: 'First National Bank', countryCode: 'ZA', kind: 'bank' },
  { id: 'za_absa', name: 'Absa Bank', countryCode: 'ZA', kind: 'bank' },
  { id: 'za_nedbank', name: 'Nedbank', countryCode: 'ZA', kind: 'bank' },
  { id: 'za_capitec', name: 'Capitec Bank', countryCode: 'ZA', kind: 'bank' },
  // East / Central / West Africa
  { id: 'ug_stanbic', name: 'Stanbic Bank Uganda', countryCode: 'UG', kind: 'bank' },
  { id: 'ug_mtn', name: 'MTN MoMo Uganda', countryCode: 'UG', kind: 'momo' },
  { id: 'tz_crdb', name: 'CRDB Bank', countryCode: 'TZ', kind: 'bank' },
  { id: 'tz_mpesa', name: 'M-Pesa Tanzania', countryCode: 'TZ', kind: 'momo' },
  { id: 'rw_bk', name: 'Bank of Kigali', countryCode: 'RW', kind: 'bank' },
  { id: 'ci_sgci', name: 'Société Générale Côte d’Ivoire', countryCode: 'CI', kind: 'bank' },
  { id: 'ci_wave', name: 'Wave Mobile Money', countryCode: 'CI', kind: 'momo' },
  { id: 'sn_cbao', name: 'CBAO Sénégal', countryCode: 'SN', kind: 'bank' },
  { id: 'eg_nbe', name: 'National Bank of Egypt', countryCode: 'EG', kind: 'bank' },
  { id: 'zm_zanaco', name: 'Zanaco', countryCode: 'ZM', kind: 'bank' },
  { id: 'cm_afriland', name: 'Afriland First Bank', countryCode: 'CM', kind: 'bank' },
  // North America
  { id: 'us_chase', name: 'JPMorgan Chase', countryCode: 'US', kind: 'bank' },
  { id: 'us_boa', name: 'Bank of America', countryCode: 'US', kind: 'bank' },
  { id: 'us_wells', name: 'Wells Fargo', countryCode: 'US', kind: 'bank' },
  { id: 'us_citi', name: 'Citibank', countryCode: 'US', kind: 'bank' },
  { id: 'us_pnc', name: 'PNC Bank', countryCode: 'US', kind: 'bank' },
  { id: 'ca_rbc', name: 'Royal Bank of Canada', countryCode: 'CA', kind: 'bank' },
  { id: 'ca_td', name: 'TD Canada Trust', countryCode: 'CA', kind: 'bank' },
  { id: 'ca_scotia', name: 'Scotiabank', countryCode: 'CA', kind: 'bank' },
  // United Kingdom & Ireland
  { id: 'gb_barclays', name: 'Barclays', countryCode: 'GB', kind: 'bank' },
  { id: 'gb_hsbc', name: 'HSBC UK', countryCode: 'GB', kind: 'bank' },
  { id: 'gb_lloyds', name: 'Lloyds Bank', countryCode: 'GB', kind: 'bank' },
  { id: 'gb_natwest', name: 'NatWest', countryCode: 'GB', kind: 'bank' },
  { id: 'gb_monzo', name: 'Monzo', countryCode: 'GB', kind: 'bank' },
  { id: 'gb_starling', name: 'Starling Bank', countryCode: 'GB', kind: 'bank' },
  { id: 'gb_revolut', name: 'Revolut Business (UK)', countryCode: 'GB', kind: 'bank' },
  { id: 'ie_aib', name: 'Allied Irish Banks', countryCode: 'IE', kind: 'bank' },
  { id: 'ie_boi', name: 'Bank of Ireland', countryCode: 'IE', kind: 'bank' },
  // Europe
  { id: 'de_deutsche', name: 'Deutsche Bank', countryCode: 'DE', kind: 'bank' },
  { id: 'de_commerzbank', name: 'Commerzbank', countryCode: 'DE', kind: 'bank' },
  { id: 'de_n26', name: 'N26', countryCode: 'DE', kind: 'bank' },
  { id: 'fr_bnp', name: 'BNP Paribas', countryCode: 'FR', kind: 'bank' },
  { id: 'fr_credit_agricole', name: 'Crédit Agricole', countryCode: 'FR', kind: 'bank' },
  { id: 'es_santander', name: 'Banco Santander', countryCode: 'ES', kind: 'bank' },
  { id: 'es_bbva', name: 'BBVA', countryCode: 'ES', kind: 'bank' },
  { id: 'nl_ing', name: 'ING Bank', countryCode: 'NL', kind: 'bank' },
  { id: 'nl_rabobank', name: 'Rabobank', countryCode: 'NL', kind: 'bank' },
  { id: 'it_intesa', name: 'Intesa Sanpaolo', countryCode: 'IT', kind: 'bank' },
  { id: 'it_unicredit', name: 'UniCredit', countryCode: 'IT', kind: 'bank' },
  { id: 'se_seb', name: 'SEB', countryCode: 'SE', kind: 'bank' },
  { id: 'se_swedbank', name: 'Swedbank', countryCode: 'SE', kind: 'bank' },
  { id: 'pl_pko', name: 'PKO Bank Polski', countryCode: 'PL', kind: 'bank' },
  { id: 'tr_garanti', name: 'Garanti BBVA', countryCode: 'TR', kind: 'bank' },
  { id: 'tr_isbank', name: 'Türkiye İş Bankası', countryCode: 'TR', kind: 'bank' },
  // Middle East
  { id: 'ae_enbd', name: 'Emirates NBD', countryCode: 'AE', kind: 'bank' },
  { id: 'ae_fab', name: 'First Abu Dhabi Bank', countryCode: 'AE', kind: 'bank' },
  { id: 'ae_mashreq', name: 'Mashreq Bank', countryCode: 'AE', kind: 'bank' },
  { id: 'sa_rajhi', name: 'Al Rajhi Bank', countryCode: 'SA', kind: 'bank' },
  { id: 'sa_snb', name: 'Saudi National Bank', countryCode: 'SA', kind: 'bank' },
  // Asia
  { id: 'in_hdfc', name: 'HDFC Bank', countryCode: 'IN', kind: 'bank' },
  { id: 'in_icici', name: 'ICICI Bank', countryCode: 'IN', kind: 'bank' },
  { id: 'in_sbi', name: 'State Bank of India', countryCode: 'IN', kind: 'bank' },
  { id: 'in_paytm', name: 'Paytm Payments Bank', countryCode: 'IN', kind: 'momo' },
  { id: 'sg_dbs', name: 'DBS Bank', countryCode: 'SG', kind: 'bank' },
  { id: 'sg_ocbc', name: 'OCBC Bank', countryCode: 'SG', kind: 'bank' },
  { id: 'sg_uob', name: 'United Overseas Bank', countryCode: 'SG', kind: 'bank' },
  { id: 'my_maybank', name: 'Maybank', countryCode: 'MY', kind: 'bank' },
  { id: 'my_cimb', name: 'CIMB Bank', countryCode: 'MY', kind: 'bank' },
  { id: 'id_bca', name: 'Bank Central Asia (BCA)', countryCode: 'ID', kind: 'bank' },
  { id: 'id_mandiri', name: 'Bank Mandiri', countryCode: 'ID', kind: 'bank' },
  { id: 'id_gopay', name: 'GoPay', countryCode: 'ID', kind: 'momo' },
  { id: 'ph_bdo', name: 'BDO Unibank', countryCode: 'PH', kind: 'bank' },
  { id: 'ph_gcash', name: 'GCash', countryCode: 'PH', kind: 'momo' },
  { id: 'jp_mufg', name: 'MUFG Bank', countryCode: 'JP', kind: 'bank' },
  { id: 'jp_smbc', name: 'Sumitomo Mitsui Banking Corp.', countryCode: 'JP', kind: 'bank' },
  { id: 'cn_icbc', name: 'Industrial & Commercial Bank of China', countryCode: 'CN', kind: 'bank' },
  { id: 'cn_boc', name: 'Bank of China', countryCode: 'CN', kind: 'bank' },
  // Oceania
  { id: 'au_cba', name: 'Commonwealth Bank', countryCode: 'AU', kind: 'bank' },
  { id: 'au_nab', name: 'National Australia Bank', countryCode: 'AU', kind: 'bank' },
  { id: 'au_anz', name: 'ANZ', countryCode: 'AU', kind: 'bank' },
  { id: 'au_westpac', name: 'Westpac', countryCode: 'AU', kind: 'bank' },
  { id: 'nz_anz', name: 'ANZ New Zealand', countryCode: 'NZ', kind: 'bank' },
  { id: 'nz_asb', name: 'ASB Bank', countryCode: 'NZ', kind: 'bank' },
  // Latin America
  { id: 'br_itau', name: 'Itaú Unibanco', countryCode: 'BR', kind: 'bank' },
  { id: 'br_bradesco', name: 'Bradesco', countryCode: 'BR', kind: 'bank' },
  { id: 'br_nubank', name: 'Nubank', countryCode: 'BR', kind: 'bank' },
  { id: 'mx_bbva', name: 'BBVA México', countryCode: 'MX', kind: 'bank' },
  { id: 'mx_banorte', name: 'Banorte', countryCode: 'MX', kind: 'bank' },
  { id: 'co_bancolombia', name: 'Bancolombia', countryCode: 'CO', kind: 'bank' },
]

export type FeedRegion = 'Africa' | 'Europe' | 'North America' | 'Latin America' | 'Middle East' | 'Asia' | 'Oceania'

export const FEED_REGIONS: FeedRegion[] = ['Africa', 'Europe', 'North America', 'Latin America', 'Middle East', 'Asia', 'Oceania']

export const FEED_COUNTRIES: { code: string; name: string; currency: string; region: FeedRegion }[] = [
  // Africa
  { code: 'GH', name: 'Ghana', currency: 'GHS', region: 'Africa' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', region: 'Africa' },
  { code: 'KE', name: 'Kenya', currency: 'KES', region: 'Africa' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', region: 'Africa' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', region: 'Africa' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', region: 'Africa' },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', region: 'Africa' },
  { code: 'CI', name: 'Côte d’Ivoire', currency: 'XOF', region: 'Africa' },
  { code: 'SN', name: 'Senegal', currency: 'XOF', region: 'Africa' },
  { code: 'EG', name: 'Egypt', currency: 'EGP', region: 'Africa' },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW', region: 'Africa' },
  { code: 'CM', name: 'Cameroon', currency: 'XAF', region: 'Africa' },
  // Europe
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', region: 'Europe' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', region: 'Europe' },
  { code: 'DE', name: 'Germany', currency: 'EUR', region: 'Europe' },
  { code: 'FR', name: 'France', currency: 'EUR', region: 'Europe' },
  { code: 'ES', name: 'Spain', currency: 'EUR', region: 'Europe' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', region: 'Europe' },
  { code: 'IT', name: 'Italy', currency: 'EUR', region: 'Europe' },
  { code: 'SE', name: 'Sweden', currency: 'SEK', region: 'Europe' },
  { code: 'PL', name: 'Poland', currency: 'PLN', region: 'Europe' },
  { code: 'TR', name: 'Türkiye', currency: 'TRY', region: 'Europe' },
  // North America
  { code: 'US', name: 'United States', currency: 'USD', region: 'North America' },
  { code: 'CA', name: 'Canada', currency: 'CAD', region: 'North America' },
  // Latin America
  { code: 'BR', name: 'Brazil', currency: 'BRL', region: 'Latin America' },
  { code: 'MX', name: 'Mexico', currency: 'MXN', region: 'Latin America' },
  { code: 'CO', name: 'Colombia', currency: 'COP', region: 'Latin America' },
  // Middle East
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', region: 'Middle East' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', region: 'Middle East' },
  // Asia
  { code: 'IN', name: 'India', currency: 'INR', region: 'Asia' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', region: 'Asia' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', region: 'Asia' },
  { code: 'ID', name: 'Indonesia', currency: 'IDR', region: 'Asia' },
  { code: 'PH', name: 'Philippines', currency: 'PHP', region: 'Asia' },
  { code: 'JP', name: 'Japan', currency: 'JPY', region: 'Asia' },
  { code: 'CN', name: 'China', currency: 'CNY', region: 'Asia' },
  // Oceania
  { code: 'AU', name: 'Australia', currency: 'AUD', region: 'Oceania' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', region: 'Oceania' },
]

/** Region a country sits in (used to group the connect picker). */
export const feedRegionOf = (code: string): FeedRegion =>
  FEED_COUNTRIES.find((c) => c.code === code)?.region || 'Africa'

export const FEEDS_KEY = 'fitpro_bank_feeds_v1'

export const loadFeedState = (): FeedState => {
  try {
    const raw = localStorage.getItem(FEEDS_KEY)
    const parsed = raw ? (JSON.parse(raw) as FeedState) : null
    if (parsed && Array.isArray(parsed.feeds) && Array.isArray(parsed.txns)) {
      return { ...parsed, rules: Array.isArray(parsed.rules) ? parsed.rules : [] }
    }
  } catch { /* fall through */ }
  return { feeds: [], txns: [], rules: [] }
}

export const saveFeedState = (state: FeedState) => {
  try { localStorage.setItem(FEEDS_KEY, JSON.stringify(state)) } catch { /* storage full */ }
}

/** Deterministic pseudo-random generator so a feed always syncs the same way. */
const rng = (seed: string) => {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const IN_NARRATIONS = [
  'POS settlement', 'Transfer from customer', 'Mobile money cash-in', 'Standing order credit',
  'Cheque lodgement', 'Card terminal payout', 'Corporate transfer', 'Interest credit',
]
const OUT_NARRATIONS = [
  'POS purchase', 'Transfer to supplier', 'Mobile money cash-out', 'Standing order debit',
  'Bank charges', 'ATM withdrawal', 'Utility bill payment', 'Salary transfer',
]

/**
 * Statement lines the provider would return for a feed since its last sync.
 * Returns newest-last, with a running balance.
 */
export function fetchFeedTransactions(feed: BankFeed, from: string, to: string, openingBalance: number): FeedTxn[] {
  const rand = rng(`${feed.id}:${from}:${to}`)
  const start = new Date(`${from}T00:00:00Z`).getTime()
  const end = new Date(`${to}T00:00:00Z`).getTime()
  const days = Math.max(1, Math.round((end - start) / 86400000))
  const count = Math.min(24, Math.max(4, Math.round(days / 2 + rand() * 6)))
  const out: FeedTxn[] = []
  let balance = openingBalance
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor((i / count) * days)
    const date = new Date(start + dayOffset * 86400000).toISOString().slice(0, 10)
    const moneyIn = rand() > 0.42
    const base = Math.round((rand() * 1800 + 40) * 100) / 100
    const amount = moneyIn ? base : -base
    balance = Math.round((balance + amount) * 100) / 100
    const words = moneyIn ? IN_NARRATIONS : OUT_NARRATIONS
    const narration = words[Math.floor(rand() * words.length)]
    out.push({
      id: `ft_${feed.id}_${date}_${i}`,
      feedId: feed.id,
      date,
      description: `${narration}${moneyIn ? ' — ' : ' — '}${feed.institutionName}`,
      reference: `${feed.providerId.toUpperCase()}${Math.floor(rand() * 900000 + 100000)}`,
      amount,
      balance,
      status: 'new',
    })
  }
  return out
}

/** Country name for a code, falling back to the code itself. */
export const feedCountryName = (code: string) =>
  FEED_COUNTRIES.find((c) => c.code === code)?.name || code
