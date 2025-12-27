"use client";

import { useState } from "react";
import { API_BASE_URL } from "../lib/config";
import { Search, Loader2, Sparkles } from "lucide-react";

interface AuditFormProps {
    onAuditStart: () => void;
    onAuditComplete: (data: any) => void;
    onError: (error: string) => void;
}

export default function AuditForm({ onAuditStart, onAuditComplete, onError }: AuditFormProps) {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setLoading(true);
        onAuditStart();
        onError("");

        try {
            const [clientResponse, devResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/audit/summary`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url }),
                }),
                fetch(`${API_BASE_URL}/audit/analysis`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url }),
                })
            ]);

            if (!clientResponse.ok) throw new Error(`Client API Error: ${clientResponse.statusText}`);
            if (!devResponse.ok) throw new Error(`Dev API Error: ${devResponse.statusText}`);

            const clientData = await clientResponse.json();
            const devData = await devResponse.json();

            onAuditComplete({
                client: clientData,
                dev: devData,
                url
            });
        } catch (err: any) {
            onError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const handleVisualize = () => {
        onAuditStart();
        onError("");

        // Mock data for visualization
        const mockData = {
            url: "https://example.com/demo",
            client: {
                score: 0.85,
                summary: "This is a demonstation summary. The website has good structural integrity but lacks some ARIA labels and color contrast ratios could be improved.",
                issues: [
                    { title: "Missing Alt Text", description: "Images found without alt attributes.", displayValue: "3 images" },
                    { title: "Low Contrast", description: "Text elements typically need a contrast ratio of 4.5:1.", displayValue: "5 elements" },
                    { title: "Form Labels", description: "Some form inputs are missing associated labels.", displayValue: "2 inputs" }
                ]
            },
            dev: {
                assessment: "Technical Analysis (Demo):\n\n1. HTML Structure: Semantic elements are used correctly in most places, but the footer is missing a <footer> tag.\n2. ARIA: The navigation menu needs 'aria-expanded' attributes for dropdowns.\n3. Focus Management: Focus outlines are suppressed on some buttons, which affects keyboard navigation.\n4. Performance: LCP is good (1.2s), but CLS is slightly high (0.15)."
            }
        };

        // Simulate a small delay for realism
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            onAuditComplete(mockData);
        }, 800);
    };

    return (
        <div className="w-full max-w-md bg-card dark:bg-slate-900 border border-border dark:border-slate-800 rounded-2xl p-8 shadow-2xl animate-fade-in relative overflow-hidden group">
            {/* decoration */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label htmlFor="url" className="text-sm font-medium text-muted-foreground ml-1">
                        Website URL
                    </label>
                    <div className="relative group/input">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within/input:text-primary transition-colors">
                            <Search size={18} />
                        </div>
                        <input
                            id="url"
                            type="url"
                            placeholder="https://example.com"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                            className="w-full pl-10 pr-4 py-3 bg-secondary/50 lg:bg-secondary/30 border border-input rounded-xl focus:bg-slate-50 dark:focus:bg-slate-950 focus:ring-2 focus:ring-ring focus:border-input outline-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-muted-foreground/50 text-foreground"
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : "Run Audit"}
                    </button>

                    <button
                        type="button"
                        onClick={handleVisualize}
                        disabled={loading}
                        className="py-3 px-6 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium rounded-xl border border-border active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        <Sparkles size={18} className="text-purple-500" />
                        <span>Visualize</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
