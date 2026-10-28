/** @type {import('next').NextConfig} */
// Yeh Next.js ka project-wide setting card hai; yahan tay hota hai ki website kaise taiyaar hogi.
const nextConfig = {
  transpilePackages: ['@vishanti/shared'], // Shared rules ke folder ko bhi Next.js se browser ke laayak banwate hain.
  reactStrictMode: true, // Development mein React ki kuch galtiyan jaldi pakadne ke liye sakht jaanch chalu rakhte hain.
};

export default nextConfig;
