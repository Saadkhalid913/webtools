"use client";

import React, { useState, useCallback, useEffect } from "react";
import { PDFTools } from "./pdf-tools";
import { PreviewWindow } from "./pdf-viewer";
import { Button } from "@/components/ui/button";
import { Upload, FileDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PDFDocument } from "pdf-lib";
import { isValidPDF } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

interface FileWithId extends File {
	id: string;
	totalPages: number;
}

export const PDFContainer: React.FC = () => {
	const [files, setFiles] = useState<FileWithId[]>([]);
	const [currentFile, setCurrentFile] = useState<FileWithId | null>(null);
	const [fileRanges, setFileRanges] = useState<Record<string, { start: number; end: number }>>({});
	const { toast } = useToast();

	const calculatePageCount = async (file: File): Promise<number> => {
		try {
			const arrayBuffer = await file.arrayBuffer();
			const pdf = await PDFDocument.load(arrayBuffer);
			return pdf.getPageCount();
		} catch (error) {
			console.error("Error calculating page count:", error);
			return 0;
		}
	};

	const selectPDF = async (file: FileWithId | null) => {
		setCurrentFile(file);
		if (file && !fileRanges[file.id]) {
			setFileRanges((prev) => ({
				...prev,
				[file.id]: { start: 1, end: file.totalPages },
			}));
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

		const pageCount = await calculatePageCount(file);
		const fileWithId: FileWithId = Object.assign(file, {
			id: uuidv4(),
			totalPages: pageCount,
		});

		setFiles((prev) => {
			// Check if file already exists
			if (!prev.some((f) => f.name === file.name && f.size === file.size)) {
				return [...prev, fileWithId];
			}
			return prev;
		});

		if (shouldSetCurrent) {
			await selectPDF(fileWithId);
		}

		return fileWithId;
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

	const handleFileSelect = async (file: FileWithId) => {
		await selectPDF(file);
	};

	const handleDelete = (file: FileWithId) => {
		const currentIndex = files.findIndex((f) => f === file);
		let nextFile: FileWithId | null = null;

		// Remove the file first to get the new array state
		const newFiles = files.filter((f) => f !== file);
		setFiles(newFiles);

		// Find the next file to select
		if (newFiles.length > 0) {
			if (currentIndex > 0) {
				// If there's a previous file, select it
				nextFile = newFiles[currentIndex - 1];
			} else {
				// If we're at the start or the file was deleted,
				// select the first file of the remaining ones
				nextFile = newFiles[0];
			}
		}

		setFileRanges((prev) => {
			const newRanges = { ...prev };
			delete newRanges[file.id];
			return newRanges;
		});

		// Select the next file (or null if no files left)
		selectPDF(nextFile);

		toast({
			title: "PDF deleted",
			description: `Removed ${file.name}${nextFile ? `, switched to ${nextFile.name}` : ""}`,
		});
	};

	const handleExtract = async (extractedFiles: File[]) => {
		const filesWithIds = await Promise.all(
			extractedFiles.map(async (file) => {
				const pageCount = await calculatePageCount(file);
				const fileWithId = Object.assign(file, {
					id: uuidv4(),
					totalPages: pageCount,
				});
				await addFile(fileWithId, false);
				return fileWithId;
			})
		);

		if (filesWithIds.length > 0) {
			await selectPDF(filesWithIds[0]);
		}

		toast({
			title: "Pages extracted",
			description: `Created ${filesWithIds.length} new PDF file(s)`,
		});
	};

	const handleMerge = async (mergedFile: File) => {
		const pageCount = await calculatePageCount(mergedFile);
		const fileWithId = Object.assign(mergedFile, {
			id: uuidv4(),
			totalPages: pageCount,
		});
		await addFile(fileWithId, true);
		toast({
			title: "PDFs merged",
			description: "Successfully merged PDF files",
		});
	};

	const handleKeyNavigation = useCallback(
		(e: KeyboardEvent) => {
			// Navigation with arrow keys
			if ((e.metaKey || e.ctrlKey) && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
				e.preventDefault();

				if (files.length === 0) return;

				const currentIndex = currentFile ? files.findIndex((f) => f === currentFile) : -1;
				let newIndex;

				if (e.key === "ArrowUp") {
					newIndex = currentIndex <= 0 ? files.length - 1 : currentIndex - 1;
				} else {
					newIndex = currentIndex >= files.length - 1 ? 0 : currentIndex + 1;
				}

				const newFile = files[newIndex];
				if (newFile) {
					selectPDF(newFile);
					toast({
						title: "PDF Changed",
						description: `Switched to ${newFile.name}`,
					});
				}
			}

			// Delete current PDF with Cmd/Ctrl + D
			if ((e.metaKey || e.ctrlKey) && e.key === "d") {
				e.preventDefault();
				if (currentFile) {
					handleDelete(currentFile);
				}
			}
		},
		[files, currentFile, selectPDF, toast, handleDelete]
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyNavigation);
		return () => window.removeEventListener("keydown", handleKeyNavigation);
	}, [handleKeyNavigation]);

	return (
		<div className="container mx-auto p-4 h-screen max-w-full">
			<div className="flex flex-col h-full gap-4">
				<header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
					<h1 className="text-2xl font-bold">PDF Tools Suite</h1>
					<div className="flex gap-2 w-full sm:w-auto">
						<Button variant="outline" size="sm" className="flex-1 sm:flex-none" asChild>
							<label>
								<Upload className="w-4 h-4 mr-2" />
								Open PDF
								<input type="file" className="hidden" accept=".pdf" multiple onChange={handleFileUpload} />
							</label>
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="flex-1 sm:flex-none"
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

				<div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
					<div className="w-full lg:w-1/3 bg-white rounded-lg shadow p-4 overflow-y-auto order-2 lg:order-1">
						<PDFTools
							files={files}
							currentFile={currentFile}
							onFileSelect={handleFileSelect}
							onDelete={handleDelete}
							onExtract={handleExtract}
							onMerge={handleMerge}
							currentRange={currentFile ? fileRanges[currentFile.id] : null}
							onRangeChange={(range) => {
								if (currentFile) {
									setFileRanges((prev) => {
										if (range) {
											return {
												...prev,
												[currentFile.id]: range,
											};
										} else {
											const newRanges = { ...prev };
											delete newRanges[currentFile.id];
											return newRanges;
										}
									});
								}
							}}
							onFilesChange={setFiles}
						/>
					</div>
					<div className="flex-1 bg-white rounded-lg shadow overflow-hidden order-1 lg:order-2 h-[50vh] lg:h-auto">
						<PreviewWindow
							file={currentFile}
							selectedRange={currentFile ? fileRanges[currentFile.id] || null : null}
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
