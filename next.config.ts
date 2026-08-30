import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	reactCompiler: true,
	// Type checking is handled by `pnpm lint` (oxlint typeAware).
	typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
