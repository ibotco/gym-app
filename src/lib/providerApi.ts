/**
 * Live connections for every bank-feed provider.
 *
 * Each provider is described declaratively — real hosts, the credential fields
 * it needs, how it authenticates, which endpoint lists accounts/transactions
 * and where the useful values sit in the JSON. One generic client then drives
 * them all, so adding a provider is a data change rather than new code.
 *
 * Calls go through same-origin proxy paths (see `vite.config.ts`): the browser
 * cannot reach these APIs directly (no CORS) and the secrets must not travel in
 * client code. In production point `baseUrl` at your own gateway.
 */

export type AuthStyle =
  | { kind: 'bearer'; field: string }                                   // Authorization: Bearer <field>
  | { kind: 'basic'; user: string; pass: string }                       // Authorization: Basic base64(user:pass)
  | { kind: 'headers'; map: Record<string, string> }                    // raw header → credential field
  | { kind: 'token'; path: string; method?: 'POST' | 'GET'; body?: Record<string, string>; headers?: Record<string, string>; basic?: { user: string; pass: string }; tokenPath: string }

export interface ProviderField {
  key: string
  label: string
  placeholder?: string
  secret?: boolean
  optional?: boolean
}

export interface ProviderApiSpec {
  id: string
  label: string
  docs: string
  /** Same-origin proxy prefixes added in vite.config.ts. */
  proxy: { sandbox: string; live: string }
  /** Real upstream hosts the proxy forwards to (shown in the UI). */
  hosts: { sandbox: string; live: string }
  fields: ProviderField[]
  auth: AuthStyle
  /** Endpoint that proves the credentials work (and usually lists accounts). */
  probe: { path: string; method?: 'GET' | 'POST'; body?: Record<string, string>; listPath?: string; idField?: string; nameField?: string }
  /** Transactions endpoint. `{account}`, `{from}`, `{to}` are substituted. */
  txns?: {
    path: string
    method?: 'GET' | 'POST'
    body?: Record<string, string>
    listPath: string
    date: string
    amount: string
    /** When set, this field holds the direction (debit/credit) for unsigned amounts. */
    direction?: { field: string; debitValues: string[] }
    description: string
    reference?: string
  }
  notes?: string
}

