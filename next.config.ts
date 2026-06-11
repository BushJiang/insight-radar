import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🔰 全站安全响应头，服务器下发指令，浏览器在客户端强制落实保护策略
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 🔰 禁止页面被 iframe 嵌入，防止点击劫持：恶意页面用透明 iframe 覆盖本站诱导用户点击
          { key: 'X-Frame-Options', value: 'DENY' },
          // 🔰 限制页面只能加载白名单来源的资源，防止 XSS 攻击：注入的恶意脚本因来源不符被浏览器拦截
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none';" },
          // 🔰 强制浏览器记住本站只用 HTTPS，防止 HTTP 明文传输被攻击者拦截篡改
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/collect', destination: '/', permanent: true },
    ]
  },
};

export default nextConfig;
