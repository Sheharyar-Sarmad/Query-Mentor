"use client";

import { useEffect, useRef, useState } from "react";
import { 
  Loader2, 
  Send, 
  Mic, 
  MicOff, 
  Download, 
  Play, 
  Pause, 
  Square 
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { streamPost } from "@/lib/api";
import { cn } from "@/lib/utils";

// Add timestamp field
interface Message {
  role: "user" | "assistant";
  content: string;
  requestId?: string;
  streaming?: boolean;
  timestamp: number;
}

const SUGGESTIONS = [
  "hello",
  "What is a database index?",
  "Explain the difference between WHERE and HAVING",
  "When should I use a CTE?",
];

export function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Speech recognition (STT) state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Text-to-speech (TTS) state
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

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
        recognition.lang = "en-US"; // Default to English

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setInput(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          
          // Handle specific network error
          if (event.error === "network") {
            toast.error("Network error: Speech recognition requires an active internet connection. Please check your connection or disable any VPN/ad-blockers.");
          } else if (event.error !== "aborted") {
            toast.error(`Speech recognition error: ${event.error}`);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

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

    // Check if the browser is offline before starting
    if (!navigator.onLine) {
      toast.error("You are offline. Speech recognition requires an internet connection.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      // Stop any ongoing TTS before starting STT
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setSpeakingIndex(null);
        setIsPaused(false);
      }
      setInput("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.info("Listening...");
      } catch (error) {
        // Catch errors if the recognition is already started or fails to start
        console.error("Failed to start recognition:", error);
        toast.error("Could not start voice input. Please try again.");
        setIsListening(false);
      }
    }
  };

  // Text-to-Speech (TTS) function
  const speak = (text: string, index: number) => {
    if (!("speechSynthesis" in window)) {
      toast.error("Your browser does not support speech synthesis.");
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Remove markdown and code block symbols for more natural speech
    utterance.text = text.replace(/```[^`]*```/g, "Code block omitted.").replace(/[*_#`]/g, "");

    utterance.onend = () => {
      setSpeakingIndex(null);
      setIsPaused(false);
    };

    utterance.onerror = (e) => {
      console.error("TTS Error", e);
      setSpeakingIndex(null);
      setIsPaused(false);
    };

    setSpeakingIndex(index);
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
    setSpeakingIndex(null);
    setIsPaused(false);
  };

  // Download chat history
  const downloadChat = () => {
    if (messages.length === 0) {
      toast.error("No chat history to download.");
      return;
    }

    const chatText = messages
      .map((m) => {
        const time = new Date(m.timestamp).toLocaleString();
        return `[${time}] ${m.role.toUpperCase()}:\n${m.content}\n`;
      })
      .join("\n-------------------\n\n");

    const blob = new Blob([chatText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sql-mentor-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Chat history downloaded!");
  };

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || streaming) return;

    // Stop speech recognition before sending
    if (isListening) {
      recognitionRef.current?.stop();
    }
    // Stop speech synthesis before sending
    if (window.speechSynthesis.speaking) {
      stopSpeaking();
    }

    setInput("");
    setStreaming(true);
    setMessages((m) => [
      ...m,
      { role: "user", content: message, timestamp: Date.now() },
      { role: "assistant", content: "", streaming: true, timestamp: Date.now() },
    ]);

    await streamPost(
      "/chat/stream",
      { message },
      {
        onToken: (token) => {
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = {
                ...last,
                content: last.content + token,
              };
            }
            return copy;
          });
        },
        onDone: (payload) => {
          const p = payload as { request_id?: string };
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = {
                ...last,
                streaming: false,
                requestId: p.request_id,
              };
            }
            return copy;
          });
        },
        onError: (detail) => {
          toast.error(detail);
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = {
                ...last,
                content: last.content || "(failed to respond)",
                streaming: false,
              };
            }
            return copy;
          });
        },
      },
    );

    setStreaming(false);
  };

  return (
    <Card className="w-full min-w-0 max-w-full overflow-hidden border-border bg-card/40 backdrop-blur flex flex-col">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-card/60">
        <span className="text-xs font-medium text-muted-foreground">Chat Session</span>
        <div className="flex items-center gap-1">
          {/* Show stop button if TTS is currently playing */}
          {speakingIndex !== null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={stopSpeaking}
              className="h-8 px-2 text-xs text-red-400 hover:text-red-500 hover:bg-red-500/10"
            >
              <Square className="mr-1 h-3 w-3" /> Stop Audio
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadChat}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Download
          </Button>
        </div>
      </div>

      <CardContent className="flex h-[450px] max-h-[70vh] min-w-0 flex-col p-0">
        {/* Messages Scroll Area */}
        <div ref={scrollRef} className="flex w-full min-w-0 flex-1 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                Ask anything about SQL. Responses stream in real time.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full min-w-0 space-y-4">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "flex w-full min-w-0 flex-col",
                    m.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "relative max-w-[85%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-accent text-accent-foreground rounded-tr-sm"
                        : "border border-border bg-background/80 text-foreground rounded-tl-sm",
                    )}
                  >
                    {/* Message Content */}
                    <div className="whitespace-pre-wrap font-sans">
                      {m.content ||
                        (m.streaming && (
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            thinking…
                          </span>
                        ))}
                    </div>

                    {/* Bottom Info Bar: Timestamp + Audio Controls */}
                    <div className="mt-2 flex items-center justify-between gap-4 border-t border-border/50 pt-2 opacity-60">
                      <span className="text-[10px] font-mono">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      
                      {/* Show audio controls only for assistant messages */}
                      {m.role === "assistant" && !m.streaming && m.content && (
                        <div className="flex items-center gap-1">
                          {speakingIndex === i ? (
                            <>
                              {isPaused ? (
                                <button onClick={resumeSpeaking} className="hover:text-accent transition-colors" title="Resume">
                                  <Play className="h-3 w-3" />
                                </button>
                              ) : (
                                <button onClick={pauseSpeaking} className="hover:text-accent transition-colors" title="Pause">
                                  <Pause className="h-3 w-3" />
                                </button>
                              )}
                              <button onClick={stopSpeaking} className="hover:text-accent transition-colors" title="Stop">
                                <Square className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => speak(m.content, i)} className="hover:text-accent transition-colors" title="Read Aloud">
                              <Play className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {m.requestId && (
                      <div className="mt-1 font-mono text-[9px] text-muted-foreground opacity-50">
                        rid: {m.requestId}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Input Area */}
        <div className="z-10 w-full min-w-0 shrink-0 border-t border-border bg-card p-3">
          <div className="flex items-end gap-2">
            {/* Microphone Button */}
            <Button
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              onClick={toggleListening}
              className={cn(
                "h-10 w-10 flex-shrink-0 transition-all",
                isListening && "animate-pulse"
              )}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Listening..." : "Ask a SQL question…  (⌘/Ctrl + Enter to send)"}
              rows={2}
              className="resize-none bg-background/60 text-sm focus-visible:ring-accent"
              disabled={isListening}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            
            <Button
              onClick={() => send()}
              disabled={streaming || !input.trim()}
              size="icon"
              className="h-10 w-10 flex-shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {streaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}