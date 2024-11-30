/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	webpack: (config) => {
		config.resolve.alias.canvas = false;

		// Handle worker files
		config.module.rules.push({
			test: /pdf\.worker\.(min\.)?js/,
			type: "asset/resource",
			generator: {
				filename: "static/worker/[hash][ext][query]",
			},
		});

		return config;
	},
};

module.exports = nextConfig;
