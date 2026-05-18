/** @type {import('next').NextConfig} */
const nextConfig = {
  // FastAPI 서버로 API 요청을 프록시 → CORS 문제 없이 호출 가능
  async rewrites() {
    const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8000'
    const wikiApiBaseUrl = process.env.WIKI_API_BASE_URL ?? process.env.API_BASE_URL ?? 'http://localhost:8010'

    return [
      {
        source: '/api/v1/wiki-export/:path*',
        destination: `${wikiApiBaseUrl}/api/v1/wiki-export/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${apiBaseUrl}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
