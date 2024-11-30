"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileDown } from "lucide-react";
import { PreviewWindow } from "@/components/pdf-viewer/pdf-viewer";
import { PDFTools } from "@/components/pdf-viewer/pdf-tools";
import { isValidPDF } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { PDFDocument } from "pdf-lib";

export default function Home() {
	const [files, setFiles] = useState<File[]>([]);
	const [currentFile, setCurrentFile] = useState<File | null>(null);
	const [pageCount, setPageCount] = useState<number>(0);
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

	const handleFileUpload = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const uploadedFiles = Array.from(event.target.files || []).filter(isValidPDF);
			if (uploadedFiles.length > 0) {
				setFiles((prev) => [...prev, ...uploadedFiles]);
				const firstFile = uploadedFiles[0];
				setCurrentFile(firstFile);
				const count = await calculatePageCount(firstFile);
				setPageCount(count);
				setSelectedRange(null);
				toast({
					title: "Files added",
					description: `Added ${uploadedFiles.length} PDF file(s)`,
				});
			}
		},
		[toast]
	);

	const handleMerge = useCallback(
		(mergedFile: File) => {
			setFiles((prev) => [...prev, mergedFile]);
			setCurrentFile(mergedFile);
			toast({
				title: "PDFs merged",
				description: "Successfully merged PDF files",
			});
		},
		[toast]
	);

	const handleExtract = useCallback(
		(extractedFiles: File[]) => {
			setFiles((prev) => [...prev, ...extractedFiles]);
			toast({
				title: "Pages extracted",
				description: `Created ${extractedFiles.length} new PDF file(s)`,
			});
		},
		[toast]
	);

	const handleCompress = useCallback(
		(compressedFile: File) => {
			setFiles((prev) => [...prev, compressedFile]);
			toast({
				title: "PDF compressed",
				description: "Successfully compressed PDF file",
			});
		},
		[toast]
	);

	const handleFileSelect = useCallback(async (file: File) => {
		setCurrentFile(file);
		const count = await calculatePageCount(file);
		setPageCount(count);
		setSelectedRange(null);
	}, []);

	const handleRangeChange = useCallback((range: { start: number; end: number } | null) => {
		setSelectedRange(range);
	}, []);

	const handleDelete = useCallback(
		(fileToDelete: File) => {
			setFiles((prev) => prev.filter((file) => file !== fileToDelete));
			if (currentFile === fileToDelete) {
				setCurrentFile(null);
			}
			toast({
				title: "File deleted",
				description: "PDF file has been removed",
			});
		},
		[currentFile, toast]
	);

	return (
		<main className="container mx-auto p-4 h-screen">
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
							onMerge={handleMerge}
							onExtract={handleExtract}
							onCompress={handleCompress}
							onDelete={handleDelete}
							onRangeChange={handleRangeChange}
						/>
					</div>
					<div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
						<PreviewWindow file={currentFile} selectedRange={selectedRange} />
					</div>
				</div>
			</div>
		</main>
	);
}
