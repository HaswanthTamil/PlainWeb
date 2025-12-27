"use client";

import { useState } from "react";
import Image from "next/image";
import AuditForm from "../components/AuditForm";
import AuditResults from "../components/AuditResults";
import { Sparkles, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [auditData, setAuditData] = useState<any>(null);
  const [error, setError] = useState("");

  const handleAuditStart = () => {
    setAuditData(null);
    setError("");
  };

  const handleAuditComplete = (data: any) => {
    setAuditData(data);
  };

  const handleError = (msg: string) => {
    setError(msg);
  };

  return (
    <div className="flex min-h-screen flex-col relative overflow-hidden bg-background text-foreground selection:bg-primary/20">

      {/* Technical Background Grid */}
      <div className="absolute inset-0 w-full h-full bg-grid opacity-[0.04] dark:opacity-[0.08] pointer-events-none" />

      {/* Ambient Glows */}
      <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-purple-500/5 dark:bg-purple-600/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Navbar */}
      <header className="w-full py-6 px-6 md:px-12 flex justify-between items-center max-w-[1400px] mx-auto z-10">
        <div className="flex items-center gap-3 font-bold text-xl tracking-tight cursor-pointer group">
          <div className="w-20 h-20 relative flex items-center justify-center transition-transform group-hover:scale-105">
            <Image
              src="/temp.png"
              alt="Project Ally Logo"
              width={100}
              height={100}
              className="object-contain"
            />
          </div>
          <span className="text-slate-900 dark:text-white tracking-wide text-3xl font-bold">
            Project Ally
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">Features</a>
          <a href="#" className="hover:text-foreground transition-colors">Documentation</a>
          <a href="#" className="hover:text-foreground transition-colors">Pricing</a>
        </nav>
      </header>

      {/* Hero Section - Split Layout */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto z-10 flex flex-col items-center">

        <div className="w-full grid lg:grid-cols-2 gap-12 lg:gap-24 px-6 md:px-12 py-12 items-center">

          {/* Left Column: Content */}
          <div className="flex flex-col gap-8 max-w-2xl">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-100 dark:border-blue-900/50">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                v2.0 Now Available
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
                Audit your web <br />
                <span className="bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400 animate-text-shimmer">
                  {"accessibility".split("").map((char, index) => (
                    <span
                      key={index}
                      className="inline-block animate-reveal"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      {char}
                    </span>
                  ))}
                </span>
              </h1>

              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                Ensure your digital products are inclusive. Our AI-powered engine analyzes your website against WCAG 2.1 standards in seconds.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-500" />
                <span>WCAG 2.1 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-500" />
                <span>Enterprise Grade Security</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-yellow-500" />
                <span>Instant Analysis</span>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3 animate-fade-in">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                {error}
              </div>
            )}
          </div>

          {/* Right Column: Floating Widget */}
          <div className="lg:h-full flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-md">
              {/* Decor blur behind form */}
              <div className="absolute inset-0 bg-blue-500/10 blur-[60px] rounded-full transform scale-90" />
              <div className="relative transform hover:-translate-y-1 transition-transform duration-500 ease-out">
                <AuditForm
                  onAuditStart={handleAuditStart}
                  onAuditComplete={handleAuditComplete}
                  onError={handleError}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Section - Smooth Expansion */}
        <AnimatePresence mode="wait">
          {auditData && (
            <motion.div
              key={auditData.url || 'results'}
              id="results-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full px-6 md:px-12 overflow-hidden"
              onAnimationComplete={() => {
                const resultsElement = document.getElementById('results-section');
                if (resultsElement) {
                  const yOffset = -50; // Offset to not be right at the top
                  const y = resultsElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
                  window.scrollTo({ top: y, behavior: 'smooth' });
                }
              }}
            >
              <div className="pb-20">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent my-12" />
                <div className="flex justify-center">
                  <AuditResults data={auditData} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      <footer className="w-full py-8 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm mt-auto">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex flex-col md:flex-row items-center gap-2">
            <p>&copy; {new Date().getFullYear()} Project Ally Inc.</p>
            <span className="hidden md:block text-slate-300 dark:text-slate-700 mx-2">|</span>
            <p className="font-bold text-lg animate-neon tracking-wide">Built by Team Ally</p>
          </div>
          <div className="flex gap-8">
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
