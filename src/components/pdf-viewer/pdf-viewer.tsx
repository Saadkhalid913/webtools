"use client";

import React, { useState, useEffect } from "react";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { searchPlugin } from "@react-pdf-viewer/search";
import { thumbnailPlugin } from "@react-pdf-viewer/thumbnail";
import { zoomPlugin } from "@react-pdf-viewer/zoom";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import type { RenderPage } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/thumbnail/lib/styles/index.css";

interface PreviewWindowProps {
	file: File | null;
	selectedRange?: { start: number; end: number } | null;
	onPageChange?: (page: number) => void;
}

export const PreviewWindow: React.FC<PreviewWindowProps> = ({ file, selectedRange, onPageChange }) => {
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

	const pageNavigationPluginInstance = pageNavigationPlugin({
		renderPageLabel: (props: { pageIndex: number; totalPages: number }) => {
			if (selectedRange) {
				const adjustedPage = props.pageIndex + 1 - selectedRange.start + 1;
				const totalPages = selectedRange.end - selectedRange.start + 1;
				return `Page ${adjustedPage} of ${totalPages} (Original: ${selectedRange.start}-${selectedRange.end})`;
			}
			return `Page ${props.pageIndex + 1} of ${props.totalPages}`;
		},
	});
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
				<p className="text-gray-500">Open a PDF to preview</p>
			</div>
		);
	}

	const renderPage: RenderPage = ({ canvasLayer, textLayer, annotationLayer, pageIndex }) => {
		const bufferSize = 250; // render this many pages before and after the current page
		const isInRange = selectedRange
			? pageIndex >= selectedRange.start - bufferSize && pageIndex <= selectedRange.end + bufferSize
			: true;

		if (!isInRange) {
			return <></>;
		}

		return (
			<div
				style={{
					margin: "8px auto",
					boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
					borderRadius: "4px",
				}}
			>
				<div style={{ position: "static" }}>
					<div>{canvasLayer.children}</div>
					<div style={{ position: "static", top: 0, left: 0, right: 0, bottom: 0 }}>{textLayer.children}</div>
					<div style={{ position: "static", top: 0, left: 0, right: 0, bottom: 0 }}>{annotationLayer.children}</div>
				</div>
			</div>
		);
	};

	return (
		<div className="h-full bg-white">
			{/* The Worker component loads PDF.js in a Web Worker thread to handle PDF parsing and rendering.
			    This prevents the main UI thread from being blocked during heavy PDF operations. */}
			<Worker workerUrl="/pdf.worker.min.js">
				<div style={{ height: "100%", padding: "16px 0" }}>
					<Viewer
						fileUrl={fileUrl}
						plugins={[
							// Provides the default layout with sidebar, toolbar and menu
							defaultLayoutPluginInstance,
							// Enables text search functionality within the PDF
							searchPluginInstance,
							// Shows thumbnail previews of pages in the sidebar
							thumbnailPluginInstance,
							// Adds zoom in/out and zoom level selection controls
							zoomPluginInstance,
							// Handles page navigation and displays current page number
							pageNavigationPluginInstance,
						]}
						onDocumentLoad={() => {
							setLoading(false);
							if (selectedRange) {
								pageNavigationPluginInstance.jumpToPage(selectedRange.start - 1);
							}
						}}
						onPageChange={(e) => {
							onPageChange?.(e.currentPage);
						}}
						renderPage={renderPage}
						defaultScale={1}
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
