"use client";

import React, { useState, useCallback } from "react";
import { PDFTools } from "./pdf-tools";
import { PreviewWindow } from "./pdf-viewer";
import { Button } from "@/components/ui/button";
import { Upload, FileDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PDFDocument } from "pdf-lib";
import { isValidPDF } from "@/lib/utils";

export const PDFContainer: React.FC = () => {
	const [files, setFiles] = useState<File[]>([]);
	const [currentFile, setCurrentFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState(0);
	const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
	const { toast } = useToast();

	const calculatePageCount = async (file: File) => {
		try {
			const arrayBuffer = await file.arrayBuffer();
			const pdf = await PDFDocument.load(arrayBuffer);
			return pdf.getPageCount();
		} catch (error) {
			console.error("Error calculating page count:", error);
			return 0;
		}
	};

	const addFile = async (file: File, shouldSetCurrent: boolean = true) => {
		if (!isValidPDF(file)) {
			toast({
				title: "Invalid file",
				description: "Only PDF files are supported",
				variant: "destructive",
			});
			return;
		}

		setFiles((prev) => {
			// Check if file already exists
			if (!prev.some((f) => f.name === file.name && f.size === file.size)) {
				return [...prev, file];
			}
			return prev;
		});

		if (shouldSetCurrent) {
			setCurrentFile(file);
			const count = await calculatePageCount(file);
			setPageCount(count);
			setSelectedRange(null);
		}

		return file;
	};

	const handleFileUpload = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const uploadedFiles = Array.from(event.target.files || []);
			if (uploadedFiles.length > 0) {
				const addedFiles = await Promise.all(uploadedFiles.map((file, index) => addFile(file, index === 0)));

				toast({
					title: "Files added",
					description: `Added ${addedFiles.length} PDF file(s)`,
				});
			}
		},
		[toast]
	);

	const handleFileSelect = async (file: File) => {
		setCurrentFile(file);
		const count = await calculatePageCount(file);
		setPageCount(count);
		setSelectedRange(null);
	};

	const handleDelete = (file: File) => {
		setFiles((prev) => prev.filter((f) => f !== file));
		if (currentFile === file) {
			setCurrentFile(null);
			setSelectedRange(null);
		}
		toast({
			title: "File deleted",
			description: "PDF file has been removed",
		});
	};

	const handleExtract = async (extractedFiles: File[]) => {
		for (const file of extractedFiles) {
			await addFile(file, false);
		}
		if (extractedFiles.length > 0) {
			setCurrentFile(extractedFiles[0]);
			const count = await calculatePageCount(extractedFiles[0]);
			setPageCount(count);
		}
		toast({
			title: "Pages extracted",
			description: `Created ${extractedFiles.length} new PDF file(s)`,
		});
	};

	const handleMerge = async (mergedFile: File) => {
		await addFile(mergedFile, true);
		toast({
			title: "PDFs merged",
			description: "Successfully merged PDF files",
		});
	};

	return (
		<div className="container mx-auto p-4 h-screen">
			<div className="flex flex-col h-full gap-4">
				<header className="flex justify-between items-center">
					<h1 className="text-2xl font-bold">PDF Tools Suite</h1>
					<div className="flex gap-2">
						<Button variant="outline" size="sm" asChild>
							<label>
								<Upload className="w-4 h-4 mr-2" />
								Open PDF
								<input type="file" className="hidden" accept=".pdf" multiple onChange={handleFileUpload} />
							</label>
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={!currentFile}
							onClick={() => {
								if (currentFile) {
									const link = document.createElement("a");
									link.href = URL.createObjectURL(currentFile);
									link.download = currentFile.name;
									link.click();
								}
							}}
						>
							<FileDown className="w-4 h-4 mr-2" />
							Save
						</Button>
					</div>
				</header>

				<div className="flex gap-4 flex-1 min-h-0">
					<div className="w-1/3 bg-white rounded-lg shadow p-4 overflow-y-auto">
						<PDFTools
							files={files}
							currentFile={currentFile}
							pageCount={pageCount}
							onFileSelect={handleFileSelect}
							onDelete={handleDelete}
							onExtract={handleExtract}
							onMerge={handleMerge}
							onRangeChange={setSelectedRange}
							onFilesChange={setFiles}
						/>
					</div>
					<div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
						<PreviewWindow
							file={currentFile}
							selectedRange={selectedRange}
							onPageChange={(page) => {
								// Handle page changes if needed
							}}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};
