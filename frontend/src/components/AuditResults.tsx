"use client";

import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "../lib/config";
import {
    Download,
    Monitor,
    Code,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DevAnalysisView from "./DevAnalysisView";

interface AuditResultsProps {
    data: any;
}

export default function AuditResults({ data }: AuditResultsProps) {
    const [activeTab, setActiveTab] = useState<"client" | "dev">("client");
    const [downloading, setDownloading] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.1 }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    if (!data) return null;

    const { client, dev, url } = data;

    const handleDownload = async (endpoint: string, filename: string) => {
        if (!url) return;
        setDownloading(filename);
        try {
            // For mock data, we just create a file
            if (url.includes("/demo")) {
                const content = endpoint.includes("raw") ? data : { ...data, filtered: true };
                const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
                downloadBlob(blob, filename);
                setDownloading(null);
                return;
            }

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) throw new Error("Download failed");

            const blob = await response.json();
            const jsonBlob = new Blob([JSON.stringify(blob, null, 2)], { type: "application/json" });
            downloadBlob(jsonBlob, filename);
        } catch (error) {
            console.error("Download error:", error);
            alert("Failed to download report");
        } finally {
            setDownloading(null);
        }
    };

    const downloadBlob = (blob: Blob, filename: string) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
    };

    const scoreColor = (score: number) => {
        if (score >= 0.9) return "text-green-500 bg-green-500/10 border-green-500/20";
        if (score >= 0.5) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
        return "text-red-500 bg-red-500/10 border-red-500/20";
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.1
            }
        },
        exit: {
            opacity: 0,
            transition: { staggerChildren: 0.05, staggerDirection: -1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { type: "spring" as const, stiffness: 100, damping: 12 }
        },
        exit: { opacity: 0, y: -10 }
    };

    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl mt-12 space-y-6"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-2">
                {/* Tabs */}
                <div className="flex space-x-1 bg-secondary/50 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab("client")}
                        className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "client" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {activeTab === "client" && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-background rounded-lg shadow-sm"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <Monitor size={16} />
                            Client Report
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab("dev")}
                        className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "dev" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        {activeTab === "dev" && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-background rounded-lg shadow-sm"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-2">
                            <Code size={16} />
                            Dev Analysis
                        </span>
                    </button>
                </div>

                {/* Download Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => handleDownload("/audit/raw", "raw-report.json")}
                        disabled={!!downloading}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50 active:scale-[0.98]"
                    >
                        <Download size={14} />
                        {downloading === "raw-report.json" ? "Downloading..." : "Full Report"}
                    </button>
                    <button
                        onClick={() => handleDownload("/audit/filtered", "filtered-report.json")}
                        disabled={!!downloading}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-lg transition-colors disabled:opacity-50 active:scale-[0.98]"
                    >
                        <FileText size={14} />
                        {downloading === "filtered-report.json" ? "Downloading..." : "a11y Report"}
                    </button>
                </div>
            </div>


            <div className="min-h-[400px]">


                {/* Client View */}
                {activeTab === "client" && client && (
                    <motion.div
                        key={`client-${data.url || Date.now()}`}
                        variants={containerVariants}
                        initial="hidden"
                        animate={isVisible ? "visible" : "hidden"}
                        exit="exit"
                        className="space-y-6"
                    >

                        {/* Score Card */}
                        <motion.div variants={itemVariants} className="bg-card dark:bg-slate-900/50 border border-border p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">Accessibility Score</h2>
                                <p className="text-muted-foreground">Overall compliance rating based on automated checks.</p>
                            </div>
                            {client.score !== undefined && (
                                <div className={`flex items-center gap-3 px-5 py-2 rounded-full border ${scoreColor(client.score)}`}>
                                    <span className="text-2xl font-bold">{Math.round(client.score * 100)}</span>
                                    <span className="text-sm font-medium opacity-80">/ 100</span>
                                </div>
                            )}
                        </motion.div>

                        {/* Summary */}
                        {client.summary && (
                            <motion.div variants={itemVariants} className="bg-primary/5 border border-primary/10 p-6 rounded-2xl">
                                <h3 className="flex items-center gap-2 text-lg font-semibold text-primary mb-3">
                                    <CheckCircle2 size={20} />
                                    Executive Summary
                                </h3>
                                <p className="text-foreground/80 leading-relaxed">{client.summary}</p>
                            </motion.div>
                        )}

                        {/* Issues Grid */}
                        {client.issues && client.issues.length > 0 && (
                            <motion.div variants={itemVariants} className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <AlertCircle size={20} className="text-orange-500" />
                                    Key Findings
                                </h3>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {client.issues.map((issue: any, index: number) => (
                                        <div
                                            key={index}
                                            className={`bg-card dark:bg-slate-900/50 p-5 rounded-2xl border border-border shadow-sm ${index === client.issues.length - 1 && client.issues.length % 2 !== 0 ? "md:col-span-2" : ""
                                                }`}
                                        >
                                            <div className="flex justify-between items-start gap-4 mb-2">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                    <h4 className="font-semibold text-foreground">{issue.title || "Potential Issue"}</h4>
                                                </div>
                                                {issue.displayValue && (
                                                    <span className="text-xs font-mono px-2.5 py-1 bg-secondary rounded-lg text-secondary-foreground whitespace-nowrap border border-transparent">
                                                        {issue.displayValue}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground pl-4 leading-relaxed">{issue.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}


                {/* Dev View */}
                {activeTab === "dev" && dev && (
                    <motion.div
                        key="dev"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                        <DevAnalysisView data={dev} />
                    </motion.div>
                )}

                {!client && activeTab === "client" && (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                        No client data available.
                    </div>
                )}
                {!dev && activeTab === "dev" && (
                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                        No dev data available.
                    </div>
                )}
            </div>
        </motion.div>
    );
}
