"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { motion } from "framer-motion";

export default function DevAnalysisView({ data }: { data: any }) {
    const [copied, setCopied] = useState(false);
    const [displayedText, setDisplayedText] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);

    // Fallback if no assessment data provided
    const logs = data?.assessment || "No technical analysis log available.";

    useEffect(() => {
        if (currentIndex < logs.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(prev => prev + logs[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, 5); // 5ms per character for fast typewriter effect
            return () => clearTimeout(timeout);
        }
    }, [currentIndex, logs]);

    const handleCopy = () => {
        navigator.clipboard.writeText(logs);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Split displayed text into lines for rendering
    const lines = displayedText.split('\n');
    const isComplete = currentIndex >= logs.length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full bg-slate-950/85 backdrop-blur-xl rounded-xl border border-slate-800/50 overflow-hidden shadow-2xl flex flex-col font-mono text-sm leading-6 group hover:border-slate-700/80 transition-colors duration-300"
        >
            {/* Terminal Title Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-b border-slate-800/50">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5 mr-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors shadow-sm" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors shadow-sm" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-colors shadow-sm" />
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-medium px-2 py-0.5 rounded bg-slate-800/50 border border-slate-700/50">
                        <Terminal size={12} />
                        analysis_log.txt
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-2 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors text-xs font-medium"
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? "Copied" : "Copy Log"}
                    </button>
                </div>
            </div>

            {/* Log Content */}
            <div className="p-4 overflow-auto min-h-[500px] max-h-[800px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                <div className="relative">
                    {lines.map((line: string, index: number) => (
                        <div
                            key={index}
                            className="flex group/line hover:bg-slate-800/30 rounded px-1 -mx-1 transition-colors"
                        >
                            {/* Line Number */}
                            <span className="w-8 shrink-0 text-right mr-4 select-none text-slate-600/50 text-xs py-0.5 group-hover/line:text-slate-500 transition-colors">
                                {index + 1}
                            </span>

                            {/* Line Content */}
                            <div className="flex items-center">
                                <span
                                    className="text-slate-300 font-mono tracking-tight"
                                    dangerouslySetInnerHTML={{ __html: highlightLogLine(line) }}
                                />
                                {index === lines.length - 1 && !isComplete && (
                                    <span className="w-2.5 h-4 bg-blue-500/80 animate-pulse block ml-1 align-text-bottom" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

// Basic Syntax Highlighting for Logs
function highlightLogLine(line: string) {
    if (!line) return "&nbsp;";

    let styledLine = line
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Highlight Keys/Categories (e.g., "HTML Structure:", "Performance:")
    styledLine = styledLine.replace(
        /^(\s*\d+\.\s*)?([A-Za-z\s]+)(:)/g,
        '$1<span class="text-blue-400 font-bold">$2</span><span class="text-slate-500">$3</span>'
    );

    // Highlight Errors
    styledLine = styledLine.replace(
        /(error|fail|missing|invalid)/gi,
        '<span class="text-red-400 font-semibold">$1</span>'
    );

    // Highlight Warnings
    styledLine = styledLine.replace(
        /(warning|alert|caution)/gi,
        '<span class="text-yellow-400 font-semibold">$1</span>'
    );

    // Highlight Success/Good
    styledLine = styledLine.replace(
        /(success|passed|good|valid)/gi,
        '<span class="text-green-400 font-semibold">$1</span>'
    );

    // Highlight HTML Tags (e.g., <footer>)
    styledLine = styledLine.replace(
        /(&lt;\/?[a-z0-9]+&gt;)/gi,
        '<span class="text-purple-400 font-mono">$1</span>'
    );

    // Highlight Numbers/Metrics (e.g., 1.2s, 0.15), avoiding class names (e.g. blue-400)
    styledLine = styledLine.replace(
        /(?<!-)(\b\d+(\.\d+)?[a-z%]*\b)/gi,
        '<span class="text-cyan-400">$1</span>'
    );

    // Highlight specific technical terms
    styledLine = styledLine.replace(
        /(LCP|CLS|FID|INP|TBT|WCAG|ARIA)/g,
        '<span class="text-orange-400 font-bold">$1</span>'
    );

    return styledLine;
}
