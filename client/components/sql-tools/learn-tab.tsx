"use client";

import { useEffect, useRef, useState } from "react";
import { 
  Loader2, 
  Wand2, 
  Mic, 
  MicOff, 
  Download, 
  Play, 
  Pause, 
  Square 
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { ApiRequestError, Dialect, TextToSqlResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SqlBlock } from "./sql-block";

const DIALECTS: { value: Dialect; label: string }[] = [
  { value: "postgres", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "sqlite", label: "SQLite" },
];

const EXAMPLES = [
  "Create a users table with id, email, and created_at",
  "Show me the top 5 customers by total order amount",
  "Find all users who have never placed an order",
  "Calculate the running total of orders by date",
];

export function LearnTab() {
  const [question, setQuestion] = useState("");
  const [dialect, setDialect] = useState<Dialect>("postgres");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TextToSqlResponse | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  // Speech recognition (STT) state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  // Ref to store text that was already in the textarea before recording started
  const baseTextRef = useRef("");

  // Text-to-speech (TTS) state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Initialize Speech Recognition (STT)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        // FIX: Properly handle interim and final results without duplication
        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          // Combine the original text with the new transcript
          const baseText = baseTextRef.current;
          const separator = baseText && (finalTranscript || interimTranscript) ? " " : "";
          
          setQuestion(baseText + separator + finalTranscript + interimTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          if (event.error === "network") {
            toast.error("Network error: Speech recognition requires an active internet connection.");
          } else if (event.error !== "aborted") {
            toast.error(`Speech recognition error: ${event.error}`);
          }
          setIsListening(false);
        };

        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Toggle microphone status
  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Your browser does not support speech recognition. Please use Chrome or Edge.");
      return;
    }
    if (!navigator.onLine) {
      toast.error("You are offline. Speech recognition requires an internet connection.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPaused(false);
      }
      
      // FIX: Save the existing text before starting to listen
      baseTextRef.current = question;
      
      recognitionRef.current.start();
      setIsListening(true);
      toast.info("Listening...");
    }
  };

  // Text-to-Speech (TTS) functions
  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) {
      toast.error("Your browser does not support speech synthesis.");
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.text = text.replace(/[*_#`]/g, ""); // Remove markdown symbols

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    setIsSpeaking(true);
    setIsPaused(false);
    window.speechSynthesis.speak(utterance);
  };

  const pauseSpeaking = () => {
    window.speechSynthesis.pause();
    setIsPaused(true);
  };

  const resumeSpeaking = () => {
    window.speechSynthesis.resume();
    setIsPaused(false);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  // Download Result (SQL + Explanation)
  const downloadResult = () => {
    if (!result) return;

    const content = `-- Generated by QueryMentor\n-- Date: ${new Date(generatedAt || Date.now()).toLocaleString()}\n-- Dialect: ${result.dialect}\n\n${result.sql}\n\n/* Explanation:\n${result.explanation}\n*/\n`;
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query-${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("SQL file downloaded!");
  };

  const run = async () => {
    const q = question.trim();
    if (!q) {
      toast.error("Enter a question first.");
      return;
    }

    // Stop any ongoing audio
    if (isListening) recognitionRef.current?.stop();
    if (window.speechSynthesis.speaking) stopSpeaking();

    setLoading(true);
    setResult(null);

    try {
      const data = await api.textToSql({ question: q, dialect });
      setResult(data);
      setGeneratedAt(Date.now());
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      {/* Input */}
      <Card className="border-border bg-card/40 backdrop-blur">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-foreground">
              What do you want to write?
            </label>

            <Select
              value={dialect}
              onValueChange={(value) => setDialect(value as Dialect)}
            >
              <SelectTrigger className="w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50">
                {DIALECTS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Textarea with embedded Mic button */}
          <div className="relative">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Show me the top 5 customers by total order amount"
              rows={4}
              className="resize-none bg-background/60 pb-12 pr-12"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
              }}
            />
            <Button
              variant={isListening ? "destructive" : "ghost"}
              size="icon"
              onClick={toggleListening}
              className={cn(
                "absolute bottom-2 right-2 h-8 w-8 rounded-full transition-all",
                isListening && "animate-pulse"
              )}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setQuestion(ex)}
                className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={run}
              disabled={loading}
              className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate SQL
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full min-w-0"
        >
          <Card className="w-full min-w-0 border-border bg-card/40 backdrop-blur">
            <CardContent className="w-full min-w-0 space-y-5 p-5">
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
                  {result.dialect}
                </Badge>
                <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
                  cache: {result.cache}
                </Badge>
                {result.sources.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="border-emerald-800 bg-emerald-500/10 text-[10px] text-emerald-300"
                  >
                    source: {s}
                  </Badge>
                ))}
                
                {/* Timestamp and Download */}
                <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
                  {generatedAt && new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={downloadResult}
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    <Download className="mr-1 h-3 w-3" /> Download
                  </Button>
                </span>
              </div>

              <SqlBlock sql={result.sql} dialect={result.dialect} />

              {result.explanation && (
                <div className="w-full min-w-0">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Explanation
                    </h3>
                    
                    {/* TTS Controls */}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      {isSpeaking ? (
                        <>
                          {isPaused ? (
                            <button onClick={resumeSpeaking} className="hover:text-accent transition-colors" title="Resume">
                              <Play className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button onClick={pauseSpeaking} className="hover:text-accent transition-colors" title="Pause">
                              <Pause className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={stopSpeaking} className="hover:text-accent transition-colors" title="Stop">
                            <Square className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => speak(result.explanation)} className="hover:text-accent transition-colors flex items-center gap-1 text-[10px]" title="Read Explanation Aloud">
                          <Play className="h-3.5 w-3.5" /> Listen
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                    {result.explanation}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}