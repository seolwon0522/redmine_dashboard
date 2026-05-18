export function buildAbsoluteRedmineUrl(value: string, baseUrl: string): string {
  if (!value) return value

  try {
    return new URL(value, `${baseUrl}/`).toString()
  } catch {
    return value
  }
}

export function buildRedmineAssetProxyUrl(value: string, baseUrl: string): string {
  const absoluteUrl = buildAbsoluteRedmineUrl(value, baseUrl)
  return `/api/v1/dashboard/assets?url=${encodeURIComponent(absoluteUrl)}`
}

export function isRedmineAssetPath(value: string, baseUrl: string): boolean {
  if (!value) return false
  if (value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:')) {
    return false
  }  

  const absoluteUrl = buildAbsoluteRedmineUrl(value, baseUrl)

  try {
    const target = new URL(absoluteUrl)
    const base = new URL(baseUrl)
    if (target.origin !== base.origin) return false

    return (
      /\/(attachments|uploads)\//i.test(target.pathname) ||
      /\/attachments\/download\//i.test(target.pathname)
    )
  } catch {
    return false
  }
}