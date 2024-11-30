"use client";

import React, { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFileSize } from "@/lib/utils";
import { Plus, Minus, FileDown, Trash2 } from "lucide-react";

interface PDFToolsProps {
	files: File[];
	currentFile: File | null;
	onFileSelect: (file: File) => void;
	onMerge?: (mergedFile: File) => void;
	onExtract?: (extractedFiles: File[]) => void;
	onCompress?: (compressedFile: File) => void;
	onDelete?: (file: File) => void;
}

interface Range {
	start: string;
	end: string;
}

export const PDFTools: React.FC<PDFToolsProps> = ({
	files,
	currentFile,
	onFileSelect,
	onMerge,
	onExtract,
	onCompress,
	onDelete,
}) => {
	const [ranges, setRanges] = useState<Range[]>([{ start: "", end: "" }]);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number>(0);

	const handleFileSelect = async (file: File) => {
		setSelectedFile(file);
		onFileSelect(file);

		// Get page count
		const arrayBuffer = await file.arrayBuffer();
		const pdf = await PDFDocument.load(arrayBuffer);
		setPageCount(pdf.getPageCount());
	};

	const handleDelete = (e: React.MouseEvent, file: File) => {
		e.stopPropagation();
		if (file === selectedFile) {
			setSelectedFile(null);
			setPageCount(0);
			setRanges([{ start: "", end: "" }]);
		}
		onDelete?.(file);
	};

	const handleAddRange = () => {
		setRanges([...ranges, { start: "", end: "" }]);
	};

	const handleRemoveRange = (index: number) => {
		setRanges(ranges.filter((_, i) => i !== index));
	};

	const handleRangeChange = (index: number, field: keyof Range, value: string) => {
		const newRanges = [...ranges];
		newRanges[index] = { ...newRanges[index], [field]: value };
		setRanges(newRanges);
	};

	const handleExtract = async () => {
		if (!selectedFile) return;

		try {
			const arrayBuffer = await selectedFile.arrayBuffer();
			const pdf = await PDFDocument.load(arrayBuffer);
			const extractedFiles: File[] = [];

			for (const range of ranges) {
				const start = parseInt(range.start) - 1;
				const end = parseInt(range.end) - 1;

				if (isNaN(start) || isNaN(end) || start < 0 || end >= pdf.getPageCount() || start > end) {
					continue;
				}

				const newPdf = await PDFDocument.create();
				const pages = await newPdf.copyPages(
					pdf,
					Array.from({ length: end - start + 1 }, (_, i) => start + i)
				);
				pages.forEach((page) => newPdf.addPage(page));

				const pdfBytes = await newPdf.save();
				const extractedFile = new File(
					[pdfBytes],
					`${selectedFile.name.replace(".pdf", "")}_pages_${start + 1}-${end + 1}.pdf`,
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

	const handleCompressPDF = async (file: File) => {
		try {
			const fileArrayBuffer = await file.arrayBuffer();
			const pdf = await PDFDocument.load(fileArrayBuffer);

			const compressedPdfBytes = await pdf.save({
				useObjectStreams: true,
			});

			const compressedFile = new File([compressedPdfBytes], `${file.name.replace(".pdf", "")}_compressed.pdf`, {
				type: "application/pdf",
			});

			onCompress?.(compressedFile);
		} catch (error) {
			console.error("Error compressing PDF:", error);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="space-y-4">
				<h2 className="text-lg font-semibold">PDF Files</h2>
				{files.map((file, index) => (
					<div
						key={index}
						className={`flex flex-col gap-2 p-4 bg-white rounded-lg border ${
							file === currentFile ? "border-blue-500" : "border-gray-200"
						} cursor-pointer hover:border-blue-300 transition-colors`}
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
									onClick={(e) => handleDelete(e, file)}
									className="text-red-500 hover:text-red-700 hover:bg-red-50"
								>
									<Trash2 className="w-4 h-4" />
								</Button>
							</div>
						</div>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={(e) => {
									e.stopPropagation();
									handleCompressPDF(file);
								}}
							>
								Compress
							</Button>
						</div>
					</div>
				))}
			</div>

			{selectedFile && (
				<div className="space-y-4 mt-4">
					<h2 className="text-lg font-semibold">Extract Pages</h2>
					<p className="text-sm text-gray-500">Total pages: {pageCount}</p>
					{ranges.map((range, index) => (
						<div key={index} className="flex items-center gap-2">
							<Input
								type="number"
								min="1"
								max={pageCount}
								placeholder="Start"
								value={range.start}
								onChange={(e) => handleRangeChange(index, "start", e.target.value)}
								className="w-20"
							/>
							<span>to</span>
							<Input
								type="number"
								min="1"
								max={pageCount}
								placeholder="End"
								value={range.end}
								onChange={(e) => handleRangeChange(index, "end", e.target.value)}
								className="w-20"
							/>
							<Button variant="ghost" size="sm" onClick={() => handleRemoveRange(index)}>
								<Minus className="w-4 h-4" />
							</Button>
							{index === ranges.length - 1 && (
								<Button variant="ghost" size="sm" onClick={handleAddRange}>
									<Plus className="w-4 h-4" />
								</Button>
							)}
						</div>
					))}
					<Button onClick={handleExtract} className="w-full">
						Extract Pages
					</Button>
				</div>
			)}

			{files.length > 1 && (
				<div className="mt-4">
					<Button onClick={handleMergePDFs} className="w-full">
						Merge All PDFs
					</Button>
				</div>
			)}
		</div>
	);
};
