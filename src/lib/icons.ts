const SERVICE_ICONS: Array<{ pattern: RegExp; url: string }> = [
  { pattern: /github/i,      url: 'https://github.githubassets.com/favicons/favicon.svg' },
  { pattern: /gitlab/i,      url: 'https://gitlab.com/favicon.ico' },
  { pattern: /\baws\b|amazon/i, url: 'https://a0.awsstatic.com/libra-css/images/site/fav/favicon.ico' },
  { pattern: /google/i,      url: 'https://www.google.com/favicon.ico' },
  { pattern: /stripe/i,      url: 'https://stripe.com/favicon.ico' },
  { pattern: /vercel/i,      url: 'https://assets.vercel.com/image/upload/front/favicon/vercel/favicon.ico' },
  { pattern: /cloudflare/i,  url: 'https://www.cloudflare.com/favicon.ico' },
  { pattern: /digitalocean/i,url: 'https://www.digitalocean.com/favicon.ico' },
  { pattern: /heroku/i,      url: 'https://www.herokucdn.com/favicons/favicon.ico' },
  { pattern: /netlify/i,     url: 'https://www.netlify.com/favicon.ico' },
  { pattern: /openai|chatgpt/i, url: 'https://openai.com/favicon.ico' },
  { pattern: /anthropic/i,   url: 'https://anthropic.com/favicon.ico' },
  { pattern: /sendgrid/i,    url: 'https://sendgrid.com/favicon.ico' },
  { pattern: /twilio/i,      url: 'https://www.twilio.com/favicon.ico' },
  { pattern: /firebase/i,    url: 'https://firebase.google.com/favicon.ico' },
  { pattern: /supabase/i,    url: 'https://supabase.com/favicon.ico' },
  { pattern: /mongo|mongodb/i, url: 'https://www.mongodb.com/favicon.ico' },
  { pattern: /postgres|postgresql/i, url: 'https://www.postgresql.org/favicon.ico' },
  { pattern: /notion/i,      url: 'https://www.notion.so/images/favicon.ico' },
  { pattern: /slack/i,       url: 'https://slack.com/favicon.ico' },
  { pattern: /discord/i,     url: 'https://discord.com/favicon.ico' },
  { pattern: /linear/i,      url: 'https://linear.app/favicon.ico' },
  { pattern: /datadog/i,     url: 'https://www.datadoghq.com/favicon.ico' },
  { pattern: /sentry/i,      url: 'https://sentry.io/favicon.ico' },
  { pattern: /shopify/i,     url: 'https://cdn.shopify.com/favicon.ico' },
  { pattern: /paypal/i,      url: 'https://www.paypal.com/favicon.ico' },
  { pattern: /apple/i,       url: 'https://www.apple.com/favicon.ico' },
  { pattern: /microsoft/i,   url: 'https://www.microsoft.com/favicon.ico' },
  { pattern: /azure/i,       url: 'https://azurecomcdn.azureedge.net/cvt-eb19ee4f4a4a8f12f5f98b68c064f8a15a46f38f/images/shared/fav/favicon.ico' },
]

const TYPE_EMOJI: Record<string, string> = {
  login: '🔑', api_key: '⚡', note: '📝', ssh_key: '🔒', card: '💳',
}

export function resolveIconUrl(name: string): string | null {
  for (const { pattern, url } of SERVICE_ICONS) {
    if (pattern.test(name)) return url
  }
  return null
}

export function typeEmoji(entryType: string): string {
  return TYPE_EMOJI[entryType] ?? '🔐'
}
