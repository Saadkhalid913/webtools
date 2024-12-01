"use client";

import React, { useState, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFileSize } from "@/lib/utils";
import { Plus, Minus, FileDown, Trash2, ChevronDown, Link as LinkIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";

interface PDFToolsProps {
	files: File[];
	currentFile: File | null;
	pageCount: number;
	onFileSelect: (file: File) => void;
	onMerge?: (mergedFile: File) => void;
	onExtract?: (extractedFiles: File[]) => void;
	onCompress?: (compressedFile: File) => void;
	onDelete?: (file: File) => void;
	onRangeChange?: (range: { start: number; end: number } | null) => void;
	onFilesChange?: (files: File[]) => void;
}

interface Range {
	id: string;
	start: string;
	end: string;
}

export const PDFTools: React.FC<PDFToolsProps> = ({
	files,
	currentFile,
	pageCount,
	onFileSelect,
	onMerge,
	onExtract,
	onCompress,
	onDelete,
	onRangeChange,
	onFilesChange,
}) => {
	const [ranges, setRanges] = useState<Range[]>([{ id: "1", start: "", end: "" }]);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [selectedRangeId, setSelectedRangeId] = useState<string | null>(null);
	const [urlInput, setUrlInput] = useState("");
	const [isLoadingUrl, setIsLoadingUrl] = useState(false);
	const [urlError, setUrlError] = useState<string | null>(null);
	const { toast } = useToast();

	const isValidUrl = (url: string) => {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	};

	const handleUrlChange = async (value: string) => {
		setUrlInput(value);
		setUrlError(null);

		if (!isValidUrl(value)) {
			return;
		}

		setIsLoadingUrl(true);
		try {
			const response = await fetch(value);
			const contentType = response.headers.get("content-type");

			if (!contentType?.includes("application/pdf")) {
				setUrlError("URL does not point to a valid PDF file");
				return;
			}

			const blob = await response.blob();
			const filename = value.split("/").pop() || "downloaded.pdf";
			const file = new File([blob], filename, { type: "application/pdf" });

			// Add the file to the list
			onFileSelect(file);
			onFilesChange?.([...files, file]);
			setUrlInput("");

			toast({
				title: "PDF imported successfully",
				description: `Imported ${filename} from URL`,
			});
		} catch (error) {
			console.error("Error importing PDF:", error);
			setUrlError("Failed to fetch PDF from URL");
			toast({
				title: "Error importing PDF",
				description: "Failed to fetch PDF from URL",
				variant: "destructive",
			});
		} finally {
			setIsLoadingUrl(false);
		}
	};

	useEffect(() => {
		if (currentFile !== selectedFile) {
			setSelectedFile(currentFile);
			setRanges([{ id: "1", start: "", end: "" }]);
			setSelectedRangeId(null);
			onRangeChange?.(null);
		}
	}, [currentFile, selectedFile, onRangeChange]);

	const handleFileSelect = (file: File) => {
		setSelectedFile(file);
		onFileSelect(file);
	};

	const handleRangeChange = (index: number, field: keyof Range, value: string) => {
		const newRanges = [...ranges];
		newRanges[index] = { ...newRanges[index], [field]: value };
		setRanges(newRanges);

		// Update preview if this is the selected range and it's valid
		if (selectedRangeId === newRanges[index].id) {
			const start = parseInt(newRanges[index].start);
			const end = parseInt(newRanges[index].end);
			if (!isNaN(start) && !isNaN(end) && start > 0 && end <= pageCount && start <= end) {
				onRangeChange?.({ start, end });
			} else {
				onRangeChange?.(null);
			}
		}
	};

	const isRangeValid = (range: Range) => {
		const start = parseInt(range.start);
		const end = parseInt(range.end);
		return !isNaN(start) && !isNaN(end) && start > 0 && end <= pageCount && start <= end;
	};

	const getRangeError = (range: Range): string | null => {
		const start = parseInt(range.start);
		const end = parseInt(range.end);

		if (isNaN(start) || isNaN(end)) {
			return "Please enter valid numbers";
		}
		if (start <= 0 || end <= 0) {
			return "Page numbers must be greater than 0";
		}
		if (start > pageCount || end > pageCount) {
			return `Page numbers must not exceed ${pageCount}`;
		}
		if (start > end) {
			return "Start page must not be greater than end page";
		}
		return null;
	};

	const handleAddRange = () => {
		const newId = (ranges.length + 1).toString();
		setRanges([...ranges, { id: newId, start: "", end: "" }]);
	};

	const handleRemoveRange = (index: number) => {
		const newRanges = ranges.filter((_, i) => i !== index);
		setRanges(newRanges);

		if (selectedRangeId === ranges[index].id) {
			setSelectedRangeId(null);
			onRangeChange?.(null);
		}
	};

	const handleRangeSelect = (range: Range) => {
		setSelectedRangeId(range.id);
		const start = parseInt(range.start);
		const end = parseInt(range.end);

		if (!isNaN(start) && !isNaN(end) && start > 0 && end <= pageCount && start <= end) {
			onRangeChange?.({ start, end });
		} else {
			onRangeChange?.(null);
		}
	};

	const handleMergePDFs = async () => {
		try {
			const mergedPdf = await PDFDocument.create();

			for (const file of files) {
				const fileArrayBuffer = await file.arrayBuffer();
				const pdf = await PDFDocument.load(fileArrayBuffer);
				const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
				copiedPages.forEach((page) => mergedPdf.addPage(page));
			}

			const mergedPdfBytes = await mergedPdf.save();
			const mergedFile = new File([mergedPdfBytes], "merged.pdf", {
				type: "application/pdf",
			});

			onMerge?.(mergedFile);
		} catch (error) {
			console.error("Error merging PDFs:", error);
		}
	};

	const handleExtractRanges = async () => {
		if (!currentFile) return;

		try {
			const validRanges = ranges.filter((range) => {
				const start = parseInt(range.start);
				const end = parseInt(range.end);
				return !isNaN(start) && !isNaN(end) && start > 0 && end <= pageCount && start <= end;
			});

			if (validRanges.length === 0) return;

			const extractedFiles: File[] = [];
			const sourceArrayBuffer = await currentFile.arrayBuffer();
			const sourcePdf = await PDFDocument.load(sourceArrayBuffer);

			for (const range of validRanges) {
				const start = parseInt(range.start) - 1; // Convert to 0-based index
				const end = parseInt(range.end) - 1;

				const newPdf = await PDFDocument.create();
				const pageIndices = Array.from({ length: end - start + 1 }, (_, i) => start + i);

				const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
				copiedPages.forEach((page) => newPdf.addPage(page));

				const pdfBytes = await newPdf.save();
				const extractedFile = new File(
					[pdfBytes],
					`${currentFile.name.replace(".pdf", "")}_pages_${start + 1}-${end + 1}.pdf`,
					{ type: "application/pdf" }
				);

				extractedFiles.push(extractedFile);
			}

			if (extractedFiles.length > 0) {
				onExtract?.(extractedFiles);
			}
		} catch (error) {
			console.error("Error extracting PDF pages:", error);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="space-y-4">
				<h2 className="text-lg font-semibold">PDF Files</h2>
				<div className="flex gap-2">
					<div className="relative flex-1">
						<Input
							type="text"
							placeholder="Paste PDF URL..."
							value={urlInput}
							onChange={(e) => handleUrlChange(e.target.value)}
							className={`pr-8 ${urlError ? "border-red-500" : ""} ${isLoadingUrl ? "bg-gray-50" : ""}`}
							disabled={isLoadingUrl}
						/>
						{isLoadingUrl && (
							<div className="absolute right-2 top-1/2 -translate-y-1/2">
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
							</div>
						)}
						{urlError && (
							<div className="absolute invisible group-hover:visible bg-red-500 text-white text-xs rounded p-2 -bottom-8 left-0 whitespace-nowrap z-10">
								{urlError}
							</div>
						)}
						<LinkIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
					</div>
				</div>
				{files.map((file, index) => (
					<Accordion key={index} type="single" collapsible className="border rounded-lg">
						<AccordionItem value="item-1">
							<div
								className={`flex flex-col gap-2 p-4 rounded-lg ${
									file === currentFile ? "bg-blue-50" : "bg-white"
								} cursor-pointer hover:bg-blue-50/50 transition-colors`}
								onClick={() => handleFileSelect(file)}
							>
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">{file.name}</p>
										<p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
									</div>
									<div className="flex gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={(e) => {
												e.stopPropagation();
												const link = document.createElement("a");
												link.href = URL.createObjectURL(file);
												link.download = file.name;
												link.click();
											}}
										>
											<FileDown className="w-4 h-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={(e) => {
												e.stopPropagation();
												onDelete?.(file);
											}}
											className="text-red-500 hover:text-red-700 hover:bg-red-50"
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									</div>
								</div>
								{file === currentFile && (
									<AccordionTrigger>
										<span className="text-sm font-medium">Page Ranges</span>
									</AccordionTrigger>
								)}
							</div>
							{file === currentFile && (
								<AccordionContent className="px-4 pb-4">
									<div className="space-y-4">
										<p className="text-sm text-gray-500">Total pages: {pageCount}</p>
										{ranges.map((range, index) => (
											<div
												key={range.id}
												className={`p-3 rounded-lg border ${
													selectedRangeId === range.id ? "border-blue-500 bg-blue-50" : "border-gray-200"
												}`}
												onClick={() => handleRangeSelect(range)}
											>
												<div className="flex items-center gap-2">
													<div className="relative group">
														<Input
															type="number"
															placeholder="Start"
															value={range.start}
															onChange={(e) => handleRangeChange(index, "start", e.target.value)}
															className={`w-20 ${!isRangeValid(range) ? "border-red-300" : ""}`}
															onClick={(e) => e.stopPropagation()}
														/>
														{getRangeError(range) && (
															<div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded p-2 -bottom-8 left-0 whitespace-nowrap z-10">
																{getRangeError(range)}
															</div>
														)}
													</div>
													<span>to</span>
													<div className="relative group">
														<Input
															type="number"
															placeholder="End"
															value={range.end}
															onChange={(e) => handleRangeChange(index, "end", e.target.value)}
															className={`w-20 ${!isRangeValid(range) ? "border-red-300" : ""}`}
															onClick={(e) => e.stopPropagation()}
														/>
													</div>
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															handleRemoveRange(index);
														}}
													>
														<Minus className="w-4 h-4" />
													</Button>
												</div>
											</div>
										))}
										<Button variant="outline" size="sm" onClick={handleAddRange} className="w-full">
											<Plus className="w-4 h-4 mr-2" />
											Add Range
										</Button>
										<Button
											onClick={handleExtractRanges}
											className="w-full"
											disabled={!ranges.some(isRangeValid)}
											title={ranges.some(isRangeValid) ? undefined : "Please enter valid page ranges"}
										>
											Extract Pages
										</Button>
									</div>
								</AccordionContent>
							)}
						</AccordionItem>
					</Accordion>
				))}
			</div>

			{files.length > 1 && (
				<Button onClick={handleMergePDFs} className="w-full mt-4">
					Merge All PDFs
				</Button>
			)}
		</div>
	);
};
