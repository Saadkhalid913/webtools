"use client";

import React, { useState, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFileSize } from "@/lib/utils";
import { Plus, Minus, FileDown, Trash2, ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
}) => {
	const [ranges, setRanges] = useState<Range[]>([{ id: "1", start: "", end: "" }]);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [selectedRangeId, setSelectedRangeId] = useState<string | null>(null);

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
		const newValue = value === "" ? "" : Math.max(1, parseInt(value) || 1).toString();
		const newRanges = [...ranges];
		newRanges[index] = { ...newRanges[index], [field]: newValue };

		// Ensure start is not greater than end
		if (field === "start" && newValue !== "") {
			const start = parseInt(newValue);
			const end = parseInt(newRanges[index].end);
			if (!isNaN(end) && start > end) {
				newRanges[index].end = newValue;
			}
		}
		if (field === "end" && newValue !== "") {
			const end = parseInt(newValue);
			const start = parseInt(newRanges[index].start);
			if (!isNaN(start) && end < start) {
				newRanges[index].start = newValue;
			}
		}

		// Ensure values don't exceed page count
		if (newValue !== "" && parseInt(newValue) > pageCount) {
			newRanges[index][field] = pageCount.toString();
		}

		setRanges(newRanges);

		// Update preview with the current range if valid
		const start = parseInt(newRanges[index].start);
		const end = parseInt(newRanges[index].end);

		if (!isNaN(start) && !isNaN(end) && start > 0 && end <= pageCount && start <= end) {
			if (selectedRangeId === newRanges[index].id) {
				onRangeChange?.({ start, end });
			}
		} else if (selectedRangeId === newRanges[index].id) {
			onRangeChange?.(null);
		}
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
													<Input
														type="number"
														min="1"
														max={pageCount}
														placeholder="Start"
														value={range.start}
														onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
															handleRangeChange(index, "start", e.target.value)
														}
														className="w-20"
														onClick={(e) => e.stopPropagation()}
													/>
													<span>to</span>
													<Input
														type="number"
														min="1"
														max={pageCount}
														placeholder="End"
														value={range.end}
														onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
															handleRangeChange(index, "end", e.target.value)
														}
														className="w-20"
														onClick={(e) => e.stopPropagation()}
													/>
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
											disabled={
												!ranges.some((range) => {
													const start = parseInt(range.start);
													const end = parseInt(range.end);
													return !isNaN(start) && !isNaN(end) && start > 0 && end <= pageCount && start <= end;
												})
											}
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
