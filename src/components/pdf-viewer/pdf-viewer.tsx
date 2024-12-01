"use client";

import React, { useState, useEffect } from "react";
import { Worker, Viewer, RenderPage, VisiblePagesRange } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { searchPlugin } from "@react-pdf-viewer/search";
import { thumbnailPlugin } from "@react-pdf-viewer/thumbnail";
import { zoomPlugin } from "@react-pdf-viewer/zoom";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import { ScrollMode } from "@react-pdf-viewer/core";
import { LoadError } from "@react-pdf-viewer/core";

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
	const [currentPage, setCurrentPage] = useState<number>(0);

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

	const pageNavigationPluginInstance = pageNavigationPlugin({});

	const setRenderRange = (visiblePagesRange: VisiblePagesRange) => {
		if (selectedRange) {
			return {
				startPage: selectedRange.start - 1,
				endPage: selectedRange.end - 1,
			};
		}
		return visiblePagesRange;
	};

	// Handle range changes and page navigation
	useEffect(() => {
		if (selectedRange && pageNavigationPluginInstance) {
			const start = selectedRange.start - 1; // Convert to 0-based index
			const end = selectedRange.end - 1;

			// If current page is outside the range, navigate to the nearest valid page
			if (currentPage < start) {
				pageNavigationPluginInstance.jumpToPage(start);
			} else if (currentPage > end) {
				pageNavigationPluginInstance.jumpToPage(end);
			}
		}
	}, [selectedRange, currentPage]);

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

		let start: number;
		let end: number;

		if (selectedRange) {
			start = Math.max(pageIndex - bufferSize, selectedRange.start);
			end = Math.min(pageIndex + bufferSize, selectedRange.end);
		} else {
			start = pageIndex - bufferSize;
			end = pageIndex + bufferSize;
		}
		const pageNumber = pageIndex + 1;
		if (pageNumber < start || pageNumber > end) {
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
			<Worker workerUrl="/pdf.worker.min.js">
				<div style={{ height: "100%", padding: "16px 0" }}>
					<Viewer
						fileUrl={fileUrl}
						plugins={[
							defaultLayoutPluginInstance,
							searchPluginInstance,
							thumbnailPluginInstance,
							zoomPluginInstance,
							pageNavigationPluginInstance,
						]}
						onDocumentLoad={(doc: any) => {
							setLoading(false);
							if (selectedRange) {
								const { start, end } = selectedRange;
								pageNavigationPluginInstance.jumpToPage(start - 1);

								// Update the total number of pages
								doc.numPages = end - start + 1;
							}
						}}
						onPageChange={(e) => {
							setCurrentPage(e.currentPage - 1); // Convert to 0-based index
							onPageChange?.(e.currentPage);
						}}
						renderPage={renderPage}
						defaultScale={1}
						// @ts-ignore
						cacheSize={50}
						scrollMode={ScrollMode.Vertical}
						enableSmoothScroll={true}
						prefixClass="rpv-"
						enablePageWrap={false}
						setRenderRange={setRenderRange}
						renderLoader={(percentages: number) => (
							<div className="flex items-center justify-center p-4">
								<div className="w-full max-w-sm">
									<div className="h-2 bg-gray-200 rounded">
										<div
											className="h-2 bg-blue-500 rounded transition-all duration-300"
											style={{ width: `${Math.round(percentages)}%` }}
										/>
									</div>
								</div>
							</div>
						)}
						renderError={(error: LoadError) => (
							<div className="text-red-500 p-4">Failed to load page: {error.message}</div>
						)}
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
