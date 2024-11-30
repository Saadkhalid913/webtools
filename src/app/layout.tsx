import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "PDF Tools Suite",
	description: "A comprehensive suite of PDF tools for power users",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="h-full">
			<body className={`${inter.className} h-full bg-gray-50`}>
				{children}
				<Toaster />
			</body>
		</html>
	);
}