/** Pull a nested value with a dotted path ("data.transactions.0.amount"). */
export const dig = (obj: unknown, path?: string): unknown => {
  if (!path) return undefined
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined
    if (Array.isArray(acc) && /^\d+$/.test(key)) return acc[Number(key)]
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

export const PROVIDER_APIS: ProviderApiSpec[] = [
  {
    id: 'mono', label: 'Mono', docs: 'https://docs.mono.co',
    proxy: { sandbox: '/api-mono', live: '/api-mono' },
    hosts: { sandbox: 'https://api.withmono.com', live: 'https://api.withmono.com' },
    fields: [{ key: 'secretKey', label: 'Mono secret key', placeholder: 'live_sk_… / test_sk_…', secret: true }, { key: 'accountId', label: 'Account id', placeholder: 'Mono account id', optional: true }],
    auth: { kind: 'headers', map: { 'mono-sec-key': 'secretKey' } },
    probe: { path: '/v2/accounts', listPath: 'data', idField: 'id', nameField: 'institution.name' },
    txns: {
      path: '/v2/accounts/{account}/transactions?start={from}&end={to}&paginate=false',
      listPath: 'data', date: 'date', amount: 'amount', description: 'narration', reference: 'id',
      direction: { field: 'type', debitValues: ['debit'] },
    },
    notes: 'Amounts are in kobo/pesewas — divided by 100 on import.',
  },
  {
    id: 'okra', label: 'Okra', docs: 'https://docs.okra.ng',
    proxy: { sandbox: '/api-okra', live: '/api-okra' },
    hosts: { sandbox: 'https://api.okra.ng', live: 'https://api.okra.ng' },
    fields: [{ key: 'token', label: 'Okra secret token', secret: true }, { key: 'customerId', label: 'Customer id', optional: true }],
    auth: { kind: 'bearer', field: 'token' },
    probe: { path: '/v2/accounts/getByCustomer', method: 'POST', body: { customer: '{customerId}' }, listPath: 'data.accounts', idField: 'id', nameField: 'name' },
    txns: {
      path: '/v2/transactions/getByCustomerDate', method: 'POST',
      body: { customer: '{account}', from: '{from}', to: '{to}' },
      listPath: 'data.trans', date: 'trans_date', amount: 'amount', description: 'narration', reference: '_id',
      direction: { field: 'debit', debitValues: ['true', '1'] },
    },
  },
  {
    id: 'plaid', label: 'Plaid', docs: 'https://plaid.com/docs',
    proxy: { sandbox: '/api-plaid-sandbox', live: '/api-plaid' },
    hosts: { sandbox: 'https://sandbox.plaid.com', live: 'https://production.plaid.com' },
    fields: [
      { key: 'clientId', label: 'client_id' },
      { key: 'secret', label: 'secret', secret: true },
      { key: 'accessToken', label: 'access_token (item)', secret: true },
    ],
    auth: { kind: 'headers', map: { 'PLAID-CLIENT-ID': 'clientId', 'PLAID-SECRET': 'secret' } },
    probe: { path: '/accounts/get', method: 'POST', body: { access_token: '{accessToken}' }, listPath: 'accounts', idField: 'account_id', nameField: 'name' },
    txns: {
      path: '/transactions/get', method: 'POST',
      body: { access_token: '{accessToken}', start_date: '{from}', end_date: '{to}' },
      listPath: 'transactions', date: 'date', amount: 'amount', description: 'name', reference: 'transaction_id',
    },
    notes: 'Plaid reports money out as a positive amount — the sign is flipped on import.',
  },
  {
    id: 'truelayer', label: 'TrueLayer', docs: 'https://docs.truelayer.com',
    proxy: { sandbox: '/api-truelayer-sandbox', live: '/api-truelayer' },
    hosts: { sandbox: 'https://api.truelayer-sandbox.com', live: 'https://api.truelayer.com' },
    fields: [{ key: 'accessToken', label: 'Access token', secret: true }, { key: 'accountId', label: 'Account id', optional: true }],
    auth: { kind: 'bearer', field: 'accessToken' },
    probe: { path: '/data/v1/accounts', listPath: 'results', idField: 'account_id', nameField: 'display_name' },
    txns: {
      path: '/data/v1/accounts/{account}/transactions?from={from}&to={to}',
      listPath: 'results', date: 'timestamp', amount: 'amount', description: 'description', reference: 'transaction_id',
    },
  },
  {
    id: 'tink', label: 'Tink (Visa)', docs: 'https://docs.tink.com',
    proxy: { sandbox: '/api-tink', live: '/api-tink' },
    hosts: { sandbox: 'https://api.tink.com', live: 'https://api.tink.com' },
    fields: [{ key: 'accessToken', label: 'Access token', secret: true }],
    auth: { kind: 'bearer', field: 'accessToken' },
    probe: { path: '/data/v2/accounts', listPath: 'accounts', idField: 'id', nameField: 'name' },
    txns: {
      path: '/data/v2/transactions?accountIdIn={account}&bookedDateGte={from}&bookedDateLte={to}',
      listPath: 'transactions', date: 'dates.booked', amount: 'amount.value.unscaledValue', description: 'descriptions.display', reference: 'id',
    },
    notes: 'Tink returns scaled integers; values are normalised with the scale field.',
  },
  {
    id: 'gocardless', label: 'GoCardless Bank Account Data', docs: 'https://developer.gocardless.com/bank-account-data',
    proxy: { sandbox: '/api-gocardless', live: '/api-gocardless' },
    hosts: { sandbox: 'https://bankaccountdata.gocardless.com', live: 'https://bankaccountdata.gocardless.com' },
    fields: [
      { key: 'secretId', label: 'Secret id' },
      { key: 'secretKey', label: 'Secret key', secret: true },
      { key: 'accountId', label: 'Account id', optional: true },
    ],
    auth: { kind: 'token', path: '/api/v2/token/new/', method: 'POST', body: { secret_id: '{secretId}', secret_key: '{secretKey}' }, tokenPath: 'access' },
    probe: { path: '/api/v2/accounts/{accountId}/', idField: 'id', nameField: 'iban' },
    txns: {
      path: '/api/v2/accounts/{account}/transactions/?date_from={from}&date_to={to}',
      listPath: 'transactions.booked', date: 'bookingDate', amount: 'transactionAmount.amount',
      description: 'remittanceInformationUnstructured', reference: 'transactionId',
    },
  },
  {
    id: 'saltedge', label: 'Salt Edge', docs: 'https://docs.saltedge.com',
    proxy: { sandbox: '/api-saltedge', live: '/api-saltedge' },
    hosts: { sandbox: 'https://www.saltedge.com', live: 'https://www.saltedge.com' },
    fields: [
      { key: 'appId', label: 'App-id' },
      { key: 'secret', label: 'Secret', secret: true },
      { key: 'connectionId', label: 'Connection id', optional: true },
    ],
    auth: { kind: 'headers', map: { 'App-id': 'appId', Secret: 'secret' } },
    probe: { path: '/api/v5/accounts?connection_id={connectionId}', listPath: 'data', idField: 'id', nameField: 'name' },
    txns: {
      path: '/api/v5/transactions?connection_id={connectionId}&account_id={account}&from_date={from}&to_date={to}',
      listPath: 'data', date: 'made_on', amount: 'amount', description: 'description', reference: 'id',
    },
  },
  {
    id: 'finicity', label: 'Finicity (Mastercard)', docs: 'https://developer.mastercard.com/open-banking-us',
    proxy: { sandbox: '/api-finicity', live: '/api-finicity' },
    hosts: { sandbox: 'https://api.finicity.com', live: 'https://api.finicity.com' },
    fields: [
      { key: 'appKey', label: 'Finicity-App-Key' },
      { key: 'appToken', label: 'Finicity-App-Token', secret: true },
      { key: 'customerId', label: 'Customer id' },
      { key: 'accountId', label: 'Account id', optional: true },
    ],
    auth: { kind: 'headers', map: { 'Finicity-App-Key': 'appKey', 'Finicity-App-Token': 'appToken', Accept: 'json' } },
    probe: { path: '/aggregation/v1/customers/{customerId}/accounts', listPath: 'accounts', idField: 'id', nameField: 'name' },
    txns: {
      path: '/aggregation/v3/customers/{customerId}/accounts/{account}/transactions?fromDate={fromEpoch}&toDate={toEpoch}',
      listPath: 'transactions', date: 'postedDate', amount: 'amount', description: 'description', reference: 'id',
    },
  },
  {
    id: 'belvo', label: 'Belvo', docs: 'https://developers.belvo.com',
    proxy: { sandbox: '/api-belvo-sandbox', live: '/api-belvo' },
    hosts: { sandbox: 'https://sandbox.belvo.com', live: 'https://api.belvo.com' },
    fields: [
      { key: 'secretId', label: 'Secret id' },
      { key: 'secretPassword', label: 'Secret password', secret: true },
      { key: 'linkId', label: 'Link id', optional: true },
    ],
    auth: { kind: 'basic', user: 'secretId', pass: 'secretPassword' },
    probe: { path: '/api/accounts/?link={linkId}', listPath: 'results', idField: 'id', nameField: 'name' },
    txns: {
      path: '/api/transactions/?link={linkId}&account={account}&value_date__gte={from}&value_date__lte={to}',
      listPath: 'results', date: 'value_date', amount: 'amount', description: 'description', reference: 'id',
      direction: { field: 'type', debitValues: ['OUTFLOW'] },
    },
  },
  {
    id: 'basiq', label: 'Basiq', docs: 'https://api.basiq.io/reference',
    proxy: { sandbox: '/api-basiq', live: '/api-basiq' },
    hosts: { sandbox: 'https://au-api.basiq.io', live: 'https://au-api.basiq.io' },
    fields: [{ key: 'apiKey', label: 'API key', secret: true }, { key: 'userId', label: 'User id' }],
    auth: { kind: 'token', path: '/token', method: 'POST', headers: { 'basiq-version': '3.0', Authorization: 'Basic {apiKey}' }, body: { scope: 'SERVER_ACCESS' }, tokenPath: 'access_token' },
    probe: { path: '/users/{userId}/accounts', listPath: 'data', idField: 'id', nameField: 'accountNo' },
    txns: {
      path: '/users/{userId}/transactions?filter=transaction.postDate.bt({from},{to})',
      listPath: 'data', date: 'postDate', amount: 'amount', description: 'description', reference: 'id',
    },
  },
  {
    id: 'brankas', label: 'Brankas', docs: 'https://docs.brankas.com',
    proxy: { sandbox: '/api-brankas', live: '/api-brankas' },
    hosts: { sandbox: 'https://api.sandbox.brankas.com', live: 'https://api.brankas.com' },
    fields: [{ key: 'apiKey', label: 'API key', secret: true }, { key: 'accountId', label: 'Account id', optional: true }],
    auth: { kind: 'headers', map: { 'x-api-key': 'apiKey' } },
    probe: { path: '/v3/accounts', listPath: 'accounts', idField: 'account_id', nameField: 'account_name' },
    txns: {
      path: '/v3/accounts/{account}/transactions?start_date={from}&end_date={to}',
      listPath: 'transactions', date: 'date', amount: 'amount', description: 'description', reference: 'transaction_id',
    },
  },
  {
    id: 'flutterwave', label: 'Flutterwave', docs: 'https://developer.flutterwave.com/docs',
    proxy: { sandbox: '/api-flutterwave', live: '/api-flutterwave' },
    hosts: { sandbox: 'https://api.flutterwave.com', live: 'https://api.flutterwave.com' },
    fields: [{ key: 'secretKey', label: 'Secret key (FLWSECK…)', secret: true }],
    auth: { kind: 'bearer', field: 'secretKey' },
    probe: { path: '/v3/balances', listPath: 'data', idField: 'currency', nameField: 'currency' },
    txns: {
      path: '/v3/transactions?from={from}&to={to}',
      listPath: 'data', date: 'created_at', amount: 'amount', description: 'narration', reference: 'tx_ref',
    },
  },
  {
    id: 'paystack', label: 'Paystack', docs: 'https://paystack.com/docs/api',
    proxy: { sandbox: '/api-paystack', live: '/api-paystack' },
    hosts: { sandbox: 'https://api.paystack.co', live: 'https://api.paystack.co' },
    fields: [{ key: 'secretKey', label: 'Secret key (sk_…)', secret: true }],
    auth: { kind: 'bearer', field: 'secretKey' },
    probe: { path: '/balance', listPath: 'data', idField: 'currency', nameField: 'currency' },
    txns: {
      path: '/transaction?from={from}&to={to}&perPage=100',
      listPath: 'data', date: 'paid_at', amount: 'amount', description: 'customer.email', reference: 'reference',
    },
    notes: 'Amounts are in the minor unit (kobo/pesewas) — divided by 100 on import.',
  },
  {
    id: 'wise', label: 'Wise Business', docs: 'https://docs.wise.com',
    proxy: { sandbox: '/api-wise-sandbox', live: '/api-wise' },
    hosts: { sandbox: 'https://api.sandbox.transferwise.tech', live: 'https://api.wise.com' },
    fields: [
      { key: 'token', label: 'API token', secret: true },
      { key: 'profileId', label: 'Profile id' },
      { key: 'balanceId', label: 'Balance id', optional: true },
      { key: 'currency', label: 'Currency', placeholder: 'GHS / USD / EUR', optional: true },
    ],
    auth: { kind: 'bearer', field: 'token' },
    probe: { path: '/v2/profiles', listPath: '', idField: 'id', nameField: 'type' },
    txns: {
      path: '/v1/profiles/{profileId}/balance-statements/{account}/statement.json?currency={currency}&intervalStart={fromIso}&intervalEnd={toIso}&type=COMPACT',
      listPath: 'transactions', date: 'date', amount: 'amount.value', description: 'details.description', reference: 'referenceNumber',
    },
  },
  {
    id: 'revolut', label: 'Revolut Business', docs: 'https://developer.revolut.com/docs/business',
    proxy: { sandbox: '/api-revolut-sandbox', live: '/api-revolut' },
    hosts: { sandbox: 'https://sandbox-b2b.revolut.com', live: 'https://b2b.revolut.com' },
    fields: [{ key: 'accessToken', label: 'Access token', secret: true }, { key: 'accountId', label: 'Account id', optional: true }],
    auth: { kind: 'bearer', field: 'accessToken' },
    probe: { path: '/api/1.0/accounts', listPath: '', idField: 'id', nameField: 'name' },
    txns: {
      path: '/api/1.0/transactions?account={account}&from={from}&to={to}&count=100',
      listPath: '', date: 'created_at', amount: 'legs.0.amount', description: 'reference', reference: 'id',
    },
  },
  {
    id: 'pngme', label: 'Pngme', docs: 'https://developers.api.pngme.com',
    proxy: { sandbox: '/api-pngme', live: '/api-pngme' },
    hosts: { sandbox: 'https://api.pngme.com', live: 'https://api.pngme.com' },
    fields: [{ key: 'token', label: 'API token', secret: true }, { key: 'userUuid', label: 'User uuid', optional: true }],
    auth: { kind: 'bearer', field: 'token' },
    probe: { path: '/beta/users', listPath: '', idField: 'uuid', nameField: 'primary_phone_imei' },
    txns: {
      path: '/beta/users/{account}/transactions?page=1',
      listPath: '', date: 'ts', amount: 'amount', description: 'description', reference: 'uuid',
      direction: { field: 'impact', debitValues: ['DEBIT'] },
    },
  },
  {
    id: 'onepipe', label: 'OnePipe', docs: 'https://docs.onepipe.io',
    proxy: { sandbox: '/api-onepipe', live: '/api-onepipe' },
    hosts: { sandbox: 'https://api.onepipe.io', live: 'https://api.onepipe.io' },
    fields: [{ key: 'apiKey', label: 'API key', secret: true }, { key: 'accountId', label: 'Account number', optional: true }],
    auth: { kind: 'bearer', field: 'apiKey' },
    probe: { path: '/v2/transact/status', method: 'POST', body: {}, listPath: '' },
    notes: 'OnePipe is transaction-initiation first; statement pulls depend on your partner bank contract.',
  },
  {
    id: 'stitch', label: 'Stitch', docs: 'https://stitch.money/docs',
    proxy: { sandbox: '/api-stitch', live: '/api-stitch' },
    hosts: { sandbox: 'https://api.stitch.money', live: 'https://api.stitch.money' },
    fields: [{ key: 'accessToken', label: 'Access token', secret: true }],
    auth: { kind: 'bearer', field: 'accessToken' },
    probe: { path: '/graphql', method: 'POST', body: { query: '{ user { bankAccounts { id name } } }' }, listPath: 'data.user.bankAccounts', idField: 'id', nameField: 'name' },
    notes: 'Stitch is GraphQL — the probe runs a bankAccounts query; transactions need a tailored query.',
  },
]

export const specFor = (providerId: string) => PROVIDER_APIS.find((p) => p.id === providerId)

export interface ProviderCreds {
  providerId: string
  env: 'sandbox' | 'live'
  /** Proxy path or your own gateway. */
  baseUrl: string
  values: Record<string, string>
  verifiedAt?: string
}

export const PROVIDER_CREDS_KEY = 'fitpro_provider_creds_v1'

export const loadProviderCreds = (): Record<string, ProviderCreds> => {
  try {
    const raw = localStorage.getItem(PROVIDER_CREDS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ProviderCreds>) : {}
  } catch { return {} }
}
export const saveProviderCreds = (all: Record<string, ProviderCreds>) => {
  try { localStorage.setItem(PROVIDER_CREDS_KEY, JSON.stringify(all)) } catch { /* storage full */ }
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(values[key] ?? ''))

const describeError = (status: number, body: string, url: string) => {
  if (status === 0) return `Network error calling ${url} — check the base URL / proxy.`
  if (status === 401 || status === 403) return `Rejected by the provider (${status}): ${body.slice(0, 200) || 'check the credentials and environment.'}`
  if (status === 404) return `Not found (404) at ${url} — check the account id and endpoint.`
  return `Provider error ${status}: ${body.slice(0, 250) || 'no response body'}`
}

/** Authorization/other headers for a provider, fetching a token when needed. */
async function authHeaders(spec: ProviderApiSpec, creds: ProviderCreds): Promise<Record<string, string>> {
  const v = creds.values
  if (spec.auth.kind === 'bearer') return { Authorization: `Bearer ${v[spec.auth.field] || ''}` }
  if (spec.auth.kind === 'basic') return { Authorization: `Basic ${btoa(`${v[spec.auth.user] || ''}:${v[spec.auth.pass] || ''}`)}` }
  if (spec.auth.kind === 'headers') {
    const out: Record<string, string> = {}
    for (const [header, field] of Object.entries(spec.auth.map)) out[header] = v[field] ?? field
    return out
  }
  // token endpoint
  const url = `${creds.baseUrl.replace(/\/+$/, '')}${fill(spec.auth.path, v)}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  for (const [h, tpl] of Object.entries(spec.auth.headers || {})) headers[h] = fill(tpl, v)
  const res = await fetch(url, {
    method: spec.auth.method || 'POST',
    headers,
    body: spec.auth.body ? JSON.stringify(Object.fromEntries(Object.entries(spec.auth.body).map(([k, t]) => [k, fill(t, v)]))) : undefined,
  }).catch((err) => { throw new Error(describeError(0, String(err), url)) })
  const body = await res.text()
  if (!res.ok) throw new Error(describeError(res.status, body, url))
  const token = dig(JSON.parse(body || '{}'), spec.auth.tokenPath)
  if (!token) throw new Error(`The token endpoint returned no ${spec.auth.tokenPath}.`)
  return { Authorization: `Bearer ${String(token)}` }
}

/** Call the provider's probe endpoint — proves the credentials and lists accounts. */
export async function testProvider(creds: ProviderCreds): Promise<{ summary: string; accounts: { id: string; name: string }[] }> {
  const spec = specFor(creds.providerId)
  if (!spec) throw new Error('Unknown provider.')
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json', ...(await authHeaders(spec, creds)) }
  const url = `${creds.baseUrl.replace(/\/+$/, '')}${fill(spec.probe.path, creds.values)}`
  const res = await fetch(url, {
    method: spec.probe.method || 'GET',
    headers,
    body: spec.probe.body ? JSON.stringify(Object.fromEntries(Object.entries(spec.probe.body).map(([k, t]) => [k, fill(t, creds.values)]))) : undefined,
  }).catch((err) => { throw new Error(describeError(0, String(err), url)) })
  const body = await res.text()
  if (!res.ok) throw new Error(describeError(res.status, body, url))
  let json: unknown = {}
  try { json = JSON.parse(body || '{}') } catch { throw new Error('The provider returned a non-JSON response — check the base URL / proxy.') }
  const listRaw = spec.probe.listPath ? dig(json, spec.probe.listPath) : json
  const list = Array.isArray(listRaw) ? listRaw : listRaw ? [listRaw] : []
  const accounts = list.map((row) => ({
    id: String(dig(row, spec.probe.idField) ?? ''),
    name: String(dig(row, spec.probe.nameField) ?? dig(row, spec.probe.idField) ?? 'Account'),
  })).filter((a) => a.id)
  return { summary: `Connected to ${spec.label}. ${accounts.length} account(s) visible.`, accounts }
}

export interface ProviderTxn { date: string; description: string; reference: string; amount: number }

/** Statement lines from the provider for one account and date range. */
export async function fetchProviderTransactions(
  creds: ProviderCreds,
  account: string,
  from: string,
  to: string,
): Promise<ProviderTxn[]> {
  const spec = specFor(creds.providerId)
  if (!spec?.txns) throw new Error(`${spec?.label || 'This provider'} does not expose a statement endpoint in this build — use Upload statement.`)
  const vals: Record<string, string> = {
    ...creds.values,
    account,
    from,
    to,
    fromIso: `${from}T00:00:00.000Z`,
    toIso: `${to}T23:59:59.999Z`,
    fromEpoch: String(Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000)),
    toEpoch: String(Math.floor(new Date(`${to}T23:59:59Z`).getTime() / 1000)),
  }
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json', ...(await authHeaders(spec, creds)) }
  const url = `${creds.baseUrl.replace(/\/+$/, '')}${fill(spec.txns.path, vals)}`
  const res = await fetch(url, {
    method: spec.txns.method || 'GET',
    headers,
    body: spec.txns.body ? JSON.stringify(Object.fromEntries(Object.entries(spec.txns.body).map(([k, t]) => [k, fill(t, vals)]))) : undefined,
  }).catch((err) => { throw new Error(describeError(0, String(err), url)) })
  const body = await res.text()
  if (!res.ok) throw new Error(describeError(res.status, body, url))
  const json = JSON.parse(body || '{}')
  const listRaw = spec.txns.listPath ? dig(json, spec.txns.listPath) : json
  const list = Array.isArray(listRaw) ? listRaw : []
  const minorUnit = spec.id === 'paystack' || spec.id === 'mono'
  return list.map((row) => {
    let amount = Number(dig(row, spec.txns!.amount) ?? 0)
    if (minorUnit) amount = amount / 100
    if (spec.txns!.direction) {
      const raw = String(dig(row, spec.txns!.direction.field) ?? '').toLowerCase()
      const isDebit = spec.txns!.direction.debitValues.some((d) => d.toLowerCase() === raw)
      amount = isDebit ? -Math.abs(amount) : Math.abs(amount)
    }
    if (spec.id === 'plaid') amount = -amount // Plaid: positive = money out
    const rawDate = String(dig(row, spec.txns!.date) ?? '')
    return {
      date: rawDate ? rawDate.slice(0, 10) : '',
      description: String(dig(row, spec.txns!.description) ?? 'Imported transaction'),
      reference: String(dig(row, spec.txns!.reference || '') ?? ''),
      amount,
    }
  }).filter((t) => t.date && Math.abs(t.amount) >= 0.005)
}
