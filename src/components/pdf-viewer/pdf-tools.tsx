"use client";

import React, { useState, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFileSize } from "@/lib/utils";
import { Plus, Minus, FileDown, Trash2, ChevronDown, Link as LinkIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";

interface PDFToolsProps {
	files: FileWithId[];
	currentFile: FileWithId | null;
	currentRange: { start: number; end: number } | null;
	onFileSelect: (file: FileWithId) => void;
	onMerge?: (mergedFile: File) => void;
	onExtract?: (extractedFiles: File[]) => void;
	onCompress?: (compressedFile: File) => void;
	onDelete?: (file: FileWithId) => void;
	onRangeChange?: (range: { start: number; end: number } | null) => void;
	onFilesChange?: (files: FileWithId[]) => void;
}

interface Range {
	id: string;
	start: string;
	end: string;
}

interface FileWithId extends File {
	id: string;
	totalPages: number;
}

export const PDFTools: React.FC<PDFToolsProps> = ({
	files,
	currentFile,
	currentRange,
	onFileSelect,
	onMerge,
	onExtract,
	onCompress,
	onDelete,
	onRangeChange,
	onFilesChange,
}) => {
	const [fileRanges, setFileRanges] = useState<Record<string, Range[]>>({});
	const [selectedFile, setSelectedFile] = useState<FileWithId | null>(null);
	const [selectedRangeId, setSelectedRangeId] = useState<string | null>(null);
	const [urlInput, setUrlInput] = useState("");
	const [isLoadingUrl, setIsLoadingUrl] = useState(false);
	const [urlError, setUrlError] = useState<string | null>(null);
	const { toast } = useToast();

	// Initialize ranges for a new file
	useEffect(() => {
		if (currentFile && !fileRanges[currentFile.id]) {
			setFileRanges((prev) => ({
				...prev,
				[currentFile.id]: [
					{
						id: uuidv4(),
						start: "1",
						end: currentFile.totalPages.toString(),
					},
				],
			}));
			// Select the initial range and update the preview
			const initialRange = { start: 1, end: currentFile.totalPages };
			setSelectedRangeId("1");
			onRangeChange?.(initialRange);
		}
	}, [currentFile, fileRanges]);

	const currentRanges = currentFile ? fileRanges[currentFile.id] || [] : [];

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

			// Calculate page count before creating FileWithId
			const arrayBuffer = await file.arrayBuffer();
			const pdf = await PDFDocument.load(arrayBuffer);
			const pageCount = pdf.getPageCount();

			const fileWithId: FileWithId = Object.assign(file, {
				id: uuidv4(),
				totalPages: pageCount,
			});

			// Add the file to the list
			onFileSelect(fileWithId);
			onFilesChange?.([...files, fileWithId]);
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
		if (currentFile && currentRange) {
			const newRange = {
				id: "1",
				start: currentRange.start.toString(),
				end: currentRange.end.toString(),
			};
			if (currentFile) {
				setFileRanges((prev) => ({
					...prev,
					[currentFile.id]: [newRange],
				}));
				setSelectedRangeId("1");
			}
		}
	}, [currentFile, currentRange]);

	const handleFileSelect = (file: FileWithId) => {
		setSelectedFile(file);
		onFileSelect(file);
	};

	const handleRangeChange = (index: number, field: keyof Range, value: string) => {
		if (!currentFile) return;

		const newRanges = [...currentRanges];
		newRanges[index] = { ...newRanges[index], [field]: value };

		setFileRanges((prev) => ({
			...prev,
			[currentFile.id]: newRanges,
		}));

		// Update preview if this is the selected range and it's valid
		if (selectedRangeId === newRanges[index].id) {
			const start = parseInt(newRanges[index].start);
			const end = parseInt(newRanges[index].end);

			if (!isNaN(start) && !isNaN(end) && start > 0 && end <= currentFile.totalPages && start <= end) {
				onRangeChange?.({ start, end });
			} else {
				onRangeChange?.(null);
			}
		}
	};

	const isRangeValid = (range: Range) => {
		if (!currentFile) return false;
		const start = parseInt(range.start);
		const end = parseInt(range.end);
		return !isNaN(start) && !isNaN(end) && start > 0 && end <= currentFile.totalPages && start <= end;
	};

	const getRangeError = (range: Range): string | null => {
		if (!currentFile) return "No PDF selected";
		const start = parseInt(range.start);
		const end = parseInt(range.end);

		if (isNaN(start) || isNaN(end)) {
			return "Please enter valid numbers";
		}
		if (start <= 0 || end <= 0) {
			return "Page numbers must be greater than 0";
		}
		if (start > currentFile.totalPages || end > currentFile.totalPages) {
			return `Page numbers must not exceed ${currentFile.totalPages}`;
		}
		if (start > end) {
			return "Start page must not be greater than end page";
		}
		return null;
	};

	const handleAddRange = () => {
		if (!currentFile) return;

		const newRange = {
			id: uuidv4(),
			start: "1",
			end: currentFile.totalPages.toString(),
		};
		setFileRanges((prev) => ({
			...prev,
			[currentFile.id]: [...currentRanges, newRange],
		}));

		toast({
			title: "Range Added",
			description: "New page range has been added",
		});
	};

	const handleRemoveRange = (index: number) => {
		if (!currentFile) return;

		const newRanges = currentRanges.filter((_, i) => i !== index);
		setFileRanges((prev) => ({
			...prev,
			[currentFile.id]: newRanges,
		}));

		if (selectedRangeId === currentRanges[index].id) {
			setSelectedRangeId(null);
			onRangeChange?.(null);
		}

		toast({
			title: "Range Removed",
			description: "Page range has been removed",
		});
	};

	const handleRangeSelect = (range: Range) => {
		if (!currentFile) return;

		setSelectedRangeId(range.id);
		const start = parseInt(range.start);
		const end = parseInt(range.end);

		if (!isNaN(start) && !isNaN(end) && start > 0 && end <= currentFile.totalPages && start <= end) {
			onRangeChange?.({ start, end });
		} else {
			onRangeChange?.(null);
		}
	};

	const handleExtractRanges = async () => {
		if (!currentFile) return;

		try {
			const validRanges = currentRanges.filter((range) => {
				const start = parseInt(range.start);
				const end = parseInt(range.end);
				return !isNaN(start) && !isNaN(end) && start > 0 && end <= currentFile.totalPages && start <= end;
			});

			if (validRanges.length === 0) return;

			const extractedFiles: File[] = [];
			const sourceArrayBuffer = await currentFile.arrayBuffer();
			const sourcePdf = await PDFDocument.load(sourceArrayBuffer);

			for (const range of validRanges) {
				const start = parseInt(range.start) - 1; // Convert to 0-based index for PDF operations
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

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<div className="flex gap-2">
					<Input
						type="text"
						placeholder="Enter PDF URL"
						value={urlInput}
						onChange={(e) => setUrlInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleUrlChange(urlInput);
							}
						}}
						className="flex-1"
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={() => handleUrlChange(urlInput)}
						disabled={isLoadingUrl || !isValidUrl(urlInput)}
						className="shrink-0"
					>
						{isLoadingUrl ? (
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" />
						) : (
							<LinkIcon className="w-4 h-4" />
						)}
					</Button>
				</div>
				{urlError && <p className="text-sm text-red-500">{urlError}</p>}
			</div>

			<div className="text-sm text-gray-500 hidden lg:block">
				<p>Keyboard shortcuts:</p>
				<ul className="list-disc list-inside ml-2">
					<li>Ctrl/⌘ + ↑: Previous PDF</li>
					<li>Ctrl/⌘ + ↓: Next PDF</li>
					<li>Ctrl/⌘ + D: Delete current PDF</li>
				</ul>
			</div>

			<Accordion type="single" collapsible className="w-full">
				<AccordionItem value="files">
					<AccordionTrigger className="hover:no-underline">
						<div className="flex items-center justify-between w-full">
							<span>PDF Files</span>
							<span className="text-sm text-gray-500">
								{files.length} file{files.length !== 1 ? "s" : ""}
							</span>
						</div>
					</AccordionTrigger>
					<AccordionContent>
						<div className="flex flex-col gap-2">
							{files.map((file) => (
								<div
									key={file.id}
									className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
										currentFile === file ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300"
									}`}
									onClick={() => handleFileSelect(file)}
								>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium truncate">{file.name}</p>
										<p className="text-xs text-gray-500">
											{formatFileSize(file.size)} • {file.totalPages} page{file.totalPages !== 1 ? "s" : ""}
										</p>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={(e) => {
											e.stopPropagation();
											onDelete?.(file);
										}}
										className="text-gray-500 hover:text-red-500 shrink-0"
									>
										<Trash2 className="w-4 h-4" />
									</Button>
								</div>
							))}
						</div>
					</AccordionContent>
				</AccordionItem>

				{currentFile && (
					<AccordionItem value="ranges">
						<AccordionTrigger className="hover:no-underline">
							<div className="flex items-center justify-between w-full">
								<span>Page Ranges</span>
								<span className="text-sm text-gray-500">
									{currentRanges.length} range{currentRanges.length !== 1 ? "s" : ""}
								</span>
							</div>
						</AccordionTrigger>
						<AccordionContent>
							<div className="flex flex-col gap-4">
								<div className="flex justify-between items-center">
									<p className="text-sm text-gray-500">
										{currentFile.totalPages} page{currentFile.totalPages !== 1 ? "s" : ""} total
									</p>
									<Button variant="outline" size="sm" onClick={handleAddRange} className="shrink-0">
										<Plus className="w-4 h-4 mr-2" />
										Add Range
									</Button>
								</div>
								{currentRanges.map((range, index) => (
									<div
										key={range.id}
										className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
											selectedRangeId === range.id
												? "border-blue-500 bg-blue-50/50"
												: "border-gray-200 hover:border-gray-300"
										}`}
										onClick={() => handleRangeSelect(range)}
									>
										<div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
											<div className="flex items-center gap-2">
												<span className="text-sm text-gray-500 shrink-0">From</span>
												<Input
													type="number"
													min={1}
													max={currentFile.totalPages}
													value={range.start}
													onChange={(e) => handleRangeChange(index, "start", e.target.value)}
													placeholder="Start"
													className="w-20"
												/>
											</div>
											<div className="flex items-center gap-2">
												<span className="text-sm text-gray-500 shrink-0">to</span>
												<Input
													type="number"
													min={1}
													max={currentFile.totalPages}
													value={range.end}
													onChange={(e) => handleRangeChange(index, "end", e.target.value)}
													placeholder="End"
													className="w-20"
												/>
											</div>
										</div>
										<Button
											variant="ghost"
											size="sm"
											onClick={(e) => {
												e.stopPropagation();
												handleRemoveRange(index);
											}}
											className="text-gray-500 hover:text-red-500 shrink-0"
										>
											<Trash2 className="w-4 h-4" />
										</Button>
									</div>
								))}
								{currentRanges.some((range) => !isRangeValid(range)) && (
									<p className="text-sm text-red-500">
										{currentRanges.map((range) => getRangeError(range)).find(Boolean)}
									</p>
								)}
							</div>
						</AccordionContent>
					</AccordionItem>
				)}

				{files.length > 1 && (
					<AccordionItem value="actions">
						<AccordionTrigger className="hover:no-underline">Actions</AccordionTrigger>
						<AccordionContent>
							<div className="flex flex-col gap-2">
								<Button variant="outline" size="sm" onClick={handleMergePDFs}>
									Merge PDFs
								</Button>
								{currentFile && currentRanges.some((range) => isRangeValid(range)) && (
									<Button variant="outline" size="sm" onClick={handleExtractRanges}>
										Extract Pages
									</Button>
								)}
							</div>
						</AccordionContent>
					</AccordionItem>
				)}
			</Accordion>
		</div>
	);
};
