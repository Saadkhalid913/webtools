"use client";

import React, { useState, useEffect } from "react";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { searchPlugin } from "@react-pdf-viewer/search";
import { thumbnailPlugin } from "@react-pdf-viewer/thumbnail";
import { zoomPlugin } from "@react-pdf-viewer/zoom";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/thumbnail/lib/styles/index.css";

interface PDFViewerProps {
	file: File | null;
	onPageChange?: (page: number) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ file, onPageChange }) => {
	const [fileUrl, setFileUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (file) {
			setLoading(true);
			const url = URL.createObjectURL(file);
			setFileUrl(url);
			return () => {
				URL.revokeObjectURL(url);
			};
		} else {
			setFileUrl(null);
		}
	}, [file]);

	const defaultLayoutPluginInstance = defaultLayoutPlugin({
		sidebarTabs: (defaultTabs) => [
			defaultTabs[0], // Thumbnail tab
			defaultTabs[1], // Bookmark tab
		],
	});

	const searchPluginInstance = searchPlugin();
	const thumbnailPluginInstance = thumbnailPlugin();
	const zoomPluginInstance = zoomPlugin();

	if (!file || !fileUrl) {
		return (
			<div className="flex items-center justify-center h-full border-2 border-dashed rounded-lg">
				<p className="text-gray-500">Open a PDF to view</p>
			</div>
		);
	}

	return (
		<div className="h-full bg-white">
			<Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`}>
				<div style={{ height: "100%" }}>
					<Viewer
						fileUrl={fileUrl}
						plugins={[defaultLayoutPluginInstance, searchPluginInstance, thumbnailPluginInstance, zoomPluginInstance]}
						onDocumentLoad={() => {
							setLoading(false);
						}}
						onPageChange={(e) => {
							onPageChange?.(e.currentPage);
						}}
					/>
				</div>
			</Worker>
			{loading && (
				<div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
				</div>
			)}
		</div>
	);
};
